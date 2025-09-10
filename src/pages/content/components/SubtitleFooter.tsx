import { Button, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";
import React, { FC, useState, useCallback, useEffect, useRef } from "react";
import { useAudioRecording } from "../hooks/useAudioRecording";
import { SubtitleItem } from "../lib/subtitles/subtitleTypes";
import { youtubeController } from "../lib/youtubeController";

interface SubtitleFooterProps {
  currentSubtitle: SubtitleItem | null;
  isActive: boolean;
  isLooping: boolean;
  onToggleLoop: () => void;
}

export const SubtitleFooter: FC<SubtitleFooterProps> = ({
  currentSubtitle,
  isActive,
  isLooping,
  onToggleLoop,
}) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const playStateCleanup = useRef<(() => void) | null>(null);
  const {
    isRecording,
    isPlaying,
    hasRecording,
    duration,
    error,
    startRecording,
    stopRecording,
    playRecording,
    pauseRecording,
    clearRecording,
  } = useAudioRecording();

  // 监听视频播放状态变化
  useEffect(() => {
    if (playStateCleanup.current) {
      playStateCleanup.current();
    }

    const cleanup = youtubeController.setupPlayStateListener(
      () => setIsVideoPlaying(true),
      () => setIsVideoPlaying(false)
    );

    playStateCleanup.current = cleanup;

    // 初始状态检查
    setIsVideoPlaying(youtubeController.isPlaying());

    return () => {
      if (playStateCleanup.current) {
        playStateCleanup.current();
        playStateCleanup.current = null;
      }
    };
  }, []);

  // 播放当前字幕片段
  const playCurrentSubtitle = useCallback(() => {
    if (!currentSubtitle) return;

    youtubeController.seekToTime(currentSubtitle.startTime);
    youtubeController.play();
  }, [currentSubtitle]);

  // 暂停视频
  const pauseCurrentVideo = useCallback(() => {
    youtubeController.pause();
  }, []);

  // 播放/暂停视频片段
  const toggleVideoPlayback = useCallback(() => {
    if (isVideoPlaying) {
      pauseCurrentVideo();
    } else {
      playCurrentSubtitle();
    }
  }, [isVideoPlaying, playCurrentSubtitle, pauseCurrentVideo]);

  // 切换循环播放状态
  const handleToggleLoop = useCallback(() => {
    onToggleLoop();
  }, [onToggleLoop]);

  // 录音按钮点击处理
  const handleRecordingToggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // 播放录音按钮点击处理
  const handlePlaybackToggle = useCallback(() => {
    if (isPlaying) {
      pauseRecording();
    } else {
      playRecording();
    }
  }, [isPlaying, playRecording, pauseRecording]);

  // 格式化录音时长
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // 如果没有当前字幕则不显示
  if (!currentSubtitle || !isActive) {
    return null;
  }

  return (
    <div
      className="w-full bg-content1 border-t border-default-200"
      data-loop-state={isLooping}
    >
      <Divider />
      <div className="p-4 space-y-3">
        {/* 字幕信息 */}
        <div className="text-center">
          <p className="text-sm text-default-600 mb-1">Current Subtitle</p>
          <p className="text-xs font-mono text-default-500">
            {Math.floor(currentSubtitle.startTime / 60)}:
            {Math.floor(currentSubtitle.startTime % 60)
              .toString()
              .padStart(2, "0")}{" "}
            - {Math.floor(currentSubtitle.endTime / 60)}:
            {Math.floor(currentSubtitle.endTime % 60)
              .toString()
              .padStart(2, "0")}
          </p>
          <p className="text-sm mt-1 line-clamp-2">{currentSubtitle.text}</p>
        </div>

        {/* 字幕播放控制 */}
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="flat"
            color="primary"
            startContent={
              <Icon
                icon={isVideoPlaying ? "mdi:pause" : "mdi:play"}
                className="w-4 h-4"
              />
            }
            onPressStart={toggleVideoPlayback}
          >
            {isVideoPlaying ? "Pause" : "Play Segment"}
          </Button>
          <Button
            size="sm"
            variant={isLooping ? "solid" : "flat"}
            color={isLooping ? "secondary" : "default"}
            startContent={
              <Icon
                icon={isLooping ? "mdi:repeat" : "mdi:repeat-off"}
                className="w-4 h-4"
              />
            }
            onPressStart={handleToggleLoop}
          >
            {isLooping ? "Stop Loop" : "Loop Play"}
          </Button>
        </div>

        <Divider />

        {/* 录音控制 */}
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Button
              size="sm"
              variant={isRecording ? "solid" : "flat"}
              color={isRecording ? "danger" : "default"}
              startContent={
                <Icon
                  icon={isRecording ? "mdi:stop" : "mdi:microphone"}
                  className="w-4 h-4"
                />
              }
              onPressStart={handleRecordingToggle}
            >
              {isRecording ? "Stop Recording" : "Start Recording"}
            </Button>

            {hasRecording && (
              <>
                <Button
                  size="sm"
                  variant="flat"
                  color="success"
                  startContent={
                    <Icon
                      icon={isPlaying ? "mdi:pause" : "mdi:play"}
                      className="w-4 h-4"
                    />
                  }
                  onPressStart={handlePlaybackToggle}
                  isDisabled={isRecording}
                >
                  {isPlaying ? "Pause" : "Play"}
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  color="danger"
                  startContent={<Icon icon="mdi:delete" className="w-4 h-4" />}
                  onPressStart={clearRecording}
                  isDisabled={isRecording || isPlaying}
                >
                  Clear
                </Button>
              </>
            )}
          </div>

          {/* 录音状态信息 */}
          {hasRecording && (
            <div className="text-center">
              <p className="text-xs text-default-500">
                Recording Duration: {formatDuration(duration)}
              </p>
            </div>
          )}

          {error && (
            <div className="text-center">
              <p className="text-xs text-danger">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
