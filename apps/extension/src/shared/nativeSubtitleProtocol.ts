import type { SubtitleItem } from "@pages/content/lib/subtitles/subtitleTypes";

export const NATIVE_SUBTITLE_HOST = "com.listenup.native_subtitle_demo";
export const NATIVE_SUBTITLE_PROTOCOL_VERSION = 1 as const;

export type NativeSubtitleLoadStatus =
  | "loading"
  | "ready"
  | "empty"
  | "error";

export interface NativeSubtitleTrack {
  languageCode: string;
  displayName: string;
  kind: "manual" | "asr";
}

export interface NativeSubtitleSessionPayload {
  version: typeof NATIVE_SUBTITLE_PROTOCOL_VERSION;
  sessionId: string;
  videoId: string;
  title: string;
  status: NativeSubtitleLoadStatus;
  error: string | null;
  track: NativeSubtitleTrack | null;
  subtitles: SubtitleItem[];
}

export interface NativeSubtitleCursorPayload {
  version: typeof NATIVE_SUBTITLE_PROTOCOL_VERSION;
  sessionId: string;
  videoId: string;
  currentTime: number;
  currentIndex: number;
  isPaused: boolean;
  isAdPlaying: boolean;
  sentAt: number;
}

export interface NativeSubtitleEndPayload {
  version: typeof NATIVE_SUBTITLE_PROTOCOL_VERSION;
  sessionId: string;
  videoId: string;
}

export type NativeSubtitleExtensionMessage =
  | {
      type: "NATIVE_SUBTITLE_SESSION";
      payload: NativeSubtitleSessionPayload;
    }
  | {
      type: "NATIVE_SUBTITLE_CURSOR";
      payload: NativeSubtitleCursorPayload;
    }
  | {
      type: "NATIVE_SUBTITLE_END";
      payload: NativeSubtitleEndPayload;
    };

export type NativeSubtitleHostMessage =
  | ({ kind: "session"; tabId: number } & NativeSubtitleSessionPayload)
  | ({ kind: "cursor"; tabId: number } & NativeSubtitleCursorPayload)
  | ({ kind: "end"; tabId: number } & NativeSubtitleEndPayload);

export const isNativeSubtitleExtensionMessage = (
  value: unknown
): value is NativeSubtitleExtensionMessage => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const type = (value as { type?: unknown }).type;
  return (
    type === "NATIVE_SUBTITLE_SESSION" ||
    type === "NATIVE_SUBTITLE_CURSOR" ||
    type === "NATIVE_SUBTITLE_END"
  );
};
