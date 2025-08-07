// src/hooksV16/webrtc/connection-manager.ts

"use client";

import type { ConnectionConfig } from '../types';

/**
 * V16 Connection Manager - Simple stub for V16 WebRTC functionality
 * This is a minimal implementation to resolve build errors
 */
export class ConnectionManager {
  private config: ConnectionConfig;
  private state: string = 'disconnected';
  private stateChangeCallbacks: ((state: string) => void)[] = [];
  private messageCallbacks: ((event: MessageEvent) => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    console.log('[V16-CONNECTION] connect called with config:', this.config);
    this.setState('connected');
  }

  async disconnect(): Promise<void> {
    console.log('[V16-CONNECTION] disconnect called');
    this.setState('disconnected');
  }

  sendMessage(message: string): boolean {
    console.log('[V16-CONNECTION] sendMessage:', message);
    return true;
  }

  sendFunctionResult(callId: string, result: unknown): boolean {
    console.log('[V16-CONNECTION] sendFunctionResult:', { callId, result });
    return true;
  }

  getState(): string {
    return this.state;
  }

  onStateChange(callback: (state: string) => void): () => void {
    this.stateChangeCallbacks.push(callback);
    return () => {
      const index = this.stateChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.stateChangeCallbacks.splice(index, 1);
      }
    };
  }

  onMessage(callback: (event: MessageEvent) => void): () => void {
    this.messageCallbacks.push(callback);
    return () => {
      const index = this.messageCallbacks.indexOf(callback);
      if (index > -1) {
        this.messageCallbacks.splice(index, 1);
      }
    };
  }

  onError(callback: (error: Error) => void): () => void {
    this.errorCallbacks.push(callback);
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index > -1) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }

  private setState(newState: string) {
    this.state = newState;
    this.stateChangeCallbacks.forEach(callback => callback(newState));
  }
}