export const EXTENSION_PAGE_URLS = {
  options: chrome.runtime.getURL("src/pages/options/index.html"),
  preview: chrome.runtime.getURL("src/pages/newtab/index.html"),
} as const;

export function openExtensionPage(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}
