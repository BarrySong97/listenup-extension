/**
 * @purpose 广告探测：判断是否播广告、类型、文案与剩余秒数。
 * @role    SDK 子组件，同时被 PlayerFacade 用来决定 video 是否可用。
 * @deps    YouTube 播放器 DOM（.ytp-ad-* / #movie_player.ad-showing）
 * @gotcha  全靠 YouTube class 名，改版即静默失效——面板异常时先查这里。见 docs/modules/extension/youtube-sdk.md
 */
/**
 * YouTube Ad Detector
 * Responsible for detecting and monitoring YouTube ads
 */

import { AdState, AdStateCallback } from './types';

export class YouTubeAdDetector {
  private currentAdState: AdState = {
    isAdPlaying: false,
    adType: 'none',
    adText: '',
    adRemainingTime: 0
  };
  
  private callback: AdStateCallback | null = null;

  /**
   * Get YouTube player element
   */
  private getPlayer(): HTMLElement | null {
    return document.querySelector("#movie_player");
  }

  /**
   * Detect current ad state
   */
  public detectAdState(): AdState {
    // 性能：所有查询都限定在 #movie_player 子树内，不做全文档扫描。
    // 这个方法会被播放器 DOM 的 MutationObserver 高频触发，
    // 全文档 querySelector 会随 YouTube SPA 的 DOM 膨胀越来越慢
    const player = this.getPlayer();
    const isAd =
      player?.classList?.contains("ad-showing") ||
      !!player?.querySelector(".ytp-ad-showing");

    if (!player || !isAd) {
      this.currentAdState = {
        isAdPlaying: false,
        adType: 'none',
        adText: '',
        adRemainingTime: 0
      };
      return this.currentAdState;
    }

    // Determine ad type
    const skipButton = player.querySelector(
      ".ytp-ad-skip-button, .ytp-ad-skip-button-modern"
    );
    const adOverlay = player.querySelector(".ytp-ad-overlay-container");
    const adType = skipButton ? "skippable" : adOverlay ? "overlay" : "non-skippable";

    // Get ad text (e.g., "Ad 1 of 2")
    const adTextEl = player.querySelector(
      ".ytp-ad-simple-ad-badge, .ytp-ad-badge-text"
    );
    const adText = adTextEl?.textContent || "";

    // Get ad time remaining
    let adRemainingTime = 0;
    const timeEl = player.querySelector(".ytp-ad-duration-remaining");
    if (timeEl?.textContent) {
      const match = timeEl.textContent.match(/(\d+):?(\d+)?/);
      if (match) {
        const mins = parseInt(match[1] || "0");
        const secs = parseInt(match[2] || match[1] || "0");
        adRemainingTime = mins * 60 + secs;
      }
    }

    this.currentAdState = {
      isAdPlaying: true,
      adType,
      adText,
      adRemainingTime
    };

    return this.currentAdState;
  }

  /**
   * Set callback for ad state changes
   */
  public setCallback(callback: AdStateCallback | null): void {
    this.callback = callback;
  }

  /**
   * Notify callback of state change
   */
  public notifyChange(): void {
    const state = this.detectAdState();
    if (this.callback) {
      this.callback(state);
    }
  }

  /**
   * Get current ad state
   */
  public getCurrentState(): AdState {
    return this.currentAdState;
  }

  /**
   * Check if ads are currently playing
   */
  public isAdPlaying(): boolean {
    return this.currentAdState.isAdPlaying;
  }

  /**
   * Reset ad state
   */
  public reset(): void {
    this.currentAdState = {
      isAdPlaying: false,
      adType: 'none',
      adText: '',
      adRemainingTime: 0
    };
    
    if (this.callback) {
      this.callback(this.currentAdState);
    }
  }
}