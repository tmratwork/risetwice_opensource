// src/hooksV15/audio/message-router.ts

import audioLogger from './audio-logger';
import { AudioPipeline } from './audio-pipeline';
import type { WebRTCMessage } from '../types';

/**
 * Message Router for V15
 * 
 * Single entry point for ALL WebRTC messages that:
 * - Routes messages to appropriate handlers
 * - Maintains message processing order
 * - Provides unified logging and diagnostics
 * - Eliminates parallel processing paths
 */

export class MessageRouter {
  private audioPipeline: AudioPipeline;
  private processedMessages: Set<string> = new Set();
  private messageQueue: WebRTCMessage[] = [];
  private isProcessing = false;
  
  // Event listeners for transcript and conversation updates
  private transcriptListeners: Set<(message: WebRTCMessage) => void> = new Set();
  private errorListeners: Set<(error: Error) => void> = new Set();

  constructor() {
    this.audioPipeline = new AudioPipeline();
    
    audioLogger.info('webrtc', 'message_router_initialized', {
      version: 'v15',
      timestamp: Date.now()
    });
  }

  /**
   * Route WebRTC message to appropriate handler
   * This is the SINGLE ENTRY POINT for all WebRTC messages
   */
  public async routeMessage(message: WebRTCMessage): Promise<void> {
    // Add timestamp if not present
    if (!message.timestamp) {
      message.timestamp = Date.now();
    }

    // Log message receipt
    audioLogger.webrtcMessage(message.type, message.id, {
      timestamp: message.timestamp,
      hasData: !!message.data,
      metadata: message.metadata
    });

    // Queue message for processing
    this.messageQueue.push(message);
    
    // Process queue if not already processing
    if (!this.isProcessing) {
      await this.processMessageQueue();
    }
  }

  /**
   * Process message queue sequentially
   */
  private async processMessageQueue(): Promise<void> {
    this.isProcessing = true;

    try {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift()!;
        await this.processMessage(message);
      }
    } catch (error) {
      audioLogger.error('webrtc', 'message_queue_processing_failed', error as Error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process individual message
   */
  private async processMessage(message: WebRTCMessage): Promise<void> {
    const startTime = performance.now();

    try {
      // Check for duplicate processing
      const messageKey = `${message.type}-${message.id}-${message.timestamp}`;
      if (this.processedMessages.has(messageKey)) {
        audioLogger.warn('webrtc', 'duplicate_message_ignored', {
          messageType: message.type,
          messageId: message.id,
          messageKey
        });
        return;
      }

      // Mark as processed
      this.processedMessages.add(messageKey);

      // Route based on message type
      switch (message.type) {
        case 'audio_chunk':
          await this.handleAudioChunk(message);
          break;

        case 'audio_complete':
          await this.handleAudioComplete(message);
          break;

        case 'function_call':
          await this.handleFunctionCall(message);
          break;

        case 'transcript':
          await this.handleTranscript(message);
          break;

        case 'error':
          await this.handleError(message);
          break;

        default:
          audioLogger.warn('webrtc', 'unknown_message_type', {
            messageType: message.type,
            messageId: message.id
          });
      }

      // Log processing time
      audioLogger.performance('message_processing', performance.now() - startTime, {
        messageType: message.type,
        messageId: message.id
      });

    } catch (error) {
      audioLogger.error('webrtc', 'message_processing_failed', error as Error, {
        messageType: message.type,
        messageId: message.id
      });
      throw error;
    }
  }

  /**
   * Handle audio chunk message
   */
  private async handleAudioChunk(message: WebRTCMessage): Promise<void> {
    // Check if this is a signal message (start/stop) without actual audio data
    const isSignalMessage = message.metadata?.isBufferStart || message.metadata?.isBufferStop;
    
    if (!message.data && !isSignalMessage) {
      throw new Error('Audio chunk message missing data');
    }

    // Log appropriately based on whether this has data or is a signal
    if (isSignalMessage) {
      audioLogger.debug('audio', 'signal_routing', {
        messageId: message.id,
        signalType: message.metadata?.isBufferStart ? 'start' : 'stop',
        messageType: message.metadata?.messageType
      });
    } else {
      audioLogger.debug('audio', 'chunk_routing', {
        messageId: message.id,
        dataSize: message.data instanceof ArrayBuffer ? message.data.byteLength : 
                  typeof message.data === 'string' ? message.data.length : 'unknown'
      });
    }

    await this.audioPipeline.processAudioChunk(message);
  }

  /**
   * Handle audio completion message
   */
  private async handleAudioComplete(message: WebRTCMessage): Promise<void> {
    audioLogger.debug('audio', 'completion_routing', {
      messageId: message.id
    });

    this.audioPipeline.processAudioCompletion(message);
  }

  /**
   * Handle function call message
   */
  private async handleFunctionCall(message: WebRTCMessage): Promise<void> {
    audioLogger.debug('webrtc', 'function_call_routing', {
      messageId: message.id,
      functionData: message.data
    });

    try {
      // Parse function call data
      const functionCallData = this.parseFunctionCall(message.data);
      
      if (!functionCallData) {
        audioLogger.warn('webrtc', 'invalid_function_call_data', {
          messageId: message.id,
          data: message.data
        });
        return;
      }

      // Execute function via function registry
      await this.executeFunctionCall(functionCallData, message.id);

    } catch (error) {
      audioLogger.error('webrtc', 'function_call_failed', error as Error, {
        messageId: message.id
      });
    }
  }

  /**
   * Handle transcript message
   */
  private async handleTranscript(message: WebRTCMessage): Promise<void> {
    audioLogger.debug('webrtc', 'transcript_routing', {
      messageId: message.id,
      hasData: !!message.data
    });

    // Emit transcript event for UI components to handle
    this.emitTranscriptEvent(message);
  }

  /**
   * Handle error message
   */
  private async handleError(message: WebRTCMessage): Promise<void> {
    const errorMessage = message.data ? String(message.data) : 'Unknown WebRTC error';
    
    audioLogger.error('webrtc', 'error_message_received', 
      new Error(errorMessage), {
        messageId: message.id,
        errorData: message.data,
        messageMetadata: message.metadata
      }
    );

    // Notify error listeners
    this.errorListeners.forEach(listener => {
      try {
        listener(new Error(errorMessage));
      } catch (listenerError) {
        audioLogger.error('webrtc', 'error_listener_failed', listenerError as Error);
      }
    });
  }

  /**
   * Start new message session
   */
  public startMessageSession(messageId: string): void {
    audioLogger.info('webrtc', 'session_started', { messageId });
    this.audioPipeline.startMessageSession(messageId);
  }

  /**
   * Get routing diagnostics
   */
  public getDiagnostics(): Record<string, unknown> {
    return {
      queueLength: this.messageQueue.length,
      isProcessing: this.isProcessing,
      processedMessageCount: this.processedMessages.size,
      audioPipelineDiagnostics: this.audioPipeline.getDiagnostics(),
      recentMessages: this.getRecentMessages(10)
    };
  }

  /**
   * Get recent message processing history
   */
  public getRecentMessages(count: number): Array<{ type: string; id: string; timestamp: number }> {
    return Array.from(this.processedMessages)
      .slice(-count)
      .map(key => {
        const [type, id, timestamp] = key.split('-');
        return { type, id, timestamp: parseInt(timestamp) };
      });
  }

  /**
   * Clear processed message history
   */
  public clearHistory(): void {
    const previousCount = this.processedMessages.size;
    this.processedMessages.clear();
    this.audioPipeline.clearEventHistory();
    
    audioLogger.info('webrtc', 'message_history_cleared', { previousCount });
  }

  /**
   * Get audio pipeline instance (for advanced diagnostics)
   */
  public getAudioPipeline(): AudioPipeline {
    return this.audioPipeline;
  }

  /**
   * Subscribe to transcript events
   */
  public onTranscript(callback: (message: WebRTCMessage) => void): () => void {
    this.transcriptListeners.add(callback);
    return () => this.transcriptListeners.delete(callback);
  }

  /**
   * Subscribe to error events
   */
  public onError(callback: (error: Error) => void): () => void {
    this.errorListeners.add(callback);
    return () => this.errorListeners.delete(callback);
  }

  /**
   * Emit transcript event to subscribers
   */
  private emitTranscriptEvent(message: WebRTCMessage): void {
    this.transcriptListeners.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        audioLogger.error('webrtc', 'transcript_listener_error', error as Error);
      }
    });
  }

  // Function calling support
  private functionRegistry: Map<string, (...args: unknown[]) => unknown> = new Map();

  /**
   * Register function for execution
   */
  public registerFunction(name: string, fn: (...args: unknown[]) => unknown): void {
    this.functionRegistry.set(name, fn);
    audioLogger.info('webrtc', 'function_registered', { functionName: name });
  }

  /**
   * Parse function call data
   */
  private parseFunctionCall(data: unknown): { name: string; arguments: Record<string, unknown> } | null {
    try {
      if (typeof data === 'string') {
        // Handle JSON string
        const parsed = JSON.parse(data);
        return this.extractFunctionInfo(parsed);
      } else if (typeof data === 'object' && data !== null) {
        // Handle object directly
        return this.extractFunctionInfo(data);
      }
      return null;
    } catch (error) {
      audioLogger.error('webrtc', 'function_parse_failed', error as Error);
      return null;
    }
  }

  /**
   * Extract function info from parsed data
   */
  private extractFunctionInfo(data: unknown): { name: string; arguments: Record<string, unknown> } | null {
    if (typeof data !== 'object' || data === null) return null;
    
    const obj = data as Record<string, unknown>;
    
    // Handle different possible formats
    if (obj.name && typeof obj.name === 'string') {
      return {
        name: obj.name,
        arguments: (obj.arguments as Record<string, unknown>) || {}
      };
    }
    
    // Handle function call delta format
    if (obj.function && typeof obj.function === 'object') {
      const func = obj.function as Record<string, unknown>;
      if (func.name && typeof func.name === 'string') {
        return {
          name: func.name,
          arguments: (func.arguments as Record<string, unknown>) || {}
        };
      }
    }
    
    return null;
  }

  /**
   * Execute function call
   */
  private async executeFunctionCall(
    functionCall: { name: string; arguments: Record<string, unknown> },
    messageId: string
  ): Promise<void> {
    const { name, arguments: args } = functionCall;
    
    audioLogger.info('webrtc', 'function_execution_started', {
      functionName: name,
      messageId,
      argumentCount: Object.keys(args).length
    });

    const registeredFunction = this.functionRegistry.get(name);
    
    if (!registeredFunction) {
      audioLogger.error('webrtc', 'function_not_registered', new Error(`Function ${name} not registered`), {
        functionName: name,
        availableFunctions: Array.from(this.functionRegistry.keys())
      });
      return;
    }

    try {
      const startTime = performance.now();
      const result = await registeredFunction(args);
      const executionTime = performance.now() - startTime;
      
      audioLogger.info('webrtc', 'function_execution_completed', {
        functionName: name,
        messageId,
        executionTime,
        success: (result && typeof result === 'object' && 'success' in result) ? result.success !== false : true
      });

      // TODO: Send function result back to OpenAI
      // This would require WebRTC data channel access

    } catch (error) {
      audioLogger.error('webrtc', 'function_execution_failed', error as Error, {
        functionName: name,
        messageId
      });
    }
  }
}