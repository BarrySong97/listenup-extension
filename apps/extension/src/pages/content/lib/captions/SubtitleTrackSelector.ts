/**
 * @purpose 在合并去重后的轨道集合里按原始音频语言选择原语轨。
 * @role    SubtitleRepository 的选轨策略。
 * @deps    captions/types、originalAudioLanguage
 * @gotcha  原文语言只认原始音轨；元数据缺失才回退 default/首轨，同语言才比较 manual/ASR。
 */
import type { CaptionTrackDescriptor } from "./types";
import { matchesLanguageCode } from "./originalAudioLanguage.ts";

const sortTracks = (
  tracks: CaptionTrackDescriptor[],
  preferManual: boolean
) => {
  return [...tracks].sort((left, right) => {
    if (Boolean(left.hasPot) !== Boolean(right.hasPot)) {
      return left.hasPot ? -1 : 1;
    }

    if (Boolean(left.requestUrl) !== Boolean(right.requestUrl)) {
      return left.requestUrl ? -1 : 1;
    }

    if (preferManual && left.kind !== right.kind) {
      return left.kind === "manual" ? -1 : 1;
    }

    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1;
    }

    return left.displayName.localeCompare(right.displayName);
  });
};

export const selectCaptionTrack = (
  tracks: CaptionTrackDescriptor[]
): CaptionTrackDescriptor | null => {
  if (tracks.length === 0) {
    return null;
  }

  const sourceLanguageTrack =
    tracks.find((track) => track.isOriginalAudioLanguage) ??
    tracks.find((track) => track.isDefault) ??
    tracks[0];
  const sourceLanguageCandidates = tracks.filter((track) =>
    matchesLanguageCode(track.languageCode, sourceLanguageTrack.languageCode, true)
  );

  return sortTracks(sourceLanguageCandidates, true)[0];
};
