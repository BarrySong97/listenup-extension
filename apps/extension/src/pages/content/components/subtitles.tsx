/**
 * @purpose 字幕面板的编排根：启动 youtubeSDK、加载字幕、协调索引/滚动/循环/Explain/Native 同步。
 * @role    内容脚本的主容器组件，被 app.tsx 渲染；向下装配所有面板组件与 hook。
 * @deps    lib/youtube-sdk、hooks/useSubtitles 等全部面板 hook、SubtitlePanelShell、ExplainCard、AiSettingsCard
 * @gotcha  写入 explainTarget 前会先暂停视频；这是面板里唯一该放跨组件编排逻辑的地方。见 docs/modules/extension/content.md
 */
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
import { ExplainCard } from "./ExplainCard";
import { ExplainTarget, useExplain } from "../hooks/useExplain";
import { AiSettingsCard } from "./AiSettingsCard";
import { useNativeSubtitleBridge } from "../hooks/useNativeSubtitleBridge";

export interface SubtitlesProps {}
type PanelLayoutMode = "overlay" | "inline";

interface InlineLayoutSnapshot {
  host: HTMLElement;
  secondaryInner: HTMLElement;
  related: HTMLElement;
  hiddenAds: Array<{ element: HTMLElement; style: string }>;
  hostOriginalParent: Node;
  hostOriginalNextSibling: ChildNode | null;
  relatedOriginalParent: Node;
  relatedOriginalNextSibling: ChildNode | null;
  hostStyle: string;
  secondaryInnerStyle: string;
  relatedStyle: string;
}

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

const findSidebarAdElements = (root: HTMLElement) => {
  const adSelectors = [
    "ytd-display-ad-renderer",
    "ytd-companion-slot-renderer",
    "ytd-action-companion-ad-renderer",
    "ytd-ad-slot-renderer",
    "panel-ad-header-image-lockup-view-model",
    "ad-badge-view-model",
    '[aria-label*="赞助商广告"]',
    '[aria-label*="Sponsored"]',
  ];

  const adElements = new Set<HTMLElement>();

  adSelectors.forEach((selector) => {
    root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
      const adContainer =
        element.closest<HTMLElement>("ytd-engagement-panel-section-list-renderer") ??
        element.closest<HTMLElement>("ytd-display-ad-renderer") ??
        element.closest<HTMLElement>("ytd-companion-slot-renderer") ??
        element.closest<HTMLElement>("ytd-action-companion-ad-renderer") ??
        element.closest<HTMLElement>("ytd-ad-slot-renderer") ??
        element;

      if (adContainer && root.contains(adContainer)) {
        adElements.add(adContainer);
      }
    });
  });

  return Array.from(adElements);
};

const Subtitles: FC<SubtitlesProps> = () => {
  const [youtubeTheme, setYoutubeTheme] = useState<YouTubeTheme | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState(56);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [playerHeight, setPlayerHeight] = useState<number | null>(null);
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [layoutMode, setLayoutMode] = useState<PanelLayoutMode>("inline");
  const [videoId, setVideoId] = useState<string | null>(youtubeSDK.getVideoId());
  const playStateCleanup = useRef<(() => void) | null>(null);
  const inlineLayoutSnapshotRef = useRef<InlineLayoutSnapshot | null>(null);
  const {
    subtitles,
    track,
    loading,
    error,
    snapshotVideoId,
    identityStatus,
  } = useSubtitles({
    enabled: !isAdPlaying,
    videoId,
  });
  const { currentTime, currentSubtitleIndex, setCurrentTime } =
    useSubtitleSync(subtitles);
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
  const [explainTarget, setExplainTarget] = useState<ExplainTarget | null>(null);
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);
  const explainState = useExplain(explainTarget);

  useNativeSubtitleBridge({
    videoId,
    snapshotVideoId,
    identityStatus,
    subtitles,
    track,
    loading,
    error,
    currentTime,
    currentSubtitleIndex,
    isVideoPlaying,
    isAdPlaying,
  });

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
      setLayoutMode("inline");
      return;
    }

    const {
      host,
      secondaryInner,
      related,
      hiddenAds,
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
    hiddenAds.forEach(({ element, style }) => {
      if (element.isConnected) {
        element.style.cssText = style;
      }
    });

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
        hiddenAds: [],
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
    host.style.position = "relative";
    host.style.top = "";
    host.style.zIndex = "auto";
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

    const snapshot = inlineLayoutSnapshotRef.current;
    if (snapshot) {
      const trackedAds = new Set(snapshot.hiddenAds.map(({ element }) => element));

      findSidebarAdElements(secondaryInner).forEach((adElement) => {
        if (!trackedAds.has(adElement)) {
          snapshot.hiddenAds.push({
            element: adElement,
            style: adElement.style.cssText,
          });
        }

        adElement.style.display = "none";
      });
    }

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

  // 网页内浮层面板已停用（字幕改由桌面 app 显示），因此不再把面板注入
  // YouTube 的 #secondary，也不重排 #related。字幕抓取和桥接照常运行。
  // 若要恢复网页浮层，删掉下面这个提前 return 即可。
  useEffect(() => {
    return;
    // eslint-disable-next-line no-unreachable
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
  const [displaySubtitle, setDisplaySubtitle] = useState(currentSubtitle);

  useEffect(() => {
    if (currentSubtitle) {
      setDisplaySubtitle(currentSubtitle);
    }
  }, [currentSubtitle]);

  const playCurrentSubtitle = useCallback(() => {
    if (!displaySubtitle) return;

    const player = youtubeSDK.getPlayerFacade();
    player.seekTo(displaySubtitle.startTime);
    player.play();
  }, [displaySubtitle]);

  const pauseCurrentVideo = useCallback(() => {
    youtubeSDK.getPlayerFacade().pause();
  }, []);

  const handleRequestExplain = useCallback((
    target: Omit<ExplainTarget, "videoId">
  ) => {
    pauseCurrentVideo();
    setIsAiSettingsOpen(false);
    setExplainTarget({
      ...target,
      videoId,
    });
  }, [pauseCurrentVideo, videoId]);

  const openAiSettings = useCallback(() => {
    setIsAiSettingsOpen(true);
  }, []);

  const closeAiSettings = useCallback(() => {
    setIsAiSettingsOpen(false);
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
  const resolvedCollapsedHeight = `${collapsedHeight}px`;

  const panelTargetHeight = isCollapsed
    ? resolvedCollapsedHeight
    : resolvedPanelHeight;

  const panelStyle = {
    width: "100%",
  };

  const panelMotionTarget = { opacity: 1, x: 0, height: panelTargetHeight };

  // 网页内浮层面板已停用：字幕改由桌面 app 显示，这里不再渲染任何 UI。
  // 上面的 useSubtitles / useSubtitleSync / useNativeSubtitleBridge 等 hook
  // 照常运行，继续把字幕和播放游标喂给桌面 app。
  // 若要恢复网页浮层，删掉下面这行 return null 即可。
  return null;

  // eslint-disable-next-line no-unreachable
  return (
    <div className={youtubeTheme === "dark" ? "dark" : "light"}>
      <motion.div
        id="listenup"
        style={panelStyle}
        initial={false}
        animate={panelMotionTarget}
        transition={{
          x: {
            duration: 0,
          },
          opacity: {
            duration: 0.18,
            ease: "easeOut",
          },
          height: {
            duration: 0.22,
            ease: [0.22, 1, 0.36, 1],
          },
        }}
        className={`${
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        } relative overflow-visible`}
      >
        <SubtitlePanelShell
          subtitles={subtitles}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed((current) => !current)}
          onHeaderHeightChange={setCollapsedHeight}
          onOpenAiSettings={openAiSettings}
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
                      onRequestExplain={handleRequestExplain}
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
          currentSubtitle={displaySubtitle}
          isCurrentSubtitleActive={
            !loading &&
            !error &&
            subtitles.length > 0 &&
            currentSubtitleIndex >= 0
          }
          isLooping={isLooping}
          onToggleLoop={() => toggleLooping(displaySubtitle)}
          isSegmentPlaying={isVideoPlaying}
        />

        <ExplainCard
          target={explainState.target}
          data={explainState.data}
          loading={explainState.loading}
          error={explainState.error}
          streamText={explainState.streamText}
          images={explainState.images}
          imagesLoading={explainState.imagesLoading}
          settings={explainState.settings}
          onClose={() => setExplainTarget(null)}
          onRefresh={explainState.refresh}
          onOpenSettings={openAiSettings}
        />

        <AiSettingsCard
          isOpen={isAiSettingsOpen}
          onClose={closeAiSettings}
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
