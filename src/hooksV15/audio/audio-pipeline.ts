// src/hooksV15/audio/audio-pipeline.ts

import audioLogger from './audio-logger';
import audioService from './audio-service';
import type { AudioEvent, WebRTCMessage } from '../types';

/**
 * Audio Pipeline for V15
 * 
 * Event-driven audio processing pipeline that:
 * - Processes all audio-related WebRTC messages
 * - Maintains event history for debugging
 * - Coordinates between WebRTC and audio service
 * - Provides unified audio chunk and completion handling
 */

export class AudioPipeline {
  private eventHistory: AudioEvent[] = [];
  private readonly maxEventHistory = 500;

  constructor() {
    audioLogger.info('audio', 'pipeline_initialized', {
      version: 'v15',
      maxEventHistory: this.maxEventHistory
    });
  }

  /**
   * Process audio chunk from WebRTC message
   */
  public async processAudioChunk(message: WebRTCMessage): Promise<void> {
    const startTime = performance.now();

    try {
      // Validate message ID
      if (!message.id) {
        throw new Error('Audio chunk message missing ID');
      }

      // Check if this is a signal message (start/stop) without actual audio data
      const isSignalMessage = message.metadata?.isBufferStart || message.metadata?.isBufferStop;
      
      if (isSignalMessage) {
        // Handle signal messages (start/stop notifications)
        audioLogger.debug('audio', 'signal_processed', {
          messageId: message.id,
          signalType: message.metadata?.isBufferStart ? 'start' : 'stop',
          messageType: message.metadata?.messageType
        });

        // Create signal event
        const event: AudioEvent = {
          type: message.metadata?.isBufferStart ? 'playback_started' : 'playback_ended',
          messageId: message.id,
          timestamp: Date.now(),
          metadata: {
            signalType: message.metadata?.isBufferStart ? 'start' : 'stop',
            messageType: message.metadata?.messageType
          }
        };

        this.addToEventHistory(event);
        return; // Don't try to process non-existent audio data
      }

      // For non-signal messages, validate audio data
      if (!message.data) {
        throw new Error('Audio chunk message missing data');
      }

      // Handle different data types
      let audioData: ArrayBuffer;
      if (message.data instanceof ArrayBuffer) {
        // Already decoded ArrayBuffer from message handler
        audioData = message.data;
      } else if (typeof message.data === 'string') {
        // Base64 string that needs decoding
        audioData = this.decodeAudioData(message.data);
      } else {
        throw new Error('Invalid audio data type: expected ArrayBuffer or string');
      }
      
      // Generate chunk ID
      const chunkId = `chunk-${message.id}-${Date.now()}`;

      // Create audio event
      const event: AudioEvent = {
        type: 'chunk_received',
        messageId: message.id,
        timestamp: Date.now(),
        data: audioData,
        metadata: {
          chunkSize: audioData.byteLength,
          estimatedDuration: this.estimateAudioDuration(audioData),
          sequenceNumber: this.getSequenceNumber(message.id)
        }
      };

      // Add to event history
      this.addToEventHistory(event);

      // Process through audio service
      await audioService.processAudioChunk(message.id, audioData, chunkId);

      // Log processing time
      audioLogger.performance('audio_chunk_pipeline', performance.now() - startTime, {
        messageId: message.id,
        chunkId,
        dataSize: audioData.byteLength
      });

    } catch (error) {
      audioLogger.error('audio', 'chunk_pipeline_failed', error as Error, {
        messageId: message.id,
        messageType: message.type
      });

      // Create error event
      const errorEvent: AudioEvent = {
        type: 'playback_error',
        messageId: message.id,
        timestamp: Date.now(),
        metadata: {
          error: (error as Error).message,
          processingTime: performance.now() - startTime
        }
      };

      this.addToEventHistory(errorEvent);
      throw error;
    }
  }

  /**
   * Process audio completion signal
   */
  public processAudioCompletion(message: WebRTCMessage): void {
    try {
      audioLogger.info('audio', 'completion_signal_received', {
        messageId: message.id,
        timestamp: message.timestamp
      });

      // Create completion event
      const event: AudioEvent = {
        type: 'message_complete',
        messageId: message.id,
        timestamp: Date.now(),
        metadata: {
          signalTimestamp: message.timestamp,
          processingDelay: Date.now() - message.timestamp
        }
      };

      // Add to event history
      this.addToEventHistory(event);

      // Complete message in audio service
      audioService.completeMessage(message.id);

    } catch (error) {
      audioLogger.error('audio', 'completion_pipeline_failed', error as Error, {
        messageId: message.id
      });
      throw error;
    }
  }

  /**
   * Start new message session
   */
  public startMessageSession(messageId: string): void {
    audioLogger.info('audio', 'session_started', { messageId });
    
    // Reset sequence counter for this message
    this.resetSequenceNumber(messageId);
    
    // Start in audio service
    audioService.startNewMessage(messageId);
  }

  /**
   * Get event history
   */
  public getEventHistory(): AudioEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Get events for specific message
   */
  public getEventsForMessage(messageId: string): AudioEvent[] {
    return this.eventHistory.filter(event => event.messageId === messageId);
  }

  /**
   * Get recent events within time window
   */
  public getRecentEvents(timeWindowMs: number): AudioEvent[] {
    const cutoff = Date.now() - timeWindowMs;
    return this.eventHistory.filter(event => event.timestamp >= cutoff);
  }

  /**
   * Clear event history
   */
  public clearEventHistory(): void {
    const previousCount = this.eventHistory.length;
    this.eventHistory = [];
    audioLogger.info('audio', 'event_history_cleared', { previousCount });
  }

  /**
   * Get pipeline diagnostics
   */
  public getDiagnostics(): Record<string, unknown> {
    const now = Date.now();
    const recentEvents = this.getRecentEvents(60000); // Last minute
    
    const eventTypeCounts = recentEvents.reduce((counts, event) => {
      counts[event.type] = (counts[event.type] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return {
      totalEvents: this.eventHistory.length,
      recentEvents: recentEvents.length,
      eventTypeCounts,
      activeMessages: this.getActiveMessages(),
      lastEventTime: this.eventHistory.length > 0 ? 
        this.eventHistory[this.eventHistory.length - 1].timestamp : null,
      timeSinceLastEvent: this.eventHistory.length > 0 ? 
        now - this.eventHistory[this.eventHistory.length - 1].timestamp : null
    };
  }

  // Private Helper Methods

  private decodeAudioData(base64Data: string): ArrayBuffer {
    try {
      const binaryString = atob(base64Data);
      const length = binaryString.length;
      const bytes = new Uint8Array(length);
      
      for (let i = 0; i < length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return bytes.buffer;
    } catch (error) {
      throw new Error(`Failed to decode audio data: ${(error as Error).message}`);
    }
  }

  private estimateAudioDuration(audioData: ArrayBuffer): number {
    // Estimate duration for PCM16 audio at 24kHz
    return (audioData.byteLength / 2 / 24000) * 1000; // milliseconds
  }

  private addToEventHistory(event: AudioEvent): void {
    this.eventHistory.push(event);
    
    // Maintain size limit
    if (this.eventHistory.length > this.maxEventHistory) {
      this.eventHistory.shift();
    }
  }

  // Sequence number tracking
  private sequenceNumbers: Map<string, number> = new Map();

  private getSequenceNumber(messageId: string): number {
    const current = this.sequenceNumbers.get(messageId) || 0;
    this.sequenceNumbers.set(messageId, current + 1);
    return current;
  }

  private resetSequenceNumber(messageId: string): void {
    this.sequenceNumbers.set(messageId, 0);
  }

  private getActiveMessages(): string[] {
    const recentEvents = this.getRecentEvents(30000); // Last 30 seconds
    const messageIds = new Set<string>();
    
    recentEvents.forEach(event => {
      if (event.type === 'chunk_received') {
        messageIds.add(event.messageId);
      }
    });
    
    return Array.from(messageIds);
  }
}