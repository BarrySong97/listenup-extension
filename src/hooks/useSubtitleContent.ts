import { useState, useEffect, useCallback } from 'react';
import { SubtitleItem } from '@src/lib/subtitleTypes';
import { subtitleFetcher } from '@src/lib/subtitleFetcher';
import { SubtitleMerger } from '@src/lib/subtitleMerger';
import { SubtitleCleaner } from '@src/lib/subtitleCleaner';
import { subtitleConfig } from '@src/lib/subtitleConfig';

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
        console.log('📥 原始字幕数量:', parsedSubs.length);
        
        // 第一步：清理字幕内容
        const cleanConfig = subtitleConfig.getCleanConfig();
        const cleaner = new SubtitleCleaner(cleanConfig);
        const cleanedSubs = cleaner.cleanSubtitles(parsedSubs);
        
        // 输出清理统计信息
        const cleanStats = cleaner.getCleanStats(parsedSubs, cleanedSubs);
        console.log('🧹 字幕清理统计:', {
          原始数量: cleanStats.originalCount,
          清理后数量: cleanStats.cleanedCount,
          移除数量: cleanStats.removedCount,
          移除百分比: `${cleanStats.removalPercentage}%`,
          文本减少: `${cleanStats.textReductionPercentage}%`
        });
        
        // 暂时禁用合并功能，专注解决点击overlap问题
        // TODO: 稍后重新启用合并功能
        
        console.log('✅ 最终处理结果:', `${parsedSubs.length} → ${cleanedSubs.length} (减少${Math.round((1 - cleanedSubs.length / parsedSubs.length) * 100)}%)`);
        
        setSubtitles(cleanedSubs);
        setError(null);
      },
      (errorMsg) => {
        setError(errorMsg);
      }
    );
  }, []);

  // 监听来自background的字幕消息
  useEffect(() => {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "SUBTITLE_REQUEST_START") {
        console.log("🎯 开始请求字幕...");
        setLoading(true);
        setError(null);
      } else if (message.type === "SUBTITLE_CONTENT_READY") {
        console.log(
          "🎯 收到Background字幕内容:",
          message.content.length,
          "字符"
        );

        setLoading(false);
        // 直接处理字幕内容
        processSubtitleContent(message.content);
      } else if (message.type === "SUBTITLE_REQUEST_ERROR") {
        console.log("❌ 字幕请求失败:", message.error);
        setLoading(false);
        setError(message.error || "获取字幕失败");
      }

      return true;
    });
  }, [processSubtitleContent]);

  return {
    subtitles,
    loading,
    error,
    setLoading,
    setError,
  };
};