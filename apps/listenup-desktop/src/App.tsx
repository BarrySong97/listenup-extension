/**
 * @purpose 字幕窗口 UI：实时同步、播放/字幕 seek 控制、Desktop/菜单栏形态、双语与列表/影院视图。
 * @role    桌面端唯一页面，组合 Rust session events 与 React Query 持久字幕视图。
 * @deps    @tauri-apps/api、@tauri-apps/plugin-clipboard-manager、@tanstack/react-query、components/ui、SubtitleList、subtitleCursor、TranslationMissingState、VideoSessionPicker、useSubtitleView、./types
 * @gotcha  高频 cursor 独立于 viewer；列表只接收字幕边界，不能把连续 currentTime 传回列表子树。
 */
import { Icon } from "@iconify/react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  LogicalPosition,
  LogicalSize,
  getCurrentWindow,
} from "@tauri-apps/api/window";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VListHandle } from "virtua";
import { DesktopButton } from "./components/ui/DesktopButton";
import { DesktopIconButton } from "./components/ui/DesktopIconButton";
import { EmbeddedSourceEntry } from "./EmbeddedSourceEntry";
import { shouldShowSourceEntry } from "./embeddedPlayback";
import { SubtitleModeControl } from "./components/ui/SubtitleModeControl";
import { TargetLanguageSelect } from "./components/ui/TargetLanguageSelect";
import { buildLocalAiTranslationPrompt } from "./localAiTranslationPrompt";
import {
  resolveAppModeWindowPolicy,
  type AppWindowViewMode,
} from "./appModeWindowPolicy";
import {
  TranslationMissingState,
  type TranslationCopyStatus,
} from "./TranslationMissingState";
import type { DisplayBlock } from "./SubtitleList";
import { SubtitleViewer } from "./SubtitleViewer";
import { resolveSubtitleCursorPresentation } from "./subtitleCursor";
import { groupTranslationBlocks } from "./subtitleBlocks";
import type {
  AppMode,
  SessionState,
  SubtitleDisplayMode,
  ViewerSnapshot,
} from "./types";
import { useDesktopUpdater, type DesktopUpdateState } from "./useDesktopUpdater";
import { useSubtitleView } from "./useSubtitleView";
import { VideoSessionPicker } from "./VideoSessionPicker";
import { useViewerSession } from "./useViewerSession";

type ViewMode = AppWindowViewMode;

interface WindowSize {
  width: number;
  height: number;
}

interface WindowPosition {
  x: number;
  y: number;
}

const MODE_STORAGE_KEY = "listenup-view-mode";
const SUBTITLE_MODE_STORAGE_KEY = "listenup-subtitle-display-mode";
const TARGET_LANGUAGE_STORAGE_KEY = "listenup-target-language";
const DESKTOP_POSITION_STORAGE_KEY = "listenup-window-position-desktop";
const SIZE_STORAGE_KEYS: Record<ViewMode, string> = {
  list: "listenup-window-size-list",
  cinema: "listenup-window-size-cinema",
};

const MIN_SIZES: Record<ViewMode, WindowSize> = {
  list: { width: 340, height: 420 },
  cinema: { width: 420, height: 72 },
};

const DEFAULT_SIZES: Record<ViewMode, WindowSize> = {
  list: { width: 400, height: 640 },
  cinema: { width: 760, height: 148 },
};

const SCROLLBAR_IDLE_DELAY_MS = 700;
const CINEMA_TOOLBAR_HINT_DURATION_MS = 3_000;
const IS_DEV_BUILD = import.meta.env.VITE_LISTENUP_ENV === "development";

const DevBadge = () =>
  IS_DEV_BUILD ? (
    <span className="flex-none rounded bg-yt/80 px-1 py-px text-[9px] font-bold tracking-wider text-white">
      DEV
    </span>
  ) : null;

const shellClassName =
  "h-full overflow-hidden rounded-2xl border border-hairline bg-glass shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";

const iconButtonClassName =
  "grid h-[26px] w-[26px] flex-none cursor-pointer place-items-center rounded-[7px] border-none bg-transparent p-0 text-fg-muted transition-colors hover:bg-wash hover:text-fg";

const loadStoredMode = (): ViewMode =>
  localStorage.getItem(MODE_STORAGE_KEY) === "cinema" ? "cinema" : "list";

const loadStoredSubtitleMode = (): SubtitleDisplayMode => {
  const stored = localStorage.getItem(SUBTITLE_MODE_STORAGE_KEY);
  return stored === "translation" || stored === "bilingual" ? stored : "source";
};

const loadStoredSize = (mode: ViewMode): WindowSize | null => {
  try {
    const raw = localStorage.getItem(SIZE_STORAGE_KEYS[mode]);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WindowSize;
    if (!Number.isFinite(parsed.width) || !Number.isFinite(parsed.height)) {
      return null;
    }
    return {
      width: Math.max(parsed.width, MIN_SIZES[mode].width),
      height: Math.max(parsed.height, MIN_SIZES[mode].height),
    };
  } catch {
    return null;
  }
};

const applyWindowSizeForMode = async (
  mode: ViewMode,
  {
    sizeMode = mode,
    resize = true,
  }: { sizeMode?: ViewMode; resize?: boolean } = {}
) => {
  const appWindow = getCurrentWindow();
  const minSize = MIN_SIZES[sizeMode];
  await appWindow.setMinSize(new LogicalSize(minSize.width, minSize.height));
  if (resize) {
    const targetSize = loadStoredSize(sizeMode) ?? DEFAULT_SIZES[sizeMode];
    await appWindow.setSize(new LogicalSize(targetSize.width, targetSize.height));
  }
  // 影院模式追求沉浸：关掉 vibrancy 磨砂和系统窗口投影
  // （投影在透明窗口上会形成一圈黑边），列表模式恢复。vibrancy
  // 命令最后执行，它会在所有几何变化后刷新 NSPanel 的鼠标 tracking areas。
  await appWindow.setShadow(mode === "list");
  await invoke("set_vibrancy", { enabled: mode === "list" });
};

const persistDesktopWindowPosition = async () => {
  const appWindow = getCurrentWindow();
  const [position, scaleFactor] = await Promise.all([
    appWindow.outerPosition(),
    appWindow.scaleFactor(),
  ]);
  if (scaleFactor <= 0) return;
  const logical = position.toLogical(scaleFactor);
  localStorage.setItem(
    DESKTOP_POSITION_STORAGE_KEY,
    JSON.stringify({ x: logical.x, y: logical.y } satisfies WindowPosition)
  );
};

const restoreDesktopWindowPosition = async () => {
  try {
    const raw = localStorage.getItem(DESKTOP_POSITION_STORAGE_KEY);
    if (!raw) return;
    const position = JSON.parse(raw) as WindowPosition;
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return;
    await getCurrentWindow().setPosition(
      new LogicalPosition(position.x, position.y)
    );
  } catch {
    // 损坏或越界位置交给系统当前窗口位置兜底。
  }
};

const persistCurrentWindowSize = async (mode: ViewMode) => {
  const appWindow = getCurrentWindow();
  const [innerSize, scaleFactor] = await Promise.all([
    appWindow.innerSize(),
    appWindow.scaleFactor(),
  ]);
  if (scaleFactor <= 0) return;
  const logicalSize: WindowSize = {
    width: Math.round(innerSize.width / scaleFactor),
    height: Math.round(innerSize.height / scaleFactor),
  };
  localStorage.setItem(SIZE_STORAGE_KEYS[mode], JSON.stringify(logicalSize));
};

const formatTime = (seconds: number) => {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = Math.floor(safeSeconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
};

const statusText = (session: SessionState | null) => {
  if (!session) return "等待 YouTube 字幕…";
  if (session.status === "loading") return "正在加载字幕…";
  if (session.status === "empty") return "这个视频没有可用字幕";
  if (session.status === "error") return session.error ?? "字幕加载失败";
  return null;
};

const YoutubeLogo = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#FF0000"
      d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
    />
    <path fill="#FFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const StatusDot = ({ connected }: { connected: boolean }) => (
  <span
    aria-hidden="true"
    className={`h-1.5 w-1.5 flex-none rounded-full transition-all ${
      connected
        ? "bg-ok shadow-[0_0_6px_rgba(48,209,88,0.7)]"
        : "bg-white/25"
    }`}
  />
);

const UpdateNotice = ({
  state,
  onInstall,
}: {
  state: DesktopUpdateState;
  onInstall: () => void;
}) => {
  if (!state.message) return null;
  const isError = state.phase === "error";
  const isSuccess = state.phase === "current" || state.phase === "installed";

  return (
    <div
      className={`absolute left-1/2 top-3 z-40 flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] shadow-lg backdrop-blur-xl ${state.phase === "available" ? "pointer-events-auto" : "pointer-events-none"} ${
        isError
          ? "border-red-400/30 bg-red-950/90 text-red-100"
          : isSuccess
            ? "border-emerald-400/25 bg-emerald-950/90 text-emerald-100"
            : "border-white/15 bg-black/85 text-fg"
      }`}
      role="status"
      aria-live="polite"
    >
      {(state.phase === "checking" || state.phase === "downloading") && (
        <Icon
          icon="mdi:loading"
          className="h-3.5 w-3.5 flex-none animate-spin"
          aria-hidden="true"
        />
      )}
      {isError && (
        <Icon
          icon="mdi:alert-circle-outline"
          className="h-3.5 w-3.5 flex-none"
          aria-hidden="true"
        />
      )}
      {isSuccess && (
        <Icon
          icon="mdi:check-circle-outline"
          className="h-3.5 w-3.5 flex-none"
          aria-hidden="true"
        />
      )}
      {state.phase === "available" && (
        <Icon
          icon="mdi:update"
          className="h-3.5 w-3.5 flex-none"
          aria-hidden="true"
        />
      )}
      <span className="truncate">{state.message}</span>
      {state.phase === "available" && (
        <DesktopButton
          className="h-6 flex-none cursor-pointer rounded-full border border-white/15 bg-white/15 px-2 text-[10px] font-medium text-fg transition-colors hover:bg-white/25"
          onPress={onInstall}
        >
          立即更新
        </DesktopButton>
      )}
    </div>
  );
};

const PlaybackButton = memo(function PlaybackButton({
  isPaused,
  disabled,
  pending,
  onPress,
  disabledReason,
  compact = false,
}: {
  isPaused: boolean | null;
  disabled: boolean;
  disabledReason?: string;
  pending: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  const action = isPaused !== false ? "play" : "pause";
  const label = action === "play" ? "播放 YouTube" : "暂停 YouTube";
  return (
    <DesktopIconButton
      className={`${compact ? "flex h-6 w-6 items-center justify-center" : iconButtonClassName} cursor-pointer border-none bg-transparent text-fg-muted transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-40`}
      onPress={onPress}
      isDisabled={disabled}
      tooltip={pending ? "正在控制 YouTube…" : disabledReason ?? label}
      ariaLabel={label}
      icon={
        <Icon
          icon={
            pending ? "mdi:loading" : action === "play" ? "mdi:play" : "mdi:pause"
          }
          className={`h-3.5 w-3.5 flex-none ${pending ? "animate-spin" : ""}`}
          aria-hidden="true"
        />
      }
    />
  );
});

const PlaybackTime = memo(function PlaybackTime({
  seconds,
  className = "text-fg-muted",
}: {
  seconds: number;
  className?: string;
}) {
  return (
    <span className={`${className} tabular-nums`}>{formatTime(seconds)}</span>
  );
});

export default function App() {
  const { viewer, connected, cursor, applyViewerSnapshot } = useViewerSession();
  const [mode, setMode] = useState<ViewMode>(loadStoredMode);
  const [appMode, setAppModeState] = useState<AppMode>("desktop");
  const [appModeError, setAppModeError] = useState<string | null>(null);
  const [subtitleMode, setSubtitleMode] =
    useState<SubtitleDisplayMode>(loadStoredSubtitleMode);
  const [targetLanguage, setTargetLanguage] = useState<string | null>(() =>
    localStorage.getItem(TARGET_LANGUAGE_STORAGE_KEY)
  );
  const [knownRevision, setKnownRevision] = useState<{
    scope: string;
    revision: string;
  } | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [isListScrolling, setIsListScrolling] = useState(false);
  const [translationCopyStatus, setTranslationCopyStatus] =
    useState<TranslationCopyStatus>("idle");
  const [showCinemaToolbarHint, setShowCinemaToolbarHint] = useState(false);
  const [playbackPending, setPlaybackPending] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const modeRef = useRef(mode);
  const desktopModeRef = useRef<ViewMode>(loadStoredMode());
  const vListRef = useRef<VListHandle>(null);
  const lastScrolledViewRef = useRef<{
    sessionId: string | null;
    blocks: DisplayBlock[];
  } | null>(null);
  const scrollIdleTimerRef = useRef<number | null>(null);
  const updater = useDesktopUpdater({ enabled: !IS_DEV_BUILD });
  const liveSession = viewer.activeSession;
  const queryScope = liveSession?.videoId ?? "latest";
  const subtitleQuery = useSubtitleView(
    liveSession?.videoId ?? null,
    knownRevision?.scope === queryScope ? knownRevision.revision : null,
    subtitleMode,
    targetLanguage
  );

  useEffect(() => {
    let disposed = false;
    let unlistenMode: (() => void) | null = null;
    let unlistenError: (() => void) | null = null;

    const applyAppMode = async (nextMode: AppMode, initial = false) => {
      if (disposed) return;
      setAppModeState(nextMode);
      setAppModeError(null);
      if (nextMode === "menubar") {
        desktopModeRef.current = modeRef.current;
      }
      const policy = resolveAppModeWindowPolicy({
        nextMode,
        desktopMode: desktopModeRef.current,
        initial,
      });
      modeRef.current = policy.viewMode;
      setMode(policy.viewMode);
      await applyWindowSizeForMode(policy.viewMode, {
        sizeMode: policy.sizeMode,
        resize: policy.resize,
      });
      if (nextMode === "desktop" && initial) {
        await restoreDesktopWindowPosition();
      }
    };

    const initializeAppMode = async () => {
      unlistenMode = await listen<AppMode>(
        "desktop-app-mode-changed",
        (event) => void applyAppMode(event.payload, false)
      );
      unlistenError = await listen<string>(
        "desktop-app-mode-error",
        (event) => setAppModeError(event.payload)
      );
      const initialMode = await invoke<AppMode>("get_app_mode");
      await applyAppMode(initialMode, true);
    };
    void initializeAppMode().catch((error) => {
      setAppModeError(error instanceof Error ? error.message : String(error));
    });
    return () => {
      disposed = true;
      unlistenMode?.();
      unlistenError?.();
    };
  }, []);

  const session = liveSession;
  const pickerVisible = viewer.selectionRequired;
  const sourceEntryVisible = shouldShowSourceEntry(viewer);

  useEffect(() => {
    const revision = subtitleQuery.data?.source.revision;
    if (!revision) return;
    setKnownRevision((current) =>
      current?.scope === queryScope && current.revision === revision
        ? current
        : { scope: queryScope, revision }
    );
  }, [queryScope, subtitleQuery.data?.source.revision]);

  useEffect(() => {
    if (targetLanguage || !subtitleQuery.data?.translations.length) return;
    const firstLanguage = subtitleQuery.data.translations[0].languageCode;
    setTargetLanguage(firstLanguage);
    localStorage.setItem(TARGET_LANGUAGE_STORAGE_KEY, firstLanguage);
  }, [subtitleQuery.data?.translations, targetLanguage]);

  useEffect(() => {
    if (session?.status === "ready") {
      void subtitleQuery.refetch();
    }
  }, [session?.sessionId, session?.status, session?.subtitles.length]);

  useEffect(() => {
    if (mode !== "cinema" || !pickerVisible) return;

    const appWindow = getCurrentWindow();
    void (async () => {
      const [innerSize, scaleFactor] = await Promise.all([
        appWindow.innerSize(),
        appWindow.scaleFactor(),
      ]);
      if (scaleFactor <= 0) return;
      const width = Math.round(innerSize.width / scaleFactor);
      const height = Math.round(innerSize.height / scaleFactor);
      await appWindow.setMinSize(new LogicalSize(MIN_SIZES.cinema.width, 220));
      if (height < 220) {
        await appWindow.setSize(new LogicalSize(width, 220));
      }
    })().catch((error) => {
      console.error("failed to expand cinema video picker", error);
    });

    return () => {
      if (modeRef.current === "cinema") {
        void applyWindowSizeForMode("cinema");
      }
    };
  }, [mode, pickerVisible]);

  const selectVideoSession = useCallback(async (sessionId: string) => {
    setBusySessionId(sessionId);
    setPickerError(null);
    try {
      const snapshot = await invoke<ViewerSnapshot>("select_subtitle_session", {
        sessionId,
      });
      applyViewerSnapshot(snapshot);
    } catch (error) {
      setPickerError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusySessionId(null);
    }
  }, [applyViewerSnapshot]);

  useEffect(() => {
    if (mode !== "cinema") {
      setShowCinemaToolbarHint(false);
      return;
    }

    setShowCinemaToolbarHint(true);
    const timer = window.setTimeout(
      () => setShowCinemaToolbarHint(false),
      CINEMA_TOOLBAR_HINT_DURATION_MS
    );
    return () => window.clearTimeout(timer);
  }, [mode]);

  const switchMode = useCallback(async (nextMode: ViewMode) => {
    if (appMode !== "desktop") return;
    if (nextMode === modeRef.current) return;

    try {
      await persistCurrentWindowSize(modeRef.current);
    } catch (error) {
      console.error("failed to persist window size", error);
    }

    modeRef.current = nextMode;
    setMode(nextMode);
    localStorage.setItem(MODE_STORAGE_KEY, nextMode);

    try {
      await applyWindowSizeForMode(nextMode);
    } catch (error) {
      console.error("failed to resize window", error);
    }
    desktopModeRef.current = nextMode;
  }, [appMode]);

  const switchAppMode = useCallback(async () => {
    const nextMode: AppMode = appMode === "desktop" ? "menubar" : "desktop";
    setAppModeError(null);
    try {
      if (nextMode === "menubar") {
        desktopModeRef.current = modeRef.current;
        await Promise.all([
          persistCurrentWindowSize(modeRef.current),
          persistDesktopWindowPosition(),
        ]);
      }
      await invoke<AppMode>("set_app_mode", { mode: nextMode });
    } catch (error) {
      setAppModeError(error instanceof Error ? error.message : String(error));
    }
  }, [appMode]);

  const switchSubtitleMode = useCallback((nextMode: SubtitleDisplayMode) => {
    setSubtitleMode(nextMode);
    localStorage.setItem(SUBTITLE_MODE_STORAGE_KEY, nextMode);
  }, []);

  const selectTargetLanguage = useCallback((language: string) => {
    setTargetLanguage(language);
    localStorage.setItem(TARGET_LANGUAGE_STORAGE_KEY, language);
  }, []);

  const copyLocalAiTranslationPrompt = useCallback(async () => {
    const source = subtitleQuery.data?.source;
    if (!source) {
      setTranslationCopyStatus("error");
      return;
    }

    setTranslationCopyStatus("copying");
    try {
      await writeText(
        buildLocalAiTranslationPrompt({
          videoId: source.videoId,
          title: source.title,
          sourceLanguageCode: source.languageCode,
          sourceLanguageDisplayName: source.displayName,
        })
      );
      setTranslationCopyStatus("copied");
    } catch (error) {
      console.error("failed to copy local AI translation prompt", error);
      setTranslationCopyStatus("error");
    }
  }, [subtitleQuery.data?.source]);

  useEffect(() => {
    setTranslationCopyStatus("idle");
  }, [subtitleQuery.data?.source.revision]);

  const closeWindow = useCallback(() => {
    void getCurrentWindow().close();
  }, []);

  const handleListScroll = useCallback(() => {
    setIsListScrolling(true);
    if (scrollIdleTimerRef.current !== null) {
      window.clearTimeout(scrollIdleTimerRef.current);
    }
    scrollIdleTimerRef.current = window.setTimeout(() => {
      scrollIdleTimerRef.current = null;
      setIsListScrolling(false);
    }, SCROLLBAR_IDLE_DELAY_MS);
  }, []);

  const handleListScrollEnd = useCallback(() => {
    if (scrollIdleTimerRef.current !== null) {
      window.clearTimeout(scrollIdleTimerRef.current);
      scrollIdleTimerRef.current = null;
    }
    setIsListScrolling(false);
  }, []);

  const playbackDisabled =
    playbackPending ||
    !connected ||
    !session ||
    !cursor ||
    cursor.isAdPlaying;
  const playbackAction = cursor?.isPaused === false ? "pause" : "play";
  const controlPlayback = useCallback(async () => {
    if (playbackDisabled) return;
    setPlaybackPending(true);
    setPlaybackError(null);
    try {
      await invoke("control_playback", {
        action: playbackAction,
      });
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : String(error));
    } finally {
      setPlaybackPending(false);
    }
  }, [playbackAction, playbackDisabled]);
  const seekToSubtitle = useCallback(
    async (seekTime: number) => {
      if (playbackDisabled || !Number.isFinite(seekTime) || seekTime < 0) return;
      setPlaybackPending(true);
      setPlaybackError(null);
      try {
        await invoke("control_playback", {
          action: "seek",
          seekTime,
        });
      } catch (error) {
        setPlaybackError(error instanceof Error ? error.message : String(error));
      } finally {
        setPlaybackPending(false);
      }
    },
    [playbackDisabled]
  );
  const requestedTranslationMissing = Boolean(
    subtitleMode !== "source" &&
      subtitleQuery.isSuccess &&
      subtitleQuery.data &&
      !subtitleQuery.data.translation
  );
  const effectiveSubtitleMode: SubtitleDisplayMode = requestedTranslationMissing
    ? "source"
    : subtitleMode;
  const displayBlocks = useMemo<DisplayBlock[]>(() => {
    if (
      effectiveSubtitleMode !== "source" &&
      subtitleQuery.data?.translation
    ) {
      return groupTranslationBlocks(subtitleQuery.data.translation).map((block) => ({
        ...block,
        sourceText:
          effectiveSubtitleMode === "bilingual" ? block.sourceText : null,
      }));
    }
    if (session?.status === "ready") {
      return session.subtitles.map((subtitle, index) => ({
        id: `${subtitle.id}-${index}`,
        startTime: subtitle.startTime,
        endTime: subtitle.endTime,
        sourceText: subtitle.text,
        translationText: null,
      }));
    }
    return (
      subtitleQuery.data?.source.segments.map((subtitle) => ({
        id: subtitle.id,
        startTime: subtitle.startTimeMs / 1000,
        endTime: subtitle.endTimeMs / 1000,
        sourceText: subtitle.text,
        translationText: null,
      })) ?? []
    );
  }, [
    effectiveSubtitleMode,
    session?.status,
    session?.subtitles,
    subtitleQuery.data?.source.segments,
    subtitleQuery.data?.translation,
  ]);
  const preferLiveSourceIndex =
    effectiveSubtitleMode === "source" &&
    session?.status === "ready" &&
    session.subtitles.length === displayBlocks.length;
  const cursorPresentation = useMemo(
    () =>
      resolveSubtitleCursorPresentation(
        displayBlocks,
        cursor,
        preferLiveSourceIndex
      ),
    [cursor, displayBlocks, preferLiveSourceIndex]
  );
  const currentIndex = cursorPresentation.activeIndex;
  const playedThroughIndex = cursorPresentation.playedThroughIndex;
  const emptyMessage = session
    ? statusText(session)
    : viewer.playingSessionCount >= 2
      ? "正在确认视频…"
      : subtitleQuery.isPending
        ? "正在读取本地字幕…"
        : subtitleQuery.isError
          ? `本地字幕读取失败：${String(subtitleQuery.error)}`
          : displayBlocks.length === 0
            ? "等待 YouTube 字幕…"
            : null;
  const currentSubtitle =
    currentIndex >= 0 && currentIndex < displayBlocks.length
      ? displayBlocks[currentIndex]
      : null;

  useEffect(() => {
    if (mode !== "list" || currentIndex < 0 || !vListRef.current) return;

    const sessionId = session?.sessionId ?? null;
    const isNewView =
      lastScrolledViewRef.current?.sessionId !== sessionId ||
      lastScrolledViewRef.current?.blocks !== displayBlocks;
    lastScrolledViewRef.current = { sessionId, blocks: displayBlocks };

    const frame = window.requestAnimationFrame(() => {
      vListRef.current?.scrollToIndex(currentIndex, {
        align: "center",
        smooth: !isNewView,
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentIndex, displayBlocks, session?.sessionId, mode]);

  const connectionLabel = viewer.awaitingBrowserPlayback
    ? "等待下一次浏览器播放"
    : connected
      ? "已连接"
      : "等待扩展连接";
  const playbackLabel = useMemo(() => {
    if (!cursor) return "等待播放";
    if (cursor.isAdPlaying) return "广告播放中";
    return cursor.isPaused ? "已暂停" : "同步播放中";
  }, [cursor?.isAdPlaying, cursor?.isPaused]);
  const playbackSecond = Math.floor(cursor?.currentTime ?? 0);
  const playbackDisabledReason = playbackPending
    ? "正在控制 YouTube…"
    : !connected
      ? "扩展未连接，暂不可控制"
      : !session
        ? "等待可控制的视频"
        : !cursor
          ? "等待播放状态同步"
          : cursor.isAdPlaying
            ? "广告播放中，暂不可控制"
            : undefined;

  if (mode === "cinema" && appMode === "desktop") {
    return (
      <main
        className="group relative flex h-full cursor-grab select-none items-center justify-center overflow-hidden rounded-2xl bg-glass-cinema px-5 py-2 active:cursor-grabbing"
        data-tauri-drag-region
      >
        <UpdateNotice
          state={updater.state}
          onInstall={() => void updater.installAvailableUpdate()}
        />
        <div
          className="min-w-0 text-center [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]"
          data-tauri-drag-region
        >
          {requestedTranslationMissing ? (
            <TranslationMissingState
              compact
              copyStatus={translationCopyStatus}
              onCopy={() => void copyLocalAiTranslationPrompt()}
            />
          ) : currentSubtitle ? (
            <>
              {currentSubtitle.sourceText && (
                <p
                  className={`m-0 line-clamp-2 whitespace-pre-line tracking-[0.005em] text-fg ${
                    effectiveSubtitleMode === "bilingual"
                      ? "text-base font-medium leading-[1.4]"
                      : "text-xl font-[550] leading-[1.45]"
                  }`}
                  data-tauri-drag-region
                >
                  {currentSubtitle.sourceText}
                </p>
              )}
              {currentSubtitle.translationText && (
                <p
                  className={`m-0 line-clamp-2 whitespace-pre-line text-fg ${
                    effectiveSubtitleMode === "bilingual"
                      ? "mt-1 text-xl font-[600] leading-[1.35]"
                      : "text-xl font-[550] leading-[1.45]"
                  }`}
                  data-tauri-drag-region
                >
                  {currentSubtitle.translationText}
                </p>
              )}
            </>
          ) : (
            <p className="m-0 text-sm font-normal text-fg-muted">
              {emptyMessage ?? "…"}
            </p>
          )}
        </div>
        <div
          className={`absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-black/45 px-2 py-0.5 transition-opacity group-hover:opacity-100 ${
            showCinemaToolbarHint ? "opacity-100" : "opacity-0"
          }`}
        >
          <DesktopButton
            className="flex h-6 cursor-pointer items-center gap-[5px] rounded-full border-none bg-transparent px-1.5 text-[11px] text-fg-muted transition-colors hover:text-fg"
            onPress={() => void switchMode("list")}
          >
            <Icon
              icon="mdi:format-list-bulleted"
              className="h-3.5 w-3.5 flex-none"
              aria-hidden="true"
            />
            列表
          </DesktopButton>
          <SubtitleModeControl
            compact
            value={subtitleMode}
            onChange={switchSubtitleMode}
          />
          <DevBadge />
          <StatusDot connected={connected} />
          <PlaybackButton
            compact
            isPaused={cursor?.isPaused ?? null}
            disabled={playbackDisabled}
            disabledReason={playbackDisabledReason}
            pending={playbackPending}
            onPress={controlPlayback}
          />
          <span
            className={`text-[11px] ${appModeError || playbackError ? "text-red-300" : "text-fg-faint"}`}
          >
            {appModeError ?? playbackError ?? playbackLabel}
          </span>
          <PlaybackTime
            seconds={playbackSecond}
            className="text-[11px] text-fg-faint"
          />
          <DesktopIconButton
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-fg-muted transition-colors hover:text-fg"
            onPress={closeWindow}
            tooltip="收进菜单栏"
            ariaLabel="收进菜单栏"
            icon={
              <Icon
                icon="mdi:close"
                className="h-3.5 w-3.5 flex-none"
                aria-hidden="true"
              />
            }
          />
        </div>
        {pickerVisible && (
          <VideoSessionPicker
            candidates={viewer.playingCandidates}
            selectedSessionId={viewer.selectedSessionId}
            busySessionId={busySessionId}
            error={pickerError}
            onSelect={(sessionId) => void selectVideoSession(sessionId)}
          />
        )}
      </main>
    );
  }

  return (
    <main
      className={`${shellClassName} relative grid grid-rows-[auto_minmax(0,1fr)_auto]`}
    >
      <UpdateNotice
        state={updater.state}
        onInstall={() => void updater.installAvailableUpdate()}
      />
      <header
        className="min-w-0 border-b border-hairline pb-2.5 pl-3.5 pr-3 pt-3"
        data-tauri-drag-region={appMode === "desktop" ? true : undefined}
      >
        <div
          className="flex min-w-0 items-center gap-2.5"
          data-tauri-drag-region={appMode === "desktop" ? true : undefined}
        >
          <span
            className="grid h-[26px] w-[26px] flex-none place-items-center"
            aria-hidden="true"
          >
            <YoutubeLogo size={22} />
          </span>
          <h1
            className="m-0 min-w-0 flex-1 truncate text-[13px] font-[650] tracking-[-0.01em] text-fg"
            data-tauri-drag-region={appMode === "desktop" ? true : undefined}
          >
            {session?.title ?? subtitleQuery.data?.source.title ?? "ListenUp Desktop"}
          </h1>
          <DevBadge />
          <DesktopIconButton
            className={`${iconButtonClassName} disabled:cursor-wait disabled:opacity-45`}
            onPress={() => void updater.checkForUpdates()}
            isDisabled={updater.isBusy}
            tooltip={updater.state.message ?? "检查更新"}
            ariaLabel="检查更新"
            icon={
              <Icon
                icon={updater.isBusy ? "mdi:loading" : "mdi:update"}
                className={`h-3.5 w-3.5 flex-none ${updater.isBusy ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
            }
          />
          {appMode === "desktop" && (
            <DesktopIconButton
              className={iconButtonClassName}
              onPress={() => void switchMode("cinema")}
              tooltip="影院模式：字幕条悬浮在视频上"
              ariaLabel="切换到影院模式"
              icon={
                <Icon
                  icon="mdi:movie-open-outline"
                  className="h-3.5 w-3.5 flex-none"
                  aria-hidden="true"
                />
              }
            />
          )}
          <DesktopIconButton
            className={iconButtonClassName}
            onPress={() => void switchAppMode()}
            tooltip={appMode === "desktop" ? "切换到菜单栏 App" : "切换到自由窗口"}
            ariaLabel={appMode === "desktop" ? "切换到菜单栏 App" : "切换到自由窗口"}
            icon={
              <Icon
                icon={
                  appMode === "desktop" ? "mdi:dock-top" : "mdi:application-outline"
                }
                className="h-3.5 w-3.5 flex-none"
                aria-hidden="true"
              />
            }
          />
          <DesktopIconButton
            className={iconButtonClassName}
            onPress={closeWindow}
            tooltip="收进菜单栏"
            ariaLabel="收进菜单栏"
            icon={
              <Icon
                icon="mdi:close"
                className="h-3.5 w-3.5 flex-none"
                aria-hidden="true"
              />
            }
          />
        </div>
        <div
          className="mt-2 flex min-w-0 items-center gap-[7px] text-[11px] text-fg-faint"
          data-tauri-drag-region={appMode === "desktop" ? true : undefined}
        >
          <StatusDot connected={connected} />
          <span className="flex-none">{connectionLabel}</span>
          <span className="flex-none">·</span>
          <span className="min-w-0 truncate">
            {session?.track?.displayName ??
              subtitleQuery.data?.source.displayName ??
              "字幕同步 Demo"}
          </span>
          <span className="flex-1" />
          <span className={appModeError || playbackError ? "text-red-300" : undefined}>
            {appModeError ?? playbackError ?? playbackLabel}
          </span>
          <PlaybackTime seconds={playbackSecond} />
        </div>
        <div className="mt-2 flex min-w-0 items-center gap-1.5">
          <SubtitleModeControl
            value={subtitleMode}
            onChange={switchSubtitleMode}
          />
          <span className="flex-1" />
          {subtitleMode !== "source" && (
            <TargetLanguageSelect
              value={targetLanguage}
              options={subtitleQuery.data?.translations ?? []}
              onChange={selectTargetLanguage}
            />
          )}
          <PlaybackButton
            isPaused={cursor?.isPaused ?? null}
            disabled={playbackDisabled}
            disabledReason={playbackDisabledReason}
            pending={playbackPending}
            onPress={controlPlayback}
          />
        </div>
      </header>

      <section className="relative min-h-0 overflow-hidden" aria-live="polite">
        {sourceEntryVisible ? (
          <EmbeddedSourceEntry
            awaitingBrowserPlayback={viewer.awaitingBrowserPlayback}
            browserConnected={connected}
          />
        ) : (
          <SubtitleViewer
            listRef={vListRef}
            blocks={displayBlocks}
            activeIndex={currentIndex}
            playedThroughIndex={playedThroughIndex}
            connected={connected}
            copyStatus={translationCopyStatus}
            emptyMessage={emptyMessage}
            isScrolling={isListScrolling}
            onScroll={handleListScroll}
            onScrollEnd={handleListScrollEnd}
            onCopyTranslationPrompt={() => void copyLocalAiTranslationPrompt()}
            onSeek={(seekTime) => void seekToSubtitle(seekTime)}
            seekDisabled={playbackDisabled}
            translationMissing={requestedTranslationMissing}
          />
        )}
      </section>

      <footer className="flex items-center justify-end border-t border-hairline px-3.5 py-2 text-[10px] text-fg-faint tabular-nums">
        <span>{displayBlocks.length} 个语义块</span>
      </footer>
      {pickerVisible && (
        <VideoSessionPicker
          candidates={viewer.playingCandidates}
          selectedSessionId={viewer.selectedSessionId}
          busySessionId={busySessionId}
          error={pickerError}
          onSelect={(sessionId) => void selectVideoSession(sessionId)}
        />
      )}
    </main>
  );
}
