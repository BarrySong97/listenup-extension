/**
 * @purpose 在可信 main 中挂载无权限 loopback 播放页，并把官方 YouTube IFrame API postMessage 映射为 EmbeddedSource 事件。
 * @role    iframe 播放适配器；负责 ready/error/cursor、play/pause/seek 与固定命令确认。
 * @deps    @tauri-apps/api、@listenup/youtube-core、i18n、Rust embedded_player_host、types
 * @gotcha  只接受当前 iframe window + 精确 loopback origin；播放页无 Tauri capability，main 不读取 YouTube iframe DOM。
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { PlaybackEpochTracker } from "@listenup/youtube-core";
import { useEffect, useRef, useState, type RefObject } from "react";
import { i18n } from "./i18n";
import type { SubtitleItem, ViewerSnapshot } from "./types";

type EmbeddedSource = NonNullable<ViewerSnapshot["source"]>;

interface EmbeddedPlaybackCommand {
  commandId: string;
  sourceId: string;
  sessionId: string;
  videoId: string;
  action: "play" | "pause" | "seek";
  seekTime?: number;
}

interface PlayerMessage {
  channel?: string;
  type?: "ready" | "cursor" | "error" | "autoplayBlocked" | "loadError" | "controlResult";
  currentTime?: number;
  isPlaying?: boolean;
  code?: number;
  commandId?: string;
  ok?: boolean;
  error?: string | null;
}

const CHANNEL = "listenup-youtube-player-v1";

const currentSubtitleIndex = (subtitles: SubtitleItem[], time: number) => {
  let low = 0;
  let high = subtitles.length - 1;
  let match = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (subtitles[middle].startTime <= time) {
      match = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return match >= 0 && time <= subtitles[match].endTime + 0.25 ? match : -1;
};

const emitEmbedded = (payload: Record<string, unknown>) =>
  invoke("embedded_source_event", { payload: JSON.stringify(payload) });

const iframeErrorLabel = (code: number | undefined) => {
  if (code === 2) return i18n.t("embedded.invalidVideoId");
  if (code === 100) return i18n.t("embedded.videoMissing");
  if (code === 101 || code === 150) return i18n.t("embedded.embedForbidden");
  if (code === 153) return i18n.t("embedded.originRejected");
  return i18n.t("embedded.unavailable");
};

export const useYoutubeIframePlayer = ({
  hostRef,
  source,
  subtitles,
  reloadToken,
}: {
  hostRef: RefObject<HTMLDivElement | null>;
  source: EmbeddedSource;
  subtitles: SubtitleItem[];
  reloadToken: number;
}) => {
  const subtitlesRef = useRef(subtitles);
  const sourceRef = useRef(source);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  subtitlesRef.current = subtitles;
  sourceRef.current = source;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cursorInFlight = false;
    let unlistenCommand: (() => void) | null = null;
    let iframe: HTMLIFrameElement | null = null;
    let playerOrigin: string | null = null;
    const playbackEpoch = new PlaybackEpochTracker();

    setReady(false);
    setError(null);
    setAutoplayBlocked(false);
    host.replaceChildren();

    const messageListener = (event: MessageEvent<PlayerMessage>) => {
      if (
        !iframe ||
        event.source !== iframe.contentWindow ||
        event.origin !== playerOrigin ||
        !event.data ||
        event.data.channel !== CHANNEL
      ) {
        return;
      }
      const active = sourceRef.current;
      if (event.data.type === "ready") {
        setReady(true);
        return;
      }
      if (event.data.type === "autoplayBlocked") {
        setAutoplayBlocked(true);
        return;
      }
      if (event.data.type === "loadError") {
        setError(i18n.t("embedded.playerApiFailed"));
        return;
      }
      if (event.data.type === "error") {
        setError(iframeErrorLabel(event.data.code));
        return;
      }
      if (event.data.type === "controlResult" && event.data.commandId) {
        void emitEmbedded({
          kind: "controlResult",
          version: 1,
          sourceId: active.sourceId,
          sessionId: active.sessionId,
          videoId: active.videoId,
          commandId: event.data.commandId,
          ok: event.data.ok === true,
          error: event.data.error || null,
        });
        return;
      }
      if (
        event.data.type === "cursor" &&
        Number.isFinite(event.data.currentTime) &&
        typeof event.data.isPlaying === "boolean" &&
        !cursorInFlight
      ) {
        const time = Math.max(0, event.data.currentTime || 0);
        cursorInFlight = true;
        void emitEmbedded({
          kind: "cursor",
          version: 1,
          sourceId: active.sourceId,
          sessionId: active.sessionId,
          videoId: active.videoId,
          playbackEpoch: playbackEpoch.update(event.data.isPlaying),
          currentTime: time,
          currentIndex: currentSubtitleIndex(subtitlesRef.current, time),
          isPaused: !event.data.isPlaying,
          isAdPlaying: false,
          sentAt: Date.now(),
        }).finally(() => {
          cursorInFlight = false;
        });
      }
    };
    window.addEventListener("message", messageListener);

    void (async () => {
      const hostUrl = await invoke<string>("get_embedded_player_host_url");
      if (disposed) return;
      const url = new URL(hostUrl);
      if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") {
        throw new Error(i18n.t("embedded.invalidLocalOrigin"));
      }
      url.searchParams.set("videoId", source.videoId);
      playerOrigin = url.origin;
      iframe = document.createElement("iframe");
      iframe.src = url.toString();
      iframe.className = "h-full w-full border-0";
      iframe.allow = "autoplay; encrypted-media; picture-in-picture";
      iframe.allowFullscreen = true;
      iframe.title = i18n.t("embedded.playerTitle");
      host.append(iframe);
      unlistenCommand = await listen<EmbeddedPlaybackCommand>(
        "embedded-playback-command",
        (event) => {
          const command = event.payload;
          const active = sourceRef.current;
          if (
            !iframe?.contentWindow ||
            command.sourceId !== active.sourceId ||
            command.sessionId !== active.sessionId ||
            command.videoId !== active.videoId
          ) {
            return;
          }
          iframe.contentWindow.postMessage(
            {
              channel: CHANNEL,
              type: "control",
              commandId: command.commandId,
              action: command.action,
              seekTime: command.seekTime,
            },
            playerOrigin!
          );
        }
      );
    })().catch((cause) => {
      if (!disposed) {
        setError(cause instanceof Error ? cause.message : i18n.t("embedded.localInitFailed"));
      }
    });

    return () => {
      disposed = true;
      unlistenCommand?.();
      window.removeEventListener("message", messageListener);
      host.replaceChildren();
    };
  }, [hostRef, reloadToken, source.sessionId, source.videoId]);

  return { ready, error, autoplayBlocked };
};
