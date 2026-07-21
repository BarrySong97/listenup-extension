use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    env,
    io::{self, Read},
    sync::Mutex,
};
use tauri::{AppHandle, Emitter, Manager, State};

const PROTOCOL_VERSION: u8 = 1;
const MAX_MESSAGE_BYTES: usize = 16 * 1024 * 1024;
const UPDATE_EVENT: &str = "native-subtitle-update";

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
    status: String,
    error: Option<String>,
    track: Option<SubtitleTrack>,
    subtitles: Vec<SubtitleItem>,
    cursor: Option<CursorState>,
    #[serde(skip)]
    updated_order: u64,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
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
struct ViewerSnapshot {
    connected: bool,
    active_session: Option<SessionState>,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(tag = "kind", content = "payload", rename_all = "camelCase")]
enum UiUpdate {
    Session(Option<SessionState>),
    Cursor(CursorState),
}

#[derive(Default)]
struct HostStore {
    connected: bool,
    sessions: HashMap<String, SessionState>,
    active_session_id: Option<String>,
    sequence: u64,
}

impl HostStore {
    fn snapshot(&self) -> ViewerSnapshot {
        ViewerSnapshot {
            connected: self.connected,
            active_session: self
                .active_session_id
                .as_ref()
                .and_then(|id| self.sessions.get(id))
                .cloned(),
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
                    status,
                    error,
                    track,
                    subtitles,
                    cursor: previous.and_then(|value| value.cursor),
                    updated_order: order,
                };
                self.sessions.insert(session_id.clone(), session.clone());

                if self.active_session_id.is_none() {
                    self.active_session_id = Some(session_id.clone());
                }

                (self.active_session_id.as_deref() == Some(session_id.as_str()))
                    .then_some(UiUpdate::Session(Some(session)))
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
                let order = self.next_sequence();
                let session = self.sessions.get_mut(&session_id)?;
                if session.tab_id != tab_id || session.video_id != video_id {
                    return None;
                }
                session.cursor = Some(cursor.clone());
                session.updated_order = order;

                let active_changed =
                    !is_paused && self.active_session_id.as_deref() != Some(session_id.as_str());
                if active_changed {
                    self.active_session_id = Some(session_id.clone());
                    return self
                        .sessions
                        .get(&session_id)
                        .cloned()
                        .map(|value| UiUpdate::Session(Some(value)));
                }

                (self.active_session_id.as_deref() == Some(session_id.as_str()))
                    .then_some(UiUpdate::Cursor(cursor))
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
                if self.active_session_id.as_deref() != Some(session_id.as_str()) {
                    return None;
                }

                self.active_session_id = self
                    .sessions
                    .values()
                    .max_by_key(|session| session.updated_order)
                    .map(|session| session.session_id.clone());
                Some(UiUpdate::Session(
                    self.active_session_id
                        .as_ref()
                        .and_then(|id| self.sessions.get(id))
                        .cloned(),
                ))
            }
        }
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

fn run_native_reader(app: AppHandle) {
    {
        let shared = app.state::<SharedStore>();
        if let Ok(mut store) = shared.0.lock() {
            store.connected = true;
        };
    }

    let stdin = io::stdin();
    let mut reader = stdin.lock();
    loop {
        match read_frame(&mut reader) {
            Ok(Some(message)) => {
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
            Ok(None) => break,
            Err(FrameError::Json(error)) => {
                eprintln!("ignored invalid Native Messaging JSON: {error}");
            }
            Err(error) => {
                eprintln!("Native Messaging reader stopped: {error}");
                break;
            }
        }
    }

    app.exit(0);
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
        })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SharedStore::default())
        .invoke_handler(tauri::generate_handler![get_snapshot])
        .setup(|app| {
            if launched_by_chrome() {
                let handle = app.handle().clone();
                std::thread::spawn(move || run_native_reader(handle));
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running ListenUp Native Subtitle Demo");
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
        NativeMessage::Session {
            version: PROTOCOL_VERSION,
            tab_id,
            session_id: session_id.to_string(),
            video_id: format!("video-{session_id}"),
            title: format!("Video {session_id}"),
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
    fn reads_a_fragmented_native_messaging_frame() {
        let json = r#"{"kind":"end","version":1,"tabId":4,"sessionId":"s1","videoId":"v1"}"#;
        let mut reader = ChunkedReader {
            cursor: Cursor::new(frame(json)),
            chunk_size: 2,
        };
        let message = read_frame(&mut reader).unwrap().unwrap();
        assert_eq!(
            message,
            NativeMessage::End {
                version: 1,
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
    fn playing_session_becomes_active_and_end_falls_back() {
        let mut store = HostStore::default();
        store.connected = true;
        store.apply(session_message("one", 1));
        store.apply(session_message("two", 2));
        assert_eq!(store.active_session_id.as_deref(), Some("one"));

        store.apply(cursor_message("two", 2, false));
        assert_eq!(store.active_session_id.as_deref(), Some("two"));

        let update = store.apply(NativeMessage::End {
            version: PROTOCOL_VERSION,
            tab_id: 2,
            session_id: "two".to_string(),
            video_id: "video-two".to_string(),
        });
        assert_eq!(store.active_session_id.as_deref(), Some("one"));
        assert!(matches!(update, Some(UiUpdate::Session(Some(_)))));
    }

    #[test]
    fn paused_background_session_does_not_steal_focus() {
        let mut store = HostStore::default();
        store.apply(session_message("one", 1));
        store.apply(session_message("two", 2));
        store.apply(cursor_message("two", 2, true));
        assert_eq!(store.active_session_id.as_deref(), Some("one"));
    }
}
