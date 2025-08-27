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
const tryDirectSubtitleFetch = async (videoId: string) => {
  try {
    console.log("🚀 尝试直接获取字幕，视频ID:", videoId);

    // 等待页面加载完成
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 检查是否可以直接获取
    if (!subtitleDirectFetcher.canFetchDirectly()) {
      console.log("⚠️ 无法直接获取字幕，使用背景脚本方式");
      return;
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
      },
    });
    window.dispatchEvent(messageEvent);

    console.log("✅ 直接获取字幕成功，数量:", subtitles.length);
  } catch (error) {
    console.log("❌ 直接获取字幕失败，回退到背景脚本方式:", error);
    // 不抛出错误，让背景脚本方式作为备用
  }
};

const detectVideoChange = () => {
  const isWatchPage =
    window.location.pathname === "/watch" ||
    window.location.pathname.startsWith("/watch") ||
    window.location.search.includes("v=");
  const urlParams = new URLSearchParams(window.location.search);
  const videoId = isWatchPage ? urlParams.get("v") : null;

  // console.log('🔍 视频检测:', {
  //   pathname: window.location.pathname,
  //   search: window.location.search,
  //   isWatchPage,
  //   videoId
  // });

  // 检查是否从视频页面离开
  if (isOnVideoPage && !isWatchPage) {
    console.log("🚪 离开视频页面，清理字幕");
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
      .catch((err) => {
        console.log("发送页面变化消息失败:", err.message);
      });
    return;
  }

  // 检查视频ID变化
  if (isWatchPage && videoId) {
    if (videoId !== currentVideoId) {
      console.log("🎬 检测到视频变化:", currentVideoId, "→", videoId);
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
        .catch((err) => {
          console.log("发送视频变化消息失败:", err.message);
        });

      // 尝试直接获取字幕
      tryDirectSubtitleFetch(videoId);
    } else if (!isOnVideoPage) {
      // 进入视频页面但视频ID相同
      console.log("🎬 进入视频页面:", videoId);
      isOnVideoPage = true;

      // 也清理缓存，确保获取当前的视频元素
      youtubeController.clearCache();
    }
  } else if (isWatchPage && !videoId) {
    // 在watch页面但没有视频ID，清理状态
    if (currentVideoId) {
      console.log("🚪 视频页面但无视频ID，清理字幕");
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
        .catch((err) => {
          console.log("发送页面变化消息失败:", err.message);
        });
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

// 启动导航监听
observeNavigation();

try {
  console.log("content script loaded");
} catch (e) {
  console.error(e);
}
