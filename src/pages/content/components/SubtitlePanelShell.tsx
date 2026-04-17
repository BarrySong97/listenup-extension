import { FC, ReactNode } from "react";
import { SubtitleHeader } from "./SubtitleHeader";
import { SubtitlePanelToast } from "./SubtitlePanelToast";
import { PlaybackDivider } from "./PlaybackDivider";
import { ActiveSegmentPanel } from "./ActiveSegmentPanel";
import { SubtitleFooter } from "./SubtitleFooter";
import { SubtitleItem } from "../lib/subtitles/subtitleTypes";

interface SubtitlePanelShellProps {
  subtitles: SubtitleItem[];
  onClose: () => void;
  toastMessage: string | null;
  listContent: ReactNode;
  showReturnToActive: boolean;
  onReturnToActive: () => void;
  isPlaying: boolean;
  onTogglePlayback: () => void;
  currentSubtitle: SubtitleItem | null;
  isCurrentSubtitleActive: boolean;
  isLooping: boolean;
  onToggleLoop: () => void;
  isSegmentPlaying: boolean;
  className?: string;
}

export const SubtitlePanelShell: FC<SubtitlePanelShellProps> = ({
  subtitles,
  onClose,
  toastMessage,
  listContent,
  showReturnToActive,
  onReturnToActive,
  isPlaying,
  onTogglePlayback,
  currentSubtitle,
  isCurrentSubtitleActive,
  isLooping,
  onToggleLoop,
  isSegmentPlaying,
  className,
}) => {
  return (
    <div
      className={
        className ??
        "flex h-full flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white font-['Inter',ui-sans-serif,system-ui,sans-serif]"
      }
    >
      <SubtitleHeader subtitles={subtitles} onClose={onClose} />

      <div className="relative min-h-0 flex-1 bg-zinc-50/30">
        <SubtitlePanelToast message={toastMessage} />
        {listContent}
      </div>

      <PlaybackDivider
        isPlaying={isPlaying}
        onTogglePlayback={onTogglePlayback}
      />

      <ActiveSegmentPanel
        currentSubtitle={currentSubtitle}
        isActive={isCurrentSubtitleActive}
        showReturnToActive={showReturnToActive}
        onReturnToActive={onReturnToActive}
      />

      <SubtitleFooter
        currentSubtitle={currentSubtitle}
        isActive={isCurrentSubtitleActive}
        isLooping={isLooping}
        onToggleLoop={onToggleLoop}
        isSegmentPlaying={isSegmentPlaying}
      />

      <div className="flex h-1 items-center justify-center bg-white">
        <div className="h-1 w-12 rounded-full bg-zinc-200" />
      </div>
    </div>
  );
};
