/**
 * @purpose 前端侧的字幕/游标/会话/快照类型，与 Rust 的 serde 结构一一对应。
 * @role    App.tsx 与 Rust 事件之间的类型契约。
 * @deps    无
 * @gotcha  改字段必须同步 src-tauri/src/lib.rs 与扩展的 shared/nativeSubtitleProtocol.ts
 */
export interface SubtitleItem {
  id: number | string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface SubtitleTrack {
  languageCode: string;
  displayName: string;
  kind: "manual" | "asr";
}

export interface CursorState {
  sessionId: string;
  videoId: string;
  currentTime: number;
  currentIndex: number;
  isPaused: boolean;
  isAdPlaying: boolean;
  sentAt: number;
}

export interface SessionState {
  tabId: number;
  sessionId: string;
  videoId: string;
  title: string;
  identityStatus: "pending" | "verified" | "failed";
  status: "loading" | "ready" | "empty" | "error";
  error: string | null;
  track: SubtitleTrack | null;
  subtitles: SubtitleItem[];
  cursor: CursorState | null;
}

export interface PlayingCandidate {
  sessionId: string;
  tabId: number;
  videoId: string;
  title: string;
}

export interface ViewerSnapshot {
  connected: boolean;
  activeSession: SessionState | null;
  playingCandidates: PlayingCandidate[];
  playingSessionCount: number;
  selectedSessionId: string | null;
  selectionRequired: boolean;
}

export type UiUpdate =
  | { kind: "snapshot"; payload: ViewerSnapshot }
  | { kind: "cursor"; payload: CursorState };
