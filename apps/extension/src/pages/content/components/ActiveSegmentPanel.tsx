/**
 * @purpose 当前句面板：显示当前字幕文本与时间，并提供“回到当前句”。
 * @role    SubtitlePanelShell 中列表与 footer 之间的区域。
 * @deps    @heroui/react、lib/subtitles/subtitleTypes
 * @gotcha  showReturnToActive 由 useSubtitleAutoScroll 计算，不要在这里自行判断滚动位置
 */
import { FC } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { SubtitleItem } from "../lib/subtitles/subtitleTypes";

interface ActiveSegmentPanelProps {
  currentSubtitle: SubtitleItem | null;
  isActive: boolean;
  showReturnToActive: boolean;
  onReturnToActive: () => void;
}

const formatClock = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};

export const ActiveSegmentPanel: FC<ActiveSegmentPanelProps> = ({
  currentSubtitle,
  isActive,
  showReturnToActive,
  onReturnToActive,
}) => {
  return (
    <div className="shrink-0 border-t border-zinc-200 bg-zinc-50/95 px-3 py-3 backdrop-blur-xl">
      <div className="min-h-[112px] rounded-md border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <span
            className={`text-[9px] font-bold uppercase tracking-wider ${
              isActive ? "text-blue-600" : "text-zinc-400"
            }`}
          >
            {currentSubtitle ? (isActive ? "Active Segment" : "Recent Segment") : "Active Segment"}
          </span>
          {currentSubtitle && showReturnToActive ? (
            <Button
              size="sm"
              radius="full"
              variant="flat"
              color="default"
              className="h-7 min-w-0 gap-1.5 bg-zinc-100 px-2.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-200"
              onPressStart={onReturnToActive}
            >
              <Icon
                icon="mdi:crosshairs-gps"
                className="h-[1em] w-[1em] shrink-0 text-[0.95rem]"
              />
              Back to current
            </Button>
          ) : currentSubtitle ? (
            <span className="font-mono text-[11px] text-zinc-400">
              {formatClock(currentSubtitle.startTime)} -{" "}
              {formatClock(currentSubtitle.endTime)}
            </span>
          ) : (
            <span className="font-mono text-[11px] text-zinc-300">--:-- - --:--</span>
          )}
        </div>
        {currentSubtitle && showReturnToActive && (
          <div className="mb-2 font-mono text-[11px] text-zinc-400">
            {formatClock(currentSubtitle.startTime)} -{" "}
            {formatClock(currentSubtitle.endTime)}
          </div>
        )}
        {currentSubtitle ? (
          <p className="text-sm font-medium leading-6 text-zinc-900">
            {currentSubtitle.text}
          </p>
        ) : (
          <p className="text-sm leading-6 text-zinc-400">
            Waiting for current subtitle...
          </p>
        )}
      </div>
    </div>
  );
};
