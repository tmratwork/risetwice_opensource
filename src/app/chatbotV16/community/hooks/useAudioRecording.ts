'use client';

import { useState, useRef, useCallback } from 'react';

export interface AudioRecordingState {
  isRecording: boolean;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  audioBlob: File | null;
  audioUrl: string | null;
}

export interface AudioRecordingActions {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  playRecording: () => void;
  pauseRecording: () => void;
  resetRecording: () => void;
}

export function useAudioRecording() {
  const [state, setState] = useState<AudioRecordingState>({
    isRecording: false,
    isPlaying: false,
    duration: 0,
    currentTime: 0,
    audioBlob: null,
    audioUrl: null
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      // Try different mime types based on browser support
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/wav';
      }
      
      console.log('Using mime type:', mimeType);
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);

        // Create a proper File object with a name
        const fileExtension = mimeType.includes('webm') ? 'webm' : 
                             mimeType.includes('mp4') ? 'mp4' : 'wav';
        const file = new File([blob], `recording-${Date.now()}.${fileExtension}`, { 
          type: mimeType 
        });

        setState(prev => ({
          ...prev,
          audioBlob: file,
          audioUrl: url,
          duration,
          isRecording: false
        }));

        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setState(prev => ({ ...prev, isRecording: true, duration: 0 }));

      // Update duration while recording
      intervalRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          duration: Math.round((Date.now() - startTimeRef.current) / 1000)
        }));
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw new Error('Could not access microphone. Please check permissions.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [state.isRecording]);

  const playRecording = useCallback(() => {
    if (state.audioUrl && !state.isPlaying) {
      const audio = new Audio(state.audioUrl);
      audioRef.current = audio;

      audio.addEventListener('loadedmetadata', () => {
        setState(prev => ({ ...prev, isPlaying: true }));
        audio.play();
      });

      audio.addEventListener('timeupdate', () => {
        setState(prev => ({ ...prev, currentTime: audio.currentTime }));
      });

      audio.addEventListener('ended', () => {
        setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
        audioRef.current = null;
      });

      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        setState(prev => ({ ...prev, isPlaying: false }));
        audioRef.current = null;
      });
    }
  }, [state.audioUrl, state.isPlaying]);

  const pauseRecording = useCallback(() => {
    if (audioRef.current && state.isPlaying) {
      audioRef.current.pause();
      setState(prev => ({ ...prev, isPlaying: false }));
    }
  }, [state.isPlaying]);

  const resetRecording = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl);
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setState({
      isRecording: false,
      isPlaying: false,
      duration: 0,
      currentTime: 0,
      audioBlob: null,
      audioUrl: null
    });
  }, [state.audioUrl]);

  return {
    ...state,
    startRecording,
    stopRecording,
    playRecording,
    pauseRecording,
    resetRecording
  };
}