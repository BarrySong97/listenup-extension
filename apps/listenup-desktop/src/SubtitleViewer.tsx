/**
 * @purpose 复用列表字幕、无字幕/错误空态与缺译文引导的展示层。
 * @role    main BrowserSource 与 player-ui EmbeddedSource 共用的下半区 viewer。
 * @deps    SubtitleList、TranslationMissingState、virtua、DisplayBlock
 * @gotcha  只接收 active/played 边界，不订阅连续 currentTime，保持 React cursor 渲染边界。
 */
import type { RefObject } from "react";
import type { VListHandle } from "virtua";
import { SubtitleList, type DisplayBlock } from "./SubtitleList";
import {
  TranslationMissingState,
  type TranslationCopyStatus,
} from "./TranslationMissingState";

interface SubtitleViewerProps {
  activeIndex: number;
  blocks: DisplayBlock[];
  connected: boolean;
  copyStatus: TranslationCopyStatus;
  emptyMessage: string | null;
  isScrolling: boolean;
  listRef: RefObject<VListHandle | null>;
  onCopyTranslationPrompt: () => void;
  onScroll: () => void;
  onScrollEnd: () => void;
  onSeek: (seekTime: number) => void;
  playedThroughIndex: number;
  seekDisabled: boolean;
  translationMissing: boolean;
}

export const SubtitleViewer = ({
  activeIndex,
  blocks,
  connected,
  copyStatus,
  emptyMessage,
  isScrolling,
  listRef,
  onCopyTranslationPrompt,
  onScroll,
  onScrollEnd,
  onSeek,
  playedThroughIndex,
  seekDisabled,
  translationMissing,
}: SubtitleViewerProps) => {
  if (translationMissing) {
    return (
      <TranslationMissingState
        copyStatus={copyStatus}
        onCopy={onCopyTranslationPrompt}
      />
    );
  }
  if (emptyMessage) {
    return (
      <div className="grid min-h-full place-content-center justify-items-center text-center text-fg-muted">
        <div className="mb-3 grid h-8 w-11 place-items-center rounded-[7px] border border-white/25 text-xs font-bold text-fg">
          CC
        </div>
        <p className="m-0 mb-1.5 text-[13px] text-fg">{emptyMessage}</p>
        {!connected && (
          <small className="max-w-[280px] leading-normal text-fg-faint">
            在 YouTube 播放带字幕的视频，字幕会自动连接过来。
          </small>
        )}
      </div>
    );
  }
  return (
    <SubtitleList
      listRef={listRef}
      blocks={blocks}
      activeIndex={activeIndex}
      playedThroughIndex={playedThroughIndex}
      isScrolling={isScrolling}
      onScroll={onScroll}
      onScrollEnd={onScrollEnd}
      onSeek={onSeek}
      seekDisabled={seekDisabled}
    />
  );
};
