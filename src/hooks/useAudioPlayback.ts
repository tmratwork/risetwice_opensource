// src/hooks/useAudioPlayback.ts

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAudioPlaybackReturn {
    play: (url: string) => Promise<void>;
    stop: () => void;
    isPlaying: boolean;
    error: string | null;
}

export const useAudioPlayback = (): UseAudioPlaybackReturn => {
    // Refs to maintain audio context and buffer state
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
    const audioBufferRef = useRef<AudioBuffer | null>(null);
    const currentUrlRef = useRef<string | null>(null);

    // State for tracking playback and errors
    const [isPlaying, setIsPlaying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize audio context and network listeners on mount
    useEffect(() => {
        // Type-safe check for WebKit audio context
        const AudioContextClass = window.AudioContext ||
            ((window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);

        if (!AudioContextClass) {
            setError('Web Audio API is not supported in this browser');
            return;
        }

        try {
            audioContextRef.current = new AudioContextClass({
                latencyHint: 'interactive',
                sampleRate: 44100
            });

            console.log('Audio context initialized:', {
                state: audioContextRef.current.state,
                sampleRate: audioContextRef.current.sampleRate
            });
        } catch (err) {
            const initError = err instanceof Error ? err.message : String(err);
            setError(`Failed to initialize audio system: ${initError}`);
            console.error('Audio context initialization error:', err);
        }

        // Set up network status listeners
        const handleOnline = () => {
            console.log('Network connection restored');
            setError(null);
        };

        const handleOffline = () => {
            console.log('Network connection lost');
            setError('Network connection lost - audio playback requires network access');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Cleanup on unmount
        return () => {
            if (audioContextRef.current?.state !== 'closed') {
                try {
                    audioContextRef.current?.close().catch(err => {
                        console.warn('Error closing audio context:', err);
                    });
                } catch (err) {
                    console.warn('Error during audio context cleanup:', err);
                }
            }

            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Function to fetch and decode audio data with more detailed error handling
    const prepareAudio = async (url: string, retries = 3): Promise<AudioBuffer> => {
        console.log(`Preparing audio from ${url}, attempt 1/${retries}`);

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                console.log(`Fetch attempt ${attempt + 1}/${retries} for ${url}`);

                const response = await fetchWithTimeout(url, 10000, {
                    cache: 'no-store',
                    mode: 'cors',
                    credentials: 'same-origin',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache'
                    }
                });

                if (!response.ok) {
                    const errorMsg = `Fetch attempt ${attempt + 1}/${retries} failed: ${response.status} ${response.statusText}`;
                    console.warn(errorMsg);

                    // On last retry, throw detailed error
                    if (attempt === retries - 1) {
                        throw new Error(`Failed to fetch audio (HTTP ${response.status}): ${response.statusText}`);
                    }

                    // Wait longer between each retry
                    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                    continue;
                }

                // Log response headers for debugging
                const headers: Record<string, string> = {};
                response.headers.forEach((value, key) => {
                    headers[key] = value;
                });
                console.log('Response headers:', headers);

                const contentType = response.headers.get('content-type');
                console.log(`Content-Type: ${contentType}`);

                if (contentType && !contentType.includes('audio/') && !contentType.includes('application/octet-stream')) {
                    console.warn(`Unexpected content type: ${contentType}`);
                    // Continue anyway since sometimes servers misconfigure content types
                }

                const arrayBuffer = await response.arrayBuffer();
                console.log(`Received array buffer with ${arrayBuffer.byteLength} bytes`);

                if (arrayBuffer.byteLength === 0) {
                    throw new Error('Received empty audio data');
                }

                if (!audioContextRef.current) {
                    throw new Error('Audio context not initialized');
                }

                try {
                    console.log('Decoding audio data...');
                    const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
                    console.log('Audio successfully decoded:', {
                        duration: audioBuffer.duration,
                        numberOfChannels: audioBuffer.numberOfChannels,
                        sampleRate: audioBuffer.sampleRate
                    });
                    return audioBuffer;
                } catch (decodeErr) {
                    console.error('Audio decode error:', decodeErr);
                    throw new Error(`Failed to decode audio: ${decodeErr instanceof Error ? decodeErr.message : String(decodeErr)}`);
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);

                if (attempt === retries - 1) {
                    console.error(`All ${retries} attempts failed:`, errorMessage);
                    throw new Error(`Failed to prepare audio after ${retries} attempts: ${errorMessage}`);
                }

                console.warn(`Attempt ${attempt + 1}/${retries} failed, retrying...`, errorMessage);
                // Exponential backoff
                await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 5000)));
            }
        }
        throw new Error('Maximum retry attempts reached');
    };

    const fetchWithTimeout = async (url: string, timeout = 10000, options = {}): Promise<Response> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.warn(`Request to ${url} timed out after ${timeout}ms`);
            controller.abort();
        }, timeout);

        try {
            console.log(`Fetching ${url} with timeout ${timeout}ms`);
            const startTime = Date.now();

            const response: Response = await fetch(url, {
                signal: controller.signal,
                ...options
            });

            const elapsed = Date.now() - startTime;
            console.log(`Fetch completed in ${elapsed}ms`);

            clearTimeout(timeoutId);
            return response;
        } catch (err: unknown) {
            clearTimeout(timeoutId);

            if (err instanceof Error) {
                if (err.name === 'AbortError') {
                    throw new Error(`Request timed out after ${timeout}ms`);
                }

                // Add network status info to error messages
                if (navigator.onLine === false) {
                    throw new Error(`Network error (offline): ${err.message}`);
                }

                console.error('Fetch error details:', {
                    name: err.name,
                    message: err.message,
                    stack: err.stack
                });
            }

            throw err;
        }
    };

    // Function to create and configure source node
    const createSourceNode = (buffer: AudioBuffer): AudioBufferSourceNode => {
        if (!audioContextRef.current) {
            throw new Error('Audio context not initialized');
        }

        // Create and configure source node
        const sourceNode = audioContextRef.current.createBufferSource();
        sourceNode.buffer = buffer;
        sourceNode.connect(audioContextRef.current.destination);

        // Add ended handler
        sourceNode.onended = () => {
            console.log('Playback ended naturally');
            setIsPlaying(false);
            sourceNodeRef.current = null;
        };

        return sourceNode;
    };

    // Main play function with enhanced error reporting
    const play = async (url: string) => {
        try {
            setError(null);
            console.log(`Starting playback of ${url}`);

            // Check if URL is valid
            if (!url || typeof url !== 'string') {
                throw new Error(`Invalid URL format: ${url}`);
            }
            
            // Handle relative URLs by prefixing with origin
            if (url.startsWith('/')) {
                console.log(`Converting relative URL ${url} to absolute URL`);
                url = window.location.origin + url;
                console.log(`Converted to: ${url}`);
            }

            // Check if browser is online
            if (navigator.onLine === false) {
                throw new Error('Cannot play audio while offline - please check your network connection');
            }

            // Add audio context status checks with recovery options
            if (!audioContextRef.current) {
                console.warn('Audio context was null, attempting to recreate');

                const AudioContextClass = window.AudioContext ||
                    ((window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);

                if (!AudioContextClass) {
                    throw new Error('Web Audio API is not supported in this browser');
                }

                try {
                    audioContextRef.current = new AudioContextClass();
                    console.log('Audio context recreated successfully');
                } catch (createErr) {
                    throw new Error(`Failed to initialize audio system: ${createErr instanceof Error ? createErr.message : String(createErr)}`);
                }
            }

            // Check if audio context is in a state that can be resumed
            if (audioContextRef.current.state === 'suspended') {
                console.log('Audio context is suspended, attempting to resume...');

                try {
                    await audioContextRef.current.resume();
                    console.log('Audio context resumed successfully');
                } catch (err) {
                    console.warn('Failed to resume audio context:', err);

                    // Try to recreate the context as a fallback
                    try {
                        console.log('Recreating audio context...');
                        audioContextRef.current.close().catch(closeErr => {
                            console.warn('Error closing previous audio context:', closeErr);
                        });

                        const AudioContextClass = window.AudioContext ||
                            ((window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);

                        audioContextRef.current = new AudioContextClass();
                        console.log('Audio context recreated successfully');
                    } catch (createErr) {
                        throw new Error(`Audio system unavailable: ${createErr instanceof Error ? createErr.message : String(createErr)}`);
                    }
                }
            }

            // Stop any current playback
            stop();

            console.log(`Current URL: ${currentUrlRef.current}, New URL: ${url}`);

            // Always prepare new audio if URL is different
            if (url !== currentUrlRef.current) {
                console.log('URL changed, preparing new audio buffer');

                // Clear existing buffer
                audioBufferRef.current = null;
                // Update current URL  
                currentUrlRef.current = url;

                // Fetch and decode with improved retry logic
                try {
                    audioBufferRef.current = await prepareAudio(url, 3);
                } catch (prepareErr) {
                    throw new Error(`Audio preparation failed: ${prepareErr instanceof Error ? prepareErr.message : String(prepareErr)}`);
                }
            } else {
                console.log('Using cached audio buffer');
            }

            // Ensure we have a valid buffer
            if (!audioBufferRef.current) {
                throw new Error('Failed to prepare audio buffer - no data available');
            }

            // Create and configure new source node
            console.log('Creating audio source node');
            const sourceNode = createSourceNode(audioBufferRef.current);
            sourceNodeRef.current = sourceNode;

            // Start playback with a slight delay to ensure proper buffering
            const startTime = audioContextRef.current.currentTime + 0.1;
            console.log(`Starting playback at time ${startTime}`);
            sourceNode.start(startTime);
            setIsPlaying(true);
            console.log('Playback started successfully');

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(errorMessage);
            console.error('Playback error:', err);

            // Reset state on error
            setIsPlaying(false);
            if (sourceNodeRef.current) {
                try {
                    sourceNodeRef.current.stop();
                    sourceNodeRef.current.disconnect();
                } catch (stopErr) {
                    console.warn('Error stopping source after playback error:', stopErr);
                }
                sourceNodeRef.current = null;
            }

            throw err; // Re-throw for component-level handling
        }
    };

    // Stop function with better error handling
    const stop = useCallback(() => {
        try {
            console.log('Stopping audio playback');

            if (sourceNodeRef.current) {
                sourceNodeRef.current.stop();
                sourceNodeRef.current.disconnect();
                sourceNodeRef.current = null;
                console.log('Audio playback stopped successfully');
            } else {
                console.log('No active playback to stop');
            }

            setIsPlaying(false);
        } catch (err) {
            console.error('Error stopping playback:', err);
            // Even if stopping fails, ensure UI shows correctly
            setIsPlaying(false);
        }
    }, []);

    return { play, stop, isPlaying, error };
};