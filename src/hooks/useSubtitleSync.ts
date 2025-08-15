import { useState, useEffect, useRef, useMemo } from 'react';
import { SubtitleItem } from '@src/lib/subtitleTypes';
import { youtubeController } from '@src/lib/youtubeController';

/**
 * 字幕同步逻辑钩子
 * 处理视频时间跟踪和当前字幕高亮
 */
export const useSubtitleSync = (isYoutube: boolean, subtitles: SubtitleItem[]) => {
  const [currentTime, setCurrentTime] = useState(0);
  const timeUpdateCleanupRef = useRef<(() => void) | null>(null);

  // 计算当前活跃字幕索引 - 优化重叠处理
  const currentSubtitleIndex = useMemo(() => {
    const tolerance = 0.02; // 减小tolerance避免重叠问题
    
    // 从后往前查找，优先匹配后面的字幕（处理重叠时的优先级）
    for (let i = subtitles.length - 1; i >= 0; i--) {
      const subtitle = subtitles[i];
      
      // 精确匹配：当前时间在字幕时间范围内
      if (
        currentTime >= subtitle.startTime - tolerance &&
        currentTime <= subtitle.endTime + tolerance
      ) {
        // 检查是否有重叠情况
        if (i > 0) {
          const prevSubtitle = subtitles[i - 1];
          const overlap = subtitle.startTime - prevSubtitle.endTime;
          
          // 如果有重叠且当前时间更接近当前字幕的开始时间
          if (Math.abs(overlap) <= 0.001) {
            const distToCurrentStart = Math.abs(currentTime - subtitle.startTime);
            const distToPrevEnd = Math.abs(currentTime - prevSubtitle.endTime);
            
            // 如果更接近当前字幕的开始时间，选择当前字幕
            if (distToCurrentStart <= distToPrevEnd) {
              return i;
            }
          }
        }
        return i;
      }
    }
    return -1;
  }, [currentTime, subtitles]);

  // 设置视频时间监听
  useEffect(() => {
    if (!isYoutube) return;

    // 清理之前的监听器
    if (timeUpdateCleanupRef.current) {
      timeUpdateCleanupRef.current();
    }

    // 设置新的时间更新监听器
    const cleanup = youtubeController.setupTimeUpdateListener((time) => {
      setCurrentTime(time);
    });

    timeUpdateCleanupRef.current = cleanup;

    return () => {
      if (timeUpdateCleanupRef.current) {
        timeUpdateCleanupRef.current();
        timeUpdateCleanupRef.current = null;
      }
    };
  }, [isYoutube]);

  return {
    currentTime,
    currentSubtitleIndex,
  };
};