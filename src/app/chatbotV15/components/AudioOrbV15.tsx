"use client";

import { useOrbVisualizationV15 } from '@/hooksV15/use-orb-visualization-v15';
import { useWebRTCStore } from '@/stores/webrtc-store';
import BlueOrbVoiceUI from '@/components/BlueOrbVoiceUI';

/**
 * Enhanced Audio Orb for V15
 * 
 * Uses the same BlueOrbVoiceUI as V11 but with V15's clean architecture:
 * - Real-time volume monitoring from WebRTC streams
 * - Thinking state detection during AI processing
 * - Proper volume-reactive animations and particle effects
 * - Full compatibility with V11's visual experience
 */

export function AudioOrbV15() {
  // Get enhanced visualization state from our custom hook
  const orbState = useOrbVisualizationV15();
  
  // Get toggle mute function from the store (stable reference)
  const toggleMute = useWebRTCStore(state => state.toggleMute);
  
  // Removed console.log to prevent render storm
  
  // Enhanced AudioOrbV15 with real-time volume data and mute functionality
  
  return (
    <BlueOrbVoiceUI
      isSpeaking={orbState.isActuallyPlaying}
      isThinking={orbState.isAiThinking}
      isMuted={orbState.isMuted}
      currentVolume={orbState.effectiveVolume}
      onClick={toggleMute}
      particleSizeMin={15}
      particleSizeMax={35}
      particleSpeedMin={0.1}
      particleSpeedMax={0.4}
      transitionSpeed={0.25}
      size={125}
      className="blue-orb-v15"
      draggable={false}
    />
  );
}