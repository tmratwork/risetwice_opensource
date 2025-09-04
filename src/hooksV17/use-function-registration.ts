// src/hooksV17/use-function-registration.ts
// V17 Function Registration Hook - Simplified for Eleven Labs

"use client";

import { useEffect, useState, useCallback } from 'react';
import { useSupabaseFunctions } from './use-supabase-functions';
import { useElevenLabsStore } from '@/stores/elevenlabs-store';

// V17 conditional logging
const logV17 = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
    console.log(`[V17] ${message}`, ...args);
  }
};

/**
 * V17 Function Registration Hook (Eleven Labs)
 * 
 * This hook loads functions from Supabase ai_prompts table for use with 
 * Eleven Labs AI agents. Simplified version focused on function definitions
 * rather than registration to a central store.
 */
export function useFunctionRegistration() {
  const [currentAIType, setCurrentAIType] = useState<string | null>(null);
  const [registeredFunctions, setRegisteredFunctions] = useState<unknown[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get Supabase functions hook
  const supabaseFunctions = useSupabaseFunctions();
  
  // Get Eleven Labs store (for potential future use)
  const elevenLabsStore = useElevenLabsStore();

  logV17('🔧 V17 function registration hook initialized');

  // Load functions for a specific AI type
  const loadFunctionsForAI = useCallback(async (aiType: string) => {
    try {
      setIsLoading(true);
      setError(null);
      logV17('📥 Loading functions for AI type', { aiType });
      
      const functions = await supabaseFunctions.loadFunctionsForAI(aiType);
      
      setCurrentAIType(aiType);
      setRegisteredFunctions(functions);
      
      logV17('✅ Functions loaded for V17', { 
        aiType, 
        functionCount: functions.length,
        functionNames: functions.map(f => f.name)
      });
      
      return functions;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logV17('❌ Failed to load functions for V17', { aiType, error: errorMessage });
      setError(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [supabaseFunctions]);

  // Auto-load functions when AI type changes in triage session
  useEffect(() => {
    const currentSpecialist = elevenLabsStore.triageSession?.currentSpecialist;
    
    if (currentSpecialist && currentSpecialist !== currentAIType) {
      logV17('🔄 AI type changed, loading new functions', { 
        from: currentAIType, 
        to: currentSpecialist 
      });
      loadFunctionsForAI(currentSpecialist);
    }
  }, [elevenLabsStore.triageSession?.currentSpecialist, currentAIType, loadFunctionsForAI]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // Function data
    currentAIType,
    registeredFunctions,
    functionDefinitions: supabaseFunctions.functionDefinitions,
    functionRegistry: supabaseFunctions.functionRegistry,
    
    // Loading states
    isLoading: isLoading || supabaseFunctions.loading,
    error: error || supabaseFunctions.error,
    
    // Actions
    loadFunctionsForAI,
    clearError,
    
    // V17 specific
    elevenLabsStore,
  };
}