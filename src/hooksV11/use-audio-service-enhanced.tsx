// src/hooksV11/use-audio-service-enhanced.tsx

import React, { useEffect, useState, useCallback } from 'react';
import { useWebRTC } from './use-webrtc';
import audioService from './audio-service';
import webrtcAudioIntegration from './webrtc-audio-integration';
import type { AudioServiceState } from './audio-service';
import type { Conversation, SessionConfig } from './use-webrtc';

// Extended WebRTC return type to include properties used in this hook
interface ExtendedWebRTCReturn {
  status: string;
  isSessionActive: boolean;
  errorMessage: string | null;
  conversation: Conversation[];
  registerFunction: (name: string, fn: (...args: unknown[]) => unknown) => void;
  startSession: (config: SessionConfig) => Promise<void>;
  stopSession: () => void;
  handleStartStopClick: () => void;
  sendTextMessage: (text: string) => void;
  isMuted: boolean;
  toggleMute: () => void;
  currentVolume: number;
  diagnosticData: Record<string, unknown>;
  audioStream?: MediaStream;
  disconnect?: () => void;
  isConnected?: boolean;
  isConnecting?: boolean;
  transcript?: Array<{role: string; content: string}>;
  toggleRecording?: () => void;
  isRecording?: boolean;
}

/**
 * Custom hook for using the enhanced audio service with WebRTC
 */
export function useEnhancedAudioService() {
  // Get the audio service state
  const [audioState, setAudioState] = useState<AudioServiceState>(audioService.getState());
  
  // Track audio activity based on both service state and direct monitoring
  const [isAudioActive, setIsAudioActive] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  
  // Subscribe to audio service state
  useEffect(() => {
    const unsubscribe = audioService.subscribe(setAudioState);
    return unsubscribe;
  }, []);
  
  // Get the WebRTC functionality 
  // Use a two-step cast through unknown to avoid TypeScript errors
  const webrtc = useWebRTC() as unknown as ExtendedWebRTCReturn;
  
  // Initialize audio monitoring when stream is available
  useEffect(() => {
    if (!webrtc.audioStream) return;
    
    console.log('[ENHANCED-AUDIO-SERVICE] Initializing WebRTC audio monitoring');
    
    // Initialize the audio state tracker for direct monitoring
    const cleanup = webrtcAudioIntegration.initializeWebRTCAudioMonitoring(
      webrtc.audioStream,
      {
        label: 'enhanced-audio-service',
        onAudioStateChange: setIsAudioActive
      }
    );
    
    // Setup audio level polling
    const levelInterval = setInterval(() => {
      setAudioLevel(webrtcAudioIntegration.getCurrentAudioLevel());
    }, 100);
    
    return () => {
      cleanup();
      clearInterval(levelInterval);
    };
  }, [webrtc.audioStream]);
  
  // Enhanced disconnect that waits for audio completion
  const safeDisconnect = useCallback(async (
    stream?: MediaStream, 
    disconnectCallback?: () => void
  ) => {
    // If no stream provided, use the WebRTC stream
    const audioStreamToUse = stream || webrtc.audioStream;
    
    // Create a safe default disconnect function in case none is provided
    const defaultDisconnect = () => {
      console.log('[ENHANCED-AUDIO-SERVICE] Using default no-op disconnect');
    };
    
    // If no callback provided, use the WebRTC disconnect with a fallback to default
    const disconnectCallbackToUse = disconnectCallback || 
      (webrtc.disconnect ? webrtc.disconnect : defaultDisconnect);
    
    if (!audioStreamToUse) {
      console.warn('[ENHANCED-AUDIO-SERVICE] No audio stream available for safe disconnect');
      disconnectCallbackToUse();
      return;
    }
    
    console.log('[ENHANCED-AUDIO-SERVICE] Starting safe disconnect with audio completion');
    
    try {
      await webrtcAudioIntegration.endWebRTCSessionWithAudioCompletion(
        audioStreamToUse,
        disconnectCallbackToUse
      );
      
      console.log('[ENHANCED-AUDIO-SERVICE] Safe disconnect completed successfully');
    } catch (error) {
      console.error('[ENHANCED-AUDIO-SERVICE] Error during safe disconnect:', error);
      
      // Fallback to regular disconnect
      disconnectCallbackToUse();
    }
  }, [webrtc]);
  
  // Calculate combined state information
  const isProcessingAudio = audioState.isPlaying || audioState.queueLength > 0 || audioState.pendingChunksCount > 0;
  const isAudioPlaying = isAudioActive || audioState.isPlaying;
  
  // Return combined WebRTC and audio service functionality
  return {
    // Original WebRTC functionality
    ...webrtc,
    
    // Enhanced disconnect
    safeDisconnect,
    
    // Audio service state
    audioState,
    
    // Direct audio monitoring
    audioLevel,
    isAudioActive,
    
    // Combined state calculations
    isProcessingAudio,
    isAudioPlaying,
    
    // Explicitly add the audioStream for TypeScript
    audioStream: webrtc.audioStream,
    
    // Time since last buffer (for debugging)
    timeSinceLastBuffer: audioState.lastBufferTime ? Date.now() - audioState.lastBufferTime : null,

    // Ensure these properties exist in the return type
    isConnected: webrtc.isConnected ?? false,
    isConnecting: webrtc.isConnecting ?? false,
    transcript: webrtc.transcript ?? [],
    toggleRecording: webrtc.toggleRecording ?? (() => {}),
    isRecording: webrtc.isRecording ?? false
  };
}

/**
 * Example component showing the enhanced audio service integration
 */
const EnhancedAudioServiceExample: React.FC = () => {
  // Use the enhanced audio service
  const {
    audioState,
    audioLevel,
    isAudioActive,
    isProcessingAudio,
    isAudioPlaying,
    timeSinceLastBuffer,
    isConnected,
    isConnecting,
    transcript,
    toggleRecording,
    isRecording,
    safeDisconnect
  } = useEnhancedAudioService();
  
  // Add a warning class if time since last buffer is high during processing
  const getTimingClass = () => {
    if (!isProcessingAudio || !timeSinceLastBuffer) return '';
    
    if (timeSinceLastBuffer > 5000) return 'text-red-500';
    if (timeSinceLastBuffer > 2000) return 'text-yellow-500';
    return 'text-green-500';
  };
  
  // Convert audio level to display color
  const getAudioLevelColor = () => {
    if (audioLevel < 20) return 'bg-blue-300';
    if (audioLevel < 50) return 'bg-blue-500';
    return 'bg-blue-700';
  };
  
  return (
    <div className="p-4 border rounded shadow">
      <h2 className="text-xl font-bold mb-4">Enhanced Audio Service Integration</h2>
      
      {/* Connection status */}
      <div className="p-2 border rounded mb-4">
        <h3 className="font-medium">Connection Status</h3>
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span>{isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}</span>
        </div>
      </div>
      
      {/* Audio status */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-2 border rounded">
          <h3 className="font-medium">Audio Service State</h3>
          <p>Queue Length: {audioState.queueLength}</p>
          <p>Is Playing: {audioState.isPlaying ? 'Yes' : 'No'}</p>
          <p>Pending Chunks: {audioState.pendingChunksCount}</p>
          <p>Stop Signal: {audioState.receivedStopSignal ? 'Yes' : 'No'}</p>
          <p className={getTimingClass()}>
            Time Since Buffer: {timeSinceLastBuffer ? `${(timeSinceLastBuffer / 1000).toFixed(1)}s` : 'N/A'}
          </p>
        </div>
        
        <div className="p-2 border rounded">
          <h3 className="font-medium">Real-time Audio Monitoring</h3>
          <p>Audio Active: {isAudioActive ? 'Yes' : 'No'}</p>
          <p>Audio Level: {audioLevel.toFixed(1)}</p>
          <p>Processing Audio: {isProcessingAudio ? 'Yes' : 'No'}</p>
          <p>Audio Playing: {isAudioPlaying ? 'Yes' : 'No'}</p>
          
          <div className="w-full bg-gray-200 h-4 mt-2">
            <div 
              className={`h-full ${getAudioLevelColor()}`}
              style={{ width: `${Math.min(100, audioLevel / 2.55)}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Control buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={toggleRecording}
          disabled={isProcessingAudio}
          className={`px-4 py-2 ${isRecording ? 'bg-red-500' : 'bg-green-500'} text-white rounded disabled:opacity-50`}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
        
        <button
          onClick={() => safeDisconnect()}
          disabled={!isConnected}
          className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
        >
          Safe Disconnect
        </button>
      </div>
      
      {/* Transcript */}
      {transcript.length > 0 && (
        <div className="p-2 border rounded mb-4 max-h-60 overflow-y-auto">
          <h3 className="font-medium">Transcript</h3>
          {transcript.map((entry: {role: string, content: string}, index: number) => (
            <div 
              key={index} 
              className={`p-2 mb-2 rounded ${entry.role === 'user' ? 'bg-gray-100' : 'bg-blue-50'}`}
            >
              <strong>{entry.role === 'user' ? 'You' : 'AI'}:</strong> {entry.content}
            </div>
          ))}
        </div>
      )}
      
      {/* Explanation */}
      <div className="text-sm text-gray-600">
        <p>This component demonstrates the enhanced WebRTC audio integration that:</p>
        <ul className="list-disc pl-5 mt-1">
          <li>Monitors audio directly from WebRTC stream for accurate playback state</li>
          <li>Shows real-time audio levels for better visualization</li>
          <li>Implements safe disconnection that waits for audio to complete</li>
          <li>Combines multiple sources of state for more reliable audio status</li>
        </ul>
      </div>
    </div>
  );
};

export default EnhancedAudioServiceExample;