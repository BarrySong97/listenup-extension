/**
 * @purpose 渲染英文/简体中文切换，并调用共享 i18n 持久化 API。
 * @role    Popup 与 Options 的显式语言入口；内容脚本菜单复用同一 changeUiLanguage API。
 * @deps    @heroui/react、react-i18next、src/i18n
 * @gotcha  HeroUI 交互统一使用 onPressStart，确保在内容脚本 Shadow DOM 中也可安全复用。
 */
import { Button } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { changeUiLanguage, normalizeUiLanguage, type UiLanguage } from "@src/i18n";

interface LanguageSwitcherProps {
  className?: string;
}

const languages: Array<{ code: UiLanguage; labelKey: "common.english" | "common.chinese" }> = [
  { code: "en", labelKey: "common.english" },
  { code: "zh-CN", labelKey: "common.chinese" },
];

export function LanguageSwitcher({ className = "" }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation();
  const currentLanguage = normalizeUiLanguage(i18n.resolvedLanguage);

  return (
    <div
      className={`inline-flex rounded-lg bg-zinc-100 p-1 ${className}`}
      role="group"
      aria-label={t("common.language")}
    >
      {languages.map(({ code, labelKey }) => (
        <Button
          key={code}
          size="sm"
          variant={currentLanguage === code ? "solid" : "light"}
          className={`h-7 min-w-0 px-2.5 text-xs ${
            currentLanguage === code ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
          }`}
          aria-pressed={currentLanguage === code}
          onPressStart={() => void changeUiLanguage(code)}
        >
          {t(labelKey)}
        </Button>
      ))}
    </div>
  );
}
