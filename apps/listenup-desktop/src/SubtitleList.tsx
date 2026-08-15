/**
 * @purpose 渲染并虚拟化 Desktop 字幕列表，只响应字幕边界而非连续播放时间。
 * @role    App 的高成本列表子树；通过 memo 隔离 100ms cursor 更新。
 * @deps    react、react-i18next、virtua、DesktopRowButton、./subtitleCursor
 * @gotcha  props 不得接收 currentTime/cursor；seek 只传稳定 callback 与 disabled primitive。
 */
import { memo, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { VList, type VListHandle } from "virtua";
import { DesktopRowButton } from "./components/ui/DesktopRowButton";
import type { TimedSubtitleBlock } from "./subtitleCursor";

export interface DisplayBlock extends TimedSubtitleBlock {
  id: string;
  sourceText: string | null;
  translationText: string | null;
}

interface SubtitleRowProps {
  index: number;
  isActive: boolean;
  isPlayed: boolean;
  isSeekDisabled: boolean;
  onSeek: (time: number) => void;
  subtitle: DisplayBlock;
}

const formatTime = (seconds: number) => {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = Math.floor(safeSeconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
};

const SubtitleRow = memo(function SubtitleRow({
  index,
  isActive,
  isPlayed,
  isSeekDisabled,
  onSeek,
  subtitle,
}: SubtitleRowProps) {
  const { t } = useTranslation();
  return (
    <DesktopRowButton
      aria-label={t("playback.seekTo", { time: formatTime(subtitle.startTime) })}
      className={`group relative isolate mx-2 grid h-auto w-[calc(100%-1rem)] grid-cols-[12px_40px_minmax(0,1fr)] items-start justify-start gap-2 overflow-hidden whitespace-normal rounded-[10px] py-2 pl-2.5 pr-2 text-left [contain:paint] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/35 ${
        isActive ? "bg-wash-active" : ""
      } ${
        isSeekDisabled
          ? "cursor-not-allowed opacity-70"
          : "cursor-pointer"
      }`}
      data-subtitle-index={index}
      isDisabled={isSeekDisabled}
      onClick={() => onSeek(subtitle.startTime)}
    >
      {!isSeekDisabled && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 rounded-[10px] bg-white/[0.07] opacity-0 [backface-visibility:hidden] [transform:translateZ(0)] [will-change:opacity] group-hover:opacity-100"
        />
      )}
      <span
        className={`mt-1.5 h-1.5 w-1.5 rounded-full transition-all ${
          isActive
            ? "bg-yt shadow-[0_0_8px_rgba(255,0,51,0.8)]"
            : isPlayed
              ? "bg-white/30"
              : "bg-white/15"
        }`}
      />
      <time
        className={`pt-0.5 text-[10px] tracking-[0.02em] tabular-nums ${
          isActive ? "text-white/75" : "text-fg-faint"
        }`}
      >
        {formatTime(subtitle.startTime)}
      </time>
      <div className="min-w-0">
        {subtitle.sourceText && (
          <p
            className={`m-0 whitespace-pre-line text-[13px] leading-[1.55] ${
              isActive ? "font-medium text-fg" : "text-fg-muted"
            }`}
          >
            {subtitle.sourceText}
          </p>
        )}
        {subtitle.translationText && (
          <p
            className={`m-0 whitespace-pre-line leading-[1.55] ${
              subtitle.sourceText ? "mt-1 text-[12px]" : "text-[13px]"
            } ${isActive ? "font-medium text-white" : "text-white/75"}`}
          >
            {subtitle.translationText}
          </p>
        )}
      </div>
    </DesktopRowButton>
  );
});

interface SubtitleListProps {
  activeIndex: number;
  blocks: DisplayBlock[];
  isScrolling: boolean;
  listRef: RefObject<VListHandle | null>;
  onScroll: () => void;
  onScrollEnd: () => void;
  onSeek: (time: number) => void;
  playedThroughIndex: number;
  seekDisabled: boolean;
}

export const SubtitleList = memo(function SubtitleList({
  activeIndex,
  blocks,
  isScrolling,
  listRef,
  onScroll,
  onScrollEnd,
  onSeek,
  playedThroughIndex,
  seekDisabled,
}: SubtitleListProps) {
  return (
    <VList
      ref={listRef}
      style={{ height: "100%" }}
      className={`subtitle-list ${isScrolling ? "scrolling" : ""}`}
      onScroll={onScroll}
      onScrollEnd={onScrollEnd}
    >
      {blocks.map((subtitle, index) => (
        <SubtitleRow
          key={`${subtitle.id}-${index}`}
          index={index}
          subtitle={subtitle}
          isActive={index === activeIndex}
          isPlayed={index <= playedThroughIndex && index !== activeIndex}
          isSeekDisabled={seekDisabled}
          onSeek={onSeek}
        />
      ))}
    </VList>
  );
});
