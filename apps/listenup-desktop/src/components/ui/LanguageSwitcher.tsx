/**
 * @purpose 在 Desktop Footer 渲染紧凑的中文/英文切换控件。
 * @role    Footer 左下角的显式界面语言入口；版本号与检查更新独立位于右下角。
 * @deps    react-i18next、../../i18n、DesktopButton
 * @gotcha  字幕目标语言与 UI 语言无关；这里仅写 listenup-ui-language。
 */
import { useTranslation } from "react-i18next";
import { changeUiLanguage, normalizeUiLanguage, type UiLanguage } from "../../i18n";
import { DesktopButton } from "./DesktopButton";

const LANGUAGES: ReadonlyArray<{ code: UiLanguage; labelKey: string }> = [
  { code: "zh-CN", labelKey: "common.chineseShort" },
  { code: "en", labelKey: "common.englishShort" },
];

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const currentLanguage = normalizeUiLanguage(i18n.resolvedLanguage);

  return (
    <div
      className="inline-flex h-6 items-center rounded-md border border-white/10 bg-black/20 p-0.5"
      role="group"
      aria-label={t("common.language")}
    >
      {LANGUAGES.map(({ code, labelKey }) => (
        <DesktopButton
          key={code}
          className={`h-5 min-w-0 cursor-pointer rounded px-1.5 text-[9px] font-medium transition-colors ${
            currentLanguage === code
              ? "bg-white/15 text-fg"
              : "bg-transparent text-fg-faint hover:bg-wash hover:text-fg"
          }`}
          aria-pressed={currentLanguage === code}
          onPress={() => void changeUiLanguage(code)}
        >
          {t(labelKey)}
        </DesktopButton>
      ))}
    </div>
  );
}
