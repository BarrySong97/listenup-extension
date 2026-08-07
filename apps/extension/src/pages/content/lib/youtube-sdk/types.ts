/**
 * @purpose SDK 的共享类型：广告态、带事件原因的播放器态、会话态与四种回调。
 * @role    SDK 内外的类型契约。
 * @deps    无
 * @gotcha  PlayerStateChangeReason 驱动 Native seek 强制同步；改结构要同步 subtitles.tsx。
 */
/**
 * Shared types for YouTube SDK
 */

export interface AdState {
  isAdPlaying: boolean;
  adType: 'none' | 'skippable' | 'non-skippable' | 'overlay';
  adText: string;
  adRemainingTime: number;
}

export interface PlayerState {
  isVideoAvailable: boolean;
  currentTime: number;
  duration: number;
  isPaused: boolean;
  volume: number;
}

export type PlayerStateChangeReason =
  | 'initial'
  | 'reset'
  | 'timeupdate'
  | 'play'
  | 'pause'
  | 'seeking'
  | 'seeked'
  | 'loadedmetadata'
  | 'durationchange'
  | 'volumechange';

export type YouTubeTheme = 'dark' | 'light';
export interface YouTubeSessionState {
  videoId: string | null;
  isWatchPage: boolean;
  isPlayerReady: boolean;
}

export type AdStateCallback = (state: AdState) => void;
export type PlayerStateCallback = (
  state: PlayerState,
  reason: PlayerStateChangeReason
) => void;
export type ThemeChangeCallback = (theme: YouTubeTheme) => void;
export type SessionChangeCallback = (state: YouTubeSessionState) => void;
