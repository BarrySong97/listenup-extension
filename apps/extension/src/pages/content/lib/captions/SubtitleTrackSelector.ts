/**
 * @purpose 在合并去重后的轨道集合里选择视频原语轨，并支持显式语言偏好覆盖。
 * @role    SubtitleRepository 的选轨策略。
 * @deps    captions/types
 * @gotcha  默认语言来自 YouTube default/首轨，不能重新写死英语；同语言才比较 manual/ASR。
 */
import type {
  CaptionTrackDescriptor,
  TrackPreference,
} from "./types";

const matchesLanguage = (
  track: CaptionTrackDescriptor,
  preferredLanguage: string,
  allowRegionFallback: boolean
) => {
  if (track.languageCode === preferredLanguage) {
    return true;
  }

  if (!allowRegionFallback) {
    return false;
  }

  return (
    track.languageCode.startsWith(`${preferredLanguage}-`) ||
    preferredLanguage.startsWith(`${track.languageCode}-`)
  );
};

export const DEFAULT_TRACK_PREFERENCE: TrackPreference = {
  preferredLanguages: [],
  preferManual: true,
  allowRegionFallback: true,
};

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
  tracks: CaptionTrackDescriptor[],
  preference: Partial<TrackPreference> = {}
): CaptionTrackDescriptor | null => {
  if (tracks.length === 0) {
    return null;
  }

  const resolvedPreference = {
    ...DEFAULT_TRACK_PREFERENCE,
    ...preference,
  };

  for (const language of resolvedPreference.preferredLanguages) {
    const candidates = tracks.filter((track) =>
      matchesLanguage(track, language, resolvedPreference.allowRegionFallback)
    );

    if (candidates.length > 0) {
      return sortTracks(candidates, resolvedPreference.preferManual)[0];
    }
  }

  const sourceLanguageTrack = tracks.find((track) => track.isDefault) ?? tracks[0];
  const sourceLanguageCandidates = tracks.filter((track) =>
    matchesLanguage(track, sourceLanguageTrack.languageCode, true)
  );

  return sortTracks(
    sourceLanguageCandidates,
    resolvedPreference.preferManual
  )[0];
};
