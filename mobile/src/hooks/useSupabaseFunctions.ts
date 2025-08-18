// file: mobile/src/hooks/useSupabaseFunctions.ts

// V16 Supabase Function Loading Service - Mobile Adaptation
// Loads function definitions and implementations from Supabase ai_prompts table

import { useState, useCallback, useMemo } from 'react';
import { supabase } from '../config/supabase';
// Temporarily disabled to prevent crashes
// import { useMentalHealthFunctions } from './useMentalHealthFunctions';
// import { useWebRTCStore } from '../stores/webrtc-store';

// Debug: Check supabase client on load
console.log('useSupabaseFunctions: supabase client loaded:', !!supabase);
console.log('useSupabaseFunctions: supabase type:', typeof supabase);
if (supabase) {
  console.log('useSupabaseFunctions: supabase.supabaseUrl:', supabase.supabaseUrl);
}

export interface SupabaseFunctionDefinition {
  name: string;
  type: 'function';
  description: string;
  parameters: Record<string, unknown>;
}

export interface SupabaseFunctionRegistry {
  [functionName: string]: (args: unknown) => Promise<unknown>;
}

export interface UseSupabaseFunctionsResult {
  // Function definitions for AI
  functionDefinitions: SupabaseFunctionDefinition[];

  // Function implementation registry for execution
  functionRegistry: SupabaseFunctionRegistry;

  // Loading and error states
  loading: boolean;
  error: string | null;

  // Utility methods
  loadFunctionsForAI: (aiType: string) => Promise<SupabaseFunctionDefinition[]>;
  clearError: () => void;
}

/**
 * V16 Supabase Functions Hook - Mobile Version
 * 
 * Loads function definitions from Supabase ai_prompts table and provides
 * both function definitions (for AI) and function implementations (for execution).
 * 
 * This replaces V15's hardcoded function hooks with database-driven functions.
 * Adapted for React Native mobile environment.
 */
function useSupabaseFunctionsImpl(): UseSupabaseFunctionsResult {
  const [functionDefinitions, setFunctionDefinitions] = useState<SupabaseFunctionDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Temporarily use empty implementation to prevent crashes
  const mentalHealthFunctions = {
    functionRegistry: {},
    problemSolvingFunction: async () => ({ success: false, error: 'Function temporarily disabled' }),
    screeningFunction: async () => ({ success: false, error: 'Function temporarily disabled' }),
    getUserHistoryFunction: async () => ({ success: false, error: 'Function temporarily disabled' }),
    logInteractionOutcomeFunction: async () => ({ success: false, error: 'Function temporarily disabled' }),
    culturalHumilityFunction: async () => ({ success: false, error: 'Function temporarily disabled' }),
    resourceSearchFunction: async () => ({ success: false, error: 'Function temporarily disabled' }),
    endSession: async () => ({ success: false, error: 'Function temporarily disabled' }),
    reportTechnicalError: async () => ({ success: false, error: 'Function temporarily disabled' }),
    groundingFunction: async () => ({ success: false, error: 'Function temporarily disabled' }),
    thoughtExplorationFunction: async () => ({ success: false, error: 'Function temporarily disabled' }),
    crisisResponseFunction: async () => ({ success: false, error: 'Function temporarily disabled' }),
    psychoeducationFunction: async () => ({ success: false, error: 'Function temporarily disabled' }),
    validationFunction: async () => ({ success: false, error: 'Function temporarily disabled' }),
    resourceFeedbackFunction: async () => ({ success: false, error: 'Function temporarily disabled' })
  };

  // Load functions from Supabase for a specific AI type
  const loadFunctionsForAI = useCallback(async (aiType: string): Promise<SupabaseFunctionDefinition[]> => {
    console.log(`[MOBILE] Loading functions for AI type: ${aiType}`);

    setLoading(true);
    setError(null);

    try {
      // Check if supabase client is properly initialized
      if (!supabase) {
        throw new Error('Supabase client is not initialized');
      }

      console.log(`[MOBILE] Testing basic Supabase connection...`);

      // Test basic Supabase connection first
      try {
        const { data: testData, error: testError } = await supabase
          .from('ai_prompts')
          .select('id')
          .limit(1);

        if (testError) {
          console.error(`[MOBILE] Supabase connection test failed:`, testError);
          throw new Error(`Supabase connection failed: ${testError.message}`);
        }

        console.log(`[MOBILE] ✅ Supabase connection successful`);
        console.log(`[MOBILE] Test query returned:`, testData);

      } catch (connectionError) {
        console.error(`[MOBILE] ❌ Supabase connection error:`, connectionError);
        throw connectionError;
      }

      // For now, return empty array while we test connection
      console.log(`[MOBILE] Returning empty functions array for ${aiType} (testing phase)`);

      const emptyFunctions: SupabaseFunctionDefinition[] = [];
      setFunctionDefinitions(emptyFunctions);
      return emptyFunctions;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[MOBILE] Error in loadFunctionsForAI:`, errorMessage);
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Function implementation registry - maps function names to actual implementations
  const functionRegistry = useMemo((): SupabaseFunctionRegistry => {
    console.log(`[MOBILE] Creating function registry with ${functionDefinitions.length} functions`);
    return {};
  }, [functionDefinitions, mentalHealthFunctions]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    functionDefinitions,
    functionRegistry,
    loading,
    error,
    loadFunctionsForAI,
    clearError
  };
}

// Wrap the hook export to ensure it's always available
export function useSupabaseFunctions(): UseSupabaseFunctionsResult {
  try {
    return useSupabaseFunctionsImpl();
  } catch (error) {
    console.error('useSupabaseFunctions: Critical error in hook:', error);
    // Return a safe fallback implementation
    return {
      functionDefinitions: [],
      functionRegistry: {},
      loading: false,
      error: `Hook initialization failed: ${error}`,
      loadFunctionsForAI: async () => [],
      clearError: () => { }
    };
  }
}

// Also keep default export for compatibility
export default useSupabaseFunctions;