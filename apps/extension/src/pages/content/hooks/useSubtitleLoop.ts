import { useCallback, useRef, useState } from "react";
import { SubtitleItem } from "../lib/subtitles/subtitleTypes";
import { youtubeSDK } from "../lib/youtube-sdk";

export const useSubtitleLoop = () => {
  const [isLooping, setIsLooping] = useState(false);
  const loopTargetSubtitle = useRef<SubtitleItem | null>(null);
  const loopCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // 检查视频是否播放超出字幕范围
  const checkVideoTime = useCallback(() => {
    if (!loopTargetSubtitle.current) return;

    const player = youtubeSDK.getPlayerFacade();
    const currentTime = player.getCurrentTime();
    const subtitle = loopTargetSubtitle.current;

    // 如果视频播放超出字幕结束时间，立即跳回字幕开始
    if (currentTime >= subtitle.endTime) {
      player.seekTo(subtitle.startTime);
      player.play();
    }
  }, []);

  // 启动循环播放监控
  const startLoopMonitoring = useCallback(
    (subtitle: SubtitleItem) => {
      // 设置循环目标字幕
      loopTargetSubtitle.current = subtitle;

      // 清理现有监控
      if (loopCheckInterval.current) {
        clearInterval(loopCheckInterval.current);
      }

      // 每100ms检查一次视频时间
      loopCheckInterval.current = setInterval(() => {
        const videoPlaying = youtubeSDK.getPlayerFacade().isPlaying();

        if (videoPlaying) {
          checkVideoTime();
        }
      }, 100);
    },
    [checkVideoTime]
  );

  // 停止循环播放监控
  const stopLoopMonitoring = useCallback(() => {
    if (loopCheckInterval.current) {
      clearInterval(loopCheckInterval.current);
      loopCheckInterval.current = null;
    }
    loopTargetSubtitle.current = null;
  }, []);

  // 开始循环播放
  const startLooping = useCallback(
    (subtitle: SubtitleItem) => {
      const player = youtubeSDK.getPlayerFacade();
      setIsLooping(true);

      // 立即播放一次
      player.seekTo(subtitle.startTime);
      player.play();

      // 开始循环监控
      startLoopMonitoring(subtitle);
    },
    [startLoopMonitoring]
  );

  // 停止循环播放
  const stopLooping = useCallback(() => {
    setIsLooping(false);
    stopLoopMonitoring();
    youtubeSDK.getPlayerFacade().pause();
  }, [stopLoopMonitoring]);

  // 切换循环播放状态
  const toggleLooping = useCallback(
    (currentSubtitle: SubtitleItem | null) => {
      if (!currentSubtitle) return;

      if (isLooping) {
        stopLooping();
      } else {
        startLooping(currentSubtitle);
      }
    },
    [isLooping, startLooping, stopLooping]
  );

  // 清理函数
  const cleanup = useCallback(() => {
    stopLoopMonitoring();
  }, [stopLoopMonitoring]);

  return {
    isLooping,
    toggleLooping,
    cleanup,
  };
};
