export interface SubtitleItem {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
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