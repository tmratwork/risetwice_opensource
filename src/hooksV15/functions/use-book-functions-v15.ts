// src/hooksV15/functions/use-book-functions-v15.ts

"use client";

import { useState, useCallback, useRef, useMemo } from 'react';
import { generateBookFunctions } from '@/app/chatbotV11/prompts';
import audioLogger from '../audio/audio-logger';

/**
 * V15 Book Functions Hook
 * Provides book-specific function implementations for V15 WebRTC system
 */

export interface BookFunctionResult {
  success: boolean;
  data?: {
    question?: string;
    content?: string[];
    error?: string;
    message?: string;
    [key: string]: unknown;
  };
  error?: string;
  [key: string]: unknown;
}

export interface GPTFunction {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export function useBookFunctionsV15() {
  const [lastFunctionResult, setLastFunctionResult] = useState<BookFunctionResult | null>(null);
  const [functionError, setFunctionError] = useState<string | null>(null);

  // Get functions from the prompts module - memoized to prevent recreation
  const bookFunctions: GPTFunction[] = useMemo(() => generateBookFunctions(), []);

  // Last time fetch_next_question was called (for debouncing)
  const lastFetchNextQuestionTime = useRef<number>(0);

  // Implementation for reset_completed_quest function
  const resetCompletedQuest = useCallback(async () => {
    const requestId = Date.now().toString().slice(-6);

    audioLogger.info('function', 'reset_completed_quest_called', {
      requestId,
      timestamp: Date.now()
    });
    
    // This function just calls fetchNextQuestion with the resetCompleted flag
    return fetchNextQuestion({ resetCompleted: true });
  }, []);

  // Implementation for fetch_next_question
  const fetchNextQuestion = useCallback(async (params?: { resetCompleted?: boolean }): Promise<BookFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);
    const currentTime = Date.now();
    
    audioLogger.info('function', 'fetch_next_question_called', {
      requestId,
      params,
      timeSinceLastCall: currentTime - lastFetchNextQuestionTime.current
    });

    // Debounce calls to prevent rapid successive API calls
    if (currentTime - lastFetchNextQuestionTime.current < 2000) {
      audioLogger.warn('function', 'fetch_next_question_debounced', {
        requestId,
        timeSinceLastCall: currentTime - lastFetchNextQuestionTime.current
      });
      
      return {
        success: false,
        error: "Please wait a moment before requesting another question."
      };
    }

    lastFetchNextQuestionTime.current = currentTime;

    try {
      const response = await fetch('/api/v11/next-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resetCompleted: params?.resetCompleted || false
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      audioLogger.info('function', 'fetch_next_question_success', {
        requestId,
        hasQuestion: !!result.question,
        questionLength: result.question?.length || 0
      });

      setLastFunctionResult(result);
      setFunctionError(null);
      
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      audioLogger.error('function', 'fetch_next_question_failed', error as Error, {
        requestId,
        errorMessage
      });

      setFunctionError(errorMessage);
      
      return {
        success: false,
        error: `Failed to fetch next question: ${errorMessage}`
      };
    }
  }, []);

  // Implementation for query_book_content
  const queryBookContent = useCallback(async (params: { query: string; context?: string }): Promise<BookFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);
    
    audioLogger.info('function', 'query_book_content_called', {
      requestId,
      query: params.query,
      hasContext: !!params.context
    });

    try {
      const response = await fetch('/api/v11/book-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      audioLogger.info('function', 'query_book_content_success', {
        requestId,
        resultCount: result.content?.length || 0
      });

      setLastFunctionResult(result);
      setFunctionError(null);
      
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      audioLogger.error('function', 'query_book_content_failed', error as Error, {
        requestId,
        errorMessage
      });

      setFunctionError(errorMessage);
      
      return {
        success: false,
        error: `Failed to query book content: ${errorMessage}`
      };
    }
  }, []);

  // Implementation for end_session function
  const endSession = useCallback(async (): Promise<BookFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);
    
    console.log('[END_SESSION_FLOW] 🎯 1. end_session function called');
    console.log('[END_SESSION_FLOW] 📊 Current session state:', {
      timestamp: Date.now(),
      requestId,
      context: 'book_functions'
    });
    
    audioLogger.info('function', 'end_session_called', {
      requestId,
      timestamp: Date.now(),
      context: 'book_functions'
    });

    try {
      // V15: Simple success response for end_session
      const result = {
        success: true,
        data: {
          message: "Session ended successfully. Thank you for using the book companion!"
        }
      };
      
      console.log('[END_SESSION_FLOW] ✅ 2. end_session function returning success');
      console.log('[END_SESSION_FLOW] 📤 Result message:', result.data?.message);
      
      audioLogger.info('function', 'end_session_success', {
        requestId,
        context: 'book_functions'
      });

      setLastFunctionResult(result);
      setFunctionError(null);
      
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      audioLogger.error('function', 'end_session_failed', error as Error, {
        requestId,
        errorMessage,
        context: 'book_functions'
      });

      setFunctionError(errorMessage);
      
      return {
        success: false,
        error: `Failed to end session: ${errorMessage}`
      };
    }
  }, []);

  // Function registry for WebRTC system - memoized to prevent recreation
  const functionRegistry = useMemo(() => ({
    'fetch_next_question': fetchNextQuestion,
    'reset_completed_quest': resetCompletedQuest,
    'query_book_content': queryBookContent,
    'end_session': endSession
  }), [fetchNextQuestion, resetCompletedQuest, queryBookContent, endSession]);

  // Get available functions for session configuration - memoized to prevent recreation
  const getAvailableFunctions = useMemo(() => {
    return bookFunctions;
  }, [bookFunctions]);

  return {
    // Function implementations
    fetchNextQuestion,
    resetCompletedQuest,
    queryBookContent,
    endSession,
    
    // Registry and configuration
    functionRegistry,
    getAvailableFunctions,
    
    // State
    lastFunctionResult,
    functionError,
    
    // Utility
    clearFunctionError: useCallback(() => setFunctionError(null), []),
    clearLastResult: useCallback(() => setLastFunctionResult(null), [])
  };
}