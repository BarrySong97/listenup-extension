/**
 * @purpose 渲染官方 YouTube iframe、独立加载字幕，并组合可信的同级悬浮字幕层。
 * @role    App.tsx 的单一视频行；作为 iframe 与 EmbeddedSubtitleOverlay 的定位边界。
 * @deps    @tauri-apps/api、@listenup/youtube-core、react-i18next、i18n、EmbeddedSubtitleOverlay、useYoutubeIframePlayer、types
 * @gotcha  Overlay 只能是可信 main 的 iframe sibling，不得向 loopback 播放页传字幕正文。
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  buildSubtitleUrl,
  normalizeCaptionTracksFromPlayerResponse,
  parseJSONSubtitles,
  selectCaptionTrack,
  validateCaptionVideoIdentity,
  type YouTubePlayerResponse,
} from "@listenup/youtube-core";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmbeddedSubtitleOverlay } from "./EmbeddedSubtitleOverlay";
import { i18n } from "./i18n";
import type { EmbeddedSubtitleOverlayPosition } from "./embeddedSubtitleOverlayPosition";
import type { DisplayBlock } from "./SubtitleList";
import type { TranslationCopyStatus } from "./TranslationMissingState";
import type { SubtitleItem, ViewerSnapshot } from "./types";
import { useYoutubeIframePlayer } from "./useYoutubeIframePlayer";

type EmbeddedSource = NonNullable<ViewerSnapshot["source"]>;

const emitSession = (
  source: EmbeddedSource,
  response: YouTubePlayerResponse | null,
  status: "ready" | "empty" | "error",
  error: string | null,
  track: ReturnType<typeof selectCaptionTrack>,
  subtitles: ReturnType<typeof parseJSONSubtitles>
) =>
  invoke("embedded_source_event", {
    payload: JSON.stringify({
      kind: "session",
      version: 1,
      sourceId: source.sourceId,
      sessionId: source.sessionId,
      videoId: source.videoId,
      title: response?.videoDetails?.title || i18n.t("common.youtubeVideo"),
      identityStatus: "verified",
      status,
      error,
      track: track
        ? {
            languageCode: track.languageCode,
            displayName: track.displayName,
            kind: track.kind,
            vssId: track.vssId,
            isDefault: track.isDefault,
          }
        : null,
      subtitles,
    }),
  });

const subtitleTransportError = (cause: unknown) => {
  const category = String(cause);
  if (category.includes("player-response-missing")) return i18n.t("embeddedErrors.playerResponseMissing");
  if (category.includes("player-config")) return i18n.t("embeddedErrors.playerConfig");
  if (category.includes("player-build")) return i18n.t("embeddedErrors.playerBuild");
  if (category.includes("player-timeout")) return i18n.t("embeddedErrors.playerTimeout");
  if (category.includes("player-connect")) return i18n.t("embeddedErrors.playerConnect");
  if (category.includes("player-request") || category.includes("player-http")) {
    return i18n.t("embeddedErrors.playerHttp");
  }
  if (category.includes("player-response-invalid")) return i18n.t("embeddedErrors.playerInvalid");
  if (category.includes("proxy-invalid")) return i18n.t("embeddedErrors.proxyInvalid");
  if (category.includes("caption-url-invalid")) return i18n.t("embeddedErrors.captionUrlInvalid");
  if (category.includes("caption-empty")) return i18n.t("embeddedErrors.captionEmpty");
  if (category.includes("caption-http")) return i18n.t("embeddedErrors.captionHttp");
  if (category.includes("caption-build")) return i18n.t("embeddedErrors.captionBuild");
  if (category.includes("caption-timeout")) return i18n.t("embeddedErrors.captionTimeout");
  if (category.includes("caption-connect")) return i18n.t("embeddedErrors.captionConnect");
  if (category.includes("caption-request")) return i18n.t("embeddedErrors.captionRequest");
  if (category.includes("caption-read")) return i18n.t("embeddedErrors.captionRead");
  if (
    category.includes("watch-http") ||
    category.includes("watch-request") ||
    category.includes("watch-read")
  ) {
    return i18n.t("embeddedErrors.watchHttp");
  }
  if (category.includes("watch-build")) return i18n.t("embeddedErrors.watchBuild");
  if (category.includes("watch-timeout")) return i18n.t("embeddedErrors.watchTimeout");
  if (category.includes("watch-connect-shell-proxy")) {
    return i18n.t("embeddedErrors.watchLoginProxy");
  }
  if (category.includes("watch-connect-env-proxy")) {
    return i18n.t("embeddedErrors.watchProcessProxy");
  }
  if (category.includes("watch-connect")) return i18n.t("embeddedErrors.watchConnect");
  if (category.includes("cookie-store")) return i18n.t("embeddedErrors.cookieStore");
  return i18n.t("embeddedErrors.generic");
};

export const EmbeddedVideoPanel = ({
  copyStatus,
  fillAvailableSpace = false,
  onCopyTranslationPrompt,
  onOverlayPositionChange,
  overlayBlock,
  overlayEnabled = false,
  overlayPosition,
  source,
  subtitles,
  translationMissing = false,
}: {
  copyStatus: TranslationCopyStatus;
  fillAvailableSpace?: boolean;
  onCopyTranslationPrompt: () => void;
  onOverlayPositionChange: (position: EmbeddedSubtitleOverlayPosition) => void;
  overlayBlock: DisplayBlock | null;
  overlayEnabled?: boolean;
  overlayPosition: EmbeddedSubtitleOverlayPosition;
  source: EmbeddedSource;
  subtitles: SubtitleItem[];
  translationMissing?: boolean;
}) => {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const iframePlayer = useYoutubeIframePlayer({
    hostRef,
    source,
    subtitles,
    reloadToken,
  });

  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const response = await invoke<YouTubePlayerResponse>(
          "fetch_youtube_player_response",
          { videoId: source.videoId }
        );
        if (disposed) return;
        const track = selectCaptionTrack(
          normalizeCaptionTracksFromPlayerResponse(response, "player-response")
        );
        if (!track) {
          await emitSession(source, response, "empty", null, null, []);
          return;
        }
        if (
          !validateCaptionVideoIdentity({
            expectedVideoId: source.videoId,
            sessionVideoId: response.videoDetails?.videoId || null,
            track,
          }).ok
        ) {
          await emitSession(source, response, "error", t("embedded.identityMismatch"), null, []);
          return;
        }
        const document = await invoke<string>("fetch_youtube_caption_document", {
          videoId: source.videoId,
          url: buildSubtitleUrl(track),
        });
        if (disposed) return;
        const parsed = parseJSONSubtitles(document);
        await emitSession(
          source,
          response,
          parsed.length ? "ready" : "empty",
          null,
          track,
          parsed
        );
      } catch (cause) {
        if (!disposed) {
          await emitSession(source, null, "error", subtitleTransportError(cause), null, []);
        }
      }
    })();
    return () => {
      disposed = true;
    };
  }, [reloadToken, source.sessionId, source.videoId, t]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    void listen<EmbeddedSource>("embedded-player-reload", (event) => {
      if (
        event.payload.sourceId === source.sourceId &&
        event.payload.sessionId === source.sessionId
      ) {
        setReloadToken((current) => current + 1);
      }
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => unlisten?.();
  }, [source.sessionId, source.sourceId]);

  useEffect(() => {
    if (!iframePlayer.error) return;
    void invoke("report_embedded_player_failure");
  }, [iframePlayer.error]);

  return (
    <section
      className={`relative w-full overflow-hidden border-b border-hairline bg-black ${
        fillAvailableSpace ? "h-full min-h-0" : "aspect-video"
      }`}
    >
      <div ref={hostRef} className="h-full w-full" aria-label={t("embedded.videoRegion")} />
      {overlayEnabled && (
        <EmbeddedSubtitleOverlay
          block={overlayBlock}
          copyStatus={copyStatus}
          onCopyTranslationPrompt={onCopyTranslationPrompt}
          onPositionChange={onOverlayPositionChange}
          position={overlayPosition}
          translationMissing={translationMissing}
        />
      )}
      {!iframePlayer.ready && !iframePlayer.error && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-black text-[11px] text-fg-muted">
          {t("embedded.loadingPlayer")}
        </div>
      )}
      {iframePlayer.error && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-black/80 px-3 py-2 text-center text-[10px] text-red-200 backdrop-blur">
          {iframePlayer.error}
        </div>
      )}
      {iframePlayer.autoplayBlocked && !iframePlayer.error && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-black/65 px-3 py-1.5 text-center text-[10px] text-white/65">
          {t("embedded.clickToPlay")}
        </div>
      )}
    </section>
  );
};
