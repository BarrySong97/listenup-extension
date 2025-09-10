import { useCallback } from "react";
import { SubtitleItem } from "../lib/subtitles/subtitleTypes";
import { youtubeController } from "../lib/youtubeController";

/**
 * 字幕导航逻辑钩子
 * 处理字幕点击跳转功能
 */
export const useSubtitleNavigation = (subtitles: SubtitleItem[]) => {
  const handleSubtitleClick = useCallback(
    (subtitle: SubtitleItem, index: number) => {
      const video = youtubeController.getVideoElement();
      if (!video) {
        console.error("跳转失败，无法找到视频元素");
        return;
      }

      // 保存当前播放状态
      const wasPlaying = !video.paused;

      // 暂停视频避免时差
      if (wasPlaying) {
        youtubeController.pause();
      }

      // 计算跳转时间 - 智能处理时间重叠问题
      let targetTime = subtitle.startTime;

      // 检查是否与前一个字幕有时间重叠
      if (index > 0) {
        const prevSubtitle = subtitles[index - 1];
        const timeDiff = subtitle.startTime - prevSubtitle.endTime;

        // 如果当前字幕开始时间等于或接近上一个字幕结束时间
        if (Math.abs(timeDiff) <= 0.001) {
          // 跳转到当前字幕开始后的安全位置，确保不会匹配到上一个字幕
          targetTime = subtitle.startTime + 0.01;
        } else if (timeDiff < 0.1 && timeDiff > 0) {
          // 如果间隔很小但不为0，跳转到中间位置
          targetTime = subtitle.startTime + timeDiff / 2 + 0.01;
        } else {
          // 正常情况，跳转到开始时间稍后
          targetTime = subtitle.startTime + 0.01;
        }
      } else {
        // 第一个字幕，直接跳转到开始时间
        targetTime = subtitle.startTime + 0.01;
      }

      // 跳转到目标时间
      const success = youtubeController.seekToTime(targetTime, 0);

      if (success) {
        // 恢复播放状态
        if (wasPlaying) {
          setTimeout(() => {
            youtubeController.play();
          }, 100); // 小延迟确保时间设置完成
        }
      } else {
        console.error("跳转失败");
      }
    },
    [subtitles]
  );

  return { handleSubtitleClick };
};
