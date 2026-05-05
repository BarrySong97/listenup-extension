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
  source: CaptionTrackDescriptor["source"]
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
} => {
  const player = document.querySelector("#movie_player") as
    | (HTMLElement & { getPlayerResponse?: () => any })
    | null;

  const playerResponseRenderer =
    player?.getPlayerResponse?.()?.captions?.playerCaptionsTracklistRenderer;
  if (playerResponseRenderer) {
    return {
      renderer: playerResponseRenderer,
      source: "player-response",
    };
  }

  const initialRenderer = (window as any).ytInitialPlayerResponse?.captions
    ?.playerCaptionsTracklistRenderer;
  if (initialRenderer) {
    return {
      renderer: initialRenderer,
      source: "initial-player-response",
    };
  }

  return {
    renderer: null,
    source: null,
  };
};

export class PlayerResponseCaptionSource {
  public async listTracks(): Promise<CaptionListResponse> {
    const { renderer, source } = getTracklistRenderer();
    subtitleDebug.log("player response caption source lookup", {
      hasRenderer: Boolean(renderer),
      source,
    });

    if (!renderer || !source) {
      return {
        ok: false,
        code: "PLAYER_NOT_READY",
        message: "YouTube player response is not ready",
      };
    }

    const tracks = normalizeTracks(renderer, source);
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
