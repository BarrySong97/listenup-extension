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
  status: "loading" | "ready" | "empty" | "error";
  error: string | null;
  track: SubtitleTrack | null;
  subtitles: SubtitleItem[];
  cursor: CursorState | null;
}

export interface ViewerSnapshot {
  connected: boolean;
  activeSession: SessionState | null;
}

export type UiUpdate =
  | { kind: "session"; payload: SessionState | null }
  | { kind: "cursor"; payload: CursorState };
