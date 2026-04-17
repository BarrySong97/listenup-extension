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
  if (!currentSubtitle || !isActive) {
    return null;
  }

  return (
    <div className="shrink-0 border-t border-zinc-200 bg-zinc-50/95 px-3 pt-3 backdrop-blur-xl">
      <div className="rounded-md border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600">
            Active Segment
          </span>
          {showReturnToActive ? (
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
          ) : (
            <span className="font-mono text-[11px] text-zinc-400">
              {formatClock(currentSubtitle.startTime)} -{" "}
              {formatClock(currentSubtitle.endTime)}
            </span>
          )}
        </div>
        {showReturnToActive && (
          <div className="mb-2 font-mono text-[11px] text-zinc-400">
            {formatClock(currentSubtitle.startTime)} -{" "}
            {formatClock(currentSubtitle.endTime)}
          </div>
        )}
        <p className="text-sm font-medium leading-6 text-zinc-900">
          {currentSubtitle.text}
        </p>
      </div>
    </div>
  );
};
