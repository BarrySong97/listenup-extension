import {
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

  return track.languageCode.startsWith(`${preferredLanguage}-`);
};

export const DEFAULT_TRACK_PREFERENCE: TrackPreference = {
  preferredLanguages: ["en"],
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

  const manualFallback = tracks.find((track) => track.kind === "manual");
  if (manualFallback) {
    return manualFallback;
  }

  const asrFallback = tracks.find((track) => track.kind === "asr");
  return asrFallback || tracks[0];
};
