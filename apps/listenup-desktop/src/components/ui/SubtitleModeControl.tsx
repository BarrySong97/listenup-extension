/**
 * @purpose 用 HeroUI ToggleButtonGroup 渲染原语、译文、双语三选一控件。
 * @role    列表 header 与影院 hover 工具条共享同一受控字幕模式交互。
 * @deps    @heroui/react、../../types
 * @gotcha  单选组禁止清空；影院 compact 只改变像素样式，不建立第二份模式状态。
 */
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import type { SubtitleDisplayMode } from "../../types";

const SUBTITLE_MODE_OPTIONS: ReadonlyArray<
  readonly [SubtitleDisplayMode, string]
> = [
  ["source", "原语"],
  ["translation", "译文"],
  ["bilingual", "双语"],
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
}: SubtitleModeControlProps) => (
  <ToggleButtonGroup
    aria-label="字幕显示模式"
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
            : `m-0 h-6 min-w-0 cursor-pointer rounded-md border px-2 text-[10px] outline-none transition-colors ${
                isSelected
                  ? "border-white/20 bg-white/15 text-fg"
                  : "border-transparent bg-transparent text-fg-faint hover:bg-wash hover:text-fg"
              }`
        }
      >
        {label}
      </ToggleButton>
    ))}
  </ToggleButtonGroup>
);
