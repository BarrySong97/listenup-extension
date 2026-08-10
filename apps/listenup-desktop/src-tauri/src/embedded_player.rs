// @purpose 创建本地 player-ui + 远程 youtube child WebView，并承接受限 EmbeddedSource IPC。
// @role    Desktop 内置播放的原生容器、URL/导航门、WebView 身份门、bounds 同步和显式退出入口。
// @deps    tauri unstable multiwebview、embedded_source、SourceCoordinator、Vite Embedded bridge bundle
// @gotcha  youtube-* 只能调用 embedded_source_event；导航/popup/download 默认拒绝，退出先关远程 WebView。

use std::{
    collections::HashMap,
    sync::{atomic::AtomicU64, atomic::Ordering, Mutex},
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri::{
    webview::{NewWindowResponse, WebviewBuilder},
    window::WindowBuilder,
    AppHandle, Emitter, Manager, State, Webview, WebviewUrl, WindowEvent,
};

use super::{
    dispatch_browser_playback_command,
    embedded_source::{parse_embedded_message, EmbeddedRateLimiter},
    source_coordinator::{BrowserPauseState, SourceRef},
    DatabaseState, PlaybackAction, SharedBridges, SharedPlaybackCommands, SharedStore, UiUpdate,
    UPDATE_EVENT,
};

const PLAYER_WINDOW_LABEL: &str = "player";
const PLAYER_UI_LABEL: &str = "player-ui";
const YOUTUBE_WEBVIEW_PREFIX: &str = "youtube-";
const MAX_BRIDGE_VIOLATIONS: u8 = 5;
static NEXT_EMBEDDED_SOURCE_ID: AtomicU64 = AtomicU64::new(0);
const EMBEDDED_BRIDGE_BUNDLE: &str = include_str!(concat!(env!("OUT_DIR"), "/embedded-bridge.js"));

struct EmbeddedRuntime {
    source: SourceRef,
    youtube_webview_label: String,
    normalized_url: String,
    limiter: EmbeddedRateLimiter,
    violations: u8,
    last_message_at: Instant,
    recovering_reported: bool,
    next_command_id: u64,
    pending_commands: HashMap<String, tokio::sync::oneshot::Sender<Result<(), String>>>,
}

#[derive(Default)]
pub(crate) struct SharedEmbeddedRuntime(Mutex<Option<EmbeddedRuntime>>);

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StartEmbeddedResult {
    source: SourceRef,
    normalized_url: String,
    pause_warning: Option<String>,
}

pub(crate) fn normalize_youtube_watch_url(input: &str) -> Result<(String, String), String> {
    let url =
        tauri::Url::parse(input.trim()).map_err(|_| "请输入有效的 YouTube 链接".to_string())?;
    if url.scheme() != "https" {
        return Err("只支持 HTTPS YouTube 链接".to_string());
    }
    if url.port().is_some() || !url.username().is_empty() || url.password().is_some() {
        return Err("YouTube 链接不能包含端口或登录信息".to_string());
    }
    let video_id = match url.host_str() {
        Some("www.youtube.com" | "youtube.com") if url.path() == "/watch" => url
            .query_pairs()
            .find_map(|(key, value)| (key == "v").then(|| value.into_owned())),
        Some("youtu.be") => url.path_segments().and_then(|segments| {
            let segments = segments
                .filter(|segment| !segment.is_empty())
                .collect::<Vec<_>>();
            (segments.len() == 1).then(|| segments[0].to_string())
        }),
        _ => None,
    }
    .filter(|video_id| {
        video_id.len() == 11
            && video_id
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
    })
    .ok_or_else(|| "链接中没有有效的 YouTube videoId".to_string())?;
    Ok((
        format!("https://www.youtube.com/watch?v={video_id}"),
        video_id,
    ))
}

fn next_source(video_id: String) -> SourceRef {
    let id = NEXT_EMBEDDED_SOURCE_ID.fetch_add(1, Ordering::Relaxed) + 1;
    SourceRef::embedded(
        format!("player-{id}"),
        format!("embedded-session-{id}"),
        video_id,
    )
}

fn navigation_is_allowed(url: &tauri::Url, video_id: &str) -> bool {
    url.scheme() == "https"
        && url.host_str() == Some("www.youtube.com")
        && url.path() == "/watch"
        && url
            .query_pairs()
            .any(|(key, value)| key == "v" && value == video_id)
}

fn initialization_script(source: &SourceRef) -> String {
    let source_id = serde_json::to_string(&source.source_id).expect("source id JSON");
    let session_id = serde_json::to_string(&source.session_id).expect("session id JSON");
    let video_id = serde_json::to_string(&source.video_id).expect("video id JSON");
    format!(
        r#"(() => {{
          if (window.location.origin !== 'https://www.youtube.com') return;
          const identity = Object.freeze({{ sourceId: {source_id}, sessionId: {session_id}, videoId: {video_id} }});
          const controlListeners = new Set();
          const emit = (event) => {{
            if (!event || typeof event !== 'object') return;
            const payload = JSON.stringify({{ ...event, ...identity, videoId: identity.videoId }});
            void window.__TAURI_INTERNALS__.invoke('embedded_source_event', {{ payload }});
          }};
          Object.defineProperty(window, '__listenupEmbeddedBridge', {{
            configurable: false,
            writable: false,
            value: Object.freeze({{
              emit,
              onControl(listener) {{ if (typeof listener === 'function') controlListeners.add(listener); }}
            }})
          }});
          Object.defineProperty(window, '__listenupEmbeddedDispatch', {{
            configurable: false,
            writable: false,
            value: (command) => controlListeners.forEach((listener) => listener(command))
          }});
        }})();
        {EMBEDDED_BRIDGE_BUNDLE}"#
    )
}

fn create_player_container(
    app: &AppHandle,
    source: &SourceRef,
    normalized_url: &str,
) -> Result<(), String> {
    if app.get_window(PLAYER_WINDOW_LABEL).is_some() {
        return Err("Desktop Player 窗口已经存在".to_string());
    }
    let window = WindowBuilder::new(app, PLAYER_WINDOW_LABEL)
        .title("ListenUp · Desktop 播放")
        .inner_size(960.0, 820.0)
        .min_inner_size(720.0, 620.0)
        .center()
        .visible(false)
        .build()
        .map_err(|error| format!("创建 Player 窗口失败：{error}"))?;

    let size = window
        .inner_size()
        .map_err(|error| format!("读取 Player 尺寸失败：{error}"))?;
    window
        .add_child(
            WebviewBuilder::new(PLAYER_UI_LABEL, WebviewUrl::App("player.html".into()))
                .auto_resize(),
            tauri::LogicalPosition::new(0.0, 0.0),
            tauri::PhysicalSize::new(size.width, size.height),
        )
        .map_err(|error| format!("创建本地 Player UI 失败：{error}"))?;

    if let Err(error) = add_youtube_child(app, &window, source, normalized_url) {
        let _ = window.close();
        return Err(error);
    }

    let app_on_destroy = app.clone();
    window.on_window_event(move |event| {
        if matches!(event, WindowEvent::Destroyed) {
            release_current_embedded_source(&app_on_destroy);
        }
    });
    window
        .show()
        .map_err(|error| format!("显示 Player 窗口失败：{error}"))?;
    window.set_focus().ok();
    Ok(())
}

fn add_youtube_child(
    app: &AppHandle,
    window: &tauri::Window,
    source: &SourceRef,
    normalized_url: &str,
) -> Result<(), String> {
    let youtube_label = format!("{YOUTUBE_WEBVIEW_PREFIX}{}", source.source_id);
    let expected_video_id = source.video_id.clone();
    let builder = WebviewBuilder::new(
        &youtube_label,
        WebviewUrl::External(
            normalized_url
                .parse()
                .map_err(|_| "规范化 YouTube URL 无效".to_string())?,
        ),
    )
    .initialization_script(initialization_script(source))
    .on_navigation(move |url| navigation_is_allowed(url, &expected_video_id))
    .on_new_window(|_, _| NewWindowResponse::Deny)
    .on_download(|_, _| false)
    .disable_drag_drop_handler();

    {
        let runtime = app.state::<SharedEmbeddedRuntime>();
        *runtime
            .0
            .lock()
            .map_err(|_| "Embedded runtime 状态暂时不可用".to_string())? = Some(EmbeddedRuntime {
            source: source.clone(),
            youtube_webview_label: youtube_label.clone(),
            normalized_url: normalized_url.to_string(),
            limiter: EmbeddedRateLimiter::new(Instant::now()),
            violations: 0,
            last_message_at: Instant::now(),
            recovering_reported: false,
            next_command_id: 0,
            pending_commands: HashMap::new(),
        });
    }

    if let Err(error) = window.add_child(
        builder,
        tauri::LogicalPosition::new(0.0, 56.0),
        tauri::LogicalSize::new(960.0, 540.0),
    ) {
        return Err(format!("创建受限 YouTube WebView 失败：{error}"));
    }
    spawn_embedded_watchdog(app.clone(), source.clone());
    Ok(())
}

fn spawn_embedded_watchdog(app: AppHandle, source: SourceRef) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            let should_recover = {
                let runtime = app.state::<SharedEmbeddedRuntime>();
                let Ok(mut runtime) = runtime.0.lock() else {
                    return;
                };
                let Some(active) = runtime.as_mut() else {
                    return;
                };
                if active.source != source {
                    return;
                }
                let timed_out =
                    active.last_message_at.elapsed() >= std::time::Duration::from_secs(5);
                if timed_out && !active.recovering_reported {
                    active.recovering_reported = true;
                    true
                } else {
                    false
                }
            };
            if should_recover {
                let snapshot =
                    app.state::<SharedStore>()
                        .0
                        .lock()
                        .ok()
                        .and_then(|mut coordinator| {
                            coordinator.mark_embedded_recovering(&source).ok()?;
                            Some(coordinator.snapshot())
                        });
                if let Some(snapshot) = snapshot {
                    let _ = app.emit(UPDATE_EVENT, UiUpdate::Snapshot(snapshot));
                }
            }
        }
    });
}

fn release_embedded_source(app: &AppHandle, source: &SourceRef) {
    if let Ok(mut runtime) = app.state::<SharedEmbeddedRuntime>().0.lock() {
        if runtime
            .as_ref()
            .is_some_and(|runtime| runtime.source == *source)
        {
            if let Some(active) = runtime.as_mut() {
                for (_, sender) in active.pending_commands.drain() {
                    let _ = sender.send(Err("Desktop 播放已经退出".to_string()));
                }
            }
            *runtime = None;
        }
    }
    let snapshot = app
        .state::<SharedStore>()
        .0
        .lock()
        .ok()
        .and_then(|mut coordinator| coordinator.exit_embedded(source).ok());
    if let Some(snapshot) = snapshot {
        let _ = app.emit(UPDATE_EVENT, UiUpdate::Snapshot(snapshot));
    }
}

fn release_current_embedded_source(app: &AppHandle) {
    let source = app
        .state::<SharedEmbeddedRuntime>()
        .0
        .lock()
        .ok()
        .and_then(|runtime| runtime.as_ref().map(|active| active.source.clone()))
        .or_else(|| app.state::<SharedStore>().0.lock().ok()?.current_source());
    if let Some(source) = source {
        release_embedded_source(app, &source);
    }
}

pub(crate) async fn dispatch_embedded_playback_command(
    app: &AppHandle,
    runtime: &SharedEmbeddedRuntime,
    source: &SourceRef,
    action: PlaybackAction,
    seek_time: Option<f64>,
) -> Result<(), String> {
    let (label, command_id, receiver) = {
        let mut runtime = runtime
            .0
            .lock()
            .map_err(|_| "Embedded runtime 状态暂时不可用".to_string())?;
        let active = runtime
            .as_mut()
            .ok_or_else(|| "YouTube WebView 已经关闭".to_string())?;
        if active.source != *source {
            return Err("Embedded 播放控制来源身份不匹配".to_string());
        }
        active.next_command_id += 1;
        let command_id = format!("embedded-command-{}", active.next_command_id);
        let (sender, receiver) = tokio::sync::oneshot::channel();
        active.pending_commands.insert(command_id.clone(), sender);
        (active.youtube_webview_label.clone(), command_id, receiver)
    };
    let action_name = match action {
        PlaybackAction::Play => "play",
        PlaybackAction::Pause => "pause",
        PlaybackAction::Seek => "seek",
    };
    let command = serde_json::json!({
        "commandId": command_id.clone(),
        "action": action_name,
        "seekTime": seek_time,
    });
    let script = format!(
        "window.__listenupEmbeddedDispatch?.({})",
        serde_json::to_string(&command).map_err(|_| "序列化播放命令失败".to_string())?
    );
    let send_result = app
        .get_webview(&label)
        .ok_or_else(|| "YouTube WebView 已经关闭".to_string())?
        .eval(script)
        .map_err(|error| format!("发送 Embedded 播放命令失败：{error}"));
    if let Err(error) = send_result {
        if let Ok(mut runtime) = runtime.0.lock() {
            if let Some(active) = runtime.as_mut() {
                active.pending_commands.remove(&command_id);
            }
        }
        return Err(error);
    }
    match tokio::time::timeout(Duration::from_secs(2), receiver).await {
        Ok(Ok(result)) => result,
        Ok(Err(_)) => Err("Embedded 播放响应通道已经关闭".to_string()),
        Err(_) => {
            if let Ok(mut runtime) = runtime.0.lock() {
                if let Some(active) = runtime.as_mut() {
                    active.pending_commands.remove(&command_id);
                }
            }
            Err("Embedded 播放控制超时".to_string())
        }
    }
}

#[cfg(unix)]
#[tauri::command]
pub(crate) async fn start_embedded_playback(
    webview: Webview,
    app: AppHandle,
    store: State<'_, SharedStore>,
    bridges: State<'_, SharedBridges>,
    commands: State<'_, SharedPlaybackCommands>,
    url: String,
) -> Result<StartEmbeddedResult, String> {
    if webview.label() != "main" {
        return Err("只有主窗口可以启动 Desktop 播放".to_string());
    }
    let (normalized_url, video_id) = normalize_youtube_watch_url(&url)?;
    let source = next_source(video_id);
    let enter = store
        .0
        .lock()
        .map_err(|_| "字幕来源状态暂时不可用".to_string())?
        .enter_embedded(source.clone())?;
    let _ = app.emit(
        UPDATE_EVENT,
        UiUpdate::Snapshot(
            store
                .0
                .lock()
                .map_err(|_| "字幕来源状态暂时不可用".to_string())?
                .snapshot(),
        ),
    );

    let pause_warning = if let Some(target) = enter.pause_target {
        match dispatch_browser_playback_command(
            &bridges,
            &commands,
            target,
            PlaybackAction::Pause,
            None,
        )
        .await
        {
            Ok(()) => {
                if let Ok(mut coordinator) = store.0.lock() {
                    coordinator.record_browser_pause_result(BrowserPauseState::Succeeded);
                }
                None
            }
            Err(error) => {
                if let Ok(mut coordinator) = store.0.lock() {
                    let state = if error.contains("超时") {
                        BrowserPauseState::TimedOut
                    } else {
                        BrowserPauseState::Failed(error.clone())
                    };
                    coordinator.record_browser_pause_result(state);
                }
                Some(format!("未能自动暂停浏览器视频：{error}"))
            }
        }
    } else {
        None
    };

    if let Err(error) = create_player_container(&app, &source, &normalized_url) {
        let snapshot = store.0.lock().ok().and_then(|mut coordinator| {
            coordinator.mark_embedded_recovering(&source).ok()?;
            Some(coordinator.snapshot())
        });
        if let Some(snapshot) = snapshot {
            let _ = app.emit(UPDATE_EVENT, UiUpdate::Snapshot(snapshot));
        }
        return Err(error);
    }

    Ok(StartEmbeddedResult {
        source,
        normalized_url,
        pause_warning,
    })
}

#[tauri::command]
pub(crate) async fn embedded_source_event(
    webview: Webview,
    app: AppHandle,
    runtime: State<'_, SharedEmbeddedRuntime>,
    store: State<'_, SharedStore>,
    database: State<'_, DatabaseState>,
    payload: String,
) -> Result<(), String> {
    let (source, message) = {
        let mut runtime = runtime
            .0
            .lock()
            .map_err(|_| "Embedded runtime 状态暂时不可用".to_string())?;
        let active = runtime
            .as_mut()
            .ok_or_else(|| "Embedded runtime 已经关闭".to_string())?;
        if webview.label() != active.youtube_webview_label {
            return Err("Embedded WebView label 不匹配".to_string());
        }
        match parse_embedded_message(
            &payload,
            &active.source,
            &mut active.limiter,
            Instant::now(),
        ) {
            Ok(message) => {
                active.violations = 0;
                active.last_message_at = Instant::now();
                active.recovering_reported = false;
                (active.source.clone(), message)
            }
            Err(error) => {
                active.violations = active.violations.saturating_add(1);
                let quarantine_label = (active.violations >= MAX_BRIDGE_VIOLATIONS)
                    .then(|| active.youtube_webview_label.clone());
                if let Some(label) = &quarantine_label {
                    if let Some(webview) = app.get_webview(label) {
                        let _ = webview.close();
                    }
                    let snapshot = store.0.lock().ok().and_then(|mut coordinator| {
                        coordinator.mark_embedded_recovering(&active.source).ok()?;
                        Some(coordinator.snapshot())
                    });
                    if let Some(snapshot) = snapshot {
                        let _ = app.emit(UPDATE_EVENT, UiUpdate::Snapshot(snapshot));
                    }
                }
                return Err(error);
            }
        }
    };
    let source_snapshot = message.source_snapshot();
    if let Some((command_id, ok, error)) = message.control_result() {
        if let Ok(mut runtime) = runtime.0.lock() {
            if let Some(sender) = runtime
                .as_mut()
                .and_then(|active| active.pending_commands.remove(command_id))
            {
                let result = if ok {
                    Ok(())
                } else {
                    Err(error.unwrap_or("Embedded 播放控制失败").to_string())
                };
                let _ = sender.send(result);
            }
        }
    }
    let outcome = store
        .0
        .lock()
        .map_err(|_| "字幕来源状态暂时不可用".to_string())?
        .apply_embedded_message(&source, message)?;
    if outcome.persist_source {
        if let (Some(database), Some(snapshot)) = (database.0.as_ref(), source_snapshot) {
            database.store_source(snapshot).await?;
        }
    }
    if let Some(update) = outcome.update {
        let _ = app.emit(UPDATE_EVENT, update);
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn set_embedded_video_bounds(
    webview: Webview,
    app: AppHandle,
    runtime: State<'_, SharedEmbeddedRuntime>,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if webview.label() != PLAYER_UI_LABEL {
        return Err("只有本地 Player UI 可以调整视频区域".to_string());
    }
    if ![x, y, width, height].into_iter().all(f64::is_finite)
        || x < 0.0
        || y < 0.0
        || width < 320.0
        || height < 180.0
        || width > 4096.0
        || height > 2304.0
    {
        return Err("视频区域尺寸无效".to_string());
    }
    let label = runtime
        .0
        .lock()
        .map_err(|_| "Embedded runtime 状态暂时不可用".to_string())?
        .as_ref()
        .map(|runtime| runtime.youtube_webview_label.clone())
        .ok_or_else(|| "YouTube WebView 已经关闭".to_string())?;
    let youtube = app
        .get_webview(&label)
        .ok_or_else(|| "YouTube WebView 已经关闭".to_string())?;
    youtube
        .set_position(tauri::LogicalPosition::new(x, y))
        .map_err(|error| format!("调整视频位置失败：{error}"))?;
    youtube
        .set_size(tauri::LogicalSize::new(width, height))
        .map_err(|error| format!("调整视频尺寸失败：{error}"))
}

#[tauri::command]
pub(crate) fn stop_embedded_playback(
    webview: Webview,
    app: AppHandle,
    runtime: State<'_, SharedEmbeddedRuntime>,
    store: State<'_, SharedStore>,
) -> Result<(), String> {
    if webview.label() != PLAYER_UI_LABEL && webview.label() != "main" {
        return Err("当前 WebView 不能退出 Desktop 播放".to_string());
    }
    let active_runtime = runtime
        .0
        .lock()
        .map_err(|_| "Embedded runtime 状态暂时不可用".to_string())?
        .as_ref()
        .map(|runtime| {
            (
                runtime.source.clone(),
                runtime.youtube_webview_label.clone(),
            )
        });
    let source = active_runtime
        .as_ref()
        .map(|(source, _)| source.clone())
        .or_else(|| store.0.lock().ok()?.current_source())
        .filter(|source| source.kind == super::source_coordinator::SourceKind::Embedded)
        .ok_or_else(|| "Desktop 播放已经退出".to_string())?;
    if let Some((_, youtube_label)) = active_runtime {
        if let Some(youtube) = app.get_webview(&youtube_label) {
            youtube
                .close()
                .map_err(|error| format!("关闭 YouTube WebView 失败：{error}"))?;
        }
    }
    release_embedded_source(&app, &source);
    if let Some(window) = app.get_window(PLAYER_WINDOW_LABEL) {
        let _ = window.close();
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn reload_embedded_playback(
    webview: Webview,
    app: AppHandle,
    runtime: State<'_, SharedEmbeddedRuntime>,
    store: State<'_, SharedStore>,
) -> Result<(), String> {
    if webview.label() != PLAYER_UI_LABEL {
        return Err("只有本地 Player UI 可以重新加载视频".to_string());
    }
    let (source, label, normalized_url) = {
        let mut runtime = runtime
            .0
            .lock()
            .map_err(|_| "Embedded runtime 状态暂时不可用".to_string())?;
        let active = runtime
            .as_mut()
            .ok_or_else(|| "YouTube WebView 已经关闭".to_string())?;
        active.limiter = EmbeddedRateLimiter::new(Instant::now());
        active.last_message_at = Instant::now();
        active.recovering_reported = false;
        (
            active.source.clone(),
            active.youtube_webview_label.clone(),
            active.normalized_url.clone(),
        )
    };
    let snapshot = store.0.lock().ok().and_then(|mut coordinator| {
        coordinator.mark_embedded_recovering(&source).ok()?;
        Some(coordinator.snapshot())
    });
    if let Some(snapshot) = snapshot {
        let _ = app.emit(UPDATE_EVENT, UiUpdate::Snapshot(snapshot));
    }
    if let Some(youtube) = app.get_webview(&label) {
        return youtube
            .reload()
            .map_err(|error| format!("重新加载 YouTube 失败：{error}"));
    }
    let window = app
        .get_window(PLAYER_WINDOW_LABEL)
        .ok_or_else(|| "Player 窗口已经关闭".to_string())?;
    add_youtube_child(&app, &window, &source, &normalized_url)
}

#[tauri::command]
pub(crate) fn replace_embedded_playback(
    webview: Webview,
    app: AppHandle,
    runtime: State<'_, SharedEmbeddedRuntime>,
    store: State<'_, SharedStore>,
    url: String,
) -> Result<StartEmbeddedResult, String> {
    if webview.label() != PLAYER_UI_LABEL {
        return Err("只有本地 Player UI 可以更换视频".to_string());
    }
    let (normalized_url, video_id) = normalize_youtube_watch_url(&url)?;
    let (old_source, old_label) = {
        let mut runtime = runtime
            .0
            .lock()
            .map_err(|_| "Embedded runtime 状态暂时不可用".to_string())?;
        let active = runtime
            .take()
            .ok_or_else(|| "Desktop 播放已经退出".to_string())?;
        for (_, sender) in active.pending_commands {
            let _ = sender.send(Err("正在更换 Desktop 视频".to_string()));
        }
        (active.source, active.youtube_webview_label)
    };
    if let Some(youtube) = app.get_webview(&old_label) {
        let _ = youtube.close();
    }

    let source = next_source(video_id);
    let snapshot = {
        let mut coordinator = store
            .0
            .lock()
            .map_err(|_| "字幕来源状态暂时不可用".to_string())?;
        coordinator.exit_embedded(&old_source)?;
        coordinator.enter_embedded(source.clone())?;
        coordinator.snapshot()
    };
    let _ = app.emit(UPDATE_EVENT, UiUpdate::Snapshot(snapshot));

    let window = app
        .get_window(PLAYER_WINDOW_LABEL)
        .ok_or_else(|| "Player 窗口已经关闭".to_string())?;
    if let Err(error) = add_youtube_child(&app, &window, &source, &normalized_url) {
        let snapshot = store.0.lock().ok().and_then(|mut coordinator| {
            coordinator.mark_embedded_recovering(&source).ok()?;
            Some(coordinator.snapshot())
        });
        if let Some(snapshot) = snapshot {
            let _ = app.emit(UPDATE_EVENT, UiUpdate::Snapshot(snapshot));
        }
        return Err(error);
    }
    Ok(StartEmbeddedResult {
        source,
        normalized_url,
        pause_warning: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonicalizes_only_supported_youtube_watch_urls() {
        assert_eq!(
            normalize_youtube_watch_url("https://youtu.be/abcdefghijk?t=4").unwrap(),
            (
                "https://www.youtube.com/watch?v=abcdefghijk".to_string(),
                "abcdefghijk".to_string()
            )
        );
        assert_eq!(
            normalize_youtube_watch_url(
                "https://www.youtube.com/watch?feature=share&v=abc_def-123"
            )
            .unwrap()
            .0,
            "https://www.youtube.com/watch?v=abc_def-123"
        );
        for invalid in [
            "http://www.youtube.com/watch?v=abcdefghijk",
            "https://www.youtube.com/",
            "https://www.youtube.com/account?v=abcdefghijk",
            "https://example.com/watch?v=abcdefghijk",
            "https://youtu.be/short",
            "https://youtu.be/abcdefghijk/extra",
            "https://www.youtube.com:444/watch?v=abcdefghijk",
        ] {
            assert!(normalize_youtube_watch_url(invalid).is_err(), "{invalid}");
        }
    }

    #[test]
    fn navigation_gate_keeps_the_expected_watch_identity() {
        let expected = "abcdefghijk";
        assert!(navigation_is_allowed(
            &"https://www.youtube.com/watch?v=abcdefghijk"
                .parse()
                .unwrap(),
            expected
        ));
        assert!(!navigation_is_allowed(
            &"https://www.youtube.com/watch?v=other123456"
                .parse()
                .unwrap(),
            expected
        ));
        assert!(!navigation_is_allowed(
            &"https://www.youtube.com/channel/example".parse().unwrap(),
            expected
        ));
    }

    #[test]
    fn injected_bundle_uses_fixed_bridge_instead_of_tauri_invoke() {
        assert!(!EMBEDDED_BRIDGE_BUNDLE.contains("__TAURI_INTERNALS__"));
        assert!(!EMBEDDED_BRIDGE_BUNDLE.contains("invoke("));
        assert!(EMBEDDED_BRIDGE_BUNDLE.contains("__listenupEmbeddedBridge"));
        assert_eq!(crate::embedded_source::EMBEDDED_PROTOCOL_VERSION, 1);
    }
}
