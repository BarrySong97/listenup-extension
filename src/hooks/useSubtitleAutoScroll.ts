import { useEffect, useRef, useState } from 'react';
import { VListHandle } from 'virtua';

/**
 * 字幕自动滚动钩子
 * 处理字幕列表的自动滚动到当前活跃字幕
 * 初始加载时立即跳转，避免长时间滚动动画
 */
export const useSubtitleAutoScroll = (currentSubtitleIndex: number) => {
  const vListRef = useRef<VListHandle>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // 自動滾動到當前字幕
  useEffect(() => {
    if (currentSubtitleIndex >= 0 && vListRef.current) {
      if (isInitialLoad) {
        // 初始加载时立即跳转，不使用平滑动画
        vListRef.current.scrollToIndex(currentSubtitleIndex, {
          align: "center",
          smooth: false, // 立即跳转
        });
        setIsInitialLoad(false);
        console.log('📍 初始加载：立即跳转到字幕', currentSubtitleIndex);
      } else {
        // 后续更新使用平滑滚动
        vListRef.current.scrollToIndex(currentSubtitleIndex, {
          align: "center",
          smooth: true,
        });
      }
    }
  }, [currentSubtitleIndex, isInitialLoad]);

  return { vListRef };
};