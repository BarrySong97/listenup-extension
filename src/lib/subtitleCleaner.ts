import { SubtitleItem } from './subtitleTypes';

export interface CleanConfig {
  // 是否移除括号内容 (xxx)
  removeBracketContent: boolean;
  // 是否移除音乐符号
  removeMusicNotations: boolean;
  // 是否移除前导破折号
  removeLeadingDashes: boolean;
  // 是否移除空字幕
  removeEmptySubtitles: boolean;
  // 最小字幕长度（字符数）
  minTextLength: number;
}

const DEFAULT_CONFIG: CleanConfig = {
  removeBracketContent: true,
  removeMusicNotations: true,
  removeLeadingDashes: true,
  removeEmptySubtitles: true,
  minTextLength: 2
};

/**
 * 字幕清理器
 * 移除语气词、音乐杂音、破折号等无用内容
 */
export class SubtitleCleaner {
  private config: CleanConfig;

  // 括号内容模式 - 移除 (xxx) 这种括号内的所有内容
  private readonly bracketPatterns = [
    /\([^)]*\)/g,  // 圆括号 (xxx)
    /\[[^\]]*\]/g, // 方括号 [xxx] 
    /\{[^}]*\}/g,  // 花括号 {xxx}
    /（[^）]*）/g,  // 中文圆括号 （xxx）
    /【[^】]*】/g   // 中文方括号 【xxx】
  ];

  // 音乐和杂音模式
  private readonly musicPatterns = [
    // 音乐符号
    /♪|♫|♬|♩|♭|♯|🎵|🎶/g,
    // 音乐描述
    /\[music\]|\[音乐\]|\(music\)|\(音乐\)/gi,
    /\[singing\]|\[歌声\]|\(singing\)|\(歌声\)/gi,
    /\[instrumental\]|\[纯音乐\]|\(instrumental\)|\(纯音乐\)/gi,
    /\[applause\]|\[掌声\]|\(applause\)|\(掌声\)/gi,
    /\[laughter\]|\[笑声\]|\(laughter\)|\(笑声\)/gi,
    /\[noise\]|\[杂音\]|\(noise\)|\(杂音\)/gi,
    // 背景音描述
    /\[background.*?\]/gi,
    /\[背景.*?\]/gi,
    /\(background.*?\)/gi,
    /\(背景.*?\)/gi
  ];

  // 破折号模式
  private readonly dashPatterns = [
    /^-+\s*/,  // 开头的破折号
    /^—+\s*/,  // 开头的em dash
    /^–+\s*/   // 开头的en dash
  ];

  constructor(config: Partial<CleanConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 清理字幕数组
   */
  public cleanSubtitles(subtitles: SubtitleItem[]): SubtitleItem[] {
    if (subtitles.length === 0) return subtitles;

    const cleaned = subtitles
      .map(subtitle => this.cleanSubtitle(subtitle))
      .filter(subtitle => this.shouldKeepSubtitle(subtitle));

    return cleaned;
  }

  /**
   * 清理单个字幕
   */
  private cleanSubtitle(subtitle: SubtitleItem): SubtitleItem {
    let cleanedText = subtitle.text;

    // 移除前导破折号
    if (this.config.removeLeadingDashes) {
      cleanedText = this.removeLeadingDashes(cleanedText);
    }

    // 移除音乐符号和描述
    if (this.config.removeMusicNotations) {
      cleanedText = this.removeMusicNotations(cleanedText);
    }

    // 移除括号内容（语气词、杂音等）
    if (this.config.removeBracketContent) {
      cleanedText = this.removeBracketContent(cleanedText);
    }

    // 清理多余空格和标点
    cleanedText = this.normalizeWhitespace(cleanedText);

    return {
      ...subtitle,
      text: cleanedText
    };
  }

  /**
   * 移除前导破折号
   */
  private removeLeadingDashes(text: string): string {
    let result = text;
    for (const pattern of this.dashPatterns) {
      result = result.replace(pattern, '');
    }
    return result;
  }

  /**
   * 移除音乐符号和描述
   */
  private removeMusicNotations(text: string): string {
    let result = text;
    for (const pattern of this.musicPatterns) {
      result = result.replace(pattern, '');
    }
    return result;
  }

  /**
   * 移除括号内容
   */
  private removeBracketContent(text: string): string {
    let result = text;
    for (const pattern of this.bracketPatterns) {
      result = result.replace(pattern, '');
    }
    return result;
  }

  /**
   * 标准化空白字符
   */
  private normalizeWhitespace(text: string): string {
    return text
      .replace(/\s+/g, ' ')  // 多个空格合并为一个
      .replace(/^\s+|\s+$/g, '')  // 去除首尾空格
      .replace(/\s+([,.!?;:])/g, '$1')  // 标点前的空格
      .replace(/([,.!?;:])\s*([,.!?;:])/g, '$1$2'); // 连续标点
  }

  /**
   * 判断是否应该保留字幕
   */
  private shouldKeepSubtitle(subtitle: SubtitleItem): boolean {
    // 移除空字幕
    if (this.config.removeEmptySubtitles && !subtitle.text.trim()) {
      return false;
    }

    // 检查最小长度
    if (subtitle.text.trim().length < this.config.minTextLength) {
      return false;
    }

    // 检查是否只包含标点符号
    if (/^[^\w\u4e00-\u9fff]*$/.test(subtitle.text)) {
      return false;
    }

    return true;
  }

  /**
   * 获取清理统计信息
   */
  public getCleanStats(original: SubtitleItem[], cleaned: SubtitleItem[]): {
    originalCount: number;
    cleanedCount: number;
    removedCount: number;
    removalPercentage: number;
    textReductionPercentage: number;
  } {
    const originalCount = original.length;
    const cleanedCount = cleaned.length;
    const removedCount = originalCount - cleanedCount;
    const removalPercentage = originalCount > 0 ? (removedCount / originalCount) * 100 : 0;

    const originalTextLength = original.reduce((sum, item) => sum + item.text.length, 0);
    const cleanedTextLength = cleaned.reduce((sum, item) => sum + item.text.length, 0);
    const textReductionPercentage = originalTextLength > 0 
      ? ((originalTextLength - cleanedTextLength) / originalTextLength) * 100 
      : 0;

    return {
      originalCount,
      cleanedCount,
      removedCount,
      removalPercentage: Math.round(removalPercentage * 100) / 100,
      textReductionPercentage: Math.round(textReductionPercentage * 100) / 100
    };
  }
}

// 导出默认实例
export const subtitleCleaner = new SubtitleCleaner();