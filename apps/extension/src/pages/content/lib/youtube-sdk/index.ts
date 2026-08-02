/**
 * @purpose YouTube SDK 的导出面与全局单例 youtubeSDK。
 * @role    内容脚本访问播放器的唯一入口。
 * @deps    ./YouTubeSDK 及各子组件
 * @gotcha  必须用这个单例，别自己 new——会装出多个 MutationObserver。见 docs/modules/extension/youtube-sdk.md
 */
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
