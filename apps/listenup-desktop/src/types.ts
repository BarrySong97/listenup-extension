/**
 * @purpose 前端侧实时会话、播放控制、appMode 与 SQLite 字幕视图类型契约。
 * @role    App.tsx、React Query 和 Rust command/event 之间的类型契约。
 * @deps    无
 * @gotcha  Native v5 playbackEpoch 与 Rust serde 必须同步；appMode 是 Rust 持久化的唯一权威。
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
  vssId: string;
  isDefault: boolean;
}

export interface CursorState {
  sessionId: string;
  videoId: string;
  playbackEpoch: number;
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
  sourceMode: "empty" | "browserActive" | "enteringEmbedded" | "embeddedActive" | "embeddedRecovering";
  source: {
    kind: "browser" | "embedded";
    sourceId: string;
    sessionId: string;
    videoId: string;
  } | null;
  browserPauseState:
    | "notNeeded"
    | "pending"
    | "succeeded"
    | "timedOut"
    | { failed: string };
  awaitingBrowserPlayback: boolean;
  activeSession: SessionState | null;
  playingCandidates: PlayingCandidate[];
  playingSessionCount: number;
  selectedSessionId: string | null;
  selectionRequired: boolean;
}

export type UiUpdate =
  | { kind: "snapshot"; payload: ViewerSnapshot }
  | { kind: "cursor"; payload: CursorState };

export type SubtitleDisplayMode = "source" | "translation" | "bilingual";
export type AppMode = "desktop" | "menubar";

export interface StoredSourceSegment {
  id: string;
  ordinal: number;
  startTimeMs: number;
  endTimeMs: number;
  text: string;
}

export interface StoredSourceTrack {
  videoId: string;
  title: string;
  trackId: string;
  revision: string;
  languageCode: string;
  displayName: string;
  kind: "manual" | "asr";
  vssId: string;
  isDefault: boolean;
  segments: StoredSourceSegment[];
}

export interface TranslationSummary {
  languageCode: string;
  displayName: string;
  generator: string | null;
  updatedAt: string;
}

export interface StoredTranslationSegment {
  id: string;
  ordinal: number;
  sourceSegmentIds: string[];
  startTimeMs: number;
  endTimeMs: number;
  sourceText: string;
  text: string;
}

export interface StoredTranslation {
  languageCode: string;
  displayName: string;
  generator: string | null;
  segments: StoredTranslationSegment[];
}

export interface SubtitleView {
  source: StoredSourceTrack;
  translations: TranslationSummary[];
  translation: StoredTranslation | null;
}
