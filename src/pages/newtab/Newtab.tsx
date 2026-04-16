import { useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { iconScale } from "@src/components/ui/iconScale";
import { SubtitleHeader } from "@pages/content/components/SubtitleHeader";
import { SubtitleStates } from "@pages/content/components/SubtitleStates";
import { SubtitleItemComponent } from "@pages/content/components/SubtitleItem";
import { PlaybackDivider } from "@pages/content/components/PlaybackDivider";
import { ActiveSegmentPanel } from "@pages/content/components/ActiveSegmentPanel";
import { SubtitleFooter } from "@pages/content/components/SubtitleFooter";
import type { SubtitleItem } from "@pages/content/lib/subtitles/subtitleTypes";

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
];

const previewStateLabels: Array<{ key: PreviewState; label: string }> = [
  { key: "loaded", label: "Loaded" },
  { key: "loading", label: "Loading" },
  { key: "empty", label: "Empty" },
  { key: "error", label: "Error" },
  { key: "ad", label: "Ad" },
];

export default function Newtab() {
  const [previewState, setPreviewState] = useState<PreviewState>("loaded");
  const [activeIndex, setActiveIndex] = useState(2);
  const [isOpen, setIsOpen] = useState(true);
  const [isSegmentPlaying, setIsSegmentPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);

  const subtitles = previewState === "empty" ? [] : mockSubtitles;
  const currentSubtitle =
    activeIndex >= 0 && activeIndex < subtitles.length ? subtitles[activeIndex] : null;

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

  const resetToLoaded = () => {
    setPreviewState("loaded");
    setIsOpen(true);
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
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.10)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
              Current Setup
            </p>
            <div className="mt-4 space-y-2 text-sm text-zinc-600">
              <p>Panel: {isOpen ? "Visible" : "Collapsed"}</p>
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

            <div className="flex min-h-[42rem] items-center justify-center rounded-[1.5rem] border border-dashed border-zinc-300/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.85)_0%,rgba(244,244,245,0.85)_100%)] p-8">
              {isOpen ? (
                <div className="flex h-[600px] w-[360px] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white font-['Inter',ui-sans-serif,system-ui,sans-serif] shadow-2xl">
                  <SubtitleHeader
                    subtitles={subtitles}
                    onClose={() => setIsOpen(false)}
                  />

                  <div className="min-h-0 flex-1 bg-zinc-50/30">
                    <SubtitleStates
                      isAd={previewState === "ad"}
                      error={errorMessage}
                      loading={previewState === "loading"}
                      isEmpty={previewState === "empty"}
                    >
                      <div className="h-full overflow-y-auto bg-zinc-50/30">
                        {subtitles.map((subtitle, index) => (
                          <SubtitleItemComponent
                            key={subtitle.id}
                            subtitle={subtitle}
                            index={index}
                            isActive={index === activeIndex}
                            onSubtitleClick={handleSubtitleClick}
                          />
                        ))}
                      </div>
                    </SubtitleStates>
                  </div>

                  <PlaybackDivider
                    isPlaying={isSegmentPlaying}
                    onTogglePlayback={() => setIsSegmentPlaying((value) => !value)}
                  />

                  <ActiveSegmentPanel
                    currentSubtitle={currentSubtitle}
                    isActive={previewState === "loaded" && Boolean(currentSubtitle)}
                  />

                  <SubtitleFooter
                    currentSubtitle={currentSubtitle}
                    isActive={previewState === "loaded" && Boolean(currentSubtitle)}
                    isLooping={isLooping}
                    onToggleLoop={() => setIsLooping((value) => !value)}
                    isSegmentPlaying={isSegmentPlaying}
                  />

                  <div className="flex h-1 items-center justify-center bg-white">
                    <div className="h-1 w-12 rounded-full bg-zinc-200" />
                  </div>
                </div>
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
