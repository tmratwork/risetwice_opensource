// src/hooksV15/functions/use-sleep-functions-v15.ts

"use client";

import { useState, useCallback, useMemo, useRef } from 'react';
import { generateMentalHealthFunctions } from '@/app/chatbotV11/prompts/function-descriptions-mh';
import audioLogger from '../audio/audio-logger';
import type { GPTFunction } from './use-book-functions-v15';

/**
 * V15 Sleep Functions Hook - Greenfield Implementation
 * Provides sleep-specific function implementations for V15 WebRTC system
 * Based on mental health functions but adapted for sleep wellness
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

export interface SleepFunctionResult {
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

export function useSleepFunctionsV15() {
  const [lastFunctionResult, setLastFunctionResult] = useState<SleepFunctionResult | null>(null);
  const [functionError, setFunctionError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);

  // Get functions from the prompts module but adapted for sleep - memoized to prevent recreation
  const sleepFunctions: GPTFunction[] = useMemo(() => {
    console.log(`[AI-INTERACTION] ===== GENERATING SLEEP FUNCTIONS =====`);
    console.log(`[AI-INTERACTION] Adapting generateMentalHealthFunctions() for sleep-specific use`);

    // Start with base mental health functions and adapt them for sleep
    const baseFunctions = generateMentalHealthFunctions();

    // Filter and adapt functions for sleep wellness
    const sleepAdaptedFunctions = baseFunctions.map(func => {
      // Adapt function descriptions for sleep context
      if (func.name === 'resource_search_function') {
        return {
          ...func,
          description: func.description?.replace('mental health', 'sleep wellness').replace('Mental health', 'Sleep wellness')
        };
      }
      if (func.name === 'grounding_function') {
        return {
          ...func,
          description: 'Provides sleep-focused relaxation and calming techniques to help with sleep preparation and anxiety around bedtime'
        };
      }
      if (func.name === 'thought_exploration_function') {
        return {
          ...func,
          description: 'Helps explore sleep-related thoughts, concerns, and patterns that may be affecting sleep quality'
        };
      }
      if (func.name === 'problem_solving_function') {
        return {
          ...func,
          description: 'Provides strategies for solving sleep-related problems and challenges'
        };
      }
      return func;
    });

    console.log(`[AI-INTERACTION] Generated ${sleepAdaptedFunctions.length} sleep-adapted function definitions for AI`);
    console.log(`[AI-INTERACTION] Function names from prompts:`, sleepAdaptedFunctions.map(f => f.name));
    console.log(`[AI-INTERACTION] sleep_resource_search_function defined:`, sleepAdaptedFunctions.some(f => f.name === 'sleep_resource_search_function'));

    return sleepAdaptedFunctions;
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

  // === CORE SLEEP FUNCTIONS ===

  // Implementation for sleep_hygiene_function
  const sleepHygieneFunction = useCallback(async (params: {
    concern_area: string;
    current_habits?: string;
  }): Promise<SleepFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] sleep_hygiene_function called with requestId: ${requestId}`);
    audioLogger.info('function', 'sleep_hygiene_function_called', {
      requestId,
      concern_area: params.concern_area,
      current_habits: params.current_habits
    });

    try {
      setFunctionError(null);

      // Build query for sleep content
      let queryText = `sleep hygiene for ${params.concern_area.replace('_', ' ')}`;
      if (params.current_habits) {
        queryText += ` considering current habits ${params.current_habits}`;
      }

      const result = await queryBookContent({
        query: queryText,
        namespace: 'sleep_wellness_companion_v250420',
        filter_metadata: {
          techniques: ['sleep_hygiene'],
          scenarios: ['sleep_improvement'],
          function_mapping: ['sleep_hygiene_function']
        }
      });

      console.log(`[function] sleep_hygiene_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'sleep_hygiene_function_success', { requestId });
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] sleep_hygiene_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'sleep_hygiene_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing sleep hygiene guidance: ${errorMessage}`
      };
    }
  }, []);

  // Implementation for sleep_relaxation_function
  const sleepRelaxationFunction = useCallback(async (params: {
    relaxation_type: string;
    sleep_difficulty?: string;
  }): Promise<SleepFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] sleep_relaxation_function called with requestId: ${requestId}`);
    audioLogger.info('function', 'sleep_relaxation_function_called', {
      requestId,
      relaxation_type: params.relaxation_type,
      sleep_difficulty: params.sleep_difficulty
    });

    try {
      setFunctionError(null);

      let queryText = `sleep relaxation ${params.relaxation_type.replace('_', ' ')} techniques`;
      if (params.sleep_difficulty) {
        queryText += ` for ${params.sleep_difficulty.replace('_', ' ')}`;
      }

      const result = await queryBookContent({
        query: queryText,
        namespace: 'sleep_wellness_companion_v250420',
        filter_metadata: {
          techniques: ['relaxation', 'sleep_induction'],
          function_mapping: ['sleep_relaxation_function']
        }
      });

      console.log(`[function] sleep_relaxation_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'sleep_relaxation_function_success', { requestId });
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] sleep_relaxation_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'sleep_relaxation_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing sleep relaxation techniques: ${errorMessage}`
      };
    }
  }, []);

  // Implementation for sleep_schedule_function
  const sleepScheduleFunction = useCallback(async (params: {
    schedule_goal: string;
    current_schedule?: string;
    lifestyle_factors?: string[];
  }): Promise<SleepFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] sleep_schedule_function called with requestId: ${requestId}`);
    audioLogger.info('function', 'sleep_schedule_function_called', {
      requestId,
      schedule_goal: params.schedule_goal,
      current_schedule: params.current_schedule
    });

    try {
      setFunctionError(null);

      let queryText = `sleep schedule ${params.schedule_goal.replace('_', ' ')}`;
      if (params.current_schedule) {
        queryText += ` from ${params.current_schedule}`;
      }
      if (params.lifestyle_factors?.length) {
        queryText += ` considering ${params.lifestyle_factors.join(' ')}`;
      }

      const result = await queryBookContent({
        query: queryText,
        namespace: 'sleep_wellness_companion_v250420',
        filter_metadata: {
          techniques: ['sleep_scheduling', 'circadian_rhythm'],
          function_mapping: ['sleep_schedule_function']
        }
      });

      console.log(`[function] sleep_schedule_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'sleep_schedule_function_success', { requestId });
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] sleep_schedule_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'sleep_schedule_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing sleep schedule guidance: ${errorMessage}`
      };
    }
  }, []);

  // Implementation for sleep_environment_function
  const sleepEnvironmentFunction = useCallback(async (params: {
    environment_factor: string;
    current_setup?: string;
    budget_constraints?: string;
  }): Promise<SleepFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] sleep_environment_function called with requestId: ${requestId}`);
    audioLogger.info('function', 'sleep_environment_function_called', {
      requestId,
      environment_factor: params.environment_factor,
      current_setup: params.current_setup
    });

    try {
      setFunctionError(null);

      let queryText = `sleep environment ${params.environment_factor.replace('_', ' ')} optimization`;
      if (params.current_setup) {
        queryText += ` current setup ${params.current_setup}`;
      }
      if (params.budget_constraints) {
        queryText += ` ${params.budget_constraints} budget`;
      }

      const result = await queryBookContent({
        query: queryText,
        namespace: 'sleep_wellness_companion_v250420',
        filter_metadata: {
          techniques: ['sleep_environment'],
          function_mapping: ['sleep_environment_function']
        }
      });

      console.log(`[function] sleep_environment_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'sleep_environment_function_success', { requestId });
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] sleep_environment_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'sleep_environment_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing sleep environment guidance: ${errorMessage}`
      };
    }
  }, []);

  // Implementation for sleep_tracking_function
  const sleepTrackingFunction = useCallback(async (params: {
    tracking_method: string;
    goals?: string[];
  }): Promise<SleepFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] sleep_tracking_function called with requestId: ${requestId}`);
    audioLogger.info('function', 'sleep_tracking_function_called', {
      requestId,
      tracking_method: params.tracking_method,
      goals: params.goals
    });

    try {
      setFunctionError(null);

      let queryText = `sleep tracking ${params.tracking_method.replace('_', ' ')}`;
      if (params.goals?.length) {
        queryText += ` for ${params.goals.join(' ')}`;
      }

      const result = await queryBookContent({
        query: queryText,
        namespace: 'sleep_wellness_companion_v250420',
        filter_metadata: {
          techniques: ['sleep_monitoring'],
          function_mapping: ['sleep_tracking_function']
        }
      });

      console.log(`[function] sleep_tracking_function success for requestId: ${requestId}`);
      audioLogger.info('function', 'sleep_tracking_function_success', { requestId });
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] sleep_tracking_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'sleep_tracking_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing sleep tracking guidance: ${errorMessage}`
      };
    }
  }, []);

  // Helper function for resource locator functions - shared logic for sleep resources
  const performSleepResourceSearch = useCallback(async (params: {
    query: string;
    resource_type?: string;
    location_specific?: boolean;
    location?: string;
    mapView?: boolean;
    customSearchId?: string;
  }): Promise<SleepFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);
    const searchId = params.customSearchId || `sleep-search-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    console.log(`[sleep-resources] ===== PERFORMING SLEEP RESOURCE SEARCH =====`);
    console.log(`[sleep-resources] Function called with requestId: ${requestId}, searchId: ${searchId}`);
    console.log(`[sleep-resources] Input parameters:`, {
      query: params.query,
      resource_type: params.resource_type,
      location_specific: params.location_specific,
      location: params.location,
      mapView: params.mapView
    });

    audioLogger.info('function', 'sleep_resource_search_called', {
      requestId,
      searchId,
      query: params.query,
      resource_type: params.resource_type,
      location: params.location
    });

    if (typeof window !== 'undefined') {
      (window as unknown as { __lastSleepResourceSearchId: string }).__lastSleepResourceSearchId = searchId;
    }

    try {
      console.log(`[sleep-resources] Entering try block - clearing function error`);
      setFunctionError(null);

      if (params.location_specific === true && !params.location) {
        console.log(`[sleep-resources] Location required but not provided - returning location request message`);
        return {
          success: true,
          needsLocation: true,
          message: "To provide more relevant sleep resources, I'll need to know your location. Could you tell me what city or region you're in?"
        };
      }

      // Show toast notification immediately when search starts
      console.log(`[sleep-resources] ===== SHOWING TOAST NOTIFICATION =====`);
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
        console.log(`[sleep-resources] ✅ Toast notification event dispatched`);
      }

      // Start the actual search - use sleep-specific endpoint if available
      console.log(`[sleep-resources] ===== STARTING SLEEP WEB SEARCH API CALL =====`);
      const userId = localStorage.getItem('userId');
      const requestData = {
        ...params,
        userId: userId || undefined,
        searchId,
        sleepSpecific: true, // Flag for sleep-specific searches
      };
      console.log(`[sleep-resources] Prepared request data for API call:`, requestData);

      // Add periodic status updates during search
      const updateStatus = (status: string) => {
        if (typeof window !== 'undefined') {
          const statusEvent = new CustomEvent('search_toast_update', {
            detail: { searchId, status }
          });
          window.dispatchEvent(statusEvent);
          console.log(`[sleep-resources] 📡 Status update: ${status}`);
        }
      };

      // Add timeout to prevent function from hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`[sleep-resources] ❌ Fetch timeout after 2 minutes - aborting request`);
        updateStatus('Search taking longer than expected...');
        controller.abort();
      }, 120000); // 2 minute timeout

      console.log(`[sleep-resources] Making fetch request with 2 minute timeout`);
      updateStatus('Searching sleep wellness databases (will take a minute)...');

      // Use sleep-specific resource search endpoint or fallback to general resource search
      const response = await fetch('/api/v11/sleep-resource-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
        signal: controller.signal
      }).catch(async () => {
        // Fallback to general resource search if sleep-specific endpoint doesn't exist
        console.log(`[sleep-resources] Sleep-specific endpoint not available, falling back to general resource search`);
        return fetch('/api/v11/resource-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...requestData,
            query: `sleep wellness ${requestData.query}` // Prefix with sleep context
          }),
          signal: controller.signal
        });
      });

      clearTimeout(timeoutId);
      console.log(`[sleep-resources] Fetch request completed before timeout`);
      updateStatus('Processing sleep resource results...');

      console.log(`[sleep-resources] ===== FETCH API RESPONSE RECEIVED =====`);
      console.log(`[sleep-resources] Fetch call completed with status:`, response.status, response.statusText);

      if (!response.ok) {
        console.log(`[sleep-resources] ❌ API call failed with status ${response.status}: ${response.statusText}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`[sleep-resources] ✅ API call successful, parsing JSON response`);
      updateStatus('Parsing sleep resource results...');

      const data = await response.json();

      console.log(`[sleep-resources] ===== JSON RESPONSE PARSED =====`);
      console.log(`[sleep-resources] JSON parsing completed successfully`);
      console.log(`[sleep-resources] Parsed API response data:`, {
        hasResults: !!data.results,
        resultCount: data.results?.resources?.length || 0,
        summary: data.results?.summary?.substring(0, 100) + '...' || 'no summary',
        success: data.success,
        hasError: !!data.error
      });

      if (!data.success) {
        console.log(`[sleep-resources] ❌ API returned success:false`);
        console.log(`[sleep-resources] API error:`, data.error);
        updateStatus('Sleep resource search encountered an error...');
      } else {
        const resourceCount = data.results?.resources?.length || 0;
        updateStatus(`Found ${resourceCount} sleep resources, organizing results...`);
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
        const existingSearches = JSON.parse(sessionStorage.getItem('sleep_resource_searches') || '[]');
        existingSearches.push(historyEntry);
        sessionStorage.setItem('sleep_resource_searches', JSON.stringify(existingSearches));
      }

      // Check for automatic map display
      const hasResourcesWithLocations = data.results.resources.some((r: Resource) => r.location);
      let mapMessage = '';
      let autoMapTriggered = false;

      if (hasResourcesWithLocations && typeof window !== 'undefined') {
        const event = new CustomEvent('display_resource_map', { detail: { searchId } });
        window.dispatchEvent(event);
        autoMapTriggered = true;
        mapMessage = "\n\nI've automatically displayed these sleep resources on a map so you can see their locations.";
      }

      const displayMessage = data.results.formatted_response ||
        `${data.results.summary}\n\n${data.results.resources.map((resource: Resource) => {
          return `**${resource.name}** (${resource.resource_type})\n${resource.description}\n${resource.contact ? '**Contact:** ' + resource.contact : ''}\n${resource.website ? `**Website:** [${resource.website}](${resource.website})` : ''}${resource.location ? `\n**Location:** ${resource.location}` : ''}`;
        }).join('\n\n')}`;

      const feedbackMessage = "\n\nWere these sleep resources helpful for you? I can try to find different resources if needed.";

      console.log(`[sleep-resources] ===== PREPARING FINAL RESPONSE =====`);
      const finalMessage = displayMessage + mapMessage + feedbackMessage;
      console.log(`[sleep-resources] Final combined message length: ${finalMessage.length} chars`);

      console.log(`[function] performSleepResourceSearch success for requestId: ${requestId}`);
      audioLogger.info('function', 'sleep_resource_search_success', {
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
        console.log(`[sleep-resources] ✅ Search completion event dispatched to hide toast`);
      }

      return finalResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[sleep-resources] ===== ERROR IN SLEEP RESOURCE SEARCH =====`);
      console.log(`[sleep-resources] ❌ Error occurred during sleep resource search:`, errorMessage);

      audioLogger.error('function', 'sleep_resource_search_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      // For timeout, return a different message 
      let errorMessage_final = errorMessage;
      if (error instanceof Error && error.name === 'AbortError') {
        errorMessage_final = `I apologize, but the sleep resource search is taking longer than expected. Let me try a different approach to find sleep resources for you.`;
        console.log(`[sleep-resources] Returning timeout message`);
      }

      const errorResult = {
        success: false,
        error: `Error searching for sleep wellness resources: ${errorMessage_final}`
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
        console.log(`[sleep-resources] ✅ Error completion event dispatched to hide toast`);
      }

      return errorResult;
    }
  }, []);

  // Implementation for sleep_resource_search_function
  const sleepResourceSearchFunction = useCallback(async (params: {
    query: string;
    resource_type?: string;
    location_specific?: boolean;
    location?: string;
    mapView?: boolean;
  }): Promise<SleepFunctionResult> => {
    return performSleepResourceSearch(params);
  }, [performSleepResourceSearch]);

  // Helper function to query book content - used by multiple functions
  const queryBookContent = useCallback(async (params: {
    query: string;
    namespace: string;
    filter_metadata?: Record<string, unknown>;
    book?: string;
  }): Promise<SleepFunctionResult> => {
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

      const finalNamespace = params.namespace || 'sleep_wellness_companion_v250420';
      const bookId = params.book || localStorage.getItem('selectedBookId') || 'sleep_wellness_companion';

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
        error: `Error querying sleep wellness content: ${errorMessage}`
      };
    }
  }, []);

  // Implementation for getUserHistory_function (adapted for sleep)
  const getUserHistoryFunction = useCallback((params: {
    history_type: string;
  }): SleepFunctionResult => {
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
            message: `Retrieved sleep function effectiveness history. Most effective functions: ${Object.entries(userHistoryRef.current.functionEffectiveness)
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
            message: `Retrieved sleep skill progress. Most used skills: ${Object.entries(userHistoryRef.current.skills)
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
              message: `Recent sleep interaction approaches: ${recentInteractions || 'No recent interactions recorded'}`
            },
            message: `Recent sleep interaction approaches: ${recentInteractions || 'No recent interactions recorded'}`
          };

        default:
          return {
            success: true,
            history_type: params.history_type,
            message: 'No specific sleep history data available for this type.'
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

  // Implementation for logInteractionOutcome_function (adapted for sleep)
  const logInteractionOutcomeFunction = useCallback((params: {
    approach_used: string;
    effectiveness_rating: string;
    user_engagement?: string;
  }): SleepFunctionResult => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] logInteractionOutcome_function called with requestId: ${requestId}`);
    console.log(`[function] Sleep approach used: ${params.approach_used}`);
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
        message: `Sleep interaction outcome logged successfully.`,
        result: 'recorded'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] logInteractionOutcome_function error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'logInteractionOutcome_function_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error logging sleep interaction outcome: ${errorMessage}`
      };
    }
  }, []);

  // Implementation for end_session
  const endSession = useCallback(() => {
    console.log('[FUNCTION-EXEC] end_session function called - starting execution');
    try {
      setFunctionError(null);

      console.log('[FUNCTION-EXEC] end_session: clearing function error state');

      // V15 GREENFIELD FIX: DO NOT dispatch ai_end_session event immediately
      // Let the WebRTC flow handle the goodbye response and volume monitoring
      console.log('[FUNCTION-EXEC] end_session: allowing WebRTC flow to handle goodbye gracefully');

      const result = {
        success: true,
        message: "Sleep well! I'll end our session now. Take care!"
      };
      console.log('[FUNCTION-EXEC] end_session: returning success result for AI to say goodbye:', result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[FUNCTION-EXEC] end_session: error occurred:', error);

      setFunctionError(errorMessage);

      const errorResult = {
        success: false,
        error: `Failed to end session: ${errorMessage}`
      };
      console.log('[FUNCTION-EXEC] end_session: returning error result:', errorResult);
      return errorResult;
    }
  }, []);

  // Function registry for WebRTC system - Sleep-specific functions - memoized to prevent recreation
  const functionRegistry = useMemo(() => {
    console.log(`[sleep] ===== CREATING SLEEP FUNCTION REGISTRY =====`);
    console.log(`[sleep] Registering sleep_resource_search_function in function registry`);
    console.log(`[sleep] This function should be available for AI to call when user requests sleep resources`);

    const registry = {
      // Core sleep functions
      'sleep_hygiene_function': sleepHygieneFunction,
      'sleep_relaxation_function': sleepRelaxationFunction,
      'sleep_schedule_function': sleepScheduleFunction,
      'sleep_environment_function': sleepEnvironmentFunction,
      'sleep_tracking_function': sleepTrackingFunction,
      'sleep_resource_search_function': sleepResourceSearchFunction,
      'getUserHistory_function': getUserHistoryFunction,
      'logInteractionOutcome_function': logInteractionOutcomeFunction,
      'query_book_content': queryBookContent,
      'end_session': endSession,

      // Sleep-specific resource locator functions
      'sleep_clinic_function': async (params: {
        sleep_disorder?: string;
        location: string;
        insurance_status?: string;
        urgency?: string;
      }) => {
        const searchId = `sleep-clinic-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let query = `sleep clinic sleep specialist`;
        if (params.sleep_disorder) {
          query += ` ${params.sleep_disorder.replace('_', ' ')}`;
        }
        if (params.insurance_status === 'no_insurance') {
          query += ' free low cost';
        }
        if (params.urgency === 'urgent') {
          query += ' immediate appointment';
        }
        return performSleepResourceSearch({
          query,
          resource_type: 'medical',
          location: params.location,
          location_specific: true,
          mapView: true,
          customSearchId: searchId
        });
      },

      'sleep_study_function': async (params: {
        study_type: string;
        location: string;
        insurance_coverage?: boolean;
      }) => {
        const searchId = `sleep-study-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let query = `sleep study ${params.study_type.replace('_', ' ')}`;
        if (params.insurance_coverage === false) {
          query += ' affordable self pay';
        }
        return performSleepResourceSearch({
          query,
          resource_type: 'medical',
          location: params.location,
          location_specific: true,
          mapView: true,
          customSearchId: searchId
        });
      },

      'sleep_support_groups_function': async (params: {
        sleep_issue: string;
        location: string;
        meeting_format?: string;
      }) => {
        const searchId = `sleep-support-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let query = `sleep support group ${params.sleep_issue.replace('_', ' ')}`;
        if (params.meeting_format) {
          query += ` ${params.meeting_format.replace('_', ' ')}`;
        }
        return performSleepResourceSearch({
          query,
          resource_type: 'support_group',
          location: params.location,
          location_specific: true,
          mapView: true,
          customSearchId: searchId
        });
      },

      'sleep_products_function': async (params: {
        product_category: string;
        budget_range?: string;
        specific_need?: string;
      }) => {
        const searchId = `sleep-products-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let query = `sleep ${params.product_category.replace('_', ' ')}`;
        if (params.specific_need) {
          query += ` for ${params.specific_need.replace('_', ' ')}`;
        }
        if (params.budget_range) {
          query += ` ${params.budget_range.replace('_', ' ')} price`;
        }
        return performSleepResourceSearch({
          query,
          resource_type: 'product_recommendation',
          location_specific: false,
          mapView: false,
          customSearchId: searchId
        });
      },

      'sleep_apps_function': async (params: {
        app_type: string;
        features_needed?: string[];
        device_type?: string;
      }) => {
        const searchId = `sleep-apps-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        let query = `sleep ${params.app_type.replace('_', ' ')} app`;
        if (params.features_needed?.length) {
          query += ` ${params.features_needed.join(' ')}`;
        }
        if (params.device_type) {
          query += ` ${params.device_type}`;
        }
        return performSleepResourceSearch({
          query,
          resource_type: 'digital_tool',
          location_specific: false,
          mapView: false,
          customSearchId: searchId
        });
      }
    };

    console.log(`[sleep] Function registry created with ${Object.keys(registry).length} functions`);
    console.log(`[sleep] sleep_resource_search_function is registered:`, 'sleep_resource_search_function' in registry);
    console.log(`[sleep] Registry function names:`, Object.keys(registry).filter(name => name.includes('sleep')));

    return registry;
  }, [
    sleepHygieneFunction,
    sleepRelaxationFunction,
    sleepScheduleFunction,
    sleepEnvironmentFunction,
    sleepTrackingFunction,
    sleepResourceSearchFunction,
    getUserHistoryFunction,
    logInteractionOutcomeFunction,
    queryBookContent,
    endSession,
    performSleepResourceSearch
  ]);

  // Get available functions for session configuration - memoized to prevent recreation
  const getAvailableFunctions = useMemo(() => {
    return sleepFunctions;
  }, [sleepFunctions]);

  const hookReturn = {
    // Core sleep function implementations
    sleepHygieneFunction,
    sleepRelaxationFunction,
    sleepScheduleFunction,
    sleepEnvironmentFunction,
    sleepTrackingFunction,
    sleepResourceSearchFunction,
    getUserHistoryFunction,
    logInteractionOutcomeFunction,
    queryBookContent,
    endSession,

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

  console.log(`[sleep] ===== SLEEP HOOK RETURN =====`);
  console.log(`[sleep] Hook returning ${Object.keys(hookReturn).length} items`);
  console.log(`[sleep] sleepResourceSearchFunction available:`, 'sleepResourceSearchFunction' in hookReturn);
  console.log(`[sleep] functionRegistry available:`, 'functionRegistry' in hookReturn);
  console.log(`[sleep] Registry has ${Object.keys(hookReturn.functionRegistry).length} functions`);
  console.log(`[sleep] sleep_resource_search_function in registry:`, 'sleep_resource_search_function' in hookReturn.functionRegistry);

  return hookReturn;
}