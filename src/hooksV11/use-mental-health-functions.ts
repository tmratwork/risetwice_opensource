"use client";

import { useState, useCallback, useRef } from 'react';
import { GPTFunction } from './use-webrtc';
import { generateMentalHealthFunctions } from '@/app/chatbotV11/prompts/function-descriptions-mh';
import { supabase } from '@/lib/supabase';

/**
 * Hook to provide mental health function implementations for the WebRTC service
 */
export function useMentalHealthFunctions() {
  // Interface for mental health resources
  interface Resource {
    name: string;
    description: string;
    resource_type: string;
    contact?: string | null;
    website?: string | null;
    verified?: boolean;
    location?: string;
    coordinates?: [number, number]; // [longitude, latitude]
  }

  // Interface for search history entry
  interface SearchHistoryEntry {
    id: string;
    timestamp: number;
    query: string;
    resource_type?: string;
    location?: string;
    results: {
      resources: Resource[];
      summary?: string;
      result_count?: number;
      [key: string]: unknown; // Allow other properties from the API response
    };
  }

  type MentalHealthFunctionResult = {
    success: boolean;
    data?: {
      content?: string[];
      error?: string;
      message?: string;
      [key: string]: unknown;
    };
    error?: string;
    [key: string]: unknown;
  };

  const [lastFunctionResult, setLastFunctionResult] = useState<MentalHealthFunctionResult | null>(null);
  const [functionError, setFunctionError] = useState<string | null>(null);

  // Get functions from the prompts module
  const mentalHealthFunctions: GPTFunction[] = generateMentalHealthFunctions();

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

  // Implementation for grounding_function
  const groundingFunction = useCallback(async ({
    distress_level,
    technique_type
  }: {
    distress_level: string;
    technique_type?: string;
  }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[GROUNDING-${requestId}]`;

    console.log(`${logPrefix} === GROUNDING_FUNCTION CALLED ===`);
    console.log(`${logPrefix} Distress level: ${distress_level}`);
    console.log(`${logPrefix} Technique type: ${technique_type || 'not specified'}`);

    try {
      setFunctionError(null);

      // Call the query_book_content function to get appropriate grounding techniques
      const queryParams: {
        techniques: string[];
        scenarios: string[];
        urgency_level: string;
      } = {
        techniques: ['grounding'],
        scenarios: ['distress'],
        urgency_level: distress_level
      };

      if (technique_type) {
        // Refine the query based on the technique type
        let additionalKeywords = '';
        switch (technique_type) {
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

        // Get the book ID before making the call
        const bookId = localStorage.getItem('selectedBookId') || 'trauma_informed_youth_mental_health_companion';
        console.log(`${logPrefix} Book ID for grounding techniques: ${bookId}`);

        // Use the queryParams for metadata filtering
        return await queryBookContent({
          query: `grounding techniques for ${distress_level} distress ${additionalKeywords}`,
          namespace: 'trauma_informed_youth_mental_health_companion_v250420',
          filter_metadata: queryParams,
          book: bookId // Explicitly pass book ID to ensure it's included
        });
      } else {
        // More general query without specific technique
        // Get the book ID before making the call
        const bookId = localStorage.getItem('selectedBookId') || 'trauma_informed_youth_mental_health_companion';
        console.log(`${logPrefix} Book ID for general grounding techniques: ${bookId}`);

        return await queryBookContent({
          query: `grounding techniques for ${distress_level} distress`,
          namespace: 'trauma_informed_youth_mental_health_companion_v250420',
          filter_metadata: queryParams,
          book: bookId // Explicitly pass book ID to ensure it's included
        });
      }
    } catch (error) {
      console.error(`${logPrefix} Error in groundingFunction:`, error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: `Error providing grounding techniques: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }, []);

  // Implementation for thought_exploration_function
  const thoughtExplorationFunction = useCallback(async ({
    thought_type,
    related_emotion
  }: {
    thought_type: string;
    related_emotion?: string;
  }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[THOUGHT-EXPLORATION-${requestId}]`;

    console.log(`${logPrefix} === THOUGHT_EXPLORATION_FUNCTION CALLED ===`);
    console.log(`${logPrefix} Thought type: ${thought_type}`);
    console.log(`${logPrefix} Related emotion: ${related_emotion || 'not specified'}`);

    try {
      setFunctionError(null);

      // Query parameters for filtering
      const queryParams: {
        techniques: string[];
        function_mapping: string[];
        scenarios?: string[];
      } = {
        techniques: ['CBT'],
        function_mapping: ['thought_exploration_function']
      };

      // Build the query based on thought type and emotion
      let queryText = `cognitive behavioral therapy for ${thought_type.replace('_', ' ')} thoughts`;
      if (related_emotion) {
        queryText += ` related to ${related_emotion} emotions`;
      }

      return await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: queryParams
      });
    } catch (error) {
      console.error(`${logPrefix} Error in thoughtExplorationFunction:`, error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: `Error providing thought exploration techniques: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }, []);

  // Implementation for problem_solving_function
  const problemSolvingFunction = useCallback(async ({
    problem_category,
    complexity
  }: {
    problem_category: string;
    complexity?: string;
  }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[PROBLEM-SOLVING-${requestId}]`;

    console.log(`${logPrefix} === PROBLEM_SOLVING_FUNCTION CALLED ===`);
    console.log(`${logPrefix} Problem category: ${problem_category}`);
    console.log(`${logPrefix} Complexity: ${complexity || 'not specified'}`);

    try {
      setFunctionError(null);

      // Query parameters for filtering
      const queryParams: {
        techniques: string[];
        function_mapping: string[];
        scenarios?: string[];
      } = {
        techniques: ['problem_solving'],
        function_mapping: ['problem_solving_function']
      };

      // If the problem is related to basic needs, add that scenario
      if (problem_category === 'basic_needs') {
        queryParams.scenarios = ['basic_needs'];
      }

      // Build the query based on problem category and complexity
      let queryText = `problem solving techniques for ${problem_category.replace('_', ' ')} issues`;
      if (complexity) {
        queryText += ` of ${complexity} complexity`;
      }

      return await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: queryParams
      });
    } catch (error) {
      console.error(`${logPrefix} Error in problemSolvingFunction:`, error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: `Error providing problem-solving strategies: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }, []);

  // Implementation for screening_function
  const screeningFunction = useCallback(async ({
    concern_area,
    assessment_purpose
  }: {
    concern_area: string;
    assessment_purpose?: string;
  }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[SCREENING-${requestId}]`;

    console.log(`${logPrefix} === SCREENING_FUNCTION CALLED ===`);
    console.log(`${logPrefix} Concern area: ${concern_area}`);
    console.log(`${logPrefix} Assessment purpose: ${assessment_purpose || 'not specified'}`);

    try {
      setFunctionError(null);

      // Query parameters for filtering
      const queryParams: {
        function_mapping: string[];
        scenarios?: string[];
      } = {
        function_mapping: ['screening_function']
      };

      // Build the query based on concern area and assessment purpose
      let queryText = `screening tools assessment questions for ${concern_area.replace('_', ' ')}`;
      if (assessment_purpose) {
        queryText += ` for ${assessment_purpose.replace('_', ' ')}`;
      }

      return await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: queryParams
      });
    } catch (error) {
      console.error(`${logPrefix} Error in screeningFunction:`, error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: `Error providing screening tools: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }, []);

  // Implementation for crisis_response_function
  const crisisResponseFunction = useCallback(async ({
    crisis_type,
    urgency_level
  }: {
    crisis_type: string;
    urgency_level: string;
  }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[CRISIS-RESPONSE-${requestId}]`;

    console.log(`${logPrefix} === CRISIS_RESPONSE_FUNCTION CALLED ===`);
    console.log(`${logPrefix} Crisis type: ${crisis_type}`);
    console.log(`${logPrefix} Urgency level: ${urgency_level}`);

    try {
      setFunctionError(null);

      // CRITICAL: Log this as high priority for monitoring
      console.error(`${logPrefix} ⚠️ CRITICAL: Crisis response activated for ${crisis_type} at ${urgency_level} urgency level`);

      // Query parameters for filtering - always high urgency
      const queryParams: {
        function_mapping: string[];
        urgency_level: string;
        scenarios: string[];
      } = {
        function_mapping: ['crisis_response_function'],
        urgency_level: 'high',
        scenarios: ['safety_concern']
      };

      // Add additional scenario based on crisis type
      if (crisis_type === 'suicide' || crisis_type === 'self_harm') {
        queryParams.scenarios.push('distress');
      }

      // Build the query based on crisis type and urgency
      const queryText = `crisis response protocol for ${crisis_type.replace('_', ' ')} with ${urgency_level} urgency`;

      return await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: queryParams
      });
    } catch (error) {
      console.error(`${logPrefix} Error in crisisResponseFunction:`, error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      // Critical: Even if there's an error, provide a fallback crisis message
      return {
        success: true, // Mark as successful so the AI can respond
        message: "I'm concerned about your safety. It's important that you talk to someone who can help immediately. Please call the 988 Suicide and Crisis Lifeline at 988, text HOME to 741741 to reach the Crisis Text Line, or go to your nearest emergency room. Would you like me to provide more resources or help you think through your next steps to stay safe right now?",
        error_occurred: true // Include this so the AI knows there was an error but still has information to respond with
      };
    }
  }, []);

  // Implementation for getUserHistory_function
  const getUserHistoryFunction = useCallback(({
    history_type
  }: {
    history_type: string;
  }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[USER-HISTORY-${requestId}]`;

    console.log(`${logPrefix} === GET_USER_HISTORY_FUNCTION CALLED ===`);
    console.log(`${logPrefix} History type: ${history_type}`);

    try {
      setFunctionError(null);

      // Return different data based on history type
      switch (history_type) {
        case 'function_effectiveness':
          // Return data about which functions were most effective
          return {
            success: true,
            history_type,
            data: userHistoryRef.current.functionEffectiveness,
            message: `Retrieved function effectiveness history. Most effective functions: ${Object.entries(userHistoryRef.current.functionEffectiveness)
              .sort(([, a], [, b]) => b.effectiveness - a.effectiveness)
              .slice(0, 3)
              .map(([name]) => name)
              .join(', ') || 'No data yet'
              }`
          };

        case 'communication_preferences':
          // Return user's communication preferences
          return {
            success: true,
            history_type,
            data: userHistoryRef.current.communicationPreferences,
            message: `Retrieved communication preferences: ${Object.entries(userHistoryRef.current.communicationPreferences)
              .filter(([, value]) => value)
              .map(([key]) => key)
              .join(', ') || 'No preferences set'
              }`
          };

        case 'skill_progress':
          // Return data about skills the user has used
          return {
            success: true,
            history_type,
            data: userHistoryRef.current.skills,
            message: `Retrieved skill progress. Most used skills: ${Object.entries(userHistoryRef.current.skills)
              .sort(([, a], [, b]) => b.used - a.used)
              .slice(0, 3)
              .map(([name]) => name)
              .join(', ') || 'No skills recorded yet'
              }`
          };

        case 'recent_interactions':
          // Return recent interaction approaches
          const recentInteractions = userHistoryRef.current.recentInteractions
            .slice(-5)
            .map(i => `${i.approach} (${i.effectiveness})`)
            .join(', ');

          return {
            success: true,
            history_type,
            data: userHistoryRef.current.recentInteractions.slice(-5),
            message: `Recent interaction approaches: ${recentInteractions || 'No recent interactions recorded'}`
          };

        default:
          return {
            success: true,
            history_type,
            message: 'No specific history data available for this type.'
          };
      }
    } catch (error) {
      console.error(`${logPrefix} Error in getUserHistoryFunction:`, error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: `Error retrieving user history: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }, []);

  // Implementation for logInteractionOutcome_function
  const logInteractionOutcomeFunction = useCallback(({
    approach_used,
    effectiveness_rating,
    user_engagement
  }: {
    approach_used: string;
    effectiveness_rating: string;
    user_engagement?: string;
  }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[LOG-INTERACTION-${requestId}]`;

    console.log(`${logPrefix} === LOG_INTERACTION_OUTCOME_FUNCTION CALLED ===`);
    console.log(`${logPrefix} Approach used: ${approach_used}`);
    console.log(`${logPrefix} Effectiveness rating: ${effectiveness_rating}`);
    console.log(`${logPrefix} User engagement: ${user_engagement || 'not specified'}`);

    try {
      setFunctionError(null);

      // Log the interaction outcome
      const interaction = {
        timestamp: Date.now(),
        approach: approach_used,
        effectiveness: effectiveness_rating,
        engagement: user_engagement || 'not specified'
      };

      // Add to recent interactions
      userHistoryRef.current.recentInteractions.push(interaction);
      if (userHistoryRef.current.recentInteractions.length > 20) {
        // Keep only the most recent 20 interactions
        userHistoryRef.current.recentInteractions.shift();
      }

      // Update function effectiveness stats
      const functionName = approach_used.startsWith('called_')
        ? approach_used.substring(7) // Remove 'called_' prefix
        : approach_used;

      if (!userHistoryRef.current.functionEffectiveness[functionName]) {
        userHistoryRef.current.functionEffectiveness[functionName] = {
          count: 0,
          effectiveness: 0
        };
      }

      userHistoryRef.current.functionEffectiveness[functionName].count += 1;

      // Update effectiveness score (0-100 scale)
      const effectivenessScore =
        effectiveness_rating === 'high' ? 100 :
          effectiveness_rating === 'medium' ? 70 :
            effectiveness_rating === 'low' ? 30 : 50;

      const currentStats = userHistoryRef.current.functionEffectiveness[functionName];
      const newEffectiveness =
        (currentStats.effectiveness * (currentStats.count - 1) + effectivenessScore) /
        currentStats.count;

      userHistoryRef.current.functionEffectiveness[functionName].effectiveness = newEffectiveness;

      return {
        success: true,
        message: `Interaction outcome logged successfully.`,
        result: 'recorded'
      };
    } catch (error) {
      console.error(`${logPrefix} Error in logInteractionOutcomeFunction:`, error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: `Error logging interaction outcome: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }, []);

  // Implementation for cultural_humility_function
  const culturalHumilityFunction = useCallback(async ({
    identity_area,
    resource_type
  }: {
    identity_area: string;
    resource_type?: string;
  }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[CULTURAL-HUMILITY-${requestId}]`;

    console.log(`${logPrefix} === CULTURAL_HUMILITY_FUNCTION CALLED ===`);
    console.log(`${logPrefix} Identity area: ${identity_area}`);
    console.log(`${logPrefix} Resource type: ${resource_type || 'not specified'}`);

    try {
      setFunctionError(null);

      // Query parameters for filtering
      const queryParams: {
        principles: string[];
        function_mapping: string[];
        scenarios?: string[];
      } = {
        principles: ['cultural_humility'],
        function_mapping: ['cultural_humility_function']
      };

      // Build the query based on identity area and resource type
      let queryText = `culturally responsive approaches for ${identity_area.replace('_', ' ')} identity`;
      if (resource_type) {
        queryText += ` with ${resource_type.replace('_', ' ')} resources`;
      }

      return await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: queryParams
      });
    } catch (error) {
      console.error(`${logPrefix} Error in culturalHumilityFunction:`, error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: `Error providing culturally responsive resources: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }, []);

  // Implementation for psychoeducation_function
  const psychoeducationFunction = useCallback(async ({
    topic,
    information_type
  }: {
    topic: string;
    information_type?: string;
  }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[PSYCHOEDUCATION-${requestId}]`;

    console.log(`${logPrefix} === PSYCHOEDUCATION_FUNCTION CALLED ===`);
    console.log(`${logPrefix} Topic: ${topic}`);
    console.log(`${logPrefix} Information type: ${information_type || 'not specified'}`);

    try {
      setFunctionError(null);

      // Query parameters for filtering
      const queryParams: {
        function_mapping: string[];
        scenarios?: string[];
      } = {
        function_mapping: ['psychoeducation_function']
      };

      // Build the query based on topic and information type
      let queryText = `psychoeducation about ${topic.replace('_', ' ')}`;
      if (information_type) {
        queryText += ` with focus on ${information_type.replace('_', ' ')}`;
      }

      return await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: queryParams
      });
    } catch (error) {
      console.error(`${logPrefix} Error in psychoeducationFunction:`, error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: `Error providing psychoeducational content: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }, []);

  // Implementation for validation_function
  const validationFunction = useCallback(async ({
    emotion,
    validation_type
  }: {
    emotion: string;
    validation_type?: string;
  }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[VALIDATION-${requestId}]`;

    console.log(`${logPrefix} === VALIDATION_FUNCTION CALLED ===`);
    console.log(`${logPrefix} Emotion: ${emotion}`);
    console.log(`${logPrefix} Validation type: ${validation_type || 'not specified'}`);

    try {
      setFunctionError(null);

      // Query parameters for filtering
      const queryParams: {
        techniques: string[];
        function_mapping: string[];
        scenarios?: string[];
      } = {
        techniques: ['validation'],
        function_mapping: ['validation_function']
      };

      // Build the query based on emotion and validation type
      let queryText = `validation techniques for ${emotion.replace('_', ' ')} emotions`;
      if (validation_type) {
        queryText += ` using ${validation_type.replace('_', ' ')} approach`;
      }

      return await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: queryParams
      });
    } catch (error) {
      console.error(`${logPrefix} Error in validationFunction:`, error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: `Error providing validation techniques: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }, []);

  // Implementation for queryBookContent (reused by other functions)
  const queryBookContent = useCallback(async ({
    query,
    namespace,
    filter_metadata,
    book
  }: {
    query: string,
    namespace: string,
    filter_metadata?: Record<string, unknown>,
    book?: string // Allow book to be passed explicitly
  }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[MH-BOOK-CONTENT-${requestId}]`;

    console.log(`${logPrefix} Starting query_book_content function call`);
    console.log(`${logPrefix} Query: "${query}"`);
    console.log(`${logPrefix} Namespace: ${namespace || 'trauma_informed_youth_mental_health_companion_v250420'}`);
    console.log(`${logPrefix} Filter metadata:`, filter_metadata ? JSON.stringify(filter_metadata) : 'none');
    console.log(`${logPrefix} Interface type signature: ${JSON.stringify({
      query: typeof query,
      namespace: typeof namespace,
      filter_metadata: typeof filter_metadata,
      book: typeof book
    })}`);
    console.log(`${logPrefix} Book parameter received: "${book || 'not provided'}"`);

    try {
      setFunctionError(null);

      // Get the current user ID
      const userId = localStorage.getItem('userId');

      console.log(`${logPrefix} User ID: ${userId || 'not found'}`);

      if (!userId) {
        console.error(`${logPrefix} No user ID available in localStorage`);
        throw new Error('No user ID available');
      }

      // Ensure namespace is set to mental health namespace
      const finalNamespace = namespace || 'trauma_informed_youth_mental_health_companion_v250420';

      console.log(`${logPrefix} Making API call to /api/v11/book-content with query: ${query.substring(0, 50) + (query.length > 50 ? '...' : '')}`);

      // Get the book ID for mental health companion - use provided book parameter if available
      const explicitBookId = book; // Use the book ID passed explicitly to the function if available
      const selectedBookId = localStorage.getItem('selectedBookId');
      console.log(`${logPrefix} Raw selectedBookId from localStorage:`, selectedBookId);
      console.log(`${logPrefix} Explicit book parameter received:`, explicitBookId);

      // Use a fallback chain: explicit parameter → localStorage → default fallback
      const bookId = explicitBookId || selectedBookId || 'trauma_informed_youth_mental_health_companion';
      console.log(`${logPrefix} Final book ID being used: ${bookId}`);

      // Debug: Log entire request payload
      console.log(`${logPrefix} Full API request payload:`, JSON.stringify({
        userId,
        book: bookId,
        query,
        namespace: finalNamespace,
        filter_metadata
      }, null, 2));

      const startTime = performance.now();
      const response = await fetch('/api/v11/book-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          book: bookId, // Include the book ID in the request
          query,
          namespace: finalNamespace,
          filter_metadata
        })
      });
      const endTime = performance.now();

      console.log(`${logPrefix} API call completed in ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`${logPrefix} Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${logPrefix} API error response (${response.status}):`, errorText);
        console.error(`${logPrefix} API REQUEST THAT FAILED:`, JSON.stringify({
          userId,
          book: bookId,
          query,
          namespace: finalNamespace,
          filter_metadata
        }, null, 2));
        throw new Error(`API error (${response.status}): ${errorText}`);
      }

      console.log(`${logPrefix} Parsing JSON response`);
      let data;
      try {
        data = await response.json();
        console.log(`${logPrefix} Successfully parsed JSON response`);
      } catch (parseError) {
        console.error(`${logPrefix} Failed to parse JSON response:`, parseError);
        throw new Error(`Failed to parse API response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      // Log the response data in much more detail
      console.log(`${logPrefix} Response data summary:`, {
        success: data.success,
        contentLength: data.content ? data.content.length : 0,
        matches: data.matches || 0,
        hasBookTitle: !!data.bookTitle,
        hasBookAuthor: !!data.bookAuthor,
        hasNamespace: !!data.namespace,
        contentType: data.content ? typeof data.content : 'undefined',
        isContentEmpty: data.content === '',
        isContentNull: data.content === null,
        isContentUndefined: data.content === undefined
      });

      // If content is present but empty, log the first part
      if (data.content === '') {
        console.warn(`${logPrefix} Content is an empty string`);
      } else if (data.content) {
        console.log(`${logPrefix} Content preview:`, data.content.substring(0, 100) + (data.content.length > 100 ? '...' : ''));
      }

      // If we have matches but no content, this is very suspicious
      if (data.matches > 0 && !data.content) {
        console.error(`${logPrefix} CRITICAL ERROR: Received ${data.matches} matches but content is ${data.content === '' ? 'empty string' : 'null/undefined'}`);
        console.error(`${logPrefix} Full response data:`, JSON.stringify(data, null, 2));
      }

      // Store the result for debugging
      setLastFunctionResult(data);

      if (!data.content) {
        console.error(`${logPrefix} No content found in response - API returned content=${JSON.stringify(data.content)}`);
        throw new Error('No content found for query');
      }

      const result = {
        success: true,
        content: data.content,
        matches: data.matches || 0,
        message: data.content
      };

      console.log(`${logPrefix} Returning successful result with ${result.content.length} characters of content`);
      return result;
    } catch (error) {
      console.error(`${logPrefix} Error in queryBookContent:`, {
        error,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined
      });

      setFunctionError(error instanceof Error ? error.message : String(error));

      const errorResult = {
        success: false,
        error: true,
        message: `Error querying mental health content: ${error instanceof Error ? error.message : String(error)}`
      };

      console.log(`${logPrefix} Returning error result:`, errorResult);
      return errorResult;
    }
  }, []);

  // Implementation for endSession
  const endSession = useCallback(() => {
    try {
      setFunctionError(null);

      // Dispatch an event that will be caught by the main component to end the session
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('ai_end_session');
        window.dispatchEvent(event);
      }

      return {
        success: true,
        message: "Session ended successfully."
      };
    } catch (error) {
      console.error('Error in endSession:', error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: `Error ending session: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }, []);

  // Implementation for reportTechnicalError
  const reportTechnicalError = useCallback(({ error_type, function_name, error_message }: {
    error_type: string,
    function_name: string,
    error_message?: string
  }) => {
    try {
      setFunctionError(null);

      // Log the error for debugging
      console.error(`Technical error reported by AI: ${error_type} in ${function_name}`, error_message);

      // Create a detailed error message
      const formattedErrorMessage = `I encountered a technical error while trying to ${function_name === 'crisis_response_function' ? 'access crisis resources' :
        function_name === 'grounding_function' ? 'retrieve grounding techniques' :
          function_name === 'thought_exploration_function' ? 'explore thought patterns' :
            function_name === 'problem_solving_function' ? 'work on problem-solving' :
              function_name === 'resource_search_function' ? 'search for resources' :
                'process your request'
        }. ${error_message || ''}`;

      return {
        success: true,
        error_type,
        function_name,
        error_message: error_message || 'Unknown error',
        message: formattedErrorMessage
      };
    } catch (error) {
      console.error('Error in reportTechnicalError:', error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: `Error reporting technical issue: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }, []);
  
  // Implementation for resource_search_function
  const resourceSearchFunction = useCallback(async ({
    query,
    resource_type,
    location_specific,
    location,
    mapView
  }: {
    query: string;
    resource_type?: string;
    location_specific?: boolean;
    location?: string;
    mapView?: boolean;
  }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[RESOURCE-SEARCH-${requestId}]`;
    
    // Store search ID for feedback collection
    const searchId = `search-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    if (typeof window !== 'undefined') {
      // Create a properly typed window object
      (window as unknown as { __lastResourceSearchId: string }).__lastResourceSearchId = searchId;
    }

    // Log to console only (not displaying to users)
    console.log(`${logPrefix} === RESOURCE_SEARCH_FUNCTION CALLED ===`);
    console.log(`${logPrefix} Search ID: ${searchId}`);
    console.log(`${logPrefix} Query: ${query}`);
    console.log(`${logPrefix} Resource type: ${resource_type || 'not specified'}`);
    console.log(`${logPrefix} Location specific: ${location_specific ? 'yes' : 'no'}`);
    console.log(`${logPrefix} Location: ${location || 'not specified'}`);
    console.log(`${logPrefix} Map view: ${mapView ? 'yes' : 'no'}`)
    
    try {
      setFunctionError(null);

      // If no location specified but location_specific is true, we need to ask user for location
      // This creates an opportunity for the AI to ask for location naturally in conversation
      if (location_specific === true && !location) {
        return {
          success: true,
          needsLocation: true,
          message: "To provide more relevant resources, I'll need to know your location. Could you tell me what city or region you're in? This helps me find resources available in your area."
        };
      }

      // Prepare request data for API
      const userId = localStorage.getItem('userId');
      const requestData = {
        query,
        resource_type,
        location_specific,
        location,
        userId: userId || undefined,
        searchId, // Include search ID for feedback correlation
        mapView // Include map view flag for enhanced location data processing
      };

      console.log(`${logPrefix} Sending resource search request to API:`, requestData);
      
      // Call the resource search API
      const response = await fetch('/api/v11/resource-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      // Check for HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API returned error ${response.status}: ${errorText}`);
      }

      // Parse the response
      const data = await response.json();
      console.log(`${logPrefix} Received resource search response:`, {
        success: data.success,
        resultCount: data.results.result_count,
        summary: data.results.summary.substring(0, 50) + '...',
        hasLocations: data.results.resources.some((r: Resource) => r.location),
        hasCoordinates: data.results.resources.some((r: Resource) => r.coordinates)
      });

      // Store the result for debugging
      setLastFunctionResult({
        success: true,
        data
      });

      // Store search data for feedback collection
      if (typeof window !== 'undefined') {
        const searchData: SearchHistoryEntry = {
          id: searchId,
          timestamp: Date.now(),
          query,
          resource_type,
          location,
          results: data.results // Store the full results object, not just simplified version
        };
        
        // Create or update search history array in session storage
        const existingSearches = JSON.parse(sessionStorage.getItem('resource_searches') || '[]');
        existingSearches.push(searchData);
        sessionStorage.setItem('resource_searches', JSON.stringify(existingSearches));
      }

      // Check if there are resources with locations for automatic mapping
      const hasResourcesWithLocations = data.results.resources.some((r: Resource) => r.location);
      
      // Automatically trigger map display if resources have locations
      let mapMessage = '';
      let autoMapTriggered = false;
      if (hasResourcesWithLocations) {
        console.log(`${logPrefix} Resources found with locations - automatically triggering map display`);
        
        // Automatically dispatch the map display event
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('display_resource_map', { 
            detail: { searchId }
          });
          window.dispatchEvent(event);
          autoMapTriggered = true;
          console.log(`${logPrefix} Map display event automatically dispatched for searchId: ${searchId}`);
        }
        
        mapMessage = "\n\nI've automatically displayed these resources on a map so you can see their locations. You can click on any marker to see more details about that resource.";
      }

      // Use formatted response from API if available, otherwise build one
      const displayMessage = data.results.formatted_response || 
        `${data.results.summary}\n\n${data.results.resources.map((resource: Resource) => {
          return `**${resource.name}** (${resource.resource_type})\n${resource.description}\n${resource.contact ? '**Contact:** ' + resource.contact : ''}\n${resource.website ? `**Website:** [${resource.website}](${resource.website})` : ''}${resource.location ? `\n**Location:** ${resource.location}` : ''}`;
        }).join('\n\n')}`;

      // Add a feedback prompt for the AI to use later
      const feedbackMessage = "\n\nWere these resources helpful for you? I can try to find different resources if needed, or we can discuss a specific resource in more detail.";

      return {
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
        message: displayMessage + mapMessage + feedbackMessage
      };
    } catch (error) {
      console.error(`${logPrefix} Error in resourceSearchFunction:`, error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: `Error searching for mental health resources: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }, []);
  
  // Implementation for resource_feedback_function to collect user feedback about resources
  const resourceFeedbackFunction = useCallback(async ({
    searchId,
    helpful,
    resource_name,
    comment
  }: {
    searchId: string;
    helpful: boolean;
    resource_name?: string;
    comment?: string;
  }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[RESOURCE-FEEDBACK-${requestId}]`;

    console.log(`${logPrefix} === RESOURCE_FEEDBACK_FUNCTION CALLED ===`);
    console.log(`${logPrefix} Search ID: ${searchId}`);
    console.log(`${logPrefix} Helpful: ${helpful}`);
    console.log(`${logPrefix} Resource: ${resource_name || 'not specified'}`);
    console.log(`${logPrefix} Comment: ${comment || 'not provided'}`);

    try {
      setFunctionError(null);
      const userId = localStorage.getItem('userId');
      
      // Get associated search data from session storage
      const existingSearches = JSON.parse(sessionStorage.getItem('resource_searches') || '[]');
      const searchData = existingSearches.find((s: SearchHistoryEntry) => s.id === searchId);
      
      if (!searchData) {
        console.warn(`${logPrefix} No search data found for ID: ${searchId}`);
      }

      // Prepare feedback data
      const feedbackData = {
        search_log_id: searchId,
        resource_name: resource_name || 'general feedback',
        helpful,
        comment: comment || '',
        user_id: userId || null,
        timestamp: new Date().toISOString()
      };

      // Store feedback in Supabase
      if (userId) {
        try {
          const { data, error } = await supabase
            .from('resource_feedback')
            .insert([feedbackData])
            .select();
            
          if (error) {
            console.error(`${logPrefix} ⚠️ Failed to log feedback: ${error.message}`);
          } else {
            console.log(`${logPrefix} ✅ Feedback logged with ID: ${data?.[0]?.id || 'unknown'}`);
          }
        } catch (logError) {
          console.error(`${logPrefix} ⚠️ Exception logging feedback: ${(logError as Error).message}`);
        }
      } else {
        // For anonymous users, just log to console
        console.log(`${logPrefix} Anonymous user feedback:`, feedbackData);
      }

      return {
        success: true,
        message: helpful 
          ? "I'm glad these resources were helpful. Is there anything specific about these resources you'd like to discuss further?"
          : "I understand these resources weren't what you needed. Let me try to find different options that might be more helpful."
      };
    } catch (error) {
      console.error(`${logPrefix} Error in resourceFeedbackFunction:`, error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: "Thank you for your feedback. I'll make note of this to help improve future resource recommendations."
      };
    }
  }, []);

  // Implementation for displaying map with resources
  const displayMapFunction = useCallback(({
    searchId
  }: {
    searchId: string;
  }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[DISPLAY-MAP-${requestId}]`;

    console.log(`${logPrefix} === DISPLAY_MAP_FUNCTION CALLED ===`);
    console.log(`${logPrefix} Search ID: ${searchId}`);

    try {
      setFunctionError(null);
      
      // Create a properly typed window object
      if (typeof window !== 'undefined') {
        // Get the search data from session storage
        const existingSearches = JSON.parse(sessionStorage.getItem('resource_searches') || '[]');
        const searchData = existingSearches.find((s: SearchHistoryEntry) => s.id === searchId);
        
        if (!searchData) {
          console.warn(`${logPrefix} No search data found for ID: ${searchId}`);
          return {
            success: false,
            error: true,
            message: "I couldn't find the search data to display on the map. Let's try a new search."
          };
        }
        
        // Dispatch an event that will be caught by the main component to display the map
        const event = new CustomEvent('display_resource_map', { 
          detail: { searchId }
        });
        window.dispatchEvent(event);
        
        return {
          success: true,
          message: "I'm displaying the resources on a map now. You can click on any marker to see more details about that resource."
        };
      } else {
        return {
          success: false,
          error: true,
          message: "I couldn't display the map in this environment."
        };
      }
    } catch (error) {
      console.error(`${logPrefix} Error in displayMapFunction:`, error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: "I encountered an issue while trying to display the resources on a map."
      };
    }
  }, []);

  // FUTURES PATHWAYS FUNCTIONS - Career and Educational Guidance

  // Implementation for pathway_exploration_function
  const pathwayExplorationFunction = useCallback(async ({
    interests,
    skills,
    education_level,
    immediate_needs
  }: {
    interests: string[];
    skills?: string[];
    education_level: string;
    immediate_needs?: string;
  }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[FUTURES-PATHWAYS][PATHWAY-EXPLORATION-${requestId}]`;

    console.log(`${logPrefix} === PATHWAY_EXPLORATION_FUNCTION CALLED ===`);
    console.log(`${logPrefix} Interests: ${interests.join(', ')}`);
    console.log(`${logPrefix} Skills: ${skills?.join(', ') || 'not specified'}`);
    console.log(`${logPrefix} Education level: ${education_level}`);
    console.log(`${logPrefix} Immediate needs: ${immediate_needs || 'not specified'}`);

    try {
      setFunctionError(null);

      const queryParams = {
        feature: ['futures_pathways_skill_builder'],
        section_type: ['pathway_exploration'],
        target_population: ['at_risk_youth'],
        trauma_informed_principles: ['empowerment', 'trustworthiness']
      };

      let queryText = `career exploration pathway suggestions for interests ${interests.join(' ')} education level ${education_level}`;
      
      if (skills && skills.length > 0) {
        queryText += ` with skills ${skills.join(' ')}`;
      }
      
      if (immediate_needs) {
        queryText += ` considering immediate needs ${immediate_needs}`;
      }

      const bookId = localStorage.getItem('selectedBookId') || 'trauma_informed_youth_mental_health_companion';

      return await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: queryParams,
        book: bookId
      });
    } catch (error) {
      console.error(`${logPrefix} Error in pathwayExplorationFunction:`, error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: `Error providing pathway exploration: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }, [queryBookContent]);

  // Implementation for educational_guidance_function
  const educationalGuidanceFunction = useCallback(async ({
    pathway_type,
    financial_situation,
    timeline
  }: {
    pathway_type: string;
    financial_situation?: string;
    timeline?: string;
  }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[FUTURES-PATHWAYS][EDUCATIONAL-GUIDANCE-${requestId}]`;

    console.log(`${logPrefix} === EDUCATIONAL_GUIDANCE_FUNCTION CALLED ===`);
    console.log(`${logPrefix} Pathway type: ${pathway_type}`);
    console.log(`${logPrefix} Financial situation: ${financial_situation || 'not specified'}`);
    console.log(`${logPrefix} Timeline: ${timeline || 'not specified'}`);

    try {
      setFunctionError(null);

      const queryParams = {
        feature: ['futures_pathways_skill_builder'],
        section_type: ['educational_guidance'],
        target_population: ['at_risk_youth']
      };

      let queryText = `educational guidance for ${pathway_type.replace('_', ' ')}`;
      
      if (financial_situation) {
        queryText += ` financial aid scholarships support programs`;
      }
      
      if (timeline) {
        queryText += ` starting ${timeline}`;
      }

      const bookId = localStorage.getItem('selectedBookId') || 'trauma_informed_youth_mental_health_companion';

      return await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: queryParams,
        book: bookId
      });
    } catch (error) {
      console.error(`${logPrefix} Error in educationalGuidanceFunction:`, error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: `Error providing educational guidance: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }, [queryBookContent]);

  // Implementation for skill_building_function
  const skillBuildingFunction = useCallback(async ({
    skill_area,
    current_level,
    immediate_application
  }: {
    skill_area: string;
    current_level?: string;
    immediate_application?: string;
  }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[FUTURES-PATHWAYS][SKILL-BUILDING-${requestId}]`;

    console.log(`${logPrefix} === SKILL_BUILDING_FUNCTION CALLED ===`);
    console.log(`${logPrefix} Skill area: ${skill_area}`);
    console.log(`${logPrefix} Current level: ${current_level || 'not specified'}`);
    console.log(`${logPrefix} Immediate application: ${immediate_application || 'not specified'}`);

    try {
      setFunctionError(null);

      const queryParams = {
        feature: ['futures_pathways_skill_builder'],
        section_type: ['skill_building', 'job_readiness'],
        target_population: ['at_risk_youth']
      };

      let queryText = `life skills job readiness ${skill_area.replace('_', ' ')} training`;
      
      if (current_level) {
        queryText += ` ${current_level} level`;
      }
      
      if (immediate_application) {
        queryText += ` for ${immediate_application}`;
      }

      const bookId = localStorage.getItem('selectedBookId') || 'trauma_informed_youth_mental_health_companion';

      return await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: queryParams,
        book: bookId
      });
    } catch (error) {
      console.error(`${logPrefix} Error in skillBuildingFunction:`, error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: `Error providing skill building guidance: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }, [queryBookContent]);

  // Implementation for goal_planning_function
  const goalPlanningFunction = useCallback(async ({
    goal_description,
    goal_type,
    timeline,
    current_barriers
  }: {
    goal_description: string;
    goal_type: string;
    timeline?: string;
    current_barriers?: string[];
  }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[FUTURES-PATHWAYS][GOAL-PLANNING-${requestId}]`;

    console.log(`${logPrefix} === GOAL_PLANNING_FUNCTION CALLED ===`);
    console.log(`${logPrefix} Goal: ${goal_description}`);
    console.log(`${logPrefix} Goal type: ${goal_type}`);
    console.log(`${logPrefix} Timeline: ${timeline || 'not specified'}`);
    console.log(`${logPrefix} Barriers: ${current_barriers?.join(', ') || 'not specified'}`);

    try {
      setFunctionError(null);

      const queryParams = {
        feature: ['futures_pathways_skill_builder'],
        section_type: ['goal_setting', 'action_planning'],
        target_population: ['at_risk_youth'],
        trauma_informed_principles: ['empowerment']
      };

      let queryText = `goal setting action planning for ${goal_type.replace('_', ' ')} ${goal_description}`;
      
      if (timeline) {
        queryText += ` timeline ${timeline}`;
      }
      
      if (current_barriers && current_barriers.length > 0) {
        queryText += ` overcoming barriers ${current_barriers.join(' ')}`;
      }

      const bookId = localStorage.getItem('selectedBookId') || 'trauma_informed_youth_mental_health_companion';

      return await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: queryParams,
        book: bookId
      });
    } catch (error) {
      console.error(`${logPrefix} Error in goalPlanningFunction:`, error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: `Error providing goal planning guidance: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }, [queryBookContent]);

  // Implementation for resource_connection_function
  const resourceConnectionFunction = useCallback(async ({
    connection_type,
    field_of_interest,
    comfort_level
  }: {
    connection_type: string;
    field_of_interest: string;
    comfort_level?: string;
  }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[FUTURES-PATHWAYS][RESOURCE-CONNECTION-${requestId}]`;

    console.log(`${logPrefix} === RESOURCE_CONNECTION_FUNCTION CALLED ===`);
    console.log(`${logPrefix} Connection type: ${connection_type}`);
    console.log(`${logPrefix} Field of interest: ${field_of_interest}`);
    console.log(`${logPrefix} Comfort level: ${comfort_level || 'not specified'}`);

    try {
      setFunctionError(null);

      const queryParams = {
        feature: ['futures_pathways_skill_builder'],
        section_type: ['networking', 'experience_building'],
        target_population: ['at_risk_youth']
      };

      let queryText = `networking ${connection_type.replace('_', ' ')} experience building in ${field_of_interest}`;
      
      if (comfort_level) {
        queryText += ` for ${comfort_level.replace('_', ' ')} individuals`;
      }

      const bookId = localStorage.getItem('selectedBookId') || 'trauma_informed_youth_mental_health_companion';

      return await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: queryParams,
        book: bookId
      });
    } catch (error) {
      console.error(`${logPrefix} Error in resourceConnectionFunction:`, error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: `Error providing resource connection guidance: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }, [queryBookContent]);

  // Implementation for futures_assessment_function
  const futuresAssessmentFunction = useCallback(async ({
    assessment_area,
    user_comfort_level
  }: {
    assessment_area: string;
    user_comfort_level?: string;
  }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[FUTURES-PATHWAYS][FUTURES-ASSESSMENT-${requestId}]`;

    console.log(`${logPrefix} === FUTURES_ASSESSMENT_FUNCTION CALLED ===`);
    console.log(`${logPrefix} Assessment area: ${assessment_area}`);
    console.log(`${logPrefix} User comfort level: ${user_comfort_level || 'not specified'}`);

    try {
      setFunctionError(null);

      const queryParams = {
        feature: ['futures_pathways_skill_builder'],
        section_type: ['assessment', 'onboarding'],
        target_population: ['at_risk_youth'],
        trauma_informed_principles: ['trustworthiness', 'empowerment']
      };

      let queryText = `futures pathways assessment ${assessment_area.replace('_', ' ')} trauma informed questioning`;
      
      if (user_comfort_level) {
        queryText += ` ${user_comfort_level.replace('_', ' ')} approach`;
      }

      const bookId = localStorage.getItem('selectedBookId') || 'trauma_informed_youth_mental_health_companion';

      return await queryBookContent({
        query: queryText,
        namespace: 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: queryParams,
        book: bookId
      });
    } catch (error) {
      console.error(`${logPrefix} Error in futuresAssessmentFunction:`, error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: `Error providing futures assessment: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }, [queryBookContent]);

  // Type for WebRTC function registration
  type MentalHealthFunction = 
    | ((params: { distress_level: string; technique_type?: string }) => Promise<unknown>)
    | ((params: { thought_type: string; related_emotion?: string }) => Promise<unknown>)
    | ((params: { problem_category: string; complexity?: string }) => Promise<unknown>)
    | ((params: { concern_area: string; assessment_purpose?: string }) => Promise<unknown>)
    | ((params: { crisis_type: string; urgency_level: string }) => Promise<unknown>)
    | ((params: { history_type: string }) => unknown)
    | ((params: { approach_used: string; effectiveness_rating: string; user_engagement?: string }) => unknown)
    | ((params: { identity_area: string; resource_type?: string }) => Promise<unknown>)
    | ((params: { topic: string; information_type?: string }) => Promise<unknown>)
    | ((params: { emotion: string; validation_type?: string }) => Promise<unknown>)
    | ((params: { query: string; namespace: string; filter_metadata?: Record<string, unknown>; book?: string }) => Promise<unknown>)
    | ((params: { query: string; resource_type?: string; location_specific?: boolean; location?: string; mapView?: boolean }) => Promise<unknown>)
    | ((params: { searchId: string; helpful: boolean; resource_name?: string; comment?: string }) => Promise<unknown>)
    | ((params: { searchId: string }) => unknown)
    | (() => unknown)
    | ((params: { error_type: string; function_name: string; error_message?: string }) => unknown)
    // Futures Pathways functions
    | ((params: { interests: string[]; skills?: string[]; education_level: string; immediate_needs?: string }) => Promise<unknown>)
    | ((params: { pathway_type: string; financial_situation?: string; timeline?: string }) => Promise<unknown>)
    | ((params: { skill_area: string; current_level?: string; immediate_application?: string }) => Promise<unknown>)
    | ((params: { goal_description: string; goal_type: string; timeline?: string; current_barriers?: string[] }) => Promise<unknown>)
    | ((params: { connection_type: string; field_of_interest: string; comfort_level?: string }) => Promise<unknown>)
    | ((params: { assessment_area: string; user_comfort_level?: string }) => Promise<unknown>);

  // Register all functions with the WebRTC hook
  const registerMentalHealthFunctions = useCallback((registerFunction: (name: string, fn: MentalHealthFunction) => void) => {
    // Mental Health Functions
    registerFunction('grounding_function', groundingFunction);
    registerFunction('thought_exploration_function', thoughtExplorationFunction);
    registerFunction('problem_solving_function', problemSolvingFunction);
    registerFunction('screening_function', screeningFunction);
    registerFunction('crisis_response_function', crisisResponseFunction);
    registerFunction('getUserHistory_function', getUserHistoryFunction);
    registerFunction('logInteractionOutcome_function', logInteractionOutcomeFunction);
    registerFunction('cultural_humility_function', culturalHumilityFunction);
    registerFunction('psychoeducation_function', psychoeducationFunction);
    registerFunction('validation_function', validationFunction);
    registerFunction('resource_search_function', resourceSearchFunction);
    registerFunction('resource_feedback_function', resourceFeedbackFunction);
    registerFunction('display_map_function', displayMapFunction);
    registerFunction('query_book_content', queryBookContent);
    registerFunction('end_session', endSession);
    registerFunction('report_technical_error', reportTechnicalError);
    
    // Futures Pathways Functions
    registerFunction('pathway_exploration_function', pathwayExplorationFunction);
    registerFunction('educational_guidance_function', educationalGuidanceFunction);
    registerFunction('skill_building_function', skillBuildingFunction);
    registerFunction('goal_planning_function', goalPlanningFunction);
    registerFunction('resource_connection_function', resourceConnectionFunction);
    registerFunction('futures_assessment_function', futuresAssessmentFunction);

    console.log("All mental health and futures pathways functions registered");
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
    pathwayExplorationFunction,
    educationalGuidanceFunction,
    skillBuildingFunction,
    goalPlanningFunction,
    resourceConnectionFunction,
    futuresAssessmentFunction
  ]);

  return {
    mentalHealthFunctions,
    registerMentalHealthFunctions,
    lastFunctionResult,
    functionError
  };
}

export default useMentalHealthFunctions;