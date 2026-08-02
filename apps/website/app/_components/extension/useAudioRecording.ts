/**
 * @purpose 录音能力的空桩（所有操作都是空函数）。
 * @role    同上，避免官网请求麦克风。
 * @deps    无
 * @gotcha  保持为桩
 */
"use client";
export function useAudioRecording(_deviceId: string) {
  return { isRecording: false, isPlaying: false, hasRecording: false, recordingCount: 0, duration: 0, error: null, startRecording: () => {}, stopRecording: () => {}, playRecording: () => {}, pauseRecording: () => {}, clearRecording: () => {} };
}
