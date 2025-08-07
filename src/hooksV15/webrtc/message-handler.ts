// src/hooksV15/webrtc/message-handler.ts

import audioLogger from '../audio/audio-logger';
import { MessageRouter } from '../audio/message-router';
import type { WebRTCMessage } from '../types';

/**
 * Unified Message Handler for V15
 * 
 * Single, unified handler for ALL WebRTC messages that:
 * - Eliminates parallel processing paths
 * - Provides consistent message parsing
 * - Routes all messages through the message router
 * - Maintains proper error handling and logging
 */

export class UnifiedMessageHandler {
  private messageRouter: MessageRouter;
  private currentMessageId: string | null = null;

  constructor() {
    this.messageRouter = new MessageRouter();
    
    audioLogger.info('webrtc', 'message_handler_initialized', {
      version: 'v15',
      timestamp: Date.now()
    });
  }

  /**
   * Handle raw WebRTC message
   * This is the SINGLE ENTRY POINT for all WebRTC message processing
   */
  public async handleMessage(event: MessageEvent): Promise<void> {
    try {
      // Parse message
      const rawMessage = this.parseRawMessage(event.data);
      
      // Convert to structured WebRTC message
      const message = this.convertToWebRTCMessage(rawMessage);
      
      if (!message) {
        // Not a message we handle, ignore silently
        return;
      }

      // Route through unified message router
      await this.messageRouter.routeMessage(message);

    } catch (error) {
      audioLogger.error('webrtc', 'message_handling_failed', error as Error, {
        rawData: this.safeStringify(event.data)
      });
    }
  }

  /**
   * Parse raw WebRTC message data
   */
  private parseRawMessage(data: string): Record<string, unknown> {
    try {
      return JSON.parse(data);
    } catch (error) {
      throw new Error(`Failed to parse WebRTC message: ${(error as Error).message}`);
    }
  }

  /**
   * Convert raw message to structured WebRTC message
   */
  private convertToWebRTCMessage(rawMessage: Record<string, unknown>): WebRTCMessage | null {
    const messageType = rawMessage.type as string;
    
    switch (messageType) {
      // OpenAI Realtime API audio message types
      case 'response.audio.delta':
        return this.handleAudioDelta(rawMessage);
        
      case 'response.audio.done':
        return this.handleAudioDone(rawMessage);
        
      // Legacy audio buffer types (keeping for compatibility)
      case 'output_audio_buffer.push':
        return this.handleAudioBufferPush(rawMessage);
        
      case 'output_audio_buffer.started':
        return this.handleAudioBufferStarted(rawMessage);
        
      case 'output_audio_buffer.stopped':
        return this.handleAudioBufferStopped(rawMessage);
        
      // Transcript handling
      case 'response.audio_transcript.delta':
        return this.handleAudioTranscriptDelta(rawMessage);
        
      case 'response.audio_transcript.done':
        return this.handleAudioTranscriptDone(rawMessage);
        
      // Function calling
      case 'response.function_call_arguments.delta':
        return this.handleFunctionCallDelta(rawMessage);
        
      // Response completion
      case 'response.done':
        return this.handleResponseDone(rawMessage);
        
      // Error handling
      case 'error':
        return this.handleErrorMessage(rawMessage);
        
      default:
        // Log unknown message types for debugging
        audioLogger.debug('webrtc', 'unknown_message_type', {
          messageType,
          rawMessage: this.safeStringify(rawMessage)
        });
        return null;
    }
  }

  /**
   * Handle OpenAI Realtime API response.audio.delta message
   */
  private handleAudioDelta(rawMessage: Record<string, unknown>): WebRTCMessage | null {
    const delta = rawMessage.delta as string;
    const responseId = rawMessage.response_id as string || 'unknown';

    if (!delta) {
      return null; // No audio data
    }

    // Convert base64 audio delta to ArrayBuffer
    try {
      const binaryString = atob(delta);
      const audioBuffer = new ArrayBuffer(binaryString.length);
      const view = new Uint8Array(audioBuffer);
      
      for (let i = 0; i < binaryString.length; i++) {
        view[i] = binaryString.charCodeAt(i);
      }

      // Set current message ID if this is a new message
      if (!this.currentMessageId || this.currentMessageId !== responseId) {
        this.currentMessageId = responseId;
        this.messageRouter.startMessageSession(responseId);
      }

      return {
        type: 'audio_chunk',
        id: responseId,
        data: audioBuffer,
        timestamp: Date.now(),
        metadata: {
          bufferSize: audioBuffer.byteLength,
          messageType: 'response.audio.delta'
        }
      };

    } catch (error) {
      audioLogger.error('webrtc', 'audio_delta_decode_failed', error as Error, {
        responseId,
        deltaLength: delta.length
      });
      return null;
    }
  }

  /**
   * Handle OpenAI Realtime API response.audio.done message
   */
  private handleAudioDone(rawMessage: Record<string, unknown>): WebRTCMessage | null {
    const responseId = rawMessage.response_id as string || this.currentMessageId || 'unknown';

    audioLogger.info('webrtc', 'audio_done_received', { responseId });

    return {
      type: 'audio_complete',
      id: responseId,
      timestamp: Date.now(),
      metadata: {
        messageType: 'response.audio.done',
        isAudioComplete: true
      }
    };
  }

  /**
   * Handle actual audio buffer data (the main audio content)
   */
  private handleAudioBufferPush(rawMessage: Record<string, unknown>): WebRTCMessage | null {
    const buffer = rawMessage.buffer as string;
    const responseId = rawMessage.response_id as string || 'unknown';

    if (!buffer) {
      return null; // No audio data
    }

    // Convert base64 buffer to ArrayBuffer
    try {
      const binaryString = atob(buffer);
      const audioBuffer = new ArrayBuffer(binaryString.length);
      const view = new Uint8Array(audioBuffer);
      
      for (let i = 0; i < binaryString.length; i++) {
        view[i] = binaryString.charCodeAt(i);
      }

      // Set current message ID if this is a new message
      if (!this.currentMessageId || this.currentMessageId !== responseId) {
        this.currentMessageId = responseId;
        this.messageRouter.startMessageSession(responseId);
      }

      return {
        type: 'audio_chunk',
        id: responseId,
        data: audioBuffer,
        timestamp: Date.now(),
        metadata: {
          bufferSize: audioBuffer.byteLength,
          messageType: 'output_audio_buffer.push'
        }
      };

    } catch (error) {
      audioLogger.error('webrtc', 'audio_buffer_decode_failed', error as Error, {
        responseId,
        bufferLength: buffer.length
      });
      return null;
    }
  }

  /**
   * Handle audio buffer started
   */
  private handleAudioBufferStarted(rawMessage: Record<string, unknown>): WebRTCMessage | null {
    const responseId = rawMessage.response_id as string || 'unknown';

    audioLogger.info('webrtc', 'audio_buffer_started', { responseId });

    return {
      type: 'audio_chunk',
      id: responseId,
      data: null,
      timestamp: Date.now(),
      metadata: {
        messageType: 'output_audio_buffer.started',
        isBufferStart: true
      }
    };
  }

  /**
   * Handle audio buffer stopped
   */
  private handleAudioBufferStopped(rawMessage: Record<string, unknown>): WebRTCMessage | null {
    const responseId = rawMessage.response_id as string || this.currentMessageId || 'unknown';

    audioLogger.info('webrtc', 'audio_buffer_stopped', { responseId });

    return {
      type: 'audio_complete',
      id: responseId,
      timestamp: Date.now(),
      metadata: {
        messageType: 'output_audio_buffer.stopped',
        isBufferStop: true
      }
    };
  }

  /**
   * Handle audio transcript delta (transcript text, not audio data)
   */
  private handleAudioTranscriptDelta(rawMessage: Record<string, unknown>): WebRTCMessage | null {
    const delta = rawMessage.delta as string;
    const responseId = rawMessage.response_id as string || 'unknown';
    
    if (!delta) {
      return null; // No transcript data
    }

    // Set current message ID if this is a new message
    if (!this.currentMessageId || this.currentMessageId !== responseId) {
      this.currentMessageId = responseId;
      this.messageRouter.startMessageSession(responseId);
    }

    return {
      type: 'transcript',
      id: responseId,
      data: delta,
      timestamp: Date.now(),
      metadata: {
        deltaLength: delta.length,
        messageType: 'response.audio_transcript.delta'
      }
    };
  }

  /**
   * Handle audio transcript done (transcript completion)
   */
  private handleAudioTranscriptDone(rawMessage: Record<string, unknown>): WebRTCMessage | null {
    const responseId = rawMessage.response_id as string || this.currentMessageId || 'unknown';
    const transcript = rawMessage.transcript as string;

    return {
      type: 'transcript',
      id: responseId,
      data: transcript,
      timestamp: Date.now(),
      metadata: {
        messageType: 'response.audio_transcript.done',
        isTranscriptComplete: true
      }
    };
  }

  /**
   * Handle function call arguments delta
   */
  private handleFunctionCallDelta(rawMessage: Record<string, unknown>): WebRTCMessage | null {
    const delta = rawMessage.delta as string;
    const callId = rawMessage.call_id as string || 'unknown';

    if (!delta) {
      return null;
    }

    return {
      type: 'function_call',
      id: callId,
      data: delta,
      timestamp: Date.now(),
      metadata: {
        deltaLength: delta.length,
        messageType: 'response.function_call_arguments.delta'
      }
    };
  }

  /**
   * Handle response done
   */
  private handleResponseDone(rawMessage: Record<string, unknown>): WebRTCMessage | null {
    const responseId = rawMessage.response_id as string || this.currentMessageId || 'unknown';

    // This indicates the entire response is complete
    audioLogger.info('webrtc', 'response_completed', {
      responseId,
      rawMessage: this.safeStringify(rawMessage)
    });

    return {
      type: 'audio_complete',
      id: responseId,
      timestamp: Date.now(),
      metadata: {
        messageType: 'response.done',
        isResponseComplete: true
      }
    };
  }

  /**
   * Handle error messages
   */
  private handleErrorMessage(rawMessage: Record<string, unknown>): WebRTCMessage {
    const errorMessage = rawMessage.error as Record<string, unknown> || {};
    const errorId = `error-${Date.now()}`;

    return {
      type: 'error',
      id: errorId,
      data: errorMessage,
      timestamp: Date.now(),
      metadata: {
        messageType: 'error',
        originalMessage: this.safeStringify(rawMessage)
      }
    };
  }

  /**
   * Get current message ID
   */
  public getCurrentMessageId(): string | null {
    return this.currentMessageId;
  }

  /**
   * Reset current message state
   */
  public resetCurrentMessage(): void {
    this.currentMessageId = null;
    audioLogger.info('webrtc', 'message_state_reset');
  }

  /**
   * Get message handler diagnostics
   */
  public getDiagnostics(): Record<string, unknown> {
    return {
      currentMessageId: this.currentMessageId,
      messageRouterDiagnostics: this.messageRouter.getDiagnostics()
    };
  }

  /**
   * Get message router instance (for advanced access)
   */
  public getMessageRouter(): MessageRouter {
    return this.messageRouter;
  }

  /**
   * Safe JSON stringify with error handling
   */
  private safeStringify(obj: unknown): string {
    try {
      return JSON.stringify(obj);
    } catch (error) {
      return `[Stringify Error: ${(error as Error).message}]`;
    }
  }
}