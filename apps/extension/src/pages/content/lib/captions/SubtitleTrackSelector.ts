/**
 * @purpose 向 SubtitleRepository 转出共享原语字幕选轨函数。
 * @role    Extension captions 层的兼容适配器。
 * @deps    @listenup/youtube-core
 * @gotcha  逻辑权威已迁到 youtube-core；此处不得复制选轨规则。
 */
export { selectCaptionTrack } from "@listenup/youtube-core";
