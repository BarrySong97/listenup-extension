/**
 * @purpose 用 HeroUI Select 渲染当前原文 revision 可用的目标译文语言。
 * @role    App 列表 header 中受控的目标语言选择器。
 * @deps    @heroui/react
 * @gotcha  空选项时只显示禁用 placeholder；选择值仍由 App 的 localStorage 偏好控制。
 */
import { ListBox, Select } from "@heroui/react";

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
  const isDisabled = options.length === 0;

  return (
    <Select
      aria-label="目标字幕语言"
      placeholder={isDisabled ? "无可用译文" : "选择译文语言"}
      selectedKey={value}
      onSelectionChange={(key) => {
        if (key !== null) onChange(String(key));
      }}
      isDisabled={isDisabled}
      className="max-w-[132px]"
    >
      <Select.Trigger className="flex h-6 max-w-[132px] cursor-pointer items-center gap-1 rounded-md border border-white/10 bg-black/30 px-1.5 text-[10px] text-fg outline-none disabled:cursor-not-allowed disabled:opacity-50">
        <Select.Value className="min-w-0 flex-1 truncate text-left" />
        <Select.Indicator className="h-3 w-3 flex-none text-fg-faint" />
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
