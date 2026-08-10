/**
 * @purpose 渲染 Desktop 内置播放器：上方隔离 YouTube 视频，下方实时字幕、翻译与恢复控制。
 * @role    可信 player-ui；只通过受限 Tauri commands 操作 coordinator-owned EmbeddedSource。
 * @deps    React、@tauri-apps/api、clipboard-manager、SubtitleViewer、useViewerSession、useSubtitleView
 * @gotcha  youtube-* 是独立原生 child WebView；本地 UI 不读取远程 DOM，也不把浏览器 Cookie 传给它。
 */
import { Icon } from "@iconify/react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VListHandle } from "virtua";
import { DesktopButton } from "./components/ui/DesktopButton";
import { DesktopIconButton } from "./components/ui/DesktopIconButton";
import { DesktopTextField } from "./components/ui/DesktopTextField";
import { SubtitleModeControl } from "./components/ui/SubtitleModeControl";
import { TargetLanguageSelect } from "./components/ui/TargetLanguageSelect";
import { normalizeYoutubeWatchUrl } from "./embeddedPlayback";
import { buildLocalAiTranslationPrompt } from "./localAiTranslationPrompt";
import type { DisplayBlock } from "./SubtitleList";
import { SubtitleViewer } from "./SubtitleViewer";
import { groupTranslationBlocks } from "./subtitleBlocks";
import { resolveSubtitleCursorPresentation } from "./subtitleCursor";
import type { SubtitleDisplayMode } from "./types";
import {
  type TranslationCopyStatus,
} from "./TranslationMissingState";
import { useSubtitleView } from "./useSubtitleView";
import { useViewerSession } from "./useViewerSession";

const SUBTITLE_MODE_STORAGE_KEY = "listenup-subtitle-display-mode";
const TARGET_LANGUAGE_STORAGE_KEY = "listenup-target-language";
const SCROLLBAR_IDLE_DELAY_MS = 700;

const loadStoredSubtitleMode = (): SubtitleDisplayMode => {
  const stored = localStorage.getItem(SUBTITLE_MODE_STORAGE_KEY);
  return stored === "translation" || stored === "bilingual" ? stored : "source";
};

const reportBounds = (element: HTMLDivElement) => {
  const bounds = element.getBoundingClientRect();
  return invoke("set_embedded_video_bounds", {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  });
};

const sessionStatusText = (status: string | undefined) => {
  if (status === "loading") return "正在读取 YouTube 字幕…";
  if (status === "empty") return "这个视频暂时没有可用字幕";
  if (status === "error") return "YouTube 字幕读取失败";
  return "等待 YouTube 字幕…";
};

const browserPauseWarning = (
  state: ReturnType<typeof useViewerSession>["viewer"]["browserPauseState"]
) => {
  if (state === "timedOut") return "浏览器视频没有及时响应暂停，请确认外部声音。";
  if (typeof state === "object") return `浏览器视频未能自动暂停：${state.failed}`;
  return null;
};

export default function PlayerShell() {
  const slotRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<VListHandle>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const { viewer, connected, cursor } = useViewerSession({
    listenToBrowserConnection: false,
  });
  const session = viewer.activeSession;
  const [subtitleMode, setSubtitleMode] = useState<SubtitleDisplayMode>(
    loadStoredSubtitleMode
  );
  const [targetLanguage, setTargetLanguage] = useState<string | null>(() =>
    localStorage.getItem(TARGET_LANGUAGE_STORAGE_KEY)
  );
  const [knownRevision, setKnownRevision] = useState<{
    scope: string;
    revision: string;
  } | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [copyStatus, setCopyStatus] =
    useState<TranslationCopyStatus>("idle");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [changingLink, setChangingLink] = useState(false);
  const [replacementUrl, setReplacementUrl] = useState("");

  const queryScope = session?.videoId ?? viewer.source?.videoId ?? "none";
  const subtitleQuery = useSubtitleView(
    queryScope === "none" ? null : queryScope,
    knownRevision?.scope === queryScope ? knownRevision.revision : null,
    subtitleMode,
    targetLanguage
  );

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const observer = new ResizeObserver(() => void reportBounds(slot));
    observer.observe(slot);
    void reportBounds(slot);
    const retries = [250, 1_000].map((delay) =>
      window.setTimeout(() => void reportBounds(slot), delay)
    );
    return () => {
      observer.disconnect();
      retries.forEach(window.clearTimeout);
    };
  }, []);

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
    const language = subtitleQuery.data.translations[0].languageCode;
    setTargetLanguage(language);
    localStorage.setItem(TARGET_LANGUAGE_STORAGE_KEY, language);
  }, [subtitleQuery.data?.translations, targetLanguage]);

  useEffect(() => {
    if (session?.status === "ready") void subtitleQuery.refetch();
  }, [session?.sessionId, session?.status, session?.subtitles.length]);

  const requestedTranslationMissing = Boolean(
    subtitleMode !== "source" &&
      subtitleQuery.isSuccess &&
      subtitleQuery.data &&
      !subtitleQuery.data.translation
  );
  const effectiveMode: SubtitleDisplayMode = requestedTranslationMissing
    ? "source"
    : subtitleMode;
  const blocks = useMemo<DisplayBlock[]>(() => {
    if (effectiveMode !== "source" && subtitleQuery.data?.translation) {
      return groupTranslationBlocks(subtitleQuery.data.translation).map((block) => ({
        ...block,
        sourceText: effectiveMode === "bilingual" ? block.sourceText : null,
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
        startTime: subtitle.startTimeMs / 1_000,
        endTime: subtitle.endTimeMs / 1_000,
        sourceText: subtitle.text,
        translationText: null,
      })) ?? []
    );
  }, [
    effectiveMode,
    session?.status,
    session?.subtitles,
    subtitleQuery.data?.source.segments,
    subtitleQuery.data?.translation,
  ]);
  const presentation = useMemo(
    () =>
      resolveSubtitleCursorPresentation(
        blocks,
        cursor,
        effectiveMode === "source" &&
          session?.status === "ready" &&
          session.subtitles.length === blocks.length
      ),
    [blocks, cursor, effectiveMode, session?.status, session?.subtitles.length]
  );

  useEffect(() => {
    if (presentation.activeIndex < 0 || !listRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      listRef.current?.scrollToIndex(presentation.activeIndex, {
        align: "center",
        smooth: true,
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [presentation.activeIndex, session?.sessionId]);

  const runAction = useCallback(async (name: string, task: () => Promise<unknown>) => {
    setPendingAction(name);
    setActionError(null);
    try {
      await task();
      return true;
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
      return false;
    } finally {
      setPendingAction(null);
    }
  }, []);

  const controlPlayback = useCallback(
    (action: "play" | "pause" | "seek", seekTime?: number) =>
      runAction(action, () => invoke("control_playback", { action, seekTime })),
    [runAction]
  );

  const replacePlayback = useCallback(async () => {
    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeYoutubeWatchUrl(replacementUrl);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "YouTube 链接无效");
      return;
    }
    const replaced = await runAction("replace", () =>
      invoke("replace_embedded_playback", { url: normalizedUrl })
    );
    if (!replaced) return;
    setChangingLink(false);
    setReplacementUrl("");
    window.setTimeout(() => {
      if (slotRef.current) void reportBounds(slotRef.current);
    }, 250);
  }, [replacementUrl, runAction]);

  const copyTranslationPrompt = useCallback(async () => {
    const source = subtitleQuery.data?.source;
    if (!source) return setCopyStatus("error");
    setCopyStatus("copying");
    try {
      await writeText(
        buildLocalAiTranslationPrompt({
          videoId: source.videoId,
          title: source.title,
          sourceLanguageCode: source.languageCode,
          sourceLanguageDisplayName: source.displayName,
        })
      );
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }, [subtitleQuery.data?.source]);

  const pauseWarning = browserPauseWarning(viewer.browserPauseState);
  const isRecovering = viewer.sourceMode === "embeddedRecovering";
  const controlDisabled =
    pendingAction !== null || !connected || !session || !cursor || cursor.isAdPlaying;
  const emptyMessage = subtitleQuery.isError
    ? `本地字幕读取失败：${String(subtitleQuery.error)}`
    : blocks.length === 0
      ? sessionStatusText(session?.status)
      : null;

  const handleScroll = useCallback(() => {
    setIsScrolling(true);
    if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => setIsScrolling(false), SCROLLBAR_IDLE_DELAY_MS);
  }, []);

  return (
    <main className="grid h-screen grid-rows-[56px_auto_minmax(220px,1fr)] overflow-hidden bg-[#080b10] text-white">
      <header
        className="flex items-center gap-3 border-b border-white/10 px-5"
        data-tauri-drag-region
      >
        <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-sm font-semibold">
            {session?.title || "ListenUp · Desktop 播放"}
          </strong>
          <span className="block truncate text-[10px] text-white/45">
            {isRecovering ? "播放器连接中断" : session?.track?.displayName || "正在建立安全播放器…"}
          </span>
        </div>
        {pauseWarning && (
          <span className="max-w-[260px] truncate text-[10px] text-amber-300" title={pauseWarning}>
            {pauseWarning}
          </span>
        )}
        <DesktopIconButton
          ariaLabel="重新加载视频"
          tooltip="重新加载当前 YouTube 视频"
          isDisabled={pendingAction !== null}
          onPress={() => void runAction("reload", () => invoke("reload_embedded_playback"))}
          className="grid h-8 w-8 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
          icon={<Icon icon={pendingAction === "reload" ? "mdi:loading" : "mdi:reload"} className={pendingAction === "reload" ? "animate-spin" : ""} />}
        />
        <DesktopIconButton
          ariaLabel="更换视频链接"
          tooltip="粘贴另一个 YouTube 链接"
          onPress={() => setChangingLink((current) => !current)}
          className="grid h-8 w-8 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
          icon={<Icon icon="mdi:link-variant" />}
        />
        <DesktopIconButton
          ariaLabel="退出 Desktop 播放"
          tooltip="退出并等待下一次浏览器播放"
          isDisabled={pendingAction !== null}
          onPress={() => void runAction("exit", () => invoke("stop_embedded_playback"))}
          className="grid h-8 w-8 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
          icon={<Icon icon="mdi:close" />}
        />
      </header>

      <div ref={slotRef} className="aspect-video w-full bg-black" aria-label="YouTube 视频区域" />

      <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] border-t border-white/10 bg-[#11151c]">
        <div className="flex min-h-11 items-center gap-2 border-b border-white/10 px-4 py-2">
          <SubtitleModeControl
            value={subtitleMode}
            onChange={(mode) => {
              setSubtitleMode(mode);
              localStorage.setItem(SUBTITLE_MODE_STORAGE_KEY, mode);
            }}
          />
          {subtitleMode !== "source" && (
            <TargetLanguageSelect
              value={targetLanguage}
              options={subtitleQuery.data?.translations ?? []}
              onChange={(language) => {
                setTargetLanguage(language);
                localStorage.setItem(TARGET_LANGUAGE_STORAGE_KEY, language);
              }}
            />
          )}
          <span className="flex-1" />
          <span className="text-[10px] tabular-nums text-white/40">
            {Math.floor(cursor?.currentTime ?? 0)}s · {blocks.length} 条
          </span>
          <DesktopIconButton
            ariaLabel={cursor?.isPaused === false ? "暂停" : "播放"}
            tooltip={cursor?.isPaused === false ? "暂停 YouTube" : "播放 YouTube"}
            isDisabled={controlDisabled}
            onPress={() => void controlPlayback(cursor?.isPaused === false ? "pause" : "play")}
            className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white hover:bg-white/15"
            icon={<Icon icon={pendingAction === "play" || pendingAction === "pause" ? "mdi:loading" : cursor?.isPaused === false ? "mdi:pause" : "mdi:play"} className={pendingAction === "play" || pendingAction === "pause" ? "animate-spin" : ""} />}
          />
        </div>

        <div className="relative min-h-0 overflow-hidden">
          {(changingLink || isRecovering) && (
            <div className="absolute inset-x-4 top-4 z-10 rounded-xl border border-white/15 bg-[#20252d]/95 p-4 shadow-2xl backdrop-blur">
              <div className="flex items-start gap-3">
                <Icon icon={isRecovering ? "mdi:alert-circle-outline" : "mdi:link-variant"} className="mt-0.5 h-5 w-5 flex-none text-amber-300" />
                <div className="min-w-0 flex-1">
                  <strong className="text-[13px]">{isRecovering ? "视频连接已中断" : "更换 Desktop 视频"}</strong>
                  <p className="mb-3 mt-1 text-[11px] leading-relaxed text-white/55">
                    {isRecovering ? "可以重新加载当前视频、粘贴新链接，或退出后保持空态等待下一次浏览器播放。" : "只替换当前播放器里的视频，不会重新接管外部浏览器播放。"}
                  </p>
                  <div className="flex gap-2">
                    <DesktopTextField
                      aria-label="新的 YouTube 视频链接"
                      placeholder="https://youtu.be/..."
                      value={replacementUrl}
                      onChange={(event) => setReplacementUrl(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void replacePlayback();
                      }}
                      className="h-9 flex-1 rounded-lg border border-white/10 bg-black/35 px-3 text-[11px] text-white placeholder:text-white/30"
                    />
                    <DesktopButton
                      className="h-9 cursor-pointer rounded-lg bg-red-500 px-3 text-[11px] font-semibold text-white hover:bg-red-400 disabled:opacity-50"
                      isDisabled={pendingAction !== null}
                      onPress={() => void replacePlayback()}
                    >
                      换视频
                    </DesktopButton>
                  </div>
                  {isRecovering && (
                    <div className="mt-3 flex gap-2">
                      <DesktopButton
                        className="h-8 cursor-pointer rounded-lg border border-white/15 px-3 text-[11px] text-white/80 hover:bg-white/10"
                        isDisabled={pendingAction !== null}
                        onPress={() => void runAction("reload", () => invoke("reload_embedded_playback"))}
                      >
                        重新加载
                      </DesktopButton>
                      <DesktopButton
                        className="h-8 cursor-pointer rounded-lg px-3 text-[11px] text-white/50 hover:bg-white/10 hover:text-white"
                        isDisabled={pendingAction !== null}
                        onPress={() => void runAction("exit", () => invoke("stop_embedded_playback"))}
                      >
                        退出播放
                      </DesktopButton>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <SubtitleViewer
            listRef={listRef}
            blocks={blocks}
            activeIndex={presentation.activeIndex}
            playedThroughIndex={presentation.playedThroughIndex}
            connected={connected}
            copyStatus={copyStatus}
            emptyMessage={emptyMessage}
            isScrolling={isScrolling}
            onScroll={handleScroll}
            onScrollEnd={() => setIsScrolling(false)}
            onCopyTranslationPrompt={() => void copyTranslationPrompt()}
            onSeek={(seekTime) => void controlPlayback("seek", seekTime)}
            seekDisabled={controlDisabled}
            translationMissing={requestedTranslationMissing}
          />
        </div>
        <div className="min-h-7 border-t border-white/10 px-4 py-1.5 text-[10px] text-red-300">
          {actionError ?? (cursor?.isAdPlaying ? "广告播放中，暂不可控制" : "")}
        </div>
      </section>
    </main>
  );
}
