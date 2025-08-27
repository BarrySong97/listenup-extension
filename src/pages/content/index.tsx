import { createRoot } from "react-dom/client";
import { HeroUIProvider } from "@heroui/react";
import styleText from "./style.css?inline";
import Subtitles from "./components/subtitles";
import { youtubeController } from "@src/lib/youtubeController";
import { subtitleDirectFetcher } from "@src/lib/subtitleDirectFetcher";

// 创建Shadow DOM容器
const hostDiv = document.createElement("div");
hostDiv.id = "__listenup-extension-host";
hostDiv.style.position = "relative";
hostDiv.style.zIndex = "9";

// 创建Shadow Root
const shadowRoot = hostDiv.attachShadow({ mode: "open" });

// 创建React根容器
const reactContainer = document.createElement("div");
reactContainer.id = "__root";
reactContainer.style.fontSize = "16px";

// 注入Tailwind CSS到Shadow DOM
const injectStyles = () => {
  // 转换CSS以适配Shadow DOM，将:root和html选择器转换为:host

  // 注入转换后的Tailwind CSS
  const tailwindStyle = document.createElement("style");
  tailwindStyle.textContent = styleText.replaceAll("rem", "em");
  shadowRoot.appendChild(tailwindStyle);
};

// 注入样式
injectStyles();

// 将React容器添加到Shadow DOM
shadowRoot.appendChild(reactContainer);

// 将Shadow DOM host添加到页面
document.body.appendChild(hostDiv);

// 创建React根
const root = createRoot(reactContainer);
root.render(
  <HeroUIProvider>
    <Subtitles />
  </HeroUIProvider>
);

// 视频变化检测
let currentVideoId: string | null = null;
let isOnVideoPage: boolean = false;

// 尝试直接获取字幕
const tryDirectSubtitleFetch = async (
  videoId: string,
  reason = "video_change"
) => {
  try {
    // 根据触发原因决定等待时间
    const waitTime = reason === "subtitle_request_detected" ? 500 : 2000;
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    // 检查是否可以直接获取
    if (!subtitleDirectFetcher.canFetchDirectly()) {
      return false; // 返回false表示获取失败
    }

    // 直接获取字幕
    const subtitles = await subtitleDirectFetcher.fetchSubtitles(["en"]);

    // 发送字幕内容到应用
    const messageEvent = new CustomEvent("subtitle-content-ready", {
      detail: {
        type: "SUBTITLE_CONTENT_READY",
        subtitles: subtitles,
        videoId: videoId,
        timestamp: Date.now(),
        source: "direct",
        reason: reason,
      },
    });
    window.dispatchEvent(messageEvent);

    return true; // 返回true表示获取成功
  } catch (error) {
    return false; // 返回false表示获取失败
  }
};

// 跟踪字幕获取状态
let subtitleFetchStatus = {
  lastVideoId: null as string | null,
  directFetchSucceeded: false,
  lastAttemptTime: 0,
};

const detectVideoChange = () => {
  const isWatchPage =
    window.location.pathname === "/watch" ||
    window.location.pathname.startsWith("/watch") ||
    window.location.search.includes("v=");
  const urlParams = new URLSearchParams(window.location.search);
  const videoId = isWatchPage ? urlParams.get("v") : null;

  //

  // 检查是否从视频页面离开
  if (isOnVideoPage && !isWatchPage) {
    currentVideoId = null;
    isOnVideoPage = false;

    // 清理视频元素缓存
    youtubeController.clearCache();

    // 通知清理字幕
    chrome.runtime
      .sendMessage({
        type: "PAGE_CHANGED",
        pageType: "non-video",
        timestamp: Date.now(),
      })
      .catch((err) => {});
    return;
  }

  // 检查视频ID变化
  if (isWatchPage && videoId) {
    if (videoId !== currentVideoId) {
      currentVideoId = videoId;
      isOnVideoPage = true;

      // 清理视频元素缓存，强制重新获取
      youtubeController.clearCache();

      // 通知background script
      chrome.runtime
        .sendMessage({
          type: "VIDEO_CHANGED",
          videoId: videoId,
          timestamp: Date.now(),
        })
        .catch((err) => {});

      // 重置字幕获取状态
      subtitleFetchStatus = {
        lastVideoId: videoId,
        directFetchSucceeded: false,
        lastAttemptTime: Date.now(),
      };

      // 尝试直接获取字幕
      tryDirectSubtitleFetch(videoId, "video_change").then((success) => {
        subtitleFetchStatus.directFetchSucceeded = success;
      });
    } else if (!isOnVideoPage) {
      // 进入视频页面但视频ID相同

      isOnVideoPage = true;

      // 也清理缓存，确保获取当前的视频元素
      youtubeController.clearCache();
    }
  } else if (isWatchPage && !videoId) {
    // 在watch页面但没有视频ID，清理状态
    if (currentVideoId) {
      currentVideoId = null;
      isOnVideoPage = false;

      // 清理视频元素缓存
      youtubeController.clearCache();

      chrome.runtime
        .sendMessage({
          type: "PAGE_CHANGED",
          pageType: "non-video",
          timestamp: Date.now(),
        })
        .catch((err) => {});
    }
  }
};

// 监听YouTube的单页应用导航
const observeNavigation = () => {
  // 初始检测
  detectVideoChange();

  // 监听URL变化（用于SPA导航）
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      // URL变化时延迟检测，等待页面更新
      setTimeout(detectVideoChange, 1000);
    }
  }).observe(document, { subtree: true, childList: true });

  // 监听popstate事件（浏览器前进后退）
  window.addEventListener("popstate", () => {
    setTimeout(detectVideoChange, 1000);
  });

  // 监听YouTube特有的导航事件
  window.addEventListener("yt-navigate-finish", () => {
    setTimeout(detectVideoChange, 1000);
  });
};

// 监听来自background script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SUBTITLE_REQUEST_DETECTED") {
    // 检查是否是当前视频的字幕请求
    if (
      message.videoId === currentVideoId &&
      !subtitleFetchStatus.directFetchSucceeded
    ) {
      // 避免频繁重试
      const timeSinceLastAttempt =
        Date.now() - subtitleFetchStatus.lastAttemptTime;
      if (timeSinceLastAttempt > 1000) {
        // 至少间隔1秒
        subtitleFetchStatus.lastAttemptTime = Date.now();

        tryDirectSubtitleFetch(
          currentVideoId,
          "subtitle_request_detected"
        ).then((success) => {
          subtitleFetchStatus.directFetchSucceeded = success;
          if (success) {
          }
        });
      }
    }
  }

  return true;
});

// 启动导航监听
observeNavigation();

try {
} catch (e) {
  console.error(e);
}
