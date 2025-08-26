import { useState, useRef, useCallback } from 'react';

export interface RecordingState {
  isRecording: boolean;
  isPlaying: boolean;
  audioBlob: Blob | null;
  audioUrl: string | null;
  duration: number;
  error: string | null;
}

export const useAudioRecording = () => {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPlaying: false,
    audioBlob: null,
    audioUrl: null,
    duration: 0,
    error: null
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  // 开始录音
  const startRecording = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      chunksRef.current = [];
      startTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const duration = (Date.now() - startTimeRef.current) / 1000;

        setState(prev => ({
          ...prev,
          audioBlob,
          audioUrl,
          duration,
          isRecording: false
        }));

        // 停止所有音频轨道
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100); // 每100ms收集一次数据
      mediaRecorderRef.current = mediaRecorder;

      setState(prev => ({
        ...prev,
        isRecording: true,
        audioBlob: null,
        audioUrl: null,
        duration: 0
      }));

    } catch (error) {
      console.error('录音启动失败:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '录音启动失败'
      }));
    }
  }, []);

  // 停止录音
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [state.isRecording]);

  // 播放录音
  const playRecording = useCallback(() => {
    if (!state.audioUrl) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(state.audioUrl);
    audioRef.current = audio;

    audio.onplay = () => {
      setState(prev => ({ ...prev, isPlaying: true }));
    };

    audio.onpause = () => {
      setState(prev => ({ ...prev, isPlaying: false }));
    };

    audio.onended = () => {
      setState(prev => ({ ...prev, isPlaying: false }));
      audioRef.current = null;
    };

    audio.onerror = (error) => {
      console.error('音频播放失败:', error);
      setState(prev => ({
        ...prev,
        isPlaying: false,
        error: '音频播放失败'
      }));
      audioRef.current = null;
    };

    audio.play().catch(error => {
      console.error('播放启动失败:', error);
      setState(prev => ({
        ...prev,
        error: '播放启动失败'
      }));
    });
  }, [state.audioUrl]);

  // 暂停播放
  const pauseRecording = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  // 清除录音
  const clearRecording = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl);
    }

    setState({
      isRecording: false,
      isPlaying: false,
      audioBlob: null,
      audioUrl: null,
      duration: 0,
      error: null
    });
  }, [state.audioUrl]);

  // 检查是否有录音
  const hasRecording = state.audioBlob !== null;

  return {
    ...state,
    hasRecording,
    startRecording,
    stopRecording,
    playRecording,
    pauseRecording,
    clearRecording
  };
};