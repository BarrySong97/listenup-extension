/**
 * @purpose SDK 的共享类型：广告态、播放器态、会话态与四种回调。
 * @role    SDK 内外的类型契约。
 * @deps    无
 * @gotcha  改结构会同时影响 subtitles.tsx 的订阅逻辑
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

export type YouTubeTheme = 'dark' | 'light';
export interface YouTubeSessionState {
  videoId: string | null;
  isWatchPage: boolean;
  isPlayerReady: boolean;
}

export type AdStateCallback = (state: AdState) => void;
export type PlayerStateCallback = (state: PlayerState) => void;
export type ThemeChangeCallback = (theme: YouTubeTheme) => void;
export type SessionChangeCallback = (state: YouTubeSessionState) => void;
