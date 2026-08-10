/**
 * @purpose 向既有 Extension 调用方转出共享字幕条目与解析类型。
 * @role    subtitles 纯逻辑层与 UI 的兼容类型入口。
 * @deps    @listenup/youtube-core
 * @gotcha  类型权威已迁到 youtube-core；originalSubtitles 结构必须保持兼容。
 */
export type { ParsedSubtitleData, SubtitleItem } from "@listenup/youtube-core";
