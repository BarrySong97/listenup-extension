/**
 * YouTube SDK
 * Main orchestrator for YouTube interaction
 */

import { YouTubeAdDetector } from "./YouTubeAdDetector";
import { YouTubeVideoController } from "./YouTubeVideoController";
import { YouTubeSubtitleExtractor } from "./YouTubeSubtitleExtractor";
import { YouTubeThemeDetector } from "./YouTubeThemeDetector";
import {
  AdStateCallback,
  PlayerStateCallback,
  ThemeChangeCallback,
} from "./types";

export class YouTubeSDK {
  private adDetector: YouTubeAdDetector;
  private videoController: YouTubeVideoController;
  private subtitleExtractor: YouTubeSubtitleExtractor;
  private themeDetector: YouTubeThemeDetector;
  private observer: MutationObserver | null = null;
  private videoId: string | null = null;
  private originalPushState = history.pushState;
  private originalReplaceState = history.replaceState;

  constructor() {
    this.adDetector = new YouTubeAdDetector();
    this.videoController = new YouTubeVideoController();
    this.subtitleExtractor = new YouTubeSubtitleExtractor();
    this.themeDetector = new YouTubeThemeDetector();

    // Connect the video controller with ad detector
    this.videoController.setAdDetector(this.adDetector);
  }

  public getVideoId(): string | null {
    if (this.videoId) {
      return this.videoId;
    }
    // 使用正则表达式提取 v 参数，兼容后续还有其他参数的情况
    const match = window.location.search.match(/[?&]v=([^&]+)/);
    const videoId = match ? match[1] : null;
    if (videoId) {
      this.videoId = videoId;
      return videoId;
    }
    return null;
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
      this.videoController.reset();
      return;
    }

    const player = document.querySelector("#movie_player");
    if (!player) return;

    this.observer = new MutationObserver(() => {
      // Notify both detectors of changes
      this.adDetector.notifyChange();
      this.videoController.notifyChange();
    });

    this.observer.observe(player, {
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
      subtree: true,
    });

    // Initial check
    this.adDetector.notifyChange();
    this.videoController.notifyChange();
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
    } = {}
  ): void {
    // Set callbacks
    if (options.onAdStateChange) {
      this.adDetector.setCallback(options.onAdStateChange);
    }
    if (options.onPlayerStateChange) {
      this.videoController.setCallback(options.onPlayerStateChange);
    }
    if (options.onThemeChange) {
      this.themeDetector.setCallback(options.onThemeChange);
    }

    // Start theme monitoring
    this.themeDetector.startMonitoring();

    // Setup initially
    this.setupObserver();

    // Intercept History API for SPA navigation
    const self = this;
    history.pushState = function (...args) {
      self.originalPushState.apply(history, args);
      self.handleUrlChange();
    };

    history.replaceState = function (...args) {
      self.originalReplaceState.apply(history, args);
      self.handleUrlChange();
    };

    window.addEventListener("popstate", this.handleUrlChange);
  }

  /**
   * Stop monitoring and cleanup
   */
  public stop(): void {
    this.observer?.disconnect();
    this.observer = null;

    // Clear callbacks
    this.adDetector.setCallback(null);
    this.videoController.setCallback(null);
    this.themeDetector.setCallback(null);

    // Stop theme monitoring
    this.themeDetector.stopMonitoring();

    // Reset states
    this.adDetector.reset();
    this.videoController.reset();

    // Restore original History API methods
    history.pushState = this.originalPushState;
    history.replaceState = this.originalReplaceState;

    window.removeEventListener("popstate", this.handleUrlChange);
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
  public getVideoController(): YouTubeVideoController {
    return this.videoController;
  }

  /**
   * Get the subtitle extractor instance
   */
  public getSubtitleExtractor(): YouTubeSubtitleExtractor {
    return this.subtitleExtractor;
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
    return this.videoController.getVideoElement();
  }

  public play(): boolean {
    return this.videoController.play();
  }

  public pause(): boolean {
    return this.videoController.pause();
  }

  public seekTo(time: number): boolean {
    return this.videoController.seekTo(time);
  }

  public setVolume(volume: number): boolean {
    return this.videoController.setVolume(volume);
  }

  public getCurrentTime(): number {
    return this.videoController.getCurrentTime();
  }

  public getDuration(): number {
    return this.videoController.getDuration();
  }

  public isPlaying(): boolean {
    return this.videoController.isPlaying();
  }

  public getCurrentPlayerState() {
    return this.videoController.detectPlayerState();
  }

  public async getSubtitleUrl(languageCode: string): Promise<string | null> {
    return await this.subtitleExtractor.getSubtitleUrl(languageCode);
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
