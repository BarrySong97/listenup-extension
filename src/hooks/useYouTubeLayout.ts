import { useState, useEffect, useRef } from "react";
import { subtitleFetcher } from "@src/lib/subtitleFetcher";

/**
 * YouTube页面布局管理钩子
 * 处理页面检测、尺寸计算和位置设置
 */
export const useYouTubeLayout = () => {
  const [isYoutube, setIsYoutube] = useState(false);
  const [videoHeight, setVideoHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  console.log("🎭 useYouTubeLayout - 当前状态:", { isYoutube, videoHeight });

  useEffect(() => {
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

    const checkAndSetupPage = () => {
      // 检查是否在YouTube视频页面
      const isYouTubePage = subtitleFetcher.isYouTubePage();
      const isVideoPage =
        isYouTubePage &&
        (window.location.pathname === "/watch" ||
          window.location.search.includes("v=") ||
          window.location.pathname.startsWith("/watch"));

      console.log("🔍 页面检测:", {
        hostname: window.location.hostname,
        pathname: window.location.pathname,
        search: window.location.search,
        isYouTubePage,
        isVideoPage,
      });

      setIsYoutube(isVideoPage);

      if (!isVideoPage) {
        // 清理样式
        const secondaryContent = subtitleFetcher.getSecondaryContent();
        if (secondaryContent) {
          (secondaryContent as HTMLElement).style.marginTop = "";
        }
        return;
      }

      // 延迟设置布局，等待页面加载
      setTimeout(setupLayout, 1000);
    };

    // 初始检查
    checkAndSetupPage();

    // 监听页面变化（YouTube是单页应用）
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        // URL变化时重新检查页面
        setTimeout(checkAndSetupPage, 1000);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 监听浏览器前进后退
    const handlePopState = () => {
      setTimeout(checkAndSetupPage, 1000);
    };
    window.addEventListener("popstate", handlePopState);

    // 监听YouTube导航事件
    const handleYTNavigate = () => {
      setTimeout(checkAndSetupPage, 1000);
    };
    window.addEventListener("yt-navigate-finish", handleYTNavigate);

    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("yt-navigate-finish", handleYTNavigate);
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
