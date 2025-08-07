// src/hooks/useAudioRecorder.ts

import { useState, useRef, useEffect } from 'react';

interface UseAudioRecorderReturn {
    isRecording: boolean;
    audioUrl: string | null;
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<Blob | null>;
    error: string | null;
    isReady: boolean;
}

export const useAudioRecorder = (): UseAudioRecorderReturn => {
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const [isReady, setIsReady] = useState(false);

    // Pre-initialize the stream to avoid pause when user starts recording
    useEffect(() => {
        const initStream = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        channelCount: 1,
                        sampleRate: 22050,
                        echoCancellation: true,
                        noiseSuppression: true,
                    }
                });
                streamRef.current = stream;
                setIsReady(true);
            } catch (err) {
                setError(`Microphone access error: ${err instanceof Error ? err.message : String(err)}`);
            }
        };

        initStream();
    }, []); // Only run once on mount

    const startRecording = async () => {
        try {
            setError(null);
            chunksRef.current = [];
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
                setAudioUrl(null);
            }

            // Only get new stream if current one is inactive
            if (!streamRef.current || streamRef.current.active === false) {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        channelCount: 1,
                        sampleRate: 22050,
                        echoCancellation: true,
                        noiseSuppression: true,
                    }
                });
                streamRef.current = stream;
            }

            const recorder = new MediaRecorder(streamRef.current, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                    ? 'audio/webm;codecs=opus'
                    : 'audio/mp4',
                audioBitsPerSecond: 32000,
            });

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            recorder.onerror = (event) => {
                setError('Recording error: ' + event.error);
                stopRecording();
            };

            recorder.start(1000);
            mediaRecorder.current = recorder;
            setIsRecording(true);
        } catch (err) {
            setError(`Microphone access error: ${err instanceof Error ? err.message : String(err)}`);
            console.error('Recording error:', err);
        }
    };

    const stopRecording = async (): Promise<Blob | null> => {
        return new Promise((resolve) => {
            if (!mediaRecorder.current || mediaRecorder.current.state === 'inactive') {
                setIsRecording(false);
                resolve(null);
                return;
            }

            mediaRecorder.current.onstop = () => {
                const blob = new Blob(chunksRef.current, {
                    type: mediaRecorder.current?.mimeType || 'audio/webm'
                });

                mediaRecorder.current?.stream.getTracks().forEach(track => track.stop());

                // Create URL for playback
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);

                setIsRecording(false);
                resolve(blob);
            };

            mediaRecorder.current.stop();
        });
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (mediaRecorder.current && isRecording) {
                mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
            }
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [isRecording, audioUrl]);

    return { isRecording, audioUrl, startRecording, stopRecording, error, isReady };
};