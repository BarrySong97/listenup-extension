import { useCallback, useEffect, useRef, useState } from "react";

interface RecordingClip {
  blob: Blob;
  url: string;
  duration: number;
}

export interface RecordingState {
  isRecording: boolean;
  isPlaying: boolean;
  clips: RecordingClip[];
  duration: number;
  error: string | null;
}

const RECORDING_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

const getSupportedMimeType = () => {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  return (
    RECORDING_MIME_TYPES.find((mimeType) =>
      MediaRecorder.isTypeSupported(mimeType)
    ) ?? ""
  );
};

const sumDurations = (clips: RecordingClip[]) =>
  clips.reduce((total, clip) => total + clip.duration, 0);

export const useAudioRecording = (selectedDeviceId?: string) => {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPlaying: false,
    clips: [],
    duration: 0,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const clipsRef = useRef<RecordingClip[]>([]);
  const startTimeRef = useRef(0);
  const durationTimerRef = useRef<number | null>(null);
  const playbackIndexRef = useRef(0);

  const clearDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      window.clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  const stopActiveStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const disposeAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.onplay = null;
    audio.onpause = null;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audioRef.current = null;
  }, []);

  useEffect(() => {
    clipsRef.current = state.clips;
  }, [state.clips]);

  const playClipAtIndex = useCallback(
    (index: number) => {
      const clip = clipsRef.current[index];
      if (!clip) {
        playbackIndexRef.current = 0;
        setState((prev) => ({ ...prev, isPlaying: false }));
        return;
      }

      disposeAudio();

      const audio = new Audio(clip.url);
      playbackIndexRef.current = index;
      audioRef.current = audio;

      audio.onplay = () => {
        setState((prev) => ({ ...prev, isPlaying: true, error: null }));
      };

      audio.onpause = () => {
        setState((prev) => ({ ...prev, isPlaying: false }));
      };

      audio.onended = () => {
        const nextIndex = playbackIndexRef.current + 1;
        if (nextIndex < clipsRef.current.length) {
          playClipAtIndex(nextIndex);
          return;
        }

        audioRef.current = null;
        playbackIndexRef.current = 0;
        setState((prev) => ({ ...prev, isPlaying: false }));
      };

      audio.onerror = () => {
        audioRef.current = null;
        playbackIndexRef.current = 0;
        setState((prev) => ({
          ...prev,
          isPlaying: false,
          error: "Audio playback failed",
        }));
      };

      audio.play().catch(() => {
        audioRef.current = null;
        playbackIndexRef.current = 0;
        setState((prev) => ({
          ...prev,
          isPlaying: false,
          error: "Unable to start playback",
        }));
      });
    },
    [disposeAudio]
  );

  const startRecording = useCallback(async () => {
    if (state.isRecording) {
      return;
    }

    try {
      audioRef.current?.pause();
      clearDurationTimer();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(selectedDeviceId
            ? {
                deviceId: { exact: selectedDeviceId },
              }
            : {}),
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      const mimeType = getSupportedMimeType();
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      streamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      const baseDuration = clipsRef.current.length
        ? sumDurations(clipsRef.current)
        : 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        clearDurationTimer();
        stopActiveStream();
        mediaRecorderRef.current = null;

        const clipDuration = (Date.now() - startTimeRef.current) / 1000;
        const nextDuration = baseDuration + clipDuration;

        if (chunksRef.current.length === 0) {
          setState((prev) => ({
            ...prev,
            isRecording: false,
            duration: baseDuration,
          }));
          return;
        }

        const blob = new Blob(chunksRef.current, {
          type: mimeType || chunksRef.current[0]?.type || "audio/webm",
        });
        const clip: RecordingClip = {
          blob,
          url: URL.createObjectURL(blob),
          duration: clipDuration,
        };

        setState((prev) => {
          const clips = [...prev.clips, clip];
          return {
            ...prev,
            clips,
            duration: nextDuration,
            isRecording: false,
            error: null,
          };
        });
      };

      mediaRecorder.onerror = () => {
        clearDurationTimer();
        stopActiveStream();
        mediaRecorderRef.current = null;
        setState((prev) => ({
          ...prev,
          isRecording: false,
          isPlaying: false,
          duration: baseDuration,
          error: "Recording failed",
        }));
      };

      durationTimerRef.current = window.setInterval(() => {
        setState((prev) =>
          prev.isRecording
            ? {
                ...prev,
                duration: baseDuration + (Date.now() - startTimeRef.current) / 1000,
              }
            : prev
        );
      }, 100);

      mediaRecorder.start(100);

      setState((prev) => ({
        ...prev,
        isRecording: true,
        isPlaying: false,
        duration: baseDuration,
        error: null,
      }));
    } catch (error) {
      stopActiveStream();
      clearDurationTimer();
      setState((prev) => ({
        ...prev,
        isRecording: false,
        error: error instanceof Error ? error.message : "Unable to start recording",
      }));
    }
  }, [
    clearDurationTimer,
    selectedDeviceId,
    state.isRecording,
    stopActiveStream,
  ]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !state.isRecording) {
      return;
    }

    mediaRecorderRef.current.stop();
  }, [state.isRecording]);

  const playRecording = useCallback(() => {
    if (!clipsRef.current.length) {
      return;
    }

    if (audioRef.current?.paused) {
      audioRef.current.play().catch(() => {
        setState((prev) => ({
          ...prev,
          isPlaying: false,
          error: "Unable to resume playback",
        }));
      });
      return;
    }

    playClipAtIndex(playbackIndexRef.current);
  }, [playClipAtIndex]);

  const pauseRecording = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const clearRecording = useCallback(() => {
    clearDurationTimer();
    disposeAudio();

    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.onerror = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    stopActiveStream();
    clipsRef.current.forEach((clip) => URL.revokeObjectURL(clip.url));
    clipsRef.current = [];
    playbackIndexRef.current = 0;
    chunksRef.current = [];

    setState({
      isRecording: false,
      isPlaying: false,
      clips: [],
      duration: 0,
      error: null,
    });
  }, [clearDurationTimer, disposeAudio, state.isRecording, stopActiveStream]);

  useEffect(() => {
    return () => {
      clearDurationTimer();
      disposeAudio();
      stopActiveStream();
      clipsRef.current.forEach((clip) => URL.revokeObjectURL(clip.url));
    };
  }, [clearDurationTimer, disposeAudio, stopActiveStream]);

  return {
    ...state,
    hasRecording: state.clips.length > 0,
    recordingCount: state.clips.length,
    startRecording,
    stopRecording,
    playRecording,
    pauseRecording,
    clearRecording,
  };
};
