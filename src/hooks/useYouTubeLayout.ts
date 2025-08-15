import { useState, useEffect, useRef } from 'react';
import { subtitleFetcher } from '@src/lib/subtitleFetcher';

/**
 * YouTube页面布局管理钩子
 * 处理页面检测、尺寸计算和位置设置
 */
export const useYouTubeLayout = () => {
  const [isYoutube, setIsYoutube] = useState(false);
  const [videoHeight, setVideoHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 检查是否在YouTube页面
    const isYouTubePage = subtitleFetcher.isYouTubePage();
    setIsYoutube(isYouTubePage);

    if (!isYouTubePage) return;

    const setupLayout = () => {
      // 找到视频播放器
      const videoPlayer = subtitleFetcher.getVideoPlayer();

      // 找到右侧推荐视频容器
      const secondaryContent = subtitleFetcher.getSecondaryContent();

      if (videoPlayer && secondaryContent) {
        const playerRect = subtitleFetcher.getPlayerRect();
        if (playerRect) {
          setVideoHeight(playerRect.height);

          // 修改推荐视频容器的样式，为我们的内容腾出空间
          const secondaryEl = secondaryContent as HTMLElement;
          if (secondaryEl) {
            const x = secondaryEl.getBoundingClientRect().x;
            if (containerRef.current) {
              // 在Shadow DOM中，需要相对于页面定位
              containerRef.current.style.left = `${x}px`;
              containerRef.current.style.top = "80px";
            }
            secondaryEl.style.marginTop = `${
              Math.max(playerRect.height, 400) + 32
            }px`;
          }
        }
      }
    };

    // 等待页面加载完成
    const timer = setTimeout(setupLayout, 1000);

    // 监听页面变化（YouTube是单页应用）
    const observer = new MutationObserver(setupLayout);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      // 清理样式
      const secondaryContent = subtitleFetcher.getSecondaryContent();
      if (secondaryContent) {
        (secondaryContent as HTMLElement).style.marginTop = "";
      }
    };
  }, []);

  return {
    isYoutube,
    videoHeight,
    containerRef,
  };
};