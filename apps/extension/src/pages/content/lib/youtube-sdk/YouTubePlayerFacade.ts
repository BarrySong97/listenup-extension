/**
 * @purpose 播放控制门面：取 video 元素、播放/暂停/seek/音量，并保留播放器事件原因。
 * @role    SDK 子组件；内容脚本所有播放操作都经过它。
 * @deps    ./YouTubeAdDetector、YouTube 的 video 元素
 * @gotcha  同一 seek 手势只把首次 seeking 和最终 seeked 标成强制同步原因；广告时上层必须处理空值。
 */
import { PlayerState, PlayerStateChangeReason } from "./types";

type PlayerStateListener = (
  state: PlayerState,
  reason: PlayerStateChangeReason
) => void;
type PlayStateListener = (isPlaying: boolean) => void;

export class YouTubePlayerFacade {
  private cachedVideoElement: HTMLVideoElement | null = null;
  private stateListeners = new Set<PlayerStateListener>();
  private playStateListeners = new Set<PlayStateListener>();
  private currentVideoCleanup: (() => void) | null = null;
  private seekInProgress = false;
  // 低频看门狗：万一 video 元素被整个替换（缓存失联导致事件停止），
  // 2 秒内会重新捕获。isConnected 快路径下这基本是零成本
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private videoWatchdog = window.setInterval(() => {
    this.getVideoElementInternal();
  }, 2000);

  private getVideoElementInternal(): HTMLVideoElement | null {
    // 性能关键：video 元素还挂在文档上就直接复用缓存，不做任何查询。
    // 之前这里靠一个观察整个 document 的 MutationObserver 来刷新缓存，
    // YouTube 的 DOM 变动极频繁且随 SPA 导航持续膨胀，每次变动都全文档
    // querySelector("video")，是页面越用越卡的主要来源之一。
    if (this.cachedVideoElement?.isConnected) {
      return this.cachedVideoElement;
    }

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

    const notifyState = (reason: PlayerStateChangeReason) => {
      const state = this.detectPlayerState();
      this.stateListeners.forEach((listener) => listener(state, reason));
      this.playStateListeners.forEach((listener) => listener(!state.isPaused));
    };

    const simpleEvents = [
      "timeupdate",
      "play",
      "pause",
      "loadedmetadata",
      "durationchange",
      "volumechange",
    ] as const;
    const simpleHandlers = simpleEvents.map((eventName) => {
      const handler = () => notifyState(eventName);
      video.addEventListener(eventName, handler);
      return [eventName, handler] as const;
    });
    const handleSeeking = () => {
      const reason = this.seekInProgress ? "timeupdate" : "seeking";
      this.seekInProgress = true;
      notifyState(reason);
    };
    const handleSeeked = () => {
      this.seekInProgress = false;
      notifyState("seeked");
    };

    video.addEventListener("seeking", handleSeeking);
    video.addEventListener("seeked", handleSeeked);
    notifyState("initial");

    this.currentVideoCleanup = () => {
      simpleHandlers.forEach(([eventName, handler]) =>
        video.removeEventListener(eventName, handler)
      );
      video.removeEventListener("seeking", handleSeeking);
      video.removeEventListener("seeked", handleSeeked);
      this.seekInProgress = false;
    };
  }

  private detachCurrentVideo() {
    this.currentVideoCleanup?.();
    this.currentVideoCleanup = null;
  }

  public getVideoElement() {
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
    listener(this.detectPlayerState(), "initial");
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

  public async controlPlayback(action: "play" | "pause") {
    const video = this.getVideoElement();
    if (!video) {
      throw new Error("YouTube 播放器不可用");
    }
    if (action === "play") {
      await video.play();
      return;
    }
    video.pause();
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
    this.seekInProgress = false;
    const emptyState = this.detectPlayerState();
    this.stateListeners.forEach((listener) => listener(emptyState, "reset"));
    this.playStateListeners.forEach((listener) => listener(false));
  }
}
