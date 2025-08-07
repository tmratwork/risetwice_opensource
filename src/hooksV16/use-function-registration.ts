// src/hooksV16/use-function-registration.ts
// Component-level hook for registering V16 functions from Supabase to Zustand store

"use client";

import { useEffect, useState, useCallback } from 'react';
import { useSupabaseFunctions } from './use-supabase-functions';
import { useWebRTCStore } from '@/stores/webrtc-store';
import { FunctionRegistryManager } from '@/stores/webrtc-store';

/**
 * V16 Function Registration Hook
 * 
 * This hook loads functions from Supabase ai_prompts table and registers them
 * to the Zustand store for AI use. This replaces V15's hardcoded function hooks
 * with database-driven function loading.
 */
export function useFunctionRegistration() {
  const [currentAIType, setCurrentAIType] = useState<string | null>(null);
  const [registeredFunctions, setRegisteredFunctions] = useState<unknown[]>([]);

  // Get Supabase functions hook
  const supabaseFunctions = useSupabaseFunctions();

  // Get store actions
  const registerFunctions = useWebRTCStore(state => state.registerFunctions);
  const availableFunctions = useWebRTCStore(state => state.availableFunctions);

    // console.log(`[triage] V16 function registration hook initialized`);

  // Method to load functions for a specific AI type
  const loadFunctionsForAI = useCallback(async (aiType: string) => {
    // console.log(`[triage] Loading functions for AI type: ${aiType}`);
    setCurrentAIType(aiType);

    try {
      const functions = await supabaseFunctions.loadFunctionsForAI(aiType);
    // console.log(`[triage] Loaded ${functions.length} functions from Supabase for ${aiType}`);
    // console.log(`[triage] Function names: ${functions.map(f => f.name).join(', ')}`);

      // Verify critical functions are present
      const hasHandoff = functions.some(f => f.name === 'trigger_specialist_handoff');
    // console.log(`[triage] ✅ trigger_specialist_handoff function present: ${hasHandoff}`);
      // Use hasHandoff to avoid unused variable error
      void hasHandoff;

      // Register functions to store for AI use
    // console.log(`[triage] Registering ${functions.length} Supabase functions to WebRTC store`);
      registerFunctions({ supabase: functions });
      setRegisteredFunctions(functions);

      return functions;
    } catch (error) {
    // console.error(`[triage] Error loading functions for ${aiType}:`, error);
      throw error;
    }
  }, [supabaseFunctions.loadFunctionsForAI, registerFunctions, supabaseFunctions]);

  // Register function implementations to registry manager for execution
  useEffect(() => {
    if (supabaseFunctions.functionRegistry && Object.keys(supabaseFunctions.functionRegistry).length > 0) {
      const registryManager = FunctionRegistryManager.getInstance();

    // console.log('[triage] 🔧 Registering Supabase function implementations to registry manager');
    // console.log(`[triage] Functions available for execution: ${Object.keys(supabaseFunctions.functionRegistry).join(', ')}`);
    // console.log(`[triage] Total function implementations: ${Object.keys(supabaseFunctions.functionRegistry).length}`);

      registryManager.setRegistry(supabaseFunctions.functionRegistry);
    }
  }, [supabaseFunctions.functionRegistry]);

  // Debug logging to verify store received functions
  useEffect(() => {
    const totalFunctions = Object.values(availableFunctions).flat().length;
    // console.log(`[triage] 📊 Store function summary:`, {
    //   currentAIType,
    //   registeredFunctionCount: registeredFunctions.length,
    //   storeTotalFunctions: totalFunctions,
    //   storeBreakdown: {
    //     book: availableFunctions.book?.length || 0,
    //     mentalHealth: availableFunctions.mentalHealth?.length || 0,
    //     sleep: availableFunctions.sleep?.length || 0,
    //     supabase: availableFunctions.supabase?.length || 0
    //   }
    // });
    // Use totalFunctions to avoid unused variable error
    void totalFunctions;
  }, [availableFunctions, currentAIType, registeredFunctions]);

  return {
    // V16 Supabase function loading
    loadFunctionsForAI,
    currentAIType,
    registeredFunctions,
    
    // Function loading state
    loading: supabaseFunctions.loading,
    error: supabaseFunctions.error,
    clearError: supabaseFunctions.clearError,

    // Return current function counts for debugging
    functionCounts: {
      book: availableFunctions.book?.length || 0,
      mentalHealth: availableFunctions.mentalHealth?.length || 0,
      sleep: availableFunctions.sleep?.length || 0,
      supabase: availableFunctions.supabase?.length || 0,
      total: Object.values(availableFunctions).flat().length
    },

    // Function definitions and registry
    functionDefinitions: supabaseFunctions.functionDefinitions,
    functionRegistry: supabaseFunctions.functionRegistry
  };
}