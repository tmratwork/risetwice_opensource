// src/hooksV15/use-orb-visualization-v15.ts
// Enhanced orb visualization hook for V15 that provides real-time audio and thinking state data

import { useMemo, useEffect, useRef } from 'react';
import { useWebRTCStore } from '@/stores/webrtc-store';

interface OrbVisualizationState {
  // Current audio levels (0-1 normalized)
  currentVolume: number;
  audioLevel: number;
  
  // Playing and thinking states
  isActuallyPlaying: boolean;
  isAiThinking: boolean;
  
  // Effective volume for orb sizing (like V11)
  effectiveVolume: number;
  
  // Connection state
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'failed';
  isConnected: boolean;
  
  // Muted state (for compatibility)
  isMuted: boolean;
}

/**
 * Enhanced Orb Visualization Hook for V15
 * 
 * Provides comprehensive audio and thinking state data for the blue orb,
 * matching V11's functionality with V15's clean architecture.
 * 
 * Key features:
 * - Real-time volume monitoring from WebRTC streams
 * - Thinking state detection during AI processing
 * - Effective volume calculation for smooth orb animations
 * - Full compatibility with BlueOrbVoiceUI component
 */
export function useOrbVisualizationV15(): OrbVisualizationState {
  // Get enhanced state from Zustand store
  const {
    currentVolume,
    audioLevel,
    isAudioPlaying,
    isThinking,
    connectionState,
    isConnected,
    isMuted
  } = useWebRTCStore();

  // Removed console.log to prevent render storm

  // Log only when thinking state changes
  useEffect(() => {
    console.log('[function] isThinking state changed:', isThinking);
  }, [isThinking]);

  // Hook successfully providing real-time volume data

  // Calculate effective volume (like V11 does)
  const effectiveVolume = useMemo(() => {
    if (!isConnected) return 0;
    
    // Use actual volume when available, fall back to static value when connected but no audio
    if (isAudioPlaying && currentVolume > 0) {
      return currentVolume;
    }
    
    // When connected but no audio, provide a base level for "ready" state
    return isConnected ? 0.1 : 0;
  }, [isConnected, isAudioPlaying, currentVolume]);

  // Determine if AI is actually thinking (like V11's diagnosticData.isThinking)
  const isAiThinking = useMemo(() => {
    // Thinking during connection process or AI processing
    const result = connectionState === 'connecting' || isThinking;
    // Removed console.log to prevent render storm
    return result;
  }, [connectionState, isThinking]);

  // Track previous state to detect changes
  const prevIsActuallyPlayingRef = useRef(false);
  
  // Determine if audio is actually playing (like V11's memoizedIsActuallyPlaying)
  const isActuallyPlaying = useMemo(() => {
    const result = isAudioPlaying && currentVolume > 0.01;
    // Only log when the result actually changes
    if (result !== prevIsActuallyPlayingRef.current) {
      if (process.env.ENABLE_BLUE_ORB_ROTATION_LOGS === 'true') {
        console.log(`[BLUE-ORB-ROTATION] isActuallyPlaying changed: ${prevIsActuallyPlayingRef.current} -> ${result} (isAudioPlaying=${isAudioPlaying}, currentVolume=${currentVolume})`);
      }
      prevIsActuallyPlayingRef.current = result;
    }
    return result;
  }, [isAudioPlaying, currentVolume]);

  // Log only when isAiThinking changes
  useEffect(() => {
    console.log('[function] isAiThinking changed:', isAiThinking);
  }, [isAiThinking]);
  
  // Debug logging for blue orb rotation - throttled to prevent infinite loops
  useEffect(() => {
    // Only log significant state changes to prevent console spam
    const significantVolumeChange = currentVolume > 0.1;
    const stateChanged = isAudioPlaying || isActuallyPlaying;
    
    if (significantVolumeChange && stateChanged && Math.random() < 0.01) { // Only 1% of events logged
      if (process.env.ENABLE_BLUE_ORB_ROTATION_LOGS === 'true') {
        console.log(`[BLUE-ORB-ROTATION] Orb visualization state: currentVolume=${currentVolume}, isAudioPlaying=${isAudioPlaying}, isActuallyPlaying=${isActuallyPlaying}, effectiveVolume=${effectiveVolume}`);
      }
    }
  }, [currentVolume, isAudioPlaying, isActuallyPlaying, effectiveVolume]);

  const result = useMemo(() => {
    const orbState = {
      // Audio levels
      currentVolume,
      audioLevel,
      
      // Playing and thinking states  
      isActuallyPlaying,
      isAiThinking,
      
      // Effective volume for orb sizing
      effectiveVolume,
      
      // Connection state
      connectionState,
      isConnected,
      
      // Muted state from store
      isMuted
    };
    
    // Real-time orb state calculated successfully
    
    return orbState;
  }, [
    currentVolume,
    audioLevel,
    isActuallyPlaying,
    isAiThinking,
    effectiveVolume,
    connectionState,
    isConnected,
    isMuted
  ]);
  
  return result;
}