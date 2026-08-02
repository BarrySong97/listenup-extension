/**
 * @purpose 演示面板头部：标题、折叠与工具按钮。
 * @role    SubtitlePanelShell 的顶部区域（扩展同名组件的简化副本）。
 * @deps    @iconify/react、./iconScale、./subtitleTypes
 * @gotcha  只保留展示，去掉了扩展里的下拉与真实设备逻辑
 */
"use client";
import { memo, useState } from "react";
import { Icon } from "@iconify/react";
import { iconScale } from "./iconScale";
import { SubtitleItem } from "./subtitleTypes";

interface SubtitleHeaderProps {
  title?: string;
  subtitles: SubtitleItem[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  audioInputDevices: MediaDeviceInfo[];
  selectedAudioInputId: string;
  selectedAudioInputLabel: string;
  audioInputError: string | null;
  onSelectAudioInput: (deviceId: string) => void;
  onRefreshAudioInputs: () => void;
  onOpenAiSettings: () => void;
}

const actionButtonClassName =
  "inline-flex items-center justify-center h-9 w-9 min-w-0 rounded-md p-0 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900";

export const SubtitleHeader = memo(function SubtitleHeader({
  title = "Listen Up",
  subtitles,
  isCollapsed,
  onToggleCollapse,
  onOpenAiSettings,
}: SubtitleHeaderProps) {
  const [copyStatus, setCopyStatus] = useState(false);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleCopyAllSubtitles = async () => {
    try {
      const allSubtitlesText = subtitles
        .map((subtitle) => {
          const startTime = formatTime(subtitle.startTime);
          const endTime = formatTime(subtitle.endTime);
          return `${startTime} - ${endTime}\n${subtitle.text}`;
        })
        .join("\n\n");

      await navigator.clipboard.writeText(allSubtitlesText);
      setCopyStatus(true);
      window.setTimeout(() => setCopyStatus(false), 1500);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  return (
    <div className="sticky top-0 z-20 border-b border-zinc-100 bg-white/95 px-3 py-2.5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-600">
            <Icon
              icon="mdi:subtitles-outline"
              className={`${iconScale.brand} text-white`}
            />
          </div>
          <div className="truncate text-sm font-semibold tracking-tight text-zinc-900">
            {title}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className={actionButtonClassName}
            aria-label="Settings"
            title="Settings"
            onClick={onOpenAiSettings}
          >
            <Icon icon="mdi:cog-outline" className={iconScale.headerAction} />
          </button>
          <button
            type="button"
            className={actionButtonClassName}
            aria-label="Download subtitles"
            title="Download"
          >
            <Icon icon="mdi:download-outline" className={iconScale.headerAction} />
          </button>
          <button
            type="button"
            className={`${actionButtonClassName} ${copyStatus ? "text-blue-600" : ""}`}
            aria-label="Copy subtitles"
            title="Copy"
            onClick={handleCopyAllSubtitles}
          >
            <Icon
              icon={copyStatus ? "mdi:check" : "mdi:content-copy"}
              className={iconScale.headerAction}
            />
          </button>
          <div className="mx-1 h-4 w-px bg-zinc-200" />
          <button
            type="button"
            className={actionButtonClassName}
            aria-label={isCollapsed ? "Expand panel" : "Collapse panel"}
            onClick={onToggleCollapse}
          >
            <Icon
              icon="mdi:chevron-up"
              className={`${iconScale.headerAction} transition-transform duration-200 ${
                isCollapsed ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
});
