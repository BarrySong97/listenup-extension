/**
 * @purpose 用 HeroUI Select 渲染当前原文 revision 可用的目标译文语言。
 * @role    App 列表 header 中受控的目标语言选择器。
 * @deps    @heroui/react、react-i18next
 * @gotcha  HeroUI 默认会给 Trigger / Value 注入 36px 高度与较大字号，必须由共享 toolbar class 显式重置。
 */
import { ListBox, Select } from "@heroui/react";
import { useTranslation } from "react-i18next";

export interface TargetLanguageOption {
  displayName: string;
  languageCode: string;
}

interface TargetLanguageSelectProps {
  onChange: (languageCode: string) => void;
  options: TargetLanguageOption[];
  value: string | null;
}

export const TargetLanguageSelect = ({
  onChange,
  options,
  value,
}: TargetLanguageSelectProps) => {
  const { t } = useTranslation();
  const isDisabled = options.length === 0;

  return (
    <Select
      aria-label={t("targetLanguage.label")}
      placeholder={isDisabled ? t("targetLanguage.unavailable") : t("targetLanguage.choose")}
      selectedKey={value}
      onSelectionChange={(key) => {
        if (key !== null) onChange(String(key));
      }}
      isDisabled={isDisabled}
      className="max-w-[132px]"
    >
      <Select.Trigger className="desktop-subtitle-toolbar-control flex max-w-[132px] cursor-pointer items-center gap-1 border border-white/10 bg-black/30 text-fg outline-none disabled:cursor-not-allowed disabled:opacity-50">
        <Select.Value className="min-w-0 flex-1 truncate text-left" />
        <Select.Indicator className="flex-none text-fg-faint" />
      </Select.Trigger>
      <Select.Popover className="z-[100] min-w-[132px] rounded-lg border border-white/10 bg-[#242427] p-1 text-fg shadow-xl">
        <ListBox items={options} className="max-h-56 overflow-y-auto outline-none">
          {(option) => (
            <ListBox.Item
              id={option.languageCode}
              textValue={option.displayName}
              className="cursor-pointer rounded-md px-2 py-1.5 text-[10px] text-fg outline-none data-[focused]:bg-white/10 data-[selected]:bg-white/15"
            >
              {option.displayName}
            </ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
    </Select>
  );
};
