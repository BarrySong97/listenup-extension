/**
 * @purpose 把字幕 session 与播放游标发给 background，供桌面端同步。
 * @role    内容脚本侧的 Native Messaging 发送端。
 * @deps    src/shared/nativeSubtitleProtocol、chrome.runtime.sendMessage
 * @gotcha  只有与当前 videoId 一致且 verified 的快照能携带字幕；pending/failed 必须发送空内容
 */
import { useEffect, useMemo, useRef } from "react";
import type { CaptionTrackDescriptor } from "../lib/captions/types";
import type { SubtitleItem } from "../lib/subtitles/subtitleTypes";
import {
  NATIVE_SUBTITLE_PROTOCOL_VERSION,
  NativeSubtitleCursorPayload,
  NativeSubtitleExtensionMessage,
  NativeSubtitleIdentityStatus,
  NativeSubtitleLoadStatus,
} from "@src/shared/nativeSubtitleProtocol";

interface UseNativeSubtitleBridgeOptions {
  videoId: string | null;
  snapshotVideoId: string | null;
  identityStatus: NativeSubtitleIdentityStatus;
  subtitles: SubtitleItem[];
  track: CaptionTrackDescriptor | null;
  loading: boolean;
  error: string | null;
  currentTime: number;
  currentSubtitleIndex: number;
  isVideoPlaying: boolean;
  isAdPlaying: boolean;
}

const CURSOR_THROTTLE_MS = 250;

const hasNativeMessagingPermission = () =>
  chrome.runtime
    .getManifest()
    .permissions?.includes("nativeMessaging" as chrome.runtime.ManifestPermissions) ??
  false;

const sendNativeBridgeMessage = (message: NativeSubtitleExtensionMessage) => {
  if (!hasNativeMessagingPermission()) {
    return;
  }

  void chrome.runtime.sendMessage(message).catch(() => undefined);
};

const resolveLoadStatus = (
  identityStatus: NativeSubtitleIdentityStatus,
  loading: boolean,
  error: string | null,
  subtitles: SubtitleItem[]
): NativeSubtitleLoadStatus => {
  if (identityStatus === "pending") return "loading";
  if (identityStatus === "failed") return "error";
  if (loading) return "loading";
  if (error) return "error";
  return subtitles.length > 0 ? "ready" : "empty";
};

export const useNativeSubtitleBridge = ({
  videoId,
  snapshotVideoId,
  identityStatus,
  subtitles,
  track,
  loading,
  error,
  currentTime,
  currentSubtitleIndex,
  isVideoPlaying,
  isAdPlaying,
}: UseNativeSubtitleBridgeOptions) => {
  const sessionId = useMemo(
    () => (videoId ? crypto.randomUUID() : null),
    [videoId]
  );
  const latestCursorRef = useRef<NativeSubtitleCursorPayload | null>(null);
  const cursorTimerRef = useRef<number | null>(null);
  const lastCursorSentAtRef = useRef(0);
  const lastSubtitleIndexRef = useRef(-1);

  useEffect(() => {
    if (
      !videoId ||
      !sessionId ||
      isAdPlaying ||
      !hasNativeMessagingPermission()
    ) {
      return;
    }

    const isVerifiedSnapshot =
      identityStatus === "verified" && snapshotVideoId === videoId;
    const safeIdentityStatus =
      snapshotVideoId === videoId ? identityStatus : "pending";
    const safeSubtitles = isVerifiedSnapshot ? subtitles : [];
    const safeTrack = isVerifiedSnapshot ? track : null;
    const safeError =
      safeIdentityStatus === "failed" && snapshotVideoId === videoId
        ? error
        : null;
    const status = resolveLoadStatus(
      safeIdentityStatus,
      loading,
      safeError,
      safeSubtitles
    );

    sendNativeBridgeMessage({
      type: "NATIVE_SUBTITLE_SESSION",
      payload: {
        version: NATIVE_SUBTITLE_PROTOCOL_VERSION,
        sessionId,
        videoId,
        title: document.title.replace(/\s+-\s+YouTube$/, ""),
        identityStatus: safeIdentityStatus,
        status,
        error: safeError,
        track: safeTrack
          ? {
              languageCode: safeTrack.languageCode,
              displayName: safeTrack.displayName,
              kind: safeTrack.kind,
            }
          : null,
        subtitles: safeSubtitles,
      },
    });
  }, [
    error,
    identityStatus,
    isAdPlaying,
    loading,
    sessionId,
    snapshotVideoId,
    subtitles,
    track,
    videoId,
  ]);

  useEffect(() => {
    if (!videoId || !sessionId || !hasNativeMessagingPermission()) {
      return;
    }

    return () => {
      sendNativeBridgeMessage({
        type: "NATIVE_SUBTITLE_END",
        payload: {
          version: NATIVE_SUBTITLE_PROTOCOL_VERSION,
          sessionId,
          videoId,
        },
      });
    };
  }, [sessionId, videoId]);

  useEffect(() => {
    if (!videoId || !sessionId || !hasNativeMessagingPermission()) {
      return;
    }

    latestCursorRef.current = {
      version: NATIVE_SUBTITLE_PROTOCOL_VERSION,
      sessionId,
      videoId,
      currentTime,
      currentIndex: currentSubtitleIndex,
      isPaused: !isVideoPlaying,
      isAdPlaying,
      sentAt: Date.now(),
    };

    const flushCursor = () => {
      cursorTimerRef.current = null;
      const cursor = latestCursorRef.current;
      if (!cursor) return;

      lastCursorSentAtRef.current = performance.now();
      lastSubtitleIndexRef.current = cursor.currentIndex;
      sendNativeBridgeMessage({
        type: "NATIVE_SUBTITLE_CURSOR",
        payload: cursor,
      });
    };

    const indexChanged = lastSubtitleIndexRef.current !== currentSubtitleIndex;
    const elapsed = performance.now() - lastCursorSentAtRef.current;
    if (indexChanged || elapsed >= CURSOR_THROTTLE_MS) {
      if (cursorTimerRef.current !== null) {
        window.clearTimeout(cursorTimerRef.current);
      }
      flushCursor();
      return;
    }

    if (cursorTimerRef.current === null) {
      cursorTimerRef.current = window.setTimeout(
        flushCursor,
        CURSOR_THROTTLE_MS - elapsed
      );
    }
  }, [
    currentSubtitleIndex,
    currentTime,
    isAdPlaying,
    isVideoPlaying,
    sessionId,
    videoId,
  ]);

  useEffect(
    () => () => {
      if (cursorTimerRef.current !== null) {
        window.clearTimeout(cursorTimerRef.current);
      }
    },
    []
  );
};
