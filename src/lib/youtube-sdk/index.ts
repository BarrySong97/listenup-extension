/**
 * YouTube SDK exports
 */

export { YouTubeSDK } from './YouTubeSDK';
export { YouTubeAdDetector } from './YouTubeAdDetector';
export { YouTubeVideoController } from './YouTubeVideoController';
export { YouTubeSubtitleExtractor } from './YouTubeSubtitleExtractor';
export { YouTubeThemeDetector } from './YouTubeThemeDetector';
export type { AdState, PlayerState, YouTubeTheme, AdStateCallback, PlayerStateCallback, ThemeChangeCallback } from './types';
export type { SubtitleInfo, CaptionTrack, CaptionsData } from './YouTubeSubtitleExtractor';

// Export singleton instance for convenience
import { YouTubeSDK } from './YouTubeSDK';
export const youtubeSDK = new YouTubeSDK();