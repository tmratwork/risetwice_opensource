// src/hooksV16/use-book-functions-v16.ts

"use client";

import { useState, useCallback, useMemo } from 'react';

/**
 * V16 Book Functions Hook - Fresh Implementation
 * Provides book-related function implementations for V16
 */

export interface BookFunctionResult {
  success: boolean;
  data?: {
    content?: string[];
    error?: string;
    message?: string;
    [key: string]: unknown;
  };
  error?: string;
}

export interface GPTFunction {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export function useBookFunctionsV16() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Book query function
  const queryBookContent = useCallback(async (args: {
    question: string;
    book_id?: string;
    limit?: number;
  }): Promise<BookFunctionResult> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/v16/query-book-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return { success: true, data: result };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  // Function registry for OpenAI
  const functionRegistry = useMemo(() => ({
    query_book_content: queryBookContent,
  }), [queryBookContent]);

  // Available functions for OpenAI registration
  const getAvailableFunctions = useMemo((): GPTFunction[] => [
    {
      name: 'query_book_content',
      description: 'Query book content to find relevant information',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The question to search for in book content'
          },
          book_id: {
            type: 'string',
            description: 'Optional specific book ID to search in'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return'
          }
        },
        required: ['question']
      }
    }
  ], []);

  return {
    // Function implementations
    functionRegistry,
    getAvailableFunctions,
    
    // Individual functions
    queryBookContent,
    
    // State
    loading,
    error,
  };
}