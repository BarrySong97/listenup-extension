/**
 * @purpose 为浏览器 session 产生只在新播放开始时递增的单调 playbackEpoch。
 * @role    Desktop 退出 EmbeddedSource 后区分旧 cursor 与新播放事件的纯状态机。
 * @deps    无
 * @gotcha  seek、周期 cursor 与同一播放过程不能递增；每个新 session 首次播放从 1 开始。
 */
export class PlaybackEpochTracker {
  private epoch = 0;
  private wasPlaying = false;

  update(isPlaying: boolean): number {
    if (isPlaying && !this.wasPlaying) this.epoch += 1;
    this.wasPlaying = isPlaying;
    return this.epoch;
  }

  current(): number {
    return this.epoch;
  }
}
