// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openSidePanel" && sender.tab?.id) {
    chrome.sidePanel.open({ tabId: sender.tab.id });
  }
});
chrome.declarativeNetRequest.updateDynamicRules({
  removeRuleIds: [1],
  addRules: [
    {
      id: 1,
      priority: 1,
      action: {
        type: "modifyHeaders",
        responseHeaders: [
          {
            header: "content-security-policy",
            operation: "remove",
          },
          {
            header: "x-frame-options",
            operation: "remove",
          },
          {
            header: "frame-options",
            operation: "remove",
          },
          {
            header: "frame-ancestors",
            operation: "remove",
          },
          {
            header: "X-Content-Type-Options",
            operation: "remove",
          },
          {
            header: "access-control-allow-origin",
            operation: "set",
            value: "*",
          },
        ],
      },
      condition: {
        urlFilter: "||chatgpt.com",
        resourceTypes: ["main_frame", "sub_frame"],
      },
    },
  ],
});
