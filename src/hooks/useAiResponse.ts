// src/hooks/useAiResponse.ts
import { useState } from 'react';
import { useOpenAITranscription } from './useOpenAITranscription';

interface UseAiResponseReturn {
    processAudioAndGetResponse: (userId: string, audioUrl: string, book: string) => Promise<string | null>;
    isLoading: boolean;
    error: string | null;
}

interface ApiErrorResponse {
    error: string;
}

interface ApiSuccessResponse {
    url: string;
}

export const useAiResponse = (): UseAiResponseReturn => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { startTranscription, isTranscribing, transcriptionError } = useOpenAITranscription();

    const processAudioAndGetResponse = async (
        userId: string, 
        audioUrl: string, // V1 passes a URL string here, not a Blob
        book: string
    ): Promise<string | null> => {
        setIsLoading(true);
        setError(null);

        try {
            // V1 doesn't use client-side transcription, so we just need to 
            // get a placeholder value to keep the hooks API compatible
            const dummyBlob = new Blob([""], { type: "text/plain" });
            const transcriptionPlaceholder = await startTranscription(dummyBlob);
            
            if (!transcriptionPlaceholder) {
                throw new Error(transcriptionError || 'Failed to prepare audio');
            }

            console.log('Audio ready for processing, sending audioUrl to API');

            // In V1, we need to send just the already-uploaded audioUrl 
            // This comes in as the second parameter to this function
            const response = await fetch('/api/ai-response', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: `web_${userId}`,
                    audioUrl: audioUrl, // Pass the uploaded URL directly
                    book: book
                })
            });

            const rawText = await response.text();
            console.log('Raw response:', {
                status: response.status,
                headers: Object.fromEntries(response.headers.entries()),
                text: rawText
            });

            try {
                const data = JSON.parse(rawText) as ApiSuccessResponse | ApiErrorResponse;

                if ('error' in data) {
                    if (response.status === 504) {
                        throw new Error('Processing is taking longer than expected. Please try again.');
                    }
                    throw new Error(data.error);
                }

                if (!data.url) {
                    throw new Error('Response missing URL');
                }

                return data.url;
            } catch (parseError) {
                if (response.status === 504) {
                    throw new Error('Processing timed out. Please try again with a shorter recording. parseError: ' + parseError);
                }
                throw new Error('Invalid response from server');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to get AI response';
            setError(errorMessage);
            console.error('AI response error:', {
                error: err,
                message: errorMessage
            });
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    return { 
        processAudioAndGetResponse, 
        isLoading: isLoading || isTranscribing, 
        error: error || transcriptionError 
    };
};