import { useEffect, useMemo, useRef } from "react";
import type { CaptionTrackDescriptor } from "../lib/captions/types";
import type { SubtitleItem } from "../lib/subtitles/subtitleTypes";
import {
  NATIVE_SUBTITLE_PROTOCOL_VERSION,
  NativeSubtitleCursorPayload,
  NativeSubtitleExtensionMessage,
  NativeSubtitleLoadStatus,
} from "@src/shared/nativeSubtitleProtocol";

interface UseNativeSubtitleBridgeOptions {
  videoId: string | null;
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
  loading: boolean,
  error: string | null,
  subtitles: SubtitleItem[]
): NativeSubtitleLoadStatus => {
  if (loading) return "loading";
  if (error) return "error";
  return subtitles.length > 0 ? "ready" : "empty";
};

export const useNativeSubtitleBridge = ({
  videoId,
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
  const hasSentReadySessionRef = useRef(false);

  useEffect(() => {
    hasSentReadySessionRef.current = false;
  }, [sessionId]);

  useEffect(() => {
    if (
      !videoId ||
      !sessionId ||
      isAdPlaying ||
      !hasNativeMessagingPermission()
    ) {
      return;
    }

    const status = resolveLoadStatus(loading, error, subtitles);
    if (status === "loading" && hasSentReadySessionRef.current) {
      return;
    }
    if (status === "ready") {
      hasSentReadySessionRef.current = true;
    }

    sendNativeBridgeMessage({
      type: "NATIVE_SUBTITLE_SESSION",
      payload: {
        version: NATIVE_SUBTITLE_PROTOCOL_VERSION,
        sessionId,
        videoId,
        title: document.title.replace(/\s+-\s+YouTube$/, ""),
        status,
        error,
        track: track
          ? {
              languageCode: track.languageCode,
              displayName: track.displayName,
              kind: track.kind,
            }
          : null,
        subtitles,
      },
    });
  }, [error, isAdPlaying, loading, sessionId, subtitles, track, videoId]);

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
