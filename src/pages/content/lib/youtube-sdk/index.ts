/**
 * YouTube SDK exports
 */

export { YouTubeSDK } from './YouTubeSDK';
export { YouTubeAdDetector } from './YouTubeAdDetector';
export { YouTubePlayerFacade } from './YouTubePlayerFacade';
export { YouTubeSessionMonitor } from './YouTubeSessionMonitor';
export { YouTubeThemeDetector } from './YouTubeThemeDetector';
export type {
  AdState,
  PlayerState,
  YouTubeTheme,
  YouTubeSessionState,
  AdStateCallback,
  PlayerStateCallback,
  ThemeChangeCallback,
  SessionChangeCallback,
} from './types';

// Export singleton instance for convenience
import { YouTubeSDK } from './YouTubeSDK';
export const youtubeSDK = new YouTubeSDK();
