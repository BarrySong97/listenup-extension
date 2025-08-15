/**
 * YouTube视频控制器
 * 负责与YouTube视频播放器的交互
 */
export class YouTubeController {
  private cachedVideoElement: HTMLVideoElement | null = null;

  /**
   * 获取YouTube视频元素（带缓存）
   */
  public getVideoElement(): HTMLVideoElement | null {
    if (this.cachedVideoElement && document.contains(this.cachedVideoElement)) {
      return this.cachedVideoElement;
    }

    this.cachedVideoElement = document.querySelector("video");
    return this.cachedVideoElement;
  }

  /**
   * 清除缓存的视频元素（页面跳转时使用）
   */
  public clearCache(): void {
    this.cachedVideoElement = null;
  }

  /**
   * 跳转到指定时间
   */
  public seekToTime(seconds: number, offset: number = 0): boolean {
    const video = this.getVideoElement();
    if (video && !isNaN(seconds) && seconds >= 0) {
      video.currentTime = seconds + offset;
      return true;
    }
    return false;
  }

  /**
   * 获取当前播放时间
   */
  public getCurrentTime(): number {
    const video = this.getVideoElement();
    return video ? video.currentTime : 0;
  }

  /**
   * 获取视频总时长
   */
  public getDuration(): number {
    const video = this.getVideoElement();
    return video ? video.duration : 0;
  }

  /**
   * 播放视频
   */
  public play(): void {
    const video = this.getVideoElement();
    if (video) {
      video.play();
    }
  }

  /**
   * 暂停视频
   */
  public pause(): void {
    const video = this.getVideoElement();
    if (video) {
      video.pause();
    }
  }

  /**
   * 检查视频是否正在播放
   */
  public isPlaying(): boolean {
    const video = this.getVideoElement();
    return video ? !video.paused : false;
  }

  /**
   * 设置时间更新监听器
   */
  public setupTimeUpdateListener(
    callback: (currentTime: number) => void
  ): () => void {
    const video = this.getVideoElement();
    if (!video) {
      return () => {};
    }

    const handleTimeUpdate = () => {
      callback(video.currentTime);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }

  /**
   * 设置播放状态变化监听器
   */
  public setupPlayStateListener(
    onPlay: () => void,
    onPause: () => void
  ): () => void {
    const video = this.getVideoElement();
    if (!video) {
      return () => {};
    }

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }
}

// 导出单例实例
export const youtubeController = new YouTubeController();
