// src/hooksV11/webrtc-audio-integration.ts

import audioLogger from './audio-logger';
import audioService from './audio-service';
import { 
  createAudioStateTracker, 
  createAudioCompletionPromise, 
  MessageTracker, 
  AudioStateTracker,
  // Enhanced diagnostics imports
  startAudioSession,
  addAudioSegment,
  startPlayingSegment,
  // completeSegment,  // Unused but available for future enhancements
  completeAudioSession,
  // addWaveformSample, // Unused but available for future enhancements
  addSessionCheckpoint
} from './audio-state-tracker';

// Extend the Window interface to include our custom properties
declare global {
  interface Window {
    __webrtcAudioDiagnostics?: {
      getLogs: () => Array<{timestamp: number, event: string, data: Record<string, unknown>}>;
      getLogsSince: (timestamp: number) => Array<{timestamp: number, event: string, data: Record<string, unknown>}>;
      getStopEvents: () => Array<{timestamp: number, event: string, data: Record<string, unknown>}>;
      getCutoffEvents: () => Array<{timestamp: number, event: string, data: Record<string, unknown>}>;
      clearLogs: () => void;
    };
    __lastChunkTimestamp?: number;
  }
}

// Import the diagnostics configuration
import { ENABLE_AUDIO_CUTOFF_DIAGNOSTICS, DIAGNOSTICS_DETAIL_LEVEL } from './audio-cutoff-diagnostics';

/**
 * WebRTC Audio Integration
 * 
 * This utility enhances WebRTC audio handling with real-time monitoring and improved
 * completion detection to prevent premature audio cutoffs.
 */

// DIAGNOSTIC LOGGING SYSTEM
// Comprehensive logging to help diagnose premature audio stops
const ENABLE_ENHANCED_DIAGNOSTICS = ENABLE_AUDIO_CUTOFF_DIAGNOSTICS;

// Diagnostic session tracking
let diagnosticSessionId: string | null = null;

// Create diagnostic log buffer to prevent console spam
const diagnosticLogs: {timestamp: number, event: string, data: Record<string, unknown>}[] = [];
const MAX_DIAGNOSTIC_LOGS = 1000;

// Log with proper formatting and add to diagnostic buffer
function logDiagnostic(event: string, data: Record<string, unknown> = {}, forceConsole = false) {
  if (!ENABLE_ENHANCED_DIAGNOSTICS) return;
  
  const timestamp = Date.now();
  const fullData = {
    ...data,
    timestamp,
    timestampISO: new Date(timestamp).toISOString(),
    audioServiceState: audioService.getState()
  };
  
  // Add to log buffer
  diagnosticLogs.push({timestamp, event, data: fullData});
  if (diagnosticLogs.length > MAX_DIAGNOSTIC_LOGS) {
    diagnosticLogs.shift();
  }
  
  // Format for console
  const logPrefix = `[AUDIO-DIAG-${event}]`;
  
  // Only log to console for important events or if forced
  if (forceConsole || 
      event.includes('STOP') || 
      event.includes('CUTOFF') || 
      event.includes('ERROR') ||
      event.includes('GAP')) {
    console.warn(logPrefix, fullData);
    
    // Log to audio logger for persistent tracking
    audioLogger.logAudioDiagnostics(event, JSON.stringify(fullData));
  }
}

// Expose diagnostic log buffer through window for debugging
if (typeof window !== 'undefined') {
  window.__webrtcAudioDiagnostics = {
    getLogs: () => diagnosticLogs,
    getLogsSince: (timestamp: number) => diagnosticLogs.filter(log => log.timestamp >= timestamp),
    getStopEvents: () => diagnosticLogs.filter(log => log.event.includes('STOP')),
    getCutoffEvents: () => diagnosticLogs.filter(log => log.event.includes('CUTOFF')),
    clearLogs: () => { diagnosticLogs.length = 0; }
  };
}

// Initialize global message tracker
const messageTracker = new MessageTracker();

// Keep track of the state tracker instance
let audioStateTracker: AudioStateTracker | null = null;

// ID mapping between WebRTC message IDs and our internal tracking IDs
const messageIdMap = new Map<string, string>();

// Track the current active WebRTC message ID - can be string or numeric format
let currentWebRTCMessageId: string | null = null;

// Also store numeric format of message IDs for direct comparison
let currentNumericMessageId: number | null = null;

/**
 * Initialize audio monitoring for a WebRTC audio stream
 * @param stream The WebRTC audio stream to monitor
 * @param options Configuration options
 */
export function initializeWebRTCAudioMonitoring(
  stream: MediaStream,
  options: {
    label?: string;
    onAudioStateChange?: (isPlaying: boolean) => void;
  } = {}
): () => void {
  // Clean up any existing tracker
  if (audioStateTracker) {
    audioStateTracker.dispose();
    audioStateTracker = null;
  }
  
  const label = options.label || 'webrtc-audio';
  
  console.log(`[WEBRTC-AUDIO-INTEGRATION] Initializing WebRTC audio monitoring for ${label}`);
  
  // Reset ID mappings to ensure clean state
  messageIdMap.clear();
  currentWebRTCMessageId = null;
  currentNumericMessageId = null;
  
  // Create new audio state tracker
  audioStateTracker = createAudioStateTracker(stream, {
    label,
    silenceThreshold: 5,
    consistentSilenceThreshold: 3
  });
  
  // Register state change handler
  const unsubscribe = audioStateTracker.addStateChangeListener((isPlaying) => {
    console.log(`[WEBRTC-AUDIO-INTEGRATION] Audio state changed to: ${isPlaying ? 'playing' : 'inactive'}`);
    
    // Track this state change
    audioLogger.logUserInteraction('webrtc-audio-state-change', {
      isPlaying,
      timestamp: Date.now(),
      timeSinceLastActive: audioStateTracker?.getTimeSinceLastActive() || 0
    });
    
    // Call external handler if provided
    if (options.onAudioStateChange) {
      options.onAudioStateChange(isPlaying);
    }
  });
  
  // Return cleanup function
  return () => {
    if (audioStateTracker) {
      unsubscribe();
      audioStateTracker.dispose();
      audioStateTracker = null;
    }
    
    // Clear message ID mappings
    messageIdMap.clear();
    currentWebRTCMessageId = null;
    currentNumericMessageId = null;
  };
}

/**
 * Process an audio chunk from WebRTC
 * @param messageId The message ID this chunk belongs to
 * @param audioData The raw audio data
 */
export function processAudioChunk(messageId: string, audioData: string): void {
  // Initialize diagnostic session if needed
  if (ENABLE_AUDIO_CUTOFF_DIAGNOSTICS && !diagnosticSessionId) {
    diagnosticSessionId = startAudioSession(messageId, {
      source: 'webrtc',
      type: 'audio-chunk-processing'
    });
    
    console.log(`[WEBRTC-AUDIO-INTEGRATION] Started diagnostic session: ${diagnosticSessionId}`);
  }
  try {
    // IMPORTANT FIX: Always use consistent ID formats and ensure numeric conversion is reliable
    const parsedNumericId = parseInt(messageId, 10);
    const isNumericId = !isNaN(parsedNumericId);
    
    // Calculate audio data size for diagnostics
    const audioDataSize = audioData.length;
    
    // Create diagnostic data for chunk processing
    const chunkDiagnostics = {
      messageId,
      numericId: isNumericId ? parsedNumericId : null,
      audioDataSize,
      estimatedDurationMs: null, // Will calculate later
      isNewMessage: false,
      mappingsCount: messageIdMap.size,
      currentWebRTCMessageId,
      currentNumericMessageId,
      isFirstChunk: messageIdMap.size === 0
    };
    
    // Output detailed log on first chunk for diagnostics
    const shouldLogDetailed = messageIdMap.size === 0;
    if (shouldLogDetailed) {
      console.log(`[WEBRTC-AUDIO-INTEGRATION] First chunk received with message ID: ${messageId}${isNumericId ? ` (numeric: ${parsedNumericId})` : ''}`);
      logDiagnostic('FIRST_CHUNK', chunkDiagnostics, true);
    }
    
    // Check if this is a new message ID using both string and numeric comparisons
    const isNewMessage = 
      !currentWebRTCMessageId || 
      (currentWebRTCMessageId !== messageId && 
       (isNumericId ? currentNumericMessageId !== parsedNumericId : true));
    
    // Update diagnostics
    chunkDiagnostics.isNewMessage = isNewMessage;
    
    if (isNewMessage) {
      // Store both string and numeric forms of the message ID
      currentWebRTCMessageId = messageId;
      if (isNumericId) {
        currentNumericMessageId = parsedNumericId;
      } else {
        currentNumericMessageId = null;
      }
      
      // Log transition between messages
      if (messageIdMap.size > 0) {
        console.log(`[WEBRTC-AUDIO-INTEGRATION] Detected new WebRTC message ID: ${messageId}${isNumericId ? ` (numeric: ${parsedNumericId})` : ''}`);
        logDiagnostic('NEW_MESSAGE', {
          previousMappingCount: messageIdMap.size,
          newMessageId: messageId,
          numericId: isNumericId ? parsedNumericId : null
        }, true);
      }
      
      // Create a consistent internal ID format
      const internalId = `webrtc-${messageId}`;
      
      // IMPROVED: Clear any previous mappings to ensure clean state
      messageIdMap.clear();
      
      // Map the WebRTC ID to our internal ID in BOTH string and numeric forms
      messageIdMap.set(messageId, internalId);
      
      // Also map numeric form for direct comparison with stop signals
      if (isNumericId) {
        // Store both as string and as actual number
        messageIdMap.set(parsedNumericId.toString(), internalId);
        
        // Log all mappings for debug
        console.log(`[WEBRTC-AUDIO-INTEGRATION] Created mappings for message ID:
          - Original: ${messageId} → ${internalId}
          - Numeric string: ${parsedNumericId.toString()} → ${internalId}`);
          
        logDiagnostic('ID_MAPPINGS_CREATED', {
          messageId,
          numericId: parsedNumericId,
          internalId,
          mappings: Array.from(messageIdMap.entries())
        });
      }
      
      // Use this ID in our message tracker and audio service
      // IMPORTANT: Always recreate tracking on new messages
      // Start new message tracking even if there are active messages
      messageTracker.trackMessage(internalId, 1); // Initial guess of 1 chunk
      
      // Signal to audio service this is a new message
      audioService.startNewMessage(internalId);
      
      // Start message playback
      messageTracker.startPlayingMessage(internalId);
      
      console.log(`[WEBRTC-AUDIO-INTEGRATION] Started tracking new message: ${messageId} (internal: ${internalId})`);
      
      // Log detailed diagnostic data for message start
      logDiagnostic('MESSAGE_START', {
        messageId,
        numericId: isNumericId ? parsedNumericId : null,
        internalId,
        hasExistingMessages: messageTracker.hasActiveMessages(),
        messageTrackerState: messageTracker.getDebugInfo()
      }, true);
    }
    
    // Get the internal ID corresponding to this WebRTC message ID with better error handling
    let internalId = messageIdMap.get(messageId);
    
    // If no mapping found directly, try with numeric format
    if (!internalId && isNumericId) {
      internalId = messageIdMap.get(parsedNumericId.toString());
      if (internalId) {
        logDiagnostic('ID_FOUND_VIA_NUMERIC', {
          messageId,
          numericId: parsedNumericId,
          internalId
        });
      }
    }
    
    // Final fallback - just use the original with webrtc prefix
    if (!internalId) {
      internalId = `webrtc-${messageId}`;
      console.warn(`[WEBRTC-AUDIO-INTEGRATION] No internal ID mapping found for ${messageId}, using generated fallback: ${internalId}`);
      
      // Add this mapping for future reference
      messageIdMap.set(messageId, internalId);
      if (isNumericId) {
        messageIdMap.set(parsedNumericId.toString(), internalId);
      }
      
      // Log this unusual situation
      logDiagnostic('ID_MAPPING_MISSING', {
        messageId,
        numericId: isNumericId ? parsedNumericId : null,
        generatedInternalId: internalId,
        existingMappings: Array.from(messageIdMap.entries())
      }, true);
    }
    
    // Update chunk count for the message
    messageTracker.completeChunk(internalId);
    
    // Decode the base64 audio data
    const binaryString = atob(audioData);
    const length = binaryString.length;
    const bytes = new Uint8Array(length);
    
    // Convert binary to bytes
    for (let i = 0; i < length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Convert to ArrayBuffer
    const audioBuffer = bytes.buffer;
    
    // Calculate estimated duration for PCM16 audio at 24kHz
    const estimatedDurationMs = (length / 2 / 24000) * 1000;
    // Update diagnostic object with the calculated duration
    (chunkDiagnostics as Record<string, unknown>).estimatedDurationMs = estimatedDurationMs;
    
    // Enhanced diagnostics - track audio segment if enabled
    if (ENABLE_AUDIO_CUTOFF_DIAGNOSTICS && diagnosticSessionId) {
      // Add segment to session tracking
      const segmentId = addAudioSegment(
        diagnosticSessionId,
        length,                   // buffer size in bytes
        estimatedDurationMs / 1000, // expected duration in seconds
        24000                      // sample rate
      );
      
      // Mark segment as playing
      if (segmentId !== 'disabled' && segmentId !== 'invalid-session') {
        startPlayingSegment(segmentId, diagnosticSessionId);
        
        // Add metadata to audio buffer for tracking - first cast to unknown, then to Record<string, unknown>
        (audioBuffer as unknown as Record<string, unknown>).__diagnosticSegmentId = segmentId;
        (audioBuffer as unknown as Record<string, unknown>).__diagnosticSessionId = diagnosticSessionId;
        
        if (DIAGNOSTICS_DETAIL_LEVEL >= 3) {
          console.log(`[WEBRTC-AUDIO-INTEGRATION] Added diagnostic tracking to segment ${segmentId}`);
        }
      }
    }
    
    // Generate a unique chunk ID
    const chunkId = `${internalId}-chunk-${Date.now()}`;
    
    // Track chunk timing
    const chunkTimestamp = Date.now();
    
    // Log detailed chunk diagnostics periodically or for larger chunks
    const isLargeChunk = length > 2000;
    if (isLargeChunk || Math.random() < 0.2) { // Log more chunks (20%) for better diagnostics
      logDiagnostic('CHUNK_DETAILS', {
        messageId,
        internalId,
        chunkId,
        byteLength: length,
        estimatedDurationMs,
        timestamp: chunkTimestamp
      });
    }
    
    // Queue in audio service
    audioService.queueAudioData(audioBuffer, chunkId, internalId);
    
    // Log chunk received
    if (Math.random() < 0.1) { // Only log ~10% of chunks to avoid spam
      console.log(`[WEBRTC-AUDIO-INTEGRATION] Processed audio chunk for message ${messageId} (internal: ${internalId})`);
    }
    
    // Detect potential gaps between chunks
    if (typeof window !== 'undefined' && window.__lastChunkTimestamp) {
      const timeSinceLastChunk = chunkTimestamp - window.__lastChunkTimestamp;
      if (timeSinceLastChunk > 300) { // Warn about gaps over 300ms
        logDiagnostic('CHUNK_GAP_DETECTED', {
          messageId,
          internalId,
          chunkId,
          gapMs: timeSinceLastChunk,
          previousTimestamp: window.__lastChunkTimestamp,
          currentTimestamp: chunkTimestamp
        }, true);
      }
    }
    
    // Store timestamp for gap detection
    if (typeof window !== 'undefined') {
      window.__lastChunkTimestamp = chunkTimestamp;
    }
  } catch (error) {
    console.error(`[WEBRTC-AUDIO-INTEGRATION] Error processing audio chunk:`, error);
    
    logDiagnostic('CHUNK_PROCESSING_ERROR', {
      messageId,
      error: (error as Error).message,
      stack: (error as Error).stack,
      timestamp: Date.now()
    }, true);
    
    // Create a properly typed error context that includes messageId
    const errorContext = {
      componentName: 'WebRTCAudioIntegration',
      operationName: 'processAudioChunk',
      context: { messageId } as Record<string, unknown>
    };
    
    // Add messageId to the error context using Record<string, unknown> type
    (errorContext as Record<string, unknown>).messageId = messageId;
    
    audioLogger.logError('audio-chunk-processing-error', `Error processing audio chunk: ${(error as Error).message}`, errorContext);
  }
}

/**
 * Handle an audio stop signal from WebRTC
 * @param messageId The message ID this stop signal belongs to
 */
export function handleAudioStopSignal(messageId: string): void {
  // Record a stop signal in enhanced diagnostics
  if (ENABLE_AUDIO_CUTOFF_DIAGNOSTICS && diagnosticSessionId) {
    // Add a checkpoint for stop signal received
    addSessionCheckpoint('stop_signal_received', { 
      messageId,
      timestamp: Date.now(),
      timestampISO: new Date().toISOString()
    }, diagnosticSessionId);
  }
  // Create timestamp immediately for timing diagnostics
  const stopSignalReceivedTime = Date.now();
  
  // Try to handle numeric ID comparison
  const parsedNumericId = parseInt(messageId, 10);
  const isNumericId = !isNaN(parsedNumericId);
  
  // Check direct match with current numeric ID
  const isCurrentNumericMatch = 
    isNumericId && 
    currentNumericMessageId !== null && 
    parsedNumericId === currentNumericMessageId;
  
  // Create diagnostic object to track stop signal processing
  const stopSignalDiagnostics = {
    messageId,
    numericId: isNumericId ? parsedNumericId : null,
    isCurrentNumericMatch,
    currentWebRTCMessageId,
    currentNumericMessageId,
    receivedTimestamp: stopSignalReceivedTime,
    receivedTimestampISO: new Date(stopSignalReceivedTime).toISOString(),
    mappingsCount: messageIdMap.size,
    mappings: Array.from(messageIdMap.entries()),
    internalIdFound: false,
    internalIdSource: null,
    internalId: null,
    audioServiceState: audioService.getState(),
    messageTrackerState: messageTracker.getDebugInfo(),
    wasProcessed: false,
    processingPath: null,
    timeSinceLastChunk: typeof window !== 'undefined' && window.__lastChunkTimestamp ? 
      stopSignalReceivedTime - window.__lastChunkTimestamp : null
  };
  
  // Look up in various ways
  let internalId = messageIdMap.get(messageId);
  
  if (internalId) {
    stopSignalDiagnostics.internalIdFound = true;
    // Use Record<string, unknown> type for assignment
    (stopSignalDiagnostics as Record<string, unknown>).internalIdSource = 'direct_lookup';
    (stopSignalDiagnostics as Record<string, unknown>).internalId = internalId;
  }
  
  // If not found with direct lookup, try with the numeric string version
  if (!internalId && isNumericId) {
    internalId = messageIdMap.get(parsedNumericId.toString());
    
    if (internalId) {
      stopSignalDiagnostics.internalIdFound = true;
      // Use Record<string, unknown> type for assignment
      (stopSignalDiagnostics as Record<string, unknown>).internalIdSource = 'numeric_lookup';
      (stopSignalDiagnostics as Record<string, unknown>).internalId = internalId;
    }
  }
  
  // AGGRESSIVE LOOKUP: Try ALL possible formats
  if (!internalId) {
    // Try with webrtc- prefix
    const prefixedId = `webrtc-${messageId}`;
    
    // Check if any value in the map equals this prefixed ID
    for (const [, value] of Array.from(messageIdMap.entries())) {
      if (value === prefixedId) {
        internalId = value;
        console.log(`[WEBRTC-AUDIO-INTEGRATION] Found internal ID ${internalId} by reverse lookup of ${prefixedId}`);
        
        stopSignalDiagnostics.internalIdFound = true;
        (stopSignalDiagnostics as Record<string, unknown>).internalIdSource = 'reverse_lookup';
        (stopSignalDiagnostics as Record<string, unknown>).internalId = internalId;
        break;
      }
    }
    
    // If still not found, check if any key starts with our messageId
    if (!internalId) {
      for (const [key, value] of Array.from(messageIdMap.entries())) {
        // Check if either the numeric part matches or if this is a substring
        if ((isNumericId && key.includes(parsedNumericId.toString())) || 
            key.includes(messageId) || 
            messageId.includes(key)) {
          internalId = value;
          console.log(`[WEBRTC-AUDIO-INTEGRATION] Found internal ID ${internalId} by partial match with key ${key}`);
          
          stopSignalDiagnostics.internalIdFound = true;
          (stopSignalDiagnostics as Record<string, unknown>).internalIdSource = 'partial_match';
          (stopSignalDiagnostics as Record<string, unknown>).internalId = internalId;
          (stopSignalDiagnostics as Record<string, unknown>).matchedKey = key;
          break;
        }
      }
    }
  }
  
  // Enhanced logging for diagnostics
  console.log(`[WEBRTC-AUDIO-INTEGRATION] Received stop signal for WebRTC message ID: ${messageId}${isNumericId ? ` (numeric: ${parsedNumericId})` : ''}`);
  console.log(`[WEBRTC-AUDIO-INTEGRATION] Mapped to internal ID: ${internalId || 'not found'}`);
  console.log(`[WEBRTC-AUDIO-INTEGRATION] Current WebRTC message ID: ${currentWebRTCMessageId} (numeric: ${currentNumericMessageId})`);
  console.log(`[WEBRTC-AUDIO-INTEGRATION] Is current numeric match: ${isCurrentNumericMatch}`);
  
  // Log detailed stop signal received diagnostic
  logDiagnostic('STOP_SIGNAL_RECEIVED', stopSignalDiagnostics, true);
  
  // ALWAYS HANDLE STOP SIGNALS
  // If any audio is actively playing, stop it regardless of ID matching
  // This ensures we never ignore a legitimate stop signal
  const audioServiceState = audioService.getState();
  if (audioServiceState.isPlaying || audioServiceState.queueLength > 0) {
    console.log(`[WEBRTC-AUDIO-INTEGRATION] Audio is actively playing or queued - processing stop signal`);
    
    // Log that we're processing this stop signal due to active audio
    logDiagnostic('STOP_SIGNAL_PROCESSING_AUDIO_ACTIVE', {
      messageId,
      audioServiceState,
      isActiveAudio: true,
      currentInternalId: internalId,
      audioServiceCurrentId: audioServiceState.currentMessageId
    }, true);
    
    if (internalId) {
      // We found a mapping, use it
      console.log(`[WEBRTC-AUDIO-INTEGRATION] Using mapped internal ID: ${internalId}`);
      audioService.handleStopSignal(internalId);
      
      stopSignalDiagnostics.wasProcessed = true;
      (stopSignalDiagnostics as Record<string, unknown>).processingPath = 'mapped_id_with_active_audio';
    }
    else if (audioServiceState.currentMessageId) {
      // Use audio service's current message ID as fallback
      console.log(`[WEBRTC-AUDIO-INTEGRATION] Using audio service's current ID: ${audioServiceState.currentMessageId}`);
      audioService.handleStopSignal(audioServiceState.currentMessageId);
      
      stopSignalDiagnostics.wasProcessed = true;
      (stopSignalDiagnostics as Record<string, unknown>).processingPath = 'audio_service_current_id';
    }
    else {
      // Ultimate fallback - use a generated ID
      const fallbackId = `webrtc-${messageId}`;
      console.log(`[WEBRTC-AUDIO-INTEGRATION] Using generated fallback ID: ${fallbackId}`);
      audioService.handleStopSignal(fallbackId);
      
      stopSignalDiagnostics.wasProcessed = true;
      (stopSignalDiagnostics as Record<string, unknown>).processingPath = 'generated_fallback_id';
    }
    
    // Log final stop signal processing diagnostic
    logDiagnostic('STOP_SIGNAL_PROCESSED', stopSignalDiagnostics, true);
    return;
  }
  
  // Only reach here if no audio is playing - implement standard behavior
  
  // If we have a mapping and the message tracker should apply this stop signal
  if (internalId && messageTracker.shouldApplyStopSignal(internalId)) {
    console.log(`[WEBRTC-AUDIO-INTEGRATION] Handling stop signal for message: ${messageId} (internal: ${internalId})`);
    
    // Forward to audio service
    audioService.handleStopSignal(internalId);
    
    stopSignalDiagnostics.wasProcessed = true;
    (stopSignalDiagnostics as Record<string, unknown>).processingPath = 'mapped_id_with_tracker_approval';
    
    // Log stop signal handled through normal path
    logDiagnostic('STOP_SIGNAL_PROCESSED_NORMAL', {
      messageId,
      internalId,
      messageTrackerApproved: true
    });
  } 
  // If this matches the current WebRTC message ID even without a mapping (including numeric match)
  else if (messageId === currentWebRTCMessageId || isCurrentNumericMatch) {
    console.log(`[WEBRTC-AUDIO-INTEGRATION] Handling stop signal for current WebRTC message: ${messageId} (match type: ${isCurrentNumericMatch ? 'numeric' : 'string'})`);
    
    // Forward the stop signal using the current audio service message ID
    if (audioServiceState.currentMessageId) {
      console.log(`[WEBRTC-AUDIO-INTEGRATION] Using audio service's current message ID: ${audioServiceState.currentMessageId}`);
      audioService.handleStopSignal(audioServiceState.currentMessageId);
      
      stopSignalDiagnostics.wasProcessed = true;
      (stopSignalDiagnostics as Record<string, unknown>).processingPath = 'current_webrtc_match_with_service_id';
    } else {
      // Try to use an internal ID format if no current message
      const fallbackInternalId = `webrtc-${messageId}`;
      console.warn(`[WEBRTC-AUDIO-INTEGRATION] No current message ID in audio service, using fallback ID: ${fallbackInternalId}`);
      audioService.handleStopSignal(fallbackInternalId);
      
      stopSignalDiagnostics.wasProcessed = true;
      (stopSignalDiagnostics as Record<string, unknown>).processingPath = 'current_webrtc_match_with_fallback';
    }
    
    // Log stop signal handled through WebRTC ID match
    logDiagnostic('STOP_SIGNAL_PROCESSED_WEBRTC_MATCH', {
      messageId,
      matchType: isCurrentNumericMatch ? 'numeric' : 'string',
      audioServiceId: audioServiceState.currentMessageId
    });
  }
  else {
    // Even for "ignored" stop signals, store info about them for debugging
    console.warn(`[WEBRTC-AUDIO-INTEGRATION] Stop signal for non-current message: ${messageId}`);
    
    // Log the current state of ID mappings - very detailed for diagnosis
    const mappings = Array.from(messageIdMap.entries()).map(([key, value]) => `${key}:${value}`).join(', ');
    console.log(`[WEBRTC-AUDIO-INTEGRATION] Current ID mappings: ${mappings || 'none'}`);
    
    // Always tell audio service about stop signal even if we're ignoring it - audio service might need to know
    const fallbackId = `fallback-stop-${Date.now()}`;
    console.log(`[WEBRTC-AUDIO-INTEGRATION] Sending fallback stop signal: ${fallbackId}`);
    audioService.handleStopSignal(fallbackId);
    
    stopSignalDiagnostics.wasProcessed = true;
    (stopSignalDiagnostics as Record<string, unknown>).processingPath = 'ignored_with_fallback';
    
    // Log missed stop signal detailed diagnostic
    logDiagnostic('STOP_SIGNAL_MISMATCH', {
      messageId, 
      currentWebRTCMessageId,
      mappings,
      audioServiceState,
      fallbackId
    }, true);
    
    // Log this as a diagnostic warning rather than error since it doesn't affect functionality
    console.warn(`[AudioLogger] Stop signal for non-current message: ${messageId} (current: ${currentWebRTCMessageId}). This is normal when audio chunks and stop signals arrive out of order.`);
    
    // Log detailed diagnostic info for debugging premature cutoffs
    audioLogger.logDiagnostic('stop-signal-mismatch', {
      messageId,
      isNumericId,
      parsedNumericId: isNumericId ? parsedNumericId : null,
      internalId,
      currentWebRTCMessageId,
      currentNumericMessageId,
      messageIdMappings: mappings,
      currentMessages: messageTracker.getDebugInfo(),
      audioServiceState: audioServiceState,
      timeSinceLastChunk: typeof window !== 'undefined' && window.__lastChunkTimestamp ? 
        stopSignalReceivedTime - window.__lastChunkTimestamp : null,
      explanation: 'Stop signal received for message ID that does not match current tracking. This usually indicates chunks and stop signals are processed through different paths and is not a functional issue.'
    });
  }
  
  // Final diagnostic log with complete handling information
  logDiagnostic('STOP_SIGNAL_HANDLING_COMPLETE', stopSignalDiagnostics, true);
  
  // Complete diagnostic session if all audio is finished
  if (ENABLE_AUDIO_CUTOFF_DIAGNOSTICS && diagnosticSessionId && 
      !audioServiceState.isPlaying && audioServiceState.queueLength === 0 && 
      audioServiceState.pendingChunksCount === 0 && audioServiceState.receivedStopSignal) {
      
    // Mark session as completed
    completeAudioSession(diagnosticSessionId, 'normal');
    console.log(`[WEBRTC-AUDIO-INTEGRATION] Completed diagnostic session: ${diagnosticSessionId}`);
    diagnosticSessionId = null;
  }
}

/**
 * Create an improved promise that waits for WebRTC audio to complete
 * @param webrtcStream The WebRTC audio stream
 * @returns Promise that resolves when audio is complete
 */
export function createImprovedAudioCompletionPromise(webrtcStream: MediaStream): Promise<void> {
  console.log('[WEBRTC-AUDIO-INTEGRATION] Creating improved audio completion promise');
  
  // Log detailed state at audio completion start
  const startTimestamp = Date.now();
  const initialAudioState = audioService.getState() as unknown as Record<string, unknown>;
  
  // Log detailed diagnostic for audio completion starting
  logDiagnostic('AUDIO_COMPLETION_STARTED', {
    timestamp: startTimestamp,
    timestampISO: new Date(startTimestamp).toISOString(),
    audioState: initialAudioState,
    messageTrackerState: messageTracker.getDebugInfo(),
    audioIsPlaying: initialAudioState.isPlaying,
    pendingChunks: initialAudioState.pendingChunksCount,
    queueLength: initialAudioState.queueLength,
    audioContextState: initialAudioState.audioContextState
  }, true);
  
  // Create a wrapped promise to track completion
  return new Promise((resolve, reject) => {
    // Use the underlying completion promise with monitoring
    createAudioCompletionPromise(webrtcStream, {
      audioState: initialAudioState,
      maxWaitTime: 10000,
      initialDelay: 300,
      label: 'webrtc-session-completion'
    })
    .then(() => {
      const completionTimestamp = Date.now();
      const finalAudioState = audioService.getState();
      const completionDuration = completionTimestamp - startTimestamp;
      
      // Log detailed diagnostic for audio completion success
      logDiagnostic('AUDIO_COMPLETION_SUCCESS', {
        startTimestamp,
        completionTimestamp,
        completionDuration,
        initialAudioState,
        finalAudioState,
        messageTrackerState: messageTracker.getDebugInfo()
      }, true);
      
      resolve();
    })
    .catch((error) => {
      const errorTimestamp = Date.now();
      const errorAudioState = audioService.getState();
      const errorDuration = errorTimestamp - startTimestamp;
      
      // Log detailed diagnostic for audio completion error
      logDiagnostic('AUDIO_COMPLETION_ERROR', {
        startTimestamp,
        errorTimestamp,
        errorDuration,
        error: error.message,
        stack: error.stack,
        initialAudioState,
        errorAudioState,
        messageTrackerState: messageTracker.getDebugInfo()
      }, true);
      
      reject(error);
    });
  });
}

/**
 * End a WebRTC session with reliable audio completion
 * @param webrtcStream The WebRTC audio stream
 * @param disconnectCallback Function to call to disconnect WebRTC after audio completes
 */
export async function endWebRTCSessionWithAudioCompletion(
  webrtcStream: MediaStream,
  disconnectCallback: () => void
): Promise<void> {
  console.log('[WEBRTC-AUDIO-INTEGRATION] Starting WebRTC session ending sequence');
  
  // Create detailed session ending diagnostic data
  const sessionEndingStartTime = Date.now();
  const initialAudioState = audioService.getState();
  const initialMessageTrackerState = messageTracker.getDebugInfo();
  const initialIdMappings = Array.from(messageIdMap.entries());
  
  // Log detailed diagnostic data at session ending start
  logDiagnostic('SESSION_ENDING_STARTED', {
    timestamp: sessionEndingStartTime,
    timestampISO: new Date(sessionEndingStartTime).toISOString(),
    audioState: initialAudioState,
    messageTrackerState: initialMessageTrackerState,
    idMappings: initialIdMappings,
    hasActiveMessages: messageTracker.hasActiveMessages(),
    currentWebRTCMessageId,
    currentNumericMessageId
  }, true);
  
  // Log state before ending
  console.log('Audio service state before ending:', initialAudioState);
  console.log('Message tracker state before ending:', initialMessageTrackerState);
  console.log('Message ID mappings:', initialIdMappings);
  
  try {
    // Wait for audio to complete playing using our improved detector
    const audioCompletionStartTime = Date.now();
    
    logDiagnostic('AUDIO_COMPLETION_WAITING', {
      timestamp: audioCompletionStartTime,
      timeSinceSessionEndingStart: audioCompletionStartTime - sessionEndingStartTime,
      audioState: audioService.getState()
    });
    
    await createImprovedAudioCompletionPromise(webrtcStream);
    
    const audioCompletionEndTime = Date.now();
    const audioCompletionDuration = audioCompletionEndTime - audioCompletionStartTime;
    
    logDiagnostic('AUDIO_COMPLETION_FINISHED', {
      startTime: audioCompletionStartTime,
      endTime: audioCompletionEndTime,
      duration: audioCompletionDuration,
      audioState: audioService.getState()
    });
    
    // Double-check with message tracker if needed
    if (messageTracker.hasActiveMessages()) {
      console.log('[WEBRTC-AUDIO-INTEGRATION] Message tracker shows active messages, waiting a bit longer...');
      
      logDiagnostic('ACTIVE_MESSAGES_AFTER_COMPLETION', {
        timestamp: Date.now(),
        messageTrackerState: messageTracker.getDebugInfo(),
        activeMessages: true,
        audioState: audioService.getState()
      }, true);
      
      // Additional short wait for any final chunks
      const extraWaitStartTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 1000));
      const extraWaitEndTime = Date.now();
      
      logDiagnostic('EXTRA_WAIT_COMPLETED', {
        startTime: extraWaitStartTime,
        endTime: extraWaitEndTime,
        duration: extraWaitEndTime - extraWaitStartTime,
        messageTrackerState: messageTracker.getDebugInfo(),
        audioState: audioService.getState()
      });
    }
    
    console.log('[WEBRTC-AUDIO-INTEGRATION] All audio completed, proceeding with cleanup');
    
    // Add a delay before proceeding with cleanup to ensure audio playback completes
    // This gives any final audio syllables a chance to finish playing
    // 1000ms should provide enough buffer for the final syllable while not being too long
    const FINAL_AUDIO_DELAY = 1000; // 1 second delay
    
    console.log(`[WEBRTC-AUDIO-INTEGRATION] Adding ${FINAL_AUDIO_DELAY}ms delay to ensure audio completion`);
    
    logDiagnostic('FINAL_AUDIO_DELAY_ADDED', {
      timestamp: Date.now(),
      delayMs: FINAL_AUDIO_DELAY,
      audioState: audioService.getState(),
      messageTrackerState: messageTracker.getDebugInfo()
    }, true);
    
    // Wait for the delay to complete
    await new Promise(resolve => setTimeout(resolve, FINAL_AUDIO_DELAY));
    
    // Now continue with cleanup
    // Clean up the message tracker
    messageTracker.cleanup();
    
    // Clean up the audio state tracker
    if (audioStateTracker) {
      audioStateTracker.dispose();
      audioStateTracker = null;
    }
    
    // Clear the ID mappings
    messageIdMap.clear();
    currentWebRTCMessageId = null;
    currentNumericMessageId = null;
    
    const cleanupCompletedTime = Date.now();
    
    logDiagnostic('SESSION_CLEANUP_COMPLETED', {
      timestamp: cleanupCompletedTime,
      sessionEndingDuration: cleanupCompletedTime - sessionEndingStartTime,
      finalAudioState: audioService.getState(),
      messageTrackerCleared: true,
      idMappingsCleared: true,
      includedFinalDelay: true,
      finalDelayMs: FINAL_AUDIO_DELAY
    });
    
    // Now proceed with WebRTC disconnection
    const disconnectStartTime = Date.now();
    
    logDiagnostic('DISCONNECT_INITIATED', {
      timestamp: disconnectStartTime
    });
    
    disconnectCallback();
    
    const disconnectCompleteTime = Date.now();
    
    logDiagnostic('SESSION_ENDING_COMPLETED', {
      startTime: sessionEndingStartTime,
      endTime: disconnectCompleteTime,
      totalDuration: disconnectCompleteTime - sessionEndingStartTime,
      disconnectDuration: disconnectCompleteTime - disconnectStartTime,
      success: true
    }, true);
  } catch (error) {
    // Log detailed error diagnostics
    const errorTime = Date.now();
    
    logDiagnostic('SESSION_ENDING_ERROR', {
      startTime: sessionEndingStartTime,
      errorTime,
      duration: errorTime - sessionEndingStartTime,
      error: (error as Error).message,
      stack: (error as Error).stack,
      audioState: audioService.getState(),
      messageTrackerState: messageTracker.getDebugInfo()
    }, true);
    
    // Still try to perform cleanup and disconnect
    console.error('[WEBRTC-AUDIO-INTEGRATION] Error during session ending:', error);
    
    try {
      // Clean up resources as best we can
      messageTracker.cleanup();
      
      if (audioStateTracker) {
        audioStateTracker.dispose();
        audioStateTracker = null;
      }
      
      messageIdMap.clear();
      currentWebRTCMessageId = null;
      currentNumericMessageId = null;
      
      // Still call disconnect to ensure we don't leave hanging connections
      disconnectCallback();
      
      logDiagnostic('SESSION_ENDING_ERROR_RECOVERY', {
        timestamp: Date.now(),
        performedCleanup: true,
        calledDisconnect: true
      });
    } catch (cleanupError) {
      console.error('[WEBRTC-AUDIO-INTEGRATION] Additional error during cleanup:', cleanupError);
      
      logDiagnostic('SESSION_ENDING_CLEANUP_ERROR', {
        timestamp: Date.now(),
        error: (cleanupError as Error).message,
        stack: (cleanupError as Error).stack
      }, true);
      
      // Re-throw original error
      throw error;
    }
    
    // Re-throw the original error
    throw error;
  }
}

/**
 * Get the current audio levels from the state tracker
 * @returns Current audio level (0-255) or 0 if no tracker
 */
export function getCurrentAudioLevel(): number {
  return audioStateTracker?.getAudioLevel() || 0;
}

/**
 * Check if audio is currently playing according to the state tracker
 * @returns True if audio is playing, false otherwise
 */
export function isAudioCurrentlyPlaying(): boolean {
  return audioStateTracker?.isAudioPlaying() || false;
}

/**
 * Analyzes audio timing and playback to detect potential premature cutoffs
 * This function should be called periodically to check for audio playback issues
 */
export function detectPrematureAudioCutoffs(): void {
  // Only run if diagnostics are enabled
  if (!ENABLE_ENHANCED_DIAGNOSTICS) return;
  
  // Get current audio state
  const currentAudioState = audioService.getState();
  const currentMessageTrackerState = messageTracker.getDebugInfo();
  const now = Date.now();
  
  // Get audio buffer timing info from window globals
  const bufferTimings = typeof window !== 'undefined' ? window.__audioBufferTimings : null;
  const lastChunkTimestamp = typeof window !== 'undefined' ? window.__lastChunkTimestamp : null;
  
  // Create diagnostic data
  const prematureCutoffCheckData = {
    timestamp: now,
    timestampISO: new Date(now).toISOString(),
    audioState: currentAudioState,
    messageTrackerState: currentMessageTrackerState,
    lastChunkReceived: lastChunkTimestamp,
    timeSinceLastChunk: lastChunkTimestamp ? now - lastChunkTimestamp : null,
    bufferTimings: bufferTimings,
    expectedRemainingAudio: false,
    potentialCutoffDetected: false,
    cutoffReason: null
  };
  
  // If we have active audio, always log full state
  if (currentAudioState.isPlaying || currentAudioState.queueLength > 0 || currentAudioState.pendingChunksCount > 0) {
    logDiagnostic('ACTIVE_AUDIO_STATE', prematureCutoffCheckData);
    
    // No cutoff possible if audio is actively playing
    return;
  }
  
  // If the stop signal has been received and there's no active audio, this is normal
  if (currentAudioState.receivedStopSignal) {
    // Normal completion
    return;
  }
  
  // Check for potential cutoff indicators
  
  // 1. No stop signal but audio has ended
  if (!currentAudioState.receivedStopSignal && 
      !currentAudioState.isPlaying && 
      currentAudioState.queueLength === 0 && 
      currentAudioState.pendingChunksCount === 0) {
    
    // Only consider recent audio states
    const timeSinceLastChunk = lastChunkTimestamp ? now - lastChunkTimestamp : null;
    
    // If we received a chunk recently but no stop signal, potential cutoff
    if (timeSinceLastChunk && timeSinceLastChunk < 1000) {
      prematureCutoffCheckData.potentialCutoffDetected = true;
      (prematureCutoffCheckData as Record<string, unknown>).cutoffReason = "recent_chunk_no_stop_signal";
      
      logDiagnostic('POTENTIAL_PREMATURE_CUTOFF', prematureCutoffCheckData, true);
      return;
    }
  }
  
  // 2. MessageTracker shows active messages but no audio playing
  if (messageTracker.hasActiveMessages() && 
      !currentAudioState.isPlaying && 
      currentAudioState.queueLength === 0 && 
      currentAudioState.pendingChunksCount === 0) {
    
    prematureCutoffCheckData.potentialCutoffDetected = true;
    (prematureCutoffCheckData as Record<string, unknown>).cutoffReason = "message_tracker_active_no_audio";
    prematureCutoffCheckData.expectedRemainingAudio = true;
    
    logDiagnostic('POTENTIAL_PREMATURE_CUTOFF', prematureCutoffCheckData, true);
    return;
  }
  
  // 3. Check if audio buffer timing info suggests missing data
  if (bufferTimings && bufferTimings.lastBufferTime) {
    const timeSinceLastBuffer = now - bufferTimings.lastBufferTime;
    
    // If we've recently received buffers with no stop signal and no audio playing
    if (timeSinceLastBuffer < 1000 && 
        !currentAudioState.receivedStopSignal && 
        !currentAudioState.isPlaying) {
      
      prematureCutoffCheckData.potentialCutoffDetected = true;
      (prematureCutoffCheckData as Record<string, unknown>).cutoffReason = "buffers_received_no_stop_signal";
      
      logDiagnostic('POTENTIAL_PREMATURE_CUTOFF', prematureCutoffCheckData, true);
      return;
    }
  }
}

/**
 * Explicitly initialize the advanced audio cutoff diagnostics
 * Call this function at the beginning of a session to start diagnostic tracking
 */
export function initializeAudioCutoffDiagnostics(messageId?: string): string | null {
  if (!ENABLE_AUDIO_CUTOFF_DIAGNOSTICS) return null;
  
  // Clean up any existing session
  if (diagnosticSessionId) {
    completeAudioSession(diagnosticSessionId, 'normal');
  }
  
  // Start a new session
  diagnosticSessionId = startAudioSession(messageId || 'manual-init', {
    source: 'webrtc',
    type: 'audio-cutoff-diagnostics',
    initialized: Date.now(),
    initializedISO: new Date().toISOString()
  });
  
  console.log(`[WEBRTC-AUDIO-INTEGRATION] Initialized audio cutoff diagnostics: ${diagnosticSessionId}`);
  
  return diagnosticSessionId;
}

/**
 * Reset and clean up all diagnostic tracking
 */
export function resetAudioCutoffDiagnostics(): void {
  if (!ENABLE_AUDIO_CUTOFF_DIAGNOSTICS || !diagnosticSessionId) return;
  
  // Complete the current session
  completeAudioSession(diagnosticSessionId, 'forced');
  console.log(`[WEBRTC-AUDIO-INTEGRATION] Reset audio cutoff diagnostics, completed session: ${diagnosticSessionId}`);
  
  // Reset session ID
  diagnosticSessionId = null;
  
  // Clear diagnostic logs
  if (typeof window !== 'undefined' && window.__webrtcAudioDiagnostics) {
    window.__webrtcAudioDiagnostics.clearLogs();
  }
}

// Create the WebRTC audio integration API object
const webRTCAudioIntegration = {
  // Original functions
  initializeWebRTCAudioMonitoring,
  processAudioChunk,
  handleAudioStopSignal,
  createImprovedAudioCompletionPromise,
  endWebRTCSessionWithAudioCompletion,
  getCurrentAudioLevel,
  isAudioCurrentlyPlaying,
  detectPrematureAudioCutoffs,
  
  // Enhanced diagnostics
  initializeAudioCutoffDiagnostics,
  resetAudioCutoffDiagnostics
};

export default webRTCAudioIntegration;