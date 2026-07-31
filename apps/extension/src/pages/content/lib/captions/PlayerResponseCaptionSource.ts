/**
 * @purpose 从 ytInitialPlayerResponse / player 响应里解析可用字幕轨。
 * @role    两个字幕轨来源之一，直接在内容脚本上下文读取。
 * @deps    captions/types、subtitleDebug
 * @gotcha  renderer 必须和同一 playerResponse 的 videoDetails.videoId 一起读取，身份缺失时不可返回轨道
 */
import {
  CaptionListResponse,
  CaptionTrackDescriptor,
} from "./types";
import { subtitleDebug } from "../subtitle-domain/subtitleDebug";

interface CaptionTrackRenderer {
  baseUrl?: string;
  name?: { simpleText?: string; runs?: Array<{ text?: string }> };
  languageCode?: string;
  kind?: string;
  vssId?: string;
  isTranslatable?: boolean;
}

interface CaptionAudioTrackRenderer {
  defaultCaptionTrackIndex?: number;
}

interface PlayerCaptionsTracklistRenderer {
  captionTracks?: CaptionTrackRenderer[];
  audioTracks?: CaptionAudioTrackRenderer[];
}

const getSimpleText = (
  name?: CaptionTrackRenderer["name"]
): string => {
  if (!name) {
    return "";
  }

  if (name.simpleText) {
    return name.simpleText;
  }

  return name.runs?.map((run) => run.text || "").join("").trim() || "";
};

const normalizeTracks = (
  renderer: PlayerCaptionsTracklistRenderer,
  source: CaptionTrackDescriptor["source"],
  sourceVideoId: string
): CaptionTrackDescriptor[] => {
  const tracks = renderer.captionTracks || [];
  const defaultIndex = renderer.audioTracks?.[0]?.defaultCaptionTrackIndex;

  return tracks
    .filter((track): track is Required<Pick<CaptionTrackRenderer, "baseUrl" | "languageCode" | "vssId">> &
      CaptionTrackRenderer => {
      return Boolean(track.baseUrl && track.languageCode && track.vssId);
    })
    .map((track, index) => ({
      source,
      sourceVideoId,
      languageCode: track.languageCode!,
      displayName: getSimpleText(track.name) || track.languageCode!,
      kind: track.kind === "asr" ? "asr" : "manual",
      vssId: track.vssId!,
      baseUrl: track.baseUrl!,
      urlSource: "renderer-base-url",
      hasPot: false,
      isDefault: defaultIndex === index,
      isTranslatable: Boolean(track.isTranslatable),
    }));
};

const getTracklistRenderer = (): {
  renderer: PlayerCaptionsTracklistRenderer | null;
  source: CaptionTrackDescriptor["source"] | null;
  sourceVideoId: string | null;
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
      renderer: playerResponseRenderer,
      source: "player-response",
      sourceVideoId: playerVideoId,
    };
  }

  const initialResponse = (window as any).ytInitialPlayerResponse;
  const initialRenderer = initialResponse?.captions
    ?.playerCaptionsTracklistRenderer;
  const initialVideoId = initialResponse?.videoDetails?.videoId;
  if (initialRenderer && initialVideoId) {
    return {
      renderer: initialRenderer,
      source: "initial-player-response",
      sourceVideoId: initialVideoId,
    };
  }

  return {
    renderer: null,
    source: null,
    sourceVideoId: null,
  };
};

export class PlayerResponseCaptionSource {
  public async listTracks(): Promise<CaptionListResponse> {
    const { renderer, source, sourceVideoId } = getTracklistRenderer();
    subtitleDebug.log("player response caption source lookup", {
      hasRenderer: Boolean(renderer),
      source,
      sourceVideoId,
    });

    if (!renderer || !source || !sourceVideoId) {
      return {
        ok: false,
        code: "PLAYER_NOT_READY",
        message: "YouTube player response is not ready",
      };
    }

    const tracks = normalizeTracks(renderer, source, sourceVideoId);
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
