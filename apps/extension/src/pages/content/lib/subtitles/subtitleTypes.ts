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