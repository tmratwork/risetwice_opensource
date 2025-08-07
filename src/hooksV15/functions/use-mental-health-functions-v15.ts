// src/hooksV15/functions/use-mental-health-functions-v15.ts

"use client";

import { useState, useCallback, useMemo, useRef } from 'react';
import { generateMentalHealthFunctions } from '@/app/chatbotV11/prompts/function-descriptions-mh';
import { supabase } from '@/lib/supabase';
import audioLogger from '../audio/audio-logger';
import type { GPTFunction } from './use-book-functions-v15';

/**
 * V15 Mental Health Functions Hook - Greenfield Implementation
 * Provides all 36 mental health function implementations for V15 WebRTC system
 * Based on V11 functionality but with improved architecture
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
  [key: string]: unknown;
}

export function useMentalHealthFunctionsV15() {
  const [lastFunctionResult, setLastFunctionResult] = useState<MentalHealthFunctionResult | null>(null);
  const [functionError, setFunctionError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);

  // Get functions from the prompts module - memoized to prevent recreation
  const mentalHealthFunctions: GPTFunction[] = useMemo(() => {
    console.log(`[AI-INTERACTION] ===== GENERATING MENTAL HEALTH FUNCTIONS =====`);
    console.log(`[AI-INTERACTION] Calling generateMentalHealthFunctions() from prompts module`);

    try {
      const functions = generateMentalHealthFunctions();
      console.log(`[AI-INTERACTION] Generated ${functions.length} function definitions for AI`);
      console.log(`[AI-INTERACTION] Function names from prompts:`, functions.map(f => f.name));
      console.log(`[AI-INTERACTION] resource_search_function defined:`, functions.some(f => f.name === 'resource_search_function'));
      
      if (functions.length === 0) {
        console.error(`[AI-INTERACTION] ❌ CRITICAL: generateMentalHealthFunctions() returned empty array!`);
      }
      
      return functions;
    } catch (error) {
      console.error(`[AI-INTERACTION] ❌ ERROR generating mental health functions:`, error);
      return [];
    }
  }, []);

  // Store user history in local state for persistence
  const userHistoryRef = useRef<{
    functionEffectiveness: Record<string, { count: number, effectiveness: number }>;
    recentInteractions: Array<{ timestamp: number, approach: string, effectiveness: string }>;
    communicationPreferences: Record<string, boolean>;
    skills: Record<string, { used: number, progress: number }>;
  }>({
    functionEffectiveness: {},
    recentInteractions: [],
    communicationPreferences: {},
    skills: {}
  });

  // === CORE MENTAL HEALTH FUNCTIONS ===

  // Implementation for grounding_function
  const groundingFunction = useCallback(async (params: {
    distress_level: string;
    technique_type?: string;
  }): Promise<MentalHealthFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] grounding_function called with requestId: ${requestId}`);
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

      const bookId = localStorage.getItem('selectedBookId') || 'trauma_informed_youth_mental_health_companion';
      const result = await queryBookContent({
        query: `grounding techniques for ${params.distress_level} distress ${additionalKeywords}`,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          techniques: ['grounding'],
          scenarios: ['distress'],
          urgency_level: params.distress_level
        },
        book: bookId
      });

      console.log(`[function] grounding_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'grounding_function_success', { requestId });
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] grounding_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'grounding_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing grounding techniques: ${errorMessage}`
      };
    }
  }, []);

  // Implementation for thought_exploration_function
  const thoughtExplorationFunction = useCallback(async (params: {
    thought_type: string;
    related_emotion?: string;
  }): Promise<MentalHealthFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] thought_exploration_function called with requestId: ${requestId}`);
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

      const result = await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          techniques: ['CBT'],
          function_mapping: ['thought_exploration_function']
        }
      });

      console.log(`[function] thought_exploration_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'thought_exploration_function_success', { requestId });
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] thought_exploration_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'thought_exploration_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing thought exploration techniques: ${errorMessage}`
      };
    }
  }, []);

  // Implementation for problem_solving_function
  const problemSolvingFunction = useCallback(async (params: {
    problem_category: string;
    complexity?: string;
  }): Promise<MentalHealthFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] problem_solving_function called with requestId: ${requestId}`);
    audioLogger.info('function', 'problem_solving_function_called', {
      requestId,
      problem_category: params.problem_category,
      complexity: params.complexity
    });

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

      const result = await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: queryParams
      });

      console.log(`[function] problem_solving_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'problem_solving_function_success', { requestId });
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] problem_solving_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'problem_solving_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing problem-solving strategies: ${errorMessage}`
      };
    }
  }, []);

  // Implementation for screening_function
  const screeningFunction = useCallback(async (params: {
    concern_area: string;
    assessment_purpose?: string;
  }): Promise<MentalHealthFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] screening_function called with requestId: ${requestId}`);
    audioLogger.info('function', 'screening_function_called', {
      requestId,
      concern_area: params.concern_area,
      assessment_purpose: params.assessment_purpose
    });

    try {
      setFunctionError(null);

      let queryText = `screening tools assessment questions for ${params.concern_area.replace('_', ' ')}`;
      if (params.assessment_purpose) {
        queryText += ` for ${params.assessment_purpose.replace('_', ' ')}`;
      }

      const result = await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          function_mapping: ['screening_function']
        }
      });

      console.log(`[function] screening_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'screening_function_success', { requestId });
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] screening_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'screening_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing screening tools: ${errorMessage}`
      };
    }
  }, []);

  // Implementation for crisis_response_function
  const crisisResponseFunction = useCallback(async (params: {
    crisis_type: string;
    urgency_level: string;
  }): Promise<MentalHealthFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] crisis_response_function called with requestId: ${requestId}`);
    console.error(`[function] ⚠️ CRITICAL: Crisis response activated for ${params.crisis_type} at ${params.urgency_level} urgency level`);
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

      const result = await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: queryParams
      });

      console.log(`[function] crisis_response_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'crisis_response_function_success', { requestId });
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] crisis_response_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'crisis_response_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      // Critical: Even if there's an error, provide a fallback crisis message
      return {
        success: true, // Mark as successful so the AI can respond
        message: "I'm concerned about your safety. It's important that you talk to someone who can help immediately. Please call the 988 Suicide and Crisis Lifeline at 988, text HOME to 741741 to reach the Crisis Text Line, or go to your nearest emergency room. Would you like me to provide more resources or help you think through your next steps to stay safe right now?",
        error_occurred: true
      };
    }
  }, []);

  // Implementation for getUserHistory_function
  const getUserHistoryFunction = useCallback((params: {
    history_type: string;
  }): MentalHealthFunctionResult => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] getUserHistory_function called with requestId: ${requestId}`);
    audioLogger.info('function', 'getUserHistory_function_called', {
      requestId,
      history_type: params.history_type
    });

    try {
      setFunctionError(null);

      switch (params.history_type) {
        case 'function_effectiveness':
          return {
            success: true,
            history_type: params.history_type,
            data: userHistoryRef.current.functionEffectiveness,
            message: `Retrieved function effectiveness history. Most effective functions: ${Object.entries(userHistoryRef.current.functionEffectiveness)
              .sort(([, a], [, b]) => b.effectiveness - a.effectiveness)
              .slice(0, 3)
              .map(([name]) => name)
              .join(', ') || 'No data yet'
              }`
          };

        case 'communication_preferences':
          return {
            success: true,
            history_type: params.history_type,
            data: userHistoryRef.current.communicationPreferences,
            message: `Retrieved communication preferences: ${Object.entries(userHistoryRef.current.communicationPreferences)
              .filter(([, value]) => value)
              .map(([key]) => key)
              .join(', ') || 'No preferences set'
              }`
          };

        case 'skill_progress':
          return {
            success: true,
            history_type: params.history_type,
            data: userHistoryRef.current.skills,
            message: `Retrieved skill progress. Most used skills: ${Object.entries(userHistoryRef.current.skills)
              .sort(([, a], [, b]) => b.used - a.used)
              .slice(0, 3)
              .map(([name]) => name)
              .join(', ') || 'No skills recorded yet'
              }`
          };

        case 'recent_interactions':
          const recentInteractions = userHistoryRef.current.recentInteractions
            .slice(-5)
            .map(i => `${i.approach} (${i.effectiveness})`)
            .join(', ');

          return {
            success: true,
            history_type: params.history_type,
            data: {
              interactions: userHistoryRef.current.recentInteractions.slice(-5),
              message: `Recent interaction approaches: ${recentInteractions || 'No recent interactions recorded'}`
            },
            message: `Recent interaction approaches: ${recentInteractions || 'No recent interactions recorded'}`
          };

        default:
          return {
            success: true,
            history_type: params.history_type,
            message: 'No specific history data available for this type.'
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] getUserHistory_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'getUserHistory_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error retrieving user history: ${errorMessage}`
      };
    }
  }, []);

  // Implementation for logInteractionOutcome_function - THE MISSING FUNCTION!
  const logInteractionOutcomeFunction = useCallback((params: {
    approach_used: string;
    effectiveness_rating: string;
    user_engagement?: string;
  }): MentalHealthFunctionResult => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] logInteractionOutcome_function called with requestId: ${requestId}`);
    console.log(`[function] Approach used: ${params.approach_used}`);
    console.log(`[function] Effectiveness rating: ${params.effectiveness_rating}`);
    console.log(`[function] User engagement: ${params.user_engagement || 'not specified'}`);
    audioLogger.info('function', 'logInteractionOutcome_function_called', {
      requestId,
      approach_used: params.approach_used,
      effectiveness_rating: params.effectiveness_rating,
      user_engagement: params.user_engagement
    });

    try {
      setFunctionError(null);

      // Log the interaction outcome
      const interaction = {
        timestamp: Date.now(),
        approach: params.approach_used,
        effectiveness: params.effectiveness_rating,
        engagement: params.user_engagement || 'not specified'
      };

      // Add to recent interactions
      userHistoryRef.current.recentInteractions.push(interaction);
      if (userHistoryRef.current.recentInteractions.length > 20) {
        userHistoryRef.current.recentInteractions.shift();
      }

      // Update function effectiveness stats
      const functionName = params.approach_used.startsWith('called_')
        ? params.approach_used.substring(7)
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

      console.log(`[function] logInteractionOutcome_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'logInteractionOutcome_function_success', { requestId });

      return {
        success: true,
        message: `Interaction outcome logged successfully.`,
        result: 'recorded'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] logInteractionOutcome_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'logInteractionOutcome_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error logging interaction outcome: ${errorMessage}`
      };
    }
  }, []);

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

    console.log(`[resources] ===== PERFORMING RESOURCE SEARCH =====`);
    console.log(`[resources] Function called with requestId: ${requestId}, searchId: ${searchId}`);
    console.log(`[resources] Input parameters:`, {
      query: params.query,
      resource_type: params.resource_type,
      location_specific: params.location_specific,
      location: params.location,
      mapView: params.mapView
    });

    audioLogger.info('function', 'resource_search_called', {
      requestId,
      searchId,
      query: params.query,
      resource_type: params.resource_type,
      location: params.location
    });

    if (typeof window !== 'undefined') {
      (window as unknown as { __lastResourceSearchId: string }).__lastResourceSearchId = searchId;
    }

    try {
      console.log(`[resources] Entering try block - clearing function error`);
      setFunctionError(null);

      if (params.location_specific === true && !params.location) {
        console.log(`[resources] Location required but not provided - returning location request message`);
        return {
          success: true,
          needsLocation: true,
          message: "To provide more relevant resources, I'll need to know your location. Could you tell me what city or region you're in?"
        };
      }

      // Show toast notification immediately when search starts
      console.log(`[resources] ===== SHOWING TOAST NOTIFICATION =====`);
      if (typeof window !== 'undefined') {
        const toastEvent = new CustomEvent('show_search_toast', {
          detail: {
            searchId,
            requestId,
            query: params.query,
            location: params.location,
            resourceType: params.resource_type
          }
        });
        window.dispatchEvent(toastEvent);
        console.log(`[resources] ✅ Toast notification event dispatched`);
      }

      // Start the actual search
      console.log(`[resources] ===== STARTING WEB SEARCH API CALL =====`);
      const userId = localStorage.getItem('userId');
      const requestData = {
        ...params,
        userId: userId || undefined,
        searchId,
      };
      console.log(`[resources] Prepared request data for API call:`, requestData);

      // Add periodic status updates during search
      const updateStatus = (status: string) => {
        if (typeof window !== 'undefined') {
          const statusEvent = new CustomEvent('search_toast_update', {
            detail: { searchId, status }
          });
          window.dispatchEvent(statusEvent);
          console.log(`[resources] 📡 Status update: ${status}`);
        }
      };

      // Add timeout to prevent function from hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`[resources] ❌ Fetch timeout after 2 minutes - aborting request`);
        updateStatus('Search taking longer than expected...');
        controller.abort();
      }, 120000); // 2 minute timeout

      console.log(`[resources] Making fetch request with 2 minute timeout`);
      updateStatus('Searching multiple databases (will take a minute)...');

      const response = await fetch('/api/v11/resource-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log(`[resources] Fetch request completed before timeout`);
      updateStatus('Processing search results...');

      console.log(`[resources] ===== FETCH API RESPONSE RECEIVED =====`);
      console.log(`[resources] Fetch call completed with status:`, response.status, response.statusText);

      if (!response.ok) {
        console.log(`[resources] ❌ API call failed with status ${response.status}: ${response.statusText}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`[resources] ✅ API call successful, parsing JSON response`);
      updateStatus('Parsing search results...');

      const data = await response.json();

      console.log(`[resources] ===== JSON RESPONSE PARSED =====`);
      console.log(`[resources] JSON parsing completed successfully`);
      console.log(`[resources] Parsed API response data:`, {
        hasResults: !!data.results,
        resultCount: data.results?.resources?.length || 0,
        summary: data.results?.summary?.substring(0, 100) + '...' || 'no summary',
        success: data.success,
        hasError: !!data.error
      });

      if (!data.success) {
        console.log(`[resources] ❌ API returned success:false`);
        console.log(`[resources] API error:`, data.error);
        updateStatus('Search encountered an error...');
      } else {
        const resourceCount = data.results?.resources?.length || 0;
        updateStatus(`Found ${resourceCount} resources, organizing results...`);
      }

      // Add to search history
      const historyEntry: SearchHistoryEntry = {
        id: searchId,
        timestamp: Date.now(),
        query: params.query,
        resource_type: params.resource_type,
        location: params.location,
        results: data.results
      };

      setSearchHistory(prev => [historyEntry, ...prev.slice(0, 9)]);

      // Store search data for feedback collection
      if (typeof window !== 'undefined') {
        const existingSearches = JSON.parse(sessionStorage.getItem('resource_searches') || '[]');
        existingSearches.push(historyEntry);
        sessionStorage.setItem('resource_searches', JSON.stringify(existingSearches));
      }

      // Check for automatic map display
      const hasResourcesWithLocations = data.results.resources.some((r: Resource) => r.location);
      let mapMessage = '';
      let autoMapTriggered = false;

      if (hasResourcesWithLocations && typeof window !== 'undefined') {
        const event = new CustomEvent('display_resource_map', { detail: { searchId } });
        window.dispatchEvent(event);
        autoMapTriggered = true;
        mapMessage = "\n\nI've automatically displayed these resources on a map so you can see their locations.";
      }

      const displayMessage = data.results.formatted_response ||
        `${data.results.summary}\n\n${data.results.resources.map((resource: Resource) => {
          return `**${resource.name}** (${resource.resource_type})\n${resource.description}\n${resource.contact ? '**Contact:** ' + resource.contact : ''}\n${resource.website ? `**Website:** [${resource.website}](${resource.website})` : ''}${resource.location ? `\n**Location:** ${resource.location}` : ''}`;
        }).join('\n\n')}`;

      const feedbackMessage = "\n\nWere these resources helpful for you? I can try to find different resources if needed.";

      console.log(`[resources] ===== PREPARING FINAL RESPONSE =====`);
      const finalMessage = displayMessage + mapMessage + feedbackMessage;
      console.log(`[resources] Final combined message length: ${finalMessage.length} chars`);

      console.log(`[function] performResourceSearch success for requestId: ${requestId}`);
      audioLogger.info('function', 'resource_search_success', {
        requestId,
        resultCount: data.results.resources?.length || 0
      });

      setLastFunctionResult(data);

      const finalResult = {
        success: true,
        searchId,
        summary: data.results.summary,
        resources: data.results.resources,
        query: data.query,
        resource_type: data.resource_type,
        location: data.location,
        hasFeedbackPrompt: true,
        hasMapView: hasResourcesWithLocations,
        autoMapTriggered,
        message: finalMessage
      };

      // Dispatch completion event to hide toast
      if (typeof window !== 'undefined') {
        const completionEvent = new CustomEvent('search_toast_complete', {
          detail: {
            searchId,
            requestId,
            success: true,
            resultCount: data.results.resources?.length || 0
          }
        });
        window.dispatchEvent(completionEvent);
        console.log(`[resources] ✅ Search completion event dispatched to hide toast`);
      }

      return finalResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[resources] ===== ERROR IN RESOURCE SEARCH =====`);
      console.log(`[resources] ❌ Error occurred during resource search:`, errorMessage);

      audioLogger.error('function', 'resource_search_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      // For timeout, return a different message 
      let errorMessage_final = errorMessage;
      if (error instanceof Error && error.name === 'AbortError') {
        errorMessage_final = `I apologize, but the search is taking longer than expected. Let me try a different approach to find resources for you.`;
        console.log(`[resources] Returning timeout message`);
      }

      const errorResult = {
        success: false,
        error: `Error searching for mental health resources: ${errorMessage_final}`
      };

      // Dispatch error completion event to hide toast
      if (typeof window !== 'undefined') {
        const errorCompletionEvent = new CustomEvent('search_toast_complete', {
          detail: {
            searchId,
            requestId,
            success: false,
            error: errorMessage_final
          }
        });
        window.dispatchEvent(errorCompletionEvent);
        console.log(`[resources] ✅ Error completion event dispatched to hide toast`);
      }

      return errorResult;
    }
  }, []);

  // Implementation for resource_search_function
  const resourceSearchFunction = useCallback(async (params: {
    query: string;
    resource_type?: string;
    location_specific?: boolean;
    location?: string;
    mapView?: boolean;
  }): Promise<MentalHealthFunctionResult> => {
    console.log('[AI-INTERACTION] ===== RESOURCE SEARCH FUNCTION CALLED =====');
    console.log('[AI-INTERACTION] Function: resource_search_function');
    console.log('[AI-INTERACTION] Parameters received:', params);
    console.log('[AI-INTERACTION] This means AI correctly identified user request as resource search');
    console.log('[AI-INTERACTION] About to execute performResourceSearch function');
    
    const result = await performResourceSearch(params);
    
    console.log('[AI-INTERACTION] ===== RESOURCE SEARCH FUNCTION COMPLETED =====');
    console.log('[AI-INTERACTION] Result success:', result.success);
    console.log('[AI-INTERACTION] Result has message:', !!result.message);
    console.log('[AI-INTERACTION] Result has resources:', !!(result as { resources?: unknown[] }).resources);
    console.log('[AI-INTERACTION] Next: AI should speak this result to user');
    
    return result;
  }, [performResourceSearch]);

  // Helper function to query book content - used by multiple functions
  const queryBookContent = useCallback(async (params: {
    query: string;
    namespace: string;
    filter_metadata?: Record<string, unknown>;
    book?: string;
  }): Promise<MentalHealthFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] queryBookContent called with requestId: ${requestId}`);
    audioLogger.info('function', 'query_book_content_called', {
      requestId,
      query: params.query,
      namespace: params.namespace
    });

    try {
      setFunctionError(null);

      const userId = localStorage.getItem('userId');
      if (!userId) {
        throw new Error('No user ID available');
      }

      const finalNamespace = params.namespace || 'trauma_informed_youth_mental_health_companion_v250420';
      const bookId = params.book || localStorage.getItem('selectedBookId') || 'trauma_informed_youth_mental_health_companion';

      const response = await fetch('/api/v11/book-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          book: bookId,
          query: params.query,
          namespace: finalNamespace,
          filter_metadata: params.filter_metadata
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      setLastFunctionResult(data);

      if (!data.content) {
        throw new Error('No content found for query');
      }

      console.log(`[function] queryBookContent success for requestId: ${requestId}`);
      audioLogger.info('function', 'query_book_content_success', { requestId });

      return {
        success: true,
        content: data.content,
        matches: data.matches || 0,
        message: data.content
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] queryBookContent error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'query_book_content_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error querying mental health content: ${errorMessage}`
      };
    }
  }, []);

  // Implementation for cultural_humility_function
  const culturalHumilityFunction = useCallback(async (params: {
    identity_area: string;
    resource_type?: string;
  }): Promise<MentalHealthFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] cultural_humility_function called with requestId: ${requestId}`);
    audioLogger.info('function', 'cultural_humility_function_called', {
      requestId,
      identity_area: params.identity_area,
      resource_type: params.resource_type
    });

    try {
      setFunctionError(null);

      let queryText = `culturally responsive approaches for ${params.identity_area.replace('_', ' ')} identity`;
      if (params.resource_type) {
        queryText += ` with ${params.resource_type.replace('_', ' ')} resources`;
      }

      const result = await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          principles: ['cultural_humility'],
          function_mapping: ['cultural_humility_function']
        }
      });

      console.log(`[function] cultural_humility_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'cultural_humility_function_success', { requestId });
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] cultural_humility_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'cultural_humility_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing culturally responsive resources: ${errorMessage}`
      };
    }
  }, [queryBookContent]);

  // Implementation for psychoeducation_function
  const psychoeducationFunction = useCallback(async (params: {
    topic: string;
    information_type?: string;
  }): Promise<MentalHealthFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] psychoeducation_function called with requestId: ${requestId}`);
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

      const result = await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          function_mapping: ['psychoeducation_function']
        }
      });

      console.log(`[function] psychoeducation_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'psychoeducation_function_success', { requestId });
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] psychoeducation_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'psychoeducation_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing psychoeducational content: ${errorMessage}`
      };
    }
  }, [queryBookContent]);

  // Implementation for validation_function
  const validationFunction = useCallback(async (params: {
    emotion: string;
    validation_type?: string;
  }): Promise<MentalHealthFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] validation_function called with requestId: ${requestId}`);
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

      const result = await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          techniques: ['validation'],
          function_mapping: ['validation_function']
        }
      });

      console.log(`[function] validation_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'validation_function_success', { requestId });
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] validation_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'validation_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing validation techniques: ${errorMessage}`
      };
    }
  }, [queryBookContent]);

  // Implementation for end_session
  const endSession = useCallback(() => {
    console.log('[END-SESSION-DEBUG] 🎯 VERBAL END SESSION - end_session function called (user said "end session")');
    console.log('[END-SESSION-DEBUG] 🆚 This is different from MENU end session path');
    console.log('[FUNCTION-EXEC] end_session function called - starting execution');
    try {
      setFunctionError(null);

      console.log('[FUNCTION-EXEC] end_session: clearing function error state');

      // V15 GREENFIELD FIX: DO NOT dispatch ai_end_session event immediately
      // Let the WebRTC flow handle the goodbye response and volume monitoring
      console.log('[FUNCTION-EXEC] end_session: allowing WebRTC flow to handle goodbye gracefully');
      console.log('[END-SESSION-DEBUG] 🎯 VERBAL PATH: This will trigger complex silence detection system');

      const result = {
        success: true,
        message: "Goodbye! I'll end our session now. Take care!"
      };
      console.log('[FUNCTION-EXEC] end_session: returning success result for AI to say goodbye:', result);
      console.log('[END-SESSION-DEBUG] 🎯 VERBAL PATH: Function result will set expectingEndSessionGoodbye=true');
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[FUNCTION-EXEC] end_session: error occurred:', error);
      console.error('[END-SESSION-DEBUG] ❌ VERBAL PATH: end_session function failed:', error);

      setFunctionError(errorMessage);

      const errorResult = {
        success: false,
        error: `Failed to end session: ${errorMessage}`
      };
      console.log('[FUNCTION-EXEC] end_session: returning error result:', errorResult);
      return errorResult;
    }
  }, []);

  // Implementation for report_technical_error
  const reportTechnicalError = useCallback((params: {
    error_type: string;
    function_name: string;
    error_message?: string;
  }): MentalHealthFunctionResult => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] report_technical_error called with requestId: ${requestId}`);
    console.error(`[function] Technical error reported by AI: ${params.error_type} in ${params.function_name}`, params.error_message);
    audioLogger.info('function', 'report_technical_error_called', {
      requestId,
      error_type: params.error_type,
      function_name: params.function_name
    });

    try {
      setFunctionError(null);

      const formattedErrorMessage = `I encountered a technical error while trying to ${params.function_name === 'crisis_response_function' ? 'access crisis resources' :
        params.function_name === 'grounding_function' ? 'retrieve grounding techniques' :
          params.function_name === 'thought_exploration_function' ? 'explore thought patterns' :
            params.function_name === 'problem_solving_function' ? 'work on problem-solving' :
              params.function_name === 'resource_search_function' ? 'search for resources' :
                'process your request'
        }. ${params.error_message || ''}`;

      console.log(`[function] report_technical_error success for requestId: ${requestId}`);
      audioLogger.info('function', 'report_technical_error_success', { requestId });

      return {
        success: true,
        error_type: params.error_type,
        function_name: params.function_name,
        error_message: params.error_message || 'Unknown error',
        message: formattedErrorMessage
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] report_technical_error error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'report_technical_error_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error reporting technical issue: ${errorMessage}`
      };
    }
  }, []);

  // === FUTURES PATHWAYS FUNCTION IMPLEMENTATIONS ===

  // Implementation for pathway_exploration_function
  const pathwayExplorationFunction = useCallback(async (params: {
    interests: string[];
    education_level: string;
    skills?: string[];
    immediate_needs?: string;
  }): Promise<MentalHealthFunctionResult> => {
    try {
      const requestId = Date.now().toString().slice(-6);
      console.log(`[function] pathway_exploration_function called with requestId: ${requestId}`);
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

      const result = await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          function_mapping: ['pathway_exploration_function'],
          techniques: ['career_guidance', 'pathway_planning']
        }
      });

      console.log(`[function] pathway_exploration_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'pathway_exploration_function_success', { requestId });

      // Enhance the response with personalized pathway suggestions
      const enhancedMessage = result.message +
        `\n\n**Next Steps for You:**\n` +
        `- Consider exploring ${params.interests[0]} through volunteer opportunities or job shadowing\n` +
        `- Look into entry-level positions or internships in your areas of interest\n` +
        `- Research educational programs that align with your interests and current situation\n` +
        `- Would you like me to help you create a specific action plan for any of these pathways?`;

      return {
        ...result,
        message: enhancedMessage,
        pathway_suggestions: params.interests,
        education_level: params.education_level
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFunctionError(errorMessage);
      return {
        success: false,
        error: `Error exploring career pathways: ${errorMessage}`
      };
    }
  }, [queryBookContent]);

  // Implementation for educational_guidance_function
  const educationalGuidanceFunction = useCallback(async (params: {
    pathway_type: string;
    financial_situation?: string;
    timeline?: string;
  }): Promise<MentalHealthFunctionResult> => {
    try {
      const requestId = Date.now().toString().slice(-6);
      console.log(`[function] educational_guidance_function called with requestId: ${requestId}`);
      audioLogger.info('function', 'educational_guidance_function_called', { requestId, pathway_type: params.pathway_type });

      setFunctionError(null);

      let queryText = `educational guidance for ${params.pathway_type.replace('_', ' ')}`;

      if (params.financial_situation) {
        queryText += ` with ${params.financial_situation.replace('_', ' ')} financial situation`;
      }

      if (params.timeline) {
        queryText += ` starting ${params.timeline.replace('_', ' ')}`;
      }

      const result = await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          function_mapping: ['educational_guidance_function'],
          techniques: ['educational_planning', 'academic_support']
        }
      });

      console.log(`[function] educational_guidance_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'educational_guidance_function_success', { requestId });

      // Add specific educational resources and next steps
      const enhancedMessage = result.message +
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
        ...result,
        message: enhancedMessage,
        pathway_type: params.pathway_type,
        recommendations: 'specific_programs_available'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFunctionError(errorMessage);
      return {
        success: false,
        error: `Error providing educational guidance: ${errorMessage}`
      };
    }
  }, [queryBookContent]);

  // Implementation for skill_building_function
  const skillBuildingFunction = useCallback(async (params: {
    skill_area: string;
    current_level?: string;
    immediate_application?: string;
  }): Promise<MentalHealthFunctionResult> => {
    try {
      const requestId = Date.now().toString().slice(-6);
      console.log(`[function] skill_building_function called with requestId: ${requestId}`);
      audioLogger.info('function', 'skill_building_function_called', { requestId, skill_area: params.skill_area });

      setFunctionError(null);

      let queryText = `skill building techniques for ${params.skill_area.replace('_', ' ')}`;

      if (params.current_level) {
        queryText += ` at ${params.current_level} level`;
      }

      if (params.immediate_application) {
        queryText += ` for ${params.immediate_application}`;
      }

      const result = await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          function_mapping: ['skill_building_function'],
          techniques: ['skill_development', 'job_readiness']
        }
      });

      console.log(`[function] skill_building_function success for requestId: ${requestId}`);
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

      const enhancedMessage = result.message +
        `\n\n**Practical Steps to Build This Skill:**\n` +
        steps.map((step, index) => `${index + 1}. ${step}`).join('\n') +
        `\n\nWould you like me to help you create a practice schedule or find resources for developing this skill?`;

      return {
        ...result,
        message: enhancedMessage,
        skill_area: params.skill_area,
        action_steps: steps
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFunctionError(errorMessage);
      return {
        success: false,
        error: `Error providing skill building guidance: ${errorMessage}`
      };
    }
  }, [queryBookContent]);

  // Implementation for goal_planning_function
  const goalPlanningFunction = useCallback(async (params: {
    goal_description: string;
    goal_type: string;
    timeline?: string;
    current_barriers?: string[];
  }): Promise<MentalHealthFunctionResult> => {
    try {
      const requestId = Date.now().toString().slice(-6);
      console.log(`[function] goal_planning_function called with requestId: ${requestId}`);
      audioLogger.info('function', 'goal_planning_function_called', { requestId, goal_type: params.goal_type });

      setFunctionError(null);

      let queryText = `goal planning and action steps for ${params.goal_type.replace('_', ' ')} goal: ${params.goal_description}`;

      if (params.timeline) {
        queryText += ` with ${params.timeline.replace('_', ' ')} timeline`;
      }

      if (params.current_barriers?.length) {
        queryText += ` addressing barriers like ${params.current_barriers.join(', ')}`;
      }

      const result = await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          function_mapping: ['goal_planning_function'],
          techniques: ['goal_setting', 'action_planning']
        }
      });

      console.log(`[function] goal_planning_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'goal_planning_function_success', { requestId });

      // Create a structured action plan
      const enhancedMessage = result.message +
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
        ...result,
        message: enhancedMessage,
        goal_type: params.goal_type,
        action_plan: 'structured_plan_created',
        barriers_addressed: params.current_barriers?.length || 0
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFunctionError(errorMessage);
      return {
        success: false,
        error: `Error creating goal plan: ${errorMessage}`
      };
    }
  }, [queryBookContent]);

  // Implementation for resource_connection_function
  const resourceConnectionFunction = useCallback(async (params: {
    connection_type: string;
    field_of_interest: string;
    comfort_level?: string;
  }): Promise<MentalHealthFunctionResult> => {
    try {
      const requestId = Date.now().toString().slice(-6);
      console.log(`[function] resource_connection_function called with requestId: ${requestId}`);
      audioLogger.info('function', 'resource_connection_function_called', { requestId, connection_type: params.connection_type, field_of_interest: params.field_of_interest });

      setFunctionError(null);

      let queryText = `${params.connection_type.replace('_', ' ')} opportunities in ${params.field_of_interest}`;

      if (params.comfort_level) {
        queryText += ` for someone who is ${params.comfort_level.replace('_', ' ')} with networking`;
      }

      const result = await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          function_mapping: ['resource_connection_function'],
          techniques: ['networking', 'professional_development']
        }
      });

      console.log(`[function] resource_connection_function success for requestId: ${requestId}`);
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

      const enhancedMessage = result.message +
        `\n\n**Connection Strategies for ${params.field_of_interest}:**\n` +
        strategies.map((strategy, index) => `${index + 1}. ${strategy}`).join('\n') +
        `\n\n**Places to Start:**\n` +
        `• Local community centers and libraries often host career events\n` +
        `• Online platforms like LinkedIn, Facebook groups, or Reddit communities\n` +
        `• Volunteer organizations related to your interests\n` +
        `• Educational institutions offering programs in your field\n\n` +
        `Remember: Most people are happy to share their experiences when asked respectfully. Would you like help crafting an introduction message or finding specific opportunities in your area?`;

      return {
        ...result,
        message: enhancedMessage,
        connection_type: params.connection_type,
        field_of_interest: params.field_of_interest,
        strategies_provided: strategies.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFunctionError(errorMessage);
      return {
        success: false,
        error: `Error providing connection guidance: ${errorMessage}`
      };
    }
  }, [queryBookContent]);

  // Implementation for futures_assessment_function
  const futuresAssessmentFunction = useCallback(async (params: {
    assessment_area: string;
    user_comfort_level?: string;
  }): Promise<MentalHealthFunctionResult> => {
    try {
      const requestId = Date.now().toString().slice(-6);
      console.log(`[function] futures_assessment_function called with requestId: ${requestId}`);
      audioLogger.info('function', 'futures_assessment_function_called', { requestId, assessment_area: params.assessment_area });

      setFunctionError(null);

      let queryText = `assessment and self-discovery for ${params.assessment_area.replace('_', ' ')}`;

      if (params.user_comfort_level) {
        queryText += ` with ${params.user_comfort_level.replace('_', ' ')} approach`;
      }

      const result = await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {
          function_mapping: ['futures_assessment_function'],
          techniques: ['self_assessment', 'strength_identification']
        }
      });

      console.log(`[function] futures_assessment_function success for requestId: ${requestId}`);
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

      const enhancedMessage = result.message +
        `\n\n**Self-Discovery Questions for ${params.assessment_area.replace('_', ' ')}:**\n\n` +
        questions.map((question, index) => `${index + 1}. ${question}`).join('\n\n') +
        `\n\n**How to Use These Questions:**\n` +
        `• Take your time thinking about each one\n` +
        `• There are no right or wrong answers\n` +
        `• Your answers might change over time, and that\'s okay\n` +
        `• Consider writing down your thoughts\n\n` +
        `After reflecting on these questions, would you like to discuss your answers with me? I can help you identify patterns and potential pathways based on what you discover about yourself.`;

      return {
        ...result,
        message: enhancedMessage,
        assessment_area: params.assessment_area,
        questions_provided: questions.length,
        next_step: 'reflection_and_discussion'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFunctionError(errorMessage);
      return {
        success: false,
        error: `Error providing assessment guidance: ${errorMessage}`
      };
    }
  }, [queryBookContent]);

  // Implementation for resource_feedback_function
  const resourceFeedbackFunction = useCallback(async (params: {
    searchId: string;
    helpful: boolean;
    resource_name?: string;
    comment?: string;
  }): Promise<MentalHealthFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] resource_feedback_function called with requestId: ${requestId}`);
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
        console.warn(`[function] No search data found for ID: ${params.searchId}`);
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
            console.error(`[function] Failed to log feedback: ${error.message}`);
          } else {
            console.log(`[function] Feedback logged successfully`);
          }
        } catch (logError) {
          console.error(`[function] Exception logging feedback: ${(logError as Error).message}`);
        }
      }

      console.log(`[function] resource_feedback_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'resource_feedback_function_success', { requestId });

      return {
        success: true,
        message: params.helpful
          ? "I'm glad these resources were helpful. Is there anything specific about these resources you'd like to discuss further?"
          : "I understand these resources weren't what you needed. Let me try to find different options that might be more helpful."
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] resource_feedback_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'resource_feedback_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: "Thank you for your feedback. I'll make note of this to help improve future resource recommendations."
      };
    }
  }, []);

  // Implementation for display_map_function
  const displayMapFunction = useCallback((params: {
    searchId: string;
  }): MentalHealthFunctionResult => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] display_map_function called with requestId: ${requestId}`);
    audioLogger.info('function', 'display_map_function_called', {
      requestId,
      searchId: params.searchId
    });

    try {
      setFunctionError(null);

      if (typeof window !== 'undefined') {
        const existingSearches = JSON.parse(sessionStorage.getItem('resource_searches') || '[]');
        const searchData = existingSearches.find((s: SearchHistoryEntry) => s.id === params.searchId);

        if (!searchData) {
          console.warn(`[function] No search data found for ID: ${params.searchId}`);
          return {
            success: false,
            error: "I couldn't find the search data to display on the map. Let's try a new search."
          };
        }

        const event = new CustomEvent('display_resource_map', {
          detail: { searchId: params.searchId }
        });
        window.dispatchEvent(event);

        console.log(`[function] display_map_function success for requestId: ${requestId}`);
        audioLogger.info('function', 'display_map_function_success', { requestId });

        return {
          success: true,
          message: "I'm displaying the resources on a map now. You can click on any marker to see more details about that resource."
        };
      } else {
        return {
          success: false,
          error: "I couldn't display the map in this environment."
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] display_map_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'display_map_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: "I encountered an issue while trying to display the resources on a map."
      };
    }
  }, []);

  // Function registry for WebRTC system - ALL 36 FUNCTIONS - memoized to prevent recreation
  const functionRegistry = useMemo(() => {
    console.log(`[resources] ===== CREATING FUNCTION REGISTRY =====`);
    console.log(`[resources] Registering resource_search_function in function registry`);
    console.log(`[resources] This function should be available for AI to call when user requests resources`);

    const registry = {
      // Core mental health functions
      'grounding_function': groundingFunction,
      'thought_exploration_function': thoughtExplorationFunction,
      'problem_solving_function': problemSolvingFunction,
      'screening_function': screeningFunction,
      'crisis_response_function': crisisResponseFunction,
      'getUserHistory_function': getUserHistoryFunction,
      'logInteractionOutcome_function': logInteractionOutcomeFunction, // THE MISSING FUNCTION!
      'cultural_humility_function': culturalHumilityFunction,
      'psychoeducation_function': psychoeducationFunction,
      'validation_function': validationFunction,
      'resource_search_function': resourceSearchFunction,
      'resource_feedback_function': resourceFeedbackFunction,
      'display_map_function': displayMapFunction,
      'query_book_content': queryBookContent,
      'end_session': endSession,
      'report_technical_error': reportTechnicalError,

      // Futures Pathways functions - V15 IMPLEMENTATIONS
      'pathway_exploration_function': pathwayExplorationFunction,
      'educational_guidance_function': educationalGuidanceFunction,
      'skill_building_function': skillBuildingFunction,
      'goal_planning_function': goalPlanningFunction,
      'resource_connection_function': resourceConnectionFunction,
      'futures_assessment_function': futuresAssessmentFunction,

      // Resource Locator functions - V15 IMPLEMENTATIONS
      'emergency_shelter_function': async (params: {
        urgency_level: string;
        age_group?: string;
        location: string;
        special_needs?: string[];
      }) => {
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
      },

      'food_assistance_function': async (params: {
        food_type: string;
        urgency?: string;
        location: string;
        transportation?: boolean;
      }) => {
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
      },

      'crisis_mental_health_function': async (params: {
        crisis_severity: string;
        crisis_type: string;
        preferred_contact?: string;
        identity_specific?: string[];
      }) => {
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
      },

      'healthcare_access_function': async (params: {
        healthcare_need: string;
        insurance_status?: string;
        location: string;
        age?: string;
      }) => {
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
      },

      'job_search_assistance_function': async (params: {
        experience_level: string;
        location: string;
        job_type?: string;
        interests?: string[];
        support_needed?: string[];
      }) => {
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
      },

      'lgbtq_support_function': async (params: {
        support_type: string;
        location: string;
        identity?: string[];
        meeting_preference?: string;
      }) => {
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
      },

      'legal_aid_function': async (params: {
        legal_issue: string;
        urgency?: string;
        location: string;
        age?: string;
      }) => {
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
      },

      'educational_support_function': async (params: {
        education_need: string;
        current_status?: string;
        location: string;
        schedule_needs?: string;
      }) => {
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
      },

      'transportation_assistance_function': async (params: {
        transportation_need: string;
        location: string;
        assistance_type?: string;
        duration?: string;
      }) => {
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
      },

      'substance_abuse_support_function': async (params: {
        support_type: string;
        location: string;
        substance_type?: string;
        treatment_preference?: string;
        insurance_status?: string;
      }) => {
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
      },

      'young_parent_support_function': async (params: {
        parent_type: string;
        support_needed: string;
        location: string;
        child_age?: string;
      }) => {
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
      },

      'domestic_violence_support_function': async (params: {
        situation_type: string;
        safety_level: string;
        resource_type: string;
        location?: string;
        contact_method?: string;
      }) => {
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
      },

      'basic_needs_assistance_function': async (params: {
        need_type: string;
        urgency?: string;
        location: string;
        age_group?: string;
      }) => {
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
      },

      'community_programs_function': async (params: {
        program_type: string;
        location: string;
        interests?: string[];
        schedule_preference?: string;
      }) => {
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
      }
    };

    console.log(`[resources] Function registry created with ${Object.keys(registry).length} functions`);
    console.log(`[resources] resource_search_function is registered:`, 'resource_search_function' in registry);
    console.log(`[resources] Registry function names:`, Object.keys(registry).filter(name => name.includes('resource')));

    return registry;
  }, [
    groundingFunction,
    thoughtExplorationFunction,
    problemSolvingFunction,
    screeningFunction,
    crisisResponseFunction,
    getUserHistoryFunction,
    logInteractionOutcomeFunction,
    culturalHumilityFunction,
    psychoeducationFunction,
    validationFunction,
    resourceSearchFunction,
    resourceFeedbackFunction,
    displayMapFunction,
    queryBookContent,
    endSession,
    reportTechnicalError,
    performResourceSearch,
    pathwayExplorationFunction,
    educationalGuidanceFunction,
    skillBuildingFunction,
    goalPlanningFunction,
    resourceConnectionFunction,
    futuresAssessmentFunction
  ]);

  // Get available functions for session configuration - memoized to prevent recreation
  const getAvailableFunctions = useMemo(() => {
    return mentalHealthFunctions;
  }, [mentalHealthFunctions]);

  const hookReturn = {
    // Core mental health function implementations
    groundingFunction,
    thoughtExplorationFunction,
    problemSolvingFunction,
    screeningFunction,
    crisisResponseFunction,
    getUserHistoryFunction,
    logInteractionOutcomeFunction, // THE MISSING FUNCTION NOW INCLUDED!
    culturalHumilityFunction,
    psychoeducationFunction,
    validationFunction,
    resourceSearchFunction,
    resourceFeedbackFunction,
    displayMapFunction,
    queryBookContent,
    endSession,
    reportTechnicalError,

    // Futures Pathways function implementations - V15 GREENFIELD
    pathwayExplorationFunction,
    educationalGuidanceFunction,
    skillBuildingFunction,
    goalPlanningFunction,
    resourceConnectionFunction,
    futuresAssessmentFunction,

    // Registry and configuration
    functionRegistry, // Now contains all 36 functions
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

  console.log(`[resources] ===== MENTAL HEALTH HOOK RETURN =====`);
  console.log(`[resources] Hook returning ${Object.keys(hookReturn).length} items`);
  console.log(`[resources] resourceSearchFunction available:`, 'resourceSearchFunction' in hookReturn);
  console.log(`[resources] functionRegistry available:`, 'functionRegistry' in hookReturn);
  console.log(`[resources] Registry has ${Object.keys(hookReturn.functionRegistry).length} functions`);
  console.log(`[resources] resource_search_function in registry:`, 'resource_search_function' in hookReturn.functionRegistry);

  return hookReturn;
}