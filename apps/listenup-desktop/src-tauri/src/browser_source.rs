// @purpose 封装由浏览器扩展提供的字幕会话、播放候选仲裁与反向控制目标解析。
// @role    作为桌面端浏览器来源的影子状态；上层 SourceCoordinator 决定它何时可影响 UI/持久化。
// @deps    Native Messaging v5 消息与桌面端共享字幕类型
// @gotcha  候选顺序必须稳定；bridgeId 是控制路由的一部分；同一 bridge + tab 的新 session 必须替换旧 session。

use std::collections::HashMap;

use super::{
    source_coordinator::{BrowserPauseState, SourceMode},
    CursorState, NativeMessage, PlayingCandidate, SessionState, UiUpdate, ViewerSnapshot,
    PROTOCOL_VERSION,
};

#[derive(Default)]
pub(crate) struct BrowserSourceStore {
    pub(crate) connected: bool,
    pub(crate) bridge_connections: usize,
    pub(crate) sessions: HashMap<String, SessionState>,
    pub(crate) active_session_id: Option<String>,
    pub(crate) manually_selected_session_id: Option<String>,
    sequence: u64,
}

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct PlaybackTarget {
    pub(crate) bridge_id: u64,
    pub(crate) tab_id: i64,
    pub(crate) session_id: String,
    pub(crate) video_id: String,
}

impl BrowserSourceStore {
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

    pub(crate) fn snapshot(&self) -> ViewerSnapshot {
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
            source_mode: if self.sessions.is_empty() {
                SourceMode::Empty
            } else {
                SourceMode::BrowserActive
            },
            source: None,
            browser_pause_state: BrowserPauseState::NotNeeded,
            awaiting_browser_playback: false,
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

    pub(crate) fn playback_target(&self) -> Result<PlaybackTarget, String> {
        let session_id = self
            .active_session_id
            .as_ref()
            .ok_or_else(|| "当前没有可控制的 YouTube 视频".to_string())?;
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| "当前播放会话已经失效".to_string())?;
        let cursor = session
            .cursor
            .as_ref()
            .ok_or_else(|| "正在等待播放器状态".to_string())?;
        if cursor.is_ad_playing {
            return Err("广告播放期间不能控制正片".to_string());
        }
        if session.identity_status != "verified" {
            return Err("正在确认播放会话".to_string());
        }
        Ok(PlaybackTarget {
            bridge_id: session.bridge_id,
            tab_id: session.tab_id,
            session_id: session.session_id.clone(),
            video_id: session.video_id.clone(),
        })
    }

    #[cfg(test)]
    pub(crate) fn apply(&mut self, message: NativeMessage) -> Option<UiUpdate> {
        self.apply_from_bridge(message, 1)
    }

    pub(crate) fn apply_from_bridge(
        &mut self,
        message: NativeMessage,
        bridge_id: u64,
    ) -> Option<UiUpdate> {
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
                self.sessions.retain(|_, existing| {
                    existing.bridge_id != bridge_id || existing.tab_id != tab_id
                });
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
                    bridge_id,
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
                playback_epoch,
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
                    playback_epoch,
                    current_time,
                    current_index,
                    is_paused,
                    is_ad_playing,
                    sent_at,
                };
                let before = self.snapshot();
                let order = self.next_sequence();
                let session = self.sessions.get_mut(&session_id)?;
                if session.bridge_id != bridge_id
                    || session.tab_id != tab_id
                    || session.video_id != video_id
                {
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
                    session.bridge_id == bridge_id
                        && session.tab_id == tab_id
                        && session.video_id == video_id
                });
                if !should_remove {
                    return None;
                }

                self.sessions.remove(&session_id);
                self.reconcile_active_session();
                Some(UiUpdate::Snapshot(self.snapshot()))
            }
            NativeMessage::PlaybackCommandResult { .. } => None,
        }
    }

    pub(crate) fn select_session(&mut self, session_id: &str) -> Result<ViewerSnapshot, String> {
        let selectable_ids = self.selectable_session_ids();
        if selectable_ids.len() < 2 || !selectable_ids.iter().any(|id| id == session_id) {
            return Err("所选视频已不再是可用的播放候选".to_string());
        }

        self.manually_selected_session_id = Some(session_id.to_string());
        self.reconcile_active_session();
        Ok(self.snapshot())
    }
}
