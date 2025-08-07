// src/app/chatbot/page.tsx

'use client';

import { useAuth } from '@/contexts/auth-context';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { AudioPlayer } from '@/components/AudioPlayer';
import { useSupabaseUpload } from '@/hooks/useSupabaseUpload';
import { useState } from 'react';
import { useAiResponse } from '@/hooks/useAiResponse';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';
import { RotateCw, AlertCircle } from 'lucide-react';
import { Mic, Square, Loader2, BookOpen } from 'lucide-react';

// Define error state type for more detailed tracking
type ErrorState = {
    source: 'recording' | 'upload' | 'ai-processing' | 'playback' | 'network' | null;
    message: string | null;
    details?: string | null;
    timestamp: number | null;
};

export default function ChatbotPage() {
    const { user, loading, signInWithGoogle } = useAuth();
    const { isRecording, audioUrl, startRecording, stopRecording, error: recordingError } = useAudioRecorder();
    const { uploadAudio, uploadError } = useSupabaseUpload();
    const { processAudioAndGetResponse: getAiResponse, error: aiError } = useAiResponse();
    const { play, stop, isPlaying, error: playbackError } = useAudioPlayback();

    const [aiResponseUrl, setAiResponseUrl] = useState<string | null>(null);
    const [processingState, setProcessingState] = useState<'idle' | 'uploading' | 'processing'>('idle');

    // Enhanced error state
    const [errorState, setErrorState] = useState<ErrorState>({
        source: null,
        message: null,
        details: null,
        timestamp: null
    });

    const [selectedBook, setSelectedBook] = useState<string>("a720258c-49d8-48f5-aedc-111db687f554");

    // Helper to set errors with more detail
    const setDetailedError = (source: ErrorState['source'], message: string, details?: string) => {
        console.error(`Error (${source}):`, message, details);
        setErrorState({
            source,
            message,
            details: details || null,
            timestamp: Date.now()
        });
    };

    // Clear error state
    const clearError = () => {
        setErrorState({
            source: null,
            message: null,
            details: null,
            timestamp: null
        });
    };

    const handleRecordingToggle = async () => {
        if (!user) {
            signInWithGoogle();
            return;
        }

        // Stop any current playback when starting new recording
        if (isPlaying) {
            stop();
        }

        if (!isRecording) {
            setProcessingState('idle');
            setAiResponseUrl(null);
            clearError(); // Clear any previous errors

            console.log('Starting recording', {
                userId: user.uid,
                timestamp: new Date().toISOString()
            });

            try {
                await startRecording();
            } catch (error) {
                const err = error as Error;
                setDetailedError('recording', 'Failed to start recording', err.message);
            }

        } else {
            console.log('Stopping recording', {
                userId: user.uid,
                timestamp: new Date().toISOString()
            });

            try {
                const audioBlob = await stopRecording();

                if (!audioBlob) {
                    setDetailedError('recording', 'No audio was recorded', 'The recording process did not produce audio data');
                    return;
                }

                setProcessingState('uploading');
                console.log('Recording size:', Math.round(audioBlob.size / 1024), 'KB');

                // Handle upload with error tracking
                try {
                    const publicUrl = await uploadAudio(audioBlob, user.uid);

                    if (!publicUrl) {
                        setDetailedError('upload', 'Upload failed', 'No URL was returned from the upload service');
                        setProcessingState('idle');
                        return;
                    }

                    setProcessingState('processing');
                    console.log('Uploaded successfully:', publicUrl);

                    // Handle AI processing with detailed error capture
                    try {
                        const requestParams = {
                            userId: user.uid,
                            audioUrl: publicUrl,
                            book: selectedBook
                        };
                        console.log('Attempting n8n call with:', requestParams);

                        // This is the V1 flow - we pass the public URL of the uploaded audio
                        const aiResponse = await getAiResponse(user.uid, publicUrl, selectedBook);

                        // Add detailed response logging
                        console.log('Raw AI response:', {
                            type: typeof aiResponse,
                            value: aiResponse,
                            stringified: JSON.stringify(aiResponse)
                        });

                        if (!aiResponse) {
                            setDetailedError('ai-processing', 'No response from AI service', 'The AI service did not return an audio URL');
                            setProcessingState('idle');
                            return;
                        }

                        console.log('AI response received:', aiResponse);
                        setAiResponseUrl(aiResponse);
                        setProcessingState('idle');

                        try {
                            await play(aiResponse);
                        } catch (error) {
                            const playError = error as Error;
                            setDetailedError('playback', 'Failed to play AI response', playError.message);
                        }
                    } catch (error) {
                        // Enhanced error logging for AI response
                        const err = error as Error & {
                            response?: {
                                status?: number;
                                statusText?: string;
                                data?: unknown;
                            }
                        };

                        const errorDetails = {
                            message: err?.message || 'Unknown error',
                            name: err?.name || 'Error',
                            stack: err?.stack,
                            response: err?.response ? {
                                status: err.response.status,
                                statusText: err.response.statusText,
                                data: err.response.data
                            } : 'No response data'
                        };

                        console.error('Failed to get AI response:', errorDetails);

                        const statusMessage = err.response?.status
                            ? `HTTP ${err.response.status}: ${err.response.statusText || 'Unknown error'}`
                            : errorDetails.message;

                        setDetailedError(
                            'ai-processing',
                            'AI processing failed',
                            statusMessage
                        );

                        setProcessingState('idle');
                    }
                } catch (error) {
                    const uploadErr = error as Error;
                    setDetailedError('upload', 'Audio upload failed', uploadErr.message);
                    setProcessingState('idle');
                }
            } catch (error) {
                const stopError = error as Error;
                setDetailedError('recording', 'Failed to process recording', stopError.message);
                setProcessingState('idle');
            }
        }
    };

    const handleReplay = async () => {
        if (!aiResponseUrl) return;

        try {
            if (isPlaying) {
                stop();
            } else {
                await play(aiResponseUrl);
            }
        } catch (error) {
            const playError = error as Error;
            setDetailedError('playback', 'Playback error', playError.message);
        }
    };

    const getButtonContent = () => {
        if (!user) return 'Sign In';
        if (isRecording) return <Square className="w-12 h-12 sm:w-16 sm:h-16" />;
        if (processingState === 'uploading') return <Loader2 className="w-12 h-12 sm:w-16 sm:h-16 animate-spin" />;
        if (processingState === 'processing') return <Loader2 className="w-12 h-12 sm:w-16 sm:h-16 animate-spin" />;
        return <Mic className="w-12 h-12 sm:w-16 sm:h-16" />;
    };

    const getButtonStyle = () => {
        if (isRecording) return 'bg-red-500 hover:bg-red-600 active:bg-red-700 animate-pulse';
        if (processingState !== 'idle') return 'bg-gray-400';
        return 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700';
    };

    // Helper for rendering the current processing state label
    const getProcessingStateLabel = () => {
        switch (processingState) {
            case 'uploading': return 'Uploading audio...';
            case 'processing': return 'Thinking...';
            default: return '';
        }
    };

    // Use any error from hooks if not already captured in our error state
    const currentError = errorState.message || recordingError || uploadError || aiError || playbackError;

    // Modify this function to handle touch events more effectively
    const preventScrollOnTouch = (e: React.TouchEvent) => {
        // Don't call preventDefault on touchStart to allow the click to register
        // Just mark that we're touching the button
        e.stopPropagation();
    };

    // Add this function to handle touch move specifically
    const preventScrollOnTouchMove = (e: React.TouchEvent) => {
        // On touchMove, prevent default to stop scrolling
        e.preventDefault();
        e.stopPropagation();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-pulse text-gray-600">Loading...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center min-h-screen p-4 relative">
            {/* Error display - positioned at the top */}
            {currentError && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-10
                    bg-red-900/20 border border-red-500 rounded-md p-3 mb-3 max-w-md w-full">
                    <div className="flex items-start">
                        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                        <div>
                            <div className="text-red-500 font-medium">
                                {errorState.source ? `Error: ${errorState.source.replace(/-/g, ' ')}` : 'Error'}
                            </div>
                            <p className="text-red-400 text-sm">{errorState.message || currentError}</p>
                            {errorState.details && (
                                <p className="text-red-300 text-xs mt-1">{errorState.details}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Main content container with flex layout */}
            <div className="w-full max-w-md flex flex-col items-center pt-20 pb-4">
                {/* Processing state indicator */}
                {processingState !== 'idle' && (
                    <div className="mb-4 flex items-center text-blue-400">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        <span>{getProcessingStateLabel()}</span>
                    </div>
                )}

                {/* Main recording button - fixed position */}
                <div className="fixed top-30 left-1/2 transform -translate-x-1/2 z-10">
                    <button
                        onClick={handleRecordingToggle}
                        disabled={processingState !== 'idle' && !isRecording}
                        onTouchStart={preventScrollOnTouch}
                        onTouchMove={preventScrollOnTouchMove}
                        onTouchEnd={preventScrollOnTouch}
                        className={`
                            relative
                            w-32 h-32 sm:w-48 sm:h-48 
                            rounded-full 
                            transition-all duration-200 
                            flex items-center justify-center
                            text-white font-semibold 
                            shadow-lg
                            ${getButtonStyle()}
                            ${processingState !== 'idle' && !isRecording ? 'opacity-70' : 'opacity-100'}
                            touch-none
                        `}
                    >
                        <div className="text-center">
                            {getButtonContent()}

                            {/* Status text under button */}
                            {isRecording && (
                                <span className="block text-xs mt-2 animate-pulse">Recording...</span>
                            )}
                        </div>
                    </button>
                </div>

                {/* Spacer to push content below the fixed record button */}
                <div className="h-40 sm:h-56"></div>

                {/* Audio interface area - flows naturally */}
                <div className="w-full flex flex-col items-center mt-4">
                    {audioUrl && (
                        <div className="w-full max-w-xs mx-auto mb-3 px-2">
                            <p className="text-xs text-gray-400 mb-1">Your message:</p>
                            <AudioPlayer audioUrl={audioUrl} label="" />
                        </div>
                    )}

                    {aiResponseUrl && (
                        <div className="w-full max-w-xs mx-auto mt-2 px-2">
                            <p className="text-xs text-gray-400 mb-1">AI response:</p>
                            <AudioPlayer audioUrl={aiResponseUrl} label="" />
                        </div>
                    )}
                </div>

                {/* Replay button - flows naturally */}
                {aiResponseUrl && (
                    <div className="mt-4">
                        <button
                            onClick={handleReplay}
                            className="p-3 text-blue-500 hover:text-blue-600 transition-all duration-200"
                            aria-label={isPlaying ? "Pause response" : "Replay last response"}
                        >
                            {isPlaying ? (
                                <Square size={36} className="sm:w-12 sm:h-12" />
                            ) : (
                                <RotateCw size={36} className="sm:w-12 sm:h-12" />
                            )}
                        </button>
                    </div>
                )}

                <h3 className="mt-6 text-lg font-medium text-white">Sample Books</h3>

                {/* Book selection dropdown - flows naturally */}
                <div className="mt-4 flex items-center">
                    <BookOpen className="mr-2 text-blue-500" />
                    <select
                        value={selectedBook}
                        onChange={(e) => setSelectedBook(e.target.value)}
                        className="p-2 border border-gray-300 rounded-md bg-black text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {/* <option value="All">All</option> */}
                        <option value="a720258c-49d8-48f5-aedc-111db687f554">Dopamine Nation</option>
                        <option value="fe6a7ae8-96b4-45f0-b049-7a12a98f5bf9">The Let Them Theory</option>
                        <option value="87a45ca5-f18a-4141-87c7-0dc683a78dc9">I Want to Die but I Still Want to Eat Tteokbokki</option>
                        <option value="0dc14de7-83a8-493f-9a4b-503269bdcee1">How We Live Is How We Die</option>
                        <option value="b0d37b1a-5174-4bb6-bf7a-c23671ebf8e9">Somehow: Thoughts on Love</option>
                        <option value="cbcfa4fa-a2c1-486e-b5d7-72234f92cbc9">The Four Agreements: A Practical Guide to Personal Freedom</option>
                        <option value="f78ae61b-9702-4c27-8eb6-151233fd7a6a">Think Again: The Power of Knowing What You Don&apos;t Know</option>
                        <option value="b6bc5634-10cd-46b1-9893-aa4500bf3fdc">Change Your Paradigm, Change Your Life</option>
                        <option value="4c0fda26-e5b5-472f-9759-1bc596c3fcb1">Quiet: The Power of Introverts in a World That Can&apos;t Stop Talking</option>
                        <option value="1d9851af-47a5-4a9c-abda-5c087ecfae59">The Stress-Proof Brain: Master Your Emotional Response to Stress Using Mindfulness and Neuroplasticity</option>
                    </select>
                </div>

                {/* Instructions text */}
                <div className="mt-4 w-full">
                    <p className="text-xs sm:text-sm text-gray-400 text-center max-w-md mx-auto px-2">
                        After signing in, tap to start recording, tap to stop recording, and after thirty seconds or so the AI response will automatically play. The paid version of this service works at conversational speed. At any time, ask the AI for a new question, or tell the AI to move on to the next question.
                        To join the waitlist for the paid version, email<a href="mailto:waitlist@Vorail.com" className="text-blue-400 hover:text-blue-300 underline"> waitlist@Vorail.com</a>
                    </p>
                </div>
            </div>
        </div>
    );
}