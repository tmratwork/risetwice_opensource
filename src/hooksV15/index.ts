// src/hooksV15/index.ts

// Audio system exports
export { default as audioLogger } from './audio/simple-optimized-logger';
export { default as audioService } from './audio/audio-service';
export { AudioPipeline } from './audio/audio-pipeline';
export { MessageRouter } from './audio/message-router';

// WebRTC exports  
export { useWebRTCV15 } from './webrtc/use-webrtc-v15';
export { UnifiedMessageHandler } from './webrtc/message-handler';
export { ComprehensiveMessageHandler } from './webrtc/comprehensive-message-handler';
export { ConnectionManager } from './webrtc/connection-manager';

// Context exports (new industry-standard pattern)
export { WebRTCProvider, useWebRTC, useConversation, useUserMessage } from '../contexts/webrtc-context';

// Function hooks
export { useBookFunctionsV15 } from './functions/use-book-functions-v15';
export { useMentalHealthFunctionsV15 } from './functions/use-mental-health-functions-v15';

// Diagnostics exports
export { PerformanceMonitor } from './diagnostics/performance-monitor';

// Types
export type { 
  AudioEvent, 
  WebRTCMessage, 
  AudioServiceState,
  WebRTCV15Return,
  ConnectionConfig,
  AudioConfig
} from './types';

// Function types
export type {
  BookFunctionResult,
  GPTFunction
} from './functions/use-book-functions-v15';

export type {
  Resource,
  SearchHistoryEntry,
  MentalHealthFunctionResult
} from './functions/use-mental-health-functions-v15';