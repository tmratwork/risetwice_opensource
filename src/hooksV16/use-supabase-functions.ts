// src/hooksV16/use-supabase-functions.ts
// V16 Supabase Function Loading Service
// Loads function definitions and implementations from Supabase ai_prompts table

"use client";

import { useState, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useMentalHealthFunctionsV16 } from './use-mental-health-functions-v16';
import type { WebRTCStoreState } from '@/stores/webrtc-store';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
 * V16 Supabase Functions Hook
 * 
 * Loads function definitions from Supabase ai_prompts table and provides
 * both function definitions (for AI) and function implementations (for execution).
 * 
 * This replaces V15's hardcoded function hooks with database-driven functions.
 */
export function useSupabaseFunctions(): UseSupabaseFunctionsResult {
  const [functionDefinitions, setFunctionDefinitions] = useState<SupabaseFunctionDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize V16 mental health functions hook
  const mentalHealthFunctions = useMentalHealthFunctionsV16();

  // console.log('[triageAI] V16 Supabase functions hook initialized');

  // Load functions from Supabase for a specific AI type
  const loadFunctionsForAI = useCallback(async (aiType: string): Promise<SupabaseFunctionDefinition[]> => {
    // Detect if this is an inter-specialist load
    let currentSpecialist = 'unknown';
    let isInterSpecialistLoad = false;
    
    // Try to get current specialist from WebRTC store if available
    if (typeof window !== 'undefined' && (window as unknown as { useWebRTCStore?: { getState: () => { triageSession?: { currentSpecialist?: string } } } }).useWebRTCStore) {
      const state = (window as unknown as { useWebRTCStore: { getState: () => { triageSession?: { currentSpecialist?: string } } } }).useWebRTCStore.getState();
      currentSpecialist = state.triageSession?.currentSpecialist || 'unknown';
      isInterSpecialistLoad = currentSpecialist !== 'triage' && currentSpecialist !== 'unknown' && aiType !== 'triage';
    }
    
    // Use appropriate logging based on load type
    const logPrefix = isInterSpecialistLoad ? '[specialist_handoff]' : '[triage_handoff]';
    const enableLogs = isInterSpecialistLoad 
      ? process.env.NEXT_PUBLIC_ENABLE_SPECIALIST_HANDOFF_LOGS === 'true'
      : process.env.NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS === 'true';
      
    if (enableLogs) {
      console.log(`${logPrefix} Loading functions from Supabase for AI type: ${aiType}`);
      if (isInterSpecialistLoad) {
        console.log(`[specialist_handoff] ⚠️ Inter-specialist function load: ${currentSpecialist} → ${aiType}`);
      }
    }
    
    setLoading(true);
    setError(null);

    try {
      // Load the AI's specific functions using RLS-compliant RPC function
      const { data: aiPromptArray, error: aiError } = await supabase
        .rpc('get_ai_prompt_by_type', {
          target_prompt_type: aiType,
          requesting_user_id: null // Anonymous user for functions loading
        });
      
      const aiPrompt = aiPromptArray?.[0] || null;

      if (aiError) {
        if (enableLogs) {
          console.error(`${logPrefix} ❌ CRITICAL ERROR: Database error loading ${aiType} functions:`, aiError);
        }
        throw new Error(`V16 SUPABASE FUNCTION LOADING FAILED: ${aiError.message}. Cannot load ${aiType} functions from ai_prompts table. Check Supabase connection and database structure.`);
      }

      if (!aiPrompt) {
        if (enableLogs) {
          console.error(`${logPrefix} ❌ CRITICAL ERROR: No active ${aiType} prompt found`);
        }
        throw new Error(`V16 SUPABASE FUNCTION LOADING FAILED: No active ${aiType} prompt found in ai_prompts table.`);
      }

      const aiFunctions = aiPrompt?.functions || [];
      if (enableLogs) {
        console.log(`${logPrefix} Loaded ${aiFunctions.length} functions for ${aiType}`);
      }

      // Load universal functions if AI type is not 'universal_functions'
      let universalFunctions: SupabaseFunctionDefinition[] = [];
      const mergeEnabled = aiPrompt?.merge_with_universal_functions ?? true;
      if (aiType !== 'universal_functions' && mergeEnabled) {
        if (enableLogs) {
          console.log(`${logPrefix} Loading universal functions to merge with ${aiType} functions`);
        }

        const { data: universalPromptArray, error: universalError } = await supabase
          .rpc('get_ai_prompt_by_type', {
            target_prompt_type: 'universal_functions',
            requesting_user_id: null // Anonymous user for functions loading
          });
        
        const universalPrompt = universalPromptArray?.[0] || null;

        if (universalError) {
          if (enableLogs) {
            console.warn(`${logPrefix} Could not load universal functions:`, universalError);
          }
        } else {
          universalFunctions = universalPrompt?.functions || [];
          if (enableLogs) {
            console.log(`${logPrefix} Loaded ${universalFunctions.length} universal functions`);
            
            // Check if trigger_specialist_handoff is in universal functions
            const hasHandoffInUniversal = universalFunctions.some(f => f.name === 'trigger_specialist_handoff');
            if (hasHandoffInUniversal) {
              console.log(`${logPrefix} ✅ trigger_specialist_handoff found in universal functions`);
            }
          }
        }
      }

      // Combine AI-specific functions with universal functions
      const allFunctions = [...aiFunctions, ...universalFunctions];
      if (enableLogs) {
        console.log(`${logPrefix} Total functions for ${aiType}: ${allFunctions.length} (${aiFunctions.length} specific + ${universalFunctions.length} universal)`);
        console.log(`${logPrefix} Function names: ${allFunctions.map(f => f.name).join(', ')}`);
        
        // Enhanced logging for triage AI function execution debugging
        if (aiType === 'triage' && process.env.NEXT_PUBLIC_ENABLE_FUNCTION_EXECUTION_LOGS === 'true') {
          console.log(`[function_execution] 📊 TRIAGE AI FUNCTION LOADING (SUPABASE HOOK):`);
          console.log(`[function_execution] AI-Specific Functions: ${aiFunctions.length}`);
          console.log(`[function_execution] Universal Functions: ${universalFunctions.length}`);
          console.log(`[function_execution] Total Available Functions: ${allFunctions.length}`);
          console.log(`[function_execution] Database Merge Setting: ${mergeEnabled ? 'ENABLED' : 'DISABLED'}`);
          console.log(`[function_execution] Merge Applied: ${mergeEnabled && universalFunctions.length > 0 ? 'YES' : 'NO'}`);
          console.log(`[function_execution] All Function Names:`, allFunctions.map(f => f.name));
        }
        
        // Check if the combined functions have handoff capability
        const hasHandoffTotal = allFunctions.some(f => f.name === 'trigger_specialist_handoff');
        if (isInterSpecialistLoad && !hasHandoffTotal) {
          console.error(`[specialist_handoff] ⚠️ WARNING: ${aiType} does not have trigger_specialist_handoff function!`);
          console.error(`[specialist_handoff] ⚠️ This specialist cannot perform inter-specialist handoffs`);
        }
      }

      // Update state with loaded functions
      setFunctionDefinitions(allFunctions);
      return allFunctions;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (enableLogs) {
        console.error(`${logPrefix} Error in loadFunctionsForAI:`, errorMessage);
      }
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Function implementation registry - maps function names to actual implementations
  const functionRegistry = useMemo((): SupabaseFunctionRegistry => {
    // Only create registry if we have functions and avoid recreating for the same functions
    if (functionDefinitions.length === 0) {
      return {};
    }

    // console.log(`[triageAI] Creating function registry with ${functionDefinitions.length} functions`);

    const registry: SupabaseFunctionRegistry = {};

    // Register implementations for each function loaded from Supabase
    functionDefinitions.forEach(func => {
      // Enhanced logging for resource locator debugging
      if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_LOCATOR_LOGS === 'true' && 
          (func.name.includes('resource') || func.name.includes('locator') || func.name === 'search_resources_unified')) {
        console.log(`[resource_locator] 📝 Registering function: ${func.name}`, {
          functionName: func.name,
          description: func.description,
          timestamp: new Date().toISOString()
        });
      }
      
      registry[func.name] = async (args: unknown) => {
        // Enhanced logging for resource locator debugging
        if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_LOCATOR_LOGS === 'true' && 
            (func.name.includes('resource') || func.name.includes('locator') || func.name === 'search_resources_unified')) {
          console.log(`[resource_locator] 🎬 Function CALLED: ${func.name}`, {
            functionName: func.name,
            args,
            timestamp: new Date().toISOString()
          });
        }
        
        // console.log(`[triageAI] ===== FUNCTION EXECUTION =====`);
        // console.log(`[triageAI] Function called: ${func.name}`);
        // console.log(`[triageAI] Function description: ${func.description}`);
        // console.log(`[triageAI] Function arguments:`, args);
        // console.log(`[triageAI] Arguments type:`, typeof args);
        // console.log(`[triageAI] Timestamp:`, new Date().toISOString());

        // Add comprehensive triage handoff logging
        const logTriageHandoff = (message: string, ...args: unknown[]) => {
          if (process.env.NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS === 'true') {
            console.log(`[triage_handoff] ${message}`, ...args);
          }
        };

        // Extra logging for handoff function
        if (func.name === 'trigger_specialist_handoff') {
          logTriageHandoff('🚨 EXECUTING CRITICAL HANDOFF FUNCTION!', {
            functionName: func.name,
            arguments: args,
            timestamp: new Date().toISOString(),
            source: 'use-supabase-functions-execute'
          });
        }

        try {
          // Route to appropriate function implementation based on function name
          const result = await executeFunctionImplementation(func.name, args, mentalHealthFunctions);
          // console.log(`[triageAI] ===== FUNCTION EXECUTION RESULT =====`);
          // console.log(`[triageAI] Function ${func.name} executed successfully`);
          // console.log(`[triageAI] Result:`, result);
          // console.log(`[triageAI] Result type:`, typeof result);

          // Extra logging for handoff function success
          if (func.name === 'trigger_specialist_handoff') {
            logTriageHandoff('✅ HANDOFF FUNCTION COMPLETED - Event should be dispatched!', {
              functionName: func.name,
              result: result,
              timestamp: new Date().toISOString(),
              source: 'use-supabase-functions-success'
            });
          }

          return result;
        } catch (error) {
          // console.error(`[triageAI] ===== FUNCTION EXECUTION ERROR =====`);
          // console.error(`[triageAI] Function ${func.name} execution failed`);
          // console.error(`[triageAI] Error:`, error);
          // console.error(`[triageAI] Error message:`, (error as Error).message);

          // Enhanced logging for resource locator debugging
          if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_LOCATOR_LOGS === 'true' && 
              (func.name.includes('resource') || func.name.includes('locator') || func.name === 'search_resources_unified')) {
            console.error(`[resource_locator] ❌ Function execution error`, {
              functionName: func.name,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              args: args,
              timestamp: new Date().toISOString()
            });
          }

          // Extra logging for handoff function error
          if (func.name === 'trigger_specialist_handoff') {
            // console.error(`[triageAI] ❌ CRITICAL: HANDOFF FUNCTION FAILED!`);
          }
          return {
            success: false,
            error: `Function execution failed: ${(error as Error).message}`
          };
        }
      };
    });

    // console.log(`[triageAI] Function registry created with ${Object.keys(registry).length} implementations`);

    return registry;
  }, [functionDefinitions, mentalHealthFunctions]); // Dependencies include function definitions and implementations

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

/**
 * Execute function implementation based on function name
 * This routes Supabase function calls to their actual implementations
 */
async function executeFunctionImplementation(functionName: string, args: unknown, mentalHealthFunctions: ReturnType<typeof useMentalHealthFunctionsV16>): Promise<unknown> {
  // console.log(`[triageAI] Routing function execution: ${functionName}`);

  // Enhanced logging for resource locator debugging
  if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_LOCATOR_LOGS === 'true' && 
      (functionName.includes('resource') || functionName.includes('locator') || functionName === 'search_resources_unified')) {
    console.log(`[resource_locator] 🎯 executeFunctionImplementation called`, {
      functionName,
      args,
      hasResourceSearchFunction: !!mentalHealthFunctions?.resourceSearchFunction,
      timestamp: new Date().toISOString()
    });
  }

  // Route to V16 function implementations

  switch (functionName) {
    case 'trigger_specialist_handoff':
      return await executeTriggerSpecialistHandoff(args);

    // V16 Mental Health Functions - Real Implementations
    case 'problem_solving_function':
      return await mentalHealthFunctions.problemSolvingFunction(args as Parameters<typeof mentalHealthFunctions.problemSolvingFunction>[0]);

    case 'screening_function':
      return await mentalHealthFunctions.screeningFunction(args as Parameters<typeof mentalHealthFunctions.screeningFunction>[0]);

    case 'getUserHistory_function':
      return await mentalHealthFunctions.getUserHistoryFunction(args as Parameters<typeof mentalHealthFunctions.getUserHistoryFunction>[0]);

    case 'logInteractionOutcome_function':
      return await mentalHealthFunctions.logInteractionOutcomeFunction(args as Parameters<typeof mentalHealthFunctions.logInteractionOutcomeFunction>[0]);

    case 'cultural_humility_function':
      return await mentalHealthFunctions.culturalHumilityFunction(args as Parameters<typeof mentalHealthFunctions.culturalHumilityFunction>[0]);

    case 'resource_search_function':
      return await mentalHealthFunctions.resourceSearchFunction(args as Parameters<typeof mentalHealthFunctions.resourceSearchFunction>[0]);
    
    case 'search_resources_unified':
      // search_resources_unified has different parameter names than resource_search_function
      // Map the parameters to match what resourceSearchFunction expects
      const unifiedParams = args as {
        query: string;
        resource_category: string;
        location: string;
        urgency?: string;
        age_group?: string;
        special_needs?: string[];
      };
      
      // Enhanced logging for resource locator debugging
      if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_LOCATOR_LOGS === 'true') {
        console.log(`[resource_locator] 🔄 Mapping search_resources_unified to resource_search_function`, {
          originalParams: unifiedParams,
          functionAvailable: !!mentalHealthFunctions?.resourceSearchFunction
        });
      }
      
      const mappedParams = {
        query: unifiedParams.query,
        resource_type: unifiedParams.resource_category, // Map resource_category -> resource_type
        location: unifiedParams.location,
        location_specific: true, // Since location is required in search_resources_unified
        mapView: false // Default to false, user can request map separately
      };
      
      if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_LOCATOR_LOGS === 'true') {
        console.log(`[resource_locator] 📤 Calling resourceSearchFunction with mapped params`, {
          mappedParams,
          timestamp: new Date().toISOString()
        });
      }
      
      return await mentalHealthFunctions.resourceSearchFunction(mappedParams);

    case 'end_session':
      return await mentalHealthFunctions.endSession();

    case 'report_technical_error':
      return await mentalHealthFunctions.reportTechnicalError(args as Parameters<typeof mentalHealthFunctions.reportTechnicalError>[0]);

    // Core Mental Health Functions - V16 Implementations
    case 'grounding_function':
      return await mentalHealthFunctions.groundingFunction(args as Parameters<typeof mentalHealthFunctions.groundingFunction>[0]);

    case 'thought_exploration_function':
      return await mentalHealthFunctions.thoughtExplorationFunction(args as Parameters<typeof mentalHealthFunctions.thoughtExplorationFunction>[0]);

    case 'crisis_response_function':
      return await mentalHealthFunctions.crisisResponseFunction(args as Parameters<typeof mentalHealthFunctions.crisisResponseFunction>[0]);

    case 'psychoeducation_function':
      return await mentalHealthFunctions.psychoeducationFunction(args as Parameters<typeof mentalHealthFunctions.psychoeducationFunction>[0]);

    case 'validation_function':
      return await mentalHealthFunctions.validationFunction(args as Parameters<typeof mentalHealthFunctions.validationFunction>[0]);

    case 'resource_feedback_function':
      return await mentalHealthFunctions.resourceFeedbackFunction(args as Parameters<typeof mentalHealthFunctions.resourceFeedbackFunction>[0]);

    // Utility Functions - V16 Implementations  
    case 'display_map_function':
      return await mentalHealthFunctions.displayMapFunction(args as Parameters<typeof mentalHealthFunctions.displayMapFunction>[0]);

    case 'pathway_exploration_function':
      return await mentalHealthFunctions.pathwayExplorationFunction(args as Parameters<typeof mentalHealthFunctions.pathwayExplorationFunction>[0]);

    // Futures/Guidance Functions - V16 Implementations
    case 'educational_guidance_function':
      return await mentalHealthFunctions.educationalGuidanceFunction(args as Parameters<typeof mentalHealthFunctions.educationalGuidanceFunction>[0]);

    case 'skill_building_function':
      return await mentalHealthFunctions.skillBuildingFunction(args as Parameters<typeof mentalHealthFunctions.skillBuildingFunction>[0]);

    case 'goal_planning_function':
      return await mentalHealthFunctions.goalPlanningFunction(args as Parameters<typeof mentalHealthFunctions.goalPlanningFunction>[0]);

    case 'futures_assessment_function':
      return await mentalHealthFunctions.futuresAssessmentFunction(args as Parameters<typeof mentalHealthFunctions.futuresAssessmentFunction>[0]);

    // Resource Locator Functions - V16 Implementations (using functionRegistry)
    case 'emergency_shelter_function':
    case 'food_assistance_function':
    case 'crisis_mental_health_function':
    case 'healthcare_access_function':
    case 'job_search_assistance_function':
    case 'lgbtq_support_function':
    case 'legal_aid_function':
    case 'educational_support_function':
    case 'transportation_assistance_function':
    case 'substance_abuse_support_function':
    case 'young_parent_support_function':
    case 'domestic_violence_support_function':
    case 'basic_needs_assistance_function':
    case 'community_programs_function':
    case 'resource_connection_function':
      // These use the function registry which contains factory implementations
      const registryFunction = mentalHealthFunctions.functionRegistry[functionName];
      if (registryFunction) {
        // console.log(`[triageAI] Executing ${functionName} from V16 registry`);
        return await registryFunction(args);
      } else {
        // BREAKING ERROR: Function should be in registry but isn't found
        const error = `CRITICAL ERROR: Function ${functionName} not found in V16 registry. This is a breaking error - function should be implemented.`;
        // console.error(`[triageAI] ${error}`);
        throw new Error(error);
      }

    default:
      // BREAKING ERROR: Unknown function called
      const error = `CRITICAL ERROR: Unknown function ${functionName} called. This is a breaking error - function is not implemented or recognized.`;
      // console.error(`[triageAI] ${error}`);
      throw new Error(error);
  }
}

/**
 * Get or create conversation ID using WebRTC store as single source of truth
 * 
 * CRITICAL: This function prevents the UUID format error that caused handoffs to fail.
 * 
 * NEVER generate client-side conversation IDs like `conv-${Date.now()}` - they are not valid UUIDs
 * and will cause "invalid input syntax for type uuid" errors in database operations.
 * 
 * ALWAYS use WebRTC store's createConversation() which creates proper database UUIDs.
 * The WebRTC store automatically syncs conversation IDs to localStorage for handoff compatibility.
 */
async function getOrCreateConversationId(): Promise<string> {
  // Check if conversation ID already exists in localStorage (synced from WebRTC store)
  // This localStorage value is ONLY set by WebRTC store's setConversationId() method
  let conversationId = typeof localStorage !== 'undefined' ?
    localStorage.getItem('currentConversationId') : null;

  if (conversationId) {
    // console.log(`[triageAI] Using existing conversation ID: ${conversationId}`);
    return conversationId;
  }

  // If no conversation ID exists, we need to create one through WebRTC store
  // This ensures we get a proper database-generated UUID, not a client-side fake ID
  // console.log(`[triageAI] No conversation ID found - creating via WebRTC store`);

  // Import and use WebRTC store's createConversation method
  // This calls /api/v15/create-conversation which generates proper UUIDs in the database
  const { useWebRTCStore } = await import('@/stores/webrtc-store');
  const webrtcStore = useWebRTCStore.getState();

  conversationId = await webrtcStore.createConversation();

  if (!conversationId) {
    throw new Error('Failed to create conversation through WebRTC store');
  }

  // Update the store state and localStorage (includes automatic localStorage sync)
  webrtcStore.setConversationId(conversationId);

  // console.log(`[triageAI] Successfully created conversation ID: ${conversationId}`);
  return conversationId;
}

/**
 * Execute the trigger_specialist_handoff function
 * This is the key V16 function that enables triage AI handoffs
 */
async function executeTriggerSpecialistHandoff(args: unknown): Promise<unknown> {
  const triggerTime = performance.now();
  const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);

  // Detect who is initiating the handoff
  let currentSpecialist = 'unknown';
  if (typeof window !== 'undefined' && (window as unknown as { useWebRTCStore: { getState: () => WebRTCStoreState } }).useWebRTCStore) {
    const webrtcState = (window as unknown as { useWebRTCStore: { getState: () => WebRTCStoreState } }).useWebRTCStore.getState();
    
    // Get current specialist from WebRTC store or conversation state
    const triageSession = webrtcState.triageSession;
    if (triageSession?.currentSpecialist) {
      currentSpecialist = triageSession.currentSpecialist;
    }
  }

  // Use different log prefix based on who's initiating
  const isSpecialistHandoff = currentSpecialist !== 'triage' && currentSpecialist !== 'unknown';
  const logPrefix = isSpecialistHandoff ? '[specialist_handoff]' : '[triage_handoff]';
  const enableLogs = isSpecialistHandoff 
    ? process.env.NEXT_PUBLIC_ENABLE_SPECIALIST_HANDOFF_LOGS === 'true'
    : process.env.NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS === 'true';

  // Client-side logging with environment variable
  if (enableLogs) {
    console.log(`${logPrefix} ===== SPECIALIST HANDOFF INITIATED =====`);
    console.log(`${logPrefix} Session ID: ${sessionId}`);
    console.log(`${logPrefix} Current specialist: ${currentSpecialist}`);
    console.log(`${logPrefix} Trigger time: ${triggerTime.toFixed(3)}ms`);
    console.log(`${logPrefix} TRIGGER_SPECIALIST_HANDOFF FUNCTION CALLED!`);
    console.log(`${logPrefix} Raw arguments received:`, args);
    console.log(`${logPrefix} Stack trace:`, new Error().stack);
    
    if (isSpecialistHandoff) {
      console.log(`${logPrefix} ⚠️ INTER-SPECIALIST HANDOFF DETECTED!`);
      console.log(`${logPrefix} From specialist: ${currentSpecialist}`);
    }
  }

  // Log WebRTC state at trigger time
  if (typeof window !== 'undefined' && (window as unknown as { useWebRTCStore: { getState: () => WebRTCStoreState } }).useWebRTCStore) {
    const webrtcState = (window as unknown as { useWebRTCStore: { getState: () => WebRTCStoreState } }).useWebRTCStore.getState();
    if (enableLogs) {
      console.log(`${logPrefix} WebRTC state at trigger:`, {
        isConnected: webrtcState.isConnected,
        isAudioPlaying: webrtcState.isAudioPlaying,
        currentVolume: webrtcState.currentVolume,
        connectionState: webrtcState.connectionState,
        conversationLength: webrtcState.conversation?.length || 0,
        hasActiveConversation: webrtcState.hasActiveConversation
      });
    }
  }

  const params = args as {
    specialist_type: string;
    reason: string;
    context_summary: string;
    urgency_level: string;
  };

  if (enableLogs) {
    console.log(`${logPrefix} ===== HANDOFF PARAMETERS =====`);
    console.log(`${logPrefix} Session ID: ${sessionId}`);
    console.log(`${logPrefix} Target specialist: ${params.specialist_type}`);
    console.log(`${logPrefix} Handoff reason: ${params.reason}`);
    console.log(`${logPrefix} Context summary: ${params.context_summary}`);
    console.log(`${logPrefix} Context summary length: ${params.context_summary?.length || 0} characters`);
    console.log(`${logPrefix} Urgency level: ${params.urgency_level}`);
    console.log(`${logPrefix} Timestamp: ${new Date().toISOString()}`);
    console.log(`${logPrefix} Time since page load: ${triggerTime.toFixed(3)}ms`);
    
    if (isSpecialistHandoff) {
      console.log(`${logPrefix} ⚠️ To specialist: ${params.specialist_type}`);
      console.log(`${logPrefix} ⚠️ This is an INTER-SPECIALIST transfer`);
    }
  }

  try {
    // Get or create conversation ID using WebRTC store as single source of truth
    const conversationId = await getOrCreateConversationId();
    if (enableLogs) {
      console.log(`${logPrefix} Using conversation ID: ${conversationId}`);
      console.log(`${logPrefix} Session ID: ${sessionId}`);
      console.log(`${logPrefix} ===== AUDIO BUFFER HANDLING =====`);
      console.log(`${logPrefix} Immediate handoff - no wait for output_audio_buffer.stopped`);
      console.log(`${logPrefix} Testing shows OpenAI does not send audio completion events for function-only responses`);
    }

    // EXPERIMENT RESULTS: Testing confirmed that OpenAI does NOT send output_audio_buffer.stopped events 
    // for function-only responses. The 30-second wait was causing unnecessary delays during handoff.
    // Based on production logs, OpenAI consistently fails to send audio completion events after function calls,
    // so we've eliminated the wait period to improve user experience.
    
    // Immediate handoff - no wait for output_audio_buffer.stopped
    const audioBufferStopped = await new Promise<boolean>((resolve) => {
      let eventReceived = false;

      const waitStartTime = performance.now();
      if (enableLogs) {
        console.log(`${logPrefix} 🚀 Immediate handoff - no wait for output_audio_buffer.stopped (based on test results)`);
      }

      // Set up listener for output_audio_buffer.stopped (kept for potential future analysis)
      const handleAudioBufferStopped = () => {
        if (!eventReceived) {
          eventReceived = true;
          const waitDuration = performance.now() - waitStartTime;
          if (enableLogs) {
            console.log(`${logPrefix} ✅ output_audio_buffer.stopped received after ${waitDuration.toFixed(3)}ms`);
          }
          clearTimeout(timeoutId);
          resolve(true);
        }
      };

      // Add event listener to WebRTC store if available
      if (typeof window !== 'undefined' && (window as unknown as { useWebRTCStore: { getState: () => WebRTCStoreState } }).useWebRTCStore) {
        const webrtcStore = (window as unknown as { useWebRTCStore: { getState: () => WebRTCStoreState } }).useWebRTCStore.getState();

        // Store original callback and create wrapper by using public updateCallbacks method
        if (webrtcStore.messageHandler?.updateCallbacks) {
          // Get current callbacks first (we'll assume they exist or create wrapper)
          const wrappedCallback = () => {
            if (enableLogs) {
              console.log(`${logPrefix} 📡 output_audio_buffer.stopped event intercepted in function wait`);
            }
            handleAudioBufferStopped();

            // Note: Original callback will be preserved by updateCallbacks merge
          };

          webrtcStore.messageHandler.updateCallbacks({
            onOutputAudioBufferStopped: wrappedCallback
          });

          if (enableLogs) {
            console.log(`${logPrefix} 👂 Event listener installed for output_audio_buffer.stopped`);
          }
        } else {
          if (enableLogs) {
            console.log(`${logPrefix} ⚠️ No message handler callbacks available for event listening`);
          }
        }
      }

      // Immediate timeout (0ms) - based on experiment results showing OpenAI doesn't send the event
      const timeoutId = setTimeout(() => {
        if (!eventReceived) {
          eventReceived = true;
          const waitDuration = performance.now() - waitStartTime;
          if (enableLogs) {
            console.log(`${logPrefix} ⚡ Immediate timeout (0ms) - proceeding with handoff`);
            console.log(`${logPrefix} Total wait time: ${waitDuration.toFixed(3)}ms`);
            console.log(`${logPrefix} Previous testing confirmed OpenAI does not send audio completion events for function-only responses`);
          }
          resolve(false);
        }
      }, 0);

      if (enableLogs) {
        console.log(`${logPrefix} ⚡ Immediate handoff mode - no waiting period`);
      }
    });

    // Prepare handoff data after waiting
    const handoffData = {
      specialistType: params.specialist_type,
      contextSummary: params.context_summary,
      conversationId: conversationId,
      reason: params.reason,
      urgencyLevel: params.urgency_level,
      sessionId: sessionId,
      triggeredAt: triggerTime,
      audioBufferStoppedReceived: audioBufferStopped
    };

    if (enableLogs) {
      console.log(`${logPrefix} ===== HANDOFF PREPARATION COMPLETE =====`);
      console.log(`${logPrefix} output_audio_buffer.stopped received: ${audioBufferStopped ? 'YES' : 'NO'}`);
      console.log(`${logPrefix} Now storing handoff parameters for dispatch`);
      console.log(`${logPrefix} Handoff data:`, handoffData);
      console.log(`${logPrefix} Total function execution time: ${(performance.now() - triggerTime).toFixed(3)}ms`);
      
      if (isSpecialistHandoff) {
        console.log(`${logPrefix} ⚠️ CRITICAL: Specialist ${currentSpecialist} -> ${params.specialist_type} handoff`);
        console.log(`${logPrefix} ⚠️ This should use seamless unified persona handoff`);
      }
    }

    // Store in WebRTC store
    if (typeof window !== 'undefined' && (window as unknown as { useWebRTCStore: { getState: () => WebRTCStoreState } }).useWebRTCStore) {
      const storeTime = performance.now();
      (window as unknown as { useWebRTCStore: { getState: () => WebRTCStoreState } }).useWebRTCStore.getState().storePendingHandoff(handoffData);
      if (enableLogs) {
        console.log(`${logPrefix} Handoff stored successfully in WebRTC store (${(performance.now() - storeTime).toFixed(3)}ms)`);
        console.log(`${logPrefix} Will dispatch when onResponseDone is received`);
      }
      // Use storeTime to avoid unused variable error
      void storeTime;

      // Verify storage
      const storedHandoff = (window as unknown as { useWebRTCStore: { getState: () => WebRTCStoreState } }).useWebRTCStore.getState().pendingHandoff;
      if (enableLogs) {
        console.log(`${logPrefix} Verification - stored handoff:`, storedHandoff ? 'FOUND' : 'NOT FOUND');
        if (storedHandoff) {
          console.log(`${logPrefix} Stored specialist type: ${storedHandoff.specialistType}`);
          console.log(`${logPrefix} Stored session ID: ${storedHandoff.sessionId}`);
        }
      }
    } else {
      if (enableLogs) {
        console.warn(`${logPrefix} WebRTC store not available - falling back to immediate dispatch`);
      }
      // Fallback to immediate dispatch if store not available
      const handoffEvent = new CustomEvent('specialist_handoff', {
        detail: handoffData
      });
      window.dispatchEvent(handoffEvent);
      if (enableLogs) {
        console.log(`${logPrefix} Immediate handoff event dispatched as fallback`);
      }
    }

    return {
      success: true,
      data: {
        message: `Handoff initiated to ${params.specialist_type} specialist. Please wait while I connect you...`,
        specialist_type: params.specialist_type,
        context_summary: params.context_summary,
        urgency_level: params.urgency_level
      }
    };
  } catch (error) {
    if (enableLogs) {
      console.error(`${logPrefix} ERROR in trigger_specialist_handoff:`, error);
      console.error(`${logPrefix} Stack trace:`, (error as Error).stack);
    }
    return {
      success: false,
      error: `${logPrefix} Failed to initiate handoff: ${(error as Error).message}`
    };
  }
}

// Note: No placeholder function needed - all functions must be properly implemented
// Fallbacks hide errors and are not acceptable in beta project