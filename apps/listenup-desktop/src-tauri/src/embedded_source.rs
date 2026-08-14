// @purpose 校验并保存受限 YouTube child WebView 发来的 Embedded session/cursor/controlResult。
// @role    EmbeddedSource 消息 schema、大小/限流/身份安全门与单会话 viewer 适配层。
// @deps    SourceRef、桌面端字幕/session/cursor 类型、serde_json、Instant
// @gotcha  必须先按原始字节限长再反序列化；source/session/video 四元身份与 WebView label 都不能省略。

use std::time::Instant;

use serde::{Deserialize, Serialize};

use super::{
    database::{SourceSnapshot, SourceSnapshotSegment},
    source_coordinator::{BrowserPauseState, SourceMode, SourceRef},
    CursorState, SessionState, SubtitleItem, SubtitleTrack, UiUpdate, ViewerSnapshot,
    PROTOCOL_VERSION,
};

pub(crate) const EMBEDDED_PROTOCOL_VERSION: u8 = 1;
pub(crate) const MAX_SESSION_MESSAGE_BYTES: usize = 4 * 1024 * 1024;
pub(crate) const MAX_INCREMENTAL_MESSAGE_BYTES: usize = 8 * 1024;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum EmbeddedMessage {
    Session {
        version: u8,
        source_id: String,
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
        source_id: String,
        session_id: String,
        video_id: String,
        playback_epoch: u64,
        current_time: f64,
        current_index: i64,
        is_paused: bool,
        is_ad_playing: bool,
        sent_at: u64,
    },
    ControlResult {
        version: u8,
        source_id: String,
        session_id: String,
        video_id: String,
        command_id: String,
        ok: bool,
        error: Option<String>,
    },
}

impl EmbeddedMessage {
    fn version(&self) -> u8 {
        match self {
            Self::Session { version, .. }
            | Self::Cursor { version, .. }
            | Self::ControlResult { version, .. } => *version,
        }
    }

    fn identity(&self) -> (&str, &str, &str) {
        match self {
            Self::Session {
                source_id,
                session_id,
                video_id,
                ..
            }
            | Self::Cursor {
                source_id,
                session_id,
                video_id,
                ..
            }
            | Self::ControlResult {
                source_id,
                session_id,
                video_id,
                ..
            } => (source_id, session_id, video_id),
        }
    }

    fn size_limit(&self) -> usize {
        match self {
            Self::Session { .. } => MAX_SESSION_MESSAGE_BYTES,
            Self::Cursor { .. } | Self::ControlResult { .. } => MAX_INCREMENTAL_MESSAGE_BYTES,
        }
    }

    pub(crate) fn source_snapshot(&self) -> Option<SourceSnapshot> {
        let Self::Session {
            video_id,
            title,
            identity_status,
            status,
            track: Some(track),
            subtitles,
            ..
        } = self
        else {
            return None;
        };
        if identity_status != "verified" || status != "ready" || subtitles.is_empty() {
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

    pub(crate) fn control_result(&self) -> Option<(&str, bool, Option<&str>)> {
        let Self::ControlResult {
            command_id,
            ok,
            error,
            ..
        } = self
        else {
            return None;
        };
        Some((command_id, *ok, error.as_deref()))
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum MessageRateClass {
    Session,
    Cursor,
    ControlResult,
}

#[derive(Clone, Debug)]
struct TokenBucket {
    tokens: f64,
    capacity: f64,
    refill_per_second: f64,
    updated_at: Instant,
}

impl TokenBucket {
    fn new(capacity: usize, refill_per_second: usize, now: Instant) -> Self {
        Self {
            tokens: capacity as f64,
            capacity: capacity as f64,
            refill_per_second: refill_per_second as f64,
            updated_at: now,
        }
    }

    fn take(&mut self, now: Instant) -> bool {
        let elapsed = now.saturating_duration_since(self.updated_at).as_secs_f64();
        self.tokens = (self.tokens + elapsed * self.refill_per_second).min(self.capacity);
        self.updated_at = now;
        if self.tokens < 1.0 {
            return false;
        }
        self.tokens -= 1.0;
        true
    }
}

#[derive(Clone, Debug)]
pub(crate) struct EmbeddedRateLimiter {
    session: TokenBucket,
    cursor: TokenBucket,
    control_result: TokenBucket,
}

impl EmbeddedRateLimiter {
    pub(crate) fn new(now: Instant) -> Self {
        Self {
            session: TokenBucket::new(2, 2, now),
            cursor: TokenBucket::new(20, 10, now),
            control_result: TokenBucket::new(20, 10, now),
        }
    }

    fn accept(&mut self, class: MessageRateClass, now: Instant) -> bool {
        match class {
            MessageRateClass::Session => self.session.take(now),
            MessageRateClass::Cursor => self.cursor.take(now),
            MessageRateClass::ControlResult => self.control_result.take(now),
        }
    }
}

pub(crate) fn parse_embedded_message(
    payload: &str,
    source: &SourceRef,
    limiter: &mut EmbeddedRateLimiter,
    now: Instant,
) -> Result<EmbeddedMessage, String> {
    if payload.len() > MAX_SESSION_MESSAGE_BYTES {
        return Err("Embedded 消息超过 4 MiB 上限".to_string());
    }
    let message: EmbeddedMessage =
        serde_json::from_str(payload).map_err(|_| "Embedded 消息格式无效".to_string())?;
    if payload.len() > message.size_limit() {
        return Err("Embedded 增量消息超过 8 KiB 上限".to_string());
    }
    if message.version() != EMBEDDED_PROTOCOL_VERSION {
        return Err("Embedded 消息协议版本不匹配".to_string());
    }
    let (source_id, session_id, video_id) = message.identity();
    if source_id != source.source_id
        || session_id != source.session_id
        || video_id != source.video_id
    {
        return Err("Embedded 消息来源身份不匹配".to_string());
    }

    let rate_class = match &message {
        EmbeddedMessage::Session { .. } => MessageRateClass::Session,
        EmbeddedMessage::Cursor {
            current_time,
            current_index,
            ..
        } => {
            if !current_time.is_finite() || *current_time < 0.0 || *current_index < -1 {
                return Err("Embedded cursor 数值无效".to_string());
            }
            MessageRateClass::Cursor
        }
        EmbeddedMessage::ControlResult { command_id, .. } => {
            if command_id.is_empty() || command_id.len() > 128 {
                return Err("Embedded control result 身份无效".to_string());
            }
            MessageRateClass::ControlResult
        }
    };
    if !limiter.accept(rate_class, now) {
        return Err("Embedded 消息频率超过限制".to_string());
    }
    Ok(message)
}

pub(crate) struct EmbeddedSourceStore {
    source: SourceRef,
    session: Option<SessionState>,
    updated_order: u64,
}

impl EmbeddedSourceStore {
    pub(crate) fn new(source: SourceRef) -> Self {
        Self {
            source,
            session: None,
            updated_order: 0,
        }
    }

    pub(crate) fn snapshot(&self, connected: bool) -> ViewerSnapshot {
        ViewerSnapshot {
            connected,
            source_mode: SourceMode::EmbeddedActive,
            source: Some(self.source.clone()),
            browser_pause_state: BrowserPauseState::NotNeeded,
            awaiting_browser_playback: false,
            active_session: self.session.clone(),
            playing_candidates: Vec::new(),
            playing_session_count: usize::from(
                self.session
                    .as_ref()
                    .and_then(|session| session.cursor.as_ref())
                    .is_some_and(|cursor| !cursor.is_paused && !cursor.is_ad_playing),
            ),
            selected_session_id: None,
            selection_required: false,
        }
    }

    pub(crate) fn apply(&mut self, message: EmbeddedMessage) -> Option<UiUpdate> {
        match message {
            EmbeddedMessage::Session {
                source_id: _,
                session_id,
                video_id,
                title,
                identity_status,
                status,
                error,
                track,
                subtitles,
                ..
            } => {
                self.updated_order += 1;
                let cursor = self.session.take().and_then(|session| session.cursor);
                self.session = Some(SessionState {
                    tab_id: -1,
                    session_id,
                    video_id,
                    title,
                    identity_status,
                    status,
                    error,
                    track,
                    subtitles,
                    cursor,
                    protocol_version: PROTOCOL_VERSION,
                    bridge_id: 0,
                    updated_order: self.updated_order,
                });
                Some(UiUpdate::Snapshot(self.snapshot(true)))
            }
            EmbeddedMessage::Cursor {
                session_id,
                video_id,
                playback_epoch,
                current_time,
                current_index,
                is_paused,
                is_ad_playing,
                sent_at,
                ..
            } => {
                let session = self.session.as_mut()?;
                if session.session_id != session_id || session.video_id != video_id {
                    return None;
                }
                let cursor = CursorState {
                    session_id,
                    video_id,
                    playback_epoch,
                    current_time,
                    current_index,
                    is_paused,
                    is_ad_playing,
                    sent_at,
                };
                session.cursor = Some(cursor.clone());
                Some(UiUpdate::Cursor(cursor))
            }
            EmbeddedMessage::ControlResult { .. } => None,
        }
    }

    pub(crate) fn source(&self) -> &SourceRef {
        &self.source
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::source_coordinator::SourceRef;
    use std::time::Duration;

    fn source() -> SourceRef {
        SourceRef::embedded(
            "player-1".to_string(),
            "session-1".to_string(),
            "abcdefghijk".to_string(),
        )
    }

    fn cursor_payload(epoch: u64) -> String {
        serde_json::json!({
            "kind": "cursor",
            "version": EMBEDDED_PROTOCOL_VERSION,
            "sourceId": "player-1",
            "sessionId": "session-1",
            "videoId": "abcdefghijk",
            "playbackEpoch": epoch,
            "currentTime": 1.5,
            "currentIndex": 0,
            "isPaused": false,
            "isAdPlaying": false,
            "sentAt": 42
        })
        .to_string()
    }

    #[test]
    fn rejects_wrong_version_identity_and_incremental_size() {
        let now = Instant::now();
        let mut limiter = EmbeddedRateLimiter::new(now);
        let mut wrong_version: serde_json::Value =
            serde_json::from_str(&cursor_payload(1)).unwrap();
        wrong_version["version"] = 2.into();
        assert!(
            parse_embedded_message(&wrong_version.to_string(), &source(), &mut limiter, now)
                .is_err()
        );

        let mut wrong_identity: serde_json::Value =
            serde_json::from_str(&cursor_payload(1)).unwrap();
        wrong_identity["sourceId"] = "stale-player".into();
        assert!(
            parse_embedded_message(&wrong_identity.to_string(), &source(), &mut limiter, now)
                .is_err()
        );

        let oversized = serde_json::json!({
            "kind": "controlResult",
            "version": 1,
            "sourceId": "player-1",
            "sessionId": "session-1",
            "videoId": "abcdefghijk",
            "commandId": "x",
            "ok": false,
            "error": "x".repeat(MAX_INCREMENTAL_MESSAGE_BYTES)
        })
        .to_string();
        assert!(parse_embedded_message(&oversized, &source(), &mut limiter, now).is_err());
    }

    #[test]
    fn enforces_cursor_burst_and_refill_rate() {
        let now = Instant::now();
        let mut limiter = EmbeddedRateLimiter::new(now);
        for epoch in 0..20 {
            assert!(
                parse_embedded_message(&cursor_payload(epoch), &source(), &mut limiter, now)
                    .is_ok()
            );
        }
        assert!(parse_embedded_message(&cursor_payload(21), &source(), &mut limiter, now).is_err());
        assert!(parse_embedded_message(
            &cursor_payload(22),
            &source(),
            &mut limiter,
            now + Duration::from_millis(100)
        )
        .is_ok());
    }

    #[test]
    fn rejects_late_source_after_player_identity_changes() {
        let now = Instant::now();
        let mut limiter = EmbeddedRateLimiter::new(now);
        let next_source = SourceRef::embedded(
            "player-2".to_string(),
            "session-2".to_string(),
            "abcdefghijk".to_string(),
        );
        assert!(
            parse_embedded_message(&cursor_payload(1), &next_source, &mut limiter, now).is_err()
        );
    }
}
