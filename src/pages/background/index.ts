console.log("background script loaded");

// 存储字幕数据
let subtitleCache: { [tabId: number]: any[] } = {};

// 记录已处理的URL，避免重复处理
interface ProcessedUrlEntry {
  url: string;
  tabId: number;
  timestamp: number;
  videoId?: string;
}

let processedUrls = new Map<string, ProcessedUrlEntry>();
let urlClearTimer: NodeJS.Timeout;

// 跟踪每个tab的当前视频ID
let tabVideoIds = new Map<number, string>();

// 拦截字幕网络请求的响应
chrome.webRequest.onCompleted.addListener(
  async (details) => {
    const url = details.url;

    // 检查是否是字幕请求
    const isSubtitleRequest =
      url.includes("timedtext") ||
      url.includes("caption") ||
      url.includes("srv3") ||
      url.match(/www\.youtube\.com\/api\/timedtext/);

    if (!isSubtitleRequest) return;

    // 排除extension发起的请求
    const isFromExtension =
      details.initiator &&
      (details.initiator.startsWith("chrome-extension://") ||
        details.initiator.startsWith("moz-extension://"));

    if (isFromExtension) return;

    // 只处理成功的请求
    if (details.statusCode !== 200) return;

    // 提取视频ID（如果存在）
    const videoIdMatch = url.match(/[?&]v=([^&]+)/);
    const currentVideoId = videoIdMatch ? videoIdMatch[1] : null;
    
    // 检查是否需要重新处理
    const urlKey = url.split("?")[0];
    const existingEntry = processedUrls.get(urlKey);
    const tabId = details.tabId || -1;
    
    // 如果存在相同URL的记录，检查是否是新视频
    if (existingEntry) {
      const lastVideoId = tabVideoIds.get(tabId);
      // 如果视频ID发生变化，或者超过30秒，则重新处理
      const isNewVideo = currentVideoId && currentVideoId !== lastVideoId;
      const isStale = Date.now() - existingEntry.timestamp > 30000;
      
      if (!isNewVideo && !isStale) {
        console.log("🔄 跳过重复URL处理:", urlKey, "视频ID:", currentVideoId);
        return;
      }
      
      if (isNewVideo) {
        console.log("🎬 检测到新视频，重新处理字幕:", currentVideoId);
      }
    }

    // 记录当前处理的URL和视频信息
    processedUrls.set(urlKey, {
      url: urlKey,
      tabId: tabId,
      timestamp: Date.now(),
      videoId: currentVideoId || undefined
    });
    
    // 更新tab的视频ID
    if (currentVideoId && tabId !== -1) {
      tabVideoIds.set(tabId, currentVideoId);
    }
    console.log("🎯 Background监听到字幕响应完成，状态码:", details.statusCode);

    // 由于webRequest API无法直接获取响应体，我们还是需要fetch
    // 但这次是在响应完成后立即fetch，避免重复
    try {
      const response = await fetch(url);
      const content = await response.text();

      console.log("📄 获取字幕内容成功，长度:", content.length);

      // 发送内容到content script
      if (details.tabId && details.tabId !== -1) {
        chrome.tabs
          .sendMessage(details.tabId, {
            type: "SUBTITLE_CONTENT_READY",
            content: content,
            url: url,
            timestamp: Date.now(),
          })
          .catch((err) => {
            console.log("发送字幕内容失败:", err.message);
          });
      }
    } catch (err) {
      console.error("获取字幕内容失败:", err);
    }

    // 清理缓存
    clearTimeout(urlClearTimer);
    urlClearTimer = setTimeout(() => {
      // 清理超过5分钟的缓存条目
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      for (const [key, entry] of processedUrls.entries()) {
        if (entry.timestamp < fiveMinutesAgo) {
          processedUrls.delete(key);
        }
      }
      console.log("已清理过期URL缓存，当前缓存大小:", processedUrls.size);
    }, 60000); // 每分钟清理一次
  },
  {
    urls: ["*://*.youtube.com/*", "*://*.googlevideo.com/*"],
  }
);

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(message);
  
  const tabId = sender.tab?.id;
  
  // 处理打开side panel的请求
  if (message.action === "openSidePanel") {
    if (tabId) {
      chrome.sidePanel.open({ tabId });
    }
  }
  
  // 处理视频变化通知
  if (message.type === "VIDEO_CHANGED" && tabId) {
    const { videoId } = message;
    console.log("🎬 收到视频变化通知:", videoId, "Tab:", tabId);
    
    // 更新当前视频ID
    if (videoId) {
      tabVideoIds.set(tabId, videoId);
    }
    
    // 通知content script清理字幕状态
    chrome.tabs.sendMessage(tabId, {
      type: "CLEAR_SUBTITLES",
      videoId: videoId
    }).catch(err => {
      console.log("发送清理字幕消息失败:", err.message);
    });
  }
  
  // 处理页面变化通知（离开视频页面）
  if (message.type === "PAGE_CHANGED" && tabId) {
    const { pageType } = message;
    console.log("🚪 收到页面变化通知:", pageType, "Tab:", tabId);
    
    if (pageType === "non-video") {
      // 清理该tab的视频ID
      tabVideoIds.delete(tabId);
      
      // 通知content script清理字幕状态
      chrome.tabs.sendMessage(tabId, {
        type: "CLEAR_SUBTITLES",
        pageType: pageType
      }).catch(err => {
        console.log("发送清理字幕消息失败:", err.message);
      });
    }
  }

  return true; // 保持消息通道开放
});
