/**
 * @purpose 初始化 Desktop 的 i18next/react-i18next，并管理系统语言检测与偏好持久化。
 * @role    Desktop 主窗口、弹窗、Footer 与 hooks 共用的 i18n Provider 和切换 API。
 * @deps    i18next、react-i18next、localStorage、./language、./resources
 * @gotcha  默认跟随 WebView 系统语言；用户选择只存 en/zh-CN，缺失键统一回退英文。
 */
import type { PropsWithChildren } from "react";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import {
  SUPPORTED_UI_LANGUAGES,
  normalizeUiLanguage,
  readStoredUiLanguage,
  writeStoredUiLanguage,
  type UiLanguage,
} from "./language";
import { translationResources } from "./resources";

export {
  SUPPORTED_UI_LANGUAGES,
  UI_LANGUAGE_STORAGE_KEY,
  normalizeUiLanguage,
  type UiLanguage,
} from "./language";

const systemLanguage = () =>
  typeof navigator === "undefined" ? "en" : navigator.language;

export const i18n = i18next.createInstance();

void i18n.use(initReactI18next).init({
  initAsync: false,
  resources: translationResources,
  lng: readStoredUiLanguage() ?? normalizeUiLanguage(systemLanguage()),
  fallbackLng: "en",
  supportedLngs: [...SUPPORTED_UI_LANGUAGES],
  interpolation: { escapeValue: false },
  returnNull: false,
});

if (typeof document !== "undefined") {
  document.documentElement.lang = normalizeUiLanguage(i18n.resolvedLanguage);
}

export const changeUiLanguage = async (language: UiLanguage) => {
  writeStoredUiLanguage(language);
  await i18n.changeLanguage(language);
  if (typeof document !== "undefined") document.documentElement.lang = language;
};

export function DesktopI18nProvider({ children }: PropsWithChildren) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
