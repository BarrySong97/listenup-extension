/**
 * @purpose 从 YouTube streamingData 提取原始音轨 BCP 47 语言并比较字幕语言。
 * @role    两种播放器适配器与字幕选轨器共用的纯函数。
 * @deps    types
 * @gotcha  当前播放音轨与 audioTracks[0] 都可能是配音，原语只认 audioIsDefault=true。
 */
import type {
  YouTubeAudioTrackMetadata,
  YouTubeStreamingData,
} from "./types.ts";

const BCP_47_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

const normalizeLanguageCode = (value?: string) => {
  const languageCode = value?.trim();
  return languageCode && BCP_47_PATTERN.test(languageCode)
    ? languageCode
    : null;
};

export const getAudioTrackLanguageCode = (
  audioTrack?: YouTubeAudioTrackMetadata | null
) => {
  const explicitLanguageCode = normalizeLanguageCode(audioTrack?.languageCode);
  if (explicitLanguageCode) return explicitLanguageCode;
  return normalizeLanguageCode(audioTrack?.id?.split(".", 1)[0]);
};

export const getOriginalAudioLanguageCode = (
  streamingData?: YouTubeStreamingData | null
) => {
  const formats = [
    ...(streamingData?.adaptiveFormats || []),
    ...(streamingData?.formats || []),
  ];
  const originalAudioTrack = formats
    .map((format) => format.audioTrack)
    .find((audioTrack) => audioTrack?.audioIsDefault === true);
  return getAudioTrackLanguageCode(originalAudioTrack);
};

export const matchesLanguageCode = (
  languageCode: string,
  preferredLanguage: string,
  allowRegionFallback: boolean
) => {
  const normalizedLanguageCode = languageCode.toLowerCase();
  const normalizedPreferredLanguage = preferredLanguage.toLowerCase();
  if (normalizedLanguageCode === normalizedPreferredLanguage) return true;
  if (!allowRegionFallback) return false;
  return (
    normalizedLanguageCode.startsWith(`${normalizedPreferredLanguage}-`) ||
    normalizedPreferredLanguage.startsWith(`${normalizedLanguageCode}-`)
  );
};
