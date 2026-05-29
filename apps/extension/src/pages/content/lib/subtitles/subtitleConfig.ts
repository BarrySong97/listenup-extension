import { MergeConfig } from './subtitleMerger';
import { CleanConfig } from './subtitleCleaner';

/**
 * 字幕配置管理
 */
export class SubtitleConfig {
  private static readonly STORAGE_KEY = 'listenup_subtitle_config';

  // 默认配置
  private static readonly DEFAULT_MERGE_CONFIG: MergeConfig = {
    minDuration: 0.8,        // 小于0.8秒的字幕考虑合并
    maxGap: 0.5,            // 间隔小于0.5秒的字幕可以合并
    maxMergedDuration: 4.0,  // 合并后不超过4秒
    maxMergedTextLength: 100 // 合并后文本不超过100字符
  };

  private static readonly DEFAULT_CLEAN_CONFIG: CleanConfig = {
    removeBracketContent: true,  // 移除括号内容 (xxx)
    removeMusicNotations: true,  // 移除音乐符号
    removeLeadingDashes: true,   // 移除前导破折号
    removeEmptySubtitles: true,  // 移除空字幕
    minTextLength: 2             // 最小字符长度
  };

  /**
   * 获取合并配置
   */
  public static getMergeConfig(): MergeConfig {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const config = JSON.parse(stored);
        return { ...this.DEFAULT_MERGE_CONFIG, ...config.merge };
      }
    } catch (error) {
      console.warn('Failed to load subtitle config:', error);
    }
    return this.DEFAULT_MERGE_CONFIG;
  }

  /**
   * 获取清理配置
   */
  public static getCleanConfig(): CleanConfig {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const config = JSON.parse(stored);
        return { ...this.DEFAULT_CLEAN_CONFIG, ...config.clean };
      }
    } catch (error) {
      console.warn('Failed to load subtitle config:', error);
    }
    return this.DEFAULT_CLEAN_CONFIG;
  }

  /**
   * 保存合并配置
   */
  public static saveMergeConfig(config: Partial<MergeConfig>): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const currentConfig = stored ? JSON.parse(stored) : {};
      const newConfig = {
        ...currentConfig,
        merge: { ...this.DEFAULT_MERGE_CONFIG, ...currentConfig.merge, ...config }
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newConfig));
    } catch (error) {
      console.warn('Failed to save subtitle config:', error);
    }
  }

  /**
   * 保存清理配置
   */
  public static saveCleanConfig(config: Partial<CleanConfig>): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const currentConfig = stored ? JSON.parse(stored) : {};
      const newConfig = {
        ...currentConfig,
        clean: { ...this.DEFAULT_CLEAN_CONFIG, ...currentConfig.clean, ...config }
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newConfig));
    } catch (error) {
      console.warn('Failed to save subtitle config:', error);
    }
  }

  /**
   * 重置为默认配置
   */
  public static resetToDefault(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to reset subtitle config:', error);
    }
  }

  /**
   * 获取预设配置
   */
  public static getPresets(): Record<string, MergeConfig> {
    return {
      conservative: {
        minDuration: 0.5,
        maxGap: 0.3,
        maxMergedDuration: 3.0,
        maxMergedTextLength: 80
      },
      default: this.DEFAULT_MERGE_CONFIG,
      aggressive: {
        minDuration: 1.2,
        maxGap: 1.0,
        maxMergedDuration: 6.0,
        maxMergedTextLength: 150
      }
    };
  }
}

// 导出配置实例
export const subtitleConfig = SubtitleConfig;