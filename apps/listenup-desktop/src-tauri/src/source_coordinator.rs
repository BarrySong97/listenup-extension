// @purpose 统一仲裁浏览器与 Desktop 内置 YouTube 播放来源，并实现显式 Embedded 锁和退出重接屏障。
// @role    所有来源消息、viewer emit、SQLite 写入和播放控制在产生副作用前都必须经过本模块授权。
// @deps    BrowserSourceStore、Native Messaging v5 playbackEpoch、桌面端 viewer snapshot
// @gotcha  Embedded 故障或旧浏览器消息都不能隐式释放锁；退出后只接受未被隔离的新 session 或播放世代。

use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use super::{
    browser_source::{BrowserSourceStore, PlaybackTarget},
    embedded_source::{EmbeddedMessage, EmbeddedSourceStore},
    NativeMessage, UiUpdate, ViewerSnapshot, PROTOCOL_VERSION,
};

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SourceMode {
    #[default]
    Empty,
    BrowserActive,
    EnteringEmbedded,
    EmbeddedActive,
    EmbeddedRecovering,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum SourceKind {
    Browser,
    Embedded,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SourceRef {
    pub(crate) kind: SourceKind,
    pub(crate) source_id: String,
    pub(crate) session_id: String,
    pub(crate) video_id: String,
}

impl SourceRef {
    pub(crate) fn embedded(source_id: String, session_id: String, video_id: String) -> Self {
        Self {
            kind: SourceKind::Embedded,
            source_id,
            session_id,
            video_id,
        }
    }

    fn browser(target: &PlaybackTarget) -> Self {
        Self {
            kind: SourceKind::Browser,
            source_id: target.bridge_id.to_string(),
            session_id: target.session_id.clone(),
            video_id: target.video_id.clone(),
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum BrowserPauseState {
    #[default]
    NotNeeded,
    Pending,
    Succeeded,
    Failed(String),
    TimedOut,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
struct BrowserPlaybackEpoch {
    bridge_id: u64,
    session_id: String,
    video_id: String,
    playback_epoch: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
struct BrowserSessionIdentity {
    bridge_id: u64,
    session_id: String,
    video_id: String,
}

impl BrowserSessionIdentity {
    fn from_message(message: &NativeMessage, bridge_id: u64) -> Option<Self> {
        let NativeMessage::Session {
            version,
            session_id,
            video_id,
            ..
        } = message
        else {
            return None;
        };
        (*version == PROTOCOL_VERSION).then(|| Self {
            bridge_id,
            session_id: session_id.clone(),
            video_id: video_id.clone(),
        })
    }
}

impl BrowserPlaybackEpoch {
    fn from_message(message: &NativeMessage, bridge_id: u64) -> Option<Self> {
        let NativeMessage::Cursor {
            version,
            session_id,
            video_id,
            playback_epoch,
            is_paused,
            is_ad_playing,
            ..
        } = message
        else {
            return None;
        };
        (*version == PROTOCOL_VERSION && !*is_paused && !*is_ad_playing).then(|| Self {
            bridge_id,
            session_id: session_id.clone(),
            video_id: video_id.clone(),
            playback_epoch: *playback_epoch,
        })
    }
}

pub(crate) struct BrowserMessageOutcome {
    pub(crate) update: Option<UiUpdate>,
    pub(crate) persist_source: bool,
}

pub(crate) struct EnterEmbeddedOutcome {
    pub(crate) pause_target: Option<PlaybackTarget>,
}

pub(crate) enum PlaybackRoute {
    Browser(PlaybackTarget),
    Embedded(SourceRef),
}

pub(crate) struct EmbeddedMessageOutcome {
    pub(crate) update: Option<UiUpdate>,
    pub(crate) persist_source: bool,
}

pub(crate) struct SourceCoordinator {
    browser: BrowserSourceStore,
    mode: SourceMode,
    embedded_source: Option<SourceRef>,
    embedded_store: Option<EmbeddedSourceStore>,
    browser_pause_state: BrowserPauseState,
    browser_reconnect_barrier: bool,
    quarantined_browser_sessions: HashSet<BrowserSessionIdentity>,
    quarantined_browser_epochs: HashSet<BrowserPlaybackEpoch>,
}

impl Default for SourceCoordinator {
    fn default() -> Self {
        Self {
            browser: BrowserSourceStore::default(),
            mode: SourceMode::Empty,
            embedded_source: None,
            embedded_store: None,
            browser_pause_state: BrowserPauseState::NotNeeded,
            browser_reconnect_barrier: false,
            quarantined_browser_sessions: HashSet::new(),
            quarantined_browser_epochs: HashSet::new(),
        }
    }
}

impl SourceCoordinator {
    pub(crate) fn current_source(&self) -> Option<SourceRef> {
        if self.is_embedded_locked() {
            return self.embedded_source.clone();
        }
        self.browser
            .playback_target()
            .ok()
            .map(|target| SourceRef::browser(&target))
    }

    fn is_embedded_locked(&self) -> bool {
        matches!(
            self.mode,
            SourceMode::EnteringEmbedded
                | SourceMode::EmbeddedActive
                | SourceMode::EmbeddedRecovering
        )
    }

    fn empty_snapshot(&self) -> ViewerSnapshot {
        ViewerSnapshot {
            connected: self.browser.connected,
            source_mode: self.mode,
            source: self.embedded_source.clone(),
            browser_pause_state: self.browser_pause_state.clone(),
            awaiting_browser_playback: self.browser_reconnect_barrier,
            active_session: None,
            playing_candidates: Vec::new(),
            playing_session_count: 0,
            selected_session_id: None,
            selection_required: false,
        }
    }

    pub(crate) fn snapshot(&self) -> ViewerSnapshot {
        if self.mode == SourceMode::EmbeddedActive {
            self.embedded_store
                .as_ref()
                .map(|store| store.snapshot(true))
                .unwrap_or_else(|| self.empty_snapshot())
        } else if self.is_embedded_locked() || self.browser_reconnect_barrier {
            self.empty_snapshot()
        } else {
            let mut snapshot = self.browser.snapshot();
            snapshot.source_mode = self.mode;
            snapshot.source = self.current_source();
            snapshot.browser_pause_state = self.browser_pause_state.clone();
            snapshot.awaiting_browser_playback = false;
            snapshot
        }
    }

    pub(crate) fn set_browser_connected(&mut self, delta: i32) -> bool {
        if delta > 0 {
            self.browser.bridge_connections += 1;
        } else {
            self.browser.bridge_connections = self.browser.bridge_connections.saturating_sub(1);
        }
        self.browser.connected = self.browser.bridge_connections > 0;
        self.browser.connected
    }

    pub(crate) fn apply_browser_message(
        &mut self,
        message: NativeMessage,
        bridge_id: u64,
    ) -> BrowserMessageOutcome {
        let session_identity = BrowserSessionIdentity::from_message(&message, bridge_id);
        let epoch = BrowserPlaybackEpoch::from_message(&message, bridge_id);
        let is_source_snapshot = matches!(
            &message,
            NativeMessage::Session { version, .. } if *version == PROTOCOL_VERSION
        );
        let shadow_update = self.browser.apply_from_bridge(message, bridge_id);
        let accepted_epoch = epoch.filter(|epoch| self.browser_contains_epoch(epoch));

        if self.is_embedded_locked() {
            if let Some(identity) = session_identity {
                self.quarantined_browser_sessions.insert(identity);
            }
            if let Some(epoch) = accepted_epoch {
                self.quarantined_browser_epochs.insert(epoch);
            }
            return BrowserMessageOutcome {
                update: None,
                persist_source: false,
            };
        }

        if self.browser_reconnect_barrier {
            let has_new_session = session_identity
                .as_ref()
                .is_some_and(|identity| !self.quarantined_browser_sessions.contains(identity));
            let has_new_playback_epoch = accepted_epoch
                .as_ref()
                .is_some_and(|epoch| !self.quarantined_browser_epochs.contains(epoch));
            let should_reconnect = has_new_session || has_new_playback_epoch;
            if should_reconnect {
                self.browser_reconnect_barrier = false;
                self.mode = SourceMode::BrowserActive;
                return BrowserMessageOutcome {
                    update: Some(UiUpdate::Snapshot(self.browser.snapshot())),
                    persist_source: false,
                };
            }
            return BrowserMessageOutcome {
                update: None,
                persist_source: false,
            };
        }

        if shadow_update.is_some() {
            self.mode = if self.browser.sessions.is_empty() {
                SourceMode::Empty
            } else {
                SourceMode::BrowserActive
            };
        }
        BrowserMessageOutcome {
            update: shadow_update,
            persist_source: is_source_snapshot,
        }
    }

    pub(crate) fn select_browser_session(
        &mut self,
        session_id: &str,
    ) -> Result<ViewerSnapshot, String> {
        if self.mode != SourceMode::BrowserActive || self.browser_reconnect_barrier {
            return Err("当前浏览器字幕来源未激活".to_string());
        }
        self.browser.select_session(session_id)
    }

    pub(crate) fn browser_playback_target(&self) -> Result<PlaybackTarget, String> {
        if self.mode != SourceMode::BrowserActive || self.browser_reconnect_barrier {
            return Err("当前播放控制不属于浏览器来源".to_string());
        }
        self.browser.playback_target()
    }

    pub(crate) fn playback_route(&self) -> Result<PlaybackRoute, String> {
        match self.mode {
            SourceMode::BrowserActive => self.browser_playback_target().map(PlaybackRoute::Browser),
            SourceMode::EmbeddedActive => self
                .embedded_source
                .clone()
                .map(PlaybackRoute::Embedded)
                .ok_or_else(|| "Embedded 播放来源已经失效".to_string()),
            SourceMode::EnteringEmbedded => Err("Desktop 播放器正在初始化".to_string()),
            SourceMode::EmbeddedRecovering => Err("Desktop 播放器正在恢复".to_string()),
            SourceMode::Empty => Err("当前没有可控制的视频".to_string()),
        }
    }

    pub(crate) fn enter_embedded(
        &mut self,
        source: SourceRef,
    ) -> Result<EnterEmbeddedOutcome, String> {
        if source.kind != SourceKind::Embedded {
            return Err("内置播放器必须使用 embedded 来源身份".to_string());
        }
        if self.is_embedded_locked() {
            return Err("Desktop 播放器已经处于激活流程".to_string());
        }

        self.quarantine_observed_browser_epochs();
        let pause_target = self.browser.playback_target().ok();
        self.browser_pause_state = if pause_target.is_some() {
            BrowserPauseState::Pending
        } else {
            BrowserPauseState::NotNeeded
        };
        self.embedded_source = Some(source);
        self.embedded_store = self.embedded_source.clone().map(EmbeddedSourceStore::new);
        self.browser_reconnect_barrier = false;
        self.mode = SourceMode::EnteringEmbedded;
        Ok(EnterEmbeddedOutcome { pause_target })
    }

    pub(crate) fn record_browser_pause_result(&mut self, result: BrowserPauseState) {
        if self.is_embedded_locked()
            && !matches!(
                result,
                BrowserPauseState::NotNeeded | BrowserPauseState::Pending
            )
        {
            self.browser_pause_state = result;
        }
    }

    pub(crate) fn apply_embedded_message(
        &mut self,
        source: &SourceRef,
        message: EmbeddedMessage,
    ) -> Result<EmbeddedMessageOutcome, String> {
        self.require_current_embedded(source)?;
        let persist_source = matches!(
            &message,
            EmbeddedMessage::Session {
                identity_status,
                status,
                subtitles,
                ..
            } if identity_status == "verified" && status == "ready" && !subtitles.is_empty()
        );
        let store = self
            .embedded_store
            .as_mut()
            .ok_or_else(|| "Embedded 会话状态已经失效".to_string())?;
        if store.source() != source {
            return Err("Embedded store 来源身份不匹配".to_string());
        }
        let is_session = matches!(&message, EmbeddedMessage::Session { .. });
        let mut update = store.apply(message);
        if is_session && update.is_some() {
            self.mode = SourceMode::EmbeddedActive;
        } else if self.mode == SourceMode::EmbeddedRecovering {
            update = None;
        }
        Ok(EmbeddedMessageOutcome {
            update,
            persist_source,
        })
    }

    pub(crate) fn mark_embedded_recovering(&mut self, source: &SourceRef) -> Result<(), String> {
        self.require_current_embedded(source)?;
        self.mode = SourceMode::EmbeddedRecovering;
        Ok(())
    }

    pub(crate) fn exit_embedded(&mut self, source: &SourceRef) -> Result<ViewerSnapshot, String> {
        self.require_current_embedded(source)?;
        self.quarantine_observed_browser_epochs();
        self.embedded_source = None;
        self.embedded_store = None;
        self.browser_pause_state = BrowserPauseState::NotNeeded;
        self.browser_reconnect_barrier = true;
        self.mode = SourceMode::Empty;
        Ok(self.empty_snapshot())
    }

    fn require_current_embedded(&self, source: &SourceRef) -> Result<(), String> {
        if !self.is_embedded_locked() || self.embedded_source.as_ref() != Some(source) {
            return Err("Embedded 来源身份已经失效".to_string());
        }
        Ok(())
    }

    fn quarantine_observed_browser_epochs(&mut self) {
        self.quarantined_browser_sessions
            .extend(
                self.browser
                    .sessions
                    .values()
                    .map(|session| BrowserSessionIdentity {
                        bridge_id: session.bridge_id,
                        session_id: session.session_id.clone(),
                        video_id: session.video_id.clone(),
                    }),
            );
        self.quarantined_browser_epochs
            .extend(self.browser.sessions.values().filter_map(|session| {
                let cursor = session.cursor.as_ref()?;
                (!cursor.is_paused && !cursor.is_ad_playing).then(|| BrowserPlaybackEpoch {
                    bridge_id: session.bridge_id,
                    session_id: session.session_id.clone(),
                    video_id: session.video_id.clone(),
                    playback_epoch: cursor.playback_epoch,
                })
            }));
    }

    fn browser_contains_epoch(&self, epoch: &BrowserPlaybackEpoch) -> bool {
        self.browser
            .sessions
            .get(&epoch.session_id)
            .is_some_and(|session| {
                session.bridge_id == epoch.bridge_id
                    && session.video_id == epoch.video_id
                    && session.cursor.as_ref().is_some_and(|cursor| {
                        cursor.playback_epoch == epoch.playback_epoch
                            && !cursor.is_paused
                            && !cursor.is_ad_playing
                    })
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn embedded_source() -> SourceRef {
        SourceRef::embedded(
            "player-1".to_string(),
            "embedded-session-1".to_string(),
            "embedded-video-1".to_string(),
        )
    }

    fn session(session_id: &str, video_id: &str) -> NativeMessage {
        NativeMessage::Session {
            version: PROTOCOL_VERSION,
            tab_id: 7,
            session_id: session_id.to_string(),
            video_id: video_id.to_string(),
            title: video_id.to_string(),
            identity_status: "verified".to_string(),
            status: "ready".to_string(),
            error: None,
            track: None,
            subtitles: Vec::new(),
        }
    }

    fn cursor(
        session_id: &str,
        video_id: &str,
        playback_epoch: u64,
        is_paused: bool,
    ) -> NativeMessage {
        NativeMessage::Cursor {
            version: PROTOCOL_VERSION,
            tab_id: 7,
            session_id: session_id.to_string(),
            video_id: video_id.to_string(),
            playback_epoch,
            current_time: 12.5,
            current_index: 3,
            is_paused,
            is_ad_playing: false,
            sent_at: 42,
        }
    }

    fn establish_browser_playback(coordinator: &mut SourceCoordinator) {
        coordinator.apply_browser_message(session("browser-1", "video-1"), 11);
        coordinator.apply_browser_message(cursor("browser-1", "video-1", 1, false), 11);
    }

    #[test]
    fn entering_embedded_locks_browser_ui_persistence_and_control() {
        let mut coordinator = SourceCoordinator::default();
        establish_browser_playback(&mut coordinator);
        let source = embedded_source();

        let outcome = coordinator.enter_embedded(source.clone()).unwrap();
        assert_eq!(outcome.pause_target.unwrap().bridge_id, 11);
        assert_eq!(coordinator.mode, SourceMode::EnteringEmbedded);
        assert_eq!(coordinator.current_source(), Some(source));
        assert!(coordinator.snapshot().active_session.is_none());
        assert!(coordinator.browser_playback_target().is_err());

        let shadow = coordinator.apply_browser_message(session("browser-2", "video-2"), 22);
        assert!(shadow.update.is_none());
        assert!(!shadow.persist_source);
    }

    #[test]
    fn pause_success_failure_and_timeout_never_release_embedded_lock() {
        for result in [
            BrowserPauseState::Succeeded,
            BrowserPauseState::Failed("bridge rejected pause".to_string()),
            BrowserPauseState::TimedOut,
        ] {
            let mut coordinator = SourceCoordinator::default();
            establish_browser_playback(&mut coordinator);
            coordinator.enter_embedded(embedded_source()).unwrap();
            coordinator.record_browser_pause_result(result.clone());

            assert_eq!(coordinator.mode, SourceMode::EnteringEmbedded);
            assert_eq!(coordinator.browser_pause_state, result);
            assert!(coordinator.browser_playback_target().is_err());
        }
    }

    #[test]
    fn recovery_keeps_lock_and_only_explicit_exit_releases_it() {
        let mut coordinator = SourceCoordinator::default();
        establish_browser_playback(&mut coordinator);
        let source = embedded_source();
        coordinator.enter_embedded(source.clone()).unwrap();
        coordinator.mark_embedded_recovering(&source).unwrap();

        assert_eq!(coordinator.mode, SourceMode::EmbeddedRecovering);
        coordinator.apply_browser_message(cursor("browser-1", "video-1", 2, false), 11);
        assert_eq!(coordinator.mode, SourceMode::EmbeddedRecovering);

        let snapshot = coordinator.exit_embedded(&source).unwrap();
        assert_eq!(coordinator.mode, SourceMode::Empty);
        assert!(snapshot.active_session.is_none());
    }

    #[test]
    fn exit_rejects_old_and_locked_epochs_then_accepts_a_new_playback_epoch() {
        let mut coordinator = SourceCoordinator::default();
        establish_browser_playback(&mut coordinator);
        let source = embedded_source();
        coordinator.enter_embedded(source.clone()).unwrap();

        coordinator.apply_browser_message(cursor("browser-1", "video-1", 2, false), 11);
        coordinator.exit_embedded(&source).unwrap();

        for epoch in [1, 2] {
            let outcome =
                coordinator.apply_browser_message(cursor("browser-1", "video-1", epoch, false), 11);
            assert!(outcome.update.is_none());
            assert_eq!(coordinator.mode, SourceMode::Empty);
        }

        let outcome =
            coordinator.apply_browser_message(cursor("browser-1", "video-1", 3, false), 11);
        assert!(matches!(outcome.update, Some(UiUpdate::Snapshot(_))));
        assert_eq!(coordinator.mode, SourceMode::BrowserActive);
        assert_eq!(coordinator.current_source().unwrap().source_id, "11");
    }

    #[test]
    fn exit_accepts_new_video_and_autoplay_epochs_but_not_periodic_cursors() {
        for (session_id, video_id, epoch) in [
            ("browser-1", "video-1", 2),
            ("browser-1", "video-2", 1),
            ("browser-2", "video-3", 1),
        ] {
            let mut coordinator = SourceCoordinator::default();
            establish_browser_playback(&mut coordinator);
            let source = embedded_source();
            coordinator.enter_embedded(source.clone()).unwrap();
            coordinator.exit_embedded(&source).unwrap();

            if video_id != "video-1" || session_id != "browser-1" {
                coordinator.apply_browser_message(session(session_id, video_id), 11);
            }
            let outcome =
                coordinator.apply_browser_message(cursor(session_id, video_id, epoch, false), 11);
            assert!(outcome.update.is_some());
            assert_eq!(coordinator.mode, SourceMode::BrowserActive);
        }

        let mut coordinator = SourceCoordinator::default();
        establish_browser_playback(&mut coordinator);
        let source = embedded_source();
        coordinator.enter_embedded(source.clone()).unwrap();
        coordinator.exit_embedded(&source).unwrap();
        let periodic =
            coordinator.apply_browser_message(cursor("browser-1", "video-1", 1, false), 11);
        assert!(periodic.update.is_none());
        assert_eq!(coordinator.mode, SourceMode::Empty);
    }

    #[test]
    fn exit_accepts_a_new_browser_session_without_waiting_for_playback() {
        let mut coordinator = SourceCoordinator::default();
        establish_browser_playback(&mut coordinator);
        let source = embedded_source();
        coordinator.enter_embedded(source.clone()).unwrap();
        coordinator.exit_embedded(&source).unwrap();

        let outcome = coordinator.apply_browser_message(session("browser-refresh", "video-1"), 11);

        assert!(matches!(outcome.update, Some(UiUpdate::Snapshot(_))));
        assert_eq!(coordinator.mode, SourceMode::BrowserActive);
        assert_eq!(
            coordinator.snapshot().active_session.unwrap().session_id,
            "browser-refresh"
        );
    }

    #[test]
    fn exit_rejects_a_session_first_seen_while_embedded() {
        let mut coordinator = SourceCoordinator::default();
        establish_browser_playback(&mut coordinator);
        let source = embedded_source();
        coordinator.enter_embedded(source.clone()).unwrap();
        coordinator.apply_browser_message(session("browser-locked", "video-2"), 11);
        coordinator.exit_embedded(&source).unwrap();

        let outcome = coordinator.apply_browser_message(session("browser-locked", "video-2"), 11);

        assert!(outcome.update.is_none());
        assert_eq!(coordinator.mode, SourceMode::Empty);
    }
}
