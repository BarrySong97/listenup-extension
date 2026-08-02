/**
 * @purpose 字幕条目与解析中间结构的类型定义。
 * @role    纯逻辑层与 UI 共用的基础类型。
 * @deps    无
 * @gotcha  originalSubtitles 保存合并前的原始条目，下游展示/导出可能依赖它
 */
export interface SubtitleItem {
  id: number | string;
  startTime: number;
  endTime: number;
  text: string;
  // 可选：保存原始字幕信息（用于合并后的字幕）
  originalSubtitles?: Array<{
    id: number | string;
    startTime: number;
    endTime: number;
    text: string;
  }>;
}

export interface ParsedSubtitleData {
  events?: Array<{
    tStartMs?: number;
    dDurationMs?: number;
    segs?: Array<{
      utf8?: string;
    }>;
  }>;
}