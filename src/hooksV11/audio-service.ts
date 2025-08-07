// src/hooksV11/audio-service.ts

// DO NOT import types from audio-cutoff-diagnostics to avoid conflicts

import audioLogger from './audio-logger';

/**
 * Standalone Audio Service
 * 
 * This service handles audio queue management and playback outside of React's
 * lifecycle, ensuring audio continues playing correctly regardless of component
 * remounts, re-renders, or unmounts.
 */

// We don't need to define these interfaces here
// They are already defined in audio-cutoff-diagnostics.ts

// Only extend Window interface with the properties that don't exist elsewhere
declare global {
  interface Window {
    __audioService?: AudioService;
    __audioBufferCount?: number;
    __hasStartedMessage?: boolean;
    __lastMessageId?: string;
    __currentResponseText?: string;
  }
}

// Define types
interface AudioChunkMetadata {
  id: string;
  received: number;
  size: number;
  status: string;
  messageId: string;
  bufferIndex: number;
  enqueued?: number;
  playStart?: number;
  playEnd?: number;
  playDuration?: number;
  errorTime?: number;
  errorDetails?: {
    timeElapsed: number;
    event: string;
  };
}

// Singleton instance
class AudioService {
  private static instance: AudioService;

  // Audio state
  private audioQueue: ArrayBuffer[] = [];
  private isPlaying: boolean = false;
  private pendingChunks: Set<string> = new Set();
  private receivedStopSignal: boolean = false;
  private audioContext: AudioContext | null = null;
  private currentAudioSource: AudioBufferSourceNode | null = null;
  private currentMessageId: string | null = null;

  // Timers and safeguards
  private audioCompletionTimer: NodeJS.Timeout | null = null;
  private timeoutSafetyTimer: NodeJS.Timeout | null = null;
  private lastBufferTime: number = 0;
  private audioFinalizationInProgress: boolean = false;

  // Chunk metadata tracking
  private chunkMetadata: Record<string, AudioChunkMetadata> = {};
  private protectedChunks: Set<string> = new Set();

  // Listeners
  private stateChangeListeners: Set<(state: AudioServiceState) => void> = new Set();

  // Prevent direct instantiation
  private constructor() {
    // Initialize global diagnostics state if in browser environment
    if (typeof window !== 'undefined') {
      // Store a reference to this service for diagnostics
      window.__audioService = this;

      // Initialize audio buffer timings for diagnostics
      if (!window.__audioBufferTimings) {
        window.__audioBufferTimings = {
          firstBufferTime: 0,
          lastBufferTime: 0,
          bufferIntervals: [],
          totalBuffers: 0,
          totalBufferSize: 0,
          bufferSizes: [],
          responseStartTime: Date.now()
        };
      }

      // Initialize audio playback timings for diagnostics
      if (!window.__audioPlaybackTimings) {
        window.__audioPlaybackTimings = {
          chunks: [],
          currentChunk: {} as Record<string, unknown>,
          playbackSuccessCount: 0,
          playbackErrorCount: 0,
          totalDuration: 0
        };
      }

      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.log('[AudioLogger] Audio service initialized');
      }
    }
  }

  /**
   * Get the singleton instance of AudioService
   */
  public static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  /**
   * Get current state of the audio service
   */
  public getState(): AudioServiceState {
    return {
      queueLength: this.audioQueue.length,
      isPlaying: this.isPlaying,
      pendingChunksCount: this.pendingChunks.size,
      receivedStopSignal: this.receivedStopSignal,
      currentMessageId: this.currentMessageId,
      lastBufferTime: this.lastBufferTime,
      audioContextState: this.audioContext?.state || 'closed'
    };
  }

  /**
   * Subscribe to state changes
   * @param callback Function to call when state changes
   * @returns Unsubscribe function
   */
  public subscribe(callback: (state: AudioServiceState) => void): () => void {
    this.stateChangeListeners.add(callback);
    // Initial state notification
    callback(this.getState());

    return () => {
      this.stateChangeListeners.delete(callback);
    };
  }

  /**
   * Create a new message session
   * @param messageId Unique ID for the message
   */
  public startNewMessage(messageId: string): void {
    this.currentMessageId = messageId;
    this.receivedStopSignal = false;

    // Log message start
    if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
      console.log(`[AudioLogger] Starting new message session: ${messageId}`);
    }

    // Update global timing diagnostics
    if (typeof window !== 'undefined' && window.__audioBufferTimings) {
      window.__audioBufferTimings.responseStartTime = Date.now();
    }

    this.notifyStateChange();
  }

  /**
   * Queue an audio buffer for playback
   * @param audioData Audio buffer to play
   * @param chunkId Unique ID for this chunk
   * @param messageId ID of the message this chunk belongs to
   */
  public queueAudioData(audioData: ArrayBuffer, chunkId: string, messageId: string): void {
    // Log enhanced details about each audio chunk for premature cutoff diagnostics
    if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
      console.log(`[AudioLogger] Received audio chunk ${chunkId} for message ${messageId}, size: ${audioData.byteLength} bytes`);
    }
    
    // Safety check - don't accept chunks for different messages if playback is in progress
    if (this.currentMessageId && this.currentMessageId !== messageId && this.isPlaying) {
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.warn(`[AudioLogger] Rejected audio chunk from different message during active playback`);
      }
      return;
    }

    // Set current message ID if not set
    if (!this.currentMessageId) {
      this.currentMessageId = messageId;
    }

    // Store the timestamp when this buffer was received
    const bufferReceivedTime = Date.now();
    this.lastBufferTime = bufferReceivedTime;

    // Update diagnostics
    this.updateBufferDiagnostics(audioData, bufferReceivedTime);

    // Create and track chunk metadata
    const bufferSize = audioData.byteLength;
    const bufferIndex = window.__audioBufferTimings?.totalBuffers || 0;

    // Create metadata record for this chunk
    this.chunkMetadata[chunkId] = {
      id: chunkId,
      received: bufferReceivedTime,
      size: bufferSize,
      status: 'received',
      messageId,
      bufferIndex
    };

    // Mark this chunk as part of the protected set for the current message
    this.protectedChunks.add(chunkId);

    // Update chunk lifecycle tracking for diagnostics
    if (typeof window !== 'undefined' && !window.__audioChunkLifecycle) {
      window.__audioChunkLifecycle = {};
    }

    if (typeof window !== 'undefined' && window.__audioChunkLifecycle) {
      window.__audioChunkLifecycle[chunkId] = {
        received: bufferReceivedTime,
        size: bufferSize,
        status: 'received',
        msgId: messageId,
        bufferIndex
      };
    }

    // Attach chunk ID to the buffer for tracking
    (audioData as { __chunkId?: string }).__chunkId = chunkId;

    // Update chunk metadata
    this.chunkMetadata[chunkId].enqueued = Date.now();
    this.chunkMetadata[chunkId].status = 'queued';

    // Update global diagnostics
    if (typeof window !== 'undefined' && window.__audioChunkLifecycle && window.__audioChunkLifecycle[chunkId]) {
      window.__audioChunkLifecycle[chunkId].enqueued = Date.now();
      window.__audioChunkLifecycle[chunkId].status = 'queued';
      // Add queue position as a custom property since it's not in the interface
      // Cast to unknown first to avoid TypeScript errors
      const chunkObj = window.__audioChunkLifecycle[chunkId] as unknown;
      (chunkObj as Record<string, number>).queuePosition = this.audioQueue.length;
    }

    // Add to queue
    this.audioQueue.push(audioData);

    // Log queue state for diagnostics
    audioLogger.logQueueState(this.audioQueue.length, this.isPlaying);

    // Start playback if not already playing
    if (!this.isPlaying && !this.audioFinalizationInProgress) {
      this.playNextInQueue();
    }

    // Notify state change
    this.notifyStateChange();
  }

  /**
   * Signal that audio output has stopped (from server)
   * @param messageId The message ID this stop signal belongs to
   */
  public handleStopSignal(messageId: string): void {
    // Enhanced logging for premature cutoff diagnostics
    const now = Date.now();
    
    if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
      console.log(`[AudioLogger] Received stop signal for message: ${messageId} at ${new Date(now).toISOString()}`);
      console.log(`[AudioLogger] Current state - Queue length: ${this.audioQueue.length}, Pending chunks: ${this.pendingChunks.size}, Is playing: ${this.isPlaying}`);
    }
    
    // Only process stop signal for the current message
    if (this.currentMessageId !== messageId) {
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.warn(`[AudioLogger] Ignoring stop signal for non-current message: ${messageId}`);
      }
      return;
    }

    if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
      console.log(`[AudioLogger] Received stop signal for message: ${messageId}`);
    }

    // Check for premature stop signal
    const timeSinceLastBuffer = Date.now() - this.lastBufferTime;

    // Record stop signal timing for diagnostics
    if (typeof window !== 'undefined' && window.__audioBufferTimings) {
      window.__audioBufferTimings.stopSignalTime = Date.now();
      window.__audioBufferTimings.stopSignalMsgId = messageId;
    }

    // Log stop event
    audioLogger.logCompletionEvent(
      'output_stopped',
      this.audioQueue.length,
      this.isPlaying,
      `Audio playback reported as completed with ${this.audioQueue.length} chunks remaining`
    );

    // Check if this could be a premature stop
    if (timeSinceLastBuffer < 500 && (this.isPlaying || this.audioQueue.length > 0)) {
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.warn(`[AudioLogger] Potential premature stop detected - buffer time: ${timeSinceLastBuffer}ms`);
      }

      if (typeof window !== 'undefined' && !window.__prematureStopSignals) {
        window.__prematureStopSignals = [];
      }

      if (typeof window !== 'undefined' && window.__prematureStopSignals) {
        window.__prematureStopSignals.push({
          timestamp: Date.now(),
          msgId: messageId,
          timeSinceLastBuffer,
          queueLength: this.audioQueue.length,
          pendingChunks: this.pendingChunks.size,
          isPlaying: this.isPlaying,
          bufferCount: window.__audioBufferTimings?.totalBuffers || 0,
          responseText: window.__currentResponseText || '',
          responseLength: (window.__currentResponseText || '').length
        });
      }
    }

    // Mark that we've received the stop signal
    this.receivedStopSignal = true;

    // Use a delayed finalization to ensure any late buffers are processed
    // Clear any existing timer first
    if (this.audioCompletionTimer) {
      clearTimeout(this.audioCompletionTimer);
    }

    // Set a completion verification timer with buffer time
    this.audioCompletionTimer = setTimeout(() => {
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.log(`[AudioLogger] Stop signal verification timer expired`);
      }

      // Check if we need to finalize or continue playback
      if (this.pendingChunks.size === 0 && this.audioQueue.length === 0) {
        // No pending chunks and queue is empty - normal completion
        if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
          console.log(`[AudioLogger] Normal completion - finalizing playback`);
        }
        this.finalizeAudioPlayback();
      } else {
        // We still have pending chunks or queued audio - continue playback
        const totalRemainingChunks = this.pendingChunks.size + this.audioQueue.length;
        if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
          console.log(`[AudioLogger] Continuing playback of ${totalRemainingChunks} remaining chunks despite stop signal`);
        }

        // Log this special case
        audioLogger.logCompletionEvent(
          'continuing_after_stop',
          totalRemainingChunks,
          this.isPlaying,
          'Continuing playback of remaining chunks despite stop signal'
        );

        // Don't finalize yet - playback will continue
      }

      this.audioCompletionTimer = null;
    }, 500); // 500ms buffer time to allow for late arriving chunks

    this.notifyStateChange();
  }

  /**
   * Clear the audio queue with safety checks
   * @param force Force clearing even if playing
   * @returns True if queue was cleared, false if clearing was prevented
   */
  public clearAudioQueue(force: boolean = false): boolean {
    if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
      console.log(`[AudioLogger] Clear audio queue requested (force=${force})`);
    }

    // Safety check - don't clear if we're playing and haven't received stop signal
    if (this.isPlaying && !this.receivedStopSignal && !force) {
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.warn(`[AudioLogger] Prevented clearing audio queue while playing without stop signal`);
      }
      return false;
    }

    // Safety check - don't clear if we have protected chunks and force isn't set
    const hasProtectedChunks = this.protectedChunks.size > 0;
    if (hasProtectedChunks && !force) {
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.warn(`[AudioLogger] Prevented clearing audio queue with ${this.protectedChunks.size} protected chunks`);
      }
      return false;
    }

    // Log before clearing
    audioLogger.logQueueState(this.audioQueue.length, this.isPlaying);
    audioLogger.logCompletionEvent(
      'clear_queue',
      this.audioQueue.length,
      this.isPlaying,
      'Clearing entire audio queue'
    );

    // Clear the queue
    this.audioQueue = [];

    // Stop and clean up current playback if needed
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.onended = null; // Remove onended handler
        this.currentAudioSource.stop();
        this.currentAudioSource.disconnect();
        this.currentAudioSource = null;
      } catch (error) {
        console.error('[AUDIO-SERVICE] Error stopping current audio source:', error);
      }
    }

    // Only reset playing state if we're doing a complete clear
    if (force) {
      this.isPlaying = false;
    }

    this.notifyStateChange();
    return true;
  }

  /**
   * Play the next audio buffer in the queue
   */
  private playNextInQueue(): void {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;

      // Enhanced logging for empty queue situations
      if (typeof window !== 'undefined') {
        if (!window.__emptyQueueTimings) {
          window.__emptyQueueTimings = {
            emptyCount: 0,
            timestamps: [],
            pendingChunksAtEmpty: []
          };
        }

        if (window.__emptyQueueTimings) {
          window.__emptyQueueTimings.emptyCount++;
          window.__emptyQueueTimings.timestamps.push(Date.now());
          window.__emptyQueueTimings.pendingChunksAtEmpty.push(this.pendingChunks.size);
        }
      }

      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.log(`[AUDIO-SERVICE] Queue is empty, playback paused. Pending chunks: ${this.pendingChunks.size}`);
      }

      // Check if this could be the end of playback
      if (this.pendingChunks.size === 0) {
        // If we've received the stop signal, this is normal completion
        if (this.receivedStopSignal) {
          if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
            console.log(`[AUDIO-SERVICE] Normal completion - no pending chunks, finalizing playback`);
          }

          // Normal completion - finalize playback after a short delay
          setTimeout(() => {
            this.finalizeAudioPlayback();
          }, 100);
        } else {
          // No stop signal but queue is empty - could be a gap or premature cutoff
          if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
            console.warn(`[AUDIO-SERVICE] Queue empty but no stop signal received. Possible gap or premature cutoff.`);

            // Track when the last buffer was received vs this empty queue event
            const timeSinceLastBuffer = Date.now() - this.lastBufferTime;
            console.warn(`[AUDIO-SERVICE] Time since last buffer received: ${timeSinceLastBuffer}ms`);
          }

          // Calculate timeSinceLastBuffer for both paths
          const timeSinceLastBuffer = Date.now() - this.lastBufferTime;

          // If it's been less than 500ms since the last buffer, this could be a gap
          if (timeSinceLastBuffer < 500) {
            if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
              console.warn(`[AUDIO-SERVICE] Short gap detected between audio chunks (${timeSinceLastBuffer}ms). Waiting for more chunks.`);
            }

            // Don't finalize yet - wait for more chunks or the stop signal
          } else if (timeSinceLastBuffer > 2000) {
            // It's been a while since the last buffer - might be the end
            if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
              console.warn(`[AUDIO-SERVICE] Long gap (${timeSinceLastBuffer}ms) with no stop signal. Considering playback complete.`);
            }

            // Log the abnormal completion
            audioLogger.logCompletionEvent(
              'timeout_completion',
              0,
              false,
              `Timeout completion after ${timeSinceLastBuffer}ms without stop signal`
            );

            // Finalize playback after this long gap
            this.finalizeAudioPlayback();
          }
        }
      }

      this.notifyStateChange();
      return;
    }

    this.isPlaying = true;
    const audioData = this.audioQueue.shift()!;

    // Retrieve any chunk ID that might be attached to this buffer
    const chunkId = (audioData as { __chunkId?: string })?.__chunkId || `unknown-${Date.now()}`;

    // Create an AudioContext if it doesn't exist
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.log(`[AUDIO-SERVICE] Created new AudioContext with sample rate: ${this.audioContext.sampleRate}Hz`);
      }

      // Log audio context state
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.log(`[AUDIO-SERVICE] Initial AudioContext state: ${this.audioContext.state}`);
      }

      // Track audio context state changes
      this.audioContext.addEventListener('statechange', () => {
        if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
          console.log(`[AUDIO-SERVICE] AudioContext state changed to: ${this.audioContext?.state}`);
        }
        audioLogger.logAudioContextState(this.audioContext?.state || 'unknown');
      });
    }

    try {
      // Internal tracking ID backup
      const trackingId = chunkId;

      // Track this chunk as pending
      this.pendingChunks.add(trackingId);

      // Track the start of playback in the lifecycle
      this.chunkMetadata[chunkId] = {
        ...this.chunkMetadata[chunkId],
        playStart: Date.now(),
        status: 'playing'
      };

      // Update global chunk lifecycle state for diagnostics
      if (typeof window !== 'undefined' && window.__audioChunkLifecycle && window.__audioChunkLifecycle[chunkId]) {
        window.__audioChunkLifecycle[chunkId].playStart = Date.now();
        window.__audioChunkLifecycle[chunkId].status = 'playing';

        // Calculate time from queuing to playing
        const queueToPlayTime = window.__audioChunkLifecycle[chunkId].playStart -
          (window.__audioChunkLifecycle[chunkId].enqueued || 0);
        if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
          console.log(`[AUDIO-SERVICE] Buffer took ${queueToPlayTime}ms to start playing after queuing`);
        }
      }

      // Update global playback timing state for diagnostics
      if (typeof window !== 'undefined') {
        if (!window.__audioPlaybackTimings) {
          window.__audioPlaybackTimings = {
            chunks: [],
            currentChunk: {} as Record<string, unknown>,
            playbackSuccessCount: 0,
            playbackErrorCount: 0,
            totalDuration: 0
          };
        }

        // Record start time for performance metrics
        const startTime = Date.now();

        // Set current chunk
        if (window.__audioPlaybackTimings) {
          window.__audioPlaybackTimings.currentChunk = {
            id: chunkId,
            startTime,
            size: audioData.byteLength,
            status: 'processing'
          };
        }
      }

      // Helper function to convert PCM16 to Float32
      const convertPCM16ToFloat32 = (buffer: ArrayBuffer): Float32Array => {
        const intView = new Int16Array(buffer);
        const floatView = new Float32Array(intView.length);
        for (let i = 0; i < intView.length; i++) {
          floatView[i] = intView[i] / 32768;
        }
        return floatView;
      };

      // Convert the buffer to the correct format
      const audioCtx = this.audioContext;
      const floatArray = convertPCM16ToFloat32(audioData);
      const audioBuffer = audioCtx.createBuffer(1, floatArray.length, audioCtx.sampleRate);
      audioBuffer.getChannelData(0).set(floatArray);

      // Calculate and track duration for this chunk
      const durationSeconds = audioBuffer.duration;
      const durationMs = durationSeconds * 1000;

      // Update global playback timing
      if (typeof window !== 'undefined' && window.__audioPlaybackTimings && window.__audioPlaybackTimings.currentChunk) {
        window.__audioPlaybackTimings.currentChunk.durationMs = durationMs;
        window.__audioPlaybackTimings.totalDuration += durationMs;
      }

      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.log(`[AUDIO-SERVICE] Preparing buffer: ${audioBuffer.length} samples, ${durationSeconds.toFixed(3)}s duration`);
      }

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);

      // Store the current source for potential interruption
      this.currentAudioSource = source;

      // Update global chunk status
      if (typeof window !== 'undefined' && window.__audioPlaybackTimings && window.__audioPlaybackTimings.currentChunk) {
        window.__audioPlaybackTimings.currentChunk.status = 'playing';
        window.__audioPlaybackTimings.currentChunk.playStart = Date.now();
      }

      // Use a variable to capture start time for consistent reference
      const startTimeCapture = Date.now();
      
      // When this chunk finishes, mark as complete and play the next one
      source.onended = () => {
        // Track performance for this chunk with enhanced precision timing
        const playbackEndTime = Date.now();
        const highPrecisionEndTime = typeof performance !== 'undefined' ? performance.now() : playbackEndTime;
        
        // Store current audio element state for precise diagnostics
        const audioElementState = {
          contextTimeAtEnd: this.audioContext?.currentTime || 0,
          contextState: this.audioContext?.state || 'unknown',
          bufferLength: audioBuffer.length,
          bufferDuration: audioBuffer.duration,
          pendingChunksCount: this.pendingChunks.size,
          queueLength: this.audioQueue.length,
          wasAborted: false, // Will be set to true if aborted
          hadUserInteraction: false, // Will be set if user interacted
          stateAtCompletion: document.visibilityState
        };

        // Log detailed audio completion event with precise timing
        if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
          console.log(`[AUDIO-PREMATURE-CUTOFF-DIAG] Audio chunk ${chunkId} ended at ${new Date().toISOString()}`);
          console.log(`[AUDIO-PREMATURE-CUTOFF-DIAG] Expected duration: ${durationMs.toFixed(2)}ms, Buffer size: ${audioData.byteLength} bytes`);
        }
        
        // Calculate actual duration with high precision
        const actualStartTime = this.chunkMetadata[chunkId]?.playStart || startTimeCapture;
        const highPrecisionStartTime = typeof window !== 'undefined' && 
          (window.__audioPlaybackTimings?.currentChunk as { highPrecisionStart?: number })?.highPrecisionStart || actualStartTime;
        const actualDuration = playbackEndTime - actualStartTime;
        const highPrecisionDuration = typeof highPrecisionEndTime === 'number' && typeof highPrecisionStartTime === 'number' ? 
          highPrecisionEndTime - highPrecisionStartTime : 
          actualDuration;
        
        if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
          console.log(`[AUDIO-PREMATURE-CUTOFF-DIAG] Actual duration: ${actualDuration.toFixed(2)}ms (high precision: ${highPrecisionDuration.toFixed(3)}ms)`);
          console.log(`[AUDIO-PREMATURE-CUTOFF-DIAG] Audio context state: ${audioElementState.contextState}, Queue length: ${audioElementState.queueLength}`);
        }

        // Update chunk metadata with enhanced diagnostics
        this.chunkMetadata[chunkId] = {
          ...this.chunkMetadata[chunkId],
          playEnd: playbackEndTime,
          status: 'completed',
          playDuration: actualDuration
        };

        // Remove from protected chunks since it's been played
        this.protectedChunks.delete(chunkId);

        // Update global chunk lifecycle tracking with enhanced diagnostics
        if (typeof window !== 'undefined' && window.__audioChunkLifecycle && window.__audioChunkLifecycle[chunkId]) {
          window.__audioChunkLifecycle[chunkId].playEnd = playbackEndTime;
          window.__audioChunkLifecycle[chunkId].status = 'completed';
          window.__audioChunkLifecycle[chunkId].playDuration = actualDuration;
          
          // Add enhanced diagnostic data
          const chunkObj = window.__audioChunkLifecycle[chunkId] as unknown;
          (chunkObj as Record<string, unknown>).audioElementState = audioElementState;
          (chunkObj as Record<string, unknown>).highPrecisionEndTime = highPrecisionEndTime;
          (chunkObj as Record<string, unknown>).highPrecisionDuration = highPrecisionDuration;
        }

        // Update global playback timing with enhanced diagnostics
        if (typeof window !== 'undefined' && window.__audioPlaybackTimings && window.__audioPlaybackTimings.currentChunk) {
          // Calculate actual vs expected duration
          const expectedDuration = durationMs;
          const durationRatio = actualDuration / expectedDuration;

          // Update current chunk status with enhanced diagnostics
          window.__audioPlaybackTimings.currentChunk.status = 'complete';
          window.__audioPlaybackTimings.currentChunk.endTime = playbackEndTime;
          window.__audioPlaybackTimings.currentChunk.actualDuration = actualDuration;
          window.__audioPlaybackTimings.currentChunk.durationRatio = durationRatio;
          
          // Add high precision timing data
          const currentChunkObj = window.__audioPlaybackTimings.currentChunk as Record<string, unknown>;
          currentChunkObj.highPrecisionEndTime = highPrecisionEndTime;
          currentChunkObj.highPrecisionDuration = highPrecisionDuration;
          currentChunkObj.audioElementState = audioElementState;
          
          // Check for premature cutoff with precise timing
          const isCutOffPremature = durationRatio < 0.95;

          // Add to chunks history
          window.__audioPlaybackTimings.chunks.push({
            ...window.__audioPlaybackTimings.currentChunk
          });
          window.__audioPlaybackTimings.playbackSuccessCount++;

          // Log premature cutoff with detailed diagnostics
          if (isCutOffPremature) {
            if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
              console.warn(`[AUDIO-PREMATURE-CUTOFF-DETECTED] Playback cut off prematurely: expected ${expectedDuration.toFixed(0)}ms, actual ${actualDuration.toFixed(0)}ms, ratio ${durationRatio.toFixed(3)}`);
            }
            
            // Add to global tracking for analysis
            if (!(window as unknown as { __prematureCutoffs?: Record<string, unknown>[] }).__prematureCutoffs) {
              (window as unknown as { __prematureCutoffs: Record<string, unknown>[] }).__prematureCutoffs = [];
            }
            
            const cutoffEvent = {
              timestamp: playbackEndTime,
              timestampISO: new Date(playbackEndTime).toISOString(),
              chunkId: chunkId,
              messageId: this.currentMessageId,
              expectedDuration,
              actualDuration,
              durationRatio,
              highPrecisionDuration,
              audioElementState,
              contextTime: this.audioContext?.currentTime,
              contextSampleRate: this.audioContext?.sampleRate,
              bufferSize: audioData.byteLength,
              pendingChunksCount: this.pendingChunks.size,
              queueState: {
                length: this.audioQueue.length,
                hasMoreChunks: this.audioQueue.length > 0,
                receivedStopSignal: this.receivedStopSignal
              },
              visibilityState: document.visibilityState,
              networkState: window.navigator.onLine ? 'online' : 'offline',
              memoryInfo: performance && 'memory' in performance ? {
                usedJSHeapSize: (performance as unknown as { memory: { usedJSHeapSize: number, totalJSHeapSize: number } }).memory.usedJSHeapSize,
                totalJSHeapSize: (performance as unknown as { memory: { usedJSHeapSize: number, totalJSHeapSize: number } }).memory.totalJSHeapSize
              } : undefined
            };
            
            (window as unknown as { __prematureCutoffs: Record<string, unknown>[] }).__prematureCutoffs.push(cutoffEvent);
            
            // Log to audio logger for persistence
            audioLogger.logDiagnostic('audio-premature-cutoff-detected', cutoffEvent);
          } else if (durationRatio < 0.98 || durationRatio > 1.02) {
            // Log minor duration anomalies for analysis
            if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
              console.warn(`[AUDIO-SERVICE] Playback duration anomaly: expected ${expectedDuration.toFixed(0)}ms, actual ${actualDuration.toFixed(0)}ms, ratio ${durationRatio.toFixed(3)}`);
            }
          }
        }

        // Remove this chunk from pending list
        this.pendingChunks.delete(chunkId);
        if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
          console.log(`[AUDIO-SERVICE] Finished playing chunk ${chunkId}, ${this.pendingChunks.size} chunks still pending, queue: ${this.audioQueue.length}`);
        }

        // Clean up this source
        this.currentAudioSource = null;
        source.disconnect();

        // Play next if available
        if (this.audioQueue.length > 0) {
          this.playNextInQueue();
        } else if (this.pendingChunks.size === 0 && this.receivedStopSignal) {
          // This was the last chunk and we've received stop signal - normal completion
          if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
            console.log(`[AUDIO-SERVICE] All chunks played and stop signal received. Finalizing playback.`);
          }
          this.finalizeAudioPlayback();
        } else if (this.pendingChunks.size === 0) {
          // Queue is empty but no stop signal - might be waiting for more chunks
          if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
            console.log(`[AUDIO-SERVICE] Queue empty but no stop signal. Waiting for more chunks...`);
          }

          // Start a safety timeout in case no more chunks arrive
          this.startSafetyTimeout();
        }

        this.notifyStateChange();
      };

      // Handle errors - using event listener since onerror isn't in TypeScript definitions
      source.addEventListener('error', (event) => {
        if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
          console.error(`[AUDIO-SERVICE] Audio source error for chunk ${chunkId}:`, event);
        }

        // Update chunk status
        this.chunkMetadata[chunkId] = {
          ...this.chunkMetadata[chunkId],
          status: 'error',
          errorTime: Date.now(),
          errorDetails: {
            timeElapsed: Date.now() - (this.chunkMetadata[chunkId].playStart || startTimeCapture),
            event: 'onerror'
          }
        };

        // Update global error tracking
        if (typeof window !== 'undefined' && window.__audioPlaybackTimings && window.__audioPlaybackTimings.currentChunk) {
          window.__audioPlaybackTimings.currentChunk.status = 'error';
          window.__audioPlaybackTimings.currentChunk.errorTime = Date.now();
          window.__audioPlaybackTimings.currentChunk.errorDetails = {
            timeElapsed: Date.now() - startTimeCapture
          };

          // Add to chunks history
          window.__audioPlaybackTimings.chunks.push({
            ...window.__audioPlaybackTimings.currentChunk
          });
          window.__audioPlaybackTimings.playbackErrorCount++;
        }

        // Remove from protected chunks since it errored
        this.protectedChunks.delete(chunkId);

        // Update global chunk lifecycle tracking
        if (typeof window !== 'undefined' && window.__audioChunkLifecycle && window.__audioChunkLifecycle[chunkId]) {
          window.__audioChunkLifecycle[chunkId].errorTime = Date.now();
          window.__audioChunkLifecycle[chunkId].status = 'error';
          (window as unknown as { 
            __audioChunkLifecycle: Record<string, { 
              errorDetails?: { timeElapsed: number, event: string },
              playStart?: number
            }>
          }).__audioChunkLifecycle[chunkId].errorDetails = {
            timeElapsed: Date.now() -
              ((window as unknown as { 
                __audioChunkLifecycle: Record<string, { playStart?: number }>
              }).__audioChunkLifecycle[chunkId].playStart || startTimeCapture),
            event: 'onerror'
          };
        }

        this.pendingChunks.delete(chunkId); // Still mark as complete to avoid hanging

        // Continue to next chunk on error
        setTimeout(() => this.playNextInQueue(), 0);
      });

      // Start playback
      source.start(0);

      // Start safety timeout
      this.startSafetyTimeout();

      // Notify state change
      this.notifyStateChange();
    } catch (error) {
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.error(`[AUDIO-SERVICE] Error playing audio chunk ${chunkId}:`, error);
      }

      // Remove this chunk from pending
      this.pendingChunks.delete(chunkId);
      this.protectedChunks.delete(chunkId);

      // Update error status
      this.chunkMetadata[chunkId] = {
        ...this.chunkMetadata[chunkId],
        status: 'error',
        errorTime: Date.now(),
        errorDetails: {
          timeElapsed: 0,
          event: 'exception'
        }
      };

      // Continue to next chunk
      setTimeout(() => this.playNextInQueue(), 0);
    }
  }

  /**
   * Finalize audio playback with complete cleanup
   */
  private finalizeAudioPlayback(): void {
    // Enhanced diagnostic logging for premature cutoff analysis
    const now = Date.now();
    const highPrecisionTimestamp = typeof performance !== 'undefined' ? performance.now() : now;
    const audioState = {
      queueEmpty: this.audioQueue.length === 0,
      pendingChunks: this.pendingChunks.size,
      isPlaying: this.isPlaying,
      receivedStopSignal: this.receivedStopSignal,
      timeSinceLastBuffer: now - this.lastBufferTime,
      lastBufferTime: this.lastBufferTime,
      lastBufferTimeISO: new Date(this.lastBufferTime).toISOString(),
      currentTime: now,
      currentTimeISO: new Date(now).toISOString(),
      highPrecisionTimestamp,
      audioContextState: this.audioContext?.state || 'unknown',
      audioContextCurrentTime: this.audioContext?.currentTime || 0,
      currentMessageId: this.currentMessageId,
      visibilityState: document.visibilityState,
      audioFinalizationInProgress: this.audioFinalizationInProgress,
      totalChunksTracked: Object.keys(this.chunkMetadata).length,
      completedChunksCount: Object.values(this.chunkMetadata).filter(chunk => chunk.status === 'completed').length,
      errorChunksCount: Object.values(this.chunkMetadata).filter(chunk => chunk.status === 'error').length
    };
    
    if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
      console.log(`[AUDIO-PREMATURE-CUTOFF-DIAG] Finalizing audio playback at ${new Date(now).toISOString()}`);
      console.log(`[AUDIO-PREMATURE-CUTOFF-DIAG] Audio state:`, audioState);
    }
    
    // Save complete diagnostic state for future analysis
    if (typeof window !== 'undefined') {
      if (!(window as unknown as { __audioFinalizationState?: Record<string, unknown>[] }).__audioFinalizationState) {
        (window as unknown as { __audioFinalizationState: Record<string, unknown>[] }).__audioFinalizationState = [];
      }
      
      (window as unknown as { __audioFinalizationState: Record<string, unknown>[] }).__audioFinalizationState.push(audioState);
    }
    
    // Prevent multiple finalization
    if (this.audioFinalizationInProgress) {
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.log(`[AUDIO-SERVICE] Finalization already in progress - skipping`);
      }
      return;
    }

    this.audioFinalizationInProgress = true;

    // Log normal completion with enhanced data
    audioLogger.logCompletionEvent(
      'normal_completion',
      0,
      this.isPlaying,
      'Normal completion - no pending chunks'
    );
    
    // Also log to diagnostic system for detailed analysis
    audioLogger.logDiagnostic('audio-finalization-complete', audioState);

    // Clean up state
    this.clearSafetyTimeout();
    this.clearAudioCompletionTimer();

    // Reset state for next playback
    this.isPlaying = false;
    this.receivedStopSignal = false;
    this.audioQueue = [];
    this.pendingChunks.clear();
    this.protectedChunks.clear();

    // Delayed reset of message ID to allow UI to update
    setTimeout(() => {
      // Keep a reference to complete the handoff
      const completedMessageId = this.currentMessageId;

      // Reset message ID
      this.currentMessageId = null;

      // Reset finalization flag
      this.audioFinalizationInProgress = false;

      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.log(`[AUDIO-SERVICE] Finalized playback for message: ${completedMessageId}`);
      }

      // Notify state change
      this.notifyStateChange();
    }, 500);

    // Notify state change for initial updates
    this.notifyStateChange();
  }

  /**
   * Start a safety timeout to detect stalled audio
   */
  private startSafetyTimeout(): void {
    // Clear any existing timer
    this.clearSafetyTimeout();

    // Set a new timer
    this.timeoutSafetyTimer = setTimeout(() => {
      // Check if we're still playing or waiting
      if (this.isPlaying || this.pendingChunks.size > 0) {
        if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
          console.warn(`[AUDIO-SERVICE] Safety timeout reached with pending chunks`);
        }

        // Check if we've received stop signal
        if (this.receivedStopSignal) {
          if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
            console.warn(`[AUDIO-SERVICE] Stop signal received but playback hasn't completed - forcing finalization`);
          }

          // Force finalization
          this.finalizeAudioPlayback();
        } else {
          if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
            console.warn(`[AUDIO-SERVICE] No stop signal received but playback seems stalled - continuing to wait`);
          }

          // Restart the timer
          this.startSafetyTimeout();
        }
      } else if (this.audioQueue.length === 0 && this.pendingChunks.size === 0) {
        const timeSinceLastBuffer = Date.now() - this.lastBufferTime;

        if (timeSinceLastBuffer > 2000 && !this.receivedStopSignal) {
          if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
            console.warn(`[AUDIO-SERVICE] No activity for ${timeSinceLastBuffer}ms and queue empty - assuming playback complete`);
          }

          // Log safety timeout completion
          audioLogger.logCompletionEvent(
            'safety_timeout',
            this.audioQueue.length,
            this.isPlaying,
            `Safety timeout after ${timeSinceLastBuffer}ms of inactivity`
          );

          // Force finalization
          this.finalizeAudioPlayback();
        }
      }

      this.timeoutSafetyTimer = null;
    }, 5000); // 5 second safety timeout
  }

  /**
   * Clear the safety timeout
   */
  private clearSafetyTimeout(): void {
    if (this.timeoutSafetyTimer) {
      clearTimeout(this.timeoutSafetyTimer);
      this.timeoutSafetyTimer = null;
    }
  }

  /**
   * Clear the audio completion timer
   */
  private clearAudioCompletionTimer(): void {
    if (this.audioCompletionTimer) {
      clearTimeout(this.audioCompletionTimer);
      this.audioCompletionTimer = null;
    }
  }

  /**
   * Update buffer diagnostics for analytics
   */
  private updateBufferDiagnostics(audioData: ArrayBuffer, bufferReceivedTime: number): void {
    if (typeof window === 'undefined') return;

    const bufferSize = audioData.byteLength;

    // Update buffer timings
    if (!window.__audioBufferTimings) {
      window.__audioBufferTimings = {
        firstBufferTime: bufferReceivedTime,
        lastBufferTime: bufferReceivedTime,
        bufferIntervals: [],
        totalBuffers: 0,
        totalBufferSize: bufferSize,
        bufferSizes: [bufferSize],
        responseStartTime: bufferReceivedTime
      };
    } else {
      // Calculate interval from last buffer
      const interval = bufferReceivedTime - window.__audioBufferTimings.lastBufferTime;
      window.__audioBufferTimings.bufferIntervals.push(interval);
      window.__audioBufferTimings.lastBufferTime = bufferReceivedTime;

      // Initialize these properties if they're undefined
      if (window.__audioBufferTimings.totalBufferSize === undefined) {
        window.__audioBufferTimings.totalBufferSize = 0;
      }
      if (window.__audioBufferTimings.bufferSizes === undefined) {
        window.__audioBufferTimings.bufferSizes = [];
      }

      // Track buffer sizes
      window.__audioBufferTimings.totalBufferSize += bufferSize;
      window.__audioBufferTimings.bufferSizes.push(bufferSize);

      // Estimate duration for diagnostics
      const estimatedDurationMs = (bufferSize / 2 / 24000) * 1000;
      if (!window.__audioBufferTimings.expectedTotalDuration) {
        window.__audioBufferTimings.expectedTotalDuration = estimatedDurationMs;
      } else {
        window.__audioBufferTimings.expectedTotalDuration += estimatedDurationMs;
      }
    }

    if (window.__audioBufferTimings) {
      window.__audioBufferTimings.totalBuffers++;
      
      // Initialize these properties if they're undefined
      if (window.__audioBufferTimings.totalBufferSize === undefined) {
        window.__audioBufferTimings.totalBufferSize = 0;
      }
      if (window.__audioBufferTimings.bufferSizes === undefined) {
        window.__audioBufferTimings.bufferSizes = [];
      }
    }

    // Log chunk for audio logger
    audioLogger.logAudioChunk();
    audioLogger.logQueueState(this.audioQueue.length, this.isPlaying);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyStateChange(): void {
    const state = this.getState();
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('[AUDIO-SERVICE] Error in state change listener:', error);
      }
    });
  }
}

// Define state interface
export interface AudioServiceState {
  queueLength: number;
  isPlaying: boolean;
  pendingChunksCount: number;
  receivedStopSignal: boolean;
  currentMessageId: string | null;
  lastBufferTime: number;
  audioContextState: string;
}

// Export the singleton instance
export default AudioService.getInstance();