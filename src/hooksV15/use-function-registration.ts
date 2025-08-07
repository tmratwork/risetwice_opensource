// src/hooksV15/use-function-registration.ts
// Component-level hook for registering functions to Zustand store

"use client";

import { useEffect } from 'react';
import { useBookFunctionsV15 } from '@/hooksV15/functions/use-book-functions-v15';
import { useMentalHealthFunctionsV15 } from '@/hooksV15/functions/use-mental-health-functions-v15';
import { useSleepFunctionsV15 } from '@/hooksV15/functions/use-sleep-functions-v15';
import { useWebRTCStore } from '@/stores/webrtc-store';
import { FunctionRegistryManager } from '@/stores/webrtc-store';

/**
 * V15 Function Registration Hook
 * 
 * This hook should be used in React components to register functions
 * from hooks to the Zustand store. It follows the proper React/Zustand
 * architecture recommended by WebAI.
 */
export function useFunctionRegistration() {
  // Get function hooks
  const bookFunctions = useBookFunctionsV15();
  const mentalHealthFunctions = useMentalHealthFunctionsV15();
  const sleepFunctions = useSleepFunctionsV15();

  // Get store actions
  const registerFunctions = useWebRTCStore(state => state.registerFunctions);
  const availableFunctions = useWebRTCStore(state => state.availableFunctions);

  // Register function definitions to store when hooks are ready
  useEffect(() => {
    if (bookFunctions.getAvailableFunctions.length > 0) {
      console.log(`[AI-INTERACTION] 📚 Registering ${bookFunctions.getAvailableFunctions.length} book functions to store`);
      registerFunctions({ book: bookFunctions.getAvailableFunctions });
    }
  }, [bookFunctions.getAvailableFunctions, registerFunctions]);

  useEffect(() => {
    if (mentalHealthFunctions.getAvailableFunctions.length > 0) {
      console.log(`[AI-INTERACTION] 🧠 Registering ${mentalHealthFunctions.getAvailableFunctions.length} mental health functions to store`);
      registerFunctions({ mentalHealth: mentalHealthFunctions.getAvailableFunctions });
    }
  }, [mentalHealthFunctions.getAvailableFunctions, registerFunctions]);

  useEffect(() => {
    if (sleepFunctions.getAvailableFunctions.length > 0) {
      console.log(`[AI-INTERACTION] 😴 Registering ${sleepFunctions.getAvailableFunctions.length} sleep functions to store`);
      registerFunctions({ sleep: sleepFunctions.getAvailableFunctions });
    }
  }, [sleepFunctions.getAvailableFunctions, registerFunctions]);

  // Register function implementations to registry manager for execution
  useEffect(() => {
    const registryManager = FunctionRegistryManager.getInstance();

    // Convert typed function registries to generic format for setRegistry
    const genericBookRegistry: Record<string, (args: unknown) => Promise<unknown>> = {};
    Object.entries(bookFunctions.functionRegistry).forEach(([name, fn]) => {
      genericBookRegistry[name] = fn as (args: unknown) => Promise<unknown>;
    });

    const genericMentalHealthRegistry: Record<string, (args: unknown) => Promise<unknown>> = {};
    Object.entries(mentalHealthFunctions.functionRegistry).forEach(([name, fn]) => {
      genericMentalHealthRegistry[name] = fn as (args: unknown) => Promise<unknown>;
    });

    const genericSleepRegistry: Record<string, (args: unknown) => Promise<unknown>> = {};
    Object.entries(sleepFunctions.functionRegistry).forEach(([name, fn]) => {
      genericSleepRegistry[name] = fn as (args: unknown) => Promise<unknown>;
    });

    const combinedRegistry = {
      ...genericBookRegistry,
      ...genericMentalHealthRegistry,
      ...genericSleepRegistry
    };

    console.log('[AI-INTERACTION] 🔧 Registering function implementations to registry manager');
    console.log('[AI-INTERACTION] Book functions:', Object.keys(genericBookRegistry));
    console.log('[AI-INTERACTION] Mental health functions:', Object.keys(genericMentalHealthRegistry));
    console.log('[AI-INTERACTION] Sleep functions:', Object.keys(genericSleepRegistry));
    console.log('[AI-INTERACTION] Total registry functions:', Object.keys(combinedRegistry).length);

    registryManager.setRegistry(combinedRegistry);
  }, [
    bookFunctions.functionRegistry,
    mentalHealthFunctions.functionRegistry,
    sleepFunctions.functionRegistry
  ]);

  // Debug logging to verify store received functions
  useEffect(() => {
    console.log(`[AI-INTERACTION] 📊 Store function counts:`, {
      book: availableFunctions.book.length,
      mentalHealth: availableFunctions.mentalHealth.length,
      sleep: availableFunctions.sleep.length
    });
  }, [availableFunctions]);

  return {
    // Return current function counts for debugging
    functionCounts: {
      book: availableFunctions.book.length,
      mentalHealth: availableFunctions.mentalHealth.length,
      sleep: availableFunctions.sleep.length
    },
    
    // Return individual hook objects if needed
    bookFunctions,
    mentalHealthFunctions,
    sleepFunctions
  };
}