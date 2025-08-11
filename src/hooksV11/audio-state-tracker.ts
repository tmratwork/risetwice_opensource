// src/hooksV11/audio-state-tracker.ts

import audioLogger from './audio-logger';
import { ENABLE_AUDIO_CUTOFF_DIAGNOSTICS, DIAGNOSTICS_DETAIL_LEVEL, DIAGNOSTIC_OPTIONS } from './audio-cutoff-diagnostics';

/**
 * WebRTC Audio State Tracker
 * 
 * This utility provides direct real-time monitoring of WebRTC audio output stream
 * to detect actual audio playback state regardless of message state.
 * It uses the Web Audio API to analyze the stream and detect when audio is actually playing.
 */

export interface AudioStateTrackerOptions {
  silenceThreshold?: number;         // Threshold for silence detection (default: 5)
  consistentSilenceThreshold?: number; // Number of consecutive silent frames before considering audio inactive (default: 5)
  analysisInterval?: number;         // How often to analyze audio in ms (default: 50ms)
  noiseFloor?: number;               // Noise floor level (default: 5)
  label?: string;                    // Optional label for logging
  messageId?: string;                // Optional message ID for correlation
}

export interface AudioStateTracker {
  isAudioPlaying: () => boolean;
  dispose: () => void;
  getAudioLevel: () => number;
  getLastActiveTime: () => number;
  getTimeSinceLastActive: () => number;
  addStateChangeListener: (callback: (isPlaying: boolean) => void) => () => void;
}

/**
 * Create an audio state tracker that monitors WebRTC audio output in real-time
 * @param stream MediaStream from WebRTC to monitor
 * @param options Configuration options
 * @returns AudioStateTracker instance
 */
export function createAudioStateTracker(
  stream: MediaStream,
  options: AudioStateTrackerOptions = {}
): AudioStateTracker {
  // Configure options with defaults
  // Unused configurations from options - keeping for API compatibility
  // const silenceThreshold = options.silenceThreshold ?? 5;
  const consistentSilenceThreshold = options.consistentSilenceThreshold ?? 5;
  const analysisInterval = options.analysisInterval ?? 50;
  const noiseFloor = options.noiseFloor ?? 5;
  const label = options.label ?? 'webrtc-audio';
  const messageId = options.messageId;

  // Initialize audio context and analyzer
  const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(stream);
  const analyzer = audioContext.createAnalyser();
  
  // Configure analyzer
  analyzer.fftSize = 256;
  source.connect(analyzer);
  
  // Buffer to receive audio level data
  const dataArray = new Uint8Array(analyzer.frequencyBinCount);
  
  // Track audio state
  let isAudioActive = false;
  let silenceCounter = 0;
  let currentLevel = 0;
  let lastActiveTime = Date.now();
  const stateChangeListeners: Set<(isPlaying: boolean) => void> = new Set();
  
  // Setup interval for continuous monitoring
  const intervalId = setInterval(() => {
    // Get current audio levels
    analyzer.getByteFrequencyData(dataArray);
    
    // Calculate average level
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    currentLevel = average;
    
    // Determine if audio is active based on threshold
    const previousState = isAudioActive;
    
    if (average > noiseFloor) {
      // Audio detected
      if (!isAudioActive) {
        console.log(`[AUDIO-STATE-TRACKER] ${label}: Audio activity detected (level: ${average.toFixed(1)})`);
      }
      
      isAudioActive = true;
      silenceCounter = 0;
      lastActiveTime = Date.now();
      
      // Log audio activity (throttled)
      if (Math.random() < 0.05) { // Only log ~5% of active frames to avoid spam
        audioLogger.logUserInteraction('audio-activity-detected', {
          level: average,
          messageId,
          timestamp: Date.now()
        });
      }
    } else {
      // Silence detected - only consider inactive after consistent silence
      silenceCounter++;
      if (silenceCounter > consistentSilenceThreshold) {
        if (isAudioActive) {
          console.log(`[AUDIO-STATE-TRACKER] ${label}: Audio silence detected (${silenceCounter} consecutive frames below threshold)`);
          
          // Log silence
          audioLogger.logUserInteraction('audio-silence-detected', {
            consecutiveSilentFrames: silenceCounter,
            timeSinceLastActive: Date.now() - lastActiveTime,
            messageId,
            timestamp: Date.now()
          });
        }
        
        isAudioActive = false;
      }
    }
    
    // Notify listeners of state changes
    if (previousState !== isAudioActive) {
      stateChangeListeners.forEach(listener => {
        try {
          listener(isAudioActive);
        } catch (error) {
          console.error('[AUDIO-STATE-TRACKER] Error in state change listener:', error);
        }
      });
    }
  }, analysisInterval);
  
  // Return the public interface
  return {
    isAudioPlaying: () => isAudioActive,
    getAudioLevel: () => currentLevel,
    getLastActiveTime: () => lastActiveTime,
    getTimeSinceLastActive: () => Date.now() - lastActiveTime,
    
    addStateChangeListener: (callback: (isPlaying: boolean) => void) => {
      stateChangeListeners.add(callback);
      // Return unsubscribe function
      return () => {
        stateChangeListeners.delete(callback);
      };
    },
    
    dispose: () => {
      // Clean up resources
      clearInterval(intervalId);
      source.disconnect();
      audioContext.close().catch(err => {
        console.error('[AUDIO-STATE-TRACKER] Error closing audio context:', err);
      });
      stateChangeListeners.clear();
      
      console.log(`[AUDIO-STATE-TRACKER] ${label}: Disposed audio state tracker`);
    }
  };
}

/**
 * Create a promise that resolves when WebRTC audio playback is complete
 * @param webrtcStream MediaStream from WebRTC
 * @param options Optional configuration
 * @returns Promise that resolves when audio is complete
 */
export function createAudioCompletionPromise(
  webrtcStream: MediaStream,
  options: {
    messageId?: string;
    audioState?: Record<string, unknown>; // The audio service state
    maxWaitTime?: number;
    initialDelay?: number;
    checkInterval?: number;
    confirmationDelay?: number;
    label?: string;
  } = {}
): Promise<void> {
  const maxWaitTime = options.maxWaitTime ?? 10000;
  const initialDelay = options.initialDelay ?? 300;
  const checkInterval = options.checkInterval ?? 100;
  const confirmationDelay = options.confirmationDelay ?? 500;
  const label = options.label ?? 'webrtc-completion';
  const messageId = options.messageId;
  const audioState = options.audioState;
  
  console.log(`[AUDIO-COMPLETION] ${label}: Starting audio completion detector for ${messageId || 'unknown'}`);
  
  return new Promise<void>((resolve) => {
    // Create audio tracker that directly monitors WebRTC audio
    const audioTracker = createAudioStateTracker(webrtcStream, {
      label,
      messageId
    });
    
    // Variables for checking completion
    let completionCheckInterval: ReturnType<typeof setInterval> | null = null;
    let safetyTimeout: ReturnType<typeof setInterval> | null = null;
    let completionConfirmed = false;
    
    // Safety timeout to ensure we don't hang indefinitely
    safetyTimeout = setTimeout(() => {
      console.log(`[AUDIO-COMPLETION] ${label}: Safety timeout reached (${maxWaitTime}ms), resolving`);
      
      audioLogger.logCompletionEvent(
        'audio-safety-timeout',
        typeof audioState?.queueLength === 'number' ? audioState.queueLength : 0,
        typeof audioState?.isPlaying === 'boolean' ? audioState.isPlaying : false,
        `Audio completion safety timeout reached after ${maxWaitTime}ms`
      );
      
      cleanup();
      resolve();
    }, maxWaitTime);
    
    // Function to clean up resources
    const cleanup = () => {
      if (completionCheckInterval) {
        clearInterval(completionCheckInterval);
        completionCheckInterval = null;
      }
      
      if (safetyTimeout) {
        clearTimeout(safetyTimeout);
        safetyTimeout = null;
      }
      
      audioTracker.dispose();
    };
    
    // Initial delay to ensure we're correctly tracking
    setTimeout(() => {
      // Start checking for audio completion
      completionCheckInterval = setInterval(() => {
        // Check both: app state AND actual audio state
        const appStateComplete = 
          audioState?.queueLength === 0 && 
          audioState?.pendingChunksCount === 0 && 
          !audioState?.isPlaying;
          
        const audioInactive = !audioTracker.isAudioPlaying();
        const timeSinceLastActive = audioTracker.getTimeSinceLastActive();
        
        // Log current state periodically
        if (Math.random() < 0.1) { // ~10% of checks
          console.log(`[AUDIO-COMPLETION] ${label}: Checking completion - App state complete: ${appStateComplete}, Audio inactive: ${audioInactive}, Time since active: ${timeSinceLastActive}ms`);
        }
        
        // Check for completion conditions
        if (audioInactive && timeSinceLastActive > 200 && appStateComplete) {
          console.log(`[AUDIO-COMPLETION] ${label}: Audio appears to be complete, confirming...`);
          
          // Double-check after a short delay to confirm
          setTimeout(() => {
            if (!audioTracker.isAudioPlaying() && !completionConfirmed) {
              completionConfirmed = true; // Prevent duplicate confirmations
              
              console.log(`[AUDIO-COMPLETION] ${label}: Audio completion confirmed`);
              
              audioLogger.logCompletionEvent(
                'audio-completion-confirmed',
                typeof audioState?.queueLength === 'number' ? audioState.queueLength : 0,
                typeof audioState?.isPlaying === 'boolean' ? audioState.isPlaying : false,
                `Audio completion confirmed after ${timeSinceLastActive}ms of inactivity`
              );
              
              cleanup();
              resolve();
            } else {
              console.log(`[AUDIO-COMPLETION] ${label}: False audio completion detected, continuing to wait`);
            }
          }, confirmationDelay);
        }
      }, checkInterval);
    }, initialDelay);
  });
}

/**
 * Class to track WebRTC message playback synchronization with enhanced ID handling
 */
export class MessageTracker {
  private pendingMessages = new Map<string, {
    id: string;
    chunks: number;
    remainingChunks: number;
    startTime: number;
    isPlaying: boolean;
    lastChunkTime: number;
    alternateIds: Set<string>; // Store alternate IDs for the same message
  }>();
  
  private currentlyPlaying: string | null = null;
  private numericToStringIdMap = new Map<number, string>(); // Map numeric IDs to string IDs
  
  /**
   * Register a new message being processed
   * @param messageId Unique message ID
   * @param audioChunks Number of audio chunks expected
   */
  trackMessage(messageId: string, audioChunks: number): void {
    // First, check for bare numeric ID
    const numericId = parseInt(messageId, 10);
    const isNumericId = !isNaN(numericId);
    
    // Create a normalized version of the ID to handle various formats
    const normalizedId = this.normalizeMessageId(messageId);
    
    // Initialize alternate IDs set with all possible variations of the ID
    const alternateIds = new Set<string>();
    
    // Include original ID
    alternateIds.add(messageId);
    
    // Include normalized
    if (normalizedId !== messageId) {
      alternateIds.add(normalizedId);
    }
    
    // Include without prefix for better matching
    if (normalizedId.startsWith('webrtc-')) {
      alternateIds.add(normalizedId.substring(7));
    }
    
    // Handle numeric ID variants
    if (isNumericId) {
      // Map numeric to normalized ID
      this.numericToStringIdMap.set(numericId, normalizedId);
      
      // Include string versions of the number
      alternateIds.add(numericId.toString());
      
      // If the numeric ID is in scientific notation, also add regular form
      const scientificNotation = numericId.toExponential();
      if (scientificNotation.includes('e')) {
        alternateIds.add(scientificNotation);
      }
    }
    
    // Store the message data
    this.pendingMessages.set(normalizedId, {
      id: normalizedId,
      chunks: audioChunks,
      remainingChunks: audioChunks,
      startTime: Date.now(),
      isPlaying: false,
      lastChunkTime: Date.now(),
      alternateIds
    });
    
    console.log(`[MESSAGE-TRACKER] Tracking new message: ${messageId} (normalized: ${normalizedId})${isNumericId ? ` (numeric: ${numericId})` : ''} with ${audioChunks} chunks`);
    console.log(`[MESSAGE-TRACKER] Alternate IDs for ${normalizedId}: ${Array.from(alternateIds).join(', ')}`);
    
    // Log numeric mapping if present
    if (isNumericId) {
      console.log(`[MESSAGE-TRACKER] Mapped numeric ID ${numericId} to ${normalizedId}`);
    }
  }
  
  /**
   * Normalize a message ID to handle various formats
   * @param messageId Message ID to normalize
   * @returns Normalized message ID
   */
  private normalizeMessageId(messageId: string): string {
    // If it's already prefixed with 'webrtc-', return as is
    if (messageId.startsWith('webrtc-')) {
      return messageId;
    }
    
    // WebRTC typically sends numeric IDs as strings 
    // Try to parse as number for better handling
    const numericId = parseInt(messageId, 10);
    if (!isNaN(numericId)) {
      // Check if we have this numeric ID mapped to a string ID
      const mappedId = this.numericToStringIdMap.get(numericId);
      if (mappedId) {
        // Log this mapping for debugging
        if (Math.random() < 0.1) { // Only log ~10% to reduce noise
          console.log(`[MESSAGE-TRACKER] Normalized numeric ID ${numericId} to ${mappedId}`);
        }
        return mappedId;
      }
      
      // No existing mapping, but it's numeric
      // Store this numeric ID for future reference
      const normalizedId = `webrtc-${messageId}`;
      this.numericToStringIdMap.set(numericId, normalizedId);
      return normalizedId;
    }
    
    // For non-numeric IDs, prefix with 'webrtc-' for consistency 
    // unless it's already a complex ID format
    if (!messageId.includes('-')) {
      return `webrtc-${messageId}`;
    }
    
    // Otherwise, just ensure it's a string
    return messageId.toString();
  }
  
  /**
   * Find the normalized ID for a given message ID
   * @param messageId Message ID to resolve
   * @returns Normalized message ID or null if not found
   */
  private resolveMessageId(messageId: string): string | null {
    // First check log context
    const isLogDebug = Math.random() < 0.05; // Only log ~5% of resolution attempts to reduce noise
    
    // If we have this exact ID, return it
    if (this.pendingMessages.has(messageId)) {
      if (isLogDebug) console.log(`[MESSAGE-TRACKER] Resolved ${messageId} directly (exact match)`);
      return messageId;
    }
    
    // Parse as number for numeric comparison
    const numericId = parseInt(messageId, 10);
    const isNumericId = !isNaN(numericId);
    
    // Check for prefixed version of the ID (with and without numeric conversion)
    const prefixedId = `webrtc-${messageId}`;
    if (this.pendingMessages.has(prefixedId)) {
      if (isLogDebug) console.log(`[MESSAGE-TRACKER] Resolved ${messageId} to prefixed version ${prefixedId}`);
      return prefixedId;
    }
    
    // Try normalized version (which handles numeric IDs better)
    const normalizedId = this.normalizeMessageId(messageId);
    if (this.pendingMessages.has(normalizedId)) {
      if (isLogDebug) console.log(`[MESSAGE-TRACKER] Resolved ${messageId} to normalized version ${normalizedId}`);
      return normalizedId;
    }
    
    // Check all messages for this ID in their alternate IDs
    for (const [id, message] of Array.from(this.pendingMessages.entries())) {
      if (message.alternateIds.has(messageId)) {
        if (isLogDebug) console.log(`[MESSAGE-TRACKER] Resolved ${messageId} through alternateIds to ${id}`);
        return id;
      }
      
      // Also check numeric form in alternate IDs
      if (isNumericId && message.alternateIds.has(numericId.toString())) {
        if (isLogDebug) console.log(`[MESSAGE-TRACKER] Resolved numeric ${numericId} through alternateIds to ${id}`);
        return id;
      }
    }
    
    // Try direct numeric mapping (for pure numeric IDs from WebRTC)
    if (isNumericId) {
      const mappedId = this.numericToStringIdMap.get(numericId);
      if (mappedId) {
        if (isLogDebug) console.log(`[MESSAGE-TRACKER] Resolved numeric ${numericId} through numericToStringIdMap to ${mappedId}`);
        
        // Check if the mapped ID exists in pendingMessages
        if (this.pendingMessages.has(mappedId)) {
          return mappedId;
        }
        
        // If mapped ID doesn't exist, check if it's a prefix issue
        const unprefixedId = mappedId.replace(/^webrtc-/, '');
        if (this.pendingMessages.has(unprefixedId)) {
          return unprefixedId;
        }
        
        // Check all pending messages to see if this mapped ID is in any alternateIds
        for (const [id, message] of Array.from(this.pendingMessages.entries())) {
          if (message.alternateIds.has(mappedId)) {
            if (isLogDebug) console.log(`[MESSAGE-TRACKER] Resolved mapped ID ${mappedId} through alternateIds to ${id}`);
            return id;
          }
        }
      }
    }
    
    // If this is the only active message, return it as a fallback
    if (this.pendingMessages.size === 1) {
      const onlyId = Array.from(this.pendingMessages.keys())[0];
      console.log(`[MESSAGE-TRACKER] Message ID ${messageId}${isNumericId ? ` (numeric: ${numericId})` : ''} not found, but only one active message (${onlyId}). Using as fallback.`);
      
      // Also map this ID for future lookups
      if (isNumericId) {
        this.numericToStringIdMap.set(numericId, onlyId);
      }
      
      // Add to alternate IDs for the message
      const message = this.pendingMessages.get(onlyId);
      if (message) {
        message.alternateIds.add(messageId);
        if (isNumericId) {
          message.alternateIds.add(numericId.toString());
        }
      }
      
      return onlyId;
    }
    
    // Log the failure for debugging
    console.log(`[MESSAGE-TRACKER] Failed to resolve message ID: ${messageId}${isNumericId ? ` (numeric: ${numericId})` : ''}`);
    console.log(`[MESSAGE-TRACKER] Current pendingMessages:`, Array.from(this.pendingMessages.keys()));
    console.log(`[MESSAGE-TRACKER] Current numericToStringIdMap:`, Array.from(this.numericToStringIdMap.entries()));
    
    // No match found
    return null;
  }
  
  /**
   * Update when a message starts playing
   * @param messageId Message ID that started playing
   */
  startPlayingMessage(messageId: string): void {
    // Check for numeric ID
    const numericId = parseInt(messageId, 10);
    const isNumericId = !isNaN(numericId);
    
    // Resolve the message ID 
    const resolvedId = this.resolveMessageId(messageId) || messageId;
    
    if (this.currentlyPlaying && this.currentlyPlaying !== resolvedId) {
      // Log transition between messages
      console.log(`[MESSAGE-TRACKER] Transition from ${this.currentlyPlaying} to ${resolvedId} (original: ${messageId}${isNumericId ? `, numeric: ${numericId}` : ''})`);
    }
    
    this.currentlyPlaying = resolvedId;
    const message = this.pendingMessages.get(resolvedId);
    
    if (message) {
      message.isPlaying = true;
      
      // Add this ID to alternates if not already there
      message.alternateIds.add(messageId);
      
      // Also add numeric version if applicable
      if (isNumericId) {
        message.alternateIds.add(numericId.toString());
        // Map numeric to string ID for future lookups
        this.numericToStringIdMap.set(numericId, resolvedId);
      }
      
      // Log event for diagnostics
      audioLogger.logAudioElementEvent({
        eventType: 'play',
        currentTime: 0,
        duration: 0,
        readyState: 0,
        networkState: 0,
        src: '',
        elementId: messageId
      });
    } else {
      // Create a new entry if none exists
      console.log(`[MESSAGE-TRACKER] No entry found for ${resolvedId}, creating new entry`);
      this.trackMessage(messageId, 1);
      this.startPlayingMessage(messageId);
    }
  }
  
  /**
   * Handle chunk completion
   * @param messageId Message ID the chunk belongs to
   */
  completeChunk(messageId: string): void {
    // Try to parse as number for additional ID handling
    const numericId = parseInt(messageId, 10);
    const isNumericId = !isNaN(numericId);
    
    // Resolve the message ID (id is used inside this method for processing)
    const resolvedId = this.resolveMessageId(messageId);
    
    if (resolvedId) {
      const message = this.pendingMessages.get(resolvedId);
      
      if (message) {
        message.lastChunkTime = Date.now();
        
        // Add this ID to alternates if not already there
        message.alternateIds.add(messageId);
        
        // Also add numeric version if applicable
        if (isNumericId) {
          message.alternateIds.add(numericId.toString());
          // Map numeric to string ID for future lookups
          this.numericToStringIdMap.set(numericId, resolvedId);
        }
        
        // Handle chunk count and logging
        if (message.remainingChunks > 0) {
          message.remainingChunks--;
          
          // Log completion periodically
          if (message.remainingChunks % 5 === 0 || message.remainingChunks === 0) {
            console.log(`[MESSAGE-TRACKER] Message ${resolvedId} (original: ${messageId}${isNumericId ? `, numeric: ${numericId}` : ''}): ${message.remainingChunks}/${message.chunks} chunks remaining`);
          }
        }
      }
    } else {
      // If we can't resolve, create a new entry
      console.log(`[MESSAGE-TRACKER] Creating new entry for unrecognized chunk: ${messageId}${isNumericId ? ` (numeric: ${numericId})` : ''}`);
      this.trackMessage(messageId, 1);
      this.completeChunk(messageId);
    }
  }
  
  /**
   * Check if a stop signal should be applied
   * @param messageId Message ID for the stop signal
   * @returns True if the stop signal should be applied
   */
  shouldApplyStopSignal(messageId: string): boolean {
    // Handle numeric ID comparison
    const numericId = parseInt(messageId, 10);
    const isNumericId = !isNaN(numericId);
    
    // If there's no currently playing message but we have a stop signal,
    // and there's only one message being tracked, allow it
    if (!this.currentlyPlaying && this.pendingMessages.size === 1) {
      console.log(`[MESSAGE-TRACKER] Allowing stop for message ${messageId} as it's the only pending message`);
      return true;
    }
    
    // If there's no message being tracked, allow stop signal for final cleanup
    if (this.pendingMessages.size === 0) {
      console.log(`[MESSAGE-TRACKER] Allowing stop for message ${messageId} as there are no tracked messages`);
      return true;
    }
    
    // Resolve the message ID - enhanced
    const resolvedId = this.resolveMessageId(messageId);
    
    // If we resolved to the current message, allow it
    if (resolvedId && resolvedId === this.currentlyPlaying) {
      console.log(`[MESSAGE-TRACKER] Allowing stop for message ${messageId} - resolved to current playing ${this.currentlyPlaying}`);
      return true;
    }
    
    // Direct match with currently playing ID
    if (messageId === this.currentlyPlaying) {
      console.log(`[MESSAGE-TRACKER] Allowing stop for message ${messageId} - direct match with current playing`);
      return true;
    }
    
    // Check if it's an alternate ID for the current message
    if (this.currentlyPlaying) {
      const currentMessage = this.pendingMessages.get(this.currentlyPlaying);
      if (currentMessage && currentMessage.alternateIds.has(messageId)) {
        console.log(`[MESSAGE-TRACKER] Allowing stop for message ${messageId} - found in alternateIds of current playing ${this.currentlyPlaying}`);
        return true;
      }
      
      // Check numeric form for current message
      if (isNumericId && currentMessage) {
        // Check if the numeric ID is in alternateIds
        if (currentMessage.alternateIds.has(numericId.toString())) {
          console.log(`[MESSAGE-TRACKER] Allowing stop for numeric message ${numericId} - found in alternateIds of current playing ${this.currentlyPlaying}`);
          return true;
        }
        
        // Check if the numeric ID is mapped to current message
        const mappedId = this.numericToStringIdMap.get(numericId);
        if (mappedId === this.currentlyPlaying) {
          console.log(`[MESSAGE-TRACKER] Allowing stop for numeric message ${numericId} - mapped to current playing ${this.currentlyPlaying}`);
          return true;
        }
      }
    }
    
    // As a fallback for numeric IDs, check all pending messages
    if (isNumericId) {
      // Check if this numeric ID is mapped to any normalized ID
      const mappedId = this.numericToStringIdMap.get(numericId);
      if (mappedId) {
        console.log(`[MESSAGE-TRACKER] Allowing stop for numeric message ${numericId} - mapped to known ID ${mappedId}`);
        return true;
      }
      
      // Last resort: Check all messages for this numeric ID in alternateIds
      for (const [id, message] of Array.from(this.pendingMessages.entries())) {
        if (message.alternateIds.has(numericId.toString())) {
          console.log(`[MESSAGE-TRACKER] Allowing stop for numeric message ${numericId} - found in alternateIds of message ${id}`);
          return true;
        }
      }
    }
    
    // Otherwise, don't apply
    console.log(`[MESSAGE-TRACKER] Rejecting stop for message ${messageId} - no matching criteria found`);
    return false;
  }
  
  /**
   * Check if any messages are still pending or playing
   * @returns True if any messages are active
   */
  hasActiveMessages(): boolean {
    if (this.pendingMessages.size === 0) return false;
    
    for (const [, message] of Array.from(this.pendingMessages.entries())) {
      if (message.isPlaying || message.remainingChunks > 0) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get time since the last chunk for a specific message
   * @param messageId Message ID to check
   * @returns Time in ms since last chunk was processed
   */
  getTimeSinceLastChunk(messageId: string): number {
    // Resolve the message ID
    const resolvedId = this.resolveMessageId(messageId);
    
    if (resolvedId) {
      const message = this.pendingMessages.get(resolvedId);
      
      if (message) {
        return Date.now() - message.lastChunkTime;
      }
    }
    
    return Infinity;
  }
  
  /**
   * Clear completed messages
   */
  cleanup(): void {
    const initialSize = this.pendingMessages.size;
    console.log(`[MESSAGE-TRACKER] Starting cleanup with ${initialSize} pending messages and ${this.numericToStringIdMap.size} numeric ID mappings`);
    
    for (const [entryId, message] of Array.from(this.pendingMessages.entries())) {
      if (!message.isPlaying && message.remainingChunks === 0) {
        console.log(`[MESSAGE-TRACKER] Cleaning up completed message: ${entryId} with ${message.alternateIds.size} alternate IDs`);
        
        // Clean up any numeric mappings for this message
        const numericMappingsRemoved = [];
        for (const altId of Array.from(message.alternateIds)) {
          const numericId = parseInt(altId, 10);
          if (!isNaN(numericId) && this.numericToStringIdMap.has(numericId)) {
            numericMappingsRemoved.push(numericId);
            this.numericToStringIdMap.delete(numericId);
          }
        }
        
        if (numericMappingsRemoved.length > 0) {
          console.log(`[MESSAGE-TRACKER] Removed numeric ID mappings: ${numericMappingsRemoved.join(', ')}`);
        }
        
        this.pendingMessages.delete(entryId);
      }
    }
    
    // If all messages are gone, clear current playing
    if (this.pendingMessages.size === 0) {
      if (this.currentlyPlaying) {
        console.log(`[MESSAGE-TRACKER] All messages processed, clearing current playing ID: ${this.currentlyPlaying}`);
      }
      this.currentlyPlaying = null;
    }
    
    // Log cleanup results
    const removedCount = initialSize - this.pendingMessages.size;
    if (removedCount > 0 || initialSize > 0) {
      console.log(`[MESSAGE-TRACKER] Cleanup completed: removed ${removedCount} messages, ${this.pendingMessages.size} remaining, ${this.numericToStringIdMap.size} numeric mappings remaining`);
    }
  }
  
  /**
   * Get debugging info about current message state
   */
  getDebugInfo(): Record<string, unknown> {
    const messages: Record<string, unknown> = {};
    
    for (const [id, message] of Array.from(this.pendingMessages.entries())) {
      // Identify numeric IDs in alternateIds for better visibility
      const alternateIds = Array.from(message.alternateIds);
      const numericAlternateIds = alternateIds
        .filter(altId => !isNaN(parseInt(altId as string, 10)))
        .map(altId => parseInt(altId as string, 10));
      
      messages[id] = {
        chunksTotal: message.chunks,
        chunksRemaining: message.remainingChunks,
        isPlaying: message.isPlaying,
        age: Date.now() - message.startTime,
        timeSinceLastChunk: Date.now() - message.lastChunkTime,
        isCurrentlyPlaying: id === this.currentlyPlaying,
        alternateIds,
        numericAlternateIds: numericAlternateIds.length > 0 ? numericAlternateIds : undefined,
        alternateIdCount: message.alternateIds.size
      };
      // id is used as the key in the messages object above
    }
    
    // Extract all numeric IDs that are mapped
    const activeNumericIds = Array.from(this.numericToStringIdMap.entries())
      .filter(([, strId]) => {
        // Check if the mapped string ID is among our active messages
        return this.pendingMessages.has(strId) || 
              Array.from(this.pendingMessages.values())
                .some(msg => msg.alternateIds.has(strId));
      });
    
    return {
      activeMessages: this.pendingMessages.size,
      currentlyPlaying: this.currentlyPlaying,
      numericMappingsCount: this.numericToStringIdMap.size,
      activeNumericMappingsCount: activeNumericIds.length,
      numericMappings: Array.from(this.numericToStringIdMap.entries()),
      activeNumericMappings: activeNumericIds,
      messages,
      timestamp: Date.now()
    };
  }
}

/**
 * Enhanced high-precision audio playback timing
 * 
 * These functions provide detailed timing analysis for audio playback 
 * to help diagnose premature audio cutoffs
 */

// Types for high-precision audio tracking
interface AudioPlaybackSession {
  id: string;
  messageId: string | null;
  startTime: number;
  endTime: number | null;
  expectedDuration: number | null;
  actualDuration: number | null;
  completionRatio: number | null;
  completionType: 'normal' | 'premature' | 'forced' | 'error' | null;
  segments: AudioPlaybackSegment[];
  checkpoints: {
    timestamp: number;
    label: string;
    data?: Record<string, unknown>;
  }[];
  state: 'started' | 'playing' | 'paused' | 'ended' | 'error';
  meta: Record<string, unknown>;
}

// Individual audio segment (usually corresponds to one buffer or chunk)
interface AudioPlaybackSegment {
  id: string;
  sequence: number;
  size: number | null;
  startTime: number;
  endTime: number | null;
  duration: number | null;
  expectedDuration: number | null;
  completionRatio: number | null;
  state: 'queued' | 'playing' | 'completed' | 'error';
  timerResolution: number;
  sampleRate: number | null;
  waveformSamples: {
    timestamp: number;
    rmsValue: number;
    peakValue: number;
  }[];
  error: string | null;
}

// Session storage
const activeSessions: Record<string, AudioPlaybackSession> = {};
const sessionHistory: AudioPlaybackSession[] = [];
let currentSessionId: string | null = null;
let lastSegmentTimestamp = 0;
let globalSequenceCounter = 0;

// High precision timer using performance.now() if available
const getHighPrecisionTime = (): { timestamp: number, resolution: number } => {
  if (typeof performance !== 'undefined' && DIAGNOSTIC_OPTIONS.HIGH_PRECISION_TIMING) {
    return { 
      timestamp: performance.now(),
      resolution: 0.1 // millisecond precision
    };
  }
  
  return { 
    timestamp: Date.now(),
    resolution: 1 // millisecond precision 
  };
};

/**
 * Start tracking a new audio playback session
 * @param messageId Associated message ID if available
 * @param meta Any additional metadata to store with session
 * @returns Session ID for future reference
 */
export function startAudioSession(messageId: string | null = null, meta: Record<string, unknown> = {}): string {
  if (!ENABLE_AUDIO_CUTOFF_DIAGNOSTICS) return 'disabled';
  
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const { timestamp } = getHighPrecisionTime();
  
  // Create new session
  const session: AudioPlaybackSession = {
    id: sessionId,
    messageId,
    startTime: timestamp,
    endTime: null,
    expectedDuration: null,
    actualDuration: null,
    completionRatio: null,
    completionType: null,
    segments: [],
    checkpoints: [{
      timestamp,
      label: 'session_start',
      data: { messageId }
    }],
    state: 'started',
    meta
  };
  
  // Store in active sessions
  activeSessions[sessionId] = session;
  currentSessionId = sessionId;
  
  if (DIAGNOSTICS_DETAIL_LEVEL >= 2) {
    console.log(`[AUDIO-TRACKER] Started new audio session: ${sessionId}${messageId ? ` (message: ${messageId})` : ''}`);
  }
  
  // Log session start to audio logger for persistence
  audioLogger.logDiagnostic('audio-session-start', {
    sessionId,
    messageId,
    timestamp,
    ...meta
  });
  
  return sessionId;
}

/**
 * Add a segment to an audio session (typically for each audio buffer/chunk)
 * @param sessionId The session to add segment to
 * @param size Size of audio buffer in bytes
 * @param expectedDuration Expected playback duration in seconds
 * @param sampleRate Sample rate of audio in Hz
 * @returns Segment ID
 */
export function addAudioSegment(
  sessionId: string = currentSessionId || '',
  size: number | null = null,
  expectedDuration: number | null = null,
  sampleRate: number | null = null
): string {
  if (!ENABLE_AUDIO_CUTOFF_DIAGNOSTICS) return 'disabled';
  if (!sessionId || !activeSessions[sessionId]) return 'invalid-session';
  
  const sequence = ++globalSequenceCounter;
  const segmentId = `segment-${Date.now()}-${sequence}`;
  const { timestamp, resolution } = getHighPrecisionTime();
  
  // Create segment
  const segment: AudioPlaybackSegment = {
    id: segmentId,
    sequence,
    size,
    startTime: timestamp,
    endTime: null,
    duration: null,
    expectedDuration,
    completionRatio: null,
    state: 'queued',
    timerResolution: resolution,
    sampleRate,
    waveformSamples: [],
    error: null
  };
  
  // Add to session
  activeSessions[sessionId].segments.push(segment);
  
  // Update checkpoint
  activeSessions[sessionId].checkpoints.push({
    timestamp,
    label: 'segment_added',
    data: { segmentId, sequence, size, expectedDuration }
  });
  
  lastSegmentTimestamp = timestamp;
  
  if (DIAGNOSTICS_DETAIL_LEVEL >= 3) {
    console.log(`[AUDIO-TRACKER] Added segment ${segmentId} to session ${sessionId}:`, {
      sequence,
      size,
      expectedDuration
    });
  }
  
  return segmentId;
}

/**
 * Mark an audio segment as started playing
 * @param segmentId ID of segment to update
 * @param sessionId Session containing the segment
 */
export function startPlayingSegment(segmentId: string, sessionId: string = currentSessionId || ''): void {
  if (!ENABLE_AUDIO_CUTOFF_DIAGNOSTICS) return;
  if (!sessionId || !activeSessions[sessionId]) return;
  
  const { timestamp } = getHighPrecisionTime();
  
  // Find segment
  const segment = activeSessions[sessionId].segments.find(s => s.id === segmentId);
  if (!segment) return;
  
  // Update segment state
  segment.state = 'playing';
  
  // Update session state if not already playing
  if (activeSessions[sessionId].state !== 'playing') {
    activeSessions[sessionId].state = 'playing';
    
    // Add checkpoint
    activeSessions[sessionId].checkpoints.push({
      timestamp,
      label: 'playback_started',
      data: { segmentId }
    });
    
    if (DIAGNOSTICS_DETAIL_LEVEL >= 2) {
      console.log(`[AUDIO-TRACKER] Session ${sessionId} playback started with segment ${segmentId}`);
    }
  }
  
  if (DIAGNOSTICS_DETAIL_LEVEL >= 3) {
    console.log(`[AUDIO-TRACKER] Started playing segment ${segmentId}`);
  }
}

/**
 * Complete an audio segment
 * @param segmentId ID of segment to complete
 * @param sessionId Session containing the segment
 * @param error Optional error message if segment failed
 */
export function completeSegment(
  segmentId: string, 
  sessionId: string = currentSessionId || '',
  error: string | null = null
): void {
  if (!ENABLE_AUDIO_CUTOFF_DIAGNOSTICS) return;
  if (!sessionId || !activeSessions[sessionId]) return;
  
  const { timestamp } = getHighPrecisionTime();
  
  // Find segment
  const segment = activeSessions[sessionId].segments.find(s => s.id === segmentId);
  if (!segment) return;
  
  // Update segment
  segment.endTime = timestamp;
  segment.duration = (timestamp - segment.startTime) / 1000; // Convert to seconds
  segment.state = error ? 'error' : 'completed';
  segment.error = error;
  
  // Calculate completion ratio if expected duration available
  if (segment.expectedDuration) {
    segment.completionRatio = segment.duration / segment.expectedDuration;
    
    // Check for suspicious completion ratio
    if (!error && segment.completionRatio < 0.9) {
      console.warn(`[AUDIO-TRACKER] Segment ${segmentId} completed earlier than expected:`, {
        actual: segment.duration.toFixed(3) + 's',
        expected: segment.expectedDuration.toFixed(3) + 's',
        ratio: segment.completionRatio.toFixed(2)
      });
      
      // Log segment early completion to audio logger
      audioLogger.logDiagnostic('audio-segment-early-completion', {
        sessionId,
        segmentId,
        actualDuration: segment.duration,
        expectedDuration: segment.expectedDuration,
        completionRatio: segment.completionRatio
      });
    }
  }
  
  // Add checkpoint
  activeSessions[sessionId].checkpoints.push({
    timestamp,
    label: error ? 'segment_error' : 'segment_completed',
    data: { 
      segmentId,
      duration: segment.duration,
      error
    }
  });
  
  if (DIAGNOSTICS_DETAIL_LEVEL >= 3) {
    console.log(`[AUDIO-TRACKER] Completed segment ${segmentId}:`, {
      duration: segment.duration?.toFixed(3) + 's',
      state: segment.state
    });
  }
}

/**
 * Complete an audio session
 * @param sessionId Session to complete
 * @param completionType How the session ended
 */
export function completeAudioSession(
  sessionId: string = currentSessionId || '',
  completionType: AudioPlaybackSession['completionType'] = 'normal'
): void {
  if (!ENABLE_AUDIO_CUTOFF_DIAGNOSTICS) return;
  if (!sessionId || !activeSessions[sessionId]) return;
  
  const { timestamp } = getHighPrecisionTime();
  const session = activeSessions[sessionId];
  
  // Update session
  session.endTime = timestamp;
  session.state = completionType === 'error' ? 'error' : 'ended';
  session.completionType = completionType;
  
  // Calculate actual duration
  session.actualDuration = (timestamp - session.startTime) / 1000; // in seconds
  
  // Calculate expected duration based on segments if not set
  if (!session.expectedDuration) {
    session.expectedDuration = session.segments.reduce((sum, segment) => {
      return sum + (segment.expectedDuration || 0);
    }, 0);
  }
  
  // Calculate completion ratio
  if (session.expectedDuration && session.expectedDuration > 0) {
    session.completionRatio = session.actualDuration / session.expectedDuration;
  }
  
  // Add final checkpoint
  session.checkpoints.push({
    timestamp,
    label: 'session_end',
    data: { 
      completionType,
      actualDuration: session.actualDuration,
      expectedDuration: session.expectedDuration,
      completionRatio: session.completionRatio
    }
  });
  
  // Calculate metrics
  const metrics = calculateSessionMetrics(session);
  
  // Store in history and remove from active
  sessionHistory.push(session);
  delete activeSessions[sessionId];
  
  // Clear current session if it's the one being completed
  if (currentSessionId === sessionId) {
    currentSessionId = null;
  }
  
  // Keep history size reasonable
  if (sessionHistory.length > 20) {
    sessionHistory.shift();
  }
  
  // Log completion
  const logLevel = 
    completionType === 'normal' ? 2 :
    completionType === 'error' ? 0 : 1;
  
  if (DIAGNOSTICS_DETAIL_LEVEL >= logLevel) {
    console.log(`[AUDIO-TRACKER] Completed session ${sessionId}:`, {
      completionType,
      actualDuration: session.actualDuration?.toFixed(2) + 's',
      expectedDuration: session.expectedDuration?.toFixed(2) + 's',
      segmentCount: session.segments.length,
      completionRatio: session.completionRatio?.toFixed(2)
    });
  }
  
  // Log potential issues
  if (session.completionRatio !== null && session.completionRatio < 0.9 && completionType === 'normal') {
    console.warn(`[AUDIO-TRACKER] Session ${sessionId} completed earlier than expected:`, {
      actual: session.actualDuration?.toFixed(2) + 's',
      expected: session.expectedDuration?.toFixed(2) + 's',
      ratio: session.completionRatio.toFixed(2),
      missingTime: ((session.expectedDuration || 0) - (session.actualDuration || 0)).toFixed(2) + 's'
    });
    
    // Log to audioLogger for persistence
    audioLogger.logDiagnostic('audio-session-early-completion', {
      sessionId,
      actualDuration: session.actualDuration,
      expectedDuration: session.expectedDuration,
      completionRatio: session.completionRatio,
      segmentCount: session.segments.length,
      messageId: session.messageId,
      metrics
    });
  }
  
  // Always log completion to audioLogger
  audioLogger.logDiagnostic('audio-session-complete', {
    sessionId,
    completionType,
    actualDuration: session.actualDuration,
    expectedDuration: session.expectedDuration,
    completionRatio: session.completionRatio,
    segmentCount: session.segments.length,
    messageId: session.messageId,
    metrics
  });
}

/**
 * Add a waveform sample to the current segment
 * @param rmsValue Root mean square value (volume level)
 * @param peakValue Peak value 
 * @param segmentId Segment ID to add sample to
 * @param sessionId Session containing the segment
 */
export function addWaveformSample(
  rmsValue: number,
  peakValue: number,
  segmentId?: string,
  sessionId: string = currentSessionId || ''
): void {
  if (!ENABLE_AUDIO_CUTOFF_DIAGNOSTICS || !DIAGNOSTIC_OPTIONS.ENABLE_WAVEFORM_ANALYSIS) return;
  if (!sessionId || !activeSessions[sessionId]) return;
  
  const { timestamp } = getHighPrecisionTime();
  const session = activeSessions[sessionId];
  
  // If segment ID provided, find that segment
  let segment: AudioPlaybackSegment | undefined;
  if (segmentId) {
    segment = session.segments.find(s => s.id === segmentId);
  } else {
    // Otherwise, use the last segment that's in 'playing' state
    segment = [...session.segments].reverse().find(s => s.state === 'playing');
  }
  
  if (!segment) return;
  
  // Add sample
  segment.waveformSamples.push({
    timestamp,
    rmsValue,
    peakValue
  });
  
  // Keep sample count reasonable
  if (segment.waveformSamples.length > 100) {
    segment.waveformSamples.shift();
  }
  
  // Detect silent audio (potentially cut off)
  if (rmsValue < 0.01 && segment.waveformSamples.length > 5) {
    // Check if we have multiple consecutive silent samples
    const recentSamples = segment.waveformSamples.slice(-5);
    const allSilent = recentSamples.every(sample => sample.rmsValue < 0.01);
    
    if (allSilent && segment.state === 'playing') {
      console.warn(`[AUDIO-TRACKER] Detected silence during playback in segment ${segment.id}`);
      
      // Log to audioLogger
      audioLogger.logDiagnostic('audio-silence-detected', {
        sessionId,
        segmentId: segment.id,
        timestamp,
        samples: recentSamples
      });
    }
  }
}

/**
 * Add a checkpoint to the session
 * @param label Description of the checkpoint
 * @param data Additional data to store
 * @param sessionId Session to add checkpoint to
 */
export function addSessionCheckpoint(
  label: string,
  data: Record<string, unknown> = {},
  sessionId: string = currentSessionId || ''
): void {
  if (!ENABLE_AUDIO_CUTOFF_DIAGNOSTICS) return;
  if (!sessionId || !activeSessions[sessionId]) return;
  
  const { timestamp } = getHighPrecisionTime();
  
  // Add checkpoint
  activeSessions[sessionId].checkpoints.push({
    timestamp,
    label,
    data
  });
  
  if (DIAGNOSTICS_DETAIL_LEVEL >= 3) {
    console.log(`[AUDIO-TRACKER] Checkpoint added to session ${sessionId}: ${label}`);
  }
}

/**
 * Calculate metrics for a completed session
 */
function calculateSessionMetrics(session: AudioPlaybackSession): Record<string, number> {
  const completedSegments = session.segments.filter(s => 
    s.state === 'completed' && s.duration !== null
  );
  
  // Extract segment durations (converting nulls to 0)
  const durations = completedSegments.map(s => s.duration || 0);
  
  // Calculate gaps between segments
  const gaps: number[] = [];
  for (let i = 1; i < completedSegments.length; i++) {
    const prevEnd = completedSegments[i-1].endTime || 0;
    const currStart = completedSegments[i].startTime;
    
    if (prevEnd > 0) {
      gaps.push(currStart - prevEnd);
    }
  }
  
  // Create metrics
  return {
    totalPlaybackTime: (session.actualDuration || 0),
    averageSegmentDuration: durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0,
    longestSegment: durations.length > 0 
      ? Math.max(...durations)
      : 0,
    shortestSegment: durations.length > 0 
      ? Math.min(...durations)
      : 0,
    segmentCount: completedSegments.length,
    averageGapBetweenSegments: gaps.length > 0
      ? gaps.reduce((sum, g) => sum + g, 0) / gaps.length / 1000 // Convert to seconds
      : 0,
    maxGapBetweenSegments: gaps.length > 0
      ? Math.max(...gaps) / 1000 // Convert to seconds
      : 0,
    timeToFirstSegment: completedSegments.length > 0
      ? (completedSegments[0].startTime - session.startTime) / 1000
      : 0,
    timeSinceLastSegment: lastSegmentTimestamp > 0
      ? (Date.now() - lastSegmentTimestamp) / 1000
      : 0,
    estimatedTotalDuration: session.expectedDuration || 0,
    completionRatio: session.completionRatio || 0
  };
}

/**
 * Get details of a specific session
 */
export function getSessionDetails(sessionId: string): AudioPlaybackSession | null {
  // First check active sessions
  if (activeSessions[sessionId]) {
    return { ...activeSessions[sessionId] };
  }
  
  // Then check history
  const historySession = sessionHistory.find(s => s.id === sessionId);
  if (historySession) {
    return { ...historySession };
  }
  
  return null;
}

/**
 * Get current active session ID
 */
export function getCurrentSessionId(): string | null {
  return currentSessionId;
}

/**
 * Export session data for debugging
 */
export function exportSessionData(sessionId?: string): string {
  try {
    const data = {
      activeSessions,
      sessionHistory,
      currentSessionId,
      lastSegmentTimestamp,
      globalSequenceCounter,
      requestedSession: sessionId ? getSessionDetails(sessionId) : null
    };
    
    return JSON.stringify(data, null, 2);
  } catch (e) {
    console.error('[AUDIO-TRACKER] Error exporting session data:', e);
    return '{}';
  }
}

// Export all functions
export default {
  // Original functionality
  createAudioStateTracker,
  createAudioCompletionPromise,
  MessageTracker,
  
  // Enhanced timing diagnostics
  startAudioSession,
  addAudioSegment,
  startPlayingSegment,
  completeSegment,
  completeAudioSession,
  addWaveformSample,
  addSessionCheckpoint,
  getSessionDetails,
  getCurrentSessionId,
  exportSessionData
};