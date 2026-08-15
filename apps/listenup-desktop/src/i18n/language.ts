/**
 * @purpose 定义 Desktop UI 语言规则，并读写 localStorage 中的语言偏好。
 * @role    i18n 初始化、Footer 切换组件和 Node 测试共享的语言层。
 * @deps    Web Storage API
 * @gotcha  所有 zh 变体映射简体中文；存储不可用时静默回退系统语言。
 */
export const SUPPORTED_UI_LANGUAGES = ["en", "zh-CN"] as const;
export type UiLanguage = (typeof SUPPORTED_UI_LANGUAGES)[number];

export const UI_LANGUAGE_STORAGE_KEY = "listenup-ui-language";

export const normalizeUiLanguage = (language?: string | null): UiLanguage =>
  language?.trim().toLowerCase().startsWith("zh") ? "zh-CN" : "en";

type LanguageStorage = Pick<Storage, "getItem" | "setItem">;

const defaultStorage = (): LanguageStorage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

export const readStoredUiLanguage = (
  storage: LanguageStorage | null = defaultStorage()
): UiLanguage | null => {
  if (!storage) return null;
  try {
    const value = storage.getItem(UI_LANGUAGE_STORAGE_KEY);
    return value ? normalizeUiLanguage(value) : null;
  } catch {
    return null;
  }
};

export const writeStoredUiLanguage = (
  language: UiLanguage,
  storage: LanguageStorage | null = defaultStorage()
) => {
  if (!storage) return;
  try {
    storage.setItem(UI_LANGUAGE_STORAGE_KEY, language);
  } catch {
    // A read-only or unavailable WebView storage must not block language switching.
  }
};
