/**
 * @purpose 从 YouTube player response 归一化字幕轨，并识别原始音轨语言。
 * @role    BrowserSource 与 EmbeddedSource 共用的播放器字幕发现纯函数。
 * @deps    audioLanguage、types
 * @gotcha  renderer、videoId 与 streamingData 必须来自同一 response；不能把当前配音当原始语言。
 */
import {
  getOriginalAudioLanguageCode,
  matchesLanguageCode,
} from "./audioLanguage.ts";
import type {
  CaptionTrackDescriptor,
  YouTubeStreamingData,
} from "./types.ts";

interface CaptionTrackRenderer {
  baseUrl?: string;
  name?: { simpleText?: string; runs?: Array<{ text?: string }> };
  languageCode?: string;
  kind?: string;
  vssId?: string;
  isTranslatable?: boolean;
}

interface PlayerCaptionsTracklistRenderer {
  captionTracks?: CaptionTrackRenderer[];
  audioTracks?: Array<{ defaultCaptionTrackIndex?: number }>;
}

export interface YouTubePlayerResponse {
  videoDetails?: { videoId?: string; title?: string };
  captions?: { playerCaptionsTracklistRenderer?: PlayerCaptionsTracklistRenderer };
  streamingData?: YouTubeStreamingData;
}

const getSimpleText = (name?: CaptionTrackRenderer["name"]): string =>
  name?.simpleText || name?.runs?.map((run) => run.text || "").join("").trim() || "";

export const normalizeCaptionTracksFromPlayerResponse = (
  response: YouTubePlayerResponse | null | undefined,
  source: CaptionTrackDescriptor["source"]
): CaptionTrackDescriptor[] => {
  const sourceVideoId = response?.videoDetails?.videoId;
  const renderer = response?.captions?.playerCaptionsTracklistRenderer;
  if (!sourceVideoId || !renderer) return [];

  const originalAudioLanguageCode = getOriginalAudioLanguageCode(
    response?.streamingData
  );
  const defaultIndex = renderer.audioTracks?.[0]?.defaultCaptionTrackIndex;
  return (renderer.captionTracks || [])
    .filter(
      (track): track is CaptionTrackRenderer &
        Required<Pick<CaptionTrackRenderer, "baseUrl" | "languageCode" | "vssId">> =>
        Boolean(track.baseUrl && track.languageCode && track.vssId)
    )
    .map((track, index) => ({
      source,
      sourceVideoId,
      languageCode: track.languageCode,
      displayName: getSimpleText(track.name) || track.languageCode,
      kind: track.kind === "asr" ? "asr" : "manual",
      vssId: track.vssId,
      baseUrl: track.baseUrl,
      urlSource: "renderer-base-url",
      hasPot: false,
      isDefault: defaultIndex === index,
      isOriginalAudioLanguage: Boolean(
        originalAudioLanguageCode &&
          matchesLanguageCode(track.languageCode, originalAudioLanguageCode, true)
      ),
      isTranslatable: Boolean(track.isTranslatable),
    }));
};
