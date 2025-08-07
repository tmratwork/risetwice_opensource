// src/hooksV11/use-book-functions.ts
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

"use client";

import { useState, useCallback, useRef } from 'react';
import { GPTFunction } from './use-webrtc';
import { generateBookFunctions } from '@/app/chatbotV11/prompts';

/**
 * Hook to provide book-specific function implementations for the WebRTC service
 */
export function useBookFunctions() {
  type BookFunctionResult = {
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
  };

  const [lastFunctionResult, setLastFunctionResult] = useState<BookFunctionResult | null>(null);
  const [functionError, setFunctionError] = useState<string | null>(null);

  // Get functions from the prompts module
  const bookFunctions: GPTFunction[] = generateBookFunctions();

  // Last time fetch_next_question was called (for debouncing)
  const lastFetchNextQuestionTime = useRef<number>(0);

  // Implementation for reset_completed_quest function
  const resetCompletedQuest = useCallback(async () => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[RESET-QUEST-${requestId}]`;

    console.log(`${logPrefix} === RESET_COMPLETED_QUEST FUNCTION CALLED ===`);
    console.log(`${logPrefix} AI requested to revisit a completed quest`);
    
    // This function just calls fetchNextQuestion with the resetCompleted flag
    return fetchNextQuestion({ resetCompleted: true });
  }, []);

  // Implementation for fetch_next_question
  const fetchNextQuestion = useCallback(async (params?: { resetCompleted?: boolean }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[NEXT-QUESTION-${requestId}]`;

    console.log(`${logPrefix} === FETCH_NEXT_QUESTION FUNCTION CALLED ===`);
    console.log(`${logPrefix} AI requested next discussion question`);
    
    // CRITICAL: Implement debouncing to prevent double-calls
    const now = Date.now();
    const timeSinceLastCall = now - lastFetchNextQuestionTime.current;
    
    if (timeSinceLastCall < 10000) { // 10 seconds debounce
      console.log(`${logPrefix} ⚠️ PREVENTING DUPLICATE CALL - Last call was ${timeSinceLastCall}ms ago (less than 10s threshold)`);
      return {
        success: true,
        throttled: true,
        message: "Waiting for previous question to be processed. Please respond to the current question.",
        ai_instructions: "This is a debounced/throttled function call. The user has already received a question less than 10 seconds ago. Continue the current conversation without showing this message to the user or changing topics."
      };
    }
    
    // Update the last call time
    lastFetchNextQuestionTime.current = now;

    try {
      setFunctionError(null);

      // Get the current book ID from localStorage (will be set by the main component)
      const bookId = localStorage.getItem('selectedBookId');
      const userId = localStorage.getItem('userId');

      console.log(`${logPrefix} Book ID from localStorage: ${bookId || 'not found'}`);
      console.log(`${logPrefix} User ID from localStorage: ${userId || 'not found'}`);

      if (!bookId) {
        console.error(`${logPrefix} No book ID available in localStorage`);
        throw new Error('No book ID available');
      }

      console.log(`${logPrefix} Sending API request to fetch next question`);
      console.log(`${logPrefix} Request payload:`, JSON.stringify({
        userId,
        book: bookId
      }, null, 2));

      const startTime = performance.now();
      // Extract the resetCompleted flag from params if provided
      const resetCompleted = params?.resetCompleted || false;
      if (resetCompleted) {
        console.log(`${logPrefix} Reset completed quests flag is enabled - will include completed quests`);
      }
      
      const response = await fetch('/api/v11/next-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          book: bookId,
          resetCompleted
        })
      });
      const endTime = performance.now();

      console.log(`${logPrefix} API request completed in ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`${logPrefix} Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${logPrefix} API error response (${response.status}):`, errorText);
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

      console.log(`${logPrefix} Response data:`, JSON.stringify(data, null, 2));

      // Store the result for debugging
      setLastFunctionResult(data);

      // Store questionId in global variable for use in message saving
      if (data.questionId && typeof window !== 'undefined') {
        console.log(`${logPrefix} Storing questionId ${data.questionId} in global variable`);
        // Store with correct snake_case field name for Supabase
        window.__lastQuestionId = data.questionId;
      }

      // CRITICAL FIX: If we received a new conversationId, update localStorage
      if (data.conversationId && typeof window !== 'undefined') {
        console.log(`${logPrefix} Updating conversationId in localStorage to ${data.conversationId}`);
        localStorage.setItem('conversationId', data.conversationId);
      } else {
        console.log(`${logPrefix} No new conversationId received from API`);
      }

      // Handle special case for "all quests completed" scenario
      if (data.allQuestsCompleted) {
        console.log(`${logPrefix} All quests completed for this book. Returning completion message.`);
        
        const result = {
          success: true,
          allQuestsCompleted: true,
          questsCompleted: data.questsCompleted,
          totalQuests: data.totalQuests,
          completedPercentage: data.completedPercentage,
          question: data.question,
          bookTitle: data.bookTitle,
          message: data.message || data.question,
          ai_instructions: "The user has completed all available quests for this book. Present this achievement message VERBATIM without changes. After presenting the message, you can suggest they restart a favorite quest or discuss their favorite parts of the book so far.",
          questionId: data.questionId || 'all-quests-completed',
          conversationId: data.conversationId,
          chapterInfo: data.chapterInfo || 'Quest Completion'
        };
        
        return result;
      }
      
      // Normal case - new quest available
      const result = {
        success: true,
        question: data.question,
        bookTitle: data.bookTitle,
        message: data.question, // The exact question text that must be delivered verbatim
        ai_instructions: "CRITICAL: You MUST present this question VERBATIM without any changes, paraphrasing, or adding your own words before or after. Deliver ONLY the exact message text as provided. AFTER presenting this question, STOP and WAIT for the user to respond before continuing. DO NOT answer the question yourself.", // Explicit instructions for the AI
        questionId: data.questionId, // Pass along the question ID so WebRTC hook can use it for saving
        conversationId: data.conversationId, // Also pass along the conversation ID
        chapterInfo: data.chapterInfo // Pass along chapter information
      };

      console.log(`${logPrefix} Returning successful result:`, JSON.stringify(result, null, 2));
      console.log(`${logPrefix} === FETCH_NEXT_QUESTION FUNCTION COMPLETED SUCCESSFULLY ===`);
      return result;
    } catch (error) {
      console.error(`${logPrefix} Error in fetchNextQuestion:`, {
        error,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined
      });

      setFunctionError(error instanceof Error ? error.message : String(error));

      const errorResult = {
        success: false,
        error: true,
        message: `Error fetching next question: ${error instanceof Error ? error.message : String(error)}`
      };

      console.log(`${logPrefix} Returning error result:`, JSON.stringify(errorResult, null, 2));
      console.log(`${logPrefix} === FETCH_NEXT_QUESTION FUNCTION FAILED ===`);
      return errorResult;
    }
  }, []);

  // Implementation for query_book_content
  const queryBookContent = useCallback(async ({ query, namespace }: { query: string, namespace?: string }) => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[BOOK-CONTENT-${requestId}]`;

    console.log(`${logPrefix} Starting query_book_content function call`);
    console.log(`${logPrefix} Query: "${query}"`);
    console.log(`${logPrefix} Optional namespace: ${namespace || 'not provided'}`);

    try {
      setFunctionError(null);

      // Get the current book ID from localStorage (will be set by the main component)
      const bookId = localStorage.getItem('selectedBookId');
      const userId = localStorage.getItem('userId');

      console.log(`${logPrefix} Book ID from localStorage: ${bookId || 'not found'}`);
      console.log(`${logPrefix} User ID from localStorage: ${userId || 'not found'}`);

      if (!bookId) {
        console.error(`${logPrefix} No book ID available in localStorage`);
        throw new Error('No book ID available');
      }

      if (!query || query.trim() === '') {
        console.error(`${logPrefix} Empty query provided`);
        throw new Error('Query is required');
      }

      console.log(`${logPrefix} Making API call to /api/v11/book-content with POST data:`, {
        userId,
        book: bookId,
        query: query.substring(0, 50) + (query.length > 50 ? '...' : ''),
        namespace
      });

      const startTime = performance.now();
      const response = await fetch('/api/v11/book-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          book: bookId,
          query,
          namespace,
        })
      });
      const endTime = performance.now();

      console.log(`${logPrefix} API call completed in ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`${logPrefix} Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${logPrefix} API error response (${response.status}):`, errorText);
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

      // Log the response data
      console.log(`${logPrefix} Response data:`, {
        success: data.success,
        bookTitle: data.bookTitle,
        bookAuthor: data.bookAuthor,
        contentLength: data.content ? data.content.length : 0,
        matches: data.matches || 0
      });

      // Store the result for debugging
      setLastFunctionResult(data);

      if (!data.content) {
        console.error(`${logPrefix} No content found in response`);
        throw new Error('No content found for query');
      }

      const result = {
        success: true,
        bookTitle: data.bookTitle,
        bookAuthor: data.bookAuthor,
        content: data.content,
        matches: data.matches || 0,
        message: `Here is content from "${data.bookTitle}" related to your query: ${data.content}`
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
        message: `Error querying book content: ${error instanceof Error ? error.message : String(error)}`
      };

      console.log(`${logPrefix} Returning error result:`, errorResult);
      return errorResult;
    }
  }, []);

  // Implementation for end_session
  const endSession = useCallback(() => {
    const requestId = Date.now().toString().slice(-6);
    const logPrefix = `[END-SESSION-${requestId}]`;

    try {
      console.log(`${logPrefix} 🔚 AI called end_session function`);
      setFunctionError(null);

      // Dispatch an event that will be caught by the main component to end the session
      if (typeof window !== 'undefined') {
        console.log(`${logPrefix} 🔚 Dispatching ai_end_session event`);
        const event = new CustomEvent('ai_end_session');
        window.dispatchEvent(event);
      }

      return {
        success: true,
        message: "Session ended successfully.",
        ai_instructions: "Please send a warm, friendly goodbye message and end the conversation. Don't mention ending the session explicitly - just a natural goodbye."
      };
    } catch (error) {
      console.error(`${logPrefix} Error in endSession:`, error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: `Error ending session: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }, []);

  // Implementation for report_technical_error
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
      const formattedErrorMessage = `I encountered a technical error while trying to ${function_name === 'fetch_next_question' ? 'get the next question' :
        function_name === 'query_book_content' ? 'retrieve book content' :
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

  // Implementation for handle_general_conversation
  const handleGeneralConversation = useCallback(({ message_type }: { message_type: string }) => {
    try {
      setFunctionError(null);

      // Create response based on message type
      let response: string;

      switch (message_type) {
        case 'general_chat':
          response = "I notice we're having a general conversation. This system is specifically designed to discuss books. Would you like to ask a specific question about the current book, or should I provide you with a new discussion question?";
          break;
        case 'off_topic':
          response = "I see we're going off-topic. This system is specifically designed to discuss books. Let's refocus our conversation on the book. Would you like to ask a specific question about the book, or should I provide you with a new discussion question?";
          break;
        case 'clarification_request':
          response = "I understand you're asking for clarification. To best help you, I'd need you to ask a specific question about the book, or I can provide you with a new discussion question. Which would you prefer?";
          break;
        case 'continuation_request':
          response = "To continue our book discussion, you can either ask a specific question about the book, or I can provide you with a new discussion question. What would you prefer?";
          break;
        case 'reset_completed_quests':
          response = "I'll find you a quest you've already completed so you can revisit it. Would you like to tell me what kind of quest you're interested in revisiting?";
          break;
        default:
          response = "This system is specifically designed for book discussions. You can either ask a specific question about the book we're discussing, or I can provide you with a new discussion question to explore. Which would you prefer?";
      }

      return {
        success: true,
        message_type,
        message: response
      };
    } catch (error) {
      console.error('Error in handleGeneralConversation:', error);
      setFunctionError(error instanceof Error ? error.message : String(error));

      return {
        success: false,
        error: true,
        message: `Error handling general conversation: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }, []);

  // Create a function to register all of these functions with the WebRTC hook

  // Define a type for the function callback
  type BookFunction = (args: Record<string, unknown>) => Promise<BookFunctionResult | { success: boolean;[key: string]: unknown; }>;

  const registerBookFunctions = useCallback((registerFunction: (name: string, fn: BookFunction) => void) => {
    registerFunction('fetch_next_question', fetchNextQuestion);
    registerFunction('query_book_content', queryBookContent);
    registerFunction('end_session', endSession);
    registerFunction('report_technical_error', reportTechnicalError);
    registerFunction('handle_general_conversation', handleGeneralConversation);
    registerFunction('reset_completed_quest', resetCompletedQuest);

    console.log("All book functions registered");
  }, [fetchNextQuestion, queryBookContent, endSession, reportTechnicalError, handleGeneralConversation, resetCompletedQuest]);

  return {
    bookFunctions,
    registerBookFunctions,
    lastFunctionResult,
    functionError
  };
}

export default useBookFunctions;