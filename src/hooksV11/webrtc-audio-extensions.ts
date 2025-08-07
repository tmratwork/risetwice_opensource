// src/hooksV11/webrtc-audio-extensions.ts

/**
 * WebRTC Audio Extensions
 * 
 * This file exports the combined WebRTC audio enhancement utilities that
 * improve audio playback reliability and prevent premature audio cutoffs.
 * 
 * Enhanced in V11 with waveform analysis and direct audio monitoring
 * to diagnose audio cutoff issues.
 */

import { 
  createAudioStateTracker, 
  createAudioCompletionPromise, 
  MessageTracker,
  AudioStateTracker,
  AudioStateTrackerOptions,
  // Enhanced audio tracking
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
} from './audio-state-tracker';

import { ENABLE_AUDIO_CUTOFF_DIAGNOSTICS, DIAGNOSTICS_DETAIL_LEVEL } from './audio-cutoff-diagnostics';

import webrtcAudioIntegration from './webrtc-audio-integration';
import { useEnhancedAudioService } from './use-audio-service-enhanced';
import audioLogger from './audio-logger';

// Re-export all the audio enhancement utilities
export {
  // Core audio state tracking
  createAudioStateTracker,
  createAudioCompletionPromise,
  MessageTracker,
  
  // WebRTC integration
  webrtcAudioIntegration,
  
  // React hook
  useEnhancedAudioService,
  
  // Enhanced audio diagnostics
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

// Re-export types
export type {
  AudioStateTracker,
  AudioStateTrackerOptions
};

// Export a standalone init function for non-hook usage
export function initializeAudioMonitoring(stream: MediaStream, options?: AudioStateTrackerOptions): {
  isAudioPlaying: () => boolean;
  getAudioLevel: () => number;
  cleanup: () => void;
} {
  const audioTracker = createAudioStateTracker(stream, options);
  
  return {
    isAudioPlaying: audioTracker.isAudioPlaying,
    getAudioLevel: audioTracker.getAudioLevel,
    cleanup: audioTracker.dispose
  };
}

/**
 * Initialize advanced waveform analysis for audio monitoring
 * Directly analyzes audio output to detect premature cutoffs
 */
export function initializeWaveformAnalysis(stream: MediaStream, options?: {
  messageId?: string;
  sessionId?: string;
  sensitivity?: number;
  analysisInterval?: number;
}): {
  startAnalysis: () => void;
  stopAnalysis: () => void;
  getWaveformData: () => {
    rmsValue: number;
    peakValue: number;
    isSilent: boolean;
    consecutiveSilentFrames: number;
  };
  detectSilence: (durationMs: number) => Promise<boolean>;
} {
  if (!ENABLE_AUDIO_CUTOFF_DIAGNOSTICS) {
    // Return a no-op implementation if diagnostics are disabled
    return {
      startAnalysis: () => {},
      stopAnalysis: () => {},
      getWaveformData: () => ({ rmsValue: 0, peakValue: 0, isSilent: false, consecutiveSilentFrames: 0 }),
      detectSilence: async () => false
    };
  }
  
  // Configuration options
  const messageId = options?.messageId;
  const providedSessionId = options?.sessionId;
  const silenceThreshold = options?.sensitivity || 0.01; // Threshold for silence detection
  const analysisInterval = options?.analysisInterval || 50; // ms between analyses
  
  // Set up audio context and analyzer
  const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const analyzer = audioContext.createAnalyser();
  analyzer.fftSize = 2048; // Large FFT for better frequency resolution
  analyzer.smoothingTimeConstant = 0.8; // Smooth the analysis
  
  // Create source from stream
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyzer);
  
  // Analysis state
  let isAnalyzing = false;
  let analysisIntervalId: number | null = null;
  let silentFrameCount = 0;
  let currentRMS = 0;
  let currentPeak = 0;
  const sessionId = providedSessionId || startAudioSession(messageId);
  
  // Buffer for analysis
  const dataArray = new Float32Array(analyzer.frequencyBinCount);
  
  /**
   * Analyze current audio frame
   */
  const analyzeCurrentFrame = (): { rmsValue: number; peakValue: number; isSilent: boolean } => {
    // Get time domain data
    analyzer.getFloatTimeDomainData(dataArray);
    
    // Calculate RMS (volume) and peak
    let sumSquares = 0;
    let peak = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
      const value = dataArray[i];
      sumSquares += value * value;
      peak = Math.max(peak, Math.abs(value));
    }
    
    const rms = Math.sqrt(sumSquares / dataArray.length);
    
    // Update state
    currentRMS = rms;
    currentPeak = peak;
    const isSilent = rms < silenceThreshold;
    
    // Track consecutive silent frames
    if (isSilent) {
      silentFrameCount++;
    } else {
      silentFrameCount = 0;
    }
    
    return {
      rmsValue: rms,
      peakValue: peak,
      isSilent
    };
  };
  
  /**
   * Start continuous analysis
   */
  const startAnalysis = (): void => {
    if (isAnalyzing) return;
    isAnalyzing = true;
    
    // Start the analysis interval
    analysisIntervalId = window.setInterval(() => {
      const result = analyzeCurrentFrame();
      
      // Log analysis results
      if (DIAGNOSTICS_DETAIL_LEVEL >= 3 && Math.random() < 0.05) { // Log ~5% of frames to avoid spam
        console.log(`[WAVEFORM-ANALYSIS] Frame analysis:`, {
          rms: result.rmsValue.toFixed(4),
          peak: result.peakValue.toFixed(4),
          isSilent: result.isSilent,
          consecutiveSilentFrames: silentFrameCount
        });
      }
      
      // Log to audio diagnostic
      if (sessionId !== 'disabled') {
        addWaveformSample(result.rmsValue, result.peakValue, undefined, sessionId);
      }
      
      // Detect prolonged silence (potential issue)
      if (silentFrameCount > 10) {
        // Log silence detection to audioLogger
        audioLogger.logDiagnostic('waveform-silence-detected', {
          rmsValue: result.rmsValue,
          silentFrames: silentFrameCount,
          messageId,
          sessionId,
          timestamp: Date.now()
        });
        
        // Log to console if significant
        if (silentFrameCount === 10 || silentFrameCount % 20 === 0) {
          console.warn(`[WAVEFORM-ANALYSIS] Detected ${silentFrameCount} consecutive silent frames`);
        }
      }
    }, analysisInterval);
    
    console.log(`[WAVEFORM-ANALYSIS] Started continuous analysis with ${analysisInterval}ms interval`);
  };
  
  /**
   * Stop continuous analysis
   */
  const stopAnalysis = (): void => {
    if (!isAnalyzing) return;
    
    // Clear interval
    if (analysisIntervalId !== null) {
      clearInterval(analysisIntervalId);
      analysisIntervalId = null;
    }
    
    // Clean up resources
    source.disconnect();
    audioContext.close().catch(err => {
      console.error('[WAVEFORM-ANALYSIS] Error closing audio context:', err);
    });
    
    isAnalyzing = false;
    console.log('[WAVEFORM-ANALYSIS] Stopped analysis');
    
    // Complete the session if we started it
    if (sessionId !== 'disabled' && sessionId === getCurrentSessionId()) {
      completeAudioSession(sessionId, 'normal');
    }
  };
  
  /**
   * Get current waveform data
   */
  const getWaveformData = () => {
    return {
      rmsValue: currentRMS,
      peakValue: currentPeak,
      isSilent: currentRMS < silenceThreshold,
      consecutiveSilentFrames: silentFrameCount
    };
  };
  
  /**
   * Detect silence for a specific duration
   * @param durationMs How long to detect silence for
   * @returns Promise that resolves to true if silence is detected for the full duration
   */
  const detectSilence = (durationMs: number): Promise<boolean> => {
    return new Promise((resolve) => {
      // Start with a fresh analysis
      let consecutiveSilence = 0;
      
      // Analyze more frequently for detection
      const detectionIntervalTime = 50; // 50ms
      const requiredFrames = Math.ceil(durationMs / detectionIntervalTime);
      
      const detectionInterval = window.setInterval(() => {
        const result = analyzeCurrentFrame();
        
        if (result.isSilent) {
          consecutiveSilence++;
        } else {
          consecutiveSilence = 0;
        }
        
        // Check if we've detected silence for the full duration
        if (consecutiveSilence >= requiredFrames) {
          clearInterval(detectionInterval);
          resolve(true);
        }
        
        // Also log for ongoing visibility
        if (consecutiveSilence > 0 && consecutiveSilence % 5 === 0) {
          console.log(`[WAVEFORM-ANALYSIS] Silence detection: ${consecutiveSilence}/${requiredFrames} silent frames`);
        }
      }, detectionIntervalTime);
      
      // Set a timeout to resolve false if we don't detect enough silence
      setTimeout(() => {
        clearInterval(detectionInterval);
        resolve(consecutiveSilence >= requiredFrames);
      }, durationMs + 100); // Add a small buffer
    });
  };
  
  // Clean up on window unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', stopAnalysis);
  }
  
  return {
    startAnalysis,
    stopAnalysis,
    getWaveformData,
    detectSilence
  };
}

// Default export for simpler imports
export default {
  initializeAudioMonitoring,
  createAudioStateTracker,
  createAudioCompletionPromise,
  MessageTracker,
  webrtcAudioIntegration,
  useEnhancedAudioService,
  
  // Enhanced diagnostics
  initializeWaveformAnalysis,
  startAudioSession,
  addAudioSegment,
  completeAudioSession,
  ENABLE_AUDIO_CUTOFF_DIAGNOSTICS
};