/**
 * @purpose 前端侧的实时会话与 SQLite 字幕视图类型，与 Rust serde 结构一一对应。
 * @role    App.tsx、React Query 和 Rust command/event 之间的类型契约。
 * @deps    无
 * @gotcha  v3 track 含 vssId/isDefault；改字段必须同步 Rust 与扩展协议。
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

export type SubtitleDisplayMode = "source" | "translation" | "bilingual";

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
