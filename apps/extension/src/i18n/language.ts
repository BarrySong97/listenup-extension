/**
 * @purpose 定义 Extension UI 语言规则，并读写 chrome.storage.local 中的语言偏好。
 * @role    i18n 初始化、切换组件和纯 Node 测试共享的语言层。
 * @deps    chrome.storage.local
 * @gotcha  所有 zh 变体映射简体中文；storage 不可用/读取失败时返回 null，交给浏览器语言兜底。
 */
export const SUPPORTED_UI_LANGUAGES = ["en", "zh-CN"] as const;
export type UiLanguage = (typeof SUPPORTED_UI_LANGUAGES)[number];

export const normalizeUiLanguage = (language?: string | null): UiLanguage =>
  language?.trim().toLowerCase().startsWith("zh") ? "zh-CN" : "en";

export const UI_LANGUAGE_STORAGE_KEY = "ui_language";

type LanguageStorageArea = Pick<chrome.storage.StorageArea, "get" | "set">;

const defaultStorageArea = (): LanguageStorageArea | null =>
  typeof chrome === "undefined" || !chrome.storage?.local
    ? null
    : chrome.storage.local;

export const readStoredUiLanguage = async (
  storageArea: LanguageStorageArea | null = defaultStorageArea()
): Promise<UiLanguage | null> => {
  if (!storageArea) {
    return null;
  }

  return new Promise((resolve) => {
    storageArea.get(UI_LANGUAGE_STORAGE_KEY, (result) => {
      if (typeof chrome !== "undefined" && chrome.runtime?.lastError) {
        resolve(null);
        return;
      }

      const value = result[UI_LANGUAGE_STORAGE_KEY];
      resolve(typeof value === "string" ? normalizeUiLanguage(value) : null);
    });
  });
};

export const writeStoredUiLanguage = async (
  language: UiLanguage,
  storageArea: LanguageStorageArea | null = defaultStorageArea()
) => {
  if (!storageArea) {
    return;
  }

  await new Promise<void>((resolve) => {
    storageArea.set({ [UI_LANGUAGE_STORAGE_KEY]: language }, () => resolve());
  });
};
