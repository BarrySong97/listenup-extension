/**
 * @purpose 演示用的字幕条目类型（扩展类型的精简副本）。
 * @role    本目录组件共用。
 * @deps    无
 * @gotcha  只保留了 id/起止时间/文本，没有扩展版的 originalSubtitles
 */
export interface SubtitleItem {
  id: number | string;
  startTime: number;
  endTime: number;
  text: string;
}
