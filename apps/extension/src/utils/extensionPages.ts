/**
 * @purpose 扩展内部页面 URL 常量与打开新标签页的小工具。
 * @role    popup、options、面板设置入口共用。
 * @deps    chrome.runtime.getURL
 * @gotcha  页面路径写死为 src/pages/<page>/index.html，改页面目录要同步这里
 */
export const EXTENSION_PAGE_URLS = {
  options: chrome.runtime.getURL("src/pages/options/index.html"),
  preview: chrome.runtime.getURL("src/pages/newtab/index.html"),
} as const;

export function openExtensionPage(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}
