import { useState, useEffect, useCallback } from "react";
import { SubtitleItem } from "@src/lib/subtitleTypes";
import { subtitleFetcher } from "@src/lib/subtitleFetcher";
import { SubtitleMerger } from "@src/lib/subtitleMerger";
import { SubtitleCleaner } from "@src/lib/subtitleCleaner";
import { subtitleConfig } from "@src/lib/subtitleConfig";

/**
 * 字幕内容管理钩子
 * 处理字幕数据的加载、解析和状态管理
 */
export const useSubtitleContent = () => {
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 处理字幕内容
  const processSubtitleContent = useCallback(async (content: string) => {
    await subtitleFetcher.processSubtitleContent(
      content,
      (parsedSubs) => {
        // 第一步：清理字幕内容
        const cleanConfig = subtitleConfig.getCleanConfig();
        const cleaner = new SubtitleCleaner(cleanConfig);
        const cleanedSubs = cleaner.cleanSubtitles(parsedSubs);

        // 输出清理统计信息
        const cleanStats = cleaner.getCleanStats(parsedSubs, cleanedSubs);

        // 暂时禁用合并功能，专注解决点击overlap问题
        // TODO: 稍后重新启用合并功能

        setSubtitles(cleanedSubs);
        setError(null);
      },
      (errorMsg) => {
        setError(errorMsg);
      }
    );
  }, []);

  // 清理字幕状态的函数
  const clearSubtitles = useCallback(() => {
    setSubtitles([]);
    setLoading(false);
    setError(null);
  }, []);

  // 处理直接获取的字幕数据
  const handleDirectSubtitles = useCallback(
    (subtitles: SubtitleItem[], reason?: string) => {
      // 第一步：清理字幕内容
      const cleanConfig = subtitleConfig.getCleanConfig();
      const cleaner = new SubtitleCleaner(cleanConfig);
      const cleanedSubs = cleaner.cleanSubtitles(subtitles);

      // 输出清理统计信息
      const cleanStats = cleaner.getCleanStats(subtitles, cleanedSubs);

      setSubtitles(cleanedSubs);
      setError(null);
      setLoading(false);
    },
    []
  );

  // 监听来自content script的直接字幕事件
  useEffect(() => {
    const handleDirectSubtitleEvent = (event: CustomEvent) => {
      const { detail } = event;
      if (
        detail.type === "SUBTITLE_CONTENT_READY" &&
        detail.source === "direct"
      ) {
        handleDirectSubtitles(detail.subtitles, detail.reason);
      }
    };

    window.addEventListener(
      "subtitle-content-ready",
      handleDirectSubtitleEvent as EventListener
    );

    return () => {
      window.removeEventListener(
        "subtitle-content-ready",
        handleDirectSubtitleEvent as EventListener
      );
    };
  }, [handleDirectSubtitles]);

  // 监听来自background的字幕消息（保留作为备用）
  useEffect(() => {
    const messageListener = (message: any, sender: any, sendResponse: any) => {
      if (message.type === "SUBTITLE_REQUEST_START") {
        setLoading(true);
        setError(null);
      } else if (message.type === "SUBTITLE_CONTENT_READY") {
        setLoading(false);
        // 直接处理字幕内容
        processSubtitleContent(message.content);
      } else if (message.type === "SUBTITLE_CONTENT_FALLBACK") {
        // 检查是否已经有字幕数据（直接获取成功）
        if (subtitles.length === 0) {
          setLoading(false);
          processSubtitleContent(message.content);
        } else {
        }
      } else if (message.type === "SUBTITLE_REQUEST_ERROR") {
        setLoading(false);
        setError(message.error || "获取字幕失败");
      } else if (message.type === "CLEAR_SUBTITLES") {
        clearSubtitles();
      }

      return true;
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [processSubtitleContent, clearSubtitles]);

  return {
    subtitles,
    loading,
    error,
    setLoading,
    setError,
    clearSubtitles,
  };
};
