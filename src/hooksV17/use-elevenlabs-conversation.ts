// src/hooksV17/use-elevenlabs-conversation.ts
// V17 ElevenLabs Conversation Hook - Agent-based with webhook tools integration

import { useEffect, useCallback, useRef, useState } from 'react';
import { useConversation } from '@elevenlabs/react';
import { useElevenLabsStore } from '@/stores/elevenlabs-store';
import { useAuth } from '@/contexts/auth-context';

// V17 conditional logging
const logV17 = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
    console.log(`[V17] ${message}`, ...args);
  }
};

export function useElevenLabsConversation() {
  const { user } = useAuth();
  const store = useElevenLabsStore();
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  // WebRTC stream tracking for microphone mute control
  const activeStreamsRef = useRef<MediaStream[]>([]);
  const isMicrophoneMutedRef = useRef<boolean>(store.isMuted);
  const originalGetUserMediaRef = useRef<typeof navigator.mediaDevices.getUserMedia | null>(null);

  // Initialize ElevenLabs conversation hook with agent support and v0.6.1 features
  const conversation = useConversation({
    onConnect: () => {
      logV17('🔌 Connected to ElevenLabs agent', {
        agentId: currentAgentId,
        userId: user?.uid || 'anonymous',
        specialist: store.triageSession?.currentSpecialist
      });
      store.setIsConnected(true);
      store.setConnectionState('connected');
      setIsPreparing(false);
    },
    
    onDisconnect: () => {
      logV17('🔌 Disconnected from ElevenLabs agent', {
        agentId: currentAgentId,
        specialist: store.triageSession?.currentSpecialist
      });
      store.setIsConnected(false);
      store.setConnectionState('disconnected');
      setIsPreparing(false);
    },
    
    onMessage: (message: unknown) => {
      logV17('💬 Message received from conversation', {
        messageType: typeof message,
        message: message, // Log full message to understand structure
        agentId: currentAgentId,
        specialist: store.triageSession?.currentSpecialist,
        timestamp: new Date().toISOString()
      });
      
      // Extract and process message content
      const messageData = extractMessageData(message);
      if (messageData.text) {
        // Determine if this is user or assistant message based on message structure
        const role = messageData.isUserMessage ? 'user' : 'assistant';
        
        logV17(`💬 Adding ${role} message to conversation`, {
          text: messageData.text,
          isFinal: messageData.isFinal,
          source: messageData.isUserMessage ? 'typed_or_voice' : 'ai_response',
          messageStructure: typeof message === 'object' ? Object.keys(message as object) : 'primitive'
        });
        
        // Prevent duplicate messages (same text within 2 seconds)
        const recentMessages = store.conversationHistory.slice(-3); // Check last 3 messages
        const isDuplicate = recentMessages.some(msg => 
          msg.text === messageData.text && 
          msg.role === role &&
          (Date.now() - new Date(msg.timestamp).getTime()) < 2000
        );

        if (!isDuplicate) {
          store.addMessage({
            id: `v17-${role}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            role: role,
            text: messageData.text,
            timestamp: new Date().toISOString(),
            isFinal: messageData.isFinal,
            specialist: store.triageSession?.currentSpecialist || 'triage'
          });
        } else {
          logV17('🚫 Skipping duplicate message', {
            text: messageData.text,
            role: role
          });
        }
      }
    },
    
    onError: (error: unknown) => {
      logV17('❌ ElevenLabs agent error', {
        error: error instanceof Error ? error.message : String(error),
        agentId: currentAgentId
      });
      store.setConnectionState('failed');
      setIsPreparing(false);
    },

    // New v0.6.1 features - WebRTC connection options
    connectionDelay: {
      android: 3000,
      ios: 0,
      default: 0,
    },
    useWakeLock: false // Prevent device sleep during conversation
  });

  // Set up getUserMedia interception for microphone mute control
  useEffect(() => {
    // Store original getUserMedia if not already stored
    if (!originalGetUserMediaRef.current) {
      originalGetUserMediaRef.current = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    }

    const originalGetUserMedia = originalGetUserMediaRef.current;

    // Intercept getUserMedia calls
    navigator.mediaDevices.getUserMedia = async function(constraints: MediaStreamConstraints) {
      logV17('🎤 getUserMedia called', { 
        hasAudio: !!constraints.audio, 
        currentMuteState: isMicrophoneMutedRef.current 
      });

      const stream = await originalGetUserMedia(constraints);
      
      if (constraints.audio) {
        // Track the stream for mute control
        activeStreamsRef.current.push(stream);
        logV17('🎤 Added stream to tracking', { 
          streamId: stream.id, 
          totalTracked: activeStreamsRef.current.length 
        });
        
        // Apply current mute state to this stream
        stream.getAudioTracks().forEach((track, index) => {
          track.enabled = !isMicrophoneMutedRef.current;
          logV17(`🎤 Stream ${stream.id}, track ${index} - enabled: ${track.enabled}`, {
            trackId: track.id,
            muted: isMicrophoneMutedRef.current
          });
        });
        
        // Cleanup when stream ends
        stream.addEventListener('ended', () => {
          logV17('🎤 Stream ended, removing from tracking', { streamId: stream.id });
          activeStreamsRef.current = activeStreamsRef.current.filter(s => s !== stream);
        });
      }
      
      return stream;
    };

    // Global control function for mute/unmute
    (window as Window & { controlMicrophone?: (muted: boolean) => void }).controlMicrophone = (muted: boolean) => {
      logV17('🎤 Setting microphone mute state', { 
        muted, 
        activeStreams: activeStreamsRef.current.length 
      });
      
      isMicrophoneMutedRef.current = muted;
      
      // Control ALL existing streams immediately
      activeStreamsRef.current.forEach((stream, streamIndex) => {
        stream.getAudioTracks().forEach((track, trackIndex) => {
          track.enabled = !muted;
          logV17(`🎤 Stream ${streamIndex}, track ${trackIndex} - enabled: ${track.enabled}`, {
            streamId: stream.id,
            trackId: track.id,
            muted
          });
        });
      });
    };

    // Cleanup on unmount
    return () => {
      if (originalGetUserMediaRef.current) {
        navigator.mediaDevices.getUserMedia = originalGetUserMediaRef.current;
        logV17('🎤 Restored original getUserMedia');
      }
      delete (window as Window & { controlMicrophone?: (muted: boolean) => void }).controlMicrophone;
    };
  }, []); // Empty dependency array - only run once

  // Update mute state when store changes
  useEffect(() => {
    isMicrophoneMutedRef.current = store.isMuted;
    
    const windowWithMicrophone = window as Window & { controlMicrophone?: (muted: boolean) => void };
    if (typeof windowWithMicrophone.controlMicrophone === 'function') {
      windowWithMicrophone.controlMicrophone(store.isMuted);
    }
  }, [store.isMuted]);

  // Client-side tools integration - disabled for now as registerTool is not available in current SDK
  // useEffect(() => {
  //   if (conversation && store.isConnected) {
  //     registerClientTools(conversation);
  //   }
  // }, [conversation, store.isConnected]);

  // Start session with specific specialist agent
  const startSession = useCallback(async (specialistType: string = 'triage') => {
    try {
      setIsPreparing(true);
      
      logV17('🚀 Starting ElevenLabs session', {
        specialistType,
        userId: user?.uid || 'anonymous'
      });

      // 1. Create or get agent for specialist
      const agentResponse = await fetch('/api/v17/agents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specialistType,
          userId: user?.uid || null,
          voiceId: 'EmtkmiOFoQVpKRVpXH2B' // V17 specified voice ID
        })
      });

      if (!agentResponse.ok) {
        throw new Error(`Failed to create agent: ${agentResponse.statusText}`);
      }

      const { agent } = await agentResponse.json();
      setCurrentAgentId(agent.agent_id);

      logV17('✅ Agent created/retrieved', {
        agentId: agent.agent_id,
        specialistType: agent.specialist_type
      });

      // 2. Update store with session info
      store.setTriageSession({
        sessionId: `v17-${Date.now()}`,
        currentSpecialist: specialistType,
        conversationId: store.conversationId,
        isHandoffPending: false,
        agentId: agent.agent_id
      });

      // 3. Start conversation with agent using WebRTC if available (v0.6.1+ feature)
      await conversation.startSession({
        agentId: agent.agent_id,
        connectionType: 'webrtc', // Use WebRTC for better audio quality
        userId: user?.uid || undefined // Optional user tracking
      });

      logV17('✅ ElevenLabs session started successfully', {
        agentId: agent.agent_id,
        specialistType
      });

      return agent.agent_id;

    } catch (error) {
      logV17('❌ Failed to start ElevenLabs session', {
        error: error instanceof Error ? error.message : String(error),
        specialistType
      });
      setIsPreparing(false);
      throw error;
    }
  }, [conversation, store, user?.uid]);

  // End current session
  const endSession = useCallback(async () => {
    try {
      logV17('🛑 Ending ElevenLabs session', {
        agentId: currentAgentId,
        specialist: store.triageSession?.currentSpecialist
      });

      await conversation.endSession();
      setCurrentAgentId(null);
      store.setTriageSession(null);
      
      logV17('✅ ElevenLabs session ended');

    } catch (error) {
      logV17('❌ Failed to end session', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }, [conversation, store, currentAgentId]);

  // Switch to different specialist (handoff)
  const switchSpecialist = useCallback(async (newSpecialist: string, context?: string) => {
    try {
      logV17('🔄 Switching specialist', {
        from: store.triageSession?.currentSpecialist,
        to: newSpecialist,
        contextLength: context?.length || 0
      });

      // End current session
      await endSession();

      // Brief pause for clean transition
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Start new session with different specialist
      await startSession(newSpecialist);

      logV17('✅ Specialist switch completed', {
        newSpecialist,
        agentId: currentAgentId
      });

    } catch (error) {
      logV17('❌ Failed to switch specialist', {
        error: error instanceof Error ? error.message : String(error),
        newSpecialist
      });
      throw error;
    }
  }, [startSession, endSession, store.triageSession?.currentSpecialist, currentAgentId]);

  // Set volume control
  const setVolume = useCallback((volume: number) => {
    logV17('🔊 Setting volume', { volume });
    store.setCurrentVolume(volume);
    
    // Apply to ElevenLabs conversation if available
    if (conversation && typeof conversation.setVolume === 'function') {
      conversation.setVolume({ volume });
    }
  }, [conversation, store]);


  return {
    // Connection state
    isConnected: store.isConnected,
    connectionState: store.connectionState,
    isPreparing,
    
    // Current session info
    currentAgentId,
    currentSpecialist: store.triageSession?.currentSpecialist,
    
    // Session management
    startSession,
    endSession,
    switchSpecialist,
    
    // Audio controls
    setVolume,
    currentVolume: store.currentVolume,
    isMuted: store.isMuted,
    
    // Conversation data
    conversation: store.conversationHistory,
    
    // Raw conversation object for advanced usage
    conversationInstance: conversation
  };
}

// Helper function to extract message data and determine message type
function extractMessageData(message: unknown): {
  text: string;
  isUserMessage: boolean;
  isFinal: boolean;
} {
  if (typeof message === 'string') {
    return {
      text: message,
      isUserMessage: false, // Assume string messages are from assistant
      isFinal: true
    };
  }

  if (typeof message === 'object' && message !== null) {
    const msgObj = message as Record<string, unknown>;
    
    // Extract text content
    const text = (
      (msgObj.content as string) ||
      (msgObj.text as string) ||
      (msgObj.message as string) ||
      (msgObj.data as string) ||
      (msgObj.transcript as string) ||
      ''
    );

    // Determine if this is a user message based on message structure
    // ElevenLabs typically uses 'type', 'source', or 'role' fields
    const isUserMessage = (
      msgObj.type === 'user_transcript' ||
      msgObj.source === 'user' ||
      msgObj.role === 'user' ||
      msgObj.speaker === 'user' ||
      (msgObj.type === 'transcript' && msgObj.source !== 'agent') ||
      false
    );

    // Determine if message is final (completed transcription)
    const isFinal = (
      msgObj.is_final === true ||
      msgObj.isFinal === true ||
      msgObj.final === true ||
      msgObj.type !== 'partial_transcript' ||
      !text.endsWith('...') // Tentative transcripts often end with ...
    );

    return {
      text,
      isUserMessage,
      isFinal
    };
  }

  return {
    text: '',
    isUserMessage: false,
    isFinal: true
  };
}

// Client-side tools registration - disabled for now as registerTool is not available in current ElevenLabs SDK
// function registerClientTools(conversation: ReturnType<typeof useConversation>) {
//   logV17('🔧 Registering client-side tools for agent');
//   // ... tool registration code commented out until SDK supports it
//   logV17('✅ Client-side tools registered successfully');
// }