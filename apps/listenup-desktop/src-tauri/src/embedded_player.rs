// @purpose 协调主窗口内 YouTube IFrame Player 与 EmbeddedSource，不创建远程 WebView 或第二窗口。
// @role    Desktop 自播的来源生命周期、受限事件入口和播放命令确认通道。
// @deps    embedded_source、SourceCoordinator、Tauri event、SQLite
// @gotcha  进入自播后 browser pause 仅后台尽力发送且结果静默；iframe 仍没有 Tauri capability。

use std::{
    sync::{atomic::AtomicU64, atomic::Ordering, Mutex},
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, Webview};

use super::{
    dispatch_browser_playback_command,
    embedded_source::{parse_embedded_message, EmbeddedRateLimiter},
    source_coordinator::{BrowserPauseState, SourceKind, SourceRef},
    DatabaseState, PlaybackAction, SharedBridges, SharedPlaybackCommands, SharedStore, UiUpdate,
    UPDATE_EVENT,
};

const MAIN_WEBVIEW_LABEL: &str = "main";
const EMBEDDED_PLAYBACK_COMMAND_EVENT: &str = "embedded-playback-command";
const EMBEDDED_RELOAD_EVENT: &str = "embedded-player-reload";
static NEXT_EMBEDDED_SOURCE_ID: AtomicU64 = AtomicU64::new(0);

struct EmbeddedRuntime {
    source: SourceRef,
    limiter: EmbeddedRateLimiter,
    next_command_id: u64,
    pending_commands:
        std::collections::HashMap<String, tokio::sync::oneshot::Sender<Result<(), String>>>,
}

#[derive(Default)]
pub(crate) struct SharedEmbeddedRuntime(Mutex<Option<EmbeddedRuntime>>);

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StartEmbeddedResult {
    source: SourceRef,
    normalized_url: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct EmbeddedPlaybackCommand {
    command_id: String,
    source_id: String,
    session_id: String,
    video_id: String,
    action: PlaybackAction,
    #[serde(skip_serializing_if = "Option::is_none")]
    seek_time: Option<f64>,
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
    .filter(|video_id| valid_video_id(video_id))
    .ok_or_else(|| "链接中没有有效的 YouTube videoId".to_string())?;
    Ok((
        format!("https://www.youtube.com/watch?v={video_id}"),
        video_id,
    ))
}

pub(crate) fn valid_video_id(video_id: &str) -> bool {
    video_id.len() == 11
        && video_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
}

fn next_source(video_id: String) -> SourceRef {
    let id = NEXT_EMBEDDED_SOURCE_ID.fetch_add(1, Ordering::Relaxed) + 1;
    SourceRef::embedded(
        format!("iframe-{id}"),
        format!("embedded-session-{id}"),
        video_id,
    )
}

fn new_runtime(source: SourceRef) -> EmbeddedRuntime {
    EmbeddedRuntime {
        source,
        limiter: EmbeddedRateLimiter::new(Instant::now()),
        next_command_id: 0,
        pending_commands: std::collections::HashMap::new(),
    }
}

fn reject_pending(runtime: &mut EmbeddedRuntime, reason: &str) {
    for (_, sender) in runtime.pending_commands.drain() {
        let _ = sender.send(Err(reason.to_string()));
    }
}

pub(crate) async fn dispatch_embedded_playback_command(
    app: &AppHandle,
    runtime: &SharedEmbeddedRuntime,
    source: &SourceRef,
    action: PlaybackAction,
    seek_time: Option<f64>,
) -> Result<(), String> {
    let (command, receiver) = {
        let mut runtime = runtime
            .0
            .lock()
            .map_err(|_| "Embedded runtime 状态暂时不可用".to_string())?;
        let active = runtime
            .as_mut()
            .ok_or_else(|| "Desktop iframe 已经退出".to_string())?;
        if active.source != *source {
            return Err("Embedded 播放控制来源身份不匹配".to_string());
        }
        active.next_command_id += 1;
        let command_id = format!("embedded-command-{}", active.next_command_id);
        let (sender, receiver) = tokio::sync::oneshot::channel();
        active.pending_commands.insert(command_id.clone(), sender);
        (
            EmbeddedPlaybackCommand {
                command_id,
                source_id: source.source_id.clone(),
                session_id: source.session_id.clone(),
                video_id: source.video_id.clone(),
                action,
                seek_time,
            },
            receiver,
        )
    };

    if let Err(error) = app.emit(EMBEDDED_PLAYBACK_COMMAND_EVENT, &command) {
        if let Ok(mut runtime) = runtime.0.lock() {
            if let Some(active) = runtime.as_mut() {
                active.pending_commands.remove(&command.command_id);
            }
        }
        return Err(format!("发送 iframe 播放命令失败：{error}"));
    }

    match tokio::time::timeout(Duration::from_secs(2), receiver).await {
        Ok(Ok(result)) => result,
        Ok(Err(_)) => Err("iframe 播放响应通道已经关闭".to_string()),
        Err(_) => {
            if let Ok(mut runtime) = runtime.0.lock() {
                if let Some(active) = runtime.as_mut() {
                    active.pending_commands.remove(&command.command_id);
                }
            }
            Err("iframe 播放控制超时".to_string())
        }
    }
}

#[cfg(unix)]
#[tauri::command]
pub(crate) async fn start_embedded_playback(
    webview: Webview,
    app: AppHandle,
    store: State<'_, SharedStore>,
    runtime: State<'_, SharedEmbeddedRuntime>,
    url: String,
) -> Result<StartEmbeddedResult, String> {
    ensure_main(&webview)?;
    let (normalized_url, video_id) = normalize_youtube_watch_url(&url)?;
    let source = next_source(video_id);
    let enter = store
        .0
        .lock()
        .map_err(|_| "字幕来源状态暂时不可用".to_string())?
        .enter_embedded(source.clone())?;
    {
        let mut active = runtime
            .0
            .lock()
            .map_err(|_| "Embedded runtime 状态暂时不可用".to_string())?;
        if let Some(mut previous) = active.take() {
            reject_pending(&mut previous, "正在启动新的 Desktop 视频");
        }
        *active = Some(new_runtime(source.clone()));
    }
    emit_snapshot(&app, &store)?;

    if let Some(target) = enter.pause_target {
        let pause_app = app.clone();
        tauri::async_runtime::spawn(async move {
            let bridges = pause_app.state::<SharedBridges>();
            let commands = pause_app.state::<SharedPlaybackCommands>();
            let result = dispatch_browser_playback_command(
                &bridges,
                &commands,
                target,
                PlaybackAction::Pause,
                None,
            )
            .await;
            if let Ok(mut coordinator) = pause_app.state::<SharedStore>().0.lock() {
                let state = match result {
                    Ok(()) => BrowserPauseState::Succeeded,
                    Err(error) if error.contains("超时") => BrowserPauseState::TimedOut,
                    Err(error) => BrowserPauseState::Failed(error),
                };
                coordinator.record_browser_pause_result(state);
            }
        });
    }

    Ok(StartEmbeddedResult {
        source,
        normalized_url,
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
    ensure_main(&webview)?;
    let (source, message) = {
        let mut runtime = runtime
            .0
            .lock()
            .map_err(|_| "Embedded runtime 状态暂时不可用".to_string())?;
        let active = runtime
            .as_mut()
            .ok_or_else(|| "Embedded runtime 已经关闭".to_string())?;
        match parse_embedded_message(
            &payload,
            &active.source,
            &mut active.limiter,
            Instant::now(),
        ) {
            Ok(message) => (active.source.clone(), message),
            Err(error) => {
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
                    Err(error.unwrap_or("iframe 播放控制失败").to_string())
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
pub(crate) fn stop_embedded_playback(
    webview: Webview,
    app: AppHandle,
    runtime: State<'_, SharedEmbeddedRuntime>,
    store: State<'_, SharedStore>,
) -> Result<(), String> {
    ensure_main(&webview)?;
    let runtime_source = {
        let mut runtime = runtime
            .0
            .lock()
            .map_err(|_| "Embedded runtime 状态暂时不可用".to_string())?;
        runtime.take().map(|mut active| {
            reject_pending(&mut active, "Desktop 播放已经退出");
            active.source
        })
    };
    let source = runtime_source
        .or_else(|| store.0.lock().ok()?.current_source())
        .filter(|source| source.kind == SourceKind::Embedded)
        .ok_or_else(|| "Desktop 播放已经退出".to_string())?;
    let snapshot = store
        .0
        .lock()
        .map_err(|_| "字幕来源状态暂时不可用".to_string())?
        .exit_embedded(&source)?;
    let _ = app.emit(UPDATE_EVENT, UiUpdate::Snapshot(snapshot));
    Ok(())
}

#[tauri::command]
pub(crate) fn reload_embedded_playback(
    webview: Webview,
    app: AppHandle,
    runtime: State<'_, SharedEmbeddedRuntime>,
    store: State<'_, SharedStore>,
) -> Result<(), String> {
    ensure_main(&webview)?;
    let source = runtime
        .0
        .lock()
        .map_err(|_| "Embedded runtime 状态暂时不可用".to_string())?
        .as_ref()
        .map(|active| active.source.clone())
        .ok_or_else(|| "Desktop 播放已经退出".to_string())?;
    let snapshot = {
        let mut coordinator = store
            .0
            .lock()
            .map_err(|_| "字幕来源状态暂时不可用".to_string())?;
        coordinator.mark_embedded_recovering(&source)?;
        coordinator.snapshot()
    };
    let _ = app.emit(UPDATE_EVENT, UiUpdate::Snapshot(snapshot));
    app.emit(EMBEDDED_RELOAD_EVENT, source)
        .map_err(|error| format!("重新加载 iframe 失败：{error}"))
}

#[tauri::command]
pub(crate) fn report_embedded_player_failure(
    webview: Webview,
    app: AppHandle,
    runtime: State<'_, SharedEmbeddedRuntime>,
    store: State<'_, SharedStore>,
) -> Result<(), String> {
    ensure_main(&webview)?;
    let source = runtime
        .0
        .lock()
        .map_err(|_| "Embedded runtime 状态暂时不可用".to_string())?
        .as_ref()
        .map(|active| active.source.clone())
        .ok_or_else(|| "Desktop 播放已经退出".to_string())?;
    let snapshot = {
        let mut coordinator = store
            .0
            .lock()
            .map_err(|_| "字幕来源状态暂时不可用".to_string())?;
        coordinator.mark_embedded_recovering(&source)?;
        coordinator.snapshot()
    };
    let _ = app.emit(UPDATE_EVENT, UiUpdate::Snapshot(snapshot));
    Ok(())
}

#[tauri::command]
pub(crate) fn replace_embedded_playback(
    webview: Webview,
    app: AppHandle,
    runtime: State<'_, SharedEmbeddedRuntime>,
    store: State<'_, SharedStore>,
    url: String,
) -> Result<StartEmbeddedResult, String> {
    ensure_main(&webview)?;
    let (normalized_url, video_id) = normalize_youtube_watch_url(&url)?;
    let old_source = {
        let mut runtime = runtime
            .0
            .lock()
            .map_err(|_| "Embedded runtime 状态暂时不可用".to_string())?;
        let mut active = runtime
            .take()
            .ok_or_else(|| "Desktop 播放已经退出".to_string())?;
        reject_pending(&mut active, "正在更换 Desktop 视频");
        active.source
    };
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
    *runtime
        .0
        .lock()
        .map_err(|_| "Embedded runtime 状态暂时不可用".to_string())? =
        Some(new_runtime(source.clone()));
    let _ = app.emit(UPDATE_EVENT, UiUpdate::Snapshot(snapshot));
    Ok(StartEmbeddedResult {
        source,
        normalized_url,
    })
}

fn ensure_main(webview: &Webview) -> Result<(), String> {
    if webview.label() == MAIN_WEBVIEW_LABEL {
        Ok(())
    } else {
        Err("embedded-command:untrusted-webview".to_string())
    }
}

fn emit_snapshot(app: &AppHandle, store: &State<'_, SharedStore>) -> Result<(), String> {
    let snapshot = store
        .0
        .lock()
        .map_err(|_| "字幕来源状态暂时不可用".to_string())?
        .snapshot();
    let _ = app.emit(UPDATE_EVENT, UiUpdate::Snapshot(snapshot));
    Ok(())
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
            "https://youtube.com.evil.test/watch?v=abcdefghijk",
            "https://www.youtube.com/@channel",
            "https://youtu.be/too-short",
            "https://user@www.youtube.com/watch?v=abcdefghijk",
        ] {
            assert!(normalize_youtube_watch_url(invalid).is_err(), "{invalid}");
        }
    }

    #[test]
    fn embedded_protocol_version_stays_explicit() {
        assert_eq!(crate::embedded_source::EMBEDDED_PROTOCOL_VERSION, 1);
    }
}
