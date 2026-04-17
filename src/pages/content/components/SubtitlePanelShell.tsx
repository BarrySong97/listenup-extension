import { FC, ReactNode } from "react";
import { motion } from "framer-motion";
import { SubtitleHeader } from "./SubtitleHeader";
import { SubtitlePanelToast } from "./SubtitlePanelToast";
import { PlaybackDivider } from "./PlaybackDivider";
import { ActiveSegmentPanel } from "./ActiveSegmentPanel";
import { SubtitleFooter } from "./SubtitleFooter";
import { SubtitleItem } from "../lib/subtitles/subtitleTypes";
import { useAudioInputSettings } from "../hooks/useAudioInputSettings";

interface SubtitlePanelShellProps {
  subtitles: SubtitleItem[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
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
  isCollapsed,
  onToggleCollapse,
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
  const {
    devices,
    selectedDeviceId,
    selectedDeviceLabel,
    error,
    refreshDevices,
    setSelectedDeviceId,
  } = useAudioInputSettings();

  return (
    <div
      className={
        className ??
        "flex h-full flex-col overflow-visible rounded-lg border border-zinc-200 bg-white font-['Inter',ui-sans-serif,system-ui,sans-serif]"
      }
    >
      <SubtitleHeader
        subtitles={subtitles}
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
        audioInputDevices={devices}
        selectedAudioInputId={selectedDeviceId}
        selectedAudioInputLabel={selectedDeviceLabel}
        audioInputError={error}
        onSelectAudioInput={setSelectedDeviceId}
        onRefreshAudioInputs={refreshDevices}
      />

      <motion.div
        initial={false}
        animate={{
          opacity: isCollapsed ? 0 : 1,
          maxHeight: isCollapsed ? 0 : 2000,
          y: isCollapsed ? -6 : 0,
        }}
        transition={{
          duration: 0.22,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        aria-hidden={isCollapsed}
      >
        <div className="relative min-h-0 flex-1 overflow-hidden bg-zinc-50/30">
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
          selectedDeviceId={selectedDeviceId}
        />

        <div className="flex h-1 items-center justify-center bg-white">
          <div className="h-1 w-12 rounded-full bg-zinc-200" />
        </div>
      </motion.div>
    </div>
  );
};
