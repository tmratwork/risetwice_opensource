// src/hooksV16/use-mental-health-functions-v16.ts

"use client";

import { useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import audioLogger from '../hooksV15/audio/audio-logger';

/**
 * V16 Mental Health Functions Hook - Based on V15 Implementation
 * Provides all mental health function implementations for V16 triage/specialist system
 * Adapted from V15 functionality with V16-specific optimizations
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

export interface SearchHistoryEntry {
  id: string;
  timestamp: number;
  query: string;
  resource_type?: string;
  location?: string;
  results: {
    resources: Resource[];
    summary?: string;
    result_count?: number;
    [key: string]: unknown;
  };
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

/**
 * V16 Mental Health Functions Hook
 * Simplified version for V16 - focuses on essential functions for triage and specialists
 */
export function useMentalHealthFunctionsV16() {
  // State management
  const [functionError, setFunctionError] = useState<string | null>(null);
  const [lastFunctionResult, setLastFunctionResult] = useState<MentalHealthFunctionResult | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);
  
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

  // Helper function for therapeutic content queries (Pinecone)
  const queryTherapeuticContent = useCallback(async (params: {
    query: string;
    namespace?: string;
    filter_metadata?: Record<string, unknown>;
    top_k?: number;
  }) => {
    // console.log(`[V16] Querying therapeutic content:`, params.query);
    
    try {
      const response = await fetch('/api/v11/book-content', {
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
    // console.error(`[V16] Therapeutic content query failed:`, error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }, []);

  // Implementation for problem_solving_function
  const problemSolvingFunction = useCallback(async (params: {
    problem_category: string;
    complexity?: string;
  }): Promise<MentalHealthFunctionResult> => {
    // const requestId = Date.now().toString().slice(-6);

    // console.log(`[V16] problem_solving_function called with requestId: ${requestId}`);
    // console.log(`[triageAI] Problem category: ${params.problem_category}, complexity: ${params.complexity}`);

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

    // console.log(`[V16] problem_solving_function success for requestId: ${requestId}`);
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
    // console.error(`[V16] problem_solving_function error for requestId: ${requestId}: ${errorMessage}`);
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing problem solving techniques: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Implementation for screening_function
  const screeningFunction = useCallback(async (params: {
    concern_area: string;
    assessment_purpose?: string;
  }): Promise<MentalHealthFunctionResult> => {
    // const requestId = Date.now().toString().slice(-6);

    // console.log(`[V16] screening_function called with requestId: ${requestId}`);
    // console.log(`[triageAI] Concern area: ${params.concern_area}, purpose: ${params.assessment_purpose}`);

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

    // console.log(`[V16] screening_function success for requestId: ${requestId}`);
      return {
        success: true,
        data: {
          content: result.data || [],
          message: `Screening tools for ${params.concern_area} provided`,
          function_used: 'screening_function'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
    // console.error(`[V16] screening_function error for requestId: ${requestId}: ${errorMessage}`);
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing screening tools: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Implementation for getUserHistory_function
  const getUserHistoryFunction = useCallback(async (params: {
    history_type: string;
  }): Promise<MentalHealthFunctionResult> => {
    // const requestId = Date.now().toString().slice(-6);

    // console.log(`[V16] getUserHistory_function called with requestId: ${requestId}`);

    try {
      setFunctionError(null);

      const historyType = params.history_type;
      let result: unknown = {};

      switch (historyType) {
        case 'function_effectiveness':
          result = userHistoryRef.current.functionEffectiveness;
          break;
        case 'communication_preferences':
          result = userHistoryRef.current.communicationPreferences;
          break;
        case 'recent_interactions':
          result = userHistoryRef.current.recentInteractions.slice(-10);
          break;
        default:
          result = {
            function_effectiveness: userHistoryRef.current.functionEffectiveness,
            recent_interactions: userHistoryRef.current.recentInteractions.slice(-5)
          };
      }

    // console.log(`[V16] getUserHistory_function success for requestId: ${requestId}`);
      return {
        success: true,
        data: {
          history_type: historyType,
          data: result,
          message: `User history retrieved successfully`
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
    // console.error(`[V16] getUserHistory_function error for requestId: ${requestId}: ${errorMessage}`);
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error retrieving user history: ${errorMessage}`
      };
    }
  }, []);

  // Implementation for logInteractionOutcome_function
  const logInteractionOutcomeFunction = useCallback(async (params: {
    approach_used: string;
    effectiveness_rating: string;
    user_engagement?: string;
  }): Promise<MentalHealthFunctionResult> => {
    // const requestId = Date.now().toString().slice(-6);

    // console.log(`[V16] logInteractionOutcome_function called with requestId: ${requestId}`);

    try {
      setFunctionError(null);

      // Log to recent interactions
      userHistoryRef.current.recentInteractions.push({
        timestamp: Date.now(),
        functionName: params.approach_used,
        outcome: params.effectiveness_rating
      });

      // Update function effectiveness tracking
      const functionName = params.approach_used.includes('_function') 
        ? params.approach_used 
        : params.approach_used;

      if (!userHistoryRef.current.functionEffectiveness[functionName]) {
        userHistoryRef.current.functionEffectiveness[functionName] = {
          count: 0,
          effectiveness: 0
        };
      }

      userHistoryRef.current.functionEffectiveness[functionName].count += 1;

      const effectivenessScore =
        params.effectiveness_rating === 'high' ? 100 :
          params.effectiveness_rating === 'medium' ? 70 :
            params.effectiveness_rating === 'low' ? 30 : 50;

      const currentStats = userHistoryRef.current.functionEffectiveness[functionName];
      const newEffectiveness =
        (currentStats.effectiveness * (currentStats.count - 1) + effectivenessScore) /
        currentStats.count;

      userHistoryRef.current.functionEffectiveness[functionName].effectiveness = newEffectiveness;

    // console.log(`[V16] logInteractionOutcome_function success for requestId: ${requestId}`);

      return {
        success: true,
        data: {
          message: `Interaction outcome logged successfully`,
          function_used: 'logInteractionOutcome_function'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
    // console.error(`[V16] logInteractionOutcome_function error for requestId: ${requestId}: ${errorMessage}`);
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error logging interaction outcome: ${errorMessage}`
      };
    }
  }, []);

  // Implementation for cultural_humility_function
  const culturalHumilityFunction = useCallback(async (params: {
    identity_area: string;
    resource_type?: string;
  }): Promise<MentalHealthFunctionResult> => {
    // const requestId = Date.now().toString().slice(-6);

    // console.log(`[V16] cultural_humility_function called with requestId: ${requestId}`);

    try {
      setFunctionError(null);

      let queryText = `cultural humility approaches for ${params.identity_area.replace('_', ' ')} identity`;
      if (params.resource_type) {
        queryText += ` ${params.resource_type.replace('_', ' ')} resources`;
      }

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          techniques: ['cultural_humility'],
          identity_areas: [params.identity_area]
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Query failed');
      }

    // console.log(`[V16] cultural_humility_function success for requestId: ${requestId}`);
      return {
        success: true,
        data: {
          content: result.data || [],
          message: `Cultural humility guidance for ${params.identity_area} provided`,
          function_used: 'cultural_humility_function'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
    // console.error(`[V16] cultural_humility_function error for requestId: ${requestId}: ${errorMessage}`);
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing cultural humility guidance: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // NEW THERAPEUTIC CONTENT FUNCTIONS - V16 Implementation
  
  // Implementation for get_safety_triage_protocol
  const getSafetyTriageProtocol = useCallback(async (params: {
    risk_type: string;
    risk_level: string;
    session_context?: string;
  }): Promise<MentalHealthFunctionResult> => {
    try {
      setFunctionError(null);

      let queryText = `safety triage protocol for ${params.risk_type.replace('_', ' ')} at ${params.risk_level.replace('_', ' ')} risk level`;
      if (params.session_context) {
        queryText += ` with context: ${params.session_context}`;
      }

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'therapeutic_youth_v3',
        filter_metadata: {
          risk_type: params.risk_type,
          risk_level: params.risk_level,
          module: 'safety_triage'
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Query failed');
      }

      return {
        success: true,
        data: {
          content: result.data || [],
          message: `Safety triage protocol for ${params.risk_type} provided`,
          function_used: 'get_safety_triage_protocol'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error retrieving safety triage protocol: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Implementation for get_conversation_stance_guidance
  const getConversationStanceGuidance = useCallback(async (params: {
    interaction_type: string;
    user_emotional_intensity?: string;
    previous_interactions?: string[];
  }): Promise<MentalHealthFunctionResult> => {
    try {
      setFunctionError(null);

      let queryText = `conversation stance guidance for ${params.interaction_type.replace('_', ' ')}`;
      if (params.user_emotional_intensity) {
        queryText += ` with ${params.user_emotional_intensity} emotional intensity`;
      }

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'therapeutic_youth_v3',
        filter_metadata: {
          interaction_type: params.interaction_type,
          emotional_intensity: params.user_emotional_intensity,
          module: 'conversation_stance'
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Query failed');
      }

      return {
        success: true,
        data: {
          content: result.data || [],
          message: `Conversation stance guidance for ${params.interaction_type} provided`,
          function_used: 'get_conversation_stance_guidance'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error retrieving conversation stance guidance: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Implementation for get_assessment_protocol
  const getAssessmentProtocol = useCallback(async (params: {
    assessment_stage: string;
    presenting_issue?: string;
    repeat_topic?: boolean;
  }): Promise<MentalHealthFunctionResult> => {
    try {
      setFunctionError(null);

      let queryText = `assessment protocol for ${params.assessment_stage.replace('_', ' ')} stage`;
      if (params.presenting_issue) {
        queryText += ` regarding ${params.presenting_issue}`;
      }

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'therapeutic_youth_v3',
        filter_metadata: {
          assessment_stage: params.assessment_stage,
          presenting_issue: params.presenting_issue,
          repeat_topic: params.repeat_topic,
          module: 'assessment_protocol'
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Query failed');
      }

      return {
        success: true,
        data: {
          content: result.data || [],
          message: `Assessment protocol for ${params.assessment_stage} stage provided`,
          function_used: 'get_assessment_protocol'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error retrieving assessment protocol: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Implementation for get_continuity_framework
  const getContinuityFramework = useCallback(async (params: {
    continuity_type: string;
    conversation_history_summary?: string;
  }): Promise<MentalHealthFunctionResult> => {
    try {
      setFunctionError(null);

      let queryText = `continuity framework for ${params.continuity_type.replace('_', ' ')}`;
      if (params.conversation_history_summary) {
        queryText += ` with history: ${params.conversation_history_summary}`;
      }

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'therapeutic_youth_v3',
        filter_metadata: {
          continuity_type: params.continuity_type,
          module: 'continuity_framework'
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Query failed');
      }

      return {
        success: true,
        data: {
          content: result.data || [],
          message: `Continuity framework for ${params.continuity_type} provided`,
          function_used: 'get_continuity_framework'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error retrieving continuity framework: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Implementation for get_cbt_intervention
  const getCbtIntervention = useCallback(async (params: {
    intervention_submodule: string;
    conversation_step: string;
    user_situation?: string;
    distortion_type?: string;
  }): Promise<MentalHealthFunctionResult> => {
    try {
      setFunctionError(null);

      let queryText = `CBT ${params.intervention_submodule.replace('_', ' ')} intervention at ${params.conversation_step.replace('_', ' ')} step`;
      if (params.user_situation) {
        queryText += ` for situation: ${params.user_situation}`;
      }
      if (params.distortion_type) {
        queryText += ` addressing ${params.distortion_type.replace('_', ' ')} distortion`;
      }

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'therapeutic_youth_v3',
        filter_metadata: {
          intervention_submodule: params.intervention_submodule,
          conversation_step: params.conversation_step,
          distortion_type: params.distortion_type,
          module: 'cbt_intervention'
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Query failed');
      }

      return {
        success: true,
        data: {
          content: result.data || [],
          message: `CBT ${params.intervention_submodule} intervention provided`,
          function_used: 'get_cbt_intervention'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error retrieving CBT intervention: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Implementation for get_dbt_skills
  const getDbtSkills = useCallback(async (params: {
    skill_submodule: string;
    skill_application: string;
    user_distress_level?: string;
    interpersonal_situation?: string;
  }): Promise<MentalHealthFunctionResult> => {
    try {
      setFunctionError(null);

      let queryText = `DBT ${params.skill_submodule.replace('_', ' ')} skill for ${params.skill_application.replace('_', ' ')}`;
      if (params.user_distress_level) {
        queryText += ` at ${params.user_distress_level} distress level`;
      }
      if (params.interpersonal_situation) {
        queryText += ` in situation: ${params.interpersonal_situation}`;
      }

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'therapeutic_youth_v3',
        filter_metadata: {
          skill_submodule: params.skill_submodule,
          skill_application: params.skill_application,
          distress_level: params.user_distress_level,
          module: 'dbt_skills'
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Query failed');
      }

      return {
        success: true,
        data: {
          content: result.data || [],
          message: `DBT ${params.skill_submodule} skill provided`,
          function_used: 'get_dbt_skills'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error retrieving DBT skills: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Implementation for get_trauma_informed_approach
  const getTraumaInformedApproach = useCallback(async (params: {
    trauma_submodule: string;
    trauma_response_detected?: boolean;
    user_choice?: string;
    parts_identified?: string[];
  }): Promise<MentalHealthFunctionResult> => {
    try {
      setFunctionError(null);

      let queryText = `trauma informed ${params.trauma_submodule.replace('_', ' ')} approach`;
      if (params.user_choice) {
        queryText += ` with ${params.user_choice.replace('_', ' ')} preference`;
      }
      if (params.parts_identified?.length) {
        queryText += ` addressing parts: ${params.parts_identified.join(', ')}`;
      }

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'therapeutic_youth_v3',
        filter_metadata: {
          trauma_submodule: params.trauma_submodule,
          trauma_response_detected: params.trauma_response_detected,
          user_choice: params.user_choice,
          module: 'trauma_informed_approach'
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Query failed');
      }

      return {
        success: true,
        data: {
          content: result.data || [],
          message: `Trauma-informed ${params.trauma_submodule} approach provided`,
          function_used: 'get_trauma_informed_approach'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error retrieving trauma-informed approach: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Implementation for get_substance_use_support
  const getSubstanceUseSupport = useCallback(async (params: {
    mi_submodule: string;
    substance_mentioned?: string;
    change_readiness?: string;
    ambivalence_area?: string;
  }): Promise<MentalHealthFunctionResult> => {
    try {
      setFunctionError(null);

      let queryText = `substance use support using ${params.mi_submodule.replace('_', ' ')} approach`;
      if (params.substance_mentioned) {
        queryText += ` for ${params.substance_mentioned} use`;
      }
      if (params.change_readiness) {
        queryText += ` at ${params.change_readiness} stage`;
      }
      if (params.ambivalence_area) {
        queryText += ` exploring ${params.ambivalence_area.replace('_', ' ')}`;
      }

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'therapeutic_youth_v3',
        filter_metadata: {
          mi_submodule: params.mi_submodule,
          substance_mentioned: params.substance_mentioned,
          change_readiness: params.change_readiness,
          ambivalence_area: params.ambivalence_area,
          module: 'substance_use_support'
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Query failed');
      }

      return {
        success: true,
        data: {
          content: result.data || [],
          message: `Substance use support using ${params.mi_submodule} approach provided`,
          function_used: 'get_substance_use_support'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error retrieving substance use support: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Implementation for get_practical_support_guidance
  const getPracticalSupportGuidance = useCallback(async (params: {
    support_type: string;
    resource_category?: string;
    urgency_context?: string;
  }): Promise<MentalHealthFunctionResult> => {
    try {
      setFunctionError(null);

      let queryText = `practical support guidance for ${params.support_type.replace('_', ' ')}`;
      if (params.resource_category) {
        queryText += ` in ${params.resource_category} category`;
      }
      if (params.urgency_context) {
        queryText += ` with ${params.urgency_context} urgency`;
      }

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'therapeutic_youth_v3',
        filter_metadata: {
          support_type: params.support_type,
          resource_category: params.resource_category,
          urgency_context: params.urgency_context,
          module: 'practical_support_guidance'
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Query failed');
      }

      return {
        success: true,
        data: {
          content: result.data || [],
          message: `Practical support guidance for ${params.support_type} provided`,
          function_used: 'get_practical_support_guidance'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error retrieving practical support guidance: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Implementation for get_acute_distress_protocol
  const getAcuteDistressProtocol = useCallback(async (params: {
    distress_type: string;
    grounding_technique?: string;
    entry_criteria_met: boolean;
  }): Promise<MentalHealthFunctionResult> => {
    try {
      setFunctionError(null);

      // Strict entry criteria check
      if (!params.entry_criteria_met) {
        return {
          success: false,
          error: 'Entry criteria not met for acute distress protocol - requires both acute present-moment distress AND direct request for help'
        };
      }

      let queryText = `acute distress protocol for ${params.distress_type.replace('_', ' ')}`;
      if (params.grounding_technique) {
        queryText += ` using ${params.grounding_technique.replace('_', ' ')} technique`;
      }

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'therapeutic_youth_v3',
        filter_metadata: {
          distress_type: params.distress_type,
          grounding_technique: params.grounding_technique,
          module: 'acute_distress_protocol'
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Query failed');
      }

      return {
        success: true,
        data: {
          content: result.data || [],
          message: `Acute distress protocol for ${params.distress_type} provided`,
          function_used: 'get_acute_distress_protocol'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error retrieving acute distress protocol: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Implementation for resource_search_function
  const resourceSearchFunction = useCallback(async (params: {
    query: string;
    resource_type?: string;
    location?: string;
    location_specific?: boolean;
    mapView?: boolean;
  }): Promise<MentalHealthFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    // Add detailed logging following docs/logging_method.md
    const logResourceLocator = (message: string, ...args: unknown[]) => {
      if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_LOCATOR_LOGS === 'true') {
        console.log(`[resource_locator] ${message}`, ...args);
      }
    };

    logResourceLocator(`=== RESOURCE_SEARCH_FUNCTION CALLED ===`);
    logResourceLocator(`Request ID: ${requestId}`);
    logResourceLocator(`Query: "${params.query}"`);
    logResourceLocator(`Resource type: ${params.resource_type || 'not specified'}`);
    logResourceLocator(`Location: ${params.location || 'not specified'}`);
    logResourceLocator(`Location specific: ${params.location_specific ? 'yes' : 'no'}`);
    logResourceLocator(`Map view: ${params.mapView ? 'yes' : 'no'}`);

    try {
      setFunctionError(null);

      // Trigger streaming search toast
      if (typeof window !== 'undefined') {
        const toastEvent = new CustomEvent('show_search_toast', {
          detail: {
            searchId: `search-${requestId}`,
            requestId: requestId,
            query: params.query,
            location: params.location,
            resourceType: params.resource_type,
            enableStreaming: true // Enable streaming progress
          }
        });
        window.dispatchEvent(toastEvent);
        logResourceLocator(`🍞 Toast event dispatched for streaming search`);
      }

      logResourceLocator(`Sending request to V11 API endpoint`);
      const startTime = performance.now();
      
      // Get userId from localStorage for progress tracking
      const userId = localStorage.getItem('userId');
      
      const response = await fetch('/api/v11/resource-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: params.query,
          resource_type: params.resource_type,
          location: params.location,
          location_specific: params.location_specific || false,
          mapView: params.mapView || false,
          requestId: requestId, // Pass requestId for streaming
          userId: userId || undefined // Pass userId for Supabase realtime progress
        })
      });

      const endTime = performance.now();
      logResourceLocator(`API request completed in ${(endTime - startTime).toFixed(2)}ms`);
      logResourceLocator(`Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        logResourceLocator(`❌ API error response (${response.status}): ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      logResourceLocator(`API response received successfully`);
      logResourceLocator(`Found ${data.results?.resources?.length || 0} resources`);
      logResourceLocator(`Response summary: ${data.results?.summary?.substring(0, 100)}...`);
      logResourceLocator(`Has resources with locations: ${data.results?.resources?.some((r: Resource) => r.location) ? 'yes' : 'no'}`);

      // Add to search history using the correct data structure from V11 API
      const historyEntry: SearchHistoryEntry = {
        id: `search-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        timestamp: Date.now(),
        query: params.query,
        resource_type: params.resource_type,
        location: params.location,
        results: {
          resources: data.results?.resources || [],
          summary: data.results?.summary,
          result_count: data.results?.resources?.length || 0
        }
      };

      setSearchHistory(prev => [historyEntry, ...prev.slice(0, 19)]); // Keep last 20

      // Store search data for feedback collection
      if (typeof window !== 'undefined') {
        const existingSearches = JSON.parse(sessionStorage.getItem('resource_searches') || '[]');
        existingSearches.push(historyEntry);
        sessionStorage.setItem('resource_searches', JSON.stringify(existingSearches));
      }

      // Check for automatic map display - same logic as performResourceSearch
      const hasResourcesWithLocations = data.results?.resources?.some((r: Resource) => r.location);
      let mapMessage = '';
      let autoMapTriggered = false;

      logResourceLocator(`Resources with locations: ${hasResourcesWithLocations ? 'yes' : 'no'}`);
      logMapFunction('🗺️ MAP DISPLAY LOGIC - Resources analysis (from resource_search_function)', {
        hasResourcesWithLocations,
        totalResources: data.results?.resources?.length || 0,
        resourcesWithLocation: data.results?.resources?.filter((r: Resource) => r.location)?.length || 0,
        allResourceLocations: data.results?.resources?.map((r: Resource) => ({ name: r.name, location: r.location })) || [],
        mapViewRequested: params.mapView
      });
      
      if (hasResourcesWithLocations && typeof window !== 'undefined') {
        logResourceLocator(`Triggering automatic map display for search ID: ${historyEntry.id}`);
        logMapFunction('🔄 TRIGGERING MAP DISPLAY EVENT (from resource_search_function)', {
          searchId: historyEntry.id,
          eventType: 'display_resource_map',
          windowAvailable: typeof window !== 'undefined',
          timestamp: new Date().toISOString()
        });
        
        const event = new CustomEvent('display_resource_map', { detail: { searchId: historyEntry.id } });
        logMapFunction('🗺️ Event created, about to dispatch (from resource_search_function)', {
          eventType: event.type,
          eventDetail: event.detail,
          eventTarget: 'window'
        });
        
        window.dispatchEvent(event);
        autoMapTriggered = true;
        mapMessage = "\n\nI've automatically displayed these resources on a map so you can see their locations.";
        
        logMapFunction('✅ Map display event dispatched successfully (from resource_search_function)', {
          searchId: historyEntry.id,
          autoMapTriggered,
          mapMessage: mapMessage.trim()
        });
      } else {
        logMapFunction('❌ MAP DISPLAY SKIPPED (from resource_search_function)', {
          hasResourcesWithLocations,
          windowAvailable: typeof window !== 'undefined',
          reason: !hasResourcesWithLocations ? 'No resources with locations' : 'Window not available'
        });
      }

      logResourceLocator(`✅ Resource search completed successfully`);
      logResourceLocator(`Search ID: ${historyEntry.id}`);
      logResourceLocator(`Resources found: ${data.results?.resources?.length || 0}`);
      logResourceLocator(`Added to search history (total: ${searchHistory.length + 1})`);
      logResourceLocator(`Map triggered: ${autoMapTriggered ? 'yes' : 'no'}`);
      
      logMapFunction('🏁 RESOURCE SEARCH COMPLETION SUMMARY (from resource_search_function)', {
        searchId: historyEntry.id,
        autoMapTriggered,
        hasResourcesWithLocations,
        mapMessageIncluded: !!mapMessage,
        timestamp: new Date().toISOString()
      });
      
      const finalMessage = data.results?.formatted_response || `Found ${data.results?.resources?.length || 0} resources for "${params.query}"`;
      
      // Trigger search completion toast
      if (typeof window !== 'undefined') {
        const completionEvent = new CustomEvent('search_toast_complete', {
          detail: {
            searchId: `search-${requestId}`,
            success: true,
            resultCount: data.results?.resources?.length || 0,
            message: `Found ${data.results?.resources?.length || 0} resources!`
          }
        });
        window.dispatchEvent(completionEvent);
        logResourceLocator(`🍞 Completion toast event dispatched`);
      }
      
      return {
        success: true,
        data: {
          resources: data.results?.resources || [],
          summary: data.results?.summary,
          result_count: data.results?.resources?.length || 0,
          search_id: historyEntry.id,
          message: finalMessage + mapMessage,
          function_used: 'resource_search_function'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logResourceLocator(`❌ Resource search failed: ${errorMessage}`);
      logResourceLocator(`Error details:`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        query: params.query,
        resource_type: params.resource_type,
        location: params.location
      });
      
      // Trigger error completion toast
      if (typeof window !== 'undefined') {
        const errorEvent = new CustomEvent('search_toast_complete', {
          detail: {
            searchId: `search-${requestId}`,
            success: false,
            error: errorMessage,
            message: `Search failed: ${errorMessage}`
          }
        });
        window.dispatchEvent(errorEvent);
        logResourceLocator(`🍞 Error completion toast event dispatched`);
      }
      
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error searching resources: ${errorMessage}`
      };
    }
  }, [searchHistory.length]);

  // Implementation for end_session
  const endSession = useCallback(async (): Promise<MentalHealthFunctionResult> => {
    // const requestId = Date.now().toString().slice(-6);

    // console.log(`[V16] end_session called with requestId: ${requestId}`);

    try {
      // Log session end
      userHistoryRef.current.recentInteractions.push({
        timestamp: Date.now(),
        functionName: 'end_session',
        outcome: 'completed'
      });

    // console.log(`[V16] end_session success for requestId: ${requestId}`);
      return {
        success: true,
        data: {
          message: 'Session ended successfully',
          function_used: 'end_session'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
    // console.error(`[V16] end_session error for requestId: ${requestId}: ${errorMessage}`);

      return {
        success: false,
        error: `Error ending session: ${errorMessage}`
      };
    }
  }, []);

  // Implementation for report_technical_error
  const reportTechnicalError = useCallback(async (params: {
    error_type: string;
    function_name: string;
    error_message?: string;
  }): Promise<MentalHealthFunctionResult> => {
    // const requestId = Date.now().toString().slice(-6);

    // console.log(`[V16] report_technical_error called with requestId: ${requestId}`);

    try {
    // console.error(`[V16] Technical error reported: ${params.error_type} in ${params.function_name}: ${params.error_message}`);

      return {
        success: true,
        data: {
          message: 'Technical error reported successfully',
          error_type: params.error_type,
          function_name: params.function_name,
          function_used: 'report_technical_error'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
    // console.error(`[V16] report_technical_error error for requestId: ${requestId}: ${errorMessage}`);

      return {
        success: false,
        error: `Error reporting technical error: ${errorMessage}`
      };
    }
  }, []);

  // Implementation for grounding_function
  const groundingFunction = useCallback(async (params: {
    distress_level: string;
    technique_type?: string;
  }): Promise<MentalHealthFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    // console.log(`[V16] grounding_function called with requestId: ${requestId}`);
    audioLogger.info('function', 'grounding_function_called', {
      requestId,
      distress_level: params.distress_level,
      technique_type: params.technique_type
    });

    try {
      setFunctionError(null);

      // Build query for book content
      let additionalKeywords = '';
      if (params.technique_type) {
        switch (params.technique_type) {
          case '5-4-3-2-1':
            additionalKeywords = '5-4-3-2-1 sensory grounding';
            break;
          case 'body_scan':
            additionalKeywords = 'body scan mindfulness';
            break;
          case 'breathing':
            additionalKeywords = 'breathing exercise deep breath';
            break;
          case 'physical':
            additionalKeywords = 'physical grounding movement';
            break;
          case 'mental':
            additionalKeywords = 'mental grounding cognitive';
            break;
          case 'present_moment':
            additionalKeywords = 'present moment awareness now';
            break;
        }
      }

      const result = await queryTherapeuticContent({
        query: `grounding techniques for ${params.distress_level} distress ${additionalKeywords}`,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          techniques: ['grounding'],
          scenarios: ['distress'],
          urgency_level: params.distress_level
        }
      });

    // console.log(`[V16] grounding_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'grounding_function_success', { requestId });
      
      return {
        success: true,
        data: {
          content: result.data || [],
          message: `Grounding techniques for ${params.distress_level} distress provided`,
          function_used: 'grounding_function'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
    // console.log(`[V16] grounding_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'grounding_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing grounding techniques: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Implementation for thought_exploration_function
  const thoughtExplorationFunction = useCallback(async (params: {
    thought_type: string;
    related_emotion?: string;
  }): Promise<MentalHealthFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    // console.log(`[V16] thought_exploration_function called with requestId: ${requestId}`);
    audioLogger.info('function', 'thought_exploration_function_called', {
      requestId,
      thought_type: params.thought_type,
      related_emotion: params.related_emotion
    });

    try {
      setFunctionError(null);

      let queryText = `cognitive behavioral therapy for ${params.thought_type.replace('_', ' ')} thoughts`;
      if (params.related_emotion) {
        queryText += ` related to ${params.related_emotion} emotions`;
      }

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          techniques: ['CBT'],
          function_mapping: ['thought_exploration_function']
        }
      });

    // console.log(`[V16] thought_exploration_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'thought_exploration_function_success', { requestId });
      
      return {
        success: true,
        data: {
          content: result.data || [],
          message: `Thought exploration techniques for ${params.thought_type} provided`,
          function_used: 'thought_exploration_function'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
    // console.log(`[V16] thought_exploration_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'thought_exploration_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing thought exploration techniques: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Implementation for crisis_response_function
  const crisisResponseFunction = useCallback(async (params: {
    crisis_type: string;
    urgency_level: string;
  }): Promise<MentalHealthFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    // console.log(`[V16] crisis_response_function called with requestId: ${requestId}`);
    // console.error(`[V16] ⚠️ CRITICAL: Crisis response activated for ${params.crisis_type} at ${params.urgency_level} urgency level`);
    audioLogger.info('function', 'crisis_response_function_called', {
      requestId,
      crisis_type: params.crisis_type,
      urgency_level: params.urgency_level
    });

    try {
      setFunctionError(null);

      const queryParams: Record<string, unknown> = {
        function_mapping: ['crisis_response_function'],
        urgency_level: 'high',
        scenarios: ['safety_concern']
      };

      if (params.crisis_type === 'suicide' || params.crisis_type === 'self_harm') {
        (queryParams.scenarios as string[]).push('distress');
      }

      const queryText = `crisis response protocol for ${params.crisis_type.replace('_', ' ')} with ${params.urgency_level} urgency`;

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: queryParams
      });

    // console.log(`[V16] crisis_response_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'crisis_response_function_success', { requestId });
      
      return {
        success: true,
        data: {
          content: result.data || [],
          message: `Crisis response guidance for ${params.crisis_type} provided`,
          function_used: 'crisis_response_function',
          crisis_level: params.urgency_level
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
    // console.log(`[V16] crisis_response_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'crisis_response_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      // Critical: Even if there's an error, provide a fallback crisis message
      return {
        success: true, // Mark as successful so the AI can respond
        data: {
          message: "I'm concerned about your safety. It's important that you talk to someone who can help immediately. Please call the 988 Suicide and Crisis Lifeline at 988, text HOME to 741741 to reach the Crisis Text Line, or go to your nearest emergency room. Would you like me to provide more resources or help you think through your next steps to stay safe right now?",
          error_occurred: true,
          function_used: 'crisis_response_function'
        }
      };
    }
  }, [queryTherapeuticContent]);

  // Implementation for psychoeducation_function
  const psychoeducationFunction = useCallback(async (params: {
    topic: string;
    information_type?: string;
  }): Promise<MentalHealthFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    // console.log(`[V16] psychoeducation_function called with requestId: ${requestId}`);
    audioLogger.info('function', 'psychoeducation_function_called', {
      requestId,
      topic: params.topic,
      information_type: params.information_type
    });

    try {
      setFunctionError(null);

      let queryText = `psychoeducation about ${params.topic.replace('_', ' ')}`;
      if (params.information_type) {
        queryText += ` with focus on ${params.information_type.replace('_', ' ')}`;
      }

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          function_mapping: ['psychoeducation_function']
        }
      });

    // console.log(`[V16] psychoeducation_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'psychoeducation_function_success', { requestId });
      
      return {
        success: true,
        data: {
          content: result.data || [],
          message: `Educational content about ${params.topic} provided`,
          function_used: 'psychoeducation_function'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
    // console.log(`[V16] psychoeducation_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'psychoeducation_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing psychoeducational content: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Implementation for validation_function
  const validationFunction = useCallback(async (params: {
    emotion: string;
    validation_type?: string;
  }): Promise<MentalHealthFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    // console.log(`[V16] validation_function called with requestId: ${requestId}`);
    audioLogger.info('function', 'validation_function_called', {
      requestId,
      emotion: params.emotion,
      validation_type: params.validation_type
    });

    try {
      setFunctionError(null);

      let queryText = `validation techniques for ${params.emotion.replace('_', ' ')} emotions`;
      if (params.validation_type) {
        queryText += ` using ${params.validation_type.replace('_', ' ')} approach`;
      }

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          techniques: ['validation'],
          function_mapping: ['validation_function']
        }
      });

    // console.log(`[V16] validation_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'validation_function_success', { requestId });
      
      return {
        success: true,
        data: {
          content: result.data || [],
          message: `Validation techniques for ${params.emotion} emotions provided`,
          function_used: 'validation_function'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
    // console.log(`[V16] validation_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'validation_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing validation techniques: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Implementation for resource_feedback_function
  const resourceFeedbackFunction = useCallback(async (params: {
    searchId: string;
    helpful: boolean;
    resource_name?: string;
    comment?: string;
  }): Promise<MentalHealthFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    // console.log(`[V16] resource_feedback_function called with requestId: ${requestId}`);
    audioLogger.info('function', 'resource_feedback_function_called', {
      requestId,
      searchId: params.searchId,
      helpful: params.helpful
    });

    try {
      setFunctionError(null);
      const userId = localStorage.getItem('userId');

      const existingSearches = JSON.parse(sessionStorage.getItem('resource_searches') || '[]');
      const searchData = existingSearches.find((s: SearchHistoryEntry) => s.id === params.searchId);

      if (!searchData) {
    // console.warn(`[V16] No search data found for ID: ${params.searchId}`);
      }

      const feedbackData = {
        search_log_id: params.searchId,
        resource_name: params.resource_name || 'general feedback',
        helpful: params.helpful,
        comment: params.comment || '',
        user_id: userId || null,
        timestamp: new Date().toISOString()
      };

      if (userId) {
        try {
          const { error } = await supabase
            .from('resource_feedback')
            .insert([feedbackData]);

          if (error) {
    // console.error(`[V16] Failed to log feedback: ${error.message}`);
          } else {
    // console.log(`[V16] Feedback logged successfully`);
          }
        } catch (logError) {
    // console.error(`[V16] Exception logging feedback: ${(logError as Error).message}`);
          // Use logError to avoid unused variable error
          void logError;
        }
      }

    // console.log(`[V16] resource_feedback_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'resource_feedback_function_success', { requestId });

      return {
        success: true,
        data: {
          message: params.helpful
            ? "I'm glad these resources were helpful. Is there anything specific about these resources you'd like to discuss further?"
            : "I understand these resources weren't what you needed. Let me try to find different options that might be more helpful.",
          function_used: 'resource_feedback_function'
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
    // console.log(`[V16] resource_feedback_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'resource_feedback_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: "Thank you for your feedback. I'll make note of this to help improve future resource recommendations."
      };
    }
  }, []);

  // Helper function for map logging
  const logMapFunction = (message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_MAP_FUNCTION_LOGS === 'true') {
      console.log(`[map_function] ${message}`, ...args);
    }
  };

  // Implementation for display_map_function
  const displayMapFunction = useCallback(async (params: {
    searchId: string;
  }): Promise<MentalHealthFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    logMapFunction('🚀 display_map_function CALLED', {
      requestId,
      searchId: params.searchId,
      timestamp: new Date().toISOString()
    });

    audioLogger.info('function', 'display_map_function_called', {
      requestId,
      searchId: params.searchId
    });

    try {
      setFunctionError(null);
      logMapFunction('✅ Function error state cleared');

      if (typeof window !== 'undefined') {
        logMapFunction('🌍 Window environment detected - proceeding with map display');
        
        const existingSearches = JSON.parse(sessionStorage.getItem('resource_searches') || '[]');
        logMapFunction('📋 Retrieved existing searches from sessionStorage', {
          totalSearches: existingSearches.length,
          searchIds: existingSearches.map((s: SearchHistoryEntry) => s.id)
        });
        
        const searchData = existingSearches.find((s: SearchHistoryEntry) => s.id === params.searchId);
        
        if (!searchData) {
          logMapFunction('❌ SEARCH DATA NOT FOUND', {
            requestedSearchId: params.searchId,
            availableSearchIds: existingSearches.map((s: SearchHistoryEntry) => s.id),
            sessionStorageContent: existingSearches
          });
          
          return {
            success: false,
            error: "I couldn't find the search data to display on the map. Let's try a new search."
          };
        }

        logMapFunction('✅ Search data found successfully', {
          searchId: params.searchId,
          resourceCount: searchData.results?.resources?.length || 0,
          hasResources: !!(searchData.results?.resources?.length),
          resourcesWithLocation: searchData.results?.resources?.filter((r: Resource) => r.location)?.length || 0
        });

        logMapFunction('🎯 Dispatching display_resource_map event', {
          eventType: 'display_resource_map',
          searchId: params.searchId,
          eventDetail: { searchId: params.searchId }
        });

        const event = new CustomEvent('display_resource_map', {
          detail: { searchId: params.searchId }
        });
        window.dispatchEvent(event);
        
        logMapFunction('✅ Event dispatched successfully');
        
        // Log window event listeners for debugging
        logMapFunction('🔍 Current window event listeners check', {
          hasEventListeners: !!(window as Window & { _eventListeners?: unknown })._eventListeners,
          windowKeys: Object.keys(window).filter(key => key.includes('event') || key.includes('listener'))
        });

        audioLogger.info('function', 'display_map_function_success', { requestId });
        
        const successResponse = {
          success: true,
          message: "I'm displaying the resources on a map now. You can click on any marker to see more details about that resource."
        };
        
        logMapFunction('✅ SUCCESS - Returning success response', successResponse);
        return successResponse;
        
      } else {
        logMapFunction('❌ SERVER-SIDE ENVIRONMENT - Cannot display map', {
          windowType: typeof window,
          environment: 'server-side'
        });
        
        return {
          success: false,
          error: "I couldn't display the map in this environment."
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logMapFunction('❌ EXCEPTION CAUGHT in display_map_function', {
        requestId,
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      audioLogger.error('function', 'display_map_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: "I encountered an issue while trying to display the resources on a map."
      };
    }
  }, []);

  // Implementation for pathway_exploration_function
  const pathwayExplorationFunction = useCallback(async (params: {
    interests: string[];
    education_level: string;
    skills?: string[];
    immediate_needs?: string;
  }): Promise<MentalHealthFunctionResult> => {
    try {
      const requestId = Date.now().toString().slice(-6);
    // console.log(`[V16] pathway_exploration_function called with requestId: ${requestId}`);
      audioLogger.info('function', 'pathway_exploration_function_called', { requestId, interests: params.interests, education_level: params.education_level });

      setFunctionError(null);

      // Build comprehensive query for pathway exploration
      let queryText = `career pathways and opportunities for someone interested in ${params.interests.join(', ')}`;
      queryText += ` with ${params.education_level.replace('_', ' ')} education level`;

      if (params.skills?.length) {
        queryText += ` and skills in ${params.skills.join(', ')}`;
      }

      if (params.immediate_needs) {
        queryText += ` considering ${params.immediate_needs.replace('_', ' ')}`;
      }

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          function_mapping: ['pathway_exploration_function'],
          techniques: ['career_guidance', 'pathway_planning']
        }
      });

    // console.log(`[V16] pathway_exploration_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'pathway_exploration_function_success', { requestId });

      // Enhance the response with personalized pathway suggestions
      const enhancedMessage = (result.data?.[0] || '') +
        `\n\n**Next Steps for You:**\n` +
        `- Consider exploring ${params.interests[0]} through volunteer opportunities or job shadowing\n` +
        `- Look into entry-level positions or internships in your areas of interest\n` +
        `- Research educational programs that align with your interests and current situation\n` +
        `- Would you like me to help you create a specific action plan for any of these pathways?`;

      return {
        success: true,
        data: {
          content: result.data || [],
          message: enhancedMessage,
          pathway_suggestions: params.interests,
          education_level: params.education_level,
          function_used: 'pathway_exploration_function'
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFunctionError(errorMessage);
      return {
        success: false,
        error: `Error exploring career pathways: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Implementation for educational_guidance_function
  const educationalGuidanceFunction = useCallback(async (params: {
    pathway_type: string;
    financial_situation?: string;
    timeline?: string;
  }): Promise<MentalHealthFunctionResult> => {
    try {
      const requestId = Date.now().toString().slice(-6);
    // console.log(`[V16] educational_guidance_function called with requestId: ${requestId}`);
      audioLogger.info('function', 'educational_guidance_function_called', { requestId, pathway_type: params.pathway_type });

      setFunctionError(null);

      let queryText = `educational guidance for ${params.pathway_type.replace('_', ' ')}`;

      if (params.financial_situation) {
        queryText += ` with ${params.financial_situation.replace('_', ' ')} financial situation`;
      }

      if (params.timeline) {
        queryText += ` starting ${params.timeline.replace('_', ' ')}`;
      }

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          function_mapping: ['educational_guidance_function'],
          techniques: ['educational_planning', 'academic_support']
        }
      });

    // console.log(`[V16] educational_guidance_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'educational_guidance_function_success', { requestId });

      // Add specific educational resources and next steps
      const enhancedMessage = (result.data?.[0] || '') +
        `\n\n**Educational Resources to Explore:**\n` +
        (params.pathway_type === 'college' ?
          `- Community college programs with transfer options\n- Financial aid and scholarship opportunities\n- Student support services for at-risk youth` :
          params.pathway_type === 'trade_school' ?
            `- Local vocational training programs\n- Apprenticeship opportunities\n- Industry certifications and licensing` :
            params.pathway_type === 'ged_program' ?
              `- Free GED preparation classes\n- Online GED study resources\n- Testing locations and scheduling` :
              `- Alternative education options\n- Flexible scheduling programs\n- Support services for your situation`) +
        `\n\nWould you like help finding specific programs in your area or creating an education plan?`;

      return {
        success: true,
        data: {
          content: result.data || [],
          message: enhancedMessage,
          pathway_type: params.pathway_type,
          recommendations: 'specific_programs_available',
          function_used: 'educational_guidance_function'
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFunctionError(errorMessage);
      return {
        success: false,
        error: `Error providing educational guidance: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Implementation for skill_building_function
  const skillBuildingFunction = useCallback(async (params: {
    skill_area: string;
    current_level?: string;
    immediate_application?: string;
  }): Promise<MentalHealthFunctionResult> => {
    try {
      const requestId = Date.now().toString().slice(-6);
    // console.log(`[V16] skill_building_function called with requestId: ${requestId}`);
      audioLogger.info('function', 'skill_building_function_called', { requestId, skill_area: params.skill_area });

      setFunctionError(null);

      let queryText = `skill building techniques for ${params.skill_area.replace('_', ' ')}`;

      if (params.current_level) {
        queryText += ` at ${params.current_level} level`;
      }

      if (params.immediate_application) {
        queryText += ` for ${params.immediate_application}`;
      }

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          function_mapping: ['skill_building_function'],
          techniques: ['skill_development', 'job_readiness']
        }
      });

    // console.log(`[V16] skill_building_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'skill_building_function_success', { requestId });

      // Add practical skill-building steps
      const skillSpecificSteps = {
        'resume_writing': [
          'Start with a basic template and your contact information',
          'List your experiences, including volunteer work and school projects',
          'Focus on transferable skills and achievements',
          'Have someone review your resume before applying'
        ],
        'interview_prep': [
          'Practice common interview questions out loud',
          'Prepare specific examples of your experiences and skills',
          'Research the company and role beforehand',
          'Plan your outfit and arrive 10-15 minutes early'
        ],
        'budgeting': [
          'Track your current spending for one week',
          'List all income sources and regular expenses',
          'Create categories for needs vs. wants',
          'Set aside money for emergencies, even if small amounts'
        ],
        'communication': [
          'Practice active listening in conversations',
          'Work on expressing your needs clearly and respectfully',
          'Learn to ask questions when you don\'t understand something',
          'Practice professional communication in emails and phone calls'
        ],
        'digital_literacy': [
          'Learn basic computer skills at a local library',
          'Practice using email and online applications',
          'Get familiar with job search websites',
          'Learn to create and save documents'
        ]
      };

      const steps = skillSpecificSteps[params.skill_area as keyof typeof skillSpecificSteps] || [
        'Break the skill into smaller, manageable parts',
        'Practice regularly, even for short periods',
        'Seek feedback from others when possible',
        'Apply what you learn in real situations'
      ];

      const enhancedMessage = (result.data?.[0] || '') +
        `\n\n**Practical Steps to Build This Skill:**\n` +
        steps.map((step, index) => `${index + 1}. ${step}`).join('\n') +
        `\n\nWould you like me to help you create a practice schedule or find resources for developing this skill?`;

      return {
        success: true,
        data: {
          content: result.data || [],
          message: enhancedMessage,
          skill_area: params.skill_area,
          action_steps: steps,
          function_used: 'skill_building_function'
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFunctionError(errorMessage);
      return {
        success: false,
        error: `Error providing skill building guidance: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Implementation for goal_planning_function
  const goalPlanningFunction = useCallback(async (params: {
    goal_description: string;
    goal_type: string;
    timeline?: string;
    current_barriers?: string[];
  }): Promise<MentalHealthFunctionResult> => {
    try {
      const requestId = Date.now().toString().slice(-6);
    // console.log(`[V16] goal_planning_function called with requestId: ${requestId}`);
      audioLogger.info('function', 'goal_planning_function_called', { requestId, goal_type: params.goal_type });

      setFunctionError(null);

      let queryText = `goal planning and action steps for ${params.goal_type.replace('_', ' ')} goal: ${params.goal_description}`;

      if (params.timeline) {
        queryText += ` with ${params.timeline.replace('_', ' ')} timeline`;
      }

      if (params.current_barriers?.length) {
        queryText += ` addressing barriers like ${params.current_barriers.join(', ')}`;
      }

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          function_mapping: ['goal_planning_function'],
          techniques: ['goal_setting', 'action_planning']
        }
      });

    // console.log(`[V16] goal_planning_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'goal_planning_function_success', { requestId });

      // Create a structured action plan
      const enhancedMessage = (result.data?.[0] || '') +
        `\n\n**Your Action Plan for: "${params.goal_description}"**\n\n` +
        `**Immediate Steps (Next 2 weeks):**\n` +
        `• Research specific requirements or opportunities\n` +
        `• Identify one person who can provide guidance or support\n` +
        `• Take one small action toward your goal\n\n` +
        `**Short-term Steps (1-3 months):**\n` +
        `• Develop necessary skills or meet requirements\n` +
        `• Build connections in your area of interest\n` +
        `• Create a more detailed plan with specific deadlines\n\n` +
        `**Long-term Steps (3+ months):**\n` +
        `• Apply for programs, jobs, or opportunities\n` +
        `• Adjust your plan based on what you've learned\n` +
        `• Celebrate progress and set new goals\n\n` +
        (params.current_barriers?.length ?
          `**Addressing Your Barriers:**\n${params.current_barriers.map(barrier => `• ${barrier}: Develop strategies to work around or overcome this`).join('\n')}\n\n` : '') +
        `Would you like help breaking down any of these steps further or developing strategies for specific challenges?`;

      return {
        success: true,
        data: {
          content: result.data || [],
          message: enhancedMessage,
          goal_type: params.goal_type,
          action_plan: 'structured_plan_created',
          barriers_addressed: params.current_barriers?.length || 0,
          function_used: 'goal_planning_function'
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFunctionError(errorMessage);
      return {
        success: false,
        error: `Error creating goal plan: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Implementation for futures_assessment_function
  const futuresAssessmentFunction = useCallback(async (params: {
    assessment_area: string;
    user_comfort_level?: string;
  }): Promise<MentalHealthFunctionResult> => {
    try {
      const requestId = Date.now().toString().slice(-6);
    // console.log(`[V16] futures_assessment_function called with requestId: ${requestId}`);
      audioLogger.info('function', 'futures_assessment_function_called', { requestId, assessment_area: params.assessment_area });

      setFunctionError(null);

      let queryText = `assessment and self-discovery for ${params.assessment_area.replace('_', ' ')}`;

      if (params.user_comfort_level) {
        queryText += ` with ${params.user_comfort_level.replace('_', ' ')} approach`;
      }

      const result = await queryTherapeuticContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          function_mapping: ['futures_assessment_function'],
          techniques: ['self_assessment', 'strength_identification']
        }
      });

    // console.log(`[V16] futures_assessment_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'futures_assessment_function_success', { requestId });

      // Create assessment questions based on the area
      const assessmentQuestions = {
        'full_assessment': [
          'What activities make you lose track of time because you enjoy them so much?',
          'What subjects in school (or topics in general) have you found most interesting?',
          'When you help others, what kind of help do you most enjoy providing?',
          'What would you do with your time if you didn\'t have to worry about money?',
          'What challenges in the world would you most like to help solve?'
        ],
        'interests_only': [
          'What do you find yourself reading about or watching videos about in your free time?',
          'If you could learn any skill without worrying about cost or time, what would it be?',
          'What types of problems do you enjoy trying to solve?'
        ],
        'skills_only': [
          'What do friends and family often ask for your help with?',
          'What comes naturally to you that others seem to struggle with?',
          'What have you accomplished that you\'re proud of, even if it seemed small to others?'
        ],
        'work_experience': [
          'What parts of any job (paid or volunteer) have you enjoyed most?',
          'What type of work environment helps you do your best?',
          'What would make a job feel meaningful to you?'
        ],
        'immediate_needs': [
          'What would need to change in your current situation for you to pursue your goals?',
          'What support do you have available from family, friends, or community?',
          'What\'s your biggest concern about planning for your future right now?'
        ]
      };

      const questions = assessmentQuestions[params.assessment_area as keyof typeof assessmentQuestions] || assessmentQuestions['interests_only'];

      const enhancedMessage = (result.data?.[0] || '') +
        `\n\n**Self-Discovery Questions for ${params.assessment_area.replace('_', ' ')}:**\n\n` +
        questions.map((question, index) => `${index + 1}. ${question}`).join('\n\n') +
        `\n\n**How to Use These Questions:**\n` +
        `• Take your time thinking about each one\n` +
        `• There are no right or wrong answers\n` +
        `• Your answers might change over time, and that\'s okay\n` +
        `• Consider writing down your thoughts\n\n` +
        `After reflecting on these questions, would you like to discuss your answers with me? I can help you identify patterns and potential pathways based on what you discover about yourself.`;

      return {
        success: true,
        data: {
          content: result.data || [],
          message: enhancedMessage,
          assessment_area: params.assessment_area,
          questions_provided: questions.length,
          next_step: 'reflection_and_discussion',
          function_used: 'futures_assessment_function'
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFunctionError(errorMessage);
      return {
        success: false,
        error: `Error providing assessment guidance: ${errorMessage}`
      };
    }
  }, [queryTherapeuticContent]);

  // Helper function for resource locator functions - shared logic
  const performResourceSearch = useCallback(async (params: {
    query: string;
    resource_type?: string;
    location_specific?: boolean;
    location?: string;
    mapView?: boolean;
    customSearchId?: string;
  }): Promise<MentalHealthFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);
    const searchId = params.customSearchId || `search-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Add detailed logging following docs/logging_method.md
    const logResourceLocator = (message: string, ...args: unknown[]) => {
      if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_LOCATOR_LOGS === 'true') {
        console.log(`[resource_locator] ${message}`, ...args);
      }
    };

    logResourceLocator(`=== PERFORM_RESOURCE_SEARCH CALLED ===`);
    logResourceLocator(`Request ID: ${requestId}`);
    logResourceLocator(`Search ID: ${searchId}`);
    logResourceLocator(`Query: "${params.query}"`);
    logResourceLocator(`Resource type: ${params.resource_type || 'not specified'}`);
    logResourceLocator(`Location: ${params.location || 'not specified'}`);
    logResourceLocator(`Location specific: ${params.location_specific ? 'yes' : 'no'}`);
    logResourceLocator(`Map view: ${params.mapView ? 'yes' : 'no'}`);

    audioLogger.info('function', 'resource_search_called', {
      requestId,
      searchId,
      query: params.query,
      resource_type: params.resource_type,
      location: params.location
    });

    try {
      setFunctionError(null);

      if (params.location_specific === true && !params.location) {
        logResourceLocator(`Location needed for location-specific search`);
        return {
          success: true,
          data: {
            needsLocation: true,
            message: "To provide more relevant resources, I'll need to know your location. Could you tell me what city or region you're in?",
            function_used: 'resource_search'
          }
        };
      }

      const userId = localStorage.getItem('userId');
      const requestData = {
        ...params,
        userId: userId || undefined,
        searchId,
      };

      logResourceLocator(`Sending request to V11 API with search ID: ${searchId}`);
      logResourceLocator(`User ID: ${userId || 'anonymous'}`);
      const startTime = performance.now();

      const response = await fetch('/api/v11/resource-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      const endTime = performance.now();
      logResourceLocator(`API request completed in ${(endTime - startTime).toFixed(2)}ms`);
      logResourceLocator(`Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        logResourceLocator(`❌ API error response (${response.status}): ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      logResourceLocator(`API response received successfully`);
      logResourceLocator(`Found ${data.results?.resources?.length || 0} resources`);
      logResourceLocator(`Response has formatted_response: ${!!data.results?.formatted_response}`);

      // Add to search history using V11 API response structure
      const historyEntry: SearchHistoryEntry = {
        id: searchId,
        timestamp: Date.now(),
        query: params.query,
        resource_type: params.resource_type,
        location: params.location,
        results: {
          resources: data.results?.resources || [],
          summary: data.results?.summary,
          result_count: data.results?.result_count || 0
        }
      };

      setSearchHistory(prev => [historyEntry, ...prev.slice(0, 9)]);

      // Store search data for feedback collection
      if (typeof window !== 'undefined') {
        const existingSearches = JSON.parse(sessionStorage.getItem('resource_searches') || '[]');
        existingSearches.push(historyEntry);
        sessionStorage.setItem('resource_searches', JSON.stringify(existingSearches));
      }

      // Check for automatic map display
      const hasResourcesWithLocations = data.results?.resources?.some((r: Resource) => r.location);
      let mapMessage = '';
      let autoMapTriggered = false;

      logResourceLocator(`Resources with locations: ${hasResourcesWithLocations ? 'yes' : 'no'}`);
      logMapFunction('🗺️ MAP DISPLAY LOGIC - Resources analysis', {
        hasResourcesWithLocations,
        totalResources: data.results?.resources?.length || 0,
        resourcesWithLocation: data.results?.resources?.filter((r: Resource) => r.location)?.length || 0,
        allResourceLocations: data.results?.resources?.map((r: Resource) => ({ name: r.name, location: r.location })) || []
      });
      
      if (hasResourcesWithLocations && typeof window !== 'undefined') {
        logResourceLocator(`Triggering automatic map display for search ID: ${searchId}`);
        logMapFunction('🔄 TRIGGERING MAP DISPLAY EVENT', {
          searchId,
          eventType: 'display_resource_map',
          windowAvailable: typeof window !== 'undefined',
          timestamp: new Date().toISOString()
        });
        
        const event = new CustomEvent('display_resource_map', { detail: { searchId } });
        logMapFunction('🗺️ Event created, about to dispatch', {
          eventType: event.type,
          eventDetail: event.detail,
          eventTarget: 'window'
        });
        
        window.dispatchEvent(event);
        autoMapTriggered = true;
        mapMessage = "\n\nI've automatically displayed these resources on a map so you can see their locations.";
        
        logMapFunction('✅ Map display event dispatched successfully', {
          searchId,
          autoMapTriggered,
          mapMessage: mapMessage.trim()
        });
      } else {
        logMapFunction('❌ MAP DISPLAY SKIPPED', {
          hasResourcesWithLocations,
          windowAvailable: typeof window !== 'undefined',
          reason: !hasResourcesWithLocations ? 'No resources with locations' : 'Window not available'
        });
      }

      const displayMessage = data.results?.formatted_response ||
        `${data.results?.summary}\n\n${data.results?.resources?.map((resource: Resource) => {
          return `**${resource.name}** (${resource.resource_type})\n${resource.description}\n${resource.contact ? '**Contact:** ' + resource.contact : ''}\n${resource.website ? `**Website:** [${resource.website}](${resource.website})` : ''}${resource.location ? `\n**Location:** ${resource.location}` : ''}`;
        }).join('\n\n')}`;

      const feedbackMessage = "\n\nWere these resources helpful for you? I can try to find different resources if needed.";
      const finalMessage = displayMessage + mapMessage + feedbackMessage;

      logResourceLocator(`✅ Resource search completed successfully`);
      logResourceLocator(`Search ID: ${searchId}`);
      logResourceLocator(`Final message length: ${finalMessage.length} characters`);
      logResourceLocator(`Map triggered: ${autoMapTriggered ? 'yes' : 'no'}`);
      logResourceLocator(`Feedback prompt included: yes`);
      
      logMapFunction('🏁 RESOURCE SEARCH COMPLETION SUMMARY', {
        searchId,
        autoMapTriggered,
        hasResourcesWithLocations,
        finalMessageLength: finalMessage.length,
        mapMessageIncluded: !!mapMessage,
        timestamp: new Date().toISOString()
      });
      
      audioLogger.info('function', 'resource_search_success', {
        requestId,
        resultCount: data.results?.resources?.length || 0
      });

      return {
        success: true,
        data: {
          searchId,
          summary: data.results?.summary,
          resources: data.results?.resources,
          query: data.query,
          resource_type: data.resource_type,
          location: data.location,
          hasFeedbackPrompt: true,
          hasMapView: hasResourcesWithLocations,
          autoMapTriggered,
          message: finalMessage,
          function_used: 'resource_search'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logResourceLocator(`❌ Resource search failed: ${errorMessage}`);
      logResourceLocator(`Error details:`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        searchId,
        query: params.query,
        resource_type: params.resource_type,
        location: params.location,
        location_specific: params.location_specific
      });
      
      audioLogger.error('function', 'resource_search_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error searching for mental health resources: ${errorMessage}`
      };
    }
  }, []);

  // Logging helper for function execution
  const logFunctionExecution = useCallback((message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_FUNCTION_EXECUTION_LOGS === 'true') {
      console.log(`[function_execution] ${message}`, ...args);
    }
  }, []);

  // Helper function to wrap functions with execution event dispatching and logging
  const wrapFunctionWithEvents = useCallback((fn: (args: unknown) => Promise<unknown>, functionName: string) => {
    return async (args: unknown) => {
      const startTime = performance.now();
      
      // Enhanced logging for resource locator debugging
      if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_LOCATOR_LOGS === 'true' && functionName.includes('resource')) {
        console.log(`[resource_locator] 🔍 Function wrapper called for: ${functionName}`, {
          functionName,
          args,
          timestamp: new Date().toISOString(),
          stackTrace: new Error().stack
        });
      }
      
      // Log function execution start
      logFunctionExecution(`🚀 STARTING: ${functionName}`, { 
        args: typeof args === 'object' ? args : String(args),
        timestamp: new Date().toISOString()
      });
      
      // Dispatch function execution start event
      window.dispatchEvent(new CustomEvent('function-execution-start', { 
        detail: { functionName, args } 
      }));
      
      try {
        const result = await fn(args);
        const duration = performance.now() - startTime;
        
        // Log successful completion
        logFunctionExecution(`✅ COMPLETED: ${functionName}`, {
          duration: `${duration.toFixed(2)}ms`,
          success: result ? (result as { success?: boolean }).success : 'unknown',
          timestamp: new Date().toISOString()
        });
        
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        
        // Log error
        logFunctionExecution(`❌ FAILED: ${functionName}`, {
          duration: `${duration.toFixed(2)}ms`,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
        
        throw error; // Re-throw to maintain error handling
      } finally {
        // Dispatch function execution end event
        window.dispatchEvent(new CustomEvent('function-execution-end', { 
          detail: { functionName } 
        }));
      }
    };
  }, [logFunctionExecution]);

  // Function registry setup (logging moved to WebRTC store execution points)

  // Create function registry for V16 - complete set
  const functionRegistry = useMemo(() => {
    const registry: Record<string, (args: unknown) => Promise<unknown>> = {
      // Core mental health functions
      'grounding_function': wrapFunctionWithEvents(async (args: unknown) => groundingFunction(args as Parameters<typeof groundingFunction>[0]), 'grounding_function'),
      'thought_exploration_function': wrapFunctionWithEvents(async (args: unknown) => thoughtExplorationFunction(args as Parameters<typeof thoughtExplorationFunction>[0]), 'thought_exploration_function'),
      'problem_solving_function': wrapFunctionWithEvents(async (args: unknown) => problemSolvingFunction(args as Parameters<typeof problemSolvingFunction>[0]), 'problem_solving_function'),
      'screening_function': wrapFunctionWithEvents(async (args: unknown) => screeningFunction(args as Parameters<typeof screeningFunction>[0]), 'screening_function'),
      'crisis_response_function': wrapFunctionWithEvents(async (args: unknown) => crisisResponseFunction(args as Parameters<typeof crisisResponseFunction>[0]), 'crisis_response_function'),
      'psychoeducation_function': wrapFunctionWithEvents(async (args: unknown) => psychoeducationFunction(args as Parameters<typeof psychoeducationFunction>[0]), 'psychoeducation_function'),
      'validation_function': wrapFunctionWithEvents(async (args: unknown) => validationFunction(args as Parameters<typeof validationFunction>[0]), 'validation_function'),
      'getUserHistory_function': wrapFunctionWithEvents(async (args: unknown) => getUserHistoryFunction(args as Parameters<typeof getUserHistoryFunction>[0]), 'getUserHistory_function'),
      'logInteractionOutcome_function': wrapFunctionWithEvents(async (args: unknown) => logInteractionOutcomeFunction(args as Parameters<typeof logInteractionOutcomeFunction>[0]), 'logInteractionOutcome_function'),
      'cultural_humility_function': wrapFunctionWithEvents(async (args: unknown) => culturalHumilityFunction(args as Parameters<typeof culturalHumilityFunction>[0]), 'cultural_humility_function'),
      'resource_search_function': wrapFunctionWithEvents(async (args: unknown) => resourceSearchFunction(args as Parameters<typeof resourceSearchFunction>[0]), 'resource_search_function'),
      'resource_feedback_function': wrapFunctionWithEvents(async (args: unknown) => resourceFeedbackFunction(args as Parameters<typeof resourceFeedbackFunction>[0]), 'resource_feedback_function'),
      'end_session': wrapFunctionWithEvents(async () => endSession(), 'end_session'),
      'report_technical_error': wrapFunctionWithEvents(async (args: unknown) => reportTechnicalError(args as Parameters<typeof reportTechnicalError>[0]), 'report_technical_error'),

      // Utility functions
      'display_map_function': wrapFunctionWithEvents(async (args: unknown) => displayMapFunction(args as Parameters<typeof displayMapFunction>[0]), 'display_map_function'),
      // New therapeutic content functions
      'get_safety_triage_protocol': wrapFunctionWithEvents(async (args: unknown) => getSafetyTriageProtocol(args as Parameters<typeof getSafetyTriageProtocol>[0]), 'get_safety_triage_protocol'),
      'get_conversation_stance_guidance': wrapFunctionWithEvents(async (args: unknown) => getConversationStanceGuidance(args as Parameters<typeof getConversationStanceGuidance>[0]), 'get_conversation_stance_guidance'),
      'get_assessment_protocol': wrapFunctionWithEvents(async (args: unknown) => getAssessmentProtocol(args as Parameters<typeof getAssessmentProtocol>[0]), 'get_assessment_protocol'),
      'get_continuity_framework': wrapFunctionWithEvents(async (args: unknown) => getContinuityFramework(args as Parameters<typeof getContinuityFramework>[0]), 'get_continuity_framework'),
      'get_cbt_intervention': wrapFunctionWithEvents(async (args: unknown) => getCbtIntervention(args as Parameters<typeof getCbtIntervention>[0]), 'get_cbt_intervention'),
      'get_dbt_skills': wrapFunctionWithEvents(async (args: unknown) => getDbtSkills(args as Parameters<typeof getDbtSkills>[0]), 'get_dbt_skills'),
      'get_trauma_informed_approach': wrapFunctionWithEvents(async (args: unknown) => getTraumaInformedApproach(args as Parameters<typeof getTraumaInformedApproach>[0]), 'get_trauma_informed_approach'),
      'get_substance_use_support': wrapFunctionWithEvents(async (args: unknown) => getSubstanceUseSupport(args as Parameters<typeof getSubstanceUseSupport>[0]), 'get_substance_use_support'),
      'get_practical_support_guidance': wrapFunctionWithEvents(async (args: unknown) => getPracticalSupportGuidance(args as Parameters<typeof getPracticalSupportGuidance>[0]), 'get_practical_support_guidance'),
      'get_acute_distress_protocol': wrapFunctionWithEvents(async (args: unknown) => getAcuteDistressProtocol(args as Parameters<typeof getAcuteDistressProtocol>[0]), 'get_acute_distress_protocol'),
      'pathway_exploration_function': wrapFunctionWithEvents(async (args: unknown) => pathwayExplorationFunction(args as Parameters<typeof pathwayExplorationFunction>[0]), 'pathway_exploration_function'),

      // Futures/Guidance functions
      'educational_guidance_function': wrapFunctionWithEvents(async (args: unknown) => educationalGuidanceFunction(args as Parameters<typeof educationalGuidanceFunction>[0]), 'educational_guidance_function'),
      'skill_building_function': wrapFunctionWithEvents(async (args: unknown) => skillBuildingFunction(args as Parameters<typeof skillBuildingFunction>[0]), 'skill_building_function'),
      'goal_planning_function': wrapFunctionWithEvents(async (args: unknown) => goalPlanningFunction(args as Parameters<typeof goalPlanningFunction>[0]), 'goal_planning_function'),
      'futures_assessment_function': wrapFunctionWithEvents(async (args: unknown) => futuresAssessmentFunction(args as Parameters<typeof futuresAssessmentFunction>[0]), 'futures_assessment_function'),
      'resource_connection_function': wrapFunctionWithEvents(async (args: unknown) => {
        const params = args as {
          connection_type: string;
          field_of_interest: string;
          comfort_level?: string;
        };
        try {
          const requestId = Date.now().toString().slice(-6);
    // console.log(`[V16] resource_connection_function called with requestId: ${requestId}`);
          audioLogger.info('function', 'resource_connection_function_called', { requestId, connection_type: params.connection_type, field_of_interest: params.field_of_interest });

          setFunctionError(null);

          let queryText = `${params.connection_type.replace('_', ' ')} opportunities in ${params.field_of_interest}`;

          if (params.comfort_level) {
            queryText += ` for someone who is ${params.comfort_level.replace('_', ' ')} with networking`;
          }

          const result = await queryTherapeuticContent({
            query: queryText,
            namespace: 'trauma_informed_youth_mental_health_companion_v250420',
            filter_metadata: {
              function_mapping: ['resource_connection_function'],
              techniques: ['networking', 'professional_development']
            }
          });

    // console.log(`[V16] resource_connection_function success for requestId: ${requestId}`);
          audioLogger.info('function', 'resource_connection_function_success', { requestId });

          // Provide specific connection strategies based on comfort level
          const connectionStrategies = {
            'very_comfortable': [
              'Attend industry meetups and professional events',
              'Reach out directly to professionals in your field via LinkedIn',
              'Join professional associations related to your interests',
              'Volunteer for leadership roles in organizations'
            ],
            'somewhat_comfortable': [
              'Start with online communities and forums in your field',
              'Attend smaller, informal meetups or workshops',
              'Connect with classmates or coworkers who share your interests',
              'Participate in volunteer activities related to your field'
            ],
            'nervous_but_willing': [
              'Begin with online research and following industry leaders',
              'Attend events with a friend for moral support',
              'Start conversations by asking questions rather than talking about yourself',
              'Practice networking skills in low-pressure environments'
            ],
            'need_support': [
              'Work with a mentor or counselor to build confidence',
              'Start with written communication (emails, online forums)',
              'Attend structured programs with built-in networking components',
              'Focus on one-on-one conversations rather than group settings'
            ]
          };

          const strategies = connectionStrategies[params.comfort_level as keyof typeof connectionStrategies] || connectionStrategies['somewhat_comfortable'];

          const enhancedMessage = (result.data?.[0] || '') +
            `\n\n**Connection Strategies for ${params.field_of_interest}:**\n` +
            strategies.map((strategy, index) => `${index + 1}. ${strategy}`).join('\n') +
            `\n\n**Places to Start:**\n` +
            `• Local community centers and libraries often host career events\n` +
            `• Online platforms like LinkedIn, Facebook groups, or Reddit communities\n` +
            `• Volunteer organizations related to your interests\n` +
            `• Educational institutions offering programs in your field\n\n` +
            `Remember: Most people are happy to share their experiences when asked respectfully. Would you like help crafting an introduction message or finding specific opportunities in your area?`;

          return {
            success: true,
            data: {
              content: result.data || [],
              message: enhancedMessage,
              connection_type: params.connection_type,
              field_of_interest: params.field_of_interest,
              strategies_provided: strategies.length,
              function_used: 'resource_connection_function'
            }
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          setFunctionError(errorMessage);
          return {
            success: false,
            error: `Error providing connection guidance: ${errorMessage}`
          };
        }
      }, 'resource_connection_function'),

      // Resource Locator functions (using factory pattern)
      'emergency_shelter_function': wrapFunctionWithEvents(async (args: unknown) => {
        const params = args as {
          urgency_level: string;
          age_group?: string;
          location: string;
          special_needs?: string[];
        };
        const searchId = `shelter-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let query = `emergency shelter ${params.urgency_level === 'tonight' ? 'immediate overnight' : 'housing'}`;
        if (params.age_group) {
          query += ` for ${params.age_group === 'under_18' ? 'minors youth' : params.age_group === '18_24' ? 'young adults' : 'adults'}`;
        }
        if (params.special_needs?.length) {
          query += ` ${params.special_needs.join(' ')}`;
        }
        return performResourceSearch({
          query,
          resource_type: 'housing',
          location: params.location,
          location_specific: true,
          mapView: true,
          customSearchId: searchId
        });
      }, 'emergency_shelter_function'),

      'food_assistance_function': wrapFunctionWithEvents(async (args: unknown) => {
        const params = args as {
          food_type: string;
          urgency?: string;
          location: string;
          transportation?: boolean;
        };
        const searchId = `food-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let query = `${params.food_type.replace('_', ' ')} food assistance`;
        if (params.urgency === 'today') {
          query += ' immediate emergency';
        }
        if (params.transportation === false) {
          query += ' delivery mobile';
        }
        return performResourceSearch({
          query,
          resource_type: 'food',
          location: params.location,
          location_specific: true,
          mapView: true,
          customSearchId: searchId
        });
      }, 'food_assistance_function'),

      'crisis_mental_health_function': wrapFunctionWithEvents(async (args: unknown) => {
        const params = args as {
          crisis_severity: string;
          crisis_type: string;
          preferred_contact?: string;
          identity_specific?: string[];
        };
        const searchId = `crisis-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let query = `crisis mental health ${params.crisis_type.replace('_', ' ')} ${params.crisis_severity} support`;
        if (params.preferred_contact) {
          query += ` ${params.preferred_contact.replace('_', ' ')}`;
        }
        if (params.identity_specific?.length) {
          query += ` ${params.identity_specific.join(' ')}`;
        }
        return performResourceSearch({
          query,
          resource_type: 'crisis_hotline',
          location_specific: false,
          mapView: false,
          customSearchId: searchId
        });
      }, 'crisis_mental_health_function'),

      'healthcare_access_function': wrapFunctionWithEvents(async (args: unknown) => {
        const params = args as {
          healthcare_need: string;
          insurance_status?: string;
          location: string;
          age?: string;
        };
        const searchId = `health-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let query = `${params.healthcare_need.replace('_', ' ')} healthcare`;
        if (params.insurance_status === 'no_insurance') {
          query += ' free low cost uninsured';
        }
        if (params.age === 'under_18') {
          query += ' pediatric youth';
        }
        return performResourceSearch({
          query,
          resource_type: 'medical',
          location: params.location,
          location_specific: true,
          mapView: true,
          customSearchId: searchId
        });
      }, 'healthcare_access_function'),

      'job_search_assistance_function': wrapFunctionWithEvents(async (args: unknown) => {
        const params = args as {
          experience_level: string;
          location: string;
          job_type?: string;
          interests?: string[];
          support_needed?: string[];
        };
        const searchId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let query = `job search assistance ${params.experience_level.replace('_', ' ')}`;
        if (params.job_type) {
          query += ` ${params.job_type.replace('_', ' ')}`;
        }
        if (params.interests?.length) {
          query += ` ${params.interests.join(' ')}`;
        }
        if (params.support_needed?.length) {
          query += ` ${params.support_needed.join(' ')}`;
        }
        return performResourceSearch({
          query,
          resource_type: 'community_service',
          location: params.location,
          location_specific: true,
          mapView: true,
          customSearchId: searchId
        });
      }, 'job_search_assistance_function'),

      'lgbtq_support_function': wrapFunctionWithEvents(async (args: unknown) => {
        const params = args as {
          support_type: string;
          location: string;
          identity?: string[];
          meeting_preference?: string;
        };
        const searchId = `lgbtq-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let query = `LGBTQ ${params.support_type.replace('_', ' ')}`;
        if (params.identity?.length) {
          query += ` ${params.identity.join(' ')}`;
        }
        if (params.meeting_preference) {
          query += ` ${params.meeting_preference.replace('_', ' ')}`;
        }
        return performResourceSearch({
          query,
          resource_type: 'support_group',
          location: params.location,
          location_specific: true,
          mapView: true,
          customSearchId: searchId
        });
      }, 'lgbtq_support_function'),

      'legal_aid_function': wrapFunctionWithEvents(async (args: unknown) => {
        const params = args as {
          legal_issue: string;
          urgency?: string;
          location: string;
          age?: string;
        };
        const searchId = `legal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let query = `legal aid ${params.legal_issue.replace('_', ' ')}`;
        if (params.age === 'under_18') {
          query += ' youth minor';
        }
        if (params.urgency === 'immediate') {
          query += ' emergency urgent';
        }
        return performResourceSearch({
          query,
          resource_type: 'legal',
          location: params.location,
          location_specific: true,
          mapView: true,
          customSearchId: searchId
        });
      }, 'legal_aid_function'),

      'educational_support_function': wrapFunctionWithEvents(async (args: unknown) => {
        const params = args as {
          education_need: string;
          current_status?: string;
          location: string;
          schedule_needs?: string;
        };
        const searchId = `edu-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let query = `${params.education_need.replace('_', ' ')} educational support`;
        if (params.current_status) {
          query += ` ${params.current_status.replace('_', ' ')}`;
        }
        if (params.schedule_needs) {
          query += ` ${params.schedule_needs.replace('_', ' ')}`;
        }
        return performResourceSearch({
          query,
          resource_type: 'educational',
          location: params.location,
          location_specific: true,
          mapView: true,
          customSearchId: searchId
        });
      }, 'educational_support_function'),

      'transportation_assistance_function': wrapFunctionWithEvents(async (args: unknown) => {
        const params = args as {
          transportation_need: string;
          location: string;
          assistance_type?: string;
          duration?: string;
        };
        const searchId = `transport-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let query = `transportation assistance ${params.transportation_need.replace('_', ' ')}`;
        if (params.assistance_type) {
          query += ` ${params.assistance_type.replace('_', ' ')}`;
        }
        if (params.duration === 'one_time') {
          query += ' voucher emergency';
        }
        return performResourceSearch({
          query,
          resource_type: 'transportation',
          location: params.location,
          location_specific: true,
          mapView: true,
          customSearchId: searchId
        });
      }, 'transportation_assistance_function'),

      'substance_abuse_support_function': wrapFunctionWithEvents(async (args: unknown) => {
        const params = args as {
          support_type: string;
          location: string;
          substance_type?: string;
          treatment_preference?: string;
          insurance_status?: string;
        };
        const searchId = `substance-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let query = `substance abuse ${params.support_type.replace('_', ' ')}`;
        if (params.substance_type && params.substance_type !== 'prefer_not_to_say') {
          query += ` ${params.substance_type.replace('_', ' ')}`;
        }
        if (params.treatment_preference) {
          query += ` ${params.treatment_preference.replace('_', ' ')}`;
        }
        if (params.insurance_status === 'need_free_treatment') {
          query += ' free low cost';
        }
        return performResourceSearch({
          query,
          resource_type: 'substance_abuse',
          location: params.location,
          location_specific: true,
          mapView: true,
          customSearchId: searchId
        });
      }, 'substance_abuse_support_function'),

      'young_parent_support_function': wrapFunctionWithEvents(async (args: unknown) => {
        const params = args as {
          parent_type: string;
          support_needed: string;
          location: string;
          child_age?: string;
        };
        const searchId = `parent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let query = `${params.parent_type.replace('_', ' ')} ${params.support_needed.replace('_', ' ')}`;
        if (params.child_age) {
          query += ` ${params.child_age}`;
        }
        return performResourceSearch({
          query,
          resource_type: 'community_service',
          location: params.location,
          location_specific: true,
          mapView: true,
          customSearchId: searchId
        });
      }, 'young_parent_support_function'),

      'domestic_violence_support_function': wrapFunctionWithEvents(async (args: unknown) => {
        const params = args as {
          situation_type: string;
          safety_level: string;
          resource_type: string;
          location?: string;
          contact_method?: string;
        };
        const searchId = `dv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let query = `${params.situation_type.replace('_', ' ')} ${params.resource_type.replace('_', ' ')} ${params.safety_level.replace('_', ' ')}`;
        if (params.contact_method) {
          query += ` ${params.contact_method.replace('_', ' ')}`;
        }
        return performResourceSearch({
          query,
          resource_type: 'crisis_hotline',
          location: params.location,
          location_specific: !!params.location,
          mapView: !!params.location,
          customSearchId: searchId
        });
      }, 'domestic_violence_support_function'),

      'basic_needs_assistance_function': wrapFunctionWithEvents(async (args: unknown) => {
        const params = args as {
          need_type: string;
          urgency?: string;
          location: string;
          age_group?: string;
        };
        const searchId = `basic-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let query = `${params.need_type.replace('_', ' ')} assistance`;
        if (params.age_group) {
          query += ` ${params.age_group}`;
        }
        if (params.urgency === 'immediate') {
          query += ' emergency urgent';
        }
        return performResourceSearch({
          query,
          resource_type: 'clothing',
          location: params.location,
          location_specific: true,
          mapView: true,
          customSearchId: searchId
        });
      }, 'basic_needs_assistance_function'),

      'community_programs_function': wrapFunctionWithEvents(async (args: unknown) => {
        const params = args as {
          program_type: string;
          location: string;
          interests?: string[];
          schedule_preference?: string;
        };
        const searchId = `community-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let query = `${params.program_type.replace('_', ' ')} community programs`;
        if (params.interests?.length) {
          query += ` ${params.interests.join(' ')}`;
        }
        if (params.schedule_preference) {
          query += ` ${params.schedule_preference.replace('_', ' ')}`;
        }
        return performResourceSearch({
          query,
          resource_type: 'community_service',
          location: params.location,
          location_specific: true,
          mapView: true,
          customSearchId: searchId
        });
      }, 'community_programs_function')
    };

    // Registry created - logging handled at WebRTC execution points

    return registry;
  }, [
    wrapFunctionWithEvents,
    groundingFunction,
    thoughtExplorationFunction,
    problemSolvingFunction,
    screeningFunction,
    crisisResponseFunction,
    psychoeducationFunction,
    validationFunction,
    getUserHistoryFunction,
    logInteractionOutcomeFunction,
    culturalHumilityFunction,
    resourceSearchFunction,
    resourceFeedbackFunction,
    endSession,
    reportTechnicalError,
    displayMapFunction,
    getSafetyTriageProtocol,
    getConversationStanceGuidance,
    getAssessmentProtocol,
    getContinuityFramework,
    getCbtIntervention,
    getDbtSkills,
    getTraumaInformedApproach,
    getSubstanceUseSupport,
    getPracticalSupportGuidance,
    getAcuteDistressProtocol,
    pathwayExplorationFunction,
    educationalGuidanceFunction,
    skillBuildingFunction,
    goalPlanningFunction,
    futuresAssessmentFunction,
    performResourceSearch,
    queryTherapeuticContent
  ]);

  // Get available functions for session configuration
  const getAvailableFunctions = useMemo(() => {
    return Object.keys(functionRegistry).map(name => ({
      name,
      description: `V16 implementation of ${name}`,
      parameters: {}
    }));
  }, [functionRegistry]);

  return {
    // Core function implementations
    groundingFunction,
    thoughtExplorationFunction,
    problemSolvingFunction,
    screeningFunction,
    crisisResponseFunction,
    psychoeducationFunction,
    validationFunction,
    getUserHistoryFunction,
    logInteractionOutcomeFunction,
    culturalHumilityFunction,
    resourceSearchFunction,
    resourceFeedbackFunction,
    endSession,
    reportTechnicalError,

    // Utility functions
    displayMapFunction,
    getSafetyTriageProtocol,
    getConversationStanceGuidance,
    getAssessmentProtocol,
    getContinuityFramework,
    getCbtIntervention,
    getDbtSkills,
    getTraumaInformedApproach,
    getSubstanceUseSupport,
    getPracticalSupportGuidance,
    getAcuteDistressProtocol,
    pathwayExplorationFunction,

    // Futures/Guidance functions
    educationalGuidanceFunction,
    skillBuildingFunction,
    goalPlanningFunction,
    futuresAssessmentFunction,

    // Helper
    performResourceSearch,

    // Registry and configuration
    functionRegistry,
    getAvailableFunctions,

    // State
    lastFunctionResult,
    functionError,
    searchHistory,

    // Utility
    clearFunctionError: useCallback(() => setFunctionError(null), []),
    clearLastResult: useCallback(() => setLastFunctionResult(null), []),
    clearSearchHistory: useCallback(() => setSearchHistory([]), [])
  };
}

export default useMentalHealthFunctionsV16;