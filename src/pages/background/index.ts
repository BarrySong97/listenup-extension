console.log("background script loaded");

// 存储字幕数据
let subtitleCache: { [tabId: number]: any[] } = {};

// 记录已处理的URL，避免重复处理
let processedUrls = new Set<string>();
let urlClearTimer: NodeJS.Timeout;

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

    // 避免重复处理
    const urlKey = url.split("?")[0];
    if (processedUrls.has(urlKey)) {
      return;
    }

    processedUrls.add(urlKey);
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
      processedUrls.clear();
      console.log("已清理URL缓存");
    }, 30000);
  },
  {
    urls: ["*://*.youtube.com/*", "*://*.googlevideo.com/*"],
  }
);

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_SUBTITLE_CACHE") {
    const tabId = sender.tab?.id;
    if (tabId) {
      sendResponse({ subtitles: subtitleCache[tabId] || [] });
    }
  }

  return true; // 保持消息通道开放
});
