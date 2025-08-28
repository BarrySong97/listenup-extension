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

export type AdStateCallback = (state: AdState) => void;
export type PlayerStateCallback = (state: PlayerState) => void;
export type ThemeChangeCallback = (theme: YouTubeTheme) => void;