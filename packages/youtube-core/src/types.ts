/**
 * @purpose YouTube 字幕轨、音轨元数据与字幕条目的平台无关类型契约。
 * @role    Extension 与 Desktop Embedded bridge 共用的纯核心边界。
 * @deps    无运行时依赖
 * @gotcha  sourceVideoId、track URL 与 session videoId 必须共同校验；原始音轨只认 audioIsDefault。
 */
export type CaptionTrackKind = "manual" | "asr";
export type CaptionTrackUrlSource = "current-track-url" | "renderer-base-url";

export interface CaptionTrackDescriptor {
  source: "player-response" | "initial-player-response" | "page-bridge";
  sourceVideoId: string;
  languageCode: string;
  displayName: string;
  kind: CaptionTrackKind;
  vssId: string;
  baseUrl: string;
  requestUrl?: string;
  clientVersion?: string;
  urlSource?: CaptionTrackUrlSource;
  hasPot?: boolean;
  isDefault: boolean;
  isOriginalAudioLanguage: boolean;
  isTranslatable: boolean;
}

export interface CaptionListResult {
  ok: true;
  tracks: CaptionTrackDescriptor[];
}

export interface CaptionListFailure {
  ok: false;
  code:
    | "PLAYER_NOT_READY"
    | "NO_CAPTIONS"
    | "BRIDGE_TIMEOUT"
    | "UNSUPPORTED_SHAPE";
  message: string;
}

export type CaptionListResponse = CaptionListResult | CaptionListFailure;

export interface YouTubeAudioTrackMetadata {
  id?: string;
  languageCode?: string;
  audioIsDefault?: boolean;
}

export interface YouTubeStreamingFormat {
  audioTrack?: YouTubeAudioTrackMetadata;
}

export interface YouTubeStreamingData {
  adaptiveFormats?: YouTubeStreamingFormat[];
  formats?: YouTubeStreamingFormat[];
}

export interface SubtitleItem {
  id: number | string;
  startTime: number;
  endTime: number;
  text: string;
  originalSubtitles?: Array<{
    id: number | string;
    startTime: number;
    endTime: number;
    text: string;
  }>;
}

export interface ParsedSubtitleData {
  events?: Array<{
    tStartMs?: number;
    dDurationMs?: number;
    segs?: Array<{ utf8?: string }>;
  }>;
}
