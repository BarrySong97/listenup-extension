"use client";
import { FC } from "react";
import { Icon } from "@iconify/react";
import { SubtitleItem } from "./subtitleTypes";

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
            <button
              type="button"
              className="inline-flex items-center h-7 min-w-0 gap-1.5 rounded-full bg-zinc-100 px-2.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-200"
              onClick={onReturnToActive}
            >
              <Icon
                icon="mdi:crosshairs-gps"
                className="h-[1em] w-[1em] shrink-0 text-[0.95rem]"
              />
              Back to current
            </button>
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
