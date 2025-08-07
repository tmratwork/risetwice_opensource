// src/hooksV15/audio/audio-service.ts

import audioLogger from './audio-logger';
import type { AudioServiceState, AudioEvent } from '../types';

/**
 * Clean Audio Service for V15
 * 
 * Modern, event-driven audio service with:
 * - Clean separation of concerns
 * - Proper TypeScript typing
 * - Built-in diagnostics
 * - Atomic operations
 * - Consistent state management
 */

interface AudioChunk {
  id: string;
  messageId: string;
  data: ArrayBuffer;
  timestamp: number;
  sequenceNumber: number;
  processed: boolean;
}

interface AudioMessage {
  id: string;
  chunks: AudioChunk[];
  isComplete: boolean;
  startTime: number;
  completionTime?: number;
}

export class AudioServiceV15 {
  private static instance: AudioServiceV15;

  // State
  private audioContext: AudioContext | null = null;
  private currentAudioSource: AudioBufferSourceNode | null = null;
  private isPlaying = false;
  private audioQueue: AudioChunk[] = [];
  private messages: Map<string, AudioMessage> = new Map();
  private currentMessageId: string | null = null;

  // Metrics
  private totalChunksProcessed = 0;
  private totalPlaybackTime = 0;
  private lastProcessedChunk = 0;

  // Event handling
  private stateChangeListeners: Set<(state: AudioServiceState) => void> = new Set();
  private eventListeners: Set<(event: AudioEvent) => void> = new Set();

  private constructor() {
    audioLogger.info('audio', 'service_initialized', {
      version: 'v15',
      timestamp: Date.now()
    });
  }

  public static getInstance(): AudioServiceV15 {
    if (!AudioServiceV15.instance) {
      AudioServiceV15.instance = new AudioServiceV15();
    }
    return AudioServiceV15.instance;
  }

  /**
   * Get current audio service state
   */
  public getState(): AudioServiceState {
    return {
      queueLength: this.audioQueue.length,
      isPlaying: this.isPlaying,
      currentMessageId: this.currentMessageId,
      lastProcessedChunk: this.lastProcessedChunk,
      audioContextState: this.audioContext?.state || 'closed',
      totalChunksProcessed: this.totalChunksProcessed,
      totalPlaybackTime: this.totalPlaybackTime
    };
  }

  /**
   * Subscribe to state changes
   */
  public subscribe(callback: (state: AudioServiceState) => void): () => void {
    this.stateChangeListeners.add(callback);

    // Send initial state
    callback(this.getState());

    return () => {
      this.stateChangeListeners.delete(callback);
    };
  }

  /**
   * Subscribe to audio events
   */
  public subscribeToEvents(callback: (event: AudioEvent) => void): () => void {
    this.eventListeners.add(callback);

    return () => {
      this.eventListeners.delete(callback);
    };
  }

  /**
   * Initialize audio context
   */
  private async initializeAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      return;
    }

    try {
      this.audioContext = new AudioContext({ sampleRate: 24000 });

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      audioLogger.info('audio', 'context_initialized', {
        state: this.audioContext.state,
        sampleRate: this.audioContext.sampleRate
      });

      this.notifyStateChange();
    } catch (error) {
      audioLogger.error('audio', 'context_initialization_failed', error as Error);
      throw error;
    }
  }

  /**
   * Start a new message session
   */
  public startNewMessage(messageId: string): void {
    audioLogger.info('audio', 'message_started', { messageId });

    // Create new message record
    const message: AudioMessage = {
      id: messageId,
      chunks: [],
      isComplete: false,
      startTime: Date.now()
    };

    this.messages.set(messageId, message);
    this.currentMessageId = messageId;

    this.emitEvent({
      type: 'chunk_received',
      messageId,
      timestamp: Date.now(),
      metadata: { action: 'message_started' }
    });

    this.notifyStateChange();
  }

  /**
   * Process audio chunk
   */
  public async processAudioChunk(
    messageId: string,
    audioData: ArrayBuffer,
    chunkId: string
  ): Promise<void> {
    const startTime = performance.now();

    try {
      // Ensure audio context is ready
      await this.initializeAudioContext();

      // Get or create message record
      let message = this.messages.get(messageId);
      if (!message) {
        audioLogger.warn('audio', 'chunk_for_unknown_message', { messageId, chunkId });
        this.startNewMessage(messageId);
        message = this.messages.get(messageId)!;
      }

      // Create chunk record
      const chunk: AudioChunk = {
        id: chunkId,
        messageId,
        data: audioData,
        timestamp: Date.now(),
        sequenceNumber: message.chunks.length,
        processed: false
      };

      // Add to message
      message.chunks.push(chunk);

      // Add to processing queue
      this.audioQueue.push(chunk);

      // Log chunk details
      audioLogger.audioChunk(messageId, audioData.byteLength, this.estimateAudioDuration(audioData));

      // Emit event
      this.emitEvent({
        type: 'chunk_received',
        messageId,
        timestamp: chunk.timestamp,
        data: audioData,
        metadata: {
          chunkId,
          chunkSize: audioData.byteLength,
          sequenceNumber: chunk.sequenceNumber,
          estimatedDuration: this.estimateAudioDuration(audioData)
        }
      });

      // Start playback if not already playing
      if (!this.isPlaying) {
        await this.startPlayback();
      }

      // Update metrics
      this.totalChunksProcessed++;
      this.lastProcessedChunk = Date.now();

      audioLogger.performance('chunk_processing', performance.now() - startTime, {
        messageId,
        chunkId,
        queueLength: this.audioQueue.length
      });

      this.notifyStateChange();

    } catch (error) {
      audioLogger.error('audio', 'chunk_processing_failed', error as Error, {
        messageId,
        chunkId,
        audioDataSize: audioData.byteLength
      });
      throw error;
    }
  }

  /**
   * Mark message as complete
   */
  public completeMessage(messageId: string): void {
    const message = this.messages.get(messageId);
    if (!message) {
      audioLogger.warn('audio', 'completion_for_unknown_message', { messageId });
      return;
    }

    message.isComplete = true;
    message.completionTime = Date.now();

    audioLogger.info('audio', 'message_completed', {
      messageId,
      chunkCount: message.chunks.length,
      duration: message.completionTime - message.startTime
    });

    this.emitEvent({
      type: 'message_complete',
      messageId,
      timestamp: message.completionTime,
      metadata: {
        chunkCount: message.chunks.length,
        totalDuration: message.completionTime - message.startTime
      }
    });

    this.notifyStateChange();
  }

  /**
   * Start audio playback
   */
  private async startPlayback(): Promise<void> {
    if (this.isPlaying || this.audioQueue.length === 0) {
      return;
    }

    try {
      await this.initializeAudioContext();
      this.isPlaying = true;

      audioLogger.audioPlayback('started', this.currentMessageId || 'unknown');

      this.emitEvent({
        type: 'playback_started',
        messageId: this.currentMessageId || 'unknown',
        timestamp: Date.now()
      });

      this.notifyStateChange();
      await this.processAudioQueue();

    } catch (error) {
      this.isPlaying = false;
      audioLogger.error('audio', 'playback_start_failed', error as Error);
      this.notifyStateChange();
      throw error;
    }
  }

  /**
   * Process audio queue
   */
  private async processAudioQueue(): Promise<void> {
    while (this.audioQueue.length > 0 && this.isPlaying) {
      const chunk = this.audioQueue.shift()!;

      try {
        await this.playAudioChunk(chunk);
        chunk.processed = true;
      } catch (error) {
        audioLogger.error('audio', 'chunk_playback_failed', error as Error, {
          chunkId: chunk.id,
          messageId: chunk.messageId
        });

        this.emitEvent({
          type: 'playback_error',
          messageId: chunk.messageId,
          timestamp: Date.now(),
          metadata: {
            chunkId: chunk.id,
            error: (error as Error).message
          }
        });
      }
    }

    // Playback finished
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;

      audioLogger.audioPlayback('ended', this.currentMessageId || 'unknown');

      this.emitEvent({
        type: 'playback_ended',
        messageId: this.currentMessageId || 'unknown',
        timestamp: Date.now()
      });

      this.notifyStateChange();
    }
  }

  /**
   * Play individual audio chunk
   */
  private async playAudioChunk(chunk: AudioChunk): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    const audioBuffer = await this.audioContext.decodeAudioData(chunk.data.slice(0));
    const source = this.audioContext.createBufferSource();

    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    return new Promise((resolve, reject) => {
      source.onended = () => {
        this.totalPlaybackTime += audioBuffer.duration;
        resolve();
      };

      // AudioBufferSourceNode doesn't have onerror, handle errors in try/catch

      try {
        source.start();
        this.currentAudioSource = source;
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop all audio playback
   */
  public stopPlayback(): void {
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
        this.currentAudioSource.disconnect();
      } catch (error) {
        console.log('error in stopPlayback, error: ', error)
        // Ignore errors from stopping already-stopped sources
      }
      this.currentAudioSource = null;
    }

    this.isPlaying = false;
    this.audioQueue = [];

    audioLogger.audioPlayback('ended', this.currentMessageId || 'unknown', { forced: true });
    this.notifyStateChange();
  }

  /**
   * Clear all state
   */
  public clearAll(): void {
    console.log('[END_SESSION_FLOW] 🎯 14. AudioService.clearAll() called');
    console.log('[END_SESSION_FLOW] 📊 Audio state before clear:', {
      isPlaying: this.isPlaying,
      queueLength: this.audioQueue.length,
      currentMessageId: this.currentMessageId,
      totalChunksProcessed: this.totalChunksProcessed
    });
    
    this.stopPlayback();
    this.messages.clear();
    this.currentMessageId = null;
    this.totalChunksProcessed = 0;
    this.totalPlaybackTime = 0;
    this.lastProcessedChunk = 0;

    console.log('[END_SESSION_FLOW] ✅ 15. Audio service cleared completely');
    
    audioLogger.info('audio', 'service_cleared');
    this.notifyStateChange();
  }

  // Helper Methods

  private estimateAudioDuration(audioData: ArrayBuffer): number {
    // Estimate duration for PCM16 audio at 24kHz
    return (audioData.byteLength / 2 / 24000) * 1000; // milliseconds
  }

  private notifyStateChange(): void {
    const state = this.getState();
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        audioLogger.error('audio', 'state_listener_error', error as Error);
      }
    });
  }

  private emitEvent(event: AudioEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        audioLogger.error('audio', 'event_listener_error', error as Error);
      }
    });
  }

  // Diagnostic Methods

  public getDiagnostics(): Record<string, unknown> {
    return {
      state: this.getState(),
      messageCount: this.messages.size,
      queueLength: this.audioQueue.length,
      audioContextState: this.audioContext?.state || 'none',
      messages: Array.from(this.messages.entries()).map(([id, message]) => ({
        id,
        chunkCount: message.chunks.length,
        isComplete: message.isComplete,
        duration: message.completionTime ? message.completionTime - message.startTime : Date.now() - message.startTime
      }))
    };
  }
}

// Export singleton instance
const audioService = AudioServiceV15.getInstance();
export default audioService;