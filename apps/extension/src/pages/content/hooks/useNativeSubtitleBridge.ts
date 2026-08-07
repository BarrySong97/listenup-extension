/**
 * @purpose 把字幕/cursor 发给 Desktop，处理精确绑定当前 session 的反向播放与字幕 seek 命令。
 * @role    内容脚本侧的 Native Messaging 发送端。
 * @deps    src/shared/nativeSubtitleProtocol、nativeCursorScheduler、youtubeSDK、chrome.runtime
 * @gotcha  反向命令必须同时校验 tab 外的 session/video/广告态；失败不可尝试控制其他播放器。
 */
import { useEffect, useMemo, useRef } from "react";
import type { CaptionTrackDescriptor } from "../lib/captions/types";
import type { SubtitleItem } from "../lib/subtitles/subtitleTypes";
import {
  isNativeSubtitlePlaybackContentMessage,
  NATIVE_SUBTITLE_PROTOCOL_VERSION,
  NativeSubtitleCursorPayload,
  NativeSubtitleExtensionMessage,
  NativeSubtitleIdentityStatus,
  NativeSubtitleLoadStatus,
} from "@src/shared/nativeSubtitleProtocol";
import {
  NATIVE_CURSOR_THROTTLE_MS,
  NativeCursorScheduler,
} from "./nativeCursorScheduler";
import { youtubeSDK } from "../lib/youtube-sdk";

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
  cursorForceRevision: number;
}

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
  cursorForceRevision,
}: UseNativeSubtitleBridgeOptions) => {
  const sessionId = useMemo(
    () => (videoId ? crypto.randomUUID() : null),
    [videoId]
  );
  const lastForceRevisionRef = useRef(cursorForceRevision);
  const cursorSchedulerRef = useRef<NativeCursorScheduler | null>(null);
  if (!cursorSchedulerRef.current) {
    cursorSchedulerRef.current = new NativeCursorScheduler({
      throttleMs: NATIVE_CURSOR_THROTTLE_MS,
      now: () => performance.now(),
      schedule: (callback, delayMs) => {
        const timer = window.setTimeout(callback, delayMs);
        return { cancel: () => window.clearTimeout(timer) };
      },
      send: (cursor) => {
        sendNativeBridgeMessage({
          type: "NATIVE_SUBTITLE_CURSOR",
          payload: cursor,
        });
      },
    });
  }

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
              vssId: safeTrack.vssId,
              isDefault: safeTrack.isDefault,
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
    if (!videoId || !sessionId) return;

    const handlePlaybackCommand = (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void
    ) => {
      if (!isNativeSubtitlePlaybackContentMessage(message)) return undefined;
      const command = message.payload;
      const respond = (ok: boolean, commandError: string | null) =>
        sendResponse({
          commandId: command.commandId,
          sessionId: command.sessionId,
          videoId: command.videoId,
          ok,
          error: commandError,
        });

      if (command.sessionId !== sessionId || command.videoId !== videoId) {
        respond(false, "播放会话已经变化");
        return undefined;
      }
      if (isAdPlaying) {
        respond(false, "广告播放期间不能控制正片");
        return undefined;
      }

      const player = youtubeSDK.getPlayerFacade();
      const operation =
        command.action === "seek"
          ? player.seekTo(command.seekTime)
            ? Promise.resolve()
            : Promise.reject(new Error("YouTube 播放器无法跳转"))
          : player.controlPlayback(command.action);

      void operation
        .then(() => respond(true, null))
        .catch((commandError: unknown) =>
          respond(
            false,
            commandError instanceof Error
              ? commandError.message
              : "播放控制失败"
          )
        );
      return true;
    };

    chrome.runtime.onMessage.addListener(handlePlaybackCommand);
    return () => chrome.runtime.onMessage.removeListener(handlePlaybackCommand);
  }, [isAdPlaying, sessionId, videoId]);

  useEffect(() => {
    if (!videoId || !sessionId || !hasNativeMessagingPermission()) {
      return;
    }

    const cursor: NativeSubtitleCursorPayload = {
      version: NATIVE_SUBTITLE_PROTOCOL_VERSION,
      sessionId,
      videoId,
      currentTime,
      currentIndex: currentSubtitleIndex,
      isPaused: !isVideoPlaying,
      isAdPlaying,
      sentAt: Date.now(),
    };
    const force = lastForceRevisionRef.current !== cursorForceRevision;
    lastForceRevisionRef.current = cursorForceRevision;
    cursorSchedulerRef.current?.update(cursor, { force });
  }, [
    cursorForceRevision,
    currentSubtitleIndex,
    currentTime,
    isAdPlaying,
    isVideoPlaying,
    sessionId,
    videoId,
  ]);

  useEffect(
    () => () => {
      cursorSchedulerRef.current?.dispose();
      cursorSchedulerRef.current = null;
    },
    []
  );
};
