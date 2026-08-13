/**
 * @purpose 渲染官方 YouTube iframe、独立加载字幕，并组合可信的同级悬浮字幕层。
 * @role    App.tsx 的单一视频行；作为 iframe 与 EmbeddedSubtitleOverlay 的定位边界。
 * @deps    @tauri-apps/api、@listenup/youtube-core、EmbeddedSubtitleOverlay、useYoutubeIframePlayer、types
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
import { EmbeddedSubtitleOverlay } from "./EmbeddedSubtitleOverlay";
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
      title: response?.videoDetails?.title || "YouTube 视频",
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
  if (category.includes("player-response-missing")) return "YouTube 没有返回可用的字幕信息";
  if (category.includes("player-config")) return "YouTube 播放参数读取失败，请重新加载";
  if (category.includes("player-build")) return "已保存 Cookie 无法用于字幕请求";
  if (category.includes("player-timeout")) return "YouTube 字幕轨请求超时";
  if (category.includes("player-connect")) return "YouTube 字幕轨连接失败";
  if (category.includes("player-request") || category.includes("player-http")) {
    return "YouTube 字幕轨请求暂时不可用";
  }
  if (category.includes("player-response-invalid")) return "YouTube 字幕轨响应格式异常";
  if (category.includes("proxy-invalid")) return "网络代理配置无效";
  if (category.includes("caption-url-invalid")) return "YouTube 字幕地址校验失败";
  if (category.includes("caption-empty")) return "YouTube 返回了空字幕文档，请重新加载";
  if (category.includes("caption-http")) return "YouTube 字幕请求暂时不可用";
  if (category.includes("caption-build")) return "已保存 Cookie 无法用于字幕下载";
  if (category.includes("caption-timeout")) return "YouTube 字幕下载超时";
  if (category.includes("caption-connect")) return "YouTube 字幕连接失败";
  if (category.includes("caption-request")) return "YouTube 字幕请求失败";
  if (category.includes("caption-read")) return "YouTube 字幕读取中断";
  if (
    category.includes("watch-http") ||
    category.includes("watch-request") ||
    category.includes("watch-read")
  ) {
    return "YouTube 视频信息请求暂时不可用";
  }
  if (category.includes("watch-build")) return "已保存 Cookie 无法用于视频信息请求";
  if (category.includes("watch-timeout")) return "YouTube 视频信息请求超时";
  if (category.includes("watch-connect-shell-proxy")) {
    return "YouTube 视频信息连接失败（登录代理）";
  }
  if (category.includes("watch-connect-env-proxy")) {
    return "YouTube 视频信息连接失败（进程代理）";
  }
  if (category.includes("watch-connect")) return "YouTube 视频信息连接失败（直连）";
  if (category.includes("cookie-store")) return "已保存 Cookie 暂时无法读取";
  return "YouTube 字幕读取失败";
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
          await emitSession(source, response, "error", "字幕轨与当前视频身份不一致", null, []);
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
  }, [reloadToken, source.sessionId, source.videoId]);

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
      <div ref={hostRef} className="h-full w-full" aria-label="YouTube 视频区域" />
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
          正在加载 YouTube 播放器…
        </div>
      )}
      {iframePlayer.error && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-black/80 px-3 py-2 text-center text-[10px] text-red-200 backdrop-blur">
          {iframePlayer.error}
        </div>
      )}
      {iframePlayer.autoplayBlocked && !iframePlayer.error && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-black/65 px-3 py-1.5 text-center text-[10px] text-white/65">
          点击播放器即可开始播放
        </div>
      )}
    </section>
  );
};
