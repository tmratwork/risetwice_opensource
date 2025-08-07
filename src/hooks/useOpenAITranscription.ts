// src/hooks/useOpenAITranscription.ts
// This is a passthrough implementation for the original V1 app
// The V1 app doesn't actually use client-side transcription
// So we return a placeholder to make the API compatible

import { useState } from 'react';

interface UseOpenAITranscriptionReturn {
  startTranscription: (audioBlob: Blob) => Promise<string | null>;
  isTranscribing: boolean;
  transcriptionError: string | null;
}

// Simple passthrough implementation
// In V1, the transcription was handled server-side via n8n
// So this just passes through a placeholder text for the API to function
export const useOpenAITranscription = (): UseOpenAITranscriptionReturn => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);

  // This function doesn't use the audioBlob parameter since it just returns a placeholder
  const startTranscription = async (/* audioBlob: Blob */): Promise<string | null> => {
    try {
      // For V1, we don't need to actually transcribe the audio client-side
      // Just return a placeholder that lets the API know this is from the V1 path
      return "[V1_AUDIO_UPLOAD]";
    } catch (error) {
      const err = error as Error;
      setTranscriptionError(err.message);
      return null;
    } finally {
      setIsTranscribing(false);
    }
  };

  return {
    startTranscription,
    isTranscribing,
    transcriptionError
  };
};