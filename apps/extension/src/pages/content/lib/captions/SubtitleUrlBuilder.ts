/**
 * @purpose 根据轨道描述符拼出可下载的字幕 URL（默认 json3 格式）。
 * @role    SubtitleRepository 下载前的最后一步。
 * @deps    captions/types、URL
 * @gotcha  requestUrl 存在时要补 xorb/xobt/xovt 参数，否则 YouTube 返回空文档
 */
import { CaptionTrackDescriptor } from "./types";

export interface SubtitleUrlOptions {
  format?: "json3";
  translationLanguage?: string;
}

export const buildSubtitleUrl = (
  track: CaptionTrackDescriptor,
  options: SubtitleUrlOptions = {}
): string => {
  const url = new URL(track.requestUrl || track.baseUrl);
  const format = options.format || "json3";

  url.searchParams.set("fmt", format);

  if (track.requestUrl) {
    url.searchParams.set("xorb", "2");
    url.searchParams.set("xobt", "3");
    url.searchParams.set("xovt", "3");
    url.searchParams.set("cbr", "Chrome");
    url.searchParams.set("cbrver", "131.0.0.0");
    url.searchParams.set("c", "WEB");
    url.searchParams.set(
      "cver",
      track.clientVersion || "2.20250908.02.00"
    );
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
