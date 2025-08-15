import { SubtitleItem } from './subtitleTypes';
import { parseSubtitleContent } from './subtitleParser';

/**
 * 字幕获取和管理类
 */
export class SubtitleFetcher {
  private messageListenerSetup = false;

  /**
   * 监听来自background的消息
   */
  public setupBackgroundListener(): void {
    if (this.messageListenerSetup) {
      console.log("🎵 Background消息监听器已存在，跳过设置");
      return;
    }

    console.log("🎵 设置Background消息监听器...");
    this.messageListenerSetup = true;
  }

  /**
   * 处理字幕内容
   */
  public async processSubtitleContent(
    content: string,
    onSuccess: (subtitles: SubtitleItem[]) => void,
    onError: (error: string) => void
  ): Promise<void> {
    try {
      console.log("📄 内容预览:", JSON.parse(content));

      if (content.trim()) {
        const parsedSubs = await parseSubtitleContent(content);
        onSuccess(parsedSubs);
        console.log("✅ 成功解析字幕数量:", parsedSubs.length);
      }
    } catch (err) {
      console.error("❌ 处理字幕失败:", err);
      onError("处理字幕失败: " + (err as Error).message);
    }
  }

  /**
   * 获取完整字幕数据
   */
  public async getFullSubtitles(): Promise<void> {
    this.setupBackgroundListener();
    console.log("✅ Background监听器已设置，等待字幕请求...");
  }

  /**
   * 检查是否在YouTube页面
   */
  public isYouTubePage(): boolean {
    return window.location.hostname.includes("youtube.com");
  }

  /**
   * 获取视频播放器元素
   */
  public getVideoPlayer(): Element | null {
    return document.querySelector(
      "#movie_player, .html5-video-container, video"
    );
  }

  /**
   * 获取右侧推荐视频容器
   */
  public getSecondaryContent(): Element | null {
    return document.querySelector(
      "#secondary, #secondary-inner, ytd-watch-next-secondary-results-renderer"
    );
  }

  /**
   * 计算视频播放器位置和尺寸
   */
  public getPlayerRect(): DOMRect | null {
    const videoPlayer = this.getVideoPlayer();
    return videoPlayer ? videoPlayer.getBoundingClientRect() : null;
  }
}

// 导出单例实例
export const subtitleFetcher = new SubtitleFetcher();