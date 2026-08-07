/**
 * @purpose 扩展与桌面端之间双向 Native Messaging v4 契约、host 名与深链接。
 * @role    内容脚本、background 与桌面端 Rust 三方对齐的唯一权威。
 * @deps    构建期环境常量、content 的 SubtitleItem 类型
 * @gotcha  playback command 必须带 command/session/video/tab 身份；seek 还必须带有限非负时间。改字段必须同步 background、content 与 Rust。
 */
import type { SubtitleItem } from "@pages/content/lib/subtitles/subtitleTypes";

// dev 和 production 功能相同，但连接不同 Host / app，避免跨环境串线。
export const NATIVE_SUBTITLE_HOST =
  typeof __LISTENUP_NATIVE_HOST__ === "string" ? __LISTENUP_NATIVE_HOST__ : "";
export const DESKTOP_DEEP_LINK =
  typeof __LISTENUP_DEEP_LINK__ === "string" ? __LISTENUP_DEEP_LINK__ : "";
export const NATIVE_SUBTITLE_PROTOCOL_VERSION = 4 as const;

export type NativeSubtitleIdentityStatus = "pending" | "verified" | "failed";

export type NativeSubtitleLoadStatus =
  | "loading"
  | "ready"
  | "empty"
  | "error";

export interface NativeSubtitleTrack {
  languageCode: string;
  displayName: string;
  kind: "manual" | "asr";
  vssId: string;
  isDefault: boolean;
}

export interface NativeSubtitleSessionPayload {
  version: typeof NATIVE_SUBTITLE_PROTOCOL_VERSION;
  sessionId: string;
  videoId: string;
  title: string;
  identityStatus: NativeSubtitleIdentityStatus;
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

export type NativeSubtitlePlaybackAction = "play" | "pause" | "seek";

interface NativeSubtitlePlaybackCommandBase {
  kind: "playbackCommand";
  version: typeof NATIVE_SUBTITLE_PROTOCOL_VERSION;
  commandId: string;
  tabId: number;
  sessionId: string;
  videoId: string;
}

export type NativeSubtitlePlaybackCommand =
  | (NativeSubtitlePlaybackCommandBase & {
      action: "play" | "pause";
      seekTime?: never;
    })
  | (NativeSubtitlePlaybackCommandBase & {
      action: "seek";
      seekTime: number;
    });

export interface NativeSubtitlePlaybackCommandResultPayload {
  version: typeof NATIVE_SUBTITLE_PROTOCOL_VERSION;
  commandId: string;
  sessionId: string;
  videoId: string;
  ok: boolean;
  error: string | null;
}

export interface NativeSubtitlePlaybackContentMessage {
  type: "NATIVE_PLAYBACK_COMMAND";
  payload: NativeSubtitlePlaybackCommand;
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
    }
  | {
      type: "NATIVE_PLAYBACK_COMMAND_RESULT";
      payload: NativeSubtitlePlaybackCommandResultPayload;
    };

export type NativeSubtitleHostMessage =
  | ({ kind: "session"; tabId: number } & NativeSubtitleSessionPayload)
  | ({ kind: "cursor"; tabId: number } & NativeSubtitleCursorPayload)
  | ({ kind: "end"; tabId: number } & NativeSubtitleEndPayload)
  | ({ kind: "playbackCommandResult"; tabId: number } &
      NativeSubtitlePlaybackCommandResultPayload);

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

export const isNativeSubtitlePlaybackCommand = (
  value: unknown
): value is NativeSubtitlePlaybackCommand => {
  if (!isObject(value)) return false;
  const hasValidAction =
    value.action === "seek"
      ? typeof value.seekTime === "number" &&
        Number.isFinite(value.seekTime) &&
        value.seekTime >= 0
      : (value.action === "play" || value.action === "pause") &&
        (value.seekTime === undefined || value.seekTime === null);
  return (
    value.kind === "playbackCommand" &&
    value.version === NATIVE_SUBTITLE_PROTOCOL_VERSION &&
    typeof value.commandId === "string" &&
    typeof value.tabId === "number" &&
    Number.isInteger(value.tabId) &&
    typeof value.sessionId === "string" &&
    typeof value.videoId === "string" &&
    hasValidAction
  );
};

export const isNativeSubtitlePlaybackContentMessage = (
  value: unknown
): value is NativeSubtitlePlaybackContentMessage =>
  isObject(value) &&
  value.type === "NATIVE_PLAYBACK_COMMAND" &&
  isNativeSubtitlePlaybackCommand(value.payload);

export const isNativeSubtitleExtensionMessage = (
  value: unknown
): value is NativeSubtitleExtensionMessage => {
  if (!isObject(value)) {
    return false;
  }

  const type = (value as { type?: unknown }).type;
  return (
    type === "NATIVE_SUBTITLE_SESSION" ||
    type === "NATIVE_SUBTITLE_CURSOR" ||
    type === "NATIVE_SUBTITLE_END" ||
    type === "NATIVE_PLAYBACK_COMMAND_RESULT"
  );
};
