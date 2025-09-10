import { useState, useEffect, useCallback } from "react";
import { SubtitleItem } from "../lib/subtitles/subtitleTypes";
import { subtitleFetcher } from "../lib/subtitles/subtitleFetcher";
import { SubtitleMerger } from "../lib/subtitles/subtitleMerger";
import { SubtitleCleaner } from "../lib/subtitles/subtitleCleaner";
import { subtitleConfig } from "../lib/subtitles/subtitleConfig";
import { YouTubeSDK } from "../lib/youtube-sdk/YouTubeSDK";

/**
 * 字幕内容管理钩子
 * 处理字幕数据的加载、解析和状态管理
 */
export const useSubtitleContent = (url?: string) => {
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const youtubeSDK = new YouTubeSDK();

  // 处理字幕内容
  const processSubtitleContent = useCallback(
    async (content: string) => {
      await subtitleFetcher.processSubtitleContent(
        content,
        async (parsedSubs) => {
          // 第一步：清理字幕内容
          const cleanConfig = subtitleConfig.getCleanConfig();
          const cleaner = new SubtitleCleaner(cleanConfig);
          const cleanedSubs = cleaner.cleanSubtitles(parsedSubs);

          setSubtitles(cleanedSubs);
          setError(null);

          // 缓存字幕到 storage
          const videoId = youtubeSDK.getVideoId();
          if (videoId && cleanedSubs.length > 0) {
            try {
              await chrome.storage.local.set({
                [`subtitle_${videoId}`]: {
                  subtitles: cleanedSubs,
                  timestamp: Date.now(),
                },
              });
            } catch (error) {
              console.error("Failed to cache subtitles:", error);
            }
          }
        },
        (errorMsg) => {
          setError(errorMsg);
        }
      );
    },
    [youtubeSDK]
  );

  // 清理字幕状态的函数
  const clearSubtitles = useCallback(() => {
    setSubtitles([]);
    setLoading(false);
    setError(null);
  }, []);

  const fetchSubtitleContent = async (url: string) => {
    const videoId = youtubeSDK.getVideoId();

    // 首先检查缓存
    if (videoId) {
      try {
        setLoading(true);
        const cache = await chrome.storage.local.get(`subtitle_${videoId}`);
        const cachedData = cache[`subtitle_${videoId}`];

        if (cachedData && cachedData.subtitles) {
          // 使用缓存的字幕
          setSubtitles(cachedData.subtitles);
          setError(null);
          return;
        }
      } catch (error) {
        console.error("Failed to get cached subtitles:", error);
        setError("Failed to get cached subtitles");
      } finally {
        setLoading(false);
      }
    }

    // 如果没有缓存，从URL获取
    try {
      setLoading(true);
      const subtitleContents = await fetch(url);
      const text = await subtitleContents.text();
      processSubtitleContent(text);
    } catch (error) {
      setError("Failed to fetch subtitles");
    } finally {
      setLoading(false);
    }
  };

  // 监听来自background的字幕消息（保留作为备用）
  useEffect(() => {
    if (url) {
      fetchSubtitleContent(url);
    }
  }, [url]);

  return {
    subtitles,
    loading,
    error,
    setLoading,
    setError,
    clearSubtitles,
  };
};
