/**
 * @purpose 经页面桥接读取字幕轨，并用 streamingData 原始音轨标记视频原语。
 * @role    另一个字幕轨来源，用于 player-response 拿不到或缺参数时。
 * @deps    captions/PageBridge、captions/types、originalAudioLanguage、subtitleDebug
 * @gotcha  getAudioTrack 是当前配音而非原始音轨；只能使用桥接的 audioIsDefault 元数据判定原语
 */
import { pageBridge } from "./PageBridge";
import {
  CaptionListResponse,
  CaptionTrackDescriptor,
} from "./types";
import { subtitleDebug } from "../subtitle-domain/subtitleDebug";
import {
  getAudioTrackLanguageCode,
  matchesLanguageCode,
  type YouTubeAudioTrackMetadata,
} from "./originalAudioLanguage";

interface BridgeTrackPayload {
  playerVideoId?: string;
  currentTrack?: {
    d7?: {
      id?: string;
      isDefault?: boolean;
      name?: string;
    };
    B?: {
      vssId?: string;
    };
    captionTracks?: Array<{
      url?: string;
      languageCode?: string;
      vssId?: string;
      kind?: string;
      isTranslateable?: boolean;
      isDefault?: boolean;
      displayName?: string;
      languageName?: string;
      name?: string;
    }>;
  };
  ytcfg?: {
    INNERTUBE_CLIENT_VERSION?: string;
  };
  originalAudioTrack?: YouTubeAudioTrackMetadata;
  captionTracks?: Array<{
    baseUrl?: string;
    languageCode?: string;
    vssId?: string;
    kind?: string;
    isTranslatable?: boolean;
    name?: { simpleText?: string; runs?: Array<{ text?: string }> };
  }>;
  audioTracks?: Array<{
    defaultCaptionTrackIndex?: number;
  }>;
}

const getTrackName = (track: BridgeTrackPayload["captionTracks"][number]) => {
  if (!track?.name) {
    return "";
  }

  if (track.name.simpleText) {
    return track.name.simpleText;
  }

  return track.name.runs?.map((run) => run.text || "").join("").trim() || "";
};

const hasPotToken = (url: string) => {
  try {
    const parsed = new URL(url);
    return Boolean(parsed.searchParams.get("pot"));
  } catch {
    return false;
  }
};

export class BridgeCaptionSource {
  public async listTracks(): Promise<CaptionListResponse> {
    try {
      subtitleDebug.log("bridge caption source request start");
      const payload = (await pageBridge.listCaptionTracks()) as
        | BridgeTrackPayload
        | undefined;
      subtitleDebug.log("bridge caption source payload", payload);

      const bridgeTracks = payload?.currentTrack?.captionTracks || [];
      const tracks = payload?.captionTracks || [];
      const defaultIndex = payload?.audioTracks?.[0]?.defaultCaptionTrackIndex;
      const currentDefaultVssId =
        payload?.currentTrack?.B?.vssId || payload?.currentTrack?.d7?.id;
      const clientVersion = payload?.ytcfg?.INNERTUBE_CLIENT_VERSION;
      const sourceVideoId = payload?.playerVideoId;
      const originalAudioLanguageCode = getAudioTrackLanguageCode(
        payload?.originalAudioTrack
      );

      if (!sourceVideoId) {
        return {
          ok: false,
          code: "PLAYER_NOT_READY",
          message: "Page bridge player video identity is not ready",
        };
      }

      const normalizedFromCurrentTrack: CaptionTrackDescriptor[] = bridgeTracks
        .filter(
          (track): track is Required<
            Pick<
              NonNullable<BridgeTrackPayload["currentTrack"]>["captionTracks"][number],
              "url" | "languageCode" | "vssId"
            >
          > &
            NonNullable<BridgeTrackPayload["currentTrack"]>["captionTracks"][number] =>
            Boolean(track.url && track.languageCode && track.vssId)
        )
        .map((track) => ({
          source: "page-bridge",
          sourceVideoId,
          languageCode: track.languageCode!,
          displayName:
            track.displayName ||
            track.languageName ||
            track.name ||
            track.languageCode!,
          kind: track.kind === "asr" ? "asr" : "manual",
          vssId: track.vssId!,
          baseUrl: track.url!,
          requestUrl: track.url!,
          clientVersion,
          urlSource: "current-track-url",
          hasPot: hasPotToken(track.url!),
          isDefault: Boolean(track.isDefault || currentDefaultVssId === track.vssId),
          isOriginalAudioLanguage: Boolean(
            originalAudioLanguageCode &&
              matchesLanguageCode(
                track.languageCode!,
                originalAudioLanguageCode,
                true
              )
          ),
          isTranslatable: Boolean(track.isTranslateable),
        }));

      const normalizedFromRenderer: CaptionTrackDescriptor[] = tracks
        .filter(
          (track): track is Required<
            Pick<
              NonNullable<BridgeTrackPayload["captionTracks"]>[number],
              "baseUrl" | "languageCode" | "vssId"
            >
          > &
            NonNullable<BridgeTrackPayload["captionTracks"]>[number] =>
            Boolean(track.baseUrl && track.languageCode && track.vssId)
        )
        .map((track, index) => ({
          source: "page-bridge",
          sourceVideoId,
          languageCode: track.languageCode!,
          displayName: getTrackName(track) || track.languageCode!,
          kind: track.kind === "asr" ? "asr" : "manual",
          vssId: track.vssId!,
          baseUrl: track.baseUrl!,
          clientVersion,
          urlSource: "renderer-base-url",
          hasPot: hasPotToken(track.baseUrl!),
          isDefault: defaultIndex === index,
          isOriginalAudioLanguage: Boolean(
            originalAudioLanguageCode &&
              matchesLanguageCode(
                track.languageCode!,
                originalAudioLanguageCode,
                true
              )
          ),
          isTranslatable: Boolean(track.isTranslatable),
        }));

      const normalized =
        normalizedFromCurrentTrack.length > 0
          ? normalizedFromCurrentTrack
          : normalizedFromRenderer;

      if (normalized.length === 0) {
        subtitleDebug.warn("bridge caption source found no normalized tracks");
        return {
          ok: false,
          code: "NO_CAPTIONS",
          message: "No caption tracks found via page bridge",
        };
      }

      subtitleDebug.log("bridge caption source normalized tracks", {
        currentTrackCount: normalizedFromCurrentTrack.length,
        rendererTrackCount: normalizedFromRenderer.length,
        selectedTrackCount: normalized.length,
        tracks: normalized.map((track) => ({
          languageCode: track.languageCode,
          vssId: track.vssId,
          kind: track.kind,
          urlSource: track.urlSource,
          hasPot: track.hasPot,
          isOriginalAudioLanguage: track.isOriginalAudioLanguage,
        })),
      });

      return {
        ok: true,
        tracks: normalized,
      };
    } catch (error) {
      subtitleDebug.error("bridge caption source failed", error);
      return {
        ok: false,
        code: "BRIDGE_TIMEOUT",
        message:
          error instanceof Error ? error.message : "Bridge caption lookup failed",
      };
    }
  }
}

export const bridgeCaptionSource = new BridgeCaptionSource();
