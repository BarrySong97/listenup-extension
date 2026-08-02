/**
 * @purpose 字幕轨相关的类型契约：轨道描述符、来源与列表返回结构。
 * @role    captions 层与 subtitle-domain 层之间的公共类型。
 * @deps    无运行时依赖
 * @gotcha  sourceVideoId 与轨 URL 的 v 参数必须同时校验；isOriginalAudioLanguage 来自 audioIsDefault，不能用当前配音代替。见 docs/modules/extension/content.md
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
