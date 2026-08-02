/**
 * @purpose 用 mock 字幕驱动的扩展面板演示容器。
 * @role    ScriptedPanel 的内层；本目录组件树的根。
 * @deps    ./SubtitlePanelShell、./SubtitleItem、./SubtitleStates、./ExplainView
 * @gotcha  这是扩展面板的**副本**而非共享代码，扩展改了不会同步；且当前整棵树未被页面引用
 */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { SubtitlePanelShell } from "./SubtitlePanelShell";
import { SubtitleItemComponent } from "./SubtitleItem";
import { SubtitleStates } from "./SubtitleStates";
import { ExplainView } from "./ExplainView";
import type { SubtitleItem } from "./subtitleTypes";

const MOCK_SUBTITLES: SubtitleItem[] = [
  { id: "s1", startTime: 0, endTime: 12, text: "Today we're going to learn ten common English idioms." },
  { id: "s2", startTime: 12, endTime: 24, text: "These are phrases native speakers use every day." },
  { id: "s3", startTime: 24, endTime: 35, text: 'The first one is "break the ice."' },
  { id: "s4", startTime: 35, endTime: 48, text: "It means to start a conversation in a social setting." },
  { id: "s5", startTime: 48, endTime: 62, text: "For example, you might tell a joke to break the ice." },
  { id: "s6", startTime: 62, endTime: 75, text: '"Hit the books" — this means to study hard.' },
  { id: "s7", startTime: 75, endTime: 88, text: "I need to hit the books before my exam tomorrow." },
  { id: "s8", startTime: 88, endTime: 102, text: 'Let\'s try one more: "piece of cake."' },
  { id: "s9", startTime: 102, endTime: 116, text: "This idiom means something is very easy to do." },
  { id: "s10", startTime: 116, endTime: 129, text: '"The test was a piece of cake."' },
  { id: "s11", startTime: 129, endTime: 143, text: "Now I'll explain a slightly harder one." },
  { id: "s12", startTime: 143, endTime: 157, text: '"Bite the bullet" — doing something difficult you\'ve been avoiding.' },
  { id: "s13", startTime: 157, endTime: 171, text: "Try using these idioms this week and let me know how it goes." },
];

interface RealExtensionPanelProps {
  width?: number;
  height?: number;
  view?: "list" | "explain";
  onViewChange?: (v: "list" | "explain") => void;
  showSelection?: boolean;
}

export function RealExtensionPanel({
  width = 380,
  height = 580,
  view = "list",
  onViewChange,
  showSelection = false,
}: RealExtensionPanelProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLooping, setIsLooping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);

  // Auto-advance
  useEffect(() => {
    if (!isPlaying || view !== "list") return;
    const id = setInterval(() => {
      setActiveIndex(i => (i + 1 < MOCK_SUBTITLES.length ? i + 1 : 0));
    }, 2800);
    return () => clearInterval(id);
  }, [isPlaying, view]);

  // Auto-scroll active into view
  useEffect(() => {
    if (view !== "list" || !activeItemRef.current || !listRef.current) return;
    const c = listRef.current;
    const el = activeItemRef.current;
    const offset = el.offsetTop - c.offsetHeight / 2 + el.offsetHeight / 2;
    c.scrollTo({ top: offset, behavior: "smooth" });
  }, [activeIndex, view]);

  const currentSubtitle = MOCK_SUBTITLES[activeIndex] ?? null;

  const listContent = (
    <SubtitleStates isAd={false} error={null} loading={false} isEmpty={false}>
      <div ref={listRef} className="h-full overflow-y-auto bg-zinc-50/30">
        {MOCK_SUBTITLES.map((sub, idx) => (
          <div key={sub.id} ref={idx === activeIndex ? activeItemRef : null}>
            <SubtitleItemComponent
              subtitle={sub}
              index={idx}
              isActive={idx === activeIndex}
              showTip={idx === 4 && showSelection}
              tipWord="break"
              onSubtitleClick={(_s, i) => { setActiveIndex(i); setIsPlaying(true); }}
              onRequestExplain={() => onViewChange?.("explain")}
            />
          </div>
        ))}
      </div>
    </SubtitleStates>
  );

  if (view === "explain") {
    return (
      <div style={{ width, height, position: "relative" }}>
        <SubtitlePanelShell
          className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-none"
          subtitles={MOCK_SUBTITLES}
          isCollapsed={false}
          onToggleCollapse={() => {}}
          onHeaderHeightChange={() => {}}
          onOpenAiSettings={() => {}}
          toastMessage={null}
          listContent={listContent}
          showReturnToActive={false}
          onReturnToActive={() => {}}
          isPlaying={isPlaying}
          onTogglePlayback={() => setIsPlaying(v => !v)}
          currentSubtitle={currentSubtitle}
          isCurrentSubtitleActive={true}
          isLooping={isLooping}
          onToggleLoop={() => setIsLooping(v => !v)}
          isSegmentPlaying={false}
        />
        {/* Explain card overlaid */}
        <ExplainView onClose={() => onViewChange?.("list")} />
      </div>
    );
  }

  return (
    <div style={{ width, height }}>
      <SubtitlePanelShell
        className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-none"
        subtitles={MOCK_SUBTITLES}
        isCollapsed={false}
        onToggleCollapse={() => {}}
        onHeaderHeightChange={() => {}}
        onOpenAiSettings={() => {}}
        toastMessage={null}
        listContent={listContent}
        showReturnToActive={false}
        onReturnToActive={() => {}}
        isPlaying={isPlaying}
        onTogglePlayback={() => setIsPlaying(v => !v)}
        currentSubtitle={currentSubtitle}
        isCurrentSubtitleActive={true}
        isLooping={isLooping}
        onToggleLoop={() => setIsLooping(v => !v)}
        isSegmentPlaying={false}
      />
    </div>
  );
}
