/**
 * @purpose 所选麦克风的实时输入电平（0~1）。
 * @role    header 麦克风菜单展开时给出说话反馈。
 * @deps    getUserMedia、Web Audio AnalyserNode
 * @gotcha  只在 enabled 时开流，用完必须关闭 track，否则浏览器录音指示灯不灭
 */
import { useEffect, useState } from "react";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export const useAudioInputLevel = (
  selectedDeviceId: string,
  enabled: boolean
) => {
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !navigator.mediaDevices?.getUserMedia) {
      setLevel(0);
      return;
    }

    let disposed = false;
    let animationFrameId: number | null = null;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;

    const cleanup = () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      stream?.getTracks().forEach((track) => track.stop());
      stream = null;

      if (audioContext) {
        void audioContext.close();
        audioContext = null;
      }

      analyser = null;
      setLevel(0);
    };

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...(selectedDeviceId
              ? {
                  deviceId: { exact: selectedDeviceId },
                }
              : {}),
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        if (disposed) {
          cleanup();
          return;
        }

        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);

        const sampleBuffer = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (disposed || !analyser) {
            return;
          }

          analyser.getByteTimeDomainData(sampleBuffer);
          let sumSquares = 0;
          for (const sample of sampleBuffer) {
            const centered = (sample - 128) / 128;
            sumSquares += centered * centered;
          }

          const rms = Math.sqrt(sumSquares / sampleBuffer.length);
          setLevel(clamp(rms * 3.5));
          animationFrameId = window.requestAnimationFrame(tick);
        };

        setError(null);
        tick();
      } catch (nextError) {
        if (!disposed) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to monitor microphone level"
          );
          setLevel(0);
        }
      }
    };

    void start();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [enabled, selectedDeviceId]);

  return { level, error };
};
