/**
 * @purpose 向 SubtitleRepository 转出共享 videoId 三重身份校验。
 * @role    Extension captions 层的兼容适配器。
 * @deps    @listenup/youtube-core
 * @gotcha  逻辑权威已迁到 youtube-core；任一身份缺失都必须失败。
 */
export {
  extractVideoIdFromTrackUrl,
  validateCaptionVideoIdentity,
} from "@listenup/youtube-core";
export type {
  CaptionVideoIdentityInput,
  CaptionVideoIdentityResult,
} from "@listenup/youtube-core";
