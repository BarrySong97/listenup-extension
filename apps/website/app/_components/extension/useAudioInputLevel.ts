/**
 * @purpose 麦克风电平的空桩（恒为 0）。
 * @role    同上，避免官网请求麦克风。
 * @deps    无
 * @gotcha  保持为桩
 */
"use client";
export function useAudioInputLevel(_deviceId: string, _active: boolean) {
  return { level: 0 };
}
