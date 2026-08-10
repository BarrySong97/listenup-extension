/**
 * @purpose 向 SubtitleRepository 转出共享字幕 URL 构建函数。
 * @role    Extension captions 层的兼容适配器。
 * @deps    @listenup/youtube-core
 * @gotcha  逻辑权威已迁到 youtube-core；requestUrl 的 POT 上下文不能在此丢失。
 */
export { buildSubtitleUrl } from "@listenup/youtube-core";
export type { SubtitleUrlOptions } from "@listenup/youtube-core";
