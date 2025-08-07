// src/hooksV16/types.ts

"use client";

/**
 * V16 Types - Fresh implementation independent from V15
 */

export interface ConnectionConfig {
  tools?: unknown[];
  tool_choice?: 'auto' | 'required' | 'none';
  voice?: string;
  instructions?: string;
  model?: string;
}

export interface AudioConfig {
  voice?: string;
  format?: string;
  sampleRate?: number;
}

export interface WebRTCMessage {
  type: string;
  data: unknown;
  timestamp: number;
}

export interface AudioEvent {
  type: 'start' | 'chunk' | 'end' | 'error';
  data: unknown;
  timestamp: number;
}

export interface WebRTCV16Return {
  isConnected: boolean;
  connectionState: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (message: string) => boolean;
}

export interface AudioServiceState {
  isPlaying: boolean;
  volume: number;
  error: string | null;
}