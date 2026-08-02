/**
 * @purpose 从 YouTube streamingData 的原始音轨元数据提取 BCP 47 语言，并比较字幕语言。
 * @role    PlayerResponseCaptionSource、BridgeCaptionSource 与选轨器共享的原语判定工具。
 * @deps    无运行时依赖
 * @gotcha  只能信任 audioIsDefault=true 的音轨；当前播放音轨与 audioTracks[0] 都可能是用户配音偏好。
 */

export interface YouTubeAudioTrackMetadata {
  id?: string;
  languageCode?: string;
  audioIsDefault?: boolean;
}

interface YouTubeStreamingFormat {
  audioTrack?: YouTubeAudioTrackMetadata;
}

interface YouTubeStreamingData {
  adaptiveFormats?: YouTubeStreamingFormat[];
  formats?: YouTubeStreamingFormat[];
}

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
  if (explicitLanguageCode) {
    return explicitLanguageCode;
  }

  const idLanguageCode = audioTrack?.id?.split(".", 1)[0];
  return normalizeLanguageCode(idLanguageCode);
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

  if (normalizedLanguageCode === normalizedPreferredLanguage) {
    return true;
  }

  if (!allowRegionFallback) {
    return false;
  }

  return (
    normalizedLanguageCode.startsWith(`${normalizedPreferredLanguage}-`) ||
    normalizedPreferredLanguage.startsWith(`${normalizedLanguageCode}-`)
  );
};
