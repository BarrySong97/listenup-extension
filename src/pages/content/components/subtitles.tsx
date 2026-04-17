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
import { useSubtitleLoop } from "../hooks/useSubtitleLoop";
import { SubtitlePanelShell } from "./SubtitlePanelShell";
import { usePanelToast } from "../hooks/usePanelToast";

export interface SubtitlesProps {}
type PanelLayoutMode = "overlay" | "inline";

interface InlineLayoutSnapshot {
  host: HTMLElement;
  secondaryInner: HTMLElement;
  related: HTMLElement;
  hostOriginalParent: Node;
  hostOriginalNextSibling: ChildNode | null;
  relatedOriginalParent: Node;
  relatedOriginalNextSibling: ChildNode | null;
  hostStyle: string;
  secondaryInnerStyle: string;
  relatedStyle: string;
}

const panelAnimation = {
  initial: { x: 380, opacity: 0.6 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 380, opacity: 0.6 },
};

const findDirectChildById = <T extends HTMLElement>(
  parent: HTMLElement | null,
  id: string
): T | null => {
  if (!parent) {
    return null;
  }

  return (
    Array.from(parent.children).find(
      (child) => child instanceof HTMLElement && child.id === id
    ) as T | undefined
  ) ?? null;
};

const findActiveRelatedElement = () => {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>("ytd-watch-flexy #related")
  );

  return (
    candidates.find(
      (candidate) =>
        !candidate.closest("#watch-page-skeleton") &&
        !candidate.closest("#related-skeleton")
    ) ?? null
  );
};

const Subtitles: FC<SubtitlesProps> = () => {
  const [youtubeTheme, setYoutubeTheme] = useState<YouTubeTheme | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [playerHeight, setPlayerHeight] = useState<number | null>(null);
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [layoutMode, setLayoutMode] = useState<PanelLayoutMode>("overlay");
  const [videoId, setVideoId] = useState<string | null>(youtubeSDK.getVideoId());
  const playStateCleanup = useRef<(() => void) | null>(null);
  const inlineLayoutSnapshotRef = useRef<InlineLayoutSnapshot | null>(null);
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
  const { toastMessage, showToast } = usePanelToast();

  const syncLayoutMetrics = useCallback(() => {
    const header = document.querySelector("#masthead");
    if (header) {
      const nextHeaderHeight = header.clientHeight;
      setHeaderHeight((currentHeight) =>
        currentHeight === nextHeaderHeight ? currentHeight : nextHeaderHeight
      );
    }

    const player =
      document.querySelector<HTMLElement>("#movie_player") ??
      document.querySelector<HTMLElement>("ytd-watch-flexy #player") ??
      document.querySelector<HTMLElement>("#player-container-outer");

    if (!player) {
      return;
    }

    const nextPlayerHeight = Math.round(player.getBoundingClientRect().height);
    if (nextPlayerHeight > 0) {
      setPlayerHeight((currentHeight) =>
        currentHeight === nextPlayerHeight ? currentHeight : nextPlayerHeight
      );
    }
  }, []);

  useEffect(() => {
    syncLayoutMetrics();
  }, [syncLayoutMetrics, videoId]);

  const restoreOverlayLayout = useCallback(() => {
    const snapshot = inlineLayoutSnapshotRef.current;
    if (!snapshot) {
      setLayoutMode("overlay");
      return;
    }

    const {
      host,
      secondaryInner,
      related,
      hostOriginalParent,
      hostOriginalNextSibling,
      relatedOriginalParent,
      relatedOriginalNextSibling,
      hostStyle,
      secondaryInnerStyle,
      relatedStyle,
    } = snapshot;

    host.style.cssText = hostStyle;
    secondaryInner.style.cssText = secondaryInnerStyle;
    related.style.cssText = relatedStyle;

    if (hostOriginalParent.isConnected) {
      if (
        hostOriginalNextSibling &&
        hostOriginalNextSibling.parentNode === hostOriginalParent
      ) {
        hostOriginalParent.insertBefore(host, hostOriginalNextSibling);
      } else {
        hostOriginalParent.appendChild(host);
      }
    }

    if (relatedOriginalParent.isConnected) {
      if (
        relatedOriginalNextSibling &&
        relatedOriginalNextSibling.parentNode === relatedOriginalParent
      ) {
        relatedOriginalParent.insertBefore(related, relatedOriginalNextSibling);
      } else {
        relatedOriginalParent.appendChild(related);
      }
    }

    inlineLayoutSnapshotRef.current = null;
    setLayoutMode("overlay");
  }, []);

  const applyInlineLayout = useCallback(() => {
    const host = document.querySelector<HTMLElement>("#__listenup-extension-host");
    const columns = document.querySelector<HTMLElement>("ytd-watch-flexy #columns");
    const secondary = findDirectChildById<HTMLElement>(columns, "secondary");
    const secondaryInner =
      findDirectChildById<HTMLElement>(secondary, "secondary-inner") ??
      secondary ??
      null;
    const related =
      findActiveRelatedElement() ??
      inlineLayoutSnapshotRef.current?.related ??
      null;

    const canUseInlineLayout =
      window.innerWidth >= 1200 &&
      window.location.pathname.startsWith("/watch") &&
      host &&
      columns &&
      secondary &&
      secondaryInner &&
      related;

    if (!canUseInlineLayout) {
      restoreOverlayLayout();
      return;
    }

    if (!inlineLayoutSnapshotRef.current) {
      inlineLayoutSnapshotRef.current = {
        host,
        secondaryInner,
        related,
        hostOriginalParent: host.parentNode ?? document.documentElement,
        hostOriginalNextSibling: host.nextSibling,
        relatedOriginalParent: related.parentNode ?? secondaryInner,
        relatedOriginalNextSibling: related.nextSibling,
        hostStyle: host.style.cssText,
        secondaryInnerStyle: secondaryInner.style.cssText,
        relatedStyle: related.style.cssText,
      };
    }

    if (host.parentElement !== secondaryInner) {
      secondaryInner.insertBefore(host, secondaryInner.firstChild);
    }

    secondaryInner.style.display = "flex";
    secondaryInner.style.flexDirection = "column";
    secondaryInner.style.rowGap = "24px";

    host.style.display = "block";
    host.style.position = "sticky";
    host.style.top = `${headerHeight + 16}px`;
    host.style.zIndex = "10";
    host.style.width = "100%";
    host.style.maxWidth = "100%";
    host.style.margin = "0";
    host.style.alignSelf = "stretch";
    host.style.flex = "0 0 auto";

    if (related.parentElement !== secondaryInner || host.nextSibling !== related) {
      secondaryInner.insertBefore(related, host.nextSibling);
    }

    related.style.width = "100%";
    related.style.maxWidth = "100%";
    related.style.marginTop = "0";
    related.style.flex = "none";
    setLayoutMode("inline");
  }, [headerHeight, restoreOverlayLayout]);

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
    let rafId = 0;
    const scheduleApplyInlineLayout = () => {
      if (rafId !== 0) {
        return;
      }

      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        syncLayoutMetrics();
        applyInlineLayout();
      });
    };

    const handleResize = () => {
      scheduleApplyInlineLayout();
    };

    const observer = new MutationObserver(() => {
      scheduleApplyInlineLayout();
    });

    const observerTarget = document.body ?? document.documentElement;
    if (observerTarget) {
      observer.observe(observerTarget, { childList: true, subtree: true });
    }

    scheduleApplyInlineLayout();
    window.addEventListener("resize", handleResize);

    return () => {
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      restoreOverlayLayout();
    };
  }, [applyInlineLayout, restoreOverlayLayout, syncLayoutMetrics, videoId]);

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

  const resolvedPanelHeight =
    playerHeight && playerHeight > 0 ? `${playerHeight}px` : "600px";
  const resolvedCollapsedHeight = "56px";

  const panelStyle =
    layoutMode === "inline"
      ? {
          height: isCollapsed ? resolvedCollapsedHeight : resolvedPanelHeight,
          width: "100%",
        }
      : {
          height: isCollapsed ? resolvedCollapsedHeight : resolvedPanelHeight,
          width: "392px",
          top: headerHeight + 16,
          zIndex: 9999,
          position: "fixed" as const,
          right: 12,
        };

  return (
    <div className={youtubeTheme === "dark" ? "dark" : "light"}>
      <motion.div
        id="listenup"
        style={panelStyle}
        initial="initial"
        animate={isOpen ? "animate" : "exit"}
        variants={panelAnimation}
        transition={{
          type: "spring",
          stiffness: 320,
          damping: 32,
        }}
        className={`${
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        } overflow-visible transition-[height] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]`}
      >
        <SubtitlePanelShell
          subtitles={subtitles}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed((current) => !current)}
          toastMessage={toastMessage}
          listContent={
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
                      onToast={showToast}
                    />
                  ))}
                </VList>
              )}
            </SubtitleStates>
          }
          showReturnToActive={
            showReturnToActive && !loading && !error && subtitles.length > 0
          }
          onReturnToActive={returnToActiveSubtitle}
          isPlaying={isVideoPlaying}
          onTogglePlayback={toggleVideoPlayback}
          currentSubtitle={currentSubtitle}
          isCurrentSubtitleActive={
            !loading &&
            !error &&
            subtitles.length > 0 &&
            currentSubtitleIndex >= 0
          }
          isLooping={isLooping}
          onToggleLoop={() => toggleLooping(currentSubtitle)}
          isSegmentPlaying={isVideoPlaying}
        />
      </motion.div>

      {!isOpen && layoutMode === "overlay" && (
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

      {!isOpen && layoutMode === "inline" && (
        <div className="mt-4 flex w-full justify-center">
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
