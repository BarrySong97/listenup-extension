import { FC } from "react";
import { SubtitleItem } from "../lib/subtitles/subtitleTypes";

interface ActiveSegmentPanelProps {
  currentSubtitle: SubtitleItem | null;
  isActive: boolean;
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
          <span className="font-mono text-[11px] text-zinc-400">
            {formatClock(currentSubtitle.startTime)} -{" "}
            {formatClock(currentSubtitle.endTime)}
          </span>
        </div>
        <p className="text-sm font-medium leading-6 text-zinc-900">
          {currentSubtitle.text}
        </p>
      </div>
    </div>
  );
};
