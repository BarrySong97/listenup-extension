/**
 * @purpose 字幕面板实验室：用 mock 数据复现 loaded/loading/empty/error/ad 及 Explain 卡片各态。
 * @role    脱离 YouTube 迭代面板 UI 的预览页，直接复用内容脚本组件。
 * @deps    pages/content/components/*、pages/content/hooks/usePanelToast、services 的类型
 * @gotcha  只能验证视觉与局部交互，证明不了字幕抓取/播放器同步/Shadow DOM 行为。见 docs/testing.md
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { iconScale } from "@src/components/ui/iconScale";
import { SubtitleStates } from "@pages/content/components/SubtitleStates";
import { SubtitleItemComponent } from "@pages/content/components/SubtitleItem";
import { SubtitlePanelShell } from "@pages/content/components/SubtitlePanelShell";
import { ExplainCard } from "@pages/content/components/ExplainCard";
import { AiSettingsCard } from "@pages/content/components/AiSettingsCard";
import { usePanelToast } from "@pages/content/hooks/usePanelToast";
import type { SubtitleItem } from "@pages/content/lib/subtitles/subtitleTypes";
import type { ExplainResult } from "@src/services/ai/explainSchema";
import type { ImageSearchResult } from "@src/services/search/imageSearch";
import type { AiSettings } from "@src/services/ai/aiSettings";

const MOCK_EXPLAIN_DATA: ExplainResult = {
  partOfSpeech: "adjective",
  phonetics: { us: "næˌvəˈɡeɪʃənəl", uk: "nævɪˈɡeɪʃənəl" },
  meaningExplain: "Related to finding or directing the course of a ship.",
  detailExplain: [
    "Helps the ship know where to go.",
    "Involves tools and methods for steering.",
    "Can include maps, stars, or technology.",
  ],
};

const MOCK_EXPLAIN_IMAGES: ImageSearchResult[] = [
  { thumbnailUrl: "https://placehold.co/120x120/e2e8f0/64748b?text=Map", sourceUrl: "#" },
  { thumbnailUrl: "https://placehold.co/120x120/fecaca/9f1239?text=Compass", sourceUrl: "#" },
  { thumbnailUrl: "https://placehold.co/120x120/bfdbfe/1e3a8a?text=Chart", sourceUrl: "#" },
  { thumbnailUrl: "https://placehold.co/120x120/fde68a/78350f?text=Globe", sourceUrl: "#" },
  { thumbnailUrl: "https://placehold.co/120x120/bbf7d0/14532d?text=Stars", sourceUrl: "#" },
];

const MOCK_EXPLAIN_SETTINGS: AiSettings = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "mock",
  model: "gpt-4o-mini",
  imageSearchEngine: "bing",
};

type PreviewState = "loaded" | "loading" | "empty" | "error" | "ad";

const mockSubtitles: SubtitleItem[] = [
  {
    id: "s1",
    startTime: 0,
    endTime: 12,
    text: "Welcome to today's deep dive into modern frontend development workflows.",
  },
  {
    id: "s2",
    startTime: 12,
    endTime: 24,
    text: "We will be exploring how browser extensions are changing the way we consume video content.",
  },
  {
    id: "s3",
    startTime: 24,
    endTime: 35,
    text: "This particular widget is designed to be compact and efficient for language learners.",
  },
  {
    id: "s4",
    startTime: 35,
    endTime: 48,
    text: "Notice how the timestamps allow for quick navigation between different segments.",
  },
  {
    id: "s5",
    startTime: 48,
    endTime: 62,
    text: "By highlighting the current sentence, we ensure the user stays focused on the audio.",
  },
  {
    id: "s6",
    startTime: 62,
    endTime: 75,
    text: "The goal is to provide a seamless experience without blocking the main video interface.",
  },
  {
    id: "s7",
    startTime: 75,
    endTime: 88,
    text: "Users can repeat loops, start recordings, or copy text for further study.",
  },
  {
    id: "s8",
    startTime: 88,
    endTime: 102,
    text: "A dedicated preview page makes rapid UI iteration much faster than reloading YouTube.",
  },
  {
    id: "s9",
    startTime: 102,
    endTime: 116,
    text: "When the active sentence leaves the viewport, a floating return control should help users jump back instantly.",
  },
  {
    id: "s10",
    startTime: 116,
    endTime: 129,
    text: "Spacing, icon hierarchy, and scroll behavior all become easier to tune when the preview list is long enough.",
  },
  {
    id: "s11",
    startTime: 129,
    endTime: 143,
    text: "A compact timestamp column keeps navigation precise while still leaving enough width for comfortable reading.",
  },
  {
    id: "s12",
    startTime: 143,
    endTime: 157,
    text: "The middle playback divider is meant to visually separate the transcript area from the current focus tools below.",
  },
  {
    id: "s13",
    startTime: 157,
    endTime: 171,
    text: "Loop and recording controls can stay secondary, while the active sentence block remains readable at a glance.",
  },
  {
    id: "s14",
    startTime: 171,
    endTime: 186,
    text: "Longer preview data also makes it easier to validate hover states, active highlighting, and list density decisions.",
  },
  {
    id: "s15",
    startTime: 186,
    endTime: 201,
    text: "This should now give enough vertical depth to test list scrolling without relying on a real YouTube subtitle track.",
  },
];

const previewStateLabels: Array<{ key: PreviewState; label: string }> = [
  { key: "loaded", label: "Loaded" },
  { key: "loading", label: "Loading" },
  { key: "empty", label: "Empty" },
  { key: "error", label: "Error" },
  { key: "ad", label: "Ad" },
];

type ExplainPreviewState = "hidden" | "loading" | "loaded" | "error";

export default function Newtab() {
  const [previewState, setPreviewState] = useState<PreviewState>("loaded");
  const [activeIndex, setActiveIndex] = useState(2);
  const [isOpen, setIsOpen] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [explainPreview, setExplainPreview] = useState<ExplainPreviewState>("hidden");
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState(56);
  const [isSegmentPlaying, setIsSegmentPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [showReturnToActive, setShowReturnToActive] = useState(false);
  const previewListRef = useRef<HTMLDivElement | null>(null);
  const activeItemRef = useRef<HTMLDivElement | null>(null);
  const isReturningToActiveRef = useRef(false);
  const returnToActiveTimeoutRef = useRef<number | null>(null);
  const { toastMessage, showToast } = usePanelToast();

  const subtitles = previewState === "empty" ? [] : mockSubtitles;
  const currentSubtitle =
    activeIndex >= 0 && activeIndex < subtitles.length ? subtitles[activeIndex] : null;
  const [displaySubtitle, setDisplaySubtitle] = useState(currentSubtitle);

  useEffect(() => {
    if (currentSubtitle) {
      setDisplaySubtitle(currentSubtitle);
    }
  }, [currentSubtitle]);

  const errorMessage =
    previewState === "error"
      ? "Failed to load subtitles. This preview mode is intentionally simulating an error state."
      : null;

  const panelSummary = useMemo(() => {
    if (previewState !== "loaded") return previewState;
    return `${subtitles.length} subtitles`;
  }, [previewState, subtitles.length]);

  const handleSubtitleClick = (_subtitle: SubtitleItem, index: number) => {
    setActiveIndex(index);
  };

  const updateReturnToActiveVisibility = useCallback(() => {
    if (previewState !== "loaded" || !isOpen) {
      setShowReturnToActive(false);
      return;
    }

    if (isReturningToActiveRef.current) {
      setShowReturnToActive(false);
      return;
    }

    const list = previewListRef.current;
    const activeItem = activeItemRef.current;

    if (!list || !activeItem) {
      setShowReturnToActive(false);
      return;
    }

    const listRect = list.getBoundingClientRect();
    const activeRect = activeItem.getBoundingClientRect();
    const padding = 8;
    const isVisible =
      activeRect.top >= listRect.top + padding &&
      activeRect.bottom <= listRect.bottom - padding;

    setShowReturnToActive(!isVisible);
  }, [isOpen, previewState]);

  const returnToActiveSubtitle = useCallback(() => {
    if (!activeItemRef.current) return;

    isReturningToActiveRef.current = true;
    setShowReturnToActive(false);
    activeItemRef.current.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });

    if (returnToActiveTimeoutRef.current) {
      window.clearTimeout(returnToActiveTimeoutRef.current);
    }

    returnToActiveTimeoutRef.current = window.setTimeout(() => {
      isReturningToActiveRef.current = false;
      updateReturnToActiveVisibility();
      returnToActiveTimeoutRef.current = null;
    }, 450);
  }, [updateReturnToActiveVisibility]);

  useEffect(() => {
    return () => {
      if (returnToActiveTimeoutRef.current) {
        window.clearTimeout(returnToActiveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      updateReturnToActiveVisibility();
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [activeIndex, isOpen, previewState, subtitles.length, updateReturnToActiveVisibility]);

  const resetToLoaded = () => {
    setPreviewState("loaded");
    setIsOpen(true);
    setIsCollapsed(false);
    setActiveIndex(2);
    setIsSegmentPlaying(false);
    setIsLooping(false);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#f5f7fb_0%,#eef2f7_45%,#e5e7eb_100%)] text-zinc-900">
      <div className="mx-auto flex min-h-screen max-w-7xl gap-10 px-8 py-10">
        <section className="w-[23rem] shrink-0 space-y-5">
          <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.10)] backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-sm">
                <Icon icon="mdi:monitor-dashboard" className={iconScale.surface} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
                  UI Preview
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                  Subtitle Panel Lab
                </h1>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-zinc-600">
              Use this page to iterate on the panel without reloading YouTube.
              State switches below simulate list, empty, error, and ad modes.
            </p>

            <div className="mt-6 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Preview State
              </p>
              <div className="flex flex-wrap gap-2">
                {previewStateLabels.map((item) => (
                  <Button
                    key={item.key}
                    size="sm"
                    variant={previewState === item.key ? "solid" : "flat"}
                    color={previewState === item.key ? "primary" : "default"}
                    className="min-w-0"
                    onPressStart={() => setPreviewState(item.key)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Quick Toggles
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="flat"
                  color="default"
                  onPressStart={() => setIsOpen((value) => !value)}
                >
                  {isOpen ? "Close Panel" : "Open Panel"}
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color={isSegmentPlaying ? "primary" : "default"}
                  onPressStart={() => setIsSegmentPlaying((value) => !value)}
                >
                  {isSegmentPlaying ? "Pause Mock Playback" : "Play Mock Segment"}
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color={isLooping ? "primary" : "default"}
                  onPressStart={() => setIsLooping((value) => !value)}
                >
                  {isLooping ? "Disable Loop" : "Enable Loop"}
                </Button>
                <Button size="sm" variant="flat" color="default" onPressStart={resetToLoaded}>
                  Reset
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color={explainPreview !== "hidden" ? "primary" : "default"}
                  onPressStart={() =>
                    setExplainPreview((cur) => {
                      if (cur === "hidden") return "loaded";
                      if (cur === "loaded") return "loading";
                      if (cur === "loading") return "error";
                      return "hidden";
                    })
                  }
                >
                  {explainPreview === "hidden"
                    ? "Show Explain Card"
                    : explainPreview === "loaded"
                    ? "Explain: Loading"
                    : explainPreview === "loading"
                    ? "Explain: Error"
                    : "Hide Explain Card"}
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color={isAiSettingsOpen ? "primary" : "default"}
                  onPressStart={() => setIsAiSettingsOpen((current) => !current)}
                >
                  {isAiSettingsOpen ? "Hide AI Settings" : "Show AI Settings"}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.10)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
              Current Setup
            </p>
            <div className="mt-4 space-y-2 text-sm text-zinc-600">
              <p>
                Panel: {isOpen ? (isCollapsed ? "Collapsed" : "Expanded") : "Hidden"}
              </p>
              <p>State: {panelSummary}</p>
              <p>Active subtitle: {currentSubtitle ? activeIndex + 1 : "None"}</p>
              <p>Loop: {isLooping ? "On" : "Off"}</p>
              <p>Playback: {isSegmentPlaying ? "Playing" : "Paused"}</p>
            </div>
          </div>
        </section>

        <section className="flex min-h-[calc(100vh-5rem)] flex-1 items-center justify-center">
          <div className="relative w-full max-w-4xl rounded-[2rem] border border-white/60 bg-white/55 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
            <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />

            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
                  Live Canvas
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">
                  Extension Panel Preview
                </h2>
              </div>
              <div className="rounded-full border border-white/70 bg-white/80 px-4 py-2 text-xs font-medium text-zinc-500">
                `npm run dev` + open a new tab
              </div>
            </div>

            <div className="flex min-h-[42rem] items-start justify-center rounded-[1.5rem] border border-dashed border-zinc-300/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.85)_0%,rgba(244,244,245,0.85)_100%)] p-8">
              {isOpen ? (
                <motion.div
                  initial={false}
                  animate={{ height: isCollapsed ? collapsedHeight : 600 }}
                  transition={{
                    height: {
                      duration: 0.22,
                      ease: [0.22, 1, 0.36, 1],
                    },
                  }}
                  className="relative w-[392px] overflow-visible"
                >
                  <SubtitlePanelShell
                    className="flex h-full w-[392px] flex-col overflow-visible rounded-lg border border-zinc-200 bg-white font-['Inter',ui-sans-serif,system-ui,sans-serif] shadow-2xl"
                    subtitles={subtitles}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={() =>
                      setIsCollapsed((currentCollapsed) => !currentCollapsed)
                    }
                    onHeaderHeightChange={setCollapsedHeight}
                    onOpenAiSettings={() => setIsAiSettingsOpen(true)}
                    toastMessage={toastMessage}
                    listContent={
                      <SubtitleStates
                        isAd={previewState === "ad"}
                        error={errorMessage}
                        loading={previewState === "loading"}
                        isEmpty={previewState === "empty"}
                      >
                        <div
                          ref={previewListRef}
                          className="h-full overflow-y-auto bg-zinc-50/30"
                          onScroll={updateReturnToActiveVisibility}
                        >
                          {subtitles.map((subtitle, index) => (
                            <div
                              key={subtitle.id}
                              ref={index === activeIndex ? activeItemRef : null}
                            >
                              <SubtitleItemComponent
                                subtitle={subtitle}
                                index={index}
                                isActive={index === activeIndex}
                                onSubtitleClick={handleSubtitleClick}
                                onToast={showToast}
                              />
                            </div>
                          ))}
                        </div>
                      </SubtitleStates>
                    }
                    showReturnToActive={showReturnToActive}
                    onReturnToActive={returnToActiveSubtitle}
                    isPlaying={isSegmentPlaying}
                    onTogglePlayback={() => setIsSegmentPlaying((value) => !value)}
                    currentSubtitle={displaySubtitle}
                    isCurrentSubtitleActive={
                      previewState === "loaded" && Boolean(currentSubtitle)
                    }
                    isLooping={isLooping}
                    onToggleLoop={() => setIsLooping((value) => !value)}
                    isSegmentPlaying={isSegmentPlaying}
                  />

                  <ExplainCard
                    target={
                      explainPreview === "hidden"
                        ? null
                        : { text: "navigational", context: "I'm on a ship, so it must be a navigational issue." }
                    }
                    data={explainPreview === "loaded" ? MOCK_EXPLAIN_DATA : null}
                    loading={explainPreview === "loading"}
                    error={
                      explainPreview === "error"
                        ? "Mock error: please configure the AI provider in Options."
                        : null
                    }
                    streamText={
                      explainPreview === "loading"
                        ? '{\n  "partOfSpeech": "adjective",\n  "phonetics": { "us": "næˌvəˈɡeɪʃənəl", "uk": "nævɪˈɡeɪʃənəl" },\n  "meaningExplain": "Related to finding direction on a ship",\n  "detailExplain": [\n    "Describes tools or problems about navigation",\n    "Used here to explain the kind of issue on the ship"\n  ]\n}'
                        : ""
                    }
                    images={explainPreview === "loaded" ? MOCK_EXPLAIN_IMAGES : []}
                    imagesLoading={explainPreview === "loading"}
                    settings={MOCK_EXPLAIN_SETTINGS}
                    onClose={() => setExplainPreview("hidden")}
                    onRefresh={() => setExplainPreview("loading")}
                    onOpenSettings={() => setIsAiSettingsOpen(true)}
                  />

                  <AiSettingsCard
                    isOpen={isAiSettingsOpen}
                    onClose={() => setIsAiSettingsOpen(false)}
                  />
                </motion.div>
              ) : (
                <Button
                  isIconOnly
                  radius="full"
                  color="default"
                  variant="solid"
                  className="h-16 w-16 bg-zinc-900 text-white shadow-[0_14px_30px_rgba(15,23,42,0.22)] transition-colors hover:bg-zinc-800"
                  onPressStart={() => setIsOpen(true)}
                  aria-label="Open Listen Up panel"
                >
                  <Icon
                    icon="mdi:subtitles-outline"
                    className={iconScale.canvasLauncher}
                  />
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
