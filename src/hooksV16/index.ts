// src/hooksV16/index.ts

"use client";

// V16 Function hooks
export { useBookFunctionsV16 } from './use-book-functions-v16';
export { useMentalHealthFunctionsV16 } from './use-mental-health-functions-v16';
export { useSupabaseFunctions } from './use-supabase-functions';
export { useFunctionRegistration } from './use-function-registration';

// V16 WebRTC exports
export { ConnectionManager } from './webrtc/connection-manager';
export { ComprehensiveMessageHandler } from './webrtc/comprehensive-message-handler';
export type { MessageHandlerCallbacks } from './webrtc/comprehensive-message-handler';

// V16 Audio exports
export { optimizedAudioLogger } from './audio/optimized-audio-logger';

// V16 Types
export type { 
  ConnectionConfig,
  AudioConfig,
  WebRTCMessage,
  AudioEvent,
  WebRTCV16Return,
  AudioServiceState
} from './types';

// Re-export function types
export type { BookFunctionResult, GPTFunction } from './use-book-functions-v16';
export type { Resource, SearchHistoryEntry, MentalHealthFunctionResult } from './use-mental-health-functions-v16';