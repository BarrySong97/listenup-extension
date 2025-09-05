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
  audioTracks?: Array<{
    captionTrackIndices: number[];
    defaultCaptionTrackIndex: number;
    hasDefaultTrack: boolean;
    captionsInitialState: string;
  }>;
  translationLanguages?: Array<{
    languageCode: string;
    languageName: { simpleText: string };
  }>;
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
        console.log("📊 从全局变量获取到 ytInitialPlayerResponse");
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
            console.log("📊 从页面脚本解析到 ytInitialPlayerResponse");
            return JSON.parse(match[1]);
          }
        }
      }

      console.log("⚠️ 未找到 ytInitialPlayerResponse");
      return null;
    } catch (error) {
      console.error("❌ 解析 ytInitialPlayerResponse 失败:", error);
      return null;
    }
  }

  /**
   * 获取可用的字幕轨道
   */
  private getCaptionTracks(): CaptionTrack[] {
    const playerResponse = this.getYtInitialPlayerResponse();
    if (!playerResponse || !playerResponse.captions) {
      console.log("未找到 captions 数据结构");
      return [];
    }

    const captionsData: CaptionsData =
      playerResponse.captions.playerCaptionsTracklistRenderer;
    if (!captionsData || !captionsData.captionTracks) {
      console.log("未找到 captionTracks 数组");
      return [];
    }

    console.log(`找到 ${captionsData.captionTracks.length} 个字幕轨道`);
    
    // 记录字幕初始状态
    if (captionsData.audioTracks && captionsData.audioTracks.length > 0) {
      const audioTrack = captionsData.audioTracks[0];
      console.log("字幕初始状态:", audioTrack.captionsInitialState);
      console.log("默认字幕轨道索引:", audioTrack.defaultCaptionTrackIndex);
    }

    return captionsData.captionTracks;
  }

  /**
   * 获取目标语言的字幕URL
   * @param preferredLanguages 首选语言列表，按优先级排序
   */
  private getSubtitleUrl(preferredLanguages: string[] = ["zh", "zh-CN", "en"]): string | null {
    const captionTracks = this.getCaptionTracks();
    if (captionTracks.length === 0) {
      console.log("⚠️ 没有可用的字幕轨道");
      return null;
    }

    // 记录所有可用的字幕轨道
    console.log("📋 可用字幕轨道:", captionTracks.map(track => ({
      language: track.languageCode,
      name: track.name.simpleText,
      vssId: track.vssId,
      isTranslatable: track.isTranslatable
    })));

    // 按优先级查找字幕
    for (const preferredLang of preferredLanguages) {
      const track = captionTracks.find(
        (track) =>
          track.languageCode === preferredLang ||
          track.languageCode.startsWith(preferredLang + "-") ||
          track.vssId.includes(preferredLang)
      );

      if (track) {
        console.log(`✅ 选中字幕轨道: ${track.name.simpleText} (${track.languageCode})`);
        return track.baseUrl;
      }
    }

    // 如果没有找到首选语言，返回第一个可用的字幕
    const firstTrack = captionTracks[0];
    console.log(`🔄 使用默认字幕轨道: ${firstTrack.name.simpleText} (${firstTrack.languageCode})`);

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
    console.log("🎯 开始直接获取字幕，首选语言:", preferredLanguages);
    
    const subtitleUrl = this.getSubtitleUrl(preferredLanguages);
    if (!subtitleUrl) {
      throw new Error("未找到可用的字幕轨道，可能用户未开启字幕");
    }

    console.log("📡 发起字幕请求:", subtitleUrl);

    try {
      const response = await fetch(subtitleUrl);
      if (!response.ok) {
        throw new Error(
          `字幕请求失败: ${response.status} ${response.statusText}`
        );
      }

      const content = await response.text();
      console.log("📄 字幕内容长度:", content.length, "字符");

      // 解析字幕内容
      const subtitles = await parseSubtitleContent(content);
      console.log("✅ 字幕解析成功，获得", subtitles.length, "条字幕");

      return subtitles;
    } catch (error) {
      console.error("❌ 直接获取字幕失败:", error);
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
