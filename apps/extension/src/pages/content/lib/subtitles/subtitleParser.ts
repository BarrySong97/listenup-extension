/**
 * @purpose 向 SubtitleRepository 转出共享字幕解析实现与具名错误。
 * @role    Extension subtitles 层的兼容适配器。
 * @deps    @listenup/youtube-core
 * @gotcha  逻辑权威已迁到 youtube-core；解析失败不能在此降级为空数组。
 */
export {
  parseJSONSubtitles,
  parseSubtitleContent,
  parseTimeString,
  parseWebVTT,
  parseXMLSubtitles,
  SubtitleParseError,
} from "@listenup/youtube-core";
export type { SubtitleParseErrorCode } from "@listenup/youtube-core";
