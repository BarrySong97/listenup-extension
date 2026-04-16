import { useCallback, useEffect, useRef, useState } from "react";
import {
  subtitleRepository,
  SubtitleLoadResult,
} from "../lib/subtitle-domain/SubtitleRepository";
import { CaptionTrackDescriptor } from "../lib/captions/types";
import { subtitleDebug } from "../lib/subtitle-domain/subtitleDebug";
import { SubtitleItem } from "../lib/subtitles/subtitleTypes";

interface UseSubtitlesOptions {
  enabled: boolean;
  videoId: string | null;
}

export const useSubtitles = ({ enabled, videoId }: UseSubtitlesOptions) => {
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [track, setTrack] = useState<CaptionTrackDescriptor | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setSubtitles([]);
      setTrack(null);
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    subtitleDebug.log("start subtitle load", {
      requestId,
      enabled,
      videoId,
    });

    const result: SubtitleLoadResult = await subtitleRepository.load({
      enabled,
      videoId,
      signal: controller.signal,
    });

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
      setSubtitles(result.processedSubtitles);
      setTrack(result.track);
      setError(null);
    } else {
      subtitleDebug.error("subtitle load failed", {
        requestId,
        videoId,
        code: result.code,
        message: result.message,
      });
      setSubtitles([]);
      setTrack(null);
      if (
        result.code === "NO_CAPTION_TRACKS" ||
        result.code === "NOT_WATCH_PAGE"
      ) {
        setError(null);
      } else {
        setError(result.message);
      }
    }

    setLoading(false);
  }, [enabled, videoId]);

  useEffect(() => {
    void load();

    return () => {
      subtitleDebug.log("abort subtitle load on cleanup", {
        videoId,
      });
      abortControllerRef.current?.abort();
    };
  }, [load]);

  return {
    subtitles,
    track,
    loading,
    error,
    refresh: load,
  };
};
