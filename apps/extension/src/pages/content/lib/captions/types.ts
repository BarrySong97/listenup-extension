/**
 * @purpose 向既有 Extension 调用方转出共享 YouTube 字幕轨类型。
 * @role    captions 与 subtitle-domain 的兼容适配层。
 * @deps    @listenup/youtube-core
 * @gotcha  类型权威已迁到 youtube-core；本文件只保持现有相对导入稳定。
 */
export type {
  CaptionListFailure,
  CaptionListResponse,
  CaptionListResult,
  CaptionTrackDescriptor,
  CaptionTrackKind,
  CaptionTrackUrlSource,
} from "@listenup/youtube-core";
