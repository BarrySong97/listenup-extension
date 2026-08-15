/**
 * @purpose 字幕加载 hook：把字幕、轨道与身份状态原子绑定到单个 videoId 快照。
 * @role    UI 与 subtitle-domain 之间的唯一桥梁。
 * @deps    react-i18next、lib/subtitle-domain/SubtitleRepository、AbortController
 * @gotcha  React effect 尚未运行时也必须同步返回新 videoId 的空快照，绝不能短暂暴露旧字幕
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  subtitleRepository,
  SubtitleLoadResult,
} from "../lib/subtitle-domain/SubtitleRepository";
import { CaptionTrackDescriptor } from "../lib/captions/types";
import { subtitleDebug } from "../lib/subtitle-domain/subtitleDebug";
import { SubtitleItem } from "../lib/subtitles/subtitleTypes";
import type { NativeSubtitleIdentityStatus } from "@src/shared/nativeSubtitleProtocol";
import { useTranslation } from "react-i18next";

interface UseSubtitlesOptions {
  enabled: boolean;
  videoId: string | null;
}

interface SubtitleSnapshot {
  videoId: string | null;
  subtitles: SubtitleItem[];
  track: CaptionTrackDescriptor | null;
  loading: boolean;
  error: string | null;
  identityStatus: NativeSubtitleIdentityStatus;
}

const EMPTY_SNAPSHOT: SubtitleSnapshot = {
  videoId: null,
  subtitles: [],
  track: null,
  loading: false,
  error: null,
  identityStatus: "pending",
};

export const useSubtitles = ({ enabled, videoId }: UseSubtitlesOptions) => {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<SubtitleSnapshot>(EMPTY_SNAPSHOT);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortControllerRef.current?.abort();

    if (!enabled || !videoId) {
      subtitleDebug.log(
        "skip load because subtitles are disabled or videoId is missing",
        {
          enabled,
          videoId,
        }
      );
      requestIdRef.current += 1;
      setSnapshot({
        ...EMPTY_SNAPSHOT,
        videoId,
      });
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setSnapshot({
      videoId,
      subtitles: [],
      track: null,
      loading: true,
      error: null,
      identityStatus: "pending",
    });
    subtitleDebug.log("start subtitle load", {
      requestId,
      enabled,
      videoId,
    });

    let result: SubtitleLoadResult;
    try {
      result = await subtitleRepository.load({
        enabled,
        videoId,
        signal: controller.signal,
      });
    } catch (loadError) {
      if (
        controller.signal.aborted ||
        requestId !== requestIdRef.current
      ) {
        subtitleDebug.log("ignore aborted subtitle identity retry", {
          requestId,
          videoId,
        });
        return;
      }

      const message =
        loadError instanceof Error ? loadError.message : "字幕加载失败";
      subtitleDebug.error("subtitle load threw unexpectedly", {
        requestId,
        videoId,
        message,
      });
      setSnapshot({
        videoId,
        subtitles: [],
        track: null,
        loading: false,
        error: message,
        identityStatus: "failed",
      });
      return;
    }

    if (requestId !== requestIdRef.current) {
      subtitleDebug.warn("discard stale subtitle load result", {
        requestId,
        currentRequestId: requestIdRef.current,
      });
      return;
    }

    if (result.ok) {
      subtitleDebug.log("subtitle load succeeded", {
        requestId,
        videoId,
        track: result.track,
        rawCount: result.rawSubtitles.length,
        processedCount: result.processedSubtitles.length,
        fromCache: result.fromCache,
      });
      setSnapshot({
        videoId,
        subtitles: result.processedSubtitles,
        track: result.track,
        loading: false,
        error: null,
        identityStatus: "verified",
      });
    } else {
      subtitleDebug.error("subtitle load failed", {
        requestId,
        videoId,
        code: result.code,
        message: result.message,
      });
      const hidesExpectedEmptyState =
        result.code === "NO_CAPTION_TRACKS" ||
        result.code === "NOT_WATCH_PAGE";
      setSnapshot({
        videoId,
        subtitles: [],
        track: null,
        loading: false,
        error: hidesExpectedEmptyState
          ? null
          : t(
              {
                PLAYER_NOT_READY: "subtitleErrors.playerNotReady",
                VIDEO_ID_MISMATCH: "subtitleErrors.videoMismatch",
                TRACK_SELECTION_FAILED: "subtitleErrors.trackSelectionFailed",
                NETWORK_ERROR: "subtitleErrors.networkError",
                PARSE_ERROR: "subtitleErrors.parseError",
                BRIDGE_TIMEOUT: "subtitleErrors.bridgeTimeout",
                UNSUPPORTED_SHAPE: "subtitleErrors.unsupportedShape",
              }[result.code] ?? "subtitleErrors.loadFailed"
            ),
        identityStatus:
          result.code === "NO_CAPTION_TRACKS" ? "verified" : "failed",
      });
    }
  }, [enabled, t, videoId]);

  useEffect(() => {
    void load();

    return () => {
      subtitleDebug.log("abort subtitle load on cleanup", {
        videoId,
      });
      requestIdRef.current += 1;
      abortControllerRef.current?.abort();
    };
  }, [load]);

  const effectiveSnapshot: SubtitleSnapshot =
    snapshot.videoId === videoId
      ? snapshot
      : {
          videoId,
          subtitles: [],
          track: null,
          loading: Boolean(enabled && videoId),
          error: null,
          identityStatus: "pending",
        };

  return {
    ...effectiveSnapshot,
    snapshotVideoId: effectiveSnapshot.videoId,
    refresh: load,
  };
};
