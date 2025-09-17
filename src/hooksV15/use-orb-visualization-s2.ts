// src/hooksV15/use-orb-visualization-s2.ts
// Enhanced orb visualization hook for S2 that provides real-time audio and thinking state data
// Based on use-orb-visualization-v15.ts but adapted for S2's s1-webrtc-store

import { useMemo, useEffect, useRef } from 'react';
import { useS1WebRTCStore } from '@/stores/s1-webrtc-store';

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
 * Enhanced Orb Visualization Hook for S2
 *
 * Provides comprehensive audio and thinking state data for the blue orb,
 * matching V16's functionality with S2's s1-webrtc-store architecture.
 *
 * Key features:
 * - Real-time volume monitoring from WebRTC streams
 * - Thinking state detection during AI processing
 * - Effective volume calculation for smooth orb animations
 * - Full compatibility with BlueOrbVoiceUI component
 */
export function useOrbVisualizationS2(): OrbVisualizationState {
  // Get enhanced state from S1 WebRTC Zustand store
  const {
    currentVolume,
    audioLevel,
    isAudioPlaying,
    isThinking,
    connectionState,
    isConnected,
    isMuted
  } = useS1WebRTCStore();

  // Log only when thinking state changes
  useEffect(() => {
    console.log('[s2-orb] isThinking state changed:', isThinking);
  }, [isThinking]);

  // Calculate effective volume (like V16 does)
  const effectiveVolume = useMemo(() => {
    if (!isConnected) return 0;

    // Use actual volume when available, fall back to static value when connected but no audio
    if (isAudioPlaying && currentVolume > 0) {
      return currentVolume;
    }

    // When connected but no audio, provide a base level for "ready" state
    return isConnected ? 0.1 : 0;
  }, [isConnected, isAudioPlaying, currentVolume]);

  // Determine if AI is actually thinking (like V16's diagnosticData.isThinking)
  const isAiThinking = useMemo(() => {
    // Thinking during connection process or AI processing
    const result = connectionState === 'connecting' || isThinking;
    return result;
  }, [connectionState, isThinking]);

  // Track previous state to detect changes
  const prevIsActuallyPlayingRef = useRef(false);

  // Determine if audio is actually playing (like V16's memoizedIsActuallyPlaying)
  const isActuallyPlaying = useMemo(() => {
    const result = isAudioPlaying && currentVolume > 0.01;
    // Only log when the result actually changes
    if (result !== prevIsActuallyPlayingRef.current) {
      console.log(`[s2-orb] isActuallyPlaying changed: ${prevIsActuallyPlayingRef.current} -> ${result} (isAudioPlaying=${isAudioPlaying}, currentVolume=${currentVolume})`);
      prevIsActuallyPlayingRef.current = result;
    }
    return result;
  }, [isAudioPlaying, currentVolume]);

  // Log only when isAiThinking changes
  useEffect(() => {
    console.log('[s2-orb] isAiThinking changed:', isAiThinking);
  }, [isAiThinking]);

  // Log orb state values when there are significant changes
  useEffect(() => {
    if (isActuallyPlaying || currentVolume > 0.1) {
      console.log('[s2-orb] Audio activity detected:', {
        isActuallyPlaying,
        currentVolume: currentVolume.toFixed(3),
        effectiveVolume: effectiveVolume.toFixed(3)
      });
    }
  }, [isActuallyPlaying, currentVolume, effectiveVolume]);

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