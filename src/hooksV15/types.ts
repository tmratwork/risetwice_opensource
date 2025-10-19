// src/hooksV15/types.ts

/**
 * V15 Type Definitions
 * Clean, comprehensive type system for the greenfield WebRTC implementation
 */

// Core WebRTC Message Types
export interface WebRTCMessage {
  type: 'audio_chunk' | 'audio_complete' | 'function_call' | 'transcript' | 'error';
  id: string;
  data?: ArrayBuffer | string | unknown;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// Audio Event Types for Event-Driven Architecture
export interface AudioEvent {
  type: 'chunk_received' | 'message_complete' | 'playback_started' | 'playback_ended' | 'playback_error';
  messageId: string;
  timestamp: number;
  data?: ArrayBuffer;
  metadata?: {
    chunkSize?: number;
    estimatedDuration?: number;
    sequenceNumber?: number;
    [key: string]: unknown;
  };
}

// Audio Service State
export interface AudioServiceState {
  queueLength: number;
  isPlaying: boolean;
  currentMessageId: string | null;
  lastProcessedChunk: number;
  audioContextState: 'running' | 'suspended' | 'closed' | 'interrupted';
  totalChunksProcessed: number;
  totalPlaybackTime: number;
}

// WebRTC Hook Return Type - UPDATED for aggressive re-render fix
export interface WebRTCV15Return {
  // Connection state
  isConnected: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'failed';
  
  // REMOVED: audioState - using getters only to prevent re-renders
  // audioState: AudioServiceState;
  
  // Audio getters (stable - no re-renders)
  getAudioLevel: () => number;
  getIsAudioPlaying: () => boolean;
  getAudioStateIsPlaying: () => boolean;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (message: string) => boolean;
  registerFunction: (name: string) => void;
  
  // Event subscriptions
  onTranscript: (callback: (message: { id: string; data: string; metadata?: Record<string, unknown> }) => void) => () => void;
  onError: (callback: (error: Error) => void) => () => void;
  
  // Diagnostics
  diagnostics: {
    getEventHistory: () => AudioEvent[];
    getPerformanceMetrics: () => PerformanceMetrics;
    exportDiagnostics: () => string;
  };
}

// Performance and Diagnostics
export interface PerformanceMetrics {
  connectionTime: number;
  audioLatency: number;
  messageProcessingTime: number;
  memoryUsage: number;
  cpuUsage?: number;
  [key: string]: unknown;
}

// Logging Levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Diagnostic Data
export interface DiagnosticData {
  timestamp: number;
  timestampISO: string;
  level: LogLevel;
  category: string;
  operation: string;
  data: Record<string, unknown>;
  sessionId?: string;
}

// Connection Configuration
export interface ConnectionConfig {
  apiKey?: string;
  endpoint?: string;
  timeout?: number;
  retryAttempts?: number;
  enableDiagnostics?: boolean;
  voice?: string;
  instructions?: string;
  greetingInstructions?: string;
  isResume?: boolean;
  tools?: Array<{
    type: 'function';
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
  tool_choice?: 'auto' | 'required' | string | null;
  // V18: Optional turn_detection override for manual push-to-talk mode
  // When null, disables automatic Voice Activity Detection (VAD)
  // When undefined, uses AI_DEFAULTS.turnDetection (automatic VAD)
  turnDetection?: { type: string; silence_duration_ms?: number } | null;
  conversationHistory?: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
}

// Audio Configuration
export interface AudioConfig {
  sampleRate?: number;
  bufferSize?: number;
  enableLevelMonitoring?: boolean;
  silenceThreshold?: number;
}