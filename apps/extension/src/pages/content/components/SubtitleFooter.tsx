/**
 * @purpose 面板底部：当前句时间、循环开关与录音控制。
 * @role    SubtitlePanelShell 的底部区域。
 * @deps    hooks/useAudioRecording、@heroui/react
 * @gotcha  录音是多 take 的，播放优先命中最新一段
 */
import { Icon } from "@iconify/react";
import { Button } from "@heroui/react";
import { iconScale } from "@src/components/ui/iconScale";
import React, { FC, useCallback } from "react";
import { useAudioRecording } from "../hooks/useAudioRecording";
import { SubtitleItem } from "../lib/subtitles/subtitleTypes";

interface SubtitleFooterProps {
  currentSubtitle: SubtitleItem | null;
  isActive: boolean;
  isLooping: boolean;
  onToggleLoop: () => void;
  isSegmentPlaying: boolean;
  selectedDeviceId: string;
}

const formatClock = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};

export const SubtitleFooter: FC<SubtitleFooterProps> = ({
  currentSubtitle,
  isActive,
  isLooping,
  onToggleLoop,
  isSegmentPlaying,
  selectedDeviceId,
}) => {
  const {
    isRecording,
    isPlaying,
    hasRecording,
    recordingCount,
    duration,
    error,
    startRecording,
    stopRecording,
    playRecording,
    pauseRecording,
    clearRecording,
  } = useAudioRecording(selectedDeviceId);

  const handlePrimaryRecordingAction = useCallback(() => {
    if (isRecording) {
      stopRecording();
      return;
    }

    startRecording();
  }, [isRecording, startRecording, stopRecording]);

  if (!currentSubtitle) {
    return null;
  }

  const recordingIcon = isRecording ? "mdi:stop" : "mdi:microphone-outline";
  const playbackIcon = isPlaying ? "mdi:pause" : "mdi:play";

  return (
    <div className="shrink-0 border-t border-zinc-200 bg-zinc-50/95 px-3 pb-3 pt-3 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <Button
          isIconOnly
          size="md"
          variant="flat"
          color="default"
          className={`flex h-11 flex-1 items-center justify-center rounded-md transition-colors ${
            isLooping
              ? "bg-zinc-200 text-zinc-900"
              : "bg-zinc-200/50 text-zinc-700 hover:bg-zinc-200"
          }`}
          onPressStart={onToggleLoop}
          aria-label={isLooping ? "Disable loop playback" : "Enable loop playback"}
        >
          <Icon
            icon={isLooping ? "mdi:repeat-once" : "mdi:repeat-once"}
            className={iconScale.primaryControl}
          />
        </Button>
        <Button
          isIconOnly
          size="md"
          variant="flat"
          color={isRecording ? "danger" : "primary"}
          className={`flex h-11 flex-1 items-center justify-center rounded-md border transition-colors ${
            isRecording
              ? "border-red-200 bg-red-50 text-red-600"
              : hasRecording
              ? "border-blue-200/50 bg-blue-100 text-blue-700"
              : "border-blue-200/50 bg-blue-50 text-blue-600 hover:bg-blue-100"
          }`}
          onPressStart={handlePrimaryRecordingAction}
          aria-label="Recording action"
        >
          <Icon icon={recordingIcon} className={iconScale.primaryControl} />
        </Button>
      </div>

      {hasRecording && !isRecording && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Button
            size="sm"
            variant="flat"
            color="default"
            className="h-9 gap-1.5 rounded-md bg-zinc-200/70 text-xs font-semibold text-zinc-700 hover:bg-zinc-200"
            onPressStart={isPlaying ? pauseRecording : playRecording}
          >
            <Icon icon={playbackIcon} className={iconScale.secondaryAction} />
            {isPlaying ? "Pause" : "Play"}
          </Button>
          <Button
            size="sm"
            variant="flat"
            color="danger"
            className="h-9 gap-1.5 rounded-md bg-red-50 text-xs font-semibold text-red-600 hover:bg-red-100"
            onPressStart={clearRecording}
          >
            <Icon
              icon="mdi:delete-outline"
              className={iconScale.secondaryAction}
            />
            Delete
          </Button>
          <Button
            size="sm"
            variant="flat"
            color="primary"
            className="h-9 gap-1.5 rounded-md bg-blue-50 text-xs font-semibold text-blue-600 hover:bg-blue-100"
            onPressStart={startRecording}
          >
            <Icon
              icon="mdi:microphone-plus"
              className={iconScale.secondaryAction}
            />
            Continue
          </Button>
        </div>
      )}

      {(hasRecording || error) && (
        <div className="mt-2 flex items-center justify-between px-0.5 text-[10px]">
          <span className="text-zinc-400">
            {hasRecording || isRecording
              ? `${recordingCount > 1 ? `${recordingCount} takes · ` : ""}${formatClock(
                  duration
                )}`
              : ""}
          </span>
          <span className="text-zinc-400">
            {isRecording
              ? "Recording"
              : isSegmentPlaying
              ? "Segment Playing"
              : ""}
          </span>
          {error ? <span className="text-red-500">{error}</span> : null}
        </div>
      )}
    </div>
  );
};
