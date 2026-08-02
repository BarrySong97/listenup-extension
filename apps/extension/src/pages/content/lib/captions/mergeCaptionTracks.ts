/**
 * @purpose 合并同一字幕轨的多来源描述，同时保留默认轨与原始音频语言身份。
 * @role    SubtitleRepository 在选轨前使用的纯去重策略。
 * @deps    captions/types
 * @gotcha  选择更可请求的 URL 来源时必须 OR 合并 isDefault/isOriginalAudioLanguage，不能覆盖身份信号。
 */
import type { CaptionTrackDescriptor } from "./types";

const isPreferredTrack = (
  candidate: CaptionTrackDescriptor,
  current: CaptionTrackDescriptor
) => {
  if (Boolean(candidate.hasPot) !== Boolean(current.hasPot)) {
    return Boolean(candidate.hasPot);
  }

  if (Boolean(candidate.requestUrl) !== Boolean(current.requestUrl)) {
    return Boolean(candidate.requestUrl);
  }

  if (candidate.source !== current.source) {
    return candidate.source === "page-bridge";
  }

  return false;
};

export const mergeCaptionTracks = (tracks: CaptionTrackDescriptor[]) => {
  const deduped = new Map<string, CaptionTrackDescriptor>();

  for (const track of tracks) {
    const key = `${track.languageCode}:${track.vssId}:${track.kind}`;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, track);
      continue;
    }

    const preferred = isPreferredTrack(track, existing) ? track : existing;
    deduped.set(key, {
      ...preferred,
      isDefault: track.isDefault || existing.isDefault,
      isOriginalAudioLanguage:
        track.isOriginalAudioLanguage || existing.isOriginalAudioLanguage,
    });
  }

  return [...deduped.values()];
};
