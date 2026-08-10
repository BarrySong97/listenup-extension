/**
 * @purpose 向既有 Extension 调用方转出共享原始音轨语言工具。
 * @role    PlayerResponseCaptionSource、BridgeCaptionSource 的兼容适配层。
 * @deps    @listenup/youtube-core
 * @gotcha  逻辑权威已迁到 youtube-core；只能信任 audioIsDefault=true。
 */
export {
  getAudioTrackLanguageCode,
  getOriginalAudioLanguageCode,
  matchesLanguageCode,
} from "@listenup/youtube-core";
export type { YouTubeAudioTrackMetadata } from "@listenup/youtube-core";
