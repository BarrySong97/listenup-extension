"use client";
export function useAudioRecording(_deviceId: string) {
  return { isRecording: false, isPlaying: false, hasRecording: false, recordingCount: 0, duration: 0, error: null, startRecording: () => {}, stopRecording: () => {}, playRecording: () => {}, pauseRecording: () => {}, clearRecording: () => {} };
}
