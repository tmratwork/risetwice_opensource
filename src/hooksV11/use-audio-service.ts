// src/hooksV11/use-audio-service.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import audioService, { AudioServiceState } from './audio-service';
import webrtcAudioIntegration from './webrtc-audio-integration';

/**
 * React hook that provides access to the AudioService
 * 
 * This hook allows React components to interact with the standalone AudioService
 * while properly handling React component lifecycle events.
 */
export function useAudioService() {
  // Track state from the audio service
  const [audioState, setAudioState] = useState<AudioServiceState>(audioService.getState());
  
  // Tracking of our subscription to prevent memory leaks
  const subscriptionRef = useRef<(() => void) | null>(null);
  
  // Instance ID for logging
  const instanceIdRef = useRef<string>(`audio-hook-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  
  // Track WebRTC audio level if available
  const [audioLevel, setAudioLevel] = useState<number>(0);
  
  // Setup subscription to audio service
  useEffect(() => {
    if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
      console.log(`[AudioLogger] Initializing hook instance: ${instanceIdRef.current}`);
    }
    
    // Subscribe to state changes
    subscriptionRef.current = audioService.subscribe((newState) => {
      setAudioState(newState);
    });
    
    // Cleanup on unmount
    return () => {
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.log(`[AudioLogger] Cleaning up hook instance: ${instanceIdRef.current}`);
      }
      
      if (subscriptionRef.current) {
        subscriptionRef.current();
        subscriptionRef.current = null;
      }
    };
  }, []);
  
  // Queue audio data using the enhanced integration
  const queueAudioData = useCallback((audioData: ArrayBuffer, chunkId: string, messageId: string) => {
    try {
      // Convert ArrayBuffer to base64 for WebRTC audio integration
      const uint8Array = new Uint8Array(audioData);
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
      }
      const base64Data = btoa(binaryString);
      
      // Process through WebRTC integration first to ensure ID mapping is maintained
      webrtcAudioIntegration.processAudioChunk(messageId, base64Data);
    } catch (error) {
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.error(`[AudioLogger] Error in enhanced audio processing: ${error}`);
      }
      
      // Fallback to direct audio service as a safety measure
      audioService.queueAudioData(audioData, chunkId, messageId);
    }
  }, []);
  
  // Process audio chunk for WebRTC integration
  const processAudioChunk = useCallback((messageId: string, audioData: string) => {
    // Use the enhanced WebRTC integration
    webrtcAudioIntegration.processAudioChunk(messageId, audioData);
  }, []);
  
  // Handle stop signal with enhanced handling
  const handleStopSignal = useCallback((messageId: string) => {
    // Use the enhanced WebRTC integration
    webrtcAudioIntegration.handleAudioStopSignal(messageId);
  }, []);
  
  // Clear audio queue (wrapped to make it React-friendly)
  const clearAudioQueue = useCallback((force: boolean = false) => {
    return audioService.clearAudioQueue(force);
  }, []);
  
  // Start new message session (wrapped to make it React-friendly)
  const startNewMessage = useCallback((messageId: string) => {
    audioService.startNewMessage(messageId);
  }, []);
  
  // Safe disconnect that waits for audio to complete
  const safeDisconnect = useCallback(async (audioStream: MediaStream, disconnectCallback: () => void) => {
    if (!audioStream) {
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.warn('[AudioLogger] No audio stream provided for safe disconnect');
      }
      disconnectCallback();
      return;
    }
    
    try {
      // Use the enhanced WebRTC audio completion
      await webrtcAudioIntegration.endWebRTCSessionWithAudioCompletion(
        audioStream,
        disconnectCallback
      );
    } catch (error) {
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.error('[AudioLogger] Error during safe disconnect:', error);
      }
      disconnectCallback();
    }
  }, []);
  
  // Initialize audio monitoring for a WebRTC stream
  const initializeAudioMonitoring = useCallback((stream: MediaStream) => {
    return webrtcAudioIntegration.initializeWebRTCAudioMonitoring(stream, {
      label: instanceIdRef.current,
      onAudioStateChange: (isPlaying) => {
        // This allows other components to react to real audio state changes
        window.dispatchEvent(new CustomEvent('webrtc-audio-state-change', { 
          detail: { isPlaying } 
        }));
      }
    });
  }, []);
  
  // Setup audio level monitoring
  const setupAudioLevelMonitoring = useCallback((intervalMs = 100) => {
    const interval = setInterval(() => {
      const level = webrtcAudioIntegration.getCurrentAudioLevel();
      setAudioLevel(level);
      
      // Dispatch event for other components to use
      window.dispatchEvent(new CustomEvent('webrtc-audio-level', { 
        detail: { level } 
      }));
    }, intervalMs);
    
    return () => clearInterval(interval);
  }, []);
  
  // Derived state: Calculate whether there is any audio activity
  const hasAudioActivity = audioState.isPlaying || 
                          audioState.pendingChunksCount > 0 || 
                          audioState.queueLength > 0;
  
  // Derived state: Calculate if audio system is busy with content from current message
  const isProcessingCurrentMessage = audioState.currentMessageId !== null && hasAudioActivity;
  
  // Derived state: Is audio actively playing based on direct monitoring
  const isAudioPlaying = webrtcAudioIntegration.isAudioCurrentlyPlaying() || audioState.isPlaying;
  
  // Return everything the component needs
  return {
    // Current state
    audioState,
    audioLevel,
    isAudioPlaying,
    
    // Derived state
    hasAudioActivity,
    isProcessingCurrentMessage,
    
    // Service methods
    queueAudioData,
    processAudioChunk,
    handleStopSignal,
    clearAudioQueue,
    startNewMessage,
    
    // Enhanced methods
    safeDisconnect,
    initializeAudioMonitoring,
    setupAudioLevelMonitoring,
    
    // Instance information (useful for debugging)
    instanceId: instanceIdRef.current
  };
}

export default useAudioService;