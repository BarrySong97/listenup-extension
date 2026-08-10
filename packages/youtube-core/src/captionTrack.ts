/**
 * @purpose 选择原语字幕轨并构建带 POT 上下文的 JSON3 下载 URL。
 * @role    BrowserSource 与 EmbeddedSource 共用的选轨和请求纯逻辑。
 * @deps    audioLanguage、types、URL
 * @gotcha  manual 优先只在原语候选内；requestUrl 必须补 xorb/xobt/xovt 等播放器参数。
 */
import { matchesLanguageCode } from "./audioLanguage.ts";
import type { CaptionTrackDescriptor } from "./types.ts";

const sortTracks = (tracks: CaptionTrackDescriptor[], preferManual: boolean) =>
  [...tracks].sort((left, right) => {
    if (Boolean(left.hasPot) !== Boolean(right.hasPot)) return left.hasPot ? -1 : 1;
    if (Boolean(left.requestUrl) !== Boolean(right.requestUrl)) {
      return left.requestUrl ? -1 : 1;
    }
    if (preferManual && left.kind !== right.kind) {
      return left.kind === "manual" ? -1 : 1;
    }
    if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
    return left.displayName.localeCompare(right.displayName);
  });

export const selectCaptionTrack = (
  tracks: CaptionTrackDescriptor[]
): CaptionTrackDescriptor | null => {
  if (tracks.length === 0) return null;
  const sourceLanguageTrack =
    tracks.find((track) => track.isOriginalAudioLanguage) ??
    tracks.find((track) => track.isDefault) ??
    tracks[0];
  const sourceLanguageCandidates = tracks.filter((track) =>
    matchesLanguageCode(track.languageCode, sourceLanguageTrack.languageCode, true)
  );
  return sortTracks(sourceLanguageCandidates, true)[0];
};

export interface SubtitleUrlOptions {
  format?: "json3";
  translationLanguage?: string;
}

export const buildSubtitleUrl = (
  track: CaptionTrackDescriptor,
  options: SubtitleUrlOptions = {}
): string => {
  const url = new URL(track.requestUrl || track.baseUrl);
  url.searchParams.set("fmt", options.format || "json3");
  if (track.requestUrl) {
    url.searchParams.set("xorb", "2");
    url.searchParams.set("xobt", "3");
    url.searchParams.set("xovt", "3");
    url.searchParams.set("cbr", "Chrome");
    url.searchParams.set("cbrver", "131.0.0.0");
    url.searchParams.set("c", "WEB");
    url.searchParams.set("cver", track.clientVersion || "2.20250908.02.00");
    url.searchParams.set("cplayer", "UNIPLAYER");
    url.searchParams.set("cos", "Windows");
    url.searchParams.set("cosver", "10.0");
    url.searchParams.set("cplatform", "DESKTOP");
  }
  if (options.translationLanguage) {
    url.searchParams.set("tlang", options.translationLanguage);
  }
  return url.toString();
};
