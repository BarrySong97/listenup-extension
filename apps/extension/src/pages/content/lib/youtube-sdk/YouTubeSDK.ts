/**
 * @purpose SDK 主编排：管理子组件生命周期、装 MutationObserver、拦 History API、对外统一 API。
 * @role    被 index.ts 实例化为单例 youtubeSDK。
 * @deps    ./YouTube{AdDetector,PlayerFacade,SessionMonitor,ThemeDetector}、MutationObserver、history API
 * @gotcha  observer 只观察必要属性，YouTube 页面 DOM 变动极频繁；stop() 必须解绑，否则 SPA 切页会泄漏
 */
/**
 * YouTube SDK
 * Main orchestrator for YouTube interaction
 */

import { YouTubeAdDetector } from "./YouTubeAdDetector";
import { YouTubePlayerFacade } from "./YouTubePlayerFacade";
import { YouTubeSessionMonitor } from "./YouTubeSessionMonitor";
import { YouTubeThemeDetector } from "./YouTubeThemeDetector";
import {
  AdStateCallback,
  PlayerStateCallback,
  SessionChangeCallback,
  ThemeChangeCallback,
  YouTubeSessionState,
} from "./types";

export class YouTubeSDK {
  private adDetector: YouTubeAdDetector;
  private playerFacade: YouTubePlayerFacade;
  private sessionMonitor: YouTubeSessionMonitor;
  private themeDetector: YouTubeThemeDetector;
  private observer: MutationObserver | null = null;
  private playerCleanup: (() => void) | null = null;
  private sessionCleanup: (() => void) | null = null;

  constructor() {
    this.adDetector = new YouTubeAdDetector();
    this.playerFacade = new YouTubePlayerFacade();
    this.sessionMonitor = new YouTubeSessionMonitor();
    this.themeDetector = new YouTubeThemeDetector();
  }

  public getVideoId(): string | null {
    return this.sessionMonitor.getState().videoId;
  }

  /**
   * Check if current page is a YouTube video page
   */
  private isVideoPage(): boolean {
    return window.location.pathname === "/watch";
  }

  /**
   * Setup MutationObserver for the player
   */
  private setupObserver(): void {
    this.observer?.disconnect();

    // Only setup on video pages
    if (!this.isVideoPage()) {
      // Reset states when not on video page
      this.adDetector.reset();
      this.playerFacade.reset();
      return;
    }

    const player = document.querySelector("#movie_player") || document.documentElement;

    // 播放器子树的 DOM 变动非常频繁（进度条/字幕/悬浮层……），
    // 广告状态没必要逐次检测：合并成 250ms 一次的尾随防抖
    let debounceTimer = 0;
    this.observer = new MutationObserver(() => {
      if (debounceTimer !== 0) {
        return;
      }
      debounceTimer = window.setTimeout(() => {
        debounceTimer = 0;
        this.adDetector.notifyChange();
      }, 250);
    });

    this.observer.observe(player, {
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
      subtree: true,
    });

    // Initial check
    this.adDetector.notifyChange();
  }

  /**
   * Handle URL changes
   */
  private handleUrlChange = (): void => {
    // Reset subtitle cache on navigation
  };

  /**
   * Start monitoring
   */
  public start(
    options: {
      onAdStateChange?: AdStateCallback;
      onPlayerStateChange?: PlayerStateCallback;
      onThemeChange?: ThemeChangeCallback;
      onSessionChange?: SessionChangeCallback;
    } = {}
  ): void {
    // Set callbacks
    if (options.onAdStateChange) {
      this.adDetector.setCallback(options.onAdStateChange);
    }
    if (options.onThemeChange) {
      this.themeDetector.setCallback(options.onThemeChange);
    }

    this.playerCleanup?.();
    if (options.onPlayerStateChange) {
      this.playerCleanup = this.playerFacade.subscribeState(
        options.onPlayerStateChange
      );
    } else {
      this.playerCleanup = null;
    }

    this.sessionMonitor.start();
    this.sessionCleanup?.();
    if (options.onSessionChange) {
      this.sessionCleanup = this.sessionMonitor.subscribe(options.onSessionChange);
    } else {
      this.sessionCleanup = null;
    }

    // Start theme monitoring
    this.themeDetector.startMonitoring();

    // Setup initially
    this.setupObserver();
  }

  /**
   * Stop monitoring and cleanup
   */
  public stop(): void {
    this.observer?.disconnect();
    this.observer = null;

    // Clear callbacks
    this.adDetector.setCallback(null);
    this.themeDetector.setCallback(null);
    this.playerCleanup?.();
    this.playerCleanup = null;
    this.sessionCleanup?.();
    this.sessionCleanup = null;

    // Stop theme monitoring
    this.themeDetector.stopMonitoring();
    this.sessionMonitor.stop();

    // Reset states
    this.adDetector.reset();
    this.playerFacade.reset();
  }

  /**
   * Get the ad detector instance
   */
  public getAdDetector(): YouTubeAdDetector {
    return this.adDetector;
  }

  /**
   * Get the video controller instance
   */
  public getPlayerFacade(): YouTubePlayerFacade {
    return this.playerFacade;
  }

  public getSessionState(): YouTubeSessionState {
    return this.sessionMonitor.getState();
  }

  /**
   * Get the theme detector instance
   */
  public getThemeDetector(): YouTubeThemeDetector {
    return this.themeDetector;
  }

  /**
   * Convenience methods - delegate to appropriate component
   */

  // Ad-related methods
  public isAdPlaying(): boolean {
    return this.adDetector.isAdPlaying();
  }

  public getCurrentAdState() {
    return this.adDetector.getCurrentState();
  }

  // Video-related methods
  public getVideo(): HTMLVideoElement | null {
    return this.playerFacade.getVideoElement();
  }

  public play(): boolean {
    return this.playerFacade.play();
  }

  public pause(): boolean {
    return this.playerFacade.pause();
  }

  public seekTo(time: number): boolean {
    return this.playerFacade.seekTo(time);
  }

  public setVolume(volume: number): boolean {
    return this.playerFacade.setVolume(volume);
  }

  public getCurrentTime(): number {
    return this.playerFacade.getCurrentTime();
  }

  public getDuration(): number {
    return this.playerFacade.getDuration();
  }

  public isPlaying(): boolean {
    return this.playerFacade.isPlaying();
  }

  public getCurrentPlayerState() {
    return this.playerFacade.detectPlayerState();
  }

  // Theme-related methods
  public getCurrentTheme() {
    return this.themeDetector.getCurrentTheme();
  }

  public isDarkTheme(): boolean {
    return this.themeDetector.isDark();
  }

  public isLightTheme(): boolean {
    return this.themeDetector.isLight();
  }

  public getThemeColors() {
    return this.themeDetector.getThemeColors();
  }
}
