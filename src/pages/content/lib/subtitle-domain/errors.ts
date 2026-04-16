export type SubtitleLoadErrorCode =
  | "NOT_WATCH_PAGE"
  | "PLAYER_NOT_READY"
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

