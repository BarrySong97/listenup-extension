import { FC, useCallback, useEffect, useRef, useState } from "react";
import { youtubeSDK, YouTubeTheme } from "@pages/content/lib/youtube-sdk";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Button } from "@heroui/react";
import { iconScale } from "@src/components/ui/iconScale";
import { SubtitleStates } from "./SubtitleStates";
import { useSubtitles } from "../hooks/useSubtitles";
import { useSubtitleSync } from "../hooks/useSubtitleSync";
import { VList } from "virtua";
import { SubtitleItemComponent } from "./SubtitleItem";
import { useSubtitleNavigation } from "../hooks/useSubtitleNavigation";
import { useSubtitleAutoScroll } from "../hooks/useSubtitleAutoScroll";
import { ActiveSegmentPanel } from "./ActiveSegmentPanel";
import { PlaybackDivider } from "./PlaybackDivider";
import { ReturnToActiveButton } from "./ReturnToActiveButton";
import { SubtitleFooter } from "./SubtitleFooter";
import { useSubtitleLoop } from "../hooks/useSubtitleLoop";
import { SubtitleHeader } from "./SubtitleHeader";

export interface SubtitlesProps {}

const panelAnimation = {
  initial: { x: 380, opacity: 0.6 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 380, opacity: 0.6 },
};

const Subtitles: FC<SubtitlesProps> = () => {
  const [youtubeTheme, setYoutubeTheme] = useState<YouTubeTheme | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(youtubeSDK.getVideoId());
  const playStateCleanup = useRef<(() => void) | null>(null);
  const { subtitles, loading, error } = useSubtitles({
    enabled: !isAdPlaying,
    videoId,
  });
  const { currentSubtitleIndex, setCurrentTime } = useSubtitleSync(subtitles);
  const { handleSubtitleClick } = useSubtitleNavigation(subtitles);
  const {
    vListRef,
    showReturnToActive,
    returnToActiveSubtitle,
    handleListScroll,
    handleListScrollEnd,
  } = useSubtitleAutoScroll(currentSubtitleIndex, isAdPlaying);
  const { isLooping, toggleLooping, cleanup: cleanupLoop } = useSubtitleLoop();

  useEffect(() => {
    const header = document.querySelector("#masthead");
    if (header) {
      setHeaderHeight(header.clientHeight);
    }
  }, []);

  useEffect(() => {
    youtubeSDK.start({
      onThemeChange: (theme) => {
        setYoutubeTheme(theme);
      },
      onAdStateChange: (adState) => {
        setIsAdPlaying(adState.isAdPlaying);
      },
      onPlayerStateChange: (playerState) => {
        setCurrentTime(playerState.currentTime);
      },
      onSessionChange: (sessionState) => {
        setVideoId(sessionState.videoId);
      },
    });

    return () => {
      youtubeSDK.stop();
    };
  }, [setCurrentTime]);

  useEffect(() => {
    const player = youtubeSDK.getPlayerFacade();
    if (playStateCleanup.current) {
      playStateCleanup.current();
    }

    const cleanup = player.subscribePlayState((playing) => {
      setIsVideoPlaying(playing);
    });

    playStateCleanup.current = cleanup;
    setIsVideoPlaying(player.isPlaying());

    return () => {
      if (playStateCleanup.current) {
        playStateCleanup.current();
        playStateCleanup.current = null;
      }
    };
  }, [videoId]);

  useEffect(() => {
    return () => {
      cleanupLoop();
    };
  }, [cleanupLoop]);

  const currentSubtitle =
    currentSubtitleIndex >= 0 && currentSubtitleIndex < subtitles.length
      ? subtitles[currentSubtitleIndex]
      : null;

  const playCurrentSubtitle = useCallback(() => {
    if (!currentSubtitle) return;

    const player = youtubeSDK.getPlayerFacade();
    player.seekTo(currentSubtitle.startTime);
    player.play();
  }, [currentSubtitle]);

  const pauseCurrentVideo = useCallback(() => {
    youtubeSDK.getPlayerFacade().pause();
  }, []);

  const toggleVideoPlayback = useCallback(() => {
    if (isVideoPlaying) {
      pauseCurrentVideo();
      return;
    }

    playCurrentSubtitle();
  }, [isVideoPlaying, pauseCurrentVideo, playCurrentSubtitle]);

  return (
    <div className={youtubeTheme === "dark" ? "dark" : "light"}>
      <motion.div
        id="listenup"
        style={{
          height: "600px",
          width: "360px",
          top: headerHeight + 16,
          zIndex: 9999,
          position: "fixed",
          right: 12,
        }}
        initial="initial"
        animate={isOpen ? "animate" : "exit"}
        variants={panelAnimation}
        transition={{
          type: "spring",
          stiffness: 320,
          damping: 32,
        }}
        className={isOpen ? "pointer-events-auto" : "pointer-events-none"}
      >
        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white font-['Inter',ui-sans-serif,system-ui,sans-serif] shadow-2xl">
          <SubtitleHeader subtitles={subtitles} onClose={() => setIsOpen(false)} />

          <div className="relative min-h-0 flex-1 bg-zinc-50/30">
            <SubtitleStates
              isAd={isAdPlaying}
              error={error}
              loading={loading}
              isEmpty={subtitles.length === 0}
            >
              {!loading && !error && subtitles.length > 0 && (
                <VList
                  ref={vListRef}
                  style={{ height: "100%" }}
                  className="custom-scrollbar bg-zinc-50/30"
                  onScroll={handleListScroll}
                  onScrollEnd={handleListScrollEnd}
                >
                  {subtitles.map((subtitle, index) => (
                    <SubtitleItemComponent
                      key={subtitle.id}
                      subtitle={subtitle}
                      index={index}
                      isActive={index === currentSubtitleIndex}
                      onSubtitleClick={handleSubtitleClick}
                    />
                  ))}
                </VList>
              )}
            </SubtitleStates>

            <AnimatePresence>
              {showReturnToActive &&
                !loading &&
                !error &&
                subtitles.length > 0 && (
                  <ReturnToActiveButton onPress={returnToActiveSubtitle} />
                )}
            </AnimatePresence>
          </div>

          <PlaybackDivider
            isPlaying={isVideoPlaying}
            onTogglePlayback={toggleVideoPlayback}
          />

          <ActiveSegmentPanel
            currentSubtitle={currentSubtitle}
            isActive={
              !loading &&
              !error &&
              subtitles.length > 0 &&
              currentSubtitleIndex >= 0
            }
          />

          <SubtitleFooter
            currentSubtitle={currentSubtitle}
            isActive={
              !loading &&
              !error &&
              subtitles.length > 0 &&
              currentSubtitleIndex >= 0
            }
            isLooping={isLooping}
            onToggleLoop={() => toggleLooping(currentSubtitle)}
            isSegmentPlaying={isVideoPlaying}
          />

          <div className="flex h-1 items-center justify-center bg-white">
            <div className="h-1 w-12 rounded-full bg-zinc-200" />
          </div>
        </div>
      </motion.div>

      {!isOpen && (
        <div className="fixed bottom-4 right-6 z-[9999]">
          <Button
            isIconOnly
            radius="full"
            color="default"
            variant="solid"
            className="h-12 w-12 bg-zinc-900 text-white shadow-[0_14px_30px_rgba(15,23,42,0.22)] transition-colors hover:bg-zinc-800"
            onPressStart={() => setIsOpen(true)}
            aria-label="Open Listen Up panel"
          >
            <Icon icon="mdi:subtitles-outline" className={iconScale.launcher} />
          </Button>
        </div>
      )}
    </div>
  );
};

export default Subtitles;
