/**
 * YouTube Video Controller
 * Responsible for controlling YouTube video playback
 */

import { PlayerState, PlayerStateCallback } from './types';
import { YouTubeAdDetector } from './YouTubeAdDetector';

export class YouTubeVideoController {
  private cachedVideoElement: HTMLVideoElement | null = null;
  private callback: PlayerStateCallback | null = null;
  private adDetector: YouTubeAdDetector | null = null;

  /**
   * Set the ad detector to coordinate with
   */
  public setAdDetector(detector: YouTubeAdDetector): void {
    this.adDetector = detector;
  }

  /**
   * Get video element (returns null during ads)
   */
  public getVideoElement(): HTMLVideoElement | null {
    // Don't provide video element during ads
    if (this.adDetector?.isAdPlaying()) {
      this.cachedVideoElement = null;
      return null;
    }

    const videoElement = document.querySelector("video") as HTMLVideoElement;
    
    // Check if it's a new video element
    if (videoElement !== this.cachedVideoElement) {
      this.cachedVideoElement = videoElement;
    }
    
    return this.cachedVideoElement;
  }

  /**
   * Detect player state
   */
  public detectPlayerState(): PlayerState {
    const video = this.getVideoElement();
    
    if (!video) {
      return {
        isVideoAvailable: false,
        currentTime: 0,
        duration: 0,
        isPaused: true,
        volume: 0
      };
    }

    return {
      isVideoAvailable: true,
      currentTime: video.currentTime || 0,
      duration: video.duration || 0,
      isPaused: video.paused,
      volume: video.volume
    };
  }

  /**
   * Set callback for player state changes
   */
  public setCallback(callback: PlayerStateCallback | null): void {
    this.callback = callback;
  }

  /**
   * Notify callback of state change
   */
  public notifyChange(): void {
    const state = this.detectPlayerState();
    if (this.callback) {
      this.callback(state);
    }
  }

  /**
   * Control methods (only work when no ads are playing)
   */
  public play(): boolean {
    const video = this.getVideoElement();
    if (video) {
      video.play();
      return true;
    }
    return false;
  }

  public pause(): boolean {
    const video = this.getVideoElement();
    if (video) {
      video.pause();
      return true;
    }
    return false;
  }

  public seekTo(time: number): boolean {
    const video = this.getVideoElement();
    if (video && !isNaN(time) && time >= 0) {
      video.currentTime = time;
      return true;
    }
    return false;
  }

  public setVolume(volume: number): boolean {
    const video = this.getVideoElement();
    if (video && volume >= 0 && volume <= 1) {
      video.volume = volume;
      return true;
    }
    return false;
  }

  /**
   * Get current time
   */
  public getCurrentTime(): number {
    const video = this.getVideoElement();
    return video ? video.currentTime : 0;
  }

  /**
   * Get video duration
   */
  public getDuration(): number {
    const video = this.getVideoElement();
    return video ? video.duration : 0;
  }

  /**
   * Check if video is playing
   */
  public isPlaying(): boolean {
    const video = this.getVideoElement();
    return video ? !video.paused : false;
  }

  /**
   * Reset cached video element
   */
  public reset(): void {
    this.cachedVideoElement = null;
    
    if (this.callback) {
      this.callback({
        isVideoAvailable: false,
        currentTime: 0,
        duration: 0,
        isPaused: true,
        volume: 0
      });
    }
  }
}