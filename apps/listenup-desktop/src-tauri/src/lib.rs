// @purpose 桌面端全部 Rust 逻辑：GUI/桥接双模式、Unix socket、session 仲裁、更新插件、NSPanel 与 tray。
// @role    被 main.rs 调用；同时是 Chrome Native Messaging Host 的实现。
// @deps    tauri、serde、window-vibrancy、objc2、std::os::unix::net、编译期环境矩阵
// @gotcha  桥接 stdout 被协议独占；2+ 播放 session 必须尊重手动锁定，pending session 不可供用户选择。
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    env,
    io::{self, Read},
    sync::Mutex,
};
use tauri::{AppHandle, Emitter, Manager, State};

const PROTOCOL_VERSION: u8 = 2;
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
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CursorState {
    session_id: String,
    video_id: String,
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
    updated_order: u64,
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
struct HostStore {
    connected: bool,
    bridge_connections: usize,
    sessions: HashMap<String, SessionState>,
    active_session_id: Option<String>,
    manually_selected_session_id: Option<String>,
    sequence: u64,
}

impl HostStore {
    fn is_playing(session: &SessionState) -> bool {
        session
            .cursor
            .as_ref()
            .is_some_and(|cursor| !cursor.is_paused && !cursor.is_ad_playing)
    }

    fn is_selectable(session: &SessionState) -> bool {
        Self::is_playing(session) && session.identity_status == "verified"
    }

    fn ordered_session_ids_matching(
        &self,
        predicate: impl Fn(&SessionState) -> bool,
    ) -> Vec<String> {
        let mut sessions = self
            .sessions
            .values()
            .filter(|session| predicate(session))
            .collect::<Vec<_>>();
        // 候选顺序必须稳定；若按 cursor 的 updated_order 排，每 250ms 都可能
        // 交换顺序并把本该是增量 cursor 的事件放大成全量字幕 snapshot。
        sessions.sort_by(|left, right| {
            left.tab_id
                .cmp(&right.tab_id)
                .then_with(|| left.session_id.cmp(&right.session_id))
        });
        sessions
            .into_iter()
            .map(|session| session.session_id.clone())
            .collect()
    }

    fn playing_session_ids(&self) -> Vec<String> {
        self.ordered_session_ids_matching(Self::is_playing)
    }

    fn selectable_session_ids(&self) -> Vec<String> {
        self.ordered_session_ids_matching(Self::is_selectable)
    }

    fn selection_required(&self) -> bool {
        self.playing_session_ids().len() >= 2
            && self.manually_selected_session_id.is_none()
            && self.selectable_session_ids().len() >= 2
    }

    fn reconcile_active_session(&mut self) {
        let playing_ids = self.playing_session_ids();
        let selectable_ids = self.selectable_session_ids();
        let manual_is_valid = self
            .manually_selected_session_id
            .as_ref()
            .is_some_and(|id| selectable_ids.contains(id));

        if !manual_is_valid {
            self.manually_selected_session_id = None;
        }

        match playing_ids.len() {
            0 => {
                if self
                    .active_session_id
                    .as_ref()
                    .is_none_or(|id| !self.sessions.contains_key(id))
                {
                    self.active_session_id = self
                        .sessions
                        .values()
                        .max_by_key(|session| session.updated_order)
                        .map(|session| session.session_id.clone());
                }
            }
            1 => {
                self.active_session_id = playing_ids.first().cloned();
                self.manually_selected_session_id = None;
            }
            _ => {
                self.active_session_id = self.manually_selected_session_id.clone();
            }
        }
    }

    fn snapshot(&self) -> ViewerSnapshot {
        let selectable_ids = self.selectable_session_ids();
        let playing_candidates = selectable_ids
            .iter()
            .filter_map(|id| self.sessions.get(id))
            .map(|session| PlayingCandidate {
                session_id: session.session_id.clone(),
                tab_id: session.tab_id,
                video_id: session.video_id.clone(),
                title: session.title.clone(),
            })
            .collect();
        ViewerSnapshot {
            connected: self.connected,
            active_session: self
                .active_session_id
                .as_ref()
                .and_then(|id| self.sessions.get(id))
                .cloned(),
            playing_candidates,
            playing_session_count: self.playing_session_ids().len(),
            selected_session_id: self.manually_selected_session_id.clone(),
            selection_required: self.selection_required(),
        }
    }

    fn next_sequence(&mut self) -> u64 {
        self.sequence += 1;
        self.sequence
    }

    fn apply(&mut self, message: NativeMessage) -> Option<UiUpdate> {
        match message {
            NativeMessage::Session {
                version,
                tab_id,
                session_id,
                video_id,
                title,
                identity_status,
                status,
                error,
                track,
                subtitles,
            } => {
                if version != PROTOCOL_VERSION {
                    return None;
                }

                let order = self.next_sequence();
                let previous = self.sessions.remove(&session_id);
                let session = SessionState {
                    tab_id,
                    session_id: session_id.clone(),
                    video_id,
                    title,
                    identity_status,
                    status,
                    error,
                    track,
                    subtitles,
                    cursor: previous.and_then(|value| value.cursor),
                    updated_order: order,
                };
                self.sessions.insert(session_id.clone(), session.clone());
                self.reconcile_active_session();
                Some(UiUpdate::Snapshot(self.snapshot()))
            }
            NativeMessage::Cursor {
                version,
                tab_id,
                session_id,
                video_id,
                current_time,
                current_index,
                is_paused,
                is_ad_playing,
                sent_at,
            } => {
                if version != PROTOCOL_VERSION {
                    return None;
                }

                let cursor = CursorState {
                    session_id: session_id.clone(),
                    video_id: video_id.clone(),
                    current_time,
                    current_index,
                    is_paused,
                    is_ad_playing,
                    sent_at,
                };
                let before = self.snapshot();
                let order = self.next_sequence();
                let session = self.sessions.get_mut(&session_id)?;
                if session.tab_id != tab_id || session.video_id != video_id {
                    return None;
                }
                session.cursor = Some(cursor.clone());
                session.updated_order = order;
                self.reconcile_active_session();
                let after = self.snapshot();
                let structural_change = before
                    .active_session
                    .as_ref()
                    .map(|value| &value.session_id)
                    != after.active_session.as_ref().map(|value| &value.session_id)
                    || before.playing_candidates != after.playing_candidates
                    || before.playing_session_count != after.playing_session_count
                    || before.selected_session_id != after.selected_session_id
                    || before.selection_required != after.selection_required;

                if structural_change {
                    Some(UiUpdate::Snapshot(after))
                } else {
                    (self.active_session_id.as_deref() == Some(session_id.as_str()))
                        .then_some(UiUpdate::Cursor(cursor))
                }
            }
            NativeMessage::End {
                version,
                tab_id,
                session_id,
                video_id,
            } => {
                if version != PROTOCOL_VERSION {
                    return None;
                }
                let should_remove = self.sessions.get(&session_id).is_some_and(|session| {
                    session.tab_id == tab_id && session.video_id == video_id
                });
                if !should_remove {
                    return None;
                }

                self.sessions.remove(&session_id);
                self.reconcile_active_session();
                Some(UiUpdate::Snapshot(self.snapshot()))
            }
        }
    }

    fn select_session(&mut self, session_id: &str) -> Result<ViewerSnapshot, String> {
        let selectable_ids = self.selectable_session_ids();
        if selectable_ids.len() < 2 || !selectable_ids.iter().any(|id| id == session_id) {
            return Err("所选视频已不再是可用的播放候选".to_string());
        }

        self.manually_selected_session_id = Some(session_id.to_string());
        self.reconcile_active_session();
        Ok(self.snapshot())
    }
}

#[derive(Default)]
struct SharedStore(Mutex<HostStore>);

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
fn send_bridge_line(
    stream: &mut std::os::unix::net::UnixStream,
    message: &NativeMessage,
) -> io::Result<()> {
    use std::io::Write;

    let mut line = serde_json::to_string(message)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    line.push('\n');
    stream.write_all(line.as_bytes())
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
        if delta > 0 {
            store.bridge_connections += 1;
        } else {
            store.bridge_connections = store.bridge_connections.saturating_sub(1);
        }
        store.connected = store.bridge_connections > 0;
        store.connected
    };
    let _ = app.emit(CONNECTION_EVENT, connected);
}

#[cfg(unix)]
fn handle_bridge_connection(app: AppHandle, stream: std::os::unix::net::UnixStream) {
    use std::io::{BufRead, BufReader};

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
        let update = {
            let shared = app.state::<SharedStore>();
            shared
                .0
                .lock()
                .ok()
                .and_then(|mut store| store.apply(message))
        };
        if let Some(update) = update {
            if let Err(error) = app.emit(UPDATE_EVENT, update) {
                eprintln!("failed to emit subtitle update: {error}");
            }
        }
    }
    set_bridge_connected(&app, -1);
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

#[tauri::command]
fn get_snapshot(store: State<'_, SharedStore>) -> ViewerSnapshot {
    store
        .0
        .lock()
        .map(|store| store.snapshot())
        .unwrap_or(ViewerSnapshot {
            connected: false,
            active_session: None,
            playing_candidates: Vec::new(),
            playing_session_count: 0,
            selected_session_id: None,
            selection_required: false,
        })
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
        .select_session(&session_id)?;
    let _ = app.emit(UPDATE_EVENT, UiUpdate::Snapshot(snapshot.clone()));
    Ok(snapshot)
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
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(SharedStore::default())
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            select_subtitle_session,
            set_vibrancy
        ])
        .setup(|app| {
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

            // 关键（调研结论，tauri#11488）：普通 activation policy 下，NSWindow
            // 即使有 canJoinAllSpaces + fullScreenAuxiliary + 高 level 也进不了
            // 其他 app 的原生全屏 Space（实测 isOnActiveSpace 恒为 false）。
            // Regular 形态：Dock 图标常驻（黑色 app 图标）、可 Cmd+Tab，
            // 同时菜单栏 tray 图标也常驻——两个入口都保留。
            // 盖全屏能力由下方 NSPanel(nonactivatingPanel) 配置提供，与 activation
            // policy 无关（已实测 Regular 下字幕仍能盖住别的 app 的全屏）。
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Regular);

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
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = hide_target.hide();
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

            // 菜单栏（tray）图标：Accessory 形态下没有 Dock 图标，
            // 菜单栏是唤出窗口和退出 app 的常驻入口
            {
                use tauri::menu::{Menu, MenuItem};
                use tauri::tray::TrayIconBuilder;

                let show_item = MenuItem::with_id(app, "show", "显示字幕窗口", true, None::<&str>)?;
                let update_item =
                    MenuItem::with_id(app, "check-update", "检查更新…", true, None::<&str>)?;
                let quit_item =
                    MenuItem::with_id(app, "quit", "退出 ListenUp Desktop", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show_item, &update_item, &quit_item])?;

                let mut tray = TrayIconBuilder::with_id("main-tray")
                    .menu(&menu)
                    .show_menu_on_left_click(true)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "check-update" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                            let _ = app.emit(CHECK_UPDATE_EVENT, ());
                        }
                        "quit" => app.exit(0),
                        _ => {}
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
            current_time: 12.5,
            current_index: 3,
            is_paused,
            is_ad_playing: false,
            sent_at: 42,
        }
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
        let json = r#"{"kind":"end","version":2,"tabId":4,"sessionId":"s1","videoId":"v1"}"#;
        let mut reader = ChunkedReader {
            cursor: Cursor::new(frame(json)),
            chunk_size: 2,
        };
        let message = read_frame(&mut reader).unwrap().unwrap();
        assert_eq!(
            message,
            NativeMessage::End {
                version: 2,
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
        let mut store = HostStore::default();
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
        let mut store = HostStore::default();
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
        let mut store = HostStore::default();
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
        let mut store = HostStore::default();
        store.apply(session_message("one", 1));
        store.apply(session_message("two", 2));
        store.apply(cursor_message("one", 1, false));
        store.apply(cursor_message("two", 2, true));

        assert!(store.select_session("one").is_err());
        assert!(store.select_session("missing").is_err());
    }

    #[test]
    fn cursor_updates_do_not_reorder_candidates_or_emit_full_snapshots() {
        let mut store = HostStore::default();
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
