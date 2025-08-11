import { useEffect, useRef, useState } from 'react';
import { WebRTCService, WebRTCConfig } from '../services/webrtc/WebRTCService';
import { useWebRTCStore } from '../stores/webrtc-store';
import { v4 as uuidv4 } from 'uuid';

export function useWebRTC() {
  const webrtcService = useRef<WebRTCService | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const {
    setConnectionState,
    setConnected,
    setCurrentVolume,
    setAudioPlaying,
    setThinking,
    addMessage,
    updateMessage,
    isMuted,
  } = useWebRTCStore();

  useEffect(() => {
    if (!webrtcService.current) {
      webrtcService.current = new WebRTCService();
      setupEventListeners();
      setIsInitialized(true);
    }

    return () => {
      if (webrtcService.current) {
        webrtcService.current.disconnect();
        webrtcService.current = null;
      }
    };
  }, []);

  const setupEventListeners = () => {
    if (!webrtcService.current) return;

    const service = webrtcService.current;

    service.on('connected', () => {
      setConnected(true);
      setConnectionState('connected');
    });

    service.on('disconnected', () => {
      setConnected(false);
      setConnectionState('disconnected');
      setAudioPlaying(false);
      setThinking(false);
    });

    service.on('error', (error) => {
      console.error('WebRTC Error:', error);
      setConnectionState('failed');
    });

    service.on('connectionStateChange', (state) => {
      setConnectionState(state);
    });

    service.on('transcription', (transcript) => {
      addMessage({
        id: uuidv4(),
        role: 'user',
        text: transcript,
        timestamp: new Date().toISOString(),
        isFinal: true,
        status: 'final',
      });
    });

    service.on('textDelta', (delta) => {
      // Handle streaming text response
      setThinking(false);
      setAudioPlaying(true);
      
      // Add or update assistant message
      const messageId = `assistant_${Date.now()}`;
      addMessage({
        id: messageId,
        role: 'assistant',
        text: delta,
        timestamp: new Date().toISOString(),
        isFinal: false,
        status: 'speaking',
      });
    });

    service.on('audioData', (audioData) => {
      // Handle audio data from AI
      setAudioPlaying(true);
      setThinking(false);
    });

    service.on('functionCall', (functionData) => {
      // Handle function calls
      console.log('Function call received:', functionData);
    });

    service.on('localStream', (stream) => {
      // Handle local audio stream for volume monitoring
      // Implementation will be added for audio visualization
    });

    service.on('remoteStream', (stream) => {
      // Handle remote audio stream
      setAudioPlaying(true);
    });
  };

  const connect = async (config: WebRTCConfig) => {
    if (!webrtcService.current) {
      throw new Error('WebRTC service not initialized');
    }

    try {
      setConnectionState('connecting');
      await webrtcService.current.connect(config);
    } catch (error) {
      setConnectionState('failed');
      throw error;
    }
  };

  const disconnect = () => {
    if (webrtcService.current) {
      webrtcService.current.disconnect();
    }
  };

  const sendText = (text: string) => {
    if (webrtcService.current && webrtcService.current.isConnectionOpen()) {
      webrtcService.current.sendText(text);
    }
  };

  const setMuted = (muted: boolean) => {
    if (webrtcService.current) {
      webrtcService.current.setMuted(muted);
    }
  };

  // Update mute state when store changes
  useEffect(() => {
    setMuted(isMuted);
  }, [isMuted]);

  return {
    isInitialized,
    connect,
    disconnect,
    sendText,
    setMuted,
    isConnected: webrtcService.current?.isConnectionOpen() || false,
  };
}