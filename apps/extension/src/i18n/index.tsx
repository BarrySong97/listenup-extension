/**
 * @purpose 初始化 i18next/react-i18next，并管理 Extension UI 语言的检测、持久化与跨页面同步。
 * @role    内容脚本、Popup、Options、Preview 共用的 i18n Provider 与语言 API。
 * @deps    i18next、react-i18next、chrome.i18n、chrome.storage.local、./resources
 * @gotcha  默认跟随浏览器 UI；用户选择只存 en/zh-CN，缺失键统一回退英文。
 */
import { useEffect, useState, type PropsWithChildren } from "react";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { translationResources } from "./resources";
import {
  SUPPORTED_UI_LANGUAGES,
  normalizeUiLanguage,
  UI_LANGUAGE_STORAGE_KEY,
  readStoredUiLanguage,
  writeStoredUiLanguage,
  type UiLanguage,
} from "./language";

export {
  SUPPORTED_UI_LANGUAGES,
  normalizeUiLanguage,
  UI_LANGUAGE_STORAGE_KEY,
  type UiLanguage,
} from "./language";

const getBrowserUiLanguage = () => {
  try {
    if (typeof chrome !== "undefined" && chrome.i18n?.getUILanguage) {
      return chrome.i18n.getUILanguage();
    }
  } catch {
    // Browser globals can be unavailable in tests and non-extension previews.
  }

  return typeof navigator === "undefined" ? "en" : navigator.language;
};

export const i18n = i18next.createInstance();

void i18n.use(initReactI18next).init({
  initImmediate: false,
  resources: translationResources,
  lng: normalizeUiLanguage(getBrowserUiLanguage()),
  fallbackLng: "en",
  supportedLngs: [...SUPPORTED_UI_LANGUAGES],
  interpolation: { escapeValue: false },
  returnNull: false,
});

export const changeUiLanguage = async (language: UiLanguage) => {
  await i18n.changeLanguage(language);
  await writeStoredUiLanguage(language);
};

export function ExtensionI18nProvider({ children }: PropsWithChildren) {
  const [isLanguageReady, setIsLanguageReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      const storedLanguage = await readStoredUiLanguage().catch(() => null);
      if (storedLanguage && storedLanguage !== i18n.resolvedLanguage) {
        await i18n.changeLanguage(storedLanguage);
      }
      if (!disposed) {
        setIsLanguageReady(true);
      }
    })();

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      const nextLanguage = changes[UI_LANGUAGE_STORAGE_KEY]?.newValue;
      if (areaName === "local" && typeof nextLanguage === "string") {
        void i18n.changeLanguage(normalizeUiLanguage(nextLanguage));
      }
    };

    const canSubscribe =
      typeof chrome !== "undefined" && Boolean(chrome.storage?.onChanged);
    if (canSubscribe) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    return () => {
      disposed = true;
      if (canSubscribe) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      {isLanguageReady ? children : null}
    </I18nextProvider>
  );
}
