// src/hooksV11/audio-cutoff-diagnostics.ts

/**
 * Audio Cutoff Diagnostics
 * 
 * This module provides enhanced diagnostic functions to troubleshoot audio
 * cutoff issues in WebRTC audio streaming. It adds additional logging and
 * timing analysis to help identify when and why audio might be prematurely
 * cut off.
 * 
 * IMPORTANT: These diagnostics can be disabled by setting the ENABLE_AUDIO_CUTOFF_DIAGNOSTICS
 * constant to false. All code is designed to be safely removable when the issue is resolved.
 */

import audioLogger from './audio-logger';

// ====== CONFIGURATION ======
// Set this to false to disable all audio diagnostics without removing the code
export const ENABLE_AUDIO_CUTOFF_DIAGNOSTICS = false; // DISABLED for V15 - causing console flooding

// Diagnostics Detail Level
// 0 = Minimal (only critical errors)
// 1 = Standard (errors + warnings)
// 2 = Verbose (full detailed logging)
// 3 = Debug (maximum detail including waveform analysis)
export const DIAGNOSTICS_DETAIL_LEVEL = 0; // REDUCED for V15 - minimal logging only

// Configure which types of diagnostics to enable
export const DIAGNOSTIC_OPTIONS = {
  // Core diagnostics features
  ENABLE_AUDIO_ELEMENT_MONITORING: true,    // Monitor HTML Audio elements directly
  ENABLE_AUDIO_CONTEXT_MONITORING: true,    // Monitor WebAudio API context and nodes
  ENABLE_WAVEFORM_ANALYSIS: true,          // Analyze audio output for silence/cutoffs
  ENABLE_RAW_BUFFER_INSPECTION: true,      // Inspect PCM content of audio buffers
  
  // Backend diagnostics features
  ENABLE_WEBRTC_EVENT_TRACKING: true,       // Track WebRTC message flow to audio service
  ENABLE_AUDIO_SERVICE_DIAGNOSTICS: true,  // Enhanced logging for audio service behavior
  
  // Advanced analysis
  ENABLE_SEQUENCE_VALIDATION: true,        // Add sequence IDs to audio chunks
  ENABLE_VALIDATION_TONES: false,          // Add inaudible validation tones (advanced)
  
  // Performance impact controls
  HIGH_PRECISION_TIMING: true,             // Use high-resolution timers (may impact performance)
  BUFFER_VERIFICATION_SAMPLING: 10,        // Check 1 in X buffers for detailed analysis
};

// Extend Window interface to include our custom global properties
declare global {
  interface Window {
    __audioCutoffDiagnostics?: {
      sessions: AudioBufferDiagnostics[];
      potentialCutoffs: Array<{
        timestamp: number;
        type: string;
        timeSinceLastBuffer: number;
        diagnostics: AudioBufferDiagnostics;
      }>;
      lastAnalysis: AudioBufferDiagnostics | null;
    };
    __audioChunkLifecycle?: Record<string, {
      received: number;
      size: number;
      status: string;
      msgId: string;
      bufferIndex: number;
      enqueued?: number;
      playStart?: number;
      playEnd?: number;
      playDuration?: number;
      errorTime?: number;
      queuePosition?: number;
      errorDetails?: {
        timeElapsed: number;
        event: string;
      };
    }>;
    __audioBufferTimings?: {
      firstBufferTime: number;
      lastBufferTime: number;
      bufferIntervals: number[];
      totalBuffers: number;
      totalBufferSize: number;
      bufferSizes: number[];
      responseStartTime: number;
      stopSignalTime?: number;
      stopSignalMsgId?: string;
      expectedTotalDuration?: number;
    };
    __audioPlaybackTimings?: {
      chunks: Record<string, unknown>[];
      currentChunk: Record<string, unknown>;
      playbackSuccessCount: number;
      playbackErrorCount: number;
      totalDuration: number;
    };
    __prematureStopSignals?: Record<string, unknown>[];
    __audioCompletionStats?: {
      completions: number;
      normalCompletions: number;
      forcedCompletions: number;
      potentialCutoffs: number;
      lastCompletionTime: number | null;
      averageBuffersPerCompletion: number;
      totalBuffersPlayed: number;
    };
    __emptyQueueTimings?: {
      emptyCount: number;
      timestamps: number[];
      pendingChunksAtEmpty: number[];
    };
    __audioFinalizations?: Record<string, unknown>[];
    __messageFlowState?: Record<string, unknown>;
  }
}

// Type definition for audio chunk lifecycle tracking
export interface AudioChunkLifecycle {
  received: number;
  size: number;
  status: string;
  msgId: string;
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

// Log message structure for detailed audio buffer analysis
interface AudioBufferDiagnostics {
  requestId: string;
  timestamp: number;
  audioSequenceInfo: {
    firstBufferTime: number;     // When the first buffer was received
    lastBufferTime: number;      // When the most recent buffer was received 
    totalBuffers: number;        // Total number of buffers received
    averageInterval: number;     // Average time between buffers in ms
    responseTextLength: number;  // Character count of the response
    charsPerBuffer: number;      // Ratio of text chars to buffers
  };
  audioPlaybackInfo: {
    queueLength: number;         // Current buffer queue length
    pendingChunks: number;       // Audio chunks currently playing
    isPlaying: boolean;          // Whether audio is currently playing
    receivedStopSignal: boolean; // Whether the stop signal was received
    timeSinceLastBuffer: number; // Ms since the last buffer was received
    totalPlaybackDuration: number; // Total estimated duration of all buffers
  };
  potentialIssue: string | null; // Description of potential issue if detected
}

// AudioContext reference for debugging purposes - used by monkeyPatchAudioContext
// This reference will be updated when new contexts are created

/**
 * Initialize audio cutoff diagnostics system
 * No parameters are needed since we're using global monitoring
 */
export function initAudioCutoffDiagnostics(): void {
  if (!ENABLE_AUDIO_CUTOFF_DIAGNOSTICS) return;
  
  // Initialize global diagnostics storage
  if (typeof window !== 'undefined') {
    if (!window.__audioCutoffDiagnostics) {
      window.__audioCutoffDiagnostics = {
        sessions: [],
        potentialCutoffs: [],
        lastAnalysis: null
      };
    }
    
    // No need to store audioContext reference anymore
    
    console.log(`[AUDIO-CUTOFF-DIAG] Audio cutoff diagnostics initialized (level ${DIAGNOSTICS_DETAIL_LEVEL})`);
    
    // Install event listeners for audio elements
    if (DIAGNOSTIC_OPTIONS.ENABLE_AUDIO_ELEMENT_MONITORING) {
      installGlobalAudioElementListeners();
    }
    
    // Install AudioContext monitor
    if (DIAGNOSTIC_OPTIONS.ENABLE_AUDIO_CONTEXT_MONITORING) {
      monkeyPatchAudioContext();
    }
  }
}

/**
 * Analyze audio buffer timing information to detect potential cutoff issues
 * @param msgId - A unique ID for the message/request
 * @param state - Current WebRTC state with response info
 * @param audioRefs - References to audio state (queue, pending chunks, etc)
 * @returns Diagnostic information about the audio sequence
 */
export function analyzeAudioCutoffPotential(
  msgId: string,
  state: {
    currentResponse?: {
      text?: string;
    };
    responseStartTime?: number;
    [key: string]: unknown;
  },
  audioRefs: {
    queue: { current: ArrayBuffer[] };
    pendingChunks: { current: Set<string> };
    isPlaying: { current: boolean };
    receivedStopSignal: { current: boolean };
  }
): AudioBufferDiagnostics | null {
  if (typeof window === 'undefined' || !window.__audioBufferTimings) {
    return null;
  }
  
  const now = Date.now();
  const bufferTimings = window.__audioBufferTimings;
  
  // Calculate average interval between buffers
  const intervals = bufferTimings.bufferIntervals || [];
  const avgInterval = intervals.length > 0 
    ? intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length 
    : 0;
  
  // Get text information
  const responseLength = state?.currentResponse?.text?.length || 0;
  const charsPerBuffer = responseLength / (bufferTimings.totalBuffers || 1);
  
  const timeSinceLastBuffer = now - bufferTimings.lastBufferTime;
  
  // Estimated total duration based on buffer count and average playback time
  const totalPlaybackDuration = window.__audioPlaybackTimings?.totalDuration || 0;
  
  // Build diagnostics object
  const diagnostics: AudioBufferDiagnostics = {
    requestId: msgId,
    timestamp: now,
    audioSequenceInfo: {
      firstBufferTime: bufferTimings.firstBufferTime,
      lastBufferTime: bufferTimings.lastBufferTime,
      totalBuffers: bufferTimings.totalBuffers || 0,
      averageInterval: avgInterval,
      responseTextLength: responseLength,
      charsPerBuffer: charsPerBuffer
    },
    audioPlaybackInfo: {
      queueLength: audioRefs.queue.current.length,
      pendingChunks: audioRefs.pendingChunks.current.size,
      isPlaying: audioRefs.isPlaying.current,
      receivedStopSignal: audioRefs.receivedStopSignal.current,
      timeSinceLastBuffer: timeSinceLastBuffer,
      totalPlaybackDuration: totalPlaybackDuration
    },
    potentialIssue: null
  };
  
  // Detect potential issues
  if (audioRefs.isPlaying.current && timeSinceLastBuffer < 500 && audioRefs.receivedStopSignal.current) {
    diagnostics.potentialIssue = 'PREMATURE_STOP_SIGNAL';
    
    // Log to global tracking
    if (window.__audioCutoffDiagnostics) {
      window.__audioCutoffDiagnostics.potentialCutoffs.push({
        timestamp: now,
        type: 'PREMATURE_STOP_SIGNAL',
        timeSinceLastBuffer,
        diagnostics
      });
    }
    
    // Log detailed analysis
    console.warn(
      `[AUDIO-CUTOFF-DIAG-${msgId}] Potential premature stop signal detected:
      - Stop signal received ${timeSinceLastBuffer}ms after last buffer while still playing
      - Response text length: ${responseLength} chars (${charsPerBuffer.toFixed(1)} chars/buffer)
      - Buffers received: ${bufferTimings.totalBuffers || 0}
      - Average interval between buffers: ${avgInterval.toFixed(1)}ms
      - Currently pending chunks: ${audioRefs.pendingChunks.current.size}
      - Queue length: ${audioRefs.queue.current.length}`
    );
    
    // Log to audio logger
    audioLogger.logError('audio_cutoff_premature_stop', `Premature stop signal detected ${timeSinceLastBuffer}ms after last buffer`, {
      componentName: 'AudioCutoffDiagnostics',
      context: {
        timeSinceLastBuffer,
        responseLength,
        totalBuffers: bufferTimings.totalBuffers,
        isPlaying: audioRefs.isPlaying.current,
        pendingChunks: audioRefs.pendingChunks.current.size,
        queueLength: audioRefs.queue.current.length
      }
    });
  } else if (!audioRefs.receivedStopSignal.current && audioRefs.queue.current.length === 0 && 
             audioRefs.pendingChunks.current.size === 0 && 
             bufferTimings.totalBuffers > 0) {
    // Another potential issue: queue emptied without stop signal
    diagnostics.potentialIssue = 'QUEUE_EMPTIED_WITHOUT_STOP';
    
    // Log to global tracking
    if (window.__audioCutoffDiagnostics) {
      window.__audioCutoffDiagnostics.potentialCutoffs.push({
        timestamp: now,
        type: 'QUEUE_EMPTIED_WITHOUT_STOP',
        timeSinceLastBuffer,
        diagnostics
      });
    }
    
    console.warn(
      `[AUDIO-CUTOFF-DIAG-${msgId}] Queue emptied without stop signal:
      - ${timeSinceLastBuffer}ms since last buffer received
      - No stop signal received from server
      - Response text length: ${responseLength} chars
      - Buffers received: ${bufferTimings.totalBuffers || 0}`
    );
  }
  
  // Store last analysis
  if (window.__audioCutoffDiagnostics) {
    window.__audioCutoffDiagnostics.lastAnalysis = diagnostics;
    window.__audioCutoffDiagnostics.sessions.push(diagnostics);
    
    // Keep only the last 20 sessions
    if (window.__audioCutoffDiagnostics.sessions.length > 20) {
      window.__audioCutoffDiagnostics.sessions.shift();
    }
  }
  
  return diagnostics;
}

/**
 * Calculate expected audio duration based on text length
 * Uses heuristics to estimate how long audio playback should take 
 * for a given text length
 * 
 * @param text The response text
 * @returns Estimated duration in milliseconds
 */
export function estimateAudioDuration(text: string): number {
  if (!text) return 0;
  
  // Average speaking rate is about 150 words per minute
  // Average word length is about 5 characters
  // So ~30 characters per second or ~33ms per character
  const charDuration = 33;
  
  // Add pauses for punctuation
  const commaCount = (text.match(/,/g) || []).length;
  const periodCount = (text.match(/[.!?]/g) || []).length;
  
  // Typical pause durations
  const commaPause = 200;
  const periodPause = 500;
  
  const totalPauseDuration = (commaCount * commaPause) + (periodCount * periodPause);
  const characterDuration = text.length * charDuration;
  
  return characterDuration + totalPauseDuration;
}

/**
 * Analyze text vs audio performance to detect potential cutoff issues
 * 
 * @param text The response text
 * @param stats Audio playback statistics
 * @returns Analysis results with potential issues identified
 */
export function analyzeTextAudioCorrelation(
  text: string,
  stats: {
    totalPlaybackDuration: number; // Actual playback duration in ms
    totalBuffers: number;
  }
): { 
  expected: number;
  actual: number;
  difference: number;
  ratio: number;
  potentialIssue: string | null;
} {
  const expectedDuration = estimateAudioDuration(text);
  const actualDuration = stats.totalPlaybackDuration;
  const difference = expectedDuration - actualDuration;
  const ratio = actualDuration / expectedDuration;
  
  let potentialIssue = null;
  
  // If actual playback is significantly shorter than expected
  if (ratio < 0.85 && difference > 1000) {
    potentialIssue = 'PLAYBACK_SHORTER_THAN_EXPECTED';
  }
  
  return {
    expected: expectedDuration,
    actual: actualDuration,
    difference,
    ratio,
    potentialIssue
  };
}

/**
 * Analyze audio chunk lifecycle data to detect issues
 * @returns Analysis of all audio chunks and their lifecycle timing
 */
export function analyzeAudioChunkLifecycle(): {
  summary: {
    totalChunks: number;
    completed: number;
    errors: number;
    avgReceiveToQueue: number;
    avgQueueToPlay: number;
    avgPlayDuration: number;
    avgTotalLifecycle: number;
  };
  issuesByStatus: Record<string, number>;
  incompleteChunks: Array<{
    id: string;
    status: string;
    received: number;
    size: number;
    age: number;
    bufferIndex: number;
  }>;
  slowestChunks: Array<{
    phase: string;
    duration: number;
    chunkDetails: {
      id: string;
      status: string;
      size: number;
      bufferIndex: number;
    };
  }>;
} {
  if (typeof window === 'undefined' || !window.__audioChunkLifecycle) {
    return {
      summary: {
        totalChunks: 0,
        completed: 0,
        errors: 0,
        avgReceiveToQueue: 0,
        avgQueueToPlay: 0,
        avgPlayDuration: 0,
        avgTotalLifecycle: 0
      },
      issuesByStatus: {},
      incompleteChunks: [],
      slowestChunks: []
    };
  }
  
  const lifecycle = window.__audioChunkLifecycle as Record<string, AudioChunkLifecycle>;
  const chunks = Object.values(lifecycle) as AudioChunkLifecycle[];
  
  // Count chunks by status
  const statusCounts: Record<string, number> = {};
  chunks.forEach(chunk => {
    statusCounts[chunk.status] = (statusCounts[chunk.status] || 0) + 1;
  });
  
  // Calculate averages for timing
  const receiveToQueueTimes: number[] = [];
  const queueToPlayTimes: number[] = [];
  const playDurations: number[] = [];
  const totalLifecycleTimes: number[] = [];
  
  chunks.forEach(chunk => {
    if (chunk.enqueued && chunk.received) {
      receiveToQueueTimes.push(chunk.enqueued - chunk.received);
    }
    
    if (chunk.playStart && chunk.enqueued) {
      queueToPlayTimes.push(chunk.playStart - chunk.enqueued);
    }
    
    if (chunk.playEnd && chunk.playStart) {
      playDurations.push(chunk.playEnd - chunk.playStart);
    }
    
    if (chunk.status === 'completed' && chunk.received && chunk.playEnd) {
      totalLifecycleTimes.push(chunk.playEnd - chunk.received);
    }
  });
  
  // Calculate averages
  const average = (arr: number[]): number => arr.length ? arr.reduce((a: number, b: number) => a + b, 0) / arr.length : 0;
  
  // Find chunks that weren't completed
  const incompleteChunks = chunks.filter(chunk => 
    chunk.status !== 'completed' && chunk.status !== 'error' && 
    Date.now() - chunk.received > 10000 // Only include chunks that are at least 10 seconds old
  ).map(chunk => ({
    id: chunk.msgId || 'unknown',
    status: chunk.status,
    received: chunk.received,
    size: chunk.size,
    age: Date.now() - chunk.received,
    bufferIndex: chunk.bufferIndex
  }));
  
  // Find the slowest chunks in each phase
  const slowestChunks = [];
  
  // Slowest queue time
  if (receiveToQueueTimes.length) {
    const slowestQueueIndex = receiveToQueueTimes.indexOf(Math.max(...receiveToQueueTimes));
    if (slowestQueueIndex >= 0) {
      const chunk = chunks[slowestQueueIndex];
      slowestChunks.push({
        phase: 'receive_to_queue',
        duration: receiveToQueueTimes[slowestQueueIndex],
        chunkDetails: {
          id: chunk.msgId || 'unknown',
          status: chunk.status,
          size: chunk.size,
          bufferIndex: chunk.bufferIndex
        }
      });
    }
  }
  
  // Slowest play start
  if (queueToPlayTimes.length) {
    const slowestPlayIndex = queueToPlayTimes.indexOf(Math.max(...queueToPlayTimes));
    if (slowestPlayIndex >= 0) {
      const chunk = chunks[slowestPlayIndex];
      slowestChunks.push({
        phase: 'queue_to_play',
        duration: queueToPlayTimes[slowestPlayIndex],
        chunkDetails: {
          id: chunk.msgId || 'unknown',
          status: chunk.status,
          size: chunk.size,
          bufferIndex: chunk.bufferIndex
        }
      });
    }
  }
  
  return {
    summary: {
      totalChunks: chunks.length,
      completed: statusCounts['completed'] || 0,
      errors: statusCounts['error'] || 0,
      avgReceiveToQueue: average(receiveToQueueTimes),
      avgQueueToPlay: average(queueToPlayTimes),
      avgPlayDuration: average(playDurations),
      avgTotalLifecycle: average(totalLifecycleTimes)
    },
    issuesByStatus: statusCounts,
    incompleteChunks,
    slowestChunks
  };
}

/**
 * Export current diagnostics data for debugging
 * @returns JSON string with current diagnostics data
 */
export function exportAudioCutoffDiagnostics(): string {
  if (typeof window !== 'undefined') {
    try {
      const data = {
        cutoffDiagnostics: window.__audioCutoffDiagnostics || {},
        chunkLifecycle: window.__audioChunkLifecycle || {},
        chunkLifecycleAnalysis: analyzeAudioChunkLifecycle(),
        audioBufferTimings: window.__audioBufferTimings || {},
        audioPlaybackTimings: {
          summary: window.__audioPlaybackTimings ? {
            totalChunks: window.__audioPlaybackTimings.chunks?.length || 0,
            successCount: window.__audioPlaybackTimings.playbackSuccessCount || 0,
            errorCount: window.__audioPlaybackTimings.playbackErrorCount || 0,
            totalDuration: window.__audioPlaybackTimings.totalDuration || 0
          } : {}
        },
        prematureStopSignals: window.__prematureStopSignals || [],
        audioCompletionStats: window.__audioCompletionStats || {}
      };
      
      return JSON.stringify(data, null, 2);
    } catch (e) {
      console.error('[AUDIO-CUTOFF-DIAG] Error exporting diagnostics', e);
    }
  }
  return '{}';
}

// Initialize on module load if we're in browser environment
if (typeof window !== 'undefined') {
  initAudioCutoffDiagnostics();
}

/**
 * Install global event listeners to monitor all audio elements
 */
function installGlobalAudioElementListeners(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Function to monitor newly created audio elements
  const monitorNewAudioElements = () => {
    const audioElements = document.querySelectorAll('audio:not([data-diag-monitored="true"])');
    audioElements.forEach((audioElement) => {
      // Skip already monitored elements
      if (audioElement.hasAttribute('data-diag-monitored')) return;
      
      // Mark as monitored
      audioElement.setAttribute('data-diag-monitored', 'true');
      
      // Create a unique ID for this element
      const elementId = `audio-element-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      audioElement.setAttribute('data-diag-id', elementId);
      
      // Install event listeners for all relevant events
      installAudioElementEventListeners(audioElement as HTMLAudioElement, elementId);
      
      console.log(`[AUDIO-CUTOFF-DIAG] Monitoring new audio element: ${elementId}`);
      
      // Also log to audioLogger for persistence
      audioLogger.logUserInteraction('audio-element-monitoring-started', {
        elementId,
        src: (audioElement as HTMLAudioElement).src,
        timestamp: Date.now()
      });
    });
  };
  
  // Initially monitor any existing audio elements
  monitorNewAudioElements();
  
  // Set up MutationObserver to detect new audio elements
  const observer = new MutationObserver((mutations) => {
    let shouldCheckAudio = false;
    
    // Check if any mutations might have added audio elements
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        shouldCheckAudio = true;
      }
    });
    
    if (shouldCheckAudio) {
      monitorNewAudioElements();
    }
  });
  
  // Start observing the entire document for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('[AUDIO-CUTOFF-DIAG] Installed global audio element monitoring');
}

/**
 * Install event listeners on a specific audio element
 */
function installAudioElementEventListeners(audioElement: HTMLAudioElement, elementId: string): void {
  if (!audioElement) return;
  
  // Define all the events we want to monitor
  const events = [
    // Playback events
    'play', 'playing', 'pause', 'ended', 'seeked',
    // Loading events
    'loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough',
    // Error events
    'error', 'stalled', 'suspend', 'waiting', 'abort',
    // Progress events
    'progress', 'timeupdate', 'durationchange',
    // Other events
    'volumechange', 'ratechange', 'emptied'
  ];
  
  // Log monitoring start time with audio logger
  audioLogger.logUserInteraction('audio-monitoring-started', {
    elementId,
    timestamp: Date.now()
  });
  
  // Keep track of last timeupdate to avoid logging too frequently
  let lastTimeupdateLog = 0;
  
  // Create handlers for each event type
  events.forEach(eventType => {
    audioElement.addEventListener(eventType, () => {
      // Current element state
      const currentState = {
        currentTime: audioElement.currentTime,
        duration: audioElement.duration,
        ended: audioElement.ended,
        paused: audioElement.paused,
        muted: audioElement.muted,
        readyState: audioElement.readyState,
        networkState: audioElement.networkState,
        error: audioElement.error,
        timestamp: Date.now()
      };
      
      // Handle special case for timeupdate to avoid too many logs
      if (eventType === 'timeupdate') {
        const now = Date.now();
        // Only log every second
        if (now - lastTimeupdateLog < 1000) {
          return;
        }
        lastTimeupdateLog = now;
      }
      
      // Log event information
      if (DIAGNOSTICS_DETAIL_LEVEL >= 2 || 
          ['error', 'stalled', 'waiting', 'ended'].includes(eventType)) {
        console.log(`[AUDIO-CUTOFF-DIAG] Element ${elementId} event: ${eventType}`, currentState);
      }
      
      // Special handling for critical events
      if (eventType === 'error' && audioElement.error) {
        // Log detailed error information
        console.error(`[AUDIO-CUTOFF-DIAG] Audio element error:`, {
          elementId,
          errorCode: audioElement.error.code,
          errorMessage: decodeMediaErrorCode(audioElement.error.code),
          currentTime: audioElement.currentTime,
          duration: audioElement.duration,
          src: audioElement.src
        });
        
        // Log to audioLogger for persistence
        audioLogger.logError('audio_element_error', `Audio element error: ${decodeMediaErrorCode(audioElement.error.code)}`, {
          componentName: 'AudioElementDiagnostics',
          context: {
            elementId,
            errorCode: audioElement.error.code,
            errorMessage: decodeMediaErrorCode(audioElement.error.code),
            currentTime: audioElement.currentTime,
            duration: audioElement.duration,
            src: audioElement.src
          }
        });
      }
      
      // For ended event, check if it ended prematurely
      if (eventType === 'ended') {
        // Get expected duration if available
        const audioBufferTimings = window.__audioBufferTimings;
        const expectedDuration = audioBufferTimings?.expectedTotalDuration || 0;
        
        if (expectedDuration > 0 && audioElement.duration > 0) {
          // Check for premature ending
          const completionRatio = audioElement.duration / expectedDuration;
          if (completionRatio < 0.95) {
            console.warn(`[AUDIO-CUTOFF-DIAG] Potential premature ending detected:`, {
              elementId,
              actualDuration: audioElement.duration,
              expectedDuration,
              completionRatio,
              src: audioElement.src
            });
            
            // Log to audioLogger for persistence
            audioLogger.logUserInteraction('audio-element-premature-ending', {
              elementId,
              actualDuration: audioElement.duration,
              expectedDuration,
              completionRatio,
              src: audioElement.src
            });
          }
        }
      }
      
      // Log to audio logger for persistent diagnostics
      if (['play', 'pause', 'ended', 'error', 'stalled', 'waiting'].includes(eventType)) {
        audioLogger.logAudioElementEvent({
          eventType: eventType as 'play' | 'pause' | 'ended' | 'error' | 'stalled' | 'waiting',
          currentTime: audioElement.currentTime,
          duration: audioElement.duration,
          readyState: audioElement.readyState,
          networkState: audioElement.networkState,
          src: audioElement.src,
          error: audioElement.error,
          elementId
        });
      }
    });
  });
  
  // Track buffering state (important for detecting stalls)
  if (DIAGNOSTICS_DETAIL_LEVEL >= 2) {
    // Periodically check buffer state
    const bufferCheckInterval = setInterval(() => {
      if (!audioElement || audioElement.readyState === 0) {
        // Element was removed or not initialized
        clearInterval(bufferCheckInterval);
        return;
      }
      
      // Calculate buffer ahead
      const bufferedAhead = getBufferedTimeAhead(audioElement);
      
      // Log if buffer is low
      if (bufferedAhead !== null && bufferedAhead < 0.5 && !audioElement.paused) {
        console.warn(`[AUDIO-CUTOFF-DIAG] Low buffer for ${elementId}: ${bufferedAhead.toFixed(2)}s ahead`);
        
        // Log to audioLogger if buffer is critically low
        if (bufferedAhead < 0.1) {
          audioLogger.logUserInteraction('audio-element-buffer-critical', {
            elementId,
            bufferedAhead,
            currentTime: audioElement.currentTime,
            duration: audioElement.duration
          });
        }
      }
    }, 500);
  }
}

/**
 * Get the amount of buffered time ahead of current playback position
 */
function getBufferedTimeAhead(audio: HTMLAudioElement): number | null {
  if (!audio || !audio.buffered || audio.buffered.length === 0) {
    return null;
  }
  
  // Find the buffer range that contains the current time
  for (let i = 0; i < audio.buffered.length; i++) {
    const start = audio.buffered.start(i);
    const end = audio.buffered.end(i);
    
    if (audio.currentTime >= start && audio.currentTime <= end) {
      // Return seconds of buffer ahead of current position
      return end - audio.currentTime;
    }
  }
  
  return null;
}

/**
 * Monkey patch AudioContext to monitor creation and state changes
 */
function monkeyPatchAudioContext(): void {
  if (typeof window === 'undefined' || !window.AudioContext) return;
  
  // Save the original constructor
  const OriginalAudioContext = window.AudioContext;
  
  // Replace with our instrumented version
  window.AudioContext = function(contextOptions?: AudioContextOptions) {
    console.log('[AUDIO-CUTOFF-DIAG] Creating new AudioContext');
    
    // Create the original context
    const context = new OriginalAudioContext(contextOptions);
    
    // Log creation with audio logger
    audioLogger.logAudioContextEvent({
      state: context.state,
      sampleRate: context.sampleRate,
      baseLatency: context.baseLatency
    });
    
    // Monitor state changes
    context.addEventListener('statechange', () => {
      console.log(`[AUDIO-CUTOFF-DIAG] AudioContext state changed to: ${context.state}`);
      
      // Log to audioLogger for persistence
      audioLogger.logAudioContextEvent({
        state: context.state,
        sampleRate: context.sampleRate,
        baseLatency: context.baseLatency
      });
    });
    
    // Monkey patch key methods
    const originalCreateBufferSource = context.createBufferSource;
    context.createBufferSource = function(...args) {
      const source = originalCreateBufferSource.apply(this, args);
      
      // Instrument the start method
      const originalStart = source.start;
      source.start = function(when?: number, offset?: number, duration?: number) {
        if (DIAGNOSTICS_DETAIL_LEVEL >= 2) {
          console.log('[AUDIO-CUTOFF-DIAG] AudioBufferSourceNode starting', {
            buffer: source.buffer ? {
              duration: source.buffer.duration,
              length: source.buffer.length,
              numberOfChannels: source.buffer.numberOfChannels,
              sampleRate: source.buffer.sampleRate
            } : null,
            when,
            offset,
            duration
          });
        }
        
        // Call original start method
        return originalStart.call(this, when, offset, duration);
      };
      
      // Monitor ended event
      source.addEventListener('ended', () => {
        if (DIAGNOSTICS_DETAIL_LEVEL >= 2 && source.buffer) {
          console.log('[AUDIO-CUTOFF-DIAG] AudioBufferSourceNode ended', {
            duration: source.buffer.duration,
            timestamp: Date.now()
          });
        }
      });
      
      return source;
    };
    
    return context;
  } as unknown as typeof AudioContext;
  
  // Restore the prototype chain
  window.AudioContext.prototype = OriginalAudioContext.prototype;
  
  console.log('[AUDIO-CUTOFF-DIAG] AudioContext monitoring enabled');
}

/**
 * Decode MediaError codes to human-readable messages
 */
function decodeMediaErrorCode(code: number): string {
  switch (code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return 'MEDIA_ERR_ABORTED: Fetching process aborted by user';
    case MediaError.MEDIA_ERR_NETWORK:
      return 'MEDIA_ERR_NETWORK: Network error while fetching the resource';
    case MediaError.MEDIA_ERR_DECODE:
      return 'MEDIA_ERR_DECODE: Error decoding the media resource';
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return 'MEDIA_ERR_SRC_NOT_SUPPORTED: Media type not supported';
    default:
      return `Unknown error code: ${code}`;
  }
}

const audioCutoffDiagnostics = {
  ENABLE_AUDIO_CUTOFF_DIAGNOSTICS,
  DIAGNOSTICS_DETAIL_LEVEL,
  DIAGNOSTIC_OPTIONS,
  initAudioCutoffDiagnostics,
  analyzeAudioCutoffPotential,
  estimateAudioDuration,
  analyzeTextAudioCorrelation,
  exportAudioCutoffDiagnostics
};

export default audioCutoffDiagnostics;