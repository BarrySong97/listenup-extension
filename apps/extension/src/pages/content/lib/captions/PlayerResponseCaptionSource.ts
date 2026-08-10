/**
 * @purpose 从 ytInitialPlayerResponse / player 响应里解析字幕轨与原始音轨语言。
 * @role    两个字幕轨来源之一，直接在内容脚本上下文读取。
 * @deps    @listenup/youtube-core、captions/types、subtitleDebug
 * @gotcha  renderer、videoId 与 streamingData 必须来自同一 response；不能把当前配音当原始语言
 */
import {
  CaptionListResponse,
  CaptionTrackDescriptor,
} from "./types";
import { subtitleDebug } from "../subtitle-domain/subtitleDebug";
import {
  getOriginalAudioLanguageCode,
  normalizeCaptionTracksFromPlayerResponse,
  type YouTubePlayerResponse,
} from "@listenup/youtube-core";

const getTracklistRenderer = (): {
  response: YouTubePlayerResponse | null;
  source: CaptionTrackDescriptor["source"] | null;
  sourceVideoId: string | null;
  originalAudioLanguageCode: string | null;
} => {
  const player = document.querySelector("#movie_player") as
    | (HTMLElement & { getPlayerResponse?: () => any })
    | null;

  const playerResponse = player?.getPlayerResponse?.();
  const playerResponseRenderer =
    playerResponse?.captions?.playerCaptionsTracklistRenderer;
  const playerVideoId = playerResponse?.videoDetails?.videoId;
  if (playerResponseRenderer && playerVideoId) {
    return {
      response: playerResponse,
      source: "player-response",
      sourceVideoId: playerVideoId,
      originalAudioLanguageCode: getOriginalAudioLanguageCode(
        playerResponse?.streamingData
      ),
    };
  }

  const initialResponse = (window as any).ytInitialPlayerResponse;
  const initialRenderer = initialResponse?.captions
    ?.playerCaptionsTracklistRenderer;
  const initialVideoId = initialResponse?.videoDetails?.videoId;
  if (initialRenderer && initialVideoId) {
    return {
      response: initialResponse,
      source: "initial-player-response",
      sourceVideoId: initialVideoId,
      originalAudioLanguageCode: getOriginalAudioLanguageCode(
        initialResponse?.streamingData
      ),
    };
  }

  return {
    response: null,
    source: null,
    sourceVideoId: null,
    originalAudioLanguageCode: null,
  };
};

export class PlayerResponseCaptionSource {
  public async listTracks(): Promise<CaptionListResponse> {
    const {
      response,
      source,
      sourceVideoId,
      originalAudioLanguageCode,
    } = getTracklistRenderer();
    subtitleDebug.log("player response caption source lookup", {
      hasRenderer: Boolean(response?.captions?.playerCaptionsTracklistRenderer),
      source,
      sourceVideoId,
      originalAudioLanguageCode,
    });

    if (!response || !source || !sourceVideoId) {
      return {
        ok: false,
        code: "PLAYER_NOT_READY",
        message: "YouTube player response is not ready",
      };
    }

    const tracks = normalizeCaptionTracksFromPlayerResponse(response, source);
    subtitleDebug.log("player response caption source normalized tracks", {
      source,
      trackCount: tracks.length,
    });
    if (tracks.length === 0) {
      return {
        ok: false,
        code: "NO_CAPTIONS",
        message: "No caption tracks found in player response",
      };
    }

    return {
      ok: true,
      tracks,
    };
  }
}

export const playerResponseCaptionSource = new PlayerResponseCaptionSource();
