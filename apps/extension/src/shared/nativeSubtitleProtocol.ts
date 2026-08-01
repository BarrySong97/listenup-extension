/**
 * @purpose 扩展与桌面端之间 Native Messaging 的消息契约、host 名与深链接。
 * @role    内容脚本、background 与桌面端 Rust 三方对齐的唯一权威。
 * @deps    构建期环境常量、content 的 SubtitleItem 类型
 * @gotcha  v3 的 verified track 必须携带 vssId/isDefault；改字段必须同步 Rust 端。见 docs/topics/native-messaging.md
 */
import type { SubtitleItem } from "@pages/content/lib/subtitles/subtitleTypes";

// dev 和 production 功能相同，但连接不同 Host / app，避免跨环境串线。
export const NATIVE_SUBTITLE_HOST = __LISTENUP_NATIVE_HOST__;
export const DESKTOP_DEEP_LINK = __LISTENUP_DEEP_LINK__;
export const NATIVE_SUBTITLE_PROTOCOL_VERSION = 3 as const;

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
