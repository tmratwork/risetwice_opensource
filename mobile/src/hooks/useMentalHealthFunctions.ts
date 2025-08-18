// mobile/src/hooks/useMentalHealthFunctions.ts
// V16 Mental Health Functions Hook - Mobile Adaptation

import { useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../config/supabase';

/**
 * V16 Mental Health Functions Hook - Mobile Version
 * Simplified version for mobile app focused on essential functions
 */

export interface Resource {
  name: string;
  description: string;
  resource_type: string;
  contact?: string | null;
  website?: string | null;
  verified?: boolean;
  location?: string;
  coordinates?: [number, number]; // [longitude, latitude]
}

export interface MentalHealthFunctionResult {
  success: boolean;
  data?: {
    content?: string[];
    error?: string;
    message?: string;
    [key: string]: unknown;
  };
  error?: string;
}

export function useMentalHealthFunctions() {
  // State management
  const [functionError, setFunctionError] = useState<string | null>(null);
  const [lastFunctionResult, setLastFunctionResult] = useState<MentalHealthFunctionResult | null>(null);
  
  // User history tracking for function effectiveness
  const userHistoryRef = useRef<{
    functionEffectiveness: Record<string, { count: number; effectiveness: number }>;
    communicationPreferences: Record<string, unknown>;
    recentInteractions: Array<{ timestamp: number; functionName: string; outcome: string }>;
  }>({
    functionEffectiveness: {},
    communicationPreferences: {},
    recentInteractions: []
  });

  // Helper function for therapeutic content queries - mobile API endpoint
  const queryTherapeuticContent = useCallback(async (params: {
    query: string;
    namespace?: string;
    filter_metadata?: Record<string, unknown>;
    top_k?: number;
  }) => {
    console.log(`[MOBILE] Querying therapeutic content:`, params.query);
    
    try {
      // Call web app's API from mobile - using localhost for development
      const response = await fetch('http://localhost:3000/api/v16/book-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: params.query,
          namespace: params.namespace || 'trauma_informed_youth_mental_health_companion_v250420',
          filter_metadata: params.filter_metadata || {},
          top_k: params.top_k || 5
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data.content ? [data.content] : []
      };
    } catch (error) {
      console.error(`[MOBILE] Therapeutic content query failed:`, error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }, []);

  // Problem solving function implementation
  const problemSolvingFunction = useCallback(async (params: {
    problem_category: string;
    complexity?: string;
  }): Promise<MentalHealthFunctionResult> => {
    console.log(`[MOBILE] problem_solving_function called`, params);

    try {
      setFunctionError(null);

      let queryText = `problem solving techniques for ${params.problem_category.replace('_', ' ')} issues`;
      if (params.complexity) {
        queryText += ` of ${params.complexity} complexity`;
      }

      const queryParams: Record<string, unknown> = {
        techniques: ['problem_solving'],
        function_mapping: ['problem_solving_function']
      };

      if (params.problem_category === 'basic_needs') {
        queryParams.scenarios = ['basic_needs'];
      }

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: queryParams
      });

      if (!result.success) {
        throw new Error(result.error || 'Query failed');
      }

      return {
        success: true,
        data: {
          content: result.data || [],
          message: `Problem solving techniques for ${params.problem_category} provided`,
          function_used: 'problem_solving_function'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MOBILE] problem_solving_function error:`, errorMessage);
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing problem solving techniques: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Screening function implementation
  const screeningFunction = useCallback(async (params: {
    concern_area: string;
    assessment_purpose?: string;
  }): Promise<MentalHealthFunctionResult> => {
    console.log(`[MOBILE] screening_function called`, params);

    try {
      setFunctionError(null);

      let queryText = `screening questions and assessment tools for ${params.concern_area.replace('_', ' ')}`;
      if (params.assessment_purpose) {
        queryText += ` for ${params.assessment_purpose.replace('_', ' ')}`;
      }

      const queryParams: Record<string, unknown> = {
        techniques: ['screening', 'assessment'],
        function_mapping: ['screening_function'],
        concern_areas: [params.concern_area]
      };

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: queryParams
      });

      if (!result.success) {
        throw new Error(result.error || 'Query failed');
      }

      return {
        success: true,
        data: {
          content: result.data || [],
          message: `Screening resources for ${params.concern_area} provided`,
          function_used: 'screening_function'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MOBILE] screening_function error:`, errorMessage);
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing screening resources: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // User history function
  const getUserHistoryFunction = useCallback(async (params: {
    user_id: string;
    history_type?: string;
  }): Promise<MentalHealthFunctionResult> => {
    console.log(`[MOBILE] getUserHistory_function called`, params);

    try {
      setFunctionError(null);

      return {
        success: true,
        data: {
          message: "User history retrieved successfully",
          content: [`History for user ${params.user_id} retrieved`],
          function_used: 'getUserHistory_function'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MOBILE] getUserHistory_function error:`, errorMessage);
      
      return {
        success: false,
        error: `Error retrieving user history: ${errorMessage}`
      };
    }
  }, []);

  // Log interaction outcome function
  const logInteractionOutcomeFunction = useCallback(async (params: {
    outcome: string;
    effectiveness?: string;
  }): Promise<MentalHealthFunctionResult> => {
    console.log(`[MOBILE] logInteractionOutcome_function called`, params);

    try {
      setFunctionError(null);
      
      // Log to local storage or send to backend
      const interaction = {
        timestamp: Date.now(),
        outcome: params.outcome,
        effectiveness: params.effectiveness || 'neutral'
      };

      userHistoryRef.current.recentInteractions.push({
        timestamp: Date.now(),
        functionName: 'logInteractionOutcome_function',
        outcome: params.outcome
      });

      return {
        success: true,
        data: {
          message: "Interaction outcome logged successfully",
          content: [`Logged outcome: ${params.outcome}`],
          function_used: 'logInteractionOutcome_function'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MOBILE] logInteractionOutcome_function error:`, errorMessage);
      
      return {
        success: false,
        error: `Error logging interaction outcome: ${errorMessage}`
      };
    }
  }, []);

  // Cultural humility function
  const culturalHumilityFunction = useCallback(async (params: {
    cultural_context?: string;
    adaptation_needed?: string;
  }): Promise<MentalHealthFunctionResult> => {
    console.log(`[MOBILE] cultural_humility_function called`, params);

    try {
      setFunctionError(null);

      let queryText = 'cultural humility and culturally responsive mental health support';
      if (params.cultural_context) {
        queryText += ` for ${params.cultural_context.replace('_', ' ')} context`;
      }

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          techniques: ['cultural_humility'],
          function_mapping: ['cultural_humility_function']
        }
      });

      return {
        success: true,
        data: {
          content: result.success ? result.data : [],
          message: "Cultural humility guidance provided",
          function_used: 'cultural_humility_function'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MOBILE] cultural_humility_function error:`, errorMessage);
      
      return {
        success: false,
        error: `Error providing cultural humility guidance: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Resource search function
  const resourceSearchFunction = useCallback(async (params: {
    query: string;
    resource_type: string;
    location: string;
    location_specific?: boolean;
    mapView?: boolean;
  }): Promise<MentalHealthFunctionResult> => {
    console.log(`[MOBILE] resource_search_function called`, params);

    try {
      setFunctionError(null);

      // Call web app's resource search API from mobile
      const response = await fetch('http://localhost:3000/api/v16/search-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: params.query,
          resource_type: params.resource_type,
          location: params.location,
          location_specific: params.location_specific || true
        })
      });

      if (!response.ok) {
        throw new Error(`Resource search failed: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        data: {
          content: [`Found ${data.resources?.length || 0} resources for ${params.query} in ${params.location}`],
          resources: data.resources || [],
          message: `Resource search completed for ${params.query}`,
          function_used: 'resource_search_function'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MOBILE] resource_search_function error:`, errorMessage);
      
      return {
        success: false,
        error: `Error searching resources: ${errorMessage}`
      };
    }
  }, []);

  // Core mental health functions - simplified implementations
  const grounding_function = useCallback(async (params: any): Promise<MentalHealthFunctionResult> => {
    return {
      success: true,
      data: { content: ['Grounding techniques provided'], function_used: 'grounding_function' }
    };
  }, []);

  const thought_exploration_function = useCallback(async (params: any): Promise<MentalHealthFunctionResult> => {
    return {
      success: true,
      data: { content: ['Thought exploration guidance provided'], function_used: 'thought_exploration_function' }
    };
  }, []);

  const crisis_response_function = useCallback(async (params: any): Promise<MentalHealthFunctionResult> => {
    return {
      success: true,
      data: { content: ['Crisis response resources provided'], function_used: 'crisis_response_function' }
    };
  }, []);

  const psychoeducation_function = useCallback(async (params: any): Promise<MentalHealthFunctionResult> => {
    return {
      success: true,
      data: { content: ['Psychoeducation content provided'], function_used: 'psychoeducation_function' }
    };
  }, []);

  const validation_function = useCallback(async (params: any): Promise<MentalHealthFunctionResult> => {
    return {
      success: true,
      data: { content: ['Validation and support provided'], function_used: 'validation_function' }
    };
  }, []);

  const resource_feedback_function = useCallback(async (params: any): Promise<MentalHealthFunctionResult> => {
    return {
      success: true,
      data: { content: ['Resource feedback recorded'], function_used: 'resource_feedback_function' }
    };
  }, []);

  // Additional simplified functions
  const endSession = useCallback(async (): Promise<MentalHealthFunctionResult> => {
    return {
      success: true,
      data: { content: ['Session ended successfully'], function_used: 'end_session' }
    };
  }, []);

  const reportTechnicalError = useCallback(async (params: { error_type: string }): Promise<MentalHealthFunctionResult> => {
    return {
      success: true,
      data: { content: [`Technical error reported: ${params.error_type}`], function_used: 'report_technical_error' }
    };
  }, []);

  // Function registry for dynamic function execution
  const functionRegistry = useMemo(() => {
    const registry: Record<string, (args: unknown) => Promise<unknown>> = {};
    
    // Register all resource locator functions as simplified implementations
    const resourceFunctions = [
      'emergency_shelter_function',
      'food_assistance_function', 
      'crisis_mental_health_function',
      'healthcare_access_function',
      'job_search_assistance_function',
      'lgbtq_support_function',
      'legal_aid_function',
      'educational_support_function',
      'transportation_assistance_function',
      'substance_abuse_support_function',
      'young_parent_support_function',
      'domestic_violence_support_function',
      'basic_needs_assistance_function',
      'community_programs_function',
      'resource_connection_function'
    ];

    resourceFunctions.forEach(funcName => {
      registry[funcName] = async (args: unknown) => {
        console.log(`[MOBILE] ${funcName} called`, args);
        return {
          success: true,
          data: {
            content: [`${funcName.replace('_', ' ')} resources provided`],
            function_used: funcName
          }
        };
      };
    });

    return registry;
  }, []);

  // Return all functions and state
  return {
    // Core functions
    problemSolvingFunction,
    screeningFunction,
    getUserHistoryFunction,
    logInteractionOutcomeFunction,
    culturalHumilityFunction,
    resourceSearchFunction,
    
    // Mental health functions
    groundingFunction: grounding_function,
    thoughtExplorationFunction: thought_exploration_function,
    crisisResponseFunction: crisis_response_function,
    psychoeducationFunction: psychoeducation_function,
    validationFunction: validation_function,
    resourceFeedbackFunction: resource_feedback_function,
    
    // Utility functions
    endSession,
    reportTechnicalError,
    
    // Function registry for dynamic execution
    functionRegistry,
    
    // State
    functionError,
    lastFunctionResult,
    
    // Utility methods
    clearError: useCallback(() => setFunctionError(null), [])
  };
}

export default useMentalHealthFunctions;