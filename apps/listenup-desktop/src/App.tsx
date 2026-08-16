/**
 * @purpose 普通 Desktop 主窗口与独立影院浮层 UI：组合浏览器同步、YouTube iframe、字幕交互与原生 hover tracking。
 * @role    main 标签渲染标准窗口，cinema 标签只渲染置顶字幕浮层；两者共享 Rust 来源权威。
 * @deps    @tauri-apps/api、@tauri-apps/plugin-clipboard-manager、@tanstack/react-query、react-i18next、BrowserSourceSwitchModal、EmbeddedLinkEditorModal、components/ui、EmbeddedVideoPanel、SubtitleViewer、useSubtitleView、./types
 * @gotcha  cinema 隐藏后会复用；每次原生呈现后须等 WebView 两帧布局再刷新 tracking，不能用 React pointer state 掩盖底层失效。
 */
import { Icon } from "@iconify/react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import {
  LogicalPosition,
  LogicalSize,
  getCurrentWindow,
} from "@tauri-apps/api/window";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { VListHandle } from "virtua";
import { BrowserSourceSwitchModal } from "./BrowserSourceSwitchModal";
import { DesktopButton } from "./components/ui/DesktopButton";
import { DesktopIconButton } from "./components/ui/DesktopIconButton";
import { LanguageSwitcher } from "./components/ui/LanguageSwitcher";
import { CookieSettings } from "./CookieSettings";
import { EmbeddedLinkEditorModal } from "./EmbeddedLinkEditorModal";
import { EmbeddedSourceEntry } from "./EmbeddedSourceEntry";
import { EmbeddedVideoPanel } from "./EmbeddedVideoPanel";
import {
  decideBrowserSourcePaste,
  normalizeYoutubeWatchUrl,
  resolveSubtitleQueryVideoId,
  shouldShowSourceEntry,
  YoutubeLinkError,
} from "./embeddedPlayback";
import {
  EMBEDDED_VIDEO_ONLY_MIN_WIDTH,
  embeddedVideoOnlyHeight,
} from "./embeddedVideoLayout";
import {
  parseOverlayPosition,
  type EmbeddedSubtitleOverlayPosition,
} from "./embeddedSubtitleOverlayPosition";
import { SubtitleModeControl } from "./components/ui/SubtitleModeControl";
import { TargetLanguageSelect } from "./components/ui/TargetLanguageSelect";
import { buildLocalAiTranslationPrompt } from "./localAiTranslationPrompt";
import { normalizeUiLanguage } from "./i18n";
import {
  TranslationMissingState,
  type TranslationCopyStatus,
} from "./TranslationMissingState";
import type { DisplayBlock } from "./SubtitleList";
import { SubtitleViewer } from "./SubtitleViewer";
import { resolveSubtitleCursorPresentation } from "./subtitleCursor";
import { groupTranslationBlocks } from "./subtitleBlocks";
import type {
  SessionState,
  SubtitleDisplayMode,
  ViewerSnapshot,
} from "./types";
import { useDesktopUpdater, type DesktopUpdateState } from "./useDesktopUpdater";
import { useSubtitleView } from "./useSubtitleView";
import { VideoSessionPicker } from "./VideoSessionPicker";
import { useViewerSession } from "./useViewerSession";
import {
  CINEMA_PRESENTED_EVENT,
  resolveWindowViewMode,
  WINDOW_GEOMETRY_STORAGE_KEYS,
  type WindowViewMode,
} from "./windowPresentation";

type ViewMode = WindowViewMode;

interface WindowSize {
  width: number;
  height: number;
}

interface WindowPosition {
  x: number;
  y: number;
}

const SUBTITLE_MODE_STORAGE_KEY = "listenup-subtitle-display-mode";
const TARGET_LANGUAGE_STORAGE_KEY = "listenup-target-language";
const EMBEDDED_SUBTITLE_OVERLAY_POSITION_STORAGE_KEY =
  "listenup-embedded-subtitle-overlay-position-v1";
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
const INVALID_PASTE_NOTICE_DURATION_MS = 2_000;
const IS_DEV_BUILD = import.meta.env.VITE_LISTENUP_ENV === "development";

const isEditablePasteTarget = (target: EventTarget | null) =>
  target instanceof Element &&
  target.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"])'
  ) !== null;

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

const CURRENT_WINDOW = getCurrentWindow();
const IS_CINEMA_WINDOW = CURRENT_WINDOW.label === "cinema";

const loadStoredSubtitleMode = (): SubtitleDisplayMode => {
  const stored = localStorage.getItem(SUBTITLE_MODE_STORAGE_KEY);
  return stored === "translation" || stored === "bilingual" ? stored : "source";
};

const loadStoredOverlayPosition = () =>
  parseOverlayPosition(
    localStorage.getItem(EMBEDDED_SUBTITLE_OVERLAY_POSITION_STORAGE_KEY)
  );

const loadStoredSize = (mode: ViewMode): WindowSize | null => {
  try {
    const raw = localStorage.getItem(WINDOW_GEOMETRY_STORAGE_KEYS[mode].size);
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

const persistCurrentWindowPosition = async (mode: ViewMode) => {
  const appWindow = CURRENT_WINDOW;
  const [position, scaleFactor] = await Promise.all([
    appWindow.outerPosition(),
    appWindow.scaleFactor(),
  ]);
  if (scaleFactor <= 0) return;
  const logical = position.toLogical(scaleFactor);
  localStorage.setItem(
    WINDOW_GEOMETRY_STORAGE_KEYS[mode].position,
    JSON.stringify({ x: logical.x, y: logical.y } satisfies WindowPosition)
  );
};

const restoreCurrentWindowPosition = async (mode: ViewMode) => {
  try {
    const raw = localStorage.getItem(
      WINDOW_GEOMETRY_STORAGE_KEYS[mode].position
    );
    if (!raw) return;
    const position = JSON.parse(raw) as WindowPosition;
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return;
    await CURRENT_WINDOW.setPosition(
      new LogicalPosition(position.x, position.y)
    );
  } catch {
    // 损坏或越界位置交给系统当前窗口位置兜底。
  }
};

const persistCurrentWindowSize = async (mode: ViewMode) => {
  const appWindow = CURRENT_WINDOW;
  const [innerSize, scaleFactor] = await Promise.all([
    appWindow.innerSize(),
    appWindow.scaleFactor(),
  ]);
  if (scaleFactor <= 0) return;
  const logicalSize: WindowSize = {
    width: Math.round(innerSize.width / scaleFactor),
    height: Math.round(innerSize.height / scaleFactor),
  };
  localStorage.setItem(
    WINDOW_GEOMETRY_STORAGE_KEYS[mode].size,
    JSON.stringify(logicalSize)
  );
};

const formatTime = (seconds: number) => {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = Math.floor(safeSeconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
};

const statusText = (session: SessionState | null, t: TFunction) => {
  if (!session) return t("status.waitingSubtitles");
  if (session.status === "loading") return t("status.loadingSubtitles");
  if (session.status === "empty") return t("status.emptySubtitles");
  if (session.status === "error") return session.error ?? t("status.subtitleLoadFailed");
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
  const { t } = useTranslation();
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
          {t("update.updateNow")}
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
  const { t } = useTranslation();
  const action = isPaused !== false ? "play" : "pause";
  const label = action === "play" ? t("playback.playYoutube") : t("playback.pauseYoutube");
  return (
    <DesktopIconButton
      className={`${compact ? "flex h-6 w-6 items-center justify-center" : iconButtonClassName} cursor-pointer border-none bg-transparent text-fg-muted transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-40`}
      onPress={onPress}
      isDisabled={disabled}
      tooltip={pending ? t("playback.controlling") : disabledReason ?? label}
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
  const { t, i18n: i18next } = useTranslation();
  const { viewer, connected, cursor, applyViewerSnapshot } = useViewerSession();
  const mode = resolveWindowViewMode(CURRENT_WINDOW.label);
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
  const [embeddedActionPending, setEmbeddedActionPending] = useState<
    "reload" | "replace" | "exit" | null
  >(null);
  const [embeddedActionError, setEmbeddedActionError] = useState<string | null>(
    null
  );
  const [showEmbeddedLinkEditor, setShowEmbeddedLinkEditor] = useState(false);
  const [embeddedSubtitleListCollapsed, setEmbeddedSubtitleListCollapsed] =
    useState(false);
  const [embeddedSubtitleOverlayEnabled, setEmbeddedSubtitleOverlayEnabled] =
    useState(false);
  const [embeddedSubtitleOverlayPosition, setEmbeddedSubtitleOverlayPosition] =
    useState<EmbeddedSubtitleOverlayPosition>(loadStoredOverlayPosition);
  const [showCookieSettings, setShowCookieSettings] = useState(false);
  const [replacementUrl, setReplacementUrl] = useState("");
  const [browserSwitchRequest, setBrowserSwitchRequest] = useState<{
    initialUrl: string;
  } | null>(null);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const embeddedExpandedSizeRef = useRef<WindowSize | null>(null);
  const vListRef = useRef<VListHandle>(null);
  const lastScrolledViewRef = useRef<{
    sessionId: string | null;
    blocks: DisplayBlock[];
  } | null>(null);
  const scrollIdleTimerRef = useRef<number | null>(null);
  const cinemaToolbarHintTimerRef = useRef<number | null>(null);
  const cinemaTrackingRefreshFrameRef = useRef<number | null>(null);
  const updater = useDesktopUpdater({ enabled: !IS_DEV_BUILD && !IS_CINEMA_WINDOW });
  const liveSession = viewer.activeSession;
  const embeddedSource =
    viewer.source?.kind === "embedded" ? viewer.source : null;
  const queryVideoId = resolveSubtitleQueryVideoId({
    liveVideoId: liveSession?.videoId ?? null,
    embeddedVideoId: embeddedSource?.videoId ?? null,
  });
  const queryScope = queryVideoId ?? "latest";
  const subtitleQuery = useSubtitleView(
    queryVideoId,
    knownRevision?.scope === queryScope ? knownRevision.revision : null,
    subtitleMode,
    targetLanguage
  );

  useEffect(() => {
    let disposed = false;
    void getVersion()
      .then((version) => {
        if (!disposed) setAppVersion(version);
      })
      .catch(() => {
        if (!disposed) setAppVersion(null);
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    void applyWindowSizeForMode(mode)
      .then(() => restoreCurrentWindowPosition(mode))
      .then(() => invoke("ensure_window_visible"))
      .catch((error) => console.error("failed to initialize window geometry", error));
  }, [mode]);

  useEffect(() => {
    if (IS_CINEMA_WINDOW) return;
    let unlisten: (() => void) | null = null;
    void CURRENT_WINDOW.onFocusChanged((event) => {
      if (!event.payload) return;
      setSubtitleMode(loadStoredSubtitleMode());
      setTargetLanguage(localStorage.getItem(TARGET_LANGUAGE_STORAGE_KEY));
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => unlisten?.();
  }, []);

  const session = liveSession;
  const pickerVisible = viewer.selectionRequired;
  const sourceEntryVisible = shouldShowSourceEntry(viewer);
  const browserSourceActive = viewer.sourceMode === "browserActive";

  const openBrowserSourceSwitch = useCallback((initialUrl = "") => {
    setPasteNotice(null);
    setBrowserSwitchRequest({ initialUrl });
  }, []);

  const closeBrowserSourceSwitch = useCallback(() => {
    setBrowserSwitchRequest(null);
  }, []);

  const confirmBrowserSourceSwitch = useCallback(
    async (normalizedUrl: string) => {
      await invoke("start_embedded_playback", { url: normalizedUrl });
    },
    []
  );

  useEffect(() => {
    if (browserSourceActive) return;
    setBrowserSwitchRequest(null);
    setPasteNotice(null);
  }, [browserSourceActive]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const decision = decideBrowserSourcePaste({
        text: event.clipboardData?.getData("text/plain") ?? "",
        browserSourceActive,
        editableTarget: isEditablePasteTarget(event.target),
        modalOpen: browserSwitchRequest !== null,
      });
      if (decision.kind === "ignore") return;

      event.preventDefault();
      if (decision.kind === "invalid") {
        setPasteNotice(t("linkValidation.pasteUnrecognized"));
        return;
      }
      openBrowserSourceSwitch(decision.normalizedUrl);
    };

    document.addEventListener("paste", handlePaste, true);
    return () => document.removeEventListener("paste", handlePaste, true);
  }, [browserSourceActive, browserSwitchRequest, openBrowserSourceSwitch, t]);

  useEffect(() => {
    if (!pasteNotice) return;
    const timer = window.setTimeout(
      () => setPasteNotice(null),
      INVALID_PASTE_NOTICE_DURATION_MS
    );
    return () => window.clearTimeout(timer);
  }, [pasteNotice]);

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
      void applyWindowSizeForMode("cinema");
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

  const handleCinemaPresented = useCallback(() => {
    if (cinemaToolbarHintTimerRef.current !== null) {
      window.clearTimeout(cinemaToolbarHintTimerRef.current);
    }
    if (cinemaTrackingRefreshFrameRef.current !== null) {
      window.cancelAnimationFrame(cinemaTrackingRefreshFrameRef.current);
    }
    setShowCinemaToolbarHint(true);
    cinemaToolbarHintTimerRef.current = window.setTimeout(() => {
      cinemaToolbarHintTimerRef.current = null;
      setShowCinemaToolbarHint(false);
    }, CINEMA_TOOLBAR_HINT_DURATION_MS);

    cinemaTrackingRefreshFrameRef.current = window.requestAnimationFrame(() => {
      cinemaTrackingRefreshFrameRef.current = window.requestAnimationFrame(() => {
        cinemaTrackingRefreshFrameRef.current = null;
        void invoke("refresh_window_mouse_tracking").catch((error) => {
          console.error("failed to refresh cinema mouse tracking", error);
        });
      });
    });
  }, []);

  useEffect(() => {
    if (mode !== "cinema") {
      setShowCinemaToolbarHint(false);
      return;
    }

    handleCinemaPresented();
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void CURRENT_WINDOW.listen(CINEMA_PRESENTED_EVENT, handleCinemaPresented)
      .then((dispose) => {
        if (disposed) {
          dispose();
        } else {
          unlisten = dispose;
        }
      })
      .catch((error) => {
        console.error("failed to listen for cinema presentation", error);
      });
    return () => {
      disposed = true;
      unlisten?.();
      if (cinemaToolbarHintTimerRef.current !== null) {
        window.clearTimeout(cinemaToolbarHintTimerRef.current);
        cinemaToolbarHintTimerRef.current = null;
      }
      if (cinemaTrackingRefreshFrameRef.current !== null) {
        window.cancelAnimationFrame(cinemaTrackingRefreshFrameRef.current);
        cinemaTrackingRefreshFrameRef.current = null;
      }
    };
  }, [handleCinemaPresented, mode]);

  const switchMode = useCallback(async (nextMode: ViewMode) => {
    if (nextMode === mode) return;

    try {
      await Promise.all([
        persistCurrentWindowSize(mode),
        persistCurrentWindowPosition(mode),
      ]);
    } catch (error) {
      console.error("failed to persist window geometry", error);
    }

    try {
      await invoke(nextMode === "cinema" ? "enter_cinema_mode" : "exit_cinema_mode");
    } catch (error) {
      console.error("failed to switch window presentation", error);
    }
  }, [mode]);

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
        }, normalizeUiLanguage(i18next.resolvedLanguage))
      );
      setTranslationCopyStatus("copied");
    } catch (error) {
      console.error("failed to copy local AI translation prompt", error);
      setTranslationCopyStatus("error");
    }
  }, [i18next.resolvedLanguage, subtitleQuery.data?.source]);

  useEffect(() => {
    setTranslationCopyStatus("idle");
  }, [subtitleQuery.data?.source.revision]);

  const closeWindow = useCallback(() => {
    void CURRENT_WINDOW.close();
  }, []);

  const runEmbeddedAction = useCallback(
    async (
      action: "reload" | "replace" | "exit",
      task: () => Promise<unknown>
    ) => {
      setEmbeddedActionPending(action);
      setEmbeddedActionError(null);
      try {
        await task();
      } catch (error) {
        setEmbeddedActionError(
          error instanceof Error ? error.message : String(error)
        );
      } finally {
        setEmbeddedActionPending(null);
      }
    },
    []
  );

  const reloadEmbeddedPlayback = useCallback(
    () =>
      runEmbeddedAction("reload", () => invoke("reload_embedded_playback")),
    [runEmbeddedAction]
  );

  const replaceEmbeddedPlayback = useCallback(async () => {
    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeYoutubeWatchUrl(replacementUrl);
    } catch (error) {
      setEmbeddedActionError(
        error instanceof YoutubeLinkError
          ? t(`linkValidation.${error.code}`)
          : t("sourceEntry.invalidLink")
      );
      return;
    }
    await runEmbeddedAction("replace", async () => {
      await invoke("replace_embedded_playback", { url: normalizedUrl });
      setReplacementUrl("");
      setShowEmbeddedLinkEditor(false);
    });
  }, [replacementUrl, runEmbeddedAction, t]);

  const stopEmbeddedPlayback = useCallback(
    () => runEmbeddedAction("exit", () => invoke("stop_embedded_playback")),
    [runEmbeddedAction]
  );

  const restoreEmbeddedSubtitleList = useCallback(async () => {
    setEmbeddedSubtitleListCollapsed(false);
    const appWindow = getCurrentWindow();
    await appWindow.setMinSize(
      new LogicalSize(MIN_SIZES.list.width, MIN_SIZES.list.height)
    );
    const targetSize =
      embeddedExpandedSizeRef.current ??
      loadStoredSize("list") ??
      DEFAULT_SIZES.list;
    await appWindow.setSize(
      new LogicalSize(
        Math.max(targetSize.width, MIN_SIZES.list.width),
        Math.max(targetSize.height, MIN_SIZES.list.height)
      )
    );
  }, []);

  const toggleEmbeddedSubtitleList = useCallback(async () => {
    if (!embeddedSource) return;
    if (embeddedSubtitleListCollapsed) {
      try {
        await restoreEmbeddedSubtitleList();
      } catch (error) {
        console.error("failed to restore embedded subtitle list", error);
      }
      return;
    }

    try {
      const appWindow = getCurrentWindow();
      const [innerSize, scaleFactor] = await Promise.all([
        appWindow.innerSize(),
        appWindow.scaleFactor(),
      ]);
      if (scaleFactor <= 0) return;
      const currentSize: WindowSize = {
        width: Math.round(innerSize.width / scaleFactor),
        height: Math.round(innerSize.height / scaleFactor),
      };
      embeddedExpandedSizeRef.current = currentSize;
      const headerHeight = headerRef.current?.getBoundingClientRect().height ?? 103;
      const minHeight = embeddedVideoOnlyHeight(
        EMBEDDED_VIDEO_ONLY_MIN_WIDTH,
        headerHeight
      );
      const targetHeight = embeddedVideoOnlyHeight(currentSize.width, headerHeight);
      setEmbeddedSubtitleListCollapsed(true);
      await appWindow.setMinSize(
        new LogicalSize(EMBEDDED_VIDEO_ONLY_MIN_WIDTH, minHeight)
      );
      await appWindow.setSize(
        new LogicalSize(
          Math.max(currentSize.width, EMBEDDED_VIDEO_ONLY_MIN_WIDTH),
          targetHeight
        )
      );
    } catch (error) {
      console.error("failed to collapse embedded subtitle list", error);
    }
  }, [
    embeddedSource,
    embeddedSubtitleListCollapsed,
    restoreEmbeddedSubtitleList,
  ]);

  useEffect(() => {
    if (embeddedSource) return;
    if (embeddedSubtitleOverlayEnabled) {
      setEmbeddedSubtitleOverlayEnabled(false);
    }
    if (embeddedSubtitleListCollapsed) {
      void restoreEmbeddedSubtitleList().catch((error) => {
        console.error("failed to reset embedded subtitle list", error);
      });
    }
  }, [
    embeddedSource,
    embeddedSubtitleListCollapsed,
    embeddedSubtitleOverlayEnabled,
    restoreEmbeddedSubtitleList,
  ]);

  const persistEmbeddedSubtitleOverlayPosition = useCallback(
    (position: EmbeddedSubtitleOverlayPosition) => {
      setEmbeddedSubtitleOverlayPosition(position);
      localStorage.setItem(
        EMBEDDED_SUBTITLE_OVERLAY_POSITION_STORAGE_KEY,
        JSON.stringify(position)
      );
    },
    []
  );

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

  const authoritativeConnected = Boolean(embeddedSource) || connected;
  const playbackDisabled =
    playbackPending ||
    !authoritativeConnected ||
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
    ? statusText(session, t)
    : viewer.playingSessionCount >= 2
      ? t("status.confirmingVideo")
      : subtitleQuery.isPending
        ? t("status.readingLocalSubtitles")
        : subtitleQuery.isError
          ? t("status.localSubtitleFailed", { detail: String(subtitleQuery.error) })
          : displayBlocks.length === 0
            ? t("status.waitingSubtitles")
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

  const connectionLabel = embeddedSource
    ? viewer.sourceMode === "embeddedRecovering"
      ? t("status.playerNeedsAttention")
      : t("status.desktopPlayback")
    : viewer.awaitingBrowserPlayback
      ? t("status.waitingBrowserPlayback")
      : connected
        ? t("status.connected")
        : t("status.waitingExtension");
  const playbackSecond = Math.floor(cursor?.currentTime ?? 0);
  const playbackDisabledReason = playbackPending
    ? t("playback.controlling")
    : !authoritativeConnected
      ? t("playback.noSource")
      : !session
        ? t("playback.waitingVideo")
        : !cursor
          ? t("playback.waitingState")
          : cursor.isAdPlaying
            ? t("playback.adPlaying")
            : undefined;
  if (!embeddedSource && mode === "cinema") {
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
            {t("header.list")}
          </DesktopButton>
          <SubtitleModeControl
            compact
            value={subtitleMode}
            onChange={switchSubtitleMode}
          />
          <DevBadge />
          <StatusDot connected={authoritativeConnected} />
          <PlaybackButton
            compact
            isPaused={cursor?.isPaused ?? null}
            disabled={playbackDisabled}
            disabledReason={playbackDisabledReason}
            pending={playbackPending}
            onPress={controlPlayback}
          />
          {playbackError && (
            <span className="text-[11px] text-red-300">
              {playbackError}
            </span>
          )}
          <PlaybackTime
            seconds={playbackSecond}
            className="text-[11px] text-fg-faint"
          />
          <DesktopIconButton
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-fg-muted transition-colors hover:text-fg"
            onPress={() => void switchMode("list")}
            tooltip={t("header.exitCinema")}
            ariaLabel={t("header.exitCinema")}
            icon={
              <Icon
                icon="mdi:close"
                className="h-3.5 w-3.5 flex-none"
                aria-hidden="true"
              />
            }
          />
        </div>
        <VideoSessionPicker
          isOpen={pickerVisible}
          candidates={viewer.playingCandidates}
          selectedSessionId={viewer.selectedSessionId}
          busySessionId={busySessionId}
          error={pickerError}
          onSelect={(sessionId) => void selectVideoSession(sessionId)}
        />
      </main>
    );
  }

  return (
    <main
      className={`${shellClassName} relative grid ${
        embeddedSource && embeddedSubtitleListCollapsed
          ? "grid-rows-[auto_minmax(0,1fr)]"
          : embeddedSource
            ? "grid-rows-[auto_auto_minmax(0,1fr)_auto]"
          : "grid-rows-[auto_minmax(0,1fr)_auto]"
      }`}
    >
      <UpdateNotice
        state={updater.state}
        onInstall={() => void updater.installAvailableUpdate()}
      />
      <header
        ref={headerRef}
        className="min-w-0 border-b border-hairline pb-2.5 pl-3.5 pr-3 pt-3"
        data-tauri-drag-region
      >
        <div
          className="flex min-w-0 items-center gap-2.5"
          data-tauri-drag-region
        >
          <span
            className="grid h-[26px] w-[26px] flex-none place-items-center"
            aria-hidden="true"
          >
            <YoutubeLogo size={22} />
          </span>
          <h1
            className="m-0 min-w-0 flex-1 truncate text-[13px] font-[650] tracking-[-0.01em] text-fg"
            data-tauri-drag-region
          >
            {session?.title ?? subtitleQuery.data?.source.title ?? "ListenUp Desktop"}
          </h1>
          <DevBadge />
          {embeddedSource ? (
            <>
              <DesktopIconButton
                className={iconButtonClassName}
                onPress={() => void toggleEmbeddedSubtitleList()}
                tooltip={
                  embeddedSubtitleListCollapsed
                    ? t("header.expandSubtitles")
                    : t("header.collapseSubtitles")
                }
                ariaLabel={
                  embeddedSubtitleListCollapsed
                    ? t("header.expandSubtitles")
                    : t("header.collapseSubtitles")
                }
                icon={
                  <Icon
                    icon={
                      embeddedSubtitleListCollapsed
                        ? "mdi:eye-outline"
                        : "mdi:eye-off-outline"
                    }
                    className="h-3.5 w-3.5 flex-none"
                    aria-hidden="true"
                  />
                }
              />
              <DesktopIconButton
                className={`${iconButtonClassName} disabled:cursor-wait disabled:opacity-45`}
                onPress={() => void reloadEmbeddedPlayback()}
                isDisabled={embeddedActionPending !== null}
                tooltip={t("header.reloadVideo")}
                ariaLabel={t("header.reloadVideo")}
                icon={
                  <Icon
                    icon={
                      embeddedActionPending === "reload"
                        ? "mdi:loading"
                        : "mdi:reload"
                    }
                    className={`h-3.5 w-3.5 flex-none ${embeddedActionPending === "reload" ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                }
              />
              <DesktopIconButton
                className={iconButtonClassName}
                onPress={() => {
                  setEmbeddedActionError(null);
                  setShowEmbeddedLinkEditor(true);
                }}
                tooltip={t("header.pasteNewLink")}
                ariaLabel={t("header.pasteNewLink")}
                icon={
                  <Icon
                    icon="mdi:link-variant"
                    className="h-3.5 w-3.5 flex-none"
                    aria-hidden="true"
                  />
                }
              />
              <DesktopIconButton
                className={iconButtonClassName}
                onPress={() => setShowCookieSettings(true)}
                tooltip={t("header.youtubeCookie")}
                ariaLabel={t("header.setYoutubeCookie")}
                icon={
                  <Icon
                    icon="mdi:key-chain-variant"
                    className="h-3.5 w-3.5 flex-none"
                    aria-hidden="true"
                  />
                }
              />
              <DesktopIconButton
                className={`${iconButtonClassName} disabled:cursor-wait disabled:opacity-45`}
                onPress={() => void stopEmbeddedPlayback()}
                isDisabled={embeddedActionPending !== null}
                tooltip={t("header.exitDesktopPlayback")}
                ariaLabel={t("header.exitDesktopPlaybackLabel")}
                icon={
                  <Icon
                    icon={
                      embeddedActionPending === "exit"
                        ? "mdi:loading"
                        : "mdi:close"
                    }
                    className={`h-3.5 w-3.5 flex-none ${embeddedActionPending === "exit" ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                }
              />
            </>
          ) : (
            <>
              {browserSourceActive && (
                <DesktopButton
                  className="flex h-[26px] cursor-pointer items-center gap-1 rounded-[7px] border-none bg-wash px-2 text-[10px] font-semibold text-fg transition-colors hover:bg-wash-active"
                  onPress={() => openBrowserSourceSwitch()}
                  aria-label={t("header.switchToDesktopPlayback")}
                >
                  <Icon
                    icon="mdi:swap-horizontal"
                    className="h-3.5 w-3.5 flex-none"
                    aria-hidden="true"
                  />
                  {t("header.switch")}
                </DesktopButton>
              )}
              <DesktopIconButton
                className={iconButtonClassName}
                onPress={() => void switchMode("cinema")}
                tooltip={t("header.cinemaMode")}
                ariaLabel={t("header.switchToCinema")}
                icon={
                  <Icon
                    icon="mdi:movie-open-outline"
                    className="h-3.5 w-3.5 flex-none"
                    aria-hidden="true"
                  />
                }
              />
              <DesktopIconButton
                className={iconButtonClassName}
                onPress={closeWindow}
                tooltip={t("header.closeWindow")}
                ariaLabel={t("header.closeWindow")}
                icon={
                  <Icon
                    icon="mdi:close"
                    className="h-3.5 w-3.5 flex-none"
                    aria-hidden="true"
                  />
                }
              />
            </>
          )}
        </div>
        <div
          className="mt-2 flex min-w-0 items-center gap-[7px] text-[11px] text-fg-faint"
          data-tauri-drag-region
        >
          <StatusDot connected={connected} />
          <span className="flex-none">{connectionLabel}</span>
          <span className="flex-none">·</span>
          <span className="min-w-0 truncate">
            {session?.track?.displayName ??
              subtitleQuery.data?.source.displayName ??
              t("header.subtitleDemo")}
          </span>
          <span className="flex-1" />
          {(playbackError || embeddedActionError) && (
            <span className="text-red-300">
              {playbackError ?? embeddedActionError}
            </span>
          )}
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
          {embeddedSource && (
            <DesktopIconButton
              className={`${iconButtonClassName} ${
                embeddedSubtitleOverlayEnabled ? "bg-wash text-fg" : ""
              }`}
              onPress={() =>
                setEmbeddedSubtitleOverlayEnabled((enabled) => !enabled)
              }
              tooltip={
                embeddedSubtitleOverlayEnabled
                  ? t("header.disableVideoOverlay")
                  : t("header.enableVideoOverlay")
              }
              ariaLabel={
                embeddedSubtitleOverlayEnabled
                  ? t("header.disableVideoOverlay")
                  : t("header.enableVideoOverlay")
              }
              icon={
                <Icon
                  icon={
                    embeddedSubtitleOverlayEnabled
                      ? "mdi:subtitles"
                      : "mdi:subtitles-outline"
                  }
                  className="h-3.5 w-3.5 flex-none"
                  aria-hidden="true"
                />
              }
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

      {embeddedSource && (
        <div
          className={
            embeddedSubtitleListCollapsed ? "min-h-0 overflow-hidden" : ""
          }
        >
          <EmbeddedVideoPanel
            copyStatus={translationCopyStatus}
            fillAvailableSpace={embeddedSubtitleListCollapsed}
            onCopyTranslationPrompt={copyLocalAiTranslationPrompt}
            onOverlayPositionChange={persistEmbeddedSubtitleOverlayPosition}
            overlayBlock={currentSubtitle}
            overlayEnabled={embeddedSubtitleOverlayEnabled}
            overlayPosition={embeddedSubtitleOverlayPosition}
            source={embeddedSource}
            subtitles={
              session?.sessionId === embeddedSource.sessionId
                ? session.subtitles
                : []
            }
            translationMissing={requestedTranslationMissing}
          />
        </div>
      )}

      {!embeddedSubtitleListCollapsed && (
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
              connected={authoritativeConnected}
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
      )}

      {!embeddedSubtitleListCollapsed && (
        <footer className="flex items-center justify-between border-t border-hairline px-3.5 py-2 text-[10px] text-fg-faint tabular-nums">
          <LanguageSwitcher />
          <div className="flex items-center gap-1.5">
            <span aria-label={t("footer.currentVersion", { version: appVersion ?? "…" })}>
              v{appVersion ?? "…"}
            </span>
            <DesktopButton
              className="flex h-6 cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent px-1 text-[10px] text-fg-faint transition-colors hover:bg-wash hover:text-fg disabled:cursor-wait disabled:opacity-45"
              onPress={() => void updater.checkForUpdates()}
              isDisabled={updater.isBusy}
              aria-label={t("footer.checkUpdates")}
            >
              <Icon
                icon={updater.isBusy ? "mdi:loading" : "mdi:update"}
                className={`h-3.5 w-3.5 flex-none ${updater.isBusy ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {t("footer.checkUpdates")}
            </DesktopButton>
          </div>
        </footer>
      )}
      {pasteNotice && (
        <div
          className="pointer-events-none absolute bottom-10 left-1/2 z-20 max-w-[calc(100%-24px)] -translate-x-1/2 rounded-full border border-hairline bg-black/85 px-3 py-1.5 text-[10px] text-fg shadow-lg backdrop-blur-xl"
          role="status"
          aria-live="polite"
        >
          {pasteNotice}
        </div>
      )}
      <VideoSessionPicker
        isOpen={pickerVisible}
        candidates={viewer.playingCandidates}
        selectedSessionId={viewer.selectedSessionId}
        busySessionId={busySessionId}
        error={pickerError}
        onSelect={(sessionId) => void selectVideoSession(sessionId)}
      />
      {embeddedSource && (
        <EmbeddedLinkEditorModal
          isOpen={showEmbeddedLinkEditor}
          url={replacementUrl}
          error={embeddedActionError}
          pending={embeddedActionPending !== null}
          onUrlChange={setReplacementUrl}
          onClose={() => {
            setReplacementUrl("");
            setEmbeddedActionError(null);
            setShowEmbeddedLinkEditor(false);
          }}
          onSubmit={() => void replaceEmbeddedPlayback()}
        />
      )}
      {embeddedSource && (
        <CookieSettings
          isOpen={showCookieSettings}
          onClose={() => setShowCookieSettings(false)}
          onCredentialsChanged={() => void reloadEmbeddedPlayback()}
        />
      )}
      {browserSourceActive && (
        <BrowserSourceSwitchModal
          isOpen={browserSwitchRequest !== null}
          initialUrl={browserSwitchRequest?.initialUrl ?? ""}
          onClose={closeBrowserSourceSwitch}
          onConfirm={confirmBrowserSourceSwitch}
        />
      )}
    </main>
  );
}
