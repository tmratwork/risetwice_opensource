// src/hooksS1/use-s1-prompts.ts
// S1 hook for loading AI patient prompts from s1_ai_prompts table

import { useState, useCallback } from 'react';

export interface S1AIPrompt {
  id: string;
  prompt_type: string;
  prompt_content: string;
  voice_settings?: any;
  metadata?: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface S1PromptsHook {
  loading: boolean;
  error: string | null;
  loadPatientPrompt: (patientType: string) => Promise<S1AIPrompt | null>;
  clearError: () => void;
}

export function useS1Prompts(): S1PromptsHook {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPatientPrompt = useCallback(async (patientType: string): Promise<S1AIPrompt | null> => {
    setLoading(true);
    setError(null);

    try {
      console.log('[S1] Loading prompt for patient type:', patientType);

      const response = await fetch(`/api/s1/ai-prompts?type=${patientType}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load prompt: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.prompt) {
        console.warn('[S1] No prompt found for patient type:', patientType);
        return null;
      }

      console.log('[S1] Prompt loaded successfully:', {
        type: data.prompt.prompt_type,
        promptLength: data.prompt.prompt_content?.length || 0
      });

      return data.prompt;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[S1] Error loading patient prompt:', errorMessage);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    loadPatientPrompt,
    clearError
  };
}