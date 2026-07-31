/**
 * @purpose 字幕加载的具名错误与错误码枚举。
 * @role    领域层向上抛错的统一形态，UI 据此映射四态。
 * @deps    无
 * @gotcha  新增错误码要同步 UI 的四态映射，别让新码退化成通用报错
 */
export type SubtitleLoadErrorCode =
  | "NOT_WATCH_PAGE"
  | "PLAYER_NOT_READY"
  | "VIDEO_ID_MISMATCH"
  | "NO_CAPTION_TRACKS"
  | "TRACK_SELECTION_FAILED"
  | "NETWORK_ERROR"
  | "PARSE_ERROR"
  | "BRIDGE_TIMEOUT"
  | "UNSUPPORTED_SHAPE";

export class SubtitleLoadError extends Error {
  public readonly code: SubtitleLoadErrorCode;

  constructor(code: SubtitleLoadErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
