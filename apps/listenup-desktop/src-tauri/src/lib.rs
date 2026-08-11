// @purpose 桌面端 Rust 入口：GUI/桥接双模式、来源协调、双向播放/字幕 seek、字幕持久化、NSPanel 与 tray。
// @role    被 main.rs 调用；同时是 Chrome Native Messaging Host 的实现。
// @deps    browser_source、source_coordinator、cookie_vault、database、domain、tauri、tokio、serde、window-vibrancy、objc2、Unix socket
// @gotcha  stdout 只写 Native Messaging 长度帧；v5 cursor 必须保留 playbackEpoch；反向控制按 bridgeId+session 路由。
mod app_mode;
mod browser_source;
pub mod cli;
mod cookie_vault;
pub mod database;
pub mod domain;
mod embedded_player;
mod embedded_player_host;
mod embedded_source;
mod positioning;
mod source_coordinator;
mod youtube_subtitles;

#[cfg(test)]
use browser_source::BrowserSourceStore;
use browser_source::PlaybackTarget;
use database::{
    DatabaseState, SourceSnapshot, SourceSnapshotSegment, SubtitleDatabase, SubtitleView,
};
use serde::{Deserialize, Serialize};
use source_coordinator::{
    BrowserPauseState, PlaybackRoute, SourceCoordinator, SourceMode, SourceRef,
};
use std::{
    collections::HashMap,
    env,
    io::{self, Read},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, State};

const PROTOCOL_VERSION: u8 = 5;
const MAX_MESSAGE_BYTES: usize = 16 * 1024 * 1024;
const UPDATE_EVENT: &str = "native-subtitle-update";
const CONNECTION_EVENT: &str = "native-subtitle-connection";
const CHECK_UPDATE_EVENT: &str = "desktop-check-for-update";
const EXTENSION_ID: &str = env!("LISTENUP_EXTENSION_ID");
const NATIVE_HOST_NAME: &str = env!("LISTENUP_NATIVE_HOST_NAME");
const PRODUCT_NAME: &str = env!("LISTENUP_PRODUCT_NAME");

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleItem {
    id: serde_json::Value,
    start_time: f64,
    end_time: f64,
    text: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleTrack {
    language_code: String,
    display_name: String,
    kind: String,
    vss_id: String,
    is_default: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CursorState {
    session_id: String,
    video_id: String,
    playback_epoch: u64,
    current_time: f64,
    current_index: i64,
    is_paused: bool,
    is_ad_playing: bool,
    sent_at: u64,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SessionState {
    tab_id: i64,
    session_id: String,
    video_id: String,
    title: String,
    identity_status: String,
    status: String,
    error: Option<String>,
    track: Option<SubtitleTrack>,
    subtitles: Vec<SubtitleItem>,
    cursor: Option<CursorState>,
    #[serde(skip)]
    bridge_id: u64,
    #[serde(skip)]
    updated_order: u64,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
enum PlaybackAction {
    Play,
    Pause,
    Seek,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct PlaybackCommand {
    kind: String,
    version: u8,
    command_id: String,
    tab_id: i64,
    session_id: String,
    video_id: String,
    action: PlaybackAction,
    #[serde(skip_serializing_if = "Option::is_none")]
    seek_time: Option<f64>,
}

fn validate_playback_request(action: PlaybackAction, seek_time: Option<f64>) -> Result<(), String> {
    match (action, seek_time) {
        (PlaybackAction::Seek, Some(time)) if time.is_finite() && time >= 0.0 => Ok(()),
        (PlaybackAction::Seek, _) => Err("字幕跳转时间无效".to_string()),
        (PlaybackAction::Play | PlaybackAction::Pause, None) => Ok(()),
        (PlaybackAction::Play | PlaybackAction::Pause, Some(_)) => {
            Err("播放或暂停命令不能携带跳转时间".to_string())
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
enum NativeMessage {
    Session {
        version: u8,
        tab_id: i64,
        session_id: String,
        video_id: String,
        title: String,
        identity_status: String,
        status: String,
        error: Option<String>,
        track: Option<SubtitleTrack>,
        subtitles: Vec<SubtitleItem>,
    },
    Cursor {
        version: u8,
        tab_id: i64,
        session_id: String,
        video_id: String,
        playback_epoch: u64,
        current_time: f64,
        current_index: i64,
        is_paused: bool,
        is_ad_playing: bool,
        sent_at: u64,
    },
    End {
        version: u8,
        tab_id: i64,
        session_id: String,
        video_id: String,
    },
    PlaybackCommandResult {
        version: u8,
        tab_id: i64,
        command_id: String,
        session_id: String,
        video_id: String,
        ok: bool,
        error: Option<String>,
    },
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct PlayingCandidate {
    session_id: String,
    tab_id: i64,
    video_id: String,
    title: String,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct ViewerSnapshot {
    connected: bool,
    source_mode: SourceMode,
    source: Option<SourceRef>,
    browser_pause_state: BrowserPauseState,
    awaiting_browser_playback: bool,
    active_session: Option<SessionState>,
    playing_candidates: Vec<PlayingCandidate>,
    playing_session_count: usize,
    selected_session_id: Option<String>,
    selection_required: bool,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(tag = "kind", content = "payload", rename_all = "camelCase")]
enum UiUpdate {
    Snapshot(ViewerSnapshot),
    Cursor(CursorState),
}

#[derive(Default)]
struct SharedStore(Mutex<SourceCoordinator>);

#[cfg(unix)]
#[derive(Default)]
struct BridgeRegistry {
    next_id: u64,
    connections: HashMap<u64, std::os::unix::net::UnixStream>,
}

#[cfg(unix)]
impl BridgeRegistry {
    fn register(&mut self, stream: std::os::unix::net::UnixStream) -> u64 {
        self.next_id += 1;
        let bridge_id = self.next_id;
        self.connections.insert(bridge_id, stream);
        bridge_id
    }

    fn unregister(&mut self, bridge_id: u64) {
        self.connections.remove(&bridge_id);
    }

    fn send(&mut self, bridge_id: u64, command: &PlaybackCommand) -> Result<(), String> {
        let stream = self
            .connections
            .get_mut(&bridge_id)
            .ok_or_else(|| "浏览器桥接已经断开".to_string())?;
        send_bridge_json_line(stream, command).map_err(|error| {
            self.connections.remove(&bridge_id);
            format!("发送播放命令失败：{error}")
        })
    }
}

#[cfg(unix)]
#[derive(Default)]
struct SharedBridges(Mutex<BridgeRegistry>);

struct PendingPlaybackCommand {
    bridge_id: u64,
    session_id: String,
    video_id: String,
    sender: tokio::sync::oneshot::Sender<Result<(), String>>,
}

#[derive(Default)]
struct PlaybackCommandState {
    next_id: u64,
    pending: HashMap<String, PendingPlaybackCommand>,
}

impl PlaybackCommandState {
    fn register(
        &mut self,
        bridge_id: u64,
        session_id: &str,
        video_id: &str,
    ) -> (String, tokio::sync::oneshot::Receiver<Result<(), String>>) {
        self.next_id += 1;
        let command_id = format!("{}-{}", std::process::id(), self.next_id);
        let (sender, receiver) = tokio::sync::oneshot::channel();
        self.pending.insert(
            command_id.clone(),
            PendingPlaybackCommand {
                bridge_id,
                session_id: session_id.to_string(),
                video_id: video_id.to_string(),
                sender,
            },
        );
        (command_id, receiver)
    }

    fn resolve(
        &mut self,
        bridge_id: u64,
        command_id: &str,
        session_id: &str,
        video_id: &str,
        result: Result<(), String>,
    ) {
        let Some(pending) = self.pending.remove(command_id) else {
            return;
        };
        let result = if pending.bridge_id != bridge_id
            || pending.session_id != session_id
            || pending.video_id != video_id
        {
            Err("播放命令响应身份不匹配".to_string())
        } else {
            result
        };
        let _ = pending.sender.send(result);
    }

    fn cancel(&mut self, command_id: &str) {
        self.pending.remove(command_id);
    }

    fn fail_bridge(&mut self, bridge_id: u64) {
        let command_ids = self
            .pending
            .iter()
            .filter_map(|(command_id, pending)| {
                (pending.bridge_id == bridge_id).then_some(command_id.clone())
            })
            .collect::<Vec<_>>();
        for command_id in command_ids {
            if let Some(pending) = self.pending.remove(&command_id) {
                let _ = pending.sender.send(Err("浏览器桥接已经断开".to_string()));
            }
        }
    }
}

#[derive(Default)]
struct SharedPlaybackCommands(Mutex<PlaybackCommandState>);

#[derive(Debug)]
enum FrameError {
    Io(io::Error),
    InvalidLength(usize),
    Json(serde_json::Error),
}

impl std::fmt::Display for FrameError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(error) => write!(formatter, "I/O error: {error}"),
            Self::InvalidLength(length) => write!(formatter, "invalid message length: {length}"),
            Self::Json(error) => write!(formatter, "invalid JSON message: {error}"),
        }
    }
}

fn read_frame(reader: &mut impl Read) -> Result<Option<NativeMessage>, FrameError> {
    let mut length_bytes = [0_u8; 4];
    match reader.read_exact(&mut length_bytes) {
        Ok(()) => {}
        Err(error) if error.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(error) => return Err(FrameError::Io(error)),
    }

    let length = u32::from_ne_bytes(length_bytes) as usize;
    if length == 0 || length > MAX_MESSAGE_BYTES {
        return Err(FrameError::InvalidLength(length));
    }

    let mut payload = vec![0_u8; length];
    reader.read_exact(&mut payload).map_err(FrameError::Io)?;
    serde_json::from_slice(&payload)
        .map(Some)
        .map_err(FrameError::Json)
}

fn launched_by_chrome() -> bool {
    env::args()
        .skip(1)
        .any(|argument| argument.starts_with("chrome-extension://"))
}

/// dev 和 production 是两个独立 app，bundle id / socket 路径都要分开
fn app_bundle_id() -> &'static str {
    env!("LISTENUP_BUNDLE_ID")
}

#[cfg(target_os = "macos")]
fn shell_quote(value: &std::path::Path) -> String {
    format!("'{}'", value.to_string_lossy().replace('\'', "'\"'\"'"))
}

#[cfg(target_os = "macos")]
fn native_host_manifest(wrapper_path: &std::path::Path) -> serde_json::Value {
    serde_json::json!({
        "name": NATIVE_HOST_NAME,
        "description": format!("{PRODUCT_NAME} real-time subtitle viewer"),
        "path": wrapper_path,
        "type": "stdio",
        "allowed_origins": [format!("chrome-extension://{EXTENSION_ID}/")],
    })
}

#[cfg(target_os = "macos")]
fn write_registered_file(
    path: &std::path::Path,
    contents: &[u8],
    executable: bool,
) -> io::Result<()> {
    use std::os::unix::fs::PermissionsExt;

    let temporary_path = path.with_extension(format!(
        "{}.tmp",
        path.extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or("file")
    ));
    std::fs::write(&temporary_path, contents)?;
    if executable {
        std::fs::set_permissions(&temporary_path, std::fs::Permissions::from_mode(0o755))?;
    }
    std::fs::rename(temporary_path, path)
}

/// Chrome 的 manifest 位于用户级目录，且 path 必须是绝对路径。
/// 因此不能把一份静态 JSON 直接塞进 app bundle；GUI 每次启动时按当前
/// app 位置重写自己的 manifest / wrapper，移动 app 后也能自动修复路径。
#[cfg(target_os = "macos")]
fn register_native_messaging_host_at(
    home: &std::path::Path,
    executable_path: &std::path::Path,
) -> io::Result<std::path::PathBuf> {
    let host_directory =
        home.join("Library/Application Support/Google/Chrome/NativeMessagingHosts");
    let log_directory = home.join("Library/Logs");
    std::fs::create_dir_all(&host_directory)?;
    std::fs::create_dir_all(&log_directory)?;

    let wrapper_path = host_directory.join(format!("{NATIVE_HOST_NAME}.sh"));
    let manifest_path = host_directory.join(format!("{NATIVE_HOST_NAME}.json"));
    let log_path = log_directory.join(format!("{PRODUCT_NAME}.log"));

    let wrapper = format!(
        "#!/bin/sh\nprintf '%s %s\\n' \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" \"$1\" >> {}\nexec {} \"$@\" 2>> {}\n",
        shell_quote(&log_path),
        shell_quote(executable_path),
        shell_quote(&log_path),
    );
    write_registered_file(&wrapper_path, wrapper.as_bytes(), true)?;

    let manifest = native_host_manifest(&wrapper_path);
    let manifest_json = serde_json::to_vec_pretty(&manifest)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    let mut manifest_contents = manifest_json;
    manifest_contents.push(b'\n');
    write_registered_file(&manifest_path, &manifest_contents, false)?;

    Ok(manifest_path)
}

#[cfg(target_os = "macos")]
fn register_native_messaging_host() -> io::Result<std::path::PathBuf> {
    let home = env::var_os("HOME")
        .map(std::path::PathBuf::from)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "HOME is not set"))?;
    let executable_path = env::current_exe()?;
    register_native_messaging_host_at(&home, &executable_path)
}

/// GUI 实例监听的本地 socket。Chrome 拉起的桥接进程把字幕帧转发到这里。
#[cfg(unix)]
fn bridge_socket_path() -> std::path::PathBuf {
    let base = env::var_os("HOME")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"));
    base.join(format!(
        "Library/Application Support/{}/bridge.sock",
        app_bundle_id()
    ))
}

#[cfg(unix)]
fn send_bridge_json_line(
    stream: &mut std::os::unix::net::UnixStream,
    message: &impl Serialize,
) -> io::Result<()> {
    use std::io::Write;

    let mut line = serde_json::to_string(message)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    line.push('\n');
    stream.write_all(line.as_bytes())
}

#[cfg(unix)]
fn send_bridge_line(
    stream: &mut std::os::unix::net::UnixStream,
    message: &NativeMessage,
) -> io::Result<()> {
    send_bridge_json_line(stream, message)
}

#[cfg(unix)]
fn write_native_frame(message: &impl Serialize) -> io::Result<()> {
    use std::io::Write;

    let payload = serde_json::to_vec(message)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    if payload.is_empty() || payload.len() > MAX_MESSAGE_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Native Messaging outbound frame has invalid length",
        ));
    }
    let stdout = io::stdout();
    let mut writer = stdout.lock();
    writer.write_all(&(payload.len() as u32).to_ne_bytes())?;
    writer.write_all(&payload)?;
    writer.flush()
}

#[cfg(unix)]
fn forward_gui_commands(stream: std::os::unix::net::UnixStream) {
    use std::io::{BufRead, BufReader};

    for line in BufReader::new(stream).lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }
        let command = match serde_json::from_str::<PlaybackCommand>(&line) {
            Ok(command)
                if command.kind == "playbackCommand"
                    && command.version == PROTOCOL_VERSION
                    && validate_playback_request(command.action, command.seek_time).is_ok() =>
            {
                command
            }
            Ok(_) => {
                eprintln!("ignored invalid GUI playback command");
                continue;
            }
            Err(error) => {
                eprintln!("ignored malformed GUI playback command: {error}");
                continue;
            }
        };
        if let Err(error) = write_native_frame(&command) {
            eprintln!("failed to send playback command to Chrome: {error}");
            break;
        }
    }
}

#[cfg(unix)]
fn connect_bridge(
    cached_sessions: &HashMap<String, NativeMessage>,
) -> Option<std::os::unix::net::UnixStream> {
    let mut stream = std::os::unix::net::UnixStream::connect(bridge_socket_path()).ok()?;
    stream
        .set_write_timeout(Some(std::time::Duration::from_millis(500)))
        .ok();

    // GUI 可能是播放中途才打开的，先补发缓存的 session 快照
    for message in cached_sessions.values() {
        if send_bridge_line(&mut stream, message).is_err() {
            return None;
        }
    }
    let command_stream = stream.try_clone().ok()?;
    std::thread::spawn(move || forward_gui_commands(command_stream));
    Some(stream)
}

/// Chrome Native Messaging 拉起的桥接模式：没有窗口，只把 stdin 的字幕帧
/// 转发给正在运行的 GUI 实例；GUI 没开就缓存 session、静默丢弃 cursor，
/// 等 GUI 打开后自动补发并续传。
#[cfg(unix)]
fn run_bridge() {
    let stdin = io::stdin();
    let mut reader = stdin.lock();
    let mut cached_sessions: HashMap<String, NativeMessage> = HashMap::new();
    let mut connection: Option<std::os::unix::net::UnixStream> = None;

    loop {
        match read_frame(&mut reader) {
            Ok(Some(message)) => {
                match &message {
                    NativeMessage::Session { session_id, .. } => {
                        cached_sessions.insert(session_id.clone(), message.clone());
                    }
                    NativeMessage::End { session_id, .. } => {
                        cached_sessions.remove(session_id);
                    }
                    NativeMessage::Cursor { .. } => {}
                    NativeMessage::PlaybackCommandResult { .. } => {}
                }

                if connection.is_none() {
                    connection = connect_bridge(&cached_sessions);
                }
                if let Some(stream) = connection.as_mut() {
                    if send_bridge_line(stream, &message).is_err() {
                        connection = None;
                    }
                }
            }
            Ok(None) => break,
            Err(FrameError::Json(error)) => {
                eprintln!("ignored invalid Native Messaging JSON: {error}");
            }
            Err(error) => {
                eprintln!("Native Messaging bridge stopped: {error}");
                break;
            }
        }
    }
}

#[cfg(unix)]
fn set_bridge_connected(app: &AppHandle, delta: i32) {
    let connected = {
        let shared = app.state::<SharedStore>();
        let Ok(mut store) = shared.0.lock() else {
            return;
        };
        store.set_browser_connected(delta)
    };
    let _ = app.emit(CONNECTION_EVENT, connected);
}

#[cfg(unix)]
fn handle_bridge_connection(app: AppHandle, stream: std::os::unix::net::UnixStream) {
    use std::io::{BufRead, BufReader};

    let writer = match stream.try_clone() {
        Ok(writer) => writer,
        Err(error) => {
            eprintln!("failed to clone bridge socket: {error}");
            return;
        }
    };
    let bridge_id = {
        let bridges = app.state::<SharedBridges>();
        let Ok(mut bridges) = bridges.0.lock() else {
            return;
        };
        bridges.register(writer)
    };
    set_bridge_connected(&app, 1);
    let reader = BufReader::new(stream);
    for line in reader.lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }
        let message = match serde_json::from_str::<NativeMessage>(&line) {
            Ok(message) => message,
            Err(error) => {
                eprintln!("ignored invalid bridge message: {error}");
                continue;
            }
        };
        if let NativeMessage::PlaybackCommandResult {
            version,
            tab_id: _,
            command_id,
            session_id,
            video_id,
            ok,
            error,
        } = &message
        {
            if *version == PROTOCOL_VERSION {
                let result = if *ok {
                    Ok(())
                } else {
                    Err(error.clone().unwrap_or_else(|| "播放控制失败".to_string()))
                };
                if let Ok(mut commands) = app.state::<SharedPlaybackCommands>().0.lock() {
                    commands.resolve(bridge_id, command_id, session_id, video_id, result);
                }
            }
            continue;
        }
        let source_snapshot = source_snapshot_from_message(&message);
        let outcome = {
            let shared = app.state::<SharedStore>();
            shared
                .0
                .lock()
                .ok()
                .map(|mut store| store.apply_browser_message(message, bridge_id))
        };
        if outcome
            .as_ref()
            .is_some_and(|outcome| outcome.persist_source)
        {
            if let Some(snapshot) = source_snapshot {
                let database = app.state::<DatabaseState>().0.clone();
                if let Some(database) = database {
                    if let Err(error) =
                        tauri::async_runtime::block_on(database.store_source(snapshot))
                    {
                        eprintln!("failed to cache subtitle source: {error}");
                    }
                }
            }
        }
        let update = outcome.and_then(|outcome| outcome.update);
        if let Some(update) = update {
            if let Err(error) = app.emit(UPDATE_EVENT, update) {
                eprintln!("failed to emit subtitle update: {error}");
            }
        }
    }
    if let Ok(mut bridges) = app.state::<SharedBridges>().0.lock() {
        bridges.unregister(bridge_id);
    }
    if let Ok(mut commands) = app.state::<SharedPlaybackCommands>().0.lock() {
        commands.fail_bridge(bridge_id);
    }
    set_bridge_connected(&app, -1);
}

fn source_snapshot_from_message(message: &NativeMessage) -> Option<SourceSnapshot> {
    let NativeMessage::Session {
        version,
        video_id,
        title,
        identity_status,
        status,
        track: Some(track),
        subtitles,
        ..
    } = message
    else {
        return None;
    };
    if *version != PROTOCOL_VERSION
        || identity_status != "verified"
        || status != "ready"
        || subtitles.is_empty()
    {
        return None;
    }
    Some(SourceSnapshot {
        video_id: video_id.clone(),
        title: title.clone(),
        language_code: track.language_code.clone(),
        display_name: track.display_name.clone(),
        kind: track.kind.clone(),
        vss_id: track.vss_id.clone(),
        is_default: track.is_default,
        segments: subtitles
            .iter()
            .map(|subtitle| SourceSnapshotSegment {
                source_id: serde_json::to_string(&subtitle.id)
                    .unwrap_or_else(|_| "null".to_string()),
                start_time_ms: (subtitle.start_time * 1_000.0).round() as i64,
                end_time_ms: (subtitle.end_time * 1_000.0).round() as i64,
                text: subtitle.text.clone(),
            })
            .collect(),
    })
}

#[cfg(unix)]
fn run_socket_server(app: AppHandle) {
    let path = bridge_socket_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::remove_file(&path);

    let listener = match std::os::unix::net::UnixListener::bind(&path) {
        Ok(listener) => listener,
        Err(error) => {
            eprintln!("failed to bind bridge socket: {error}");
            return;
        }
    };

    for incoming in listener.incoming() {
        let Ok(stream) = incoming else { continue };
        let handle = app.clone();
        std::thread::spawn(move || handle_bridge_connection(handle, stream));
    }
}

/// 恢复 NSPanel / WebView 的鼠标移动分发与 hover tracking。必须主线程调用。
#[cfg(target_os = "macos")]
fn refresh_mouse_tracking(window: &tauri::WebviewWindow) {
    if let Ok(ns_window) = window.ns_window() {
        use objc2::msg_send;
        use objc2::runtime::AnyObject;

        unsafe fn update_view_tree(view: *mut AnyObject) {
            if view.is_null() {
                return;
            }

            unsafe {
                let _: () = msg_send![view, updateTrackingAreas];
                let subviews: *mut AnyObject = msg_send![view, subviews];
                if subviews.is_null() {
                    return;
                }
                let count: usize = msg_send![subviews, count];
                for index in 0..count {
                    let child: *mut AnyObject = msg_send![subviews, objectAtIndex: index];
                    update_view_tree(child);
                }
            }
        }

        let ns_window = ns_window as *mut AnyObject;
        unsafe {
            // NSWindow defaults this to false. Resizing, changing shadow/vibrancy,
            // class-swapping to NSPanel, or moving between fullscreen Spaces can
            // invalidate WebKit's hover tracking until the next process launch.
            let _: () = msg_send![ns_window, setAcceptsMouseMovedEvents: true];
            let content_view: *mut AnyObject = msg_send![ns_window, contentView];
            update_view_tree(content_view);
        }
    }
}

/// 让窗口盖在其他 app（如全屏的 Chrome）的全屏 Space 之上。必须主线程调用。
///
/// - `setLevel: 25`（NSStatusWindowLevel）：高于全屏视频画面
/// - `collectionBehavior = canJoinAllSpaces(1<<0) | fullScreenAuxiliary(1<<8)`：
///   整体**替换**默认行为——默认里带 fullScreenPrimary，它与 auxiliary 冲突，
///   会导致窗口进不了别人的全屏 Space。不要用 set_visible_on_all_workspaces，
///   它只 OR 进 canJoinAllSpaces、保留 Primary、丢失 auxiliary。
#[cfg(target_os = "macos")]
fn apply_overlay_window_style(window: &tauri::WebviewWindow) {
    if let Ok(ns_window) = window.ns_window() {
        use objc2::msg_send;
        use objc2::runtime::AnyObject;
        let ns_window = ns_window as *mut AnyObject;
        unsafe {
            let _: () = msg_send![ns_window, setLevel: 25_isize];
            let behavior: usize = (1 << 0) | (1 << 8);
            let _: () = msg_send![ns_window, setCollectionBehavior: behavior];
            let level: isize = msg_send![ns_window, level];
            let applied: usize = msg_send![ns_window, collectionBehavior];
            eprintln!("[listenup] overlay style: level={level} collectionBehavior={applied:#b}");
        }
    }
    refresh_mouse_tracking(window);
}

/// 列表模式开启 vibrancy 磨砂；影院模式关闭，让视频画面清晰透过。必须主线程调用。
///
/// window-vibrancy 的 apply 每次都会新叠一层磨砂 view 且不查重，clear 一次只移一层，
/// 所以这里先循环清干净再按需加，保证幂等（否则 setup + 前端 mount 各加一层，
/// 切影院模式只清掉一层，磨砂永远残留）。
#[cfg(target_os = "macos")]
fn set_vibrancy_on_main_thread(window: &tauri::WebviewWindow, enabled: bool) {
    use window_vibrancy::{
        apply_vibrancy, clear_vibrancy, NSVisualEffectMaterial, NSVisualEffectState,
    };

    let mut removed = 0;
    while let Ok(true) = clear_vibrancy(window) {
        removed += 1;
    }
    if removed > 1 {
        eprintln!("[listenup] removed {removed} stacked vibrancy views");
    }

    if enabled {
        if let Err(error) = apply_vibrancy(
            window,
            NSVisualEffectMaterial::HudWindow,
            Some(NSVisualEffectState::Active),
            Some(16.0),
        ) {
            eprintln!("failed to apply window vibrancy: {error}");
        }
    }

    // 每次模式切换顺带重申 overlay 属性，防止被系统或 tao 内部操作重置
    apply_overlay_window_style(window);
}

/// Tauri command 默认跑在 worker 线程，而 AppKit 的 view/window 操作必须在主线程，
/// 所以派发回主线程执行（否则 clear 的 removeFromSuperview 会静默失效）。
#[tauri::command]
fn set_vibrancy(window: tauri::WebviewWindow, enabled: bool) {
    #[cfg(target_os = "macos")]
    {
        let target = window.clone();
        let _ = window.run_on_main_thread(move || {
            set_vibrancy_on_main_thread(&target, enabled);
        });
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (window, enabled);
}

fn show_main_window(
    app: &AppHandle,
    tray_rect: Option<tauri::Rect>,
    click_position: Option<tauri::PhysicalPosition<f64>>,
) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if app.state::<app_mode::AppModeState>().current() == app_mode::AppMode::Menubar {
        let positioned = tray_rect
            .is_some_and(|rect| positioning::position_panel(&window, rect, click_position));
        if !positioned {
            let _ = window.center();
        }
    }
    let _ = window.unminimize();
    let _ = window.show();
    #[cfg(target_os = "macos")]
    {
        let target = window.clone();
        let _ = window.run_on_main_thread(move || refresh_mouse_tracking(&target));
    }
    let _ = window.set_focus();
}

#[tauri::command]
fn get_snapshot(store: State<'_, SharedStore>) -> ViewerSnapshot {
    store
        .0
        .lock()
        .map(|store| store.snapshot())
        .unwrap_or(ViewerSnapshot {
            connected: false,
            source_mode: SourceMode::Empty,
            source: None,
            browser_pause_state: BrowserPauseState::NotNeeded,
            awaiting_browser_playback: false,
            active_session: None,
            playing_candidates: Vec::new(),
            playing_session_count: 0,
            selected_session_id: None,
            selection_required: false,
        })
}

#[tauri::command]
async fn get_subtitle_view(
    database: State<'_, DatabaseState>,
    video_id: Option<String>,
    target_language: Option<String>,
) -> Result<Option<SubtitleView>, String> {
    let database = database
        .0
        .as_ref()
        .ok_or_else(|| "字幕数据库暂时不可用".to_string())?;
    database
        .subtitle_view(video_id.as_deref(), target_language.as_deref())
        .await
}

#[tauri::command]
fn select_subtitle_session(
    app: AppHandle,
    store: State<'_, SharedStore>,
    session_id: String,
) -> Result<ViewerSnapshot, String> {
    let snapshot = store
        .0
        .lock()
        .map_err(|_| "字幕会话状态暂时不可用".to_string())?
        .select_browser_session(&session_id)?;
    let _ = app.emit(UPDATE_EVENT, UiUpdate::Snapshot(snapshot.clone()));
    Ok(snapshot)
}

#[cfg(unix)]
#[tauri::command]
async fn control_playback(
    app: AppHandle,
    store: State<'_, SharedStore>,
    embedded_runtime: State<'_, embedded_player::SharedEmbeddedRuntime>,
    bridges: State<'_, SharedBridges>,
    commands: State<'_, SharedPlaybackCommands>,
    action: PlaybackAction,
    seek_time: Option<f64>,
) -> Result<(), String> {
    validate_playback_request(action, seek_time)?;
    let route = store
        .0
        .lock()
        .map_err(|_| "字幕会话状态暂时不可用".to_string())?
        .playback_route()?;
    match route {
        PlaybackRoute::Browser(target) => {
            dispatch_browser_playback_command(&bridges, &commands, target, action, seek_time).await
        }
        PlaybackRoute::Embedded(source) => {
            embedded_player::dispatch_embedded_playback_command(
                &app,
                &embedded_runtime,
                &source,
                action,
                seek_time,
            )
            .await
        }
    }
}

#[cfg(unix)]
pub(crate) async fn dispatch_browser_playback_command(
    bridges: &SharedBridges,
    commands: &SharedPlaybackCommands,
    target: PlaybackTarget,
    action: PlaybackAction,
    seek_time: Option<f64>,
) -> Result<(), String> {
    let (command_id, receiver) = commands
        .0
        .lock()
        .map_err(|_| "播放命令状态暂时不可用".to_string())?
        .register(target.bridge_id, &target.session_id, &target.video_id);
    let command = PlaybackCommand {
        kind: "playbackCommand".to_string(),
        version: PROTOCOL_VERSION,
        command_id: command_id.clone(),
        tab_id: target.tab_id,
        session_id: target.session_id,
        video_id: target.video_id,
        action,
        seek_time,
    };

    let send_result = bridges
        .0
        .lock()
        .map_err(|_| "浏览器桥接状态暂时不可用".to_string())?
        .send(target.bridge_id, &command);
    if let Err(error) = send_result {
        if let Ok(mut commands) = commands.0.lock() {
            commands.cancel(&command_id);
        }
        return Err(error);
    }

    match tokio::time::timeout(Duration::from_secs(2), receiver).await {
        Ok(Ok(result)) => result,
        Ok(Err(_)) => Err("播放命令响应通道已经关闭".to_string()),
        Err(_) => {
            if let Ok(mut commands) = commands.0.lock() {
                commands.cancel(&command_id);
            }
            Err("播放控制超时，请确认 YouTube 标签页仍然打开".to_string())
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Chrome 通过 Native Messaging 拉起时进入无窗口桥接模式，
    // 不再弹出 GUI；GUI 由用户通过 listenup:// 深链接或直接打开
    #[cfg(unix)]
    if launched_by_chrome() {
        run_bridge();
        return;
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(SharedStore::default())
        .manage(cookie_vault::SharedCookieVault::default())
        .manage(embedded_player::SharedEmbeddedRuntime::default())
        .manage(SharedBridges::default())
        .manage(SharedPlaybackCommands::default())
        .invoke_handler(tauri::generate_handler![
            app_mode::get_app_mode,
            app_mode::set_app_mode,
            control_playback,
            cookie_vault::clear_youtube_cookies,
            cookie_vault::get_youtube_cookie_status,
            cookie_vault::save_youtube_cookies,
            embedded_player::embedded_source_event,
            embedded_player::reload_embedded_playback,
            embedded_player::report_embedded_player_failure,
            embedded_player::replace_embedded_playback,
            embedded_player::start_embedded_playback,
            embedded_player::stop_embedded_playback,
            embedded_player_host::get_embedded_player_host_url,
            youtube_subtitles::fetch_youtube_caption_document,
            youtube_subtitles::fetch_youtube_player_response,
            get_snapshot,
            get_subtitle_view,
            select_subtitle_session,
            set_vibrancy
        ])
        .setup(|app| {
            app.manage(embedded_player_host::start().map_err(std::io::Error::other)?);
            let app_data_dir = app.path().app_data_dir()?;
            let app_mode_path = app_mode::preference_path(&app_data_dir);
            let initial_app_mode = app_mode::load(&app_mode_path);
            app_mode::configure_initial(app, initial_app_mode)
                .map_err(std::io::Error::other)?;
            app.manage(app_mode::AppModeState::new(
                app_mode_path,
                initial_app_mode,
            ));

            let database_path = app_data_dir.join("listenup.sqlite");
            let database =
                match tauri::async_runtime::block_on(SubtitleDatabase::connect(&database_path)) {
                    Ok(database) => {
                        eprintln!(
                            "[listenup] subtitle database: {}",
                            database.path().display()
                        );
                        Some(database)
                    }
                Err(error) => {
                    eprintln!("[listenup] failed to open subtitle database: {error}");
                    // 磁盘不可写时仍保留当前进程内的字幕查询能力；CLI 持久化会明确失败。
                    match tauri::async_runtime::block_on(SubtitleDatabase::connect_ephemeral()) {
                        Ok(database) => {
                            eprintln!("[listenup] using ephemeral subtitle database");
                            Some(database)
                        }
                        Err(fallback_error) => {
                            eprintln!(
                                "[listenup] failed to initialize ephemeral subtitle database: {fallback_error}"
                            );
                            None
                        }
                    }
                }
                };
            app.manage(DatabaseState(database));

            #[cfg(target_os = "macos")]
            match register_native_messaging_host() {
                Ok(path) => {
                    eprintln!(
                        "[listenup] registered {NATIVE_HOST_NAME} for {EXTENSION_ID}: {}",
                        path.display()
                    );
                }
                Err(error) => {
                    // Host 注册失败不能阻止字幕窗口本身启动。
                    eprintln!("[listenup] failed to register {NATIVE_HOST_NAME}: {error}");
                }
            }

            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                // 把 NSWindow 运行时换成 NSPanel（tauri-nspanel 同款 class-swap）。
                // 实测（同屏严格测试）：Accessory + canJoinAllSpaces + fullScreenAuxiliary
                // + level 25 的普通 NSWindow 仍进不了别人的全屏 Space；
                // 只有 NSPanel + nonactivatingPanel 能被系统排进去。
                // 副作用：点击字幕条不再抢走视频 app 的焦点，正合适。
                if let Ok(ns_window) = window.ns_window() {
                    use objc2::msg_send;
                    use objc2::runtime::{AnyClass, AnyObject};
                    let ns_window = ns_window as *mut AnyObject;
                    unsafe {
                        if let Some(panel_class) = AnyClass::get(c"NSPanel") {
                            objc2::ffi::object_setClass(
                                ns_window.cast(),
                                (panel_class as *const AnyClass).cast(),
                            );
                            // nonactivatingPanel(1<<7)：进全屏 Space 的必要条件
                            let style: usize = msg_send![ns_window, styleMask];
                            let _: () = msg_send![ns_window, setStyleMask: style | (1 << 7)];
                            let _: () = msg_send![ns_window, setBecomesKeyOnlyIfNeeded: true];
                            // NSPanel 默认在 app 失活时隐藏，字幕条必须常驻，显式关掉
                            let _: () = msg_send![ns_window, setHidesOnDeactivate: false];
                            let _: () = msg_send![ns_window, setReleasedWhenClosed: false];
                            eprintln!("[listenup] window converted to NSPanel");
                        }
                    }
                }

                // setup 跑在主线程，直接调；默认按列表模式加磨砂，
                // 前端 mount 后会按持久化的模式再调 set_vibrancy 纠正
                set_vibrancy_on_main_thread(&window, true);

                // 关闭按钮改为"收进菜单栏"：拦截关闭请求，隐藏窗口。
                // 真正退出走菜单栏图标的"退出"。
                let hide_target = window.clone();
                let focus_app = app.handle().clone();
                let panel_had_focus = Arc::new(AtomicBool::new(false));
                let focus_state = Arc::clone(&panel_had_focus);
                window.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::CloseRequested { api, .. } => {
                            api.prevent_close();
                            let _ = hide_target.hide();
                        }
                        tauri::WindowEvent::Focused(true) => {
                            focus_state.store(true, Ordering::SeqCst);
                        }
                        tauri::WindowEvent::Focused(false) => {
                            if focus_app.state::<app_mode::AppModeState>().current()
                                == app_mode::AppMode::Menubar
                                && focus_state.swap(false, Ordering::SeqCst)
                            {
                                let _ = hide_target.hide();
                            }
                        }
                        _ => {}
                    }
                });

                // 周期性重申 overlay 属性并把窗口重新排到最前。
                // 别人进原生全屏会创建新 Space，canJoinAllSpaces 窗口有时
                // 不会被自动排进去，需要 orderFrontRegardless 重新入列。
                // 注意窗口被隐藏（收进菜单栏）时跳过，否则会把它重新拉出来。
                let keeper = window.clone();
                std::thread::spawn(move || loop {
                    std::thread::sleep(std::time::Duration::from_millis(2000));
                    let target = keeper.clone();
                    if keeper
                        .run_on_main_thread(move || {
                            if let Ok(ns_window) = target.ns_window() {
                                use objc2::msg_send;
                                use objc2::runtime::AnyObject;
                                let ns_window = ns_window as *mut AnyObject;
                                unsafe {
                                    let visible: bool = msg_send![ns_window, isVisible];
                                    if !visible {
                                        return;
                                    }
                                    let _: () = msg_send![ns_window, setLevel: 25_isize];
                                    let behavior: usize = (1 << 0) | (1 << 8);
                                    let _: () =
                                        msg_send![ns_window, setCollectionBehavior: behavior];
                                    let _: () =
                                        msg_send![ns_window, setAcceptsMouseMovedEvents: true];
                                    let _: () = msg_send![ns_window, orderFrontRegardless];
                                }
                            }
                        })
                        .is_err()
                    {
                        break;
                    }
                });
            }

            // tray 左键按 appMode 显示/隐藏 panel；右键菜单负责更新、形态切换和退出。
            {
                use tauri::menu::{Menu, MenuItem};
                use tauri::tray::{
                    MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent,
                };

                let show_item = MenuItem::with_id(app, "show", "显示字幕窗口", true, None::<&str>)?;
                let update_item =
                    MenuItem::with_id(app, "check-update", "检查更新…", true, None::<&str>)?;
                let toggle_mode_text = match initial_app_mode {
                    app_mode::AppMode::Desktop => "切换到菜单栏 App",
                    app_mode::AppMode::Menubar => "切换到自由窗口",
                };
                let toggle_mode_item = MenuItem::with_id(
                    app,
                    "toggle-app-mode",
                    toggle_mode_text,
                    true,
                    None::<&str>,
                )?;
                let quit_item =
                    MenuItem::with_id(app, "quit", "退出 ListenUp Desktop", true, None::<&str>)?;
                let menu = Menu::with_items(
                    app,
                    &[&show_item, &update_item, &toggle_mode_item, &quit_item],
                )?;
                app.manage(app_mode::AppModeMenuItem(toggle_mode_item.clone()));

                let mut tray = TrayIconBuilder::with_id("main-tray")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => {
                            let tray_rect = app
                                .tray_by_id("main-tray")
                                .and_then(|tray| tray.rect().ok().flatten());
                            show_main_window(app, tray_rect, None);
                        }
                        "check-update" => {
                            let tray_rect = app
                                .tray_by_id("main-tray")
                                .and_then(|tray| tray.rect().ok().flatten());
                            show_main_window(app, tray_rect, None);
                            let _ = app.emit(CHECK_UPDATE_EVENT, ());
                        }
                        "toggle-app-mode" => {
                            if let Err(error) = app_mode::toggle(app) {
                                let _ = app.emit(app_mode::APP_MODE_ERROR_EVENT, error);
                            }
                        }
                        "quit" => app.exit(0),
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            rect,
                            position,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let is_menubar = app.state::<app_mode::AppModeState>().current()
                                    == app_mode::AppMode::Menubar;
                                if is_menubar && window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    show_main_window(app, Some(rect), Some(position));
                                }
                            }
                        }
                    });
                // 专用黑白 template 图标（变体 A：字幕框 + 字幕条）；
                // 设为 template 后，macOS 会按菜单栏明暗自动反色
                match tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png")) {
                    Ok(img) => {
                        tray = tray.icon(img).icon_as_template(true);
                    }
                    Err(_) => {
                        if let Some(icon) = app.default_window_icon() {
                            tray = tray.icon(icon.clone());
                        }
                    }
                }
                tray.build(app)?;
            }

            #[cfg(unix)]
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || run_socket_server(handle));
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running ListenUp Desktop");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    struct ChunkedReader {
        cursor: Cursor<Vec<u8>>,
        chunk_size: usize,
    }

    impl Read for ChunkedReader {
        fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
            let limit = buffer.len().min(self.chunk_size);
            self.cursor.read(&mut buffer[..limit])
        }
    }

    fn frame(json: &str) -> Vec<u8> {
        let mut bytes = (json.len() as u32).to_ne_bytes().to_vec();
        bytes.extend_from_slice(json.as_bytes());
        bytes
    }

    fn session_message(session_id: &str, tab_id: i64) -> NativeMessage {
        session_message_with_identity(session_id, tab_id, "verified")
    }

    fn session_message_with_identity(
        session_id: &str,
        tab_id: i64,
        identity_status: &str,
    ) -> NativeMessage {
        NativeMessage::Session {
            version: PROTOCOL_VERSION,
            tab_id,
            session_id: session_id.to_string(),
            video_id: format!("video-{session_id}"),
            title: format!("Video {session_id}"),
            identity_status: identity_status.to_string(),
            status: "ready".to_string(),
            error: None,
            track: None,
            subtitles: Vec::new(),
        }
    }

    fn cursor_message(session_id: &str, tab_id: i64, is_paused: bool) -> NativeMessage {
        NativeMessage::Cursor {
            version: PROTOCOL_VERSION,
            tab_id,
            session_id: session_id.to_string(),
            video_id: format!("video-{session_id}"),
            playback_epoch: 1,
            current_time: 12.5,
            current_index: 3,
            is_paused,
            is_ad_playing: false,
            sent_at: 42,
        }
    }

    #[test]
    fn seek_command_requires_a_finite_non_negative_time() {
        assert_eq!(
            validate_playback_request(PlaybackAction::Seek, Some(12.5)),
            Ok(())
        );
        assert!(validate_playback_request(PlaybackAction::Seek, None).is_err());
        assert!(validate_playback_request(PlaybackAction::Seek, Some(-0.1)).is_err());
        assert!(validate_playback_request(PlaybackAction::Seek, Some(f64::NAN)).is_err());
        assert!(validate_playback_request(PlaybackAction::Play, Some(12.5)).is_err());
        assert_eq!(
            validate_playback_request(PlaybackAction::Pause, None),
            Ok(())
        );
    }

    #[test]
    fn seek_command_serializes_the_target_for_the_extension() {
        let command = PlaybackCommand {
            kind: "playbackCommand".to_string(),
            version: PROTOCOL_VERSION,
            command_id: "command-1".to_string(),
            tab_id: 7,
            session_id: "session-1".to_string(),
            video_id: "video-1".to_string(),
            action: PlaybackAction::Seek,
            seek_time: Some(12.5),
        };
        let json = serde_json::to_value(command).unwrap();

        assert_eq!(json["action"], "seek");
        assert_eq!(json["seekTime"], 12.5);
    }

    #[test]
    fn native_message_roundtrips_through_bridge_line() {
        let message = session_message("one", 1);
        let line = serde_json::to_string(&message).unwrap();
        assert!(!line.contains('\n'));
        let parsed: NativeMessage = serde_json::from_str(&line).unwrap();
        assert_eq!(parsed, message);
    }

    #[test]
    fn reads_a_fragmented_native_messaging_frame() {
        let json = r#"{"kind":"end","version":5,"tabId":4,"sessionId":"s1","videoId":"v1"}"#;
        let mut reader = ChunkedReader {
            cursor: Cursor::new(frame(json)),
            chunk_size: 2,
        };
        let message = read_frame(&mut reader).unwrap().unwrap();
        assert_eq!(
            message,
            NativeMessage::End {
                version: PROTOCOL_VERSION,
                tab_id: 4,
                session_id: "s1".to_string(),
                video_id: "v1".to_string(),
            }
        );
    }

    #[test]
    fn rejects_empty_and_oversized_frames() {
        let mut empty = Cursor::new(0_u32.to_ne_bytes());
        assert!(matches!(
            read_frame(&mut empty),
            Err(FrameError::InvalidLength(0))
        ));

        let oversized = ((MAX_MESSAGE_BYTES + 1) as u32).to_ne_bytes();
        assert!(matches!(
            read_frame(&mut Cursor::new(oversized)),
            Err(FrameError::InvalidLength(_))
        ));
    }

    #[test]
    fn rejects_invalid_json_without_losing_the_frame_boundary() {
        let error = read_frame(&mut Cursor::new(frame("not-json"))).unwrap_err();
        assert!(matches!(error, FrameError::Json(_)));
    }

    #[test]
    fn two_playing_sessions_require_selection_and_choice_is_sticky() {
        let mut store = BrowserSourceStore::default();
        store.connected = true;
        store.apply(session_message("one", 1));
        store.apply(session_message("two", 2));
        assert_eq!(store.active_session_id.as_deref(), Some("one"));

        store.apply(cursor_message("one", 1, false));
        store.apply(cursor_message("two", 2, false));
        assert_eq!(store.active_session_id, None);
        assert!(store.snapshot().selection_required);

        store.select_session("one").unwrap();
        assert_eq!(store.active_session_id.as_deref(), Some("one"));
        assert_eq!(store.manually_selected_session_id.as_deref(), Some("one"));

        store.apply(session_message("three", 3));
        store.apply(cursor_message("three", 3, false));
        assert_eq!(store.active_session_id.as_deref(), Some("one"));
        assert!(!store.snapshot().selection_required);
    }

    #[test]
    fn selected_session_stopping_reprompts_or_auto_follows() {
        let mut store = BrowserSourceStore::default();
        store.apply(session_message("one", 1));
        store.apply(session_message("two", 2));
        store.apply(session_message("three", 3));
        store.apply(cursor_message("one", 1, false));
        store.apply(cursor_message("two", 2, false));
        store.apply(cursor_message("three", 3, false));
        store.select_session("one").unwrap();

        store.apply(cursor_message("one", 1, true));
        assert_eq!(store.active_session_id, None);
        assert!(store.snapshot().selection_required);

        store.apply(cursor_message("three", 3, true));
        assert_eq!(store.active_session_id.as_deref(), Some("two"));
        assert_eq!(store.manually_selected_session_id, None);
        assert!(!store.snapshot().selection_required);
    }

    #[test]
    fn pending_playing_session_is_not_selectable() {
        let mut store = BrowserSourceStore::default();
        store.apply(session_message("verified", 1));
        store.apply(session_message_with_identity("pending", 2, "pending"));
        store.apply(cursor_message("verified", 1, false));
        store.apply(cursor_message("pending", 2, false));

        let snapshot = store.snapshot();
        assert_eq!(snapshot.playing_session_count, 2);
        assert_eq!(snapshot.playing_candidates.len(), 1);
        assert!(!snapshot.selection_required);
        assert_eq!(snapshot.active_session, None);
        assert!(store.select_session("pending").is_err());
    }

    #[test]
    fn invalid_or_stale_selection_is_rejected() {
        let mut store = BrowserSourceStore::default();
        store.apply(session_message("one", 1));
        store.apply(session_message("two", 2));
        store.apply(cursor_message("one", 1, false));
        store.apply(cursor_message("two", 2, true));

        assert!(store.select_session("one").is_err());
        assert!(store.select_session("missing").is_err());
    }

    #[test]
    fn cursor_updates_do_not_reorder_candidates_or_emit_full_snapshots() {
        let mut store = BrowserSourceStore::default();
        store.apply(session_message("one", 1));
        store.apply(session_message("two", 2));
        store.apply(cursor_message("one", 1, false));
        store.apply(cursor_message("two", 2, false));
        store.select_session("one").unwrap();

        let candidate_ids = store
            .snapshot()
            .playing_candidates
            .into_iter()
            .map(|candidate| candidate.session_id)
            .collect::<Vec<_>>();
        assert_eq!(candidate_ids, vec!["one", "two"]);

        assert!(matches!(
            store.apply(cursor_message("one", 1, false)),
            Some(UiUpdate::Cursor(_))
        ));
        assert!(store.apply(cursor_message("two", 2, false)).is_none());
        let candidate_ids_after = store
            .snapshot()
            .playing_candidates
            .into_iter()
            .map(|candidate| candidate.session_id)
            .collect::<Vec<_>>();
        assert_eq!(candidate_ids_after, vec!["one", "two"]);
    }

    #[test]
    fn playback_target_keeps_bridge_identity_when_tab_ids_collide() {
        let mut store = BrowserSourceStore::default();
        store.apply_from_bridge(session_message("one", 7), 11);
        store.apply_from_bridge(session_message("two", 7), 22);
        store.apply_from_bridge(cursor_message("one", 7, false), 11);
        store.apply_from_bridge(cursor_message("two", 7, false), 22);
        store.select_session("one").unwrap();

        assert_eq!(
            store.playback_target().unwrap(),
            PlaybackTarget {
                bridge_id: 11,
                tab_id: 7,
                session_id: "one".to_string(),
                video_id: "video-one".to_string(),
            }
        );
        assert!(store
            .apply_from_bridge(cursor_message("one", 7, true), 22)
            .is_none());
        assert!(!store.sessions["one"].cursor.as_ref().unwrap().is_paused);
    }

    #[test]
    fn playback_result_rejects_a_different_bridge_or_session() {
        let mut commands = PlaybackCommandState::default();
        let (command_id, receiver) = commands.register(11, "one", "video-one");
        commands.resolve(22, &command_id, "one", "video-one", Ok(()));
        assert_eq!(
            receiver.blocking_recv().unwrap(),
            Err("播放命令响应身份不匹配".to_string())
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn native_host_manifest_allows_only_the_compiled_extension() {
        let wrapper = std::path::Path::new("/tmp/listenup-native-host.sh");
        let manifest = native_host_manifest(wrapper);
        assert_eq!(manifest["name"], NATIVE_HOST_NAME);
        assert_eq!(manifest["path"], wrapper.to_string_lossy().as_ref());
        assert_eq!(
            manifest["allowed_origins"],
            serde_json::json!([format!("chrome-extension://{EXTENSION_ID}/")])
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn native_host_registration_writes_isolated_manifest_and_wrapper() {
        let test_root = std::env::temp_dir().join(format!(
            "listenup-native-host-{}-{}",
            std::process::id(),
            std::thread::current().name().unwrap_or("test")
        ));
        let executable = test_root.join("ListenUp.app/Contents/MacOS/listenup-desktop");
        let manifest_path = register_native_messaging_host_at(&test_root, &executable).unwrap();
        let manifest: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&manifest_path).unwrap()).unwrap();
        let wrapper_path = manifest_path.with_extension("sh");
        let wrapper = std::fs::read_to_string(&wrapper_path).unwrap();

        assert_eq!(manifest["name"], NATIVE_HOST_NAME);
        assert_eq!(
            manifest["allowed_origins"],
            serde_json::json!([format!("chrome-extension://{EXTENSION_ID}/")])
        );
        assert!(wrapper.contains(executable.to_string_lossy().as_ref()));

        std::fs::remove_dir_all(test_root).unwrap();
    }
}
