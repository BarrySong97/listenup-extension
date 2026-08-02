/**
 * @purpose 演示面板外壳：头部、toast、列表、分隔条与当前句区域。
 * @role    website 侧的面板布局层（扩展同名组件的副本）。
 * @deps    framer-motion、同目录的 header/toast/divider 组件、./useAudioInputSettings
 * @gotcha  对应扩展的 pages/content/components/SubtitlePanelShell.tsx，两边会分叉
 */
"use client";
import { FC, ReactNode, useEffect, useRef, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { SubtitleHeader } from "./SubtitleHeader";
import { SubtitlePanelToast } from "./SubtitlePanelToast";
import { PlaybackDivider } from "./PlaybackDivider";
import { ActiveSegmentPanel } from "./ActiveSegmentPanel";
import { SubtitleItem } from "./subtitleTypes";
import { useAudioInputSettings } from "./useAudioInputSettings";

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
  style?: CSSProperties;
  onHeaderHeightChange?: (height: number) => void;
  onOpenAiSettings: () => void;
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
  className,
  style,
  onHeaderHeightChange,
  onOpenAiSettings,
}) => {
  const {
    devices,
    selectedDeviceId,
    selectedDeviceLabel,
    error,
    refreshDevices,
    setSelectedDeviceId,
  } = useAudioInputSettings();
  const headerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!headerRef.current || !onHeaderHeightChange) {
      return;
    }

    const headerElement = headerRef.current;
    const syncHeight = () => {
      onHeaderHeightChange(Math.ceil(headerElement.getBoundingClientRect().height));
    };

    syncHeight();

    const observer = new ResizeObserver(() => {
      syncHeight();
    });
    observer.observe(headerElement);

    return () => {
      observer.disconnect();
    };
  }, [onHeaderHeightChange]);

  return (
    <div
      style={style}
      className={
        className ??
        "flex h-full flex-col overflow-visible rounded-lg border border-zinc-200 bg-white font-['Inter',ui-sans-serif,system-ui,sans-serif] shadow-[0_20px_40px_rgba(15,23,42,0.18)]"
      }
    >
      <div ref={headerRef}>
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
          onOpenAiSettings={onOpenAiSettings}
        />
      </div>

      <motion.div
        initial={false}
        animate={{
          opacity: isCollapsed ? 0 : 1,
          y: isCollapsed ? -6 : 0,
        }}
        transition={{
          duration: 0.16,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{
          pointerEvents: isCollapsed ? "none" : "auto",
        }}
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

        <div className="flex h-1 items-center justify-center bg-white">
          <div className="h-1 w-12 rounded-full bg-zinc-200" />
        </div>
      </motion.div>
    </div>
  );
};
