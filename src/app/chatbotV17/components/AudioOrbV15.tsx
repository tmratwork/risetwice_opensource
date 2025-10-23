"use client";

import { useElevenLabsStore } from '@/stores/elevenlabs-store';
import BlueOrbVoiceUI from '@/components/BlueOrbVoiceUI';

/**
 * Enhanced Audio Orb for V17
 * 
 * Uses the same BlueOrbVoiceUI as V16 but with V17's Eleven Labs architecture:
 * - Real-time volume monitoring from Eleven Labs streams
 * - Thinking state detection during AI processing
 * - Proper volume-reactive animations and particle effects
 * - Full compatibility with V16's visual experience
 */

interface AudioOrbV15Props {
  isFunctionExecuting?: boolean;
}

export function AudioOrbV15({ isFunctionExecuting = false }: AudioOrbV15Props) {
  // Get state from Eleven Labs store instead of WebRTC store
  const isAudioPlaying = useElevenLabsStore(state => state.isAudioPlaying);
  const isThinking = useElevenLabsStore(state => state.isThinking);
  const isMuted = useElevenLabsStore(state => state.isMuted);
  const currentVolume = useElevenLabsStore(state => state.currentVolume);
  const audioLevel = useElevenLabsStore(state => state.audioLevel);
  const setIsMuted = useElevenLabsStore(state => state.setIsMuted);

  // Toggle mute function for V17
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Use audioLevel for effective volume (with fallback to currentVolume)
  const effectiveVolume = audioLevel > 0 ? audioLevel : currentVolume;

  return (
    <BlueOrbVoiceUI
      isSpeaking={isAudioPlaying}
      isThinking={isThinking}
      isMuted={isMuted}
      isFunctionExecuting={isFunctionExecuting}
      currentVolume={effectiveVolume}
      onClick={toggleMute}
      particleSizeMin={15}
      particleSizeMax={35}
      particleSpeedMin={0.03}
      particleSpeedMax={0.15}
      transitionSpeed={0.1}
      size={125}
      className="blue-orb-v17"
      draggable={false}
    />
  );
}