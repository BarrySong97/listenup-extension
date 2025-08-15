import { SubtitleItem } from "./subtitleTypes";

export interface MergeConfig {
  // 最小字幕持续时间（秒）
  minDuration: number;
  // 字幕间最大间隔（秒），小于此值的字幕可以合并
  maxGap: number;
  // 合并后的最大持续时间（秒）
  maxMergedDuration: number;
  // 合并后的最大字符数
  maxMergedTextLength: number;
}

const DEFAULT_CONFIG: MergeConfig = {
  minDuration: 0.8, // 小于0.8秒的字幕考虑合并
  maxGap: 0.5, // 间隔小于0.5秒的字幕可以合并
  maxMergedDuration: 4.0, // 合并后不超过4秒
  maxMergedTextLength: 100, // 合并后文本不超过100字符
};

/**
 * 字幕合并器
 * 将持续时间过短或间隔很近的字幕合并成更长的字幕
 */
export class SubtitleMerger {
  private config: MergeConfig;

  constructor(config: Partial<MergeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 合并字幕数组
   */
  public mergeSubtitles(subtitles: SubtitleItem[]): SubtitleItem[] {
    if (subtitles.length === 0) return subtitles;

    const merged: SubtitleItem[] = [];
    let currentGroup: SubtitleItem[] = [subtitles[0]];

    for (let i = 1; i < subtitles.length; i++) {
      const current = subtitles[i];

      if (this.shouldMergeWithGroup(current, currentGroup)) {
        currentGroup.push(current);
      } else {
        // 完成当前组的合并
        merged.push(this.mergeGroup(currentGroup));
        currentGroup = [current];
      }
    }

    // 处理最后一组
    merged.push(this.mergeGroup(currentGroup));

    return merged;
  }

  /**
   * 判断当前字幕是否应该与现有组合并
   */
  private shouldMergeWithGroup(
    subtitle: SubtitleItem,
    group: SubtitleItem[]
  ): boolean {
    if (group.length === 0) return false;

    const lastInGroup = group[group.length - 1];
    const firstInGroup = group[0];

    // 检查时间间隔
    const gap = subtitle.startTime - lastInGroup.endTime;
    if (gap > this.config.maxGap) return false;

    // 检查合并后的持续时间
    const mergedDuration = subtitle.endTime - firstInGroup.startTime;
    if (mergedDuration > this.config.maxMergedDuration) return false;

    // 检查合并后的文本长度
    const mergedTextLength =
      group.reduce((acc, item) => acc + item.text.length, 0) +
      subtitle.text.length;
    if (mergedTextLength > this.config.maxMergedTextLength) return false;

    // 检查是否有字幕持续时间过短
    const hasShortSubtitle =
      group.some((item) => this.isShortSubtitle(item)) ||
      this.isShortSubtitle(subtitle);
    if (!hasShortSubtitle && gap > 0.1) return false; // 如果都不是短字幕且有明显间隔，不合并

    return true;
  }

  /**
   * 判断字幕是否过短
   */
  private isShortSubtitle(subtitle: SubtitleItem): boolean {
    return subtitle.endTime - subtitle.startTime < this.config.minDuration;
  }

  /**
   * 合并一组字幕
   */
  private mergeGroup(group: SubtitleItem[]): SubtitleItem {
    if (group.length === 1) return group[0];

    const first = group[0];
    const last = group[group.length - 1];

    // 合并文本，用空格分隔
    const mergedText = group
      .map((item) => item.text.trim())
      .filter((text) => text.length > 0)
      .join(" ");

    return {
      id: `merged_${first.id}_${last.id}`,
      startTime: first.startTime,
      endTime: last.endTime,
      text: mergedText,
      // 保留原始字幕信息用于调试
      originalSubtitles: group.map((item) => ({
        id: item.id,
        startTime: item.startTime,
        endTime: item.endTime,
        text: item.text,
      })),
    };
  }

  /**
   * 获取合并统计信息
   */
  public getMergeStats(
    original: SubtitleItem[],
    merged: SubtitleItem[]
  ): {
    originalCount: number;
    mergedCount: number;
    reductionPercentage: number;
    averageOriginalDuration: number;
    averageMergedDuration: number;
  } {
    const originalCount = original.length;
    const mergedCount = merged.length;
    const reductionPercentage =
      originalCount > 0
        ? ((originalCount - mergedCount) / originalCount) * 100
        : 0;

    const avgOriginalDuration =
      originalCount > 0
        ? original.reduce(
            (sum, item) => sum + (item.endTime - item.startTime),
            0
          ) / originalCount
        : 0;

    const avgMergedDuration =
      mergedCount > 0
        ? merged.reduce(
            (sum, item) => sum + (item.endTime - item.startTime),
            0
          ) / mergedCount
        : 0;

    return {
      originalCount,
      mergedCount,
      reductionPercentage: Math.round(reductionPercentage * 100) / 100,
      averageOriginalDuration: Math.round(avgOriginalDuration * 1000) / 1000,
      averageMergedDuration: Math.round(avgMergedDuration * 1000) / 1000,
    };
  }
}

// 导出默认实例
export const subtitleMerger = new SubtitleMerger();
