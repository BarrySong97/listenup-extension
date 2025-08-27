import { SubtitleItem } from "./subtitleTypes";
import { parseSubtitleContent } from "./subtitleParser";

interface CaptionTrack {
  baseUrl: string;
  name: {
    simpleText: string;
  };
  languageCode: string;
  kind?: string;
  vssId: string;
}

interface CaptionsData {
  captionTracks?: CaptionTrack[];
}

/**
 * 直接从 ytInitialPlayerResponse 获取字幕的类
 * 避免依赖 webRequest API 和二次网络请求
 */
export class SubtitleDirectFetcher {
  /**
   * 从 window.ytInitialPlayerResponse 获取字幕URL
   */
  private getYtInitialPlayerResponse(): any {
    try {
      // 尝试从全局变量获取
      const ytInitialPlayerResponse = (window as any).ytInitialPlayerResponse;
      if (ytInitialPlayerResponse) {
        return ytInitialPlayerResponse;
      }

      // 尝试从页面脚本中解析
      const scripts = document.getElementsByTagName("script");
      for (const script of scripts) {
        const content = script.textContent || script.innerText;
        if (content.includes("ytInitialPlayerResponse")) {
          const match = content.match(
            /ytInitialPlayerResponse\s*[:=]\s*({.+?});/
          );
          if (match) {
            return JSON.parse(match[1]);
          }
        }
      }

      return null;
    } catch (error) {
      console.error("解析 ytInitialPlayerResponse 失败:", error);
      return null;
    }
  }

  /**
   * 获取可用的字幕轨道
   */
  private getCaptionTracks(): CaptionTrack[] {
    const playerResponse = this.getYtInitialPlayerResponse();
    if (!playerResponse || !playerResponse.captions) {
      console.log("未找到 captions 数据");
      return [];
    }

    const captionsData: CaptionsData =
      playerResponse.captions.playerCaptionsTracklistRenderer;
    if (!captionsData || !captionsData.captionTracks) {
      console.log("未找到 captionTracks 数据");
      return [];
    }

    console.log("找到字幕轨道:", captionsData.captionTracks.length, "条");
    return captionsData.captionTracks;
  }

  /**
   * 获取目标语言的字幕URL
   * @param preferredLanguages 首选语言列表，按优先级排序
   */
  private getSubtitleUrl(preferredLanguages: string[] = ["en"]): string | null {
    const captionTracks = this.getCaptionTracks();
    if (captionTracks.length === 0) {
      return null;
    }

    // 记录所有可用的字幕轨道
    console.log(
      "可用字幕轨道:",
      captionTracks.map((track) => ({
        language: track.languageCode,
        name: track.name.simpleText,
        kind: track.kind,
        vssId: track.vssId,
      }))
    );

    // 按优先级查找字幕
    for (const preferredLang of preferredLanguages) {
      const track = captionTracks.find(
        (track) =>
          track.languageCode === preferredLang ||
          track.languageCode.startsWith(preferredLang + "-") ||
          track.vssId.includes(preferredLang)
      );

      if (track) {
        console.log("选择字幕轨道:", {
          language: track.languageCode,
          name: track.name.simpleText,
          url: track.baseUrl,
        });
        return track.baseUrl;
      }
    }

    // 如果没有找到首选语言，返回第一个可用的字幕
    const firstTrack = captionTracks[0];
    console.log("使用默认字幕轨道:", {
      language: firstTrack.languageCode,
      name: firstTrack.name.simpleText,
      url: firstTrack.baseUrl,
    });

    return firstTrack.baseUrl;
  }

  /**
   * 直接获取字幕内容
   * @param preferredLanguages 首选语言列表
   * @returns 解析后的字幕数据
   */
  public async fetchSubtitles(
    preferredLanguages?: string[]
  ): Promise<SubtitleItem[]> {
    console.log("🎯 开始通过 ytInitialPlayerResponse 获取字幕...");

    const subtitleUrl = this.getSubtitleUrl(preferredLanguages);
    if (!subtitleUrl) {
      throw new Error("未找到可用的字幕轨道");
    }

    console.log("📡 获取字幕内容:", subtitleUrl);

    try {
      const response = await fetch(subtitleUrl);
      if (!response.ok) {
        throw new Error(
          `字幕请求失败: ${response.status} ${response.statusText}`
        );
      }

      const content = await response.text();
      console.log("📄 字幕内容长度:", content.length);

      // 解析字幕内容
      const subtitles = await parseSubtitleContent(content);
      console.log("✅ 成功解析字幕数量:", subtitles.length);

      return subtitles;
    } catch (error) {
      console.error("❌ 获取字幕失败:", error);
      throw error;
    }
  }

  /**
   * 检查是否可以使用直接获取方式
   */
  public canFetchDirectly(): boolean {
    const playerResponse = this.getYtInitialPlayerResponse();
    return !!(playerResponse && playerResponse.captions);
  }

  /**
   * 获取当前视频ID
   */
  public getCurrentVideoId(): string | null {
    try {
      const playerResponse = this.getYtInitialPlayerResponse();
      return playerResponse?.videoDetails?.videoId || null;
    } catch (error) {
      console.error("获取视频ID失败:", error);
      return null;
    }
  }
}

// 导出单例实例
export const subtitleDirectFetcher = new SubtitleDirectFetcher();
