/**
 * Function descriptions for AI tools
 * These descriptions are used to define the functions that the AI can call
 */

import { GPTFunction } from '@/hooksV11/use-webrtc';

/**
 * Generate function definitions for the AI
 * @returns An array of GPTFunction objects that define the tools available to the AI
 */
export function generateBookFunctions(): GPTFunction[] {
  return [
    {
      type: 'function',
      name: 'fetch_next_question',
      description: 'Fetch the next question about the book or a dilemma from the book when the user is ready to move on to a new topic. MANDATORY: You MUST call this function ONLY after a user message, and NEVER immediately after your own response or after any other function call. This function should be called ONLY when: 1) The user explicitly asks for a new/different/another question, 2) The user explicitly says they want to move on or change topics, 3) The user explicitly indicates they are done with the current question. CRITICAL: NEVER call this function unless the user has just sent a message indicating they want to move on. When this function returns a result, you MUST present the question exactly as provided in the message field WITHOUT any additions, introductions, or modifications. Deliver ONLY the exact message text verbatim.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
    },
    {
      type: 'function',
      name: 'reset_completed_quest',
      description: 'Call this function when the user wants to revisit a quest they have already completed. This happens typically when all quests have been completed and the user responds positively to the suggestion to retry a completed quest. Unlike fetch_next_question, this function will specifically select from quests the user has already completed. IMPORTANT: Only call this function when: 1) The user has been told they completed all quests and explicitly asks to redo a previous quest, or 2) The user specifically asks to revisit or restart a quest they already completed. When this function returns a result, present the quest exactly as provided without modifications.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
    },
    {
      type: 'function',
      name: 'query_book_content',
      description: 'Retrieve accurate information from the book before answering questions about its content or responding to the user in the role of a character from or author of the book. MANDATORY: You MUST call this function BEFORE responding to ANY user question about the book\'s content, characters, plot, themes, or analysis. This includes when users: 1) ask specific questions about book details, 2) request clarification about plot points or character motivations, 3) seek analysis of themes or literary devices, or 4) ask for comparisons between story elements. NEVER answer questions about the book\'s specific content without calling this function first.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The user\'s question reformulated as a search query to find the most relevant book content. Should be concise but include key terms from the user\'s question.'
          },
          namespace: {
            type: 'string',
            description: 'Optional. The specific namespace to search in, if you know it. Otherwise, the default namespace for the current book will be used.'
          }
        },
        required: ['query']
      },
    },
    {
      type: 'function',
      name: 'end_session',
      description: 'End the current conversation session when the user EXPLICITLY indicates they want to stop talking or end the conversation. CRITICAL: ONLY call this function when the user clearly says goodbye, thank you for the conversation, or directly states they want to end the session. NEVER call this function automatically after other function calls, especially not after query_book_content. This function immediately terminates the conversation, so it should ONLY be used when the user explicitly requests to end the session. When receiving book content or after answering a question, always continue the conversation naturally unless the user specifically asks to stop.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
    },
    {
      type: 'function',
      name: 'report_technical_error',
      description: 'IMPORTANT: Call this function to report a technical error to the user when another function call fails. This function should be called ONLY when you detect that a previous function call (like fetch_next_question or query_book_content) has failed due to a database error, API error, or other technical issue. The function will provide a proper error notification to the user and log the error for technical support.',
      parameters: {
        type: 'object',
        properties: {
          error_type: {
            type: 'string',
            description: 'The type of error that occurred. Options: "database_error", "api_error", "connection_error", "data_format_error".'
          },
          function_name: {
            type: 'string',
            description: 'The name of the function that failed (e.g., "fetch_next_question", "query_book_content").'
          },
          error_message: {
            type: 'string',
            description: 'A brief description of the error that occurred.'
          }
        },
        required: ['error_type', 'function_name']
      },
    },
    {
      type: 'function',
      name: 'handle_general_conversation',
      description: 'Use this function as a catch-all for user messages that don\'t fit the criteria for other functions. IMPORTANT: Call this function when the user\'s message: 1) is not a specific question about the book or a dilemma from the book that requires query_book_content, 2) is not a request to move to a new topic that requires fetch_next_question, 3) is not a greeting or farewell. This function will inform the user that this system is designed specifically for better understanding of the book concepts and characters. Guide them to either ask about the book, a dilemma from the book, or request a new question.',
      parameters: {
        type: 'object',
        properties: {
          message_type: {
            type: 'string',
            description: 'The general category of the user\'s message. Options: "general_chat", "off_topic", "clarification_request", "continuation_request", "reset_completed_quests", "other".'
          }
        },
        required: ['message_type']
      },
    },
  ];
}