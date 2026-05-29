import { useCallback, useEffect, useRef, useState } from "react";
import {
  AiSettings,
  loadAiSettings,
  subscribeAiSettings,
} from "@src/services/ai/aiSettings";
import {
  MissingApiKeyError,
  fetchExplain,
} from "@src/services/ai/explainClient";
import {
  buildExplainCacheKey,
  getCachedExplain,
  setCachedExplain,
} from "@src/services/ai/explainCache";
import { ExplainResult } from "@src/services/ai/explainSchema";
import {
  ImageSearchResult,
  searchImages,
} from "@src/services/search/imageSearch";
import {
  buildImageCacheKey,
  getCachedImages,
  setCachedImages,
} from "@src/services/search/imageSearchCache";

export interface ExplainTarget {
  text: string;
  context: string;
  videoId: string | null;
}

export interface UseExplainState {
  target: ExplainTarget | null;
  loading: boolean;
  data: ExplainResult | null;
  error: string | null;
  streamText: string;
  images: ImageSearchResult[];
  imagesLoading: boolean;
  settings: AiSettings | null;
  refresh: () => void;
}

export function useExplain(target: ExplainTarget | null): UseExplainState {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [data, setData] = useState<ExplainResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamText, setStreamText] = useState("");
  const [images, setImages] = useState<ImageSearchResult[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const latestRunRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    loadAiSettings().then((s) => {
      if (!cancelled) setSettings(s);
    });
    const unsubscribe = subscribeAiSettings(setSettings);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!target || !settings) {
      setData(null);
      setError(null);
      setStreamText("");
      setImages([]);
      setLoading(false);
      setImagesLoading(false);
      return;
    }

    const runId = ++latestRunRef.current;
    const forceRefresh = reloadNonce > 0;
    const abortController = new AbortController();

    setLoading(true);
    setError(null);
    setData(null);
    setStreamText("");
    setImages([]);

    (async () => {
      const cacheKey = buildExplainCacheKey({
        videoId: target.videoId,
        text: target.text,
        model: settings.model,
      });

      if (!forceRefresh) {
        const cached = await getCachedExplain(cacheKey);
        if (cached && latestRunRef.current === runId) {
          setData(cached);
          setStreamText("");
          setLoading(false);
          return;
        }
      }

      try {
        const result = await fetchExplain(settings, {
          selectedText: target.text,
          context: target.context,
        }, {
          abortSignal: abortController.signal,
          onStreamText: (nextText) => {
            if (latestRunRef.current !== runId) {
              return;
            }

            setStreamText(nextText);
          },
        });
        if (latestRunRef.current !== runId) return;
        setData(result);
        setStreamText("");
        setCachedExplain(cacheKey, result).catch(() => undefined);
      } catch (err) {
        if (latestRunRef.current !== runId) return;
        if (abortController.signal.aborted) {
          return;
        }
        if (err instanceof MissingApiKeyError) {
          setError(err.message);
        } else {
          setError((err as Error)?.message ?? "Failed to get explanation");
        }
      } finally {
        if (latestRunRef.current === runId) {
          setLoading(false);
        }
      }
    })();

    (async () => {
      setImagesLoading(true);
      const imageKey = buildImageCacheKey(settings.imageSearchEngine, target.text);
      if (!forceRefresh) {
        const cached = await getCachedImages(imageKey);
        if (cached && cached.length > 0 && latestRunRef.current === runId) {
          setImages(cached);
          setImagesLoading(false);
          return;
        }
      }
      const results = await searchImages(
        settings.imageSearchEngine,
        target.text,
        8
      );
      if (latestRunRef.current !== runId) return;
      setImages(results);
      setImagesLoading(false);
      if (results.length > 0) {
        setCachedImages(imageKey, results).catch(() => undefined);
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [target?.text, target?.context, settings, reloadNonce]);

  const refresh = useCallback(() => {
    setReloadNonce((n) => n + 1);
  }, []);

  return {
    target,
    loading,
    data,
    error,
    streamText,
    images,
    imagesLoading,
    settings,
    refresh,
  };
}
