import { PlayerState } from "./types";

type PlayerStateListener = (state: PlayerState) => void;
type PlayStateListener = (isPlaying: boolean) => void;

export class YouTubePlayerFacade {
  private cachedVideoElement: HTMLVideoElement | null = null;
  private stateListeners = new Set<PlayerStateListener>();
  private playStateListeners = new Set<PlayStateListener>();
  private observer: MutationObserver | null = null;
  private currentVideoCleanup: (() => void) | null = null;

  private getVideoElementInternal(): HTMLVideoElement | null {
    const video = document.querySelector("video") as HTMLVideoElement | null;
    if (video !== this.cachedVideoElement) {
      this.detachCurrentVideo();
      this.cachedVideoElement = video;
      this.attachCurrentVideo();
    }
    return this.cachedVideoElement;
  }

  private attachCurrentVideo() {
    const video = this.cachedVideoElement;
    if (!video) {
      return;
    }

    const notifyState = () => {
      const state = this.detectPlayerState();
      this.stateListeners.forEach((listener) => listener(state));
      this.playStateListeners.forEach((listener) => listener(!state.isPaused));
    };

    const events = [
      "timeupdate",
      "play",
      "pause",
      "seeking",
      "seeked",
      "loadedmetadata",
      "durationchange",
      "volumechange",
    ] as const;

    events.forEach((eventName) => video.addEventListener(eventName, notifyState));
    notifyState();

    this.currentVideoCleanup = () => {
      events.forEach((eventName) =>
        video.removeEventListener(eventName, notifyState)
      );
    };
  }

  private detachCurrentVideo() {
    this.currentVideoCleanup?.();
    this.currentVideoCleanup = null;
  }

  private ensureObserver() {
    if (this.observer) {
      return;
    }

    this.observer = new MutationObserver(() => {
      this.getVideoElementInternal();
    });
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  public getVideoElement() {
    this.ensureObserver();
    return this.getVideoElementInternal();
  }

  public detectPlayerState(): PlayerState {
    const video = this.getVideoElement();
    if (!video) {
      return {
        isVideoAvailable: false,
        currentTime: 0,
        duration: 0,
        isPaused: true,
        volume: 0,
      };
    }

    return {
      isVideoAvailable: true,
      currentTime: video.currentTime || 0,
      duration: video.duration || 0,
      isPaused: video.paused,
      volume: video.volume,
    };
  }

  public subscribeState(listener: PlayerStateListener) {
    this.stateListeners.add(listener);
    listener(this.detectPlayerState());
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public subscribePlayState(listener: PlayStateListener) {
    this.playStateListeners.add(listener);
    listener(this.isPlaying());
    return () => {
      this.playStateListeners.delete(listener);
    };
  }

  public play() {
    const video = this.getVideoElement();
    if (video) {
      void video.play();
      return true;
    }
    return false;
  }

  public pause() {
    const video = this.getVideoElement();
    if (video) {
      video.pause();
      return true;
    }
    return false;
  }

  public seekTo(time: number) {
    const video = this.getVideoElement();
    if (video && !Number.isNaN(time) && time >= 0) {
      video.currentTime = time;
      return true;
    }
    return false;
  }

  public setVolume(volume: number) {
    const video = this.getVideoElement();
    if (video && volume >= 0 && volume <= 1) {
      video.volume = volume;
      return true;
    }
    return false;
  }

  public getCurrentTime() {
    return this.detectPlayerState().currentTime;
  }

  public getDuration() {
    return this.detectPlayerState().duration;
  }

  public isPlaying() {
    return !this.detectPlayerState().isPaused;
  }

  public reset() {
    this.detachCurrentVideo();
    this.cachedVideoElement = null;
    const emptyState = this.detectPlayerState();
    this.stateListeners.forEach((listener) => listener(emptyState));
    this.playStateListeners.forEach((listener) => listener(false));
  }
}

