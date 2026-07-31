/**
 * @purpose 字幕窗口 UI：列表/影院模式、多视频选择、应用更新、虚拟滚动与窗口状态持久化。
 * @role    桌面端唯一的页面组件，消费 Rust 推来的 session/cursor 事件。
 * @deps    @tauri-apps/api、virtua、@iconify/react、VideoSessionPicker、useDesktopUpdater、./types
 * @gotcha  多视频候选和锁定完全以 Rust snapshot 为准；selectionRequired 遮罩不可关闭
 */
import { Icon } from "@iconify/react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { LogicalSize, getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VList, type VListHandle } from "virtua";
import type { CursorState, SessionState, UiUpdate, ViewerSnapshot } from "./types";
import { useDesktopUpdater, type DesktopUpdateState } from "./useDesktopUpdater";
import { VideoSessionPicker } from "./VideoSessionPicker";

type ViewMode = "list" | "cinema";

interface WindowSize {
  width: number;
  height: number;
}

const MODE_STORAGE_KEY = "listenup-view-mode";
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
const EMPTY_VIEWER_SNAPSHOT: ViewerSnapshot = {
  connected: false,
  activeSession: null,
  playingCandidates: [],
  playingSessionCount: 0,
  selectedSessionId: null,
  selectionRequired: false,
};

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

const applyWindowSizeForMode = async (mode: ViewMode) => {
  const appWindow = getCurrentWindow();
  const minSize = MIN_SIZES[mode];
  const targetSize = loadStoredSize(mode) ?? DEFAULT_SIZES[mode];
  await appWindow.setMinSize(new LogicalSize(minSize.width, minSize.height));
  await appWindow.setSize(new LogicalSize(targetSize.width, targetSize.height));
  // 影院模式追求沉浸：关掉 vibrancy 磨砂和系统窗口投影
  // （投影在透明窗口上会形成一圈黑边），列表模式恢复
  await invoke("set_vibrancy", { enabled: mode === "list" });
  await appWindow.setShadow(mode === "list");
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
    className={`h-1.5 w-1.5 flex-none rounded-full transition-all ${
      connected
        ? "bg-ok shadow-[0_0_6px_rgba(48,209,88,0.7)]"
        : "bg-white/25"
    }`}
  />
);

const UpdateNotice = ({ state }: { state: DesktopUpdateState }) => {
  if (!state.message) return null;
  const isError = state.phase === "error";
  const isSuccess = state.phase === "current" || state.phase === "installed";

  return (
    <div
      className={`pointer-events-none absolute left-1/2 top-3 z-40 flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] shadow-lg backdrop-blur-xl ${
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
        <Icon icon="mdi:loading" className="h-3.5 w-3.5 flex-none animate-spin" />
      )}
      {isError && <Icon icon="mdi:alert-circle-outline" className="h-3.5 w-3.5 flex-none" />}
      {isSuccess && <Icon icon="mdi:check-circle-outline" className="h-3.5 w-3.5 flex-none" />}
      <span className="truncate">{state.message}</span>
    </div>
  );
};

export default function App() {
  const [viewer, setViewer] = useState<ViewerSnapshot>(EMPTY_VIEWER_SNAPSHOT);
  const [mode, setMode] = useState<ViewMode>(loadStoredMode);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [isListScrolling, setIsListScrolling] = useState(false);
  const modeRef = useRef(mode);
  const vListRef = useRef<VListHandle>(null);
  const lastScrolledSessionRef = useRef<string | null>(null);
  const scrollIdleTimerRef = useRef<number | null>(null);
  const updater = useDesktopUpdater({ enabled: !IS_DEV_BUILD });

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    let unlistenConnection: (() => void) | null = null;

    const initialize = async () => {
      unlistenConnection = await listen<boolean>(
        "native-subtitle-connection",
        (event) => {
          setViewer((current) => ({
            ...current,
            connected: Boolean(event.payload),
          }));
        }
      );
      unlisten = await listen<UiUpdate>("native-subtitle-update", (event) => {
        const update = event.payload;
        if (update.kind === "snapshot") {
          setViewer({ ...update.payload, connected: true });
          return;
        }

        const cursor = update.payload;
        setViewer((current) => {
          if (
            !current.activeSession ||
            current.activeSession.sessionId !== cursor.sessionId
          ) {
            return current;
          }
          return {
            ...current,
            connected: true,
            activeSession: { ...current.activeSession, cursor },
          };
        });
      });

      const snapshot = await invoke<ViewerSnapshot>("get_snapshot");
      if (!disposed) {
        setViewer(snapshot);
      }
    };

    void initialize();
    return () => {
      disposed = true;
      unlisten?.();
      unlistenConnection?.();
      if (scrollIdleTimerRef.current !== null) {
        window.clearTimeout(scrollIdleTimerRef.current);
      }
    };
  }, []);

  const session = viewer.activeSession;
  const connected = viewer.connected;
  const pickerVisible = viewer.selectionRequired;

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
      setViewer(snapshot);
    } catch (error) {
      setPickerError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusySessionId(null);
    }
  }, []);

  useEffect(() => {
    applyWindowSizeForMode(modeRef.current).catch((error) => {
      console.error("failed to apply initial window size", error);
    });
  }, []);

  const switchMode = useCallback(async (nextMode: ViewMode) => {
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
  }, []);

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

  const cursor: CursorState | null = session?.cursor ?? null;
  const currentIndex = cursor?.currentIndex ?? -1;
  const emptyMessage =
    !session && viewer.playingSessionCount >= 2
      ? "正在确认视频…"
      : statusText(session);
  const currentSubtitle =
    session && currentIndex >= 0 && currentIndex < session.subtitles.length
      ? session.subtitles[currentIndex]
      : null;

  useEffect(() => {
    if (mode !== "list" || currentIndex < 0 || !vListRef.current) return;

    const sessionId = session?.sessionId ?? null;
    const isNewSession = lastScrolledSessionRef.current !== sessionId;
    lastScrolledSessionRef.current = sessionId;

    vListRef.current.scrollToIndex(currentIndex, {
      align: "center",
      smooth: !isNewSession,
    });
  }, [currentIndex, session?.sessionId, mode]);

  const connectionLabel = connected ? "已连接" : "等待扩展连接";
  const playbackLabel = useMemo(() => {
    if (!cursor) return "等待播放";
    if (cursor.isAdPlaying) return "广告播放中";
    return cursor.isPaused ? "已暂停" : "同步播放中";
  }, [cursor]);

  if (mode === "cinema") {
    return (
      <main
        className="group relative flex h-full cursor-grab select-none items-center justify-center overflow-hidden rounded-2xl bg-glass-cinema px-5 py-2 active:cursor-grabbing"
        data-tauri-drag-region
      >
        <UpdateNotice state={updater.state} />
        <p
          className={`m-0 line-clamp-2 text-center leading-[1.45] tracking-[0.005em] [text-shadow:0_1px_6px_rgba(0,0,0,0.6)] ${
            currentSubtitle
              ? "text-xl font-[550] text-fg"
              : "text-sm font-normal text-fg-muted"
          }`}
          data-tauri-drag-region
        >
          {currentSubtitle?.text ?? emptyMessage ?? "…"}
        </p>
        <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-black/45 px-2 py-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="flex h-6 cursor-pointer items-center gap-[5px] rounded-full border-none bg-transparent px-1.5 text-[11px] text-fg-muted transition-colors hover:text-fg"
            onClick={() => void switchMode("list")}
            title="返回列表模式"
          >
            <Icon icon="mdi:format-list-bulleted" className="h-3.5 w-3.5 flex-none" />
            列表
          </button>
          <DevBadge />
          <StatusDot connected={connected} />
          <span className="text-[11px] text-fg-faint">{playbackLabel}</span>
          <span className="text-[11px] text-fg-faint tabular-nums">
            {formatTime(cursor?.currentTime ?? 0)}
          </span>
          <button
            type="button"
            className="flex h-6 cursor-pointer items-center rounded-full border-none bg-transparent px-1 text-fg-muted transition-colors hover:text-fg"
            onClick={closeWindow}
            title="收进菜单栏"
            aria-label="收进菜单栏"
          >
            <Icon icon="mdi:close" className="h-3.5 w-3.5 flex-none" />
          </button>
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
      <UpdateNotice state={updater.state} />
      <header
        className="min-w-0 border-b border-hairline pb-2.5 pl-3.5 pr-3 pt-3"
        data-tauri-drag-region
      >
        <div className="flex min-w-0 items-center gap-2.5" data-tauri-drag-region>
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
            {session?.title ?? "ListenUp Desktop"}
          </h1>
          <DevBadge />
          <button
            type="button"
            className={`${iconButtonClassName} disabled:cursor-wait disabled:opacity-45`}
            onClick={() => void updater.checkForUpdates()}
            disabled={updater.isBusy}
            title={updater.state.message ?? "检查更新"}
            aria-label="检查更新"
          >
            <Icon
              icon={updater.isBusy ? "mdi:loading" : "mdi:update"}
              className={`h-3.5 w-3.5 flex-none ${updater.isBusy ? "animate-spin" : ""}`}
            />
          </button>
          <button
            type="button"
            className={iconButtonClassName}
            onClick={() => void switchMode("cinema")}
            title="影院模式：字幕条悬浮在视频上"
            aria-label="切换到影院模式"
          >
            <Icon icon="mdi:movie-open-outline" className="h-3.5 w-3.5 flex-none" />
          </button>
          <button
            type="button"
            className={iconButtonClassName}
            onClick={closeWindow}
            title="收进菜单栏"
            aria-label="收进菜单栏"
          >
            <Icon icon="mdi:close" className="h-3.5 w-3.5 flex-none" />
          </button>
        </div>
        <div
          className="mt-2 flex min-w-0 items-center gap-[7px] text-[11px] text-fg-faint"
          data-tauri-drag-region
        >
          <StatusDot connected={connected} />
          <span className="flex-none">{connectionLabel}</span>
          <span className="flex-none">·</span>
          <span className="min-w-0 truncate">
            {session?.track?.displayName ?? "字幕同步 Demo"}
          </span>
          <span className="flex-1" />
          <span>{playbackLabel}</span>
          <span className="text-fg-muted tabular-nums">
            {formatTime(cursor?.currentTime ?? 0)}
          </span>
        </div>
      </header>

      <section className="relative min-h-0 overflow-hidden" aria-live="polite">
        {emptyMessage ? (
          <div className="grid min-h-full place-content-center justify-items-center text-center text-fg-muted">
            <div className="mb-3 grid h-8 w-11 place-items-center rounded-[7px] border border-white/25 text-xs font-bold text-fg">
              CC
            </div>
            <p className="m-0 mb-1.5 text-[13px] text-fg">{emptyMessage}</p>
            {!connected && (
              <small className="max-w-[280px] leading-normal text-fg-faint">
                在 YouTube 播放带字幕的视频，扩展会自动连接过来。
              </small>
            )}
          </div>
        ) : (
          <VList
            ref={vListRef}
            style={{ height: "100%" }}
            className={`subtitle-list ${isListScrolling ? "scrolling" : ""}`}
            onScroll={handleListScroll}
            onScrollEnd={handleListScrollEnd}
          >
            {session?.subtitles.map((subtitle, index) => {
              const isActive = index === currentIndex;
              const isPlayed = currentIndex >= 0 && index < currentIndex;
              return (
                <div
                  key={`${session.sessionId}-${subtitle.id}-${index}`}
                  className={`mx-2 grid grid-cols-[12px_40px_minmax(0,1fr)] items-start gap-2 rounded-[10px] py-2 pl-2.5 pr-2 transition-colors ${
                    isActive ? "bg-wash-active" : ""
                  }`}
                >
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
                  <p
                    className={`m-0 text-[13px] leading-[1.55] ${
                      isActive ? "font-medium text-fg" : "text-fg-muted"
                    }`}
                  >
                    {subtitle.text}
                  </p>
                </div>
              );
            })}
          </VList>
        )}
      </section>

      <footer className="flex items-center justify-between border-t border-hairline px-3.5 py-2 text-[10px] text-fg-faint tabular-nums">
        <span className="min-w-0 truncate">
          {session ? `YouTube · ${session.videoId}` : "本地内存 · 不联网"}
        </span>
        <span>{session?.subtitles.length ?? 0} 条字幕</span>
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
