/**
 * YouTube视频控制器
 * 负责与YouTube视频播放器的交互
 */
export class YouTubeController {
  private cachedVideoElement: HTMLVideoElement | null = null;
  private timeUpdateCallback: ((currentTime: number) => void) | null = null;
  private timeUpdateCleanup: (() => void) | null = null;
  private videoCheckInterval: NodeJS.Timeout | null = null;

  /**
   * 获取YouTube视频元素（带缓存）
   */
  public getVideoElement(): HTMLVideoElement | null {
    // 重新查找视频元素
    const videoElement = document.querySelector("video") as HTMLVideoElement;
    
    // 检查是否是新的视频元素
    const isNewElement = videoElement !== this.cachedVideoElement;
    
    if (videoElement) {
      if (isNewElement) {
        this.cachedVideoElement = videoElement;
        
        // 如果有活跃的时间更新回调，重新附加到新元素
        if (this.timeUpdateCallback) {
          this.reattachTimeUpdateListener();
        }
      }
      return this.cachedVideoElement;
    } else {
      if (this.cachedVideoElement) {
        this.cachedVideoElement = null;
      }
      return null;
    }
  }

  /**
   * 重新附加时间更新监听器到新的视频元素
   */
  private reattachTimeUpdateListener(): void {
    // 清理旧的监听器
    if (this.timeUpdateCleanup) {
      this.timeUpdateCleanup();
    }
    
    // 附加到新元素
    if (this.cachedVideoElement && this.timeUpdateCallback) {
      const handleTimeUpdate = () => {
        if (this.timeUpdateCallback && this.cachedVideoElement) {
          this.timeUpdateCallback(this.cachedVideoElement.currentTime);
        }
      };

      this.cachedVideoElement.addEventListener("timeupdate", handleTimeUpdate);
      
      this.timeUpdateCleanup = () => {
        if (this.cachedVideoElement) {
          this.cachedVideoElement.removeEventListener("timeupdate", handleTimeUpdate);
        }
      };
    }
  }

  /**
   * 清除缓存的视频元素（页面跳转时使用）
   */
  public clearCache(): void {
    this.stopVideoElementMonitoring();
    if (this.timeUpdateCleanup) {
      this.timeUpdateCleanup();
      this.timeUpdateCleanup = null;
    }
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
   * 开始监控视频元素变化
   */
  private startVideoElementMonitoring(): void {
    if (this.videoCheckInterval) {
      clearInterval(this.videoCheckInterval);
    }
    
    this.videoCheckInterval = setInterval(() => {
      this.getVideoElement();
    }, 2000); // 每2秒检查一次
  }
  
  /**
   * 停止监控视频元素变化
   */
  private stopVideoElementMonitoring(): void {
    if (this.videoCheckInterval) {
      clearInterval(this.videoCheckInterval);
      this.videoCheckInterval = null;
    }
  }

  /**
   * 设置时间更新监听器
   */
  public setupTimeUpdateListener(
    callback: (currentTime: number) => void
  ): () => void {
    // 清理之前的监听器
    if (this.timeUpdateCleanup) {
      this.timeUpdateCleanup();
    }
    
    // 保存回调用于后续重新附加
    this.timeUpdateCallback = callback;
    
    // 立即附加到当前视频元素
    this.reattachTimeUpdateListener();
    
    // 开始监控视频元素变化
    this.startVideoElementMonitoring();

    // 返回清理函数
    return () => {
      this.stopVideoElementMonitoring();
      if (this.timeUpdateCleanup) {
        this.timeUpdateCleanup();
        this.timeUpdateCleanup = null;
      }
      this.timeUpdateCallback = null;
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
