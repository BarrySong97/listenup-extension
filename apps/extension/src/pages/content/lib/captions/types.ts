export type CaptionTrackKind = "manual" | "asr";
export type CaptionTrackUrlSource = "current-track-url" | "renderer-base-url";

export interface CaptionTrackDescriptor {
  source: "player-response" | "initial-player-response" | "page-bridge";
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

export interface TrackPreference {
  preferredLanguages: string[];
  preferManual: boolean;
  allowRegionFallback: boolean;
}
