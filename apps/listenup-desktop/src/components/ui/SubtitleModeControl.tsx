/**
 * @purpose 用 HeroUI ToggleButtonGroup 渲染原语、译文、双语三选一控件。
 * @role    列表 header 与影院 hover 工具条共享同一受控字幕模式交互。
 * @deps    @heroui/react、react-i18next、../../types
 * @gotcha  单选组禁止清空；普通态与目标语言 Select 共用 desktop-subtitle-toolbar-control 尺寸契约。
 */
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useTranslation } from "react-i18next";
import type { SubtitleDisplayMode } from "../../types";

const SUBTITLE_MODE_OPTIONS: ReadonlyArray<
  readonly [SubtitleDisplayMode, string]
> = [
  ["source", "subtitleMode.source"],
  ["translation", "subtitleMode.translation"],
  ["bilingual", "subtitleMode.bilingual"],
];

interface SubtitleModeControlProps {
  compact?: boolean;
  onChange: (mode: SubtitleDisplayMode) => void;
  value: SubtitleDisplayMode;
}

export const SubtitleModeControl = ({
  compact = false,
  onChange,
  value,
}: SubtitleModeControlProps) => {
  const { t } = useTranslation();

  return <ToggleButtonGroup
    aria-label={t("subtitleMode.label")}
    selectionMode="single"
    disallowEmptySelection
    selectedKeys={[value]}
    onSelectionChange={(keys) => {
      const selected = [...keys][0];
      if (selected) onChange(selected as SubtitleDisplayMode);
    }}
    className={
      compact
        ? "flex items-center gap-0.5 rounded-full border border-white/10 bg-black/25 p-0.5"
        : "flex items-center gap-1.5 border-none bg-transparent p-0"
    }
  >
    {SUBTITLE_MODE_OPTIONS.map(([mode, label]) => (
      <ToggleButton
        key={mode}
        id={mode}
        variant="ghost"
        className={({ isSelected }) =>
          compact
            ? `m-0 h-5 min-w-0 cursor-pointer rounded-full border px-1.5 text-[10px] outline-none transition-colors ${
                isSelected
                  ? "border-white/15 bg-white/15 text-fg"
                  : "border-transparent bg-transparent text-fg-faint hover:bg-white/10 hover:text-fg"
              }`
            : `desktop-subtitle-toolbar-control m-0 min-w-0 cursor-pointer border outline-none transition-colors ${
                isSelected
                  ? "border-white/20 bg-white/15 text-fg"
                  : "border-transparent bg-transparent text-fg-faint hover:bg-wash hover:text-fg"
              }`
        }
      >
        {t(label)}
      </ToggleButton>
    ))}
  </ToggleButtonGroup>;
};
