"use client";
import { FC } from "react";
import { Icon } from "@iconify/react";
import { iconScale } from "./iconScale";

interface PlaybackDividerProps {
  isPlaying: boolean;
  onTogglePlayback: () => void;
}

export const PlaybackDivider: FC<PlaybackDividerProps> = ({
  isPlaying,
  onTogglePlayback,
}) => {
  return (
    <div className="shrink-0 border-t border-zinc-200 bg-white px-3 py-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-200" />
        <button
          type="button"
          className="inline-flex items-center gap-2 h-10 min-w-[8.5rem] justify-center rounded-full bg-zinc-900 px-5 text-white hover:bg-black"
          onClick={onTogglePlayback}
        >
          <Icon
            icon={isPlaying ? "mdi:pause" : "mdi:play"}
            className={iconScale.primaryControl}
          />
          <span className="text-sm font-semibold">
            {isPlaying ? "Pause" : "Play"}
          </span>
        </button>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>
    </div>
  );
};
