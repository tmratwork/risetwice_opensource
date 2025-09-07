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
          isFinal: messageData.isFinal
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

  // Register client-side tools for agent to call
  useEffect(() => {
    if (conversation && store.isConnected) {
      registerClientTools(conversation);
    }
  }, [conversation, store.isConnected]);

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
          voiceId: 'pNInz6obpgDQGcFmaJgB' // Adam voice default
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
    store.setVolume(volume);
    
    // Apply to ElevenLabs conversation if available
    if (conversation && typeof conversation.setVolume === 'function') {
      conversation.setVolume(volume);
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

// Register client-side tools that the agent can call
function registerClientTools(conversation: ReturnType<typeof useConversation>) {
  logV17('🔧 Registering client-side tools for agent');

  // Tool: Get user location
  conversation.registerTool?.({
    name: 'get_user_location',
    description: 'Get the current user location for location-based services',
    parameters: {},
    handler: async () => {
      logV17('📍 Agent requested user location');
      
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve({ error: 'Geolocation not supported' });
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const result = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: new Date().toISOString()
            };
            logV17('✅ Location obtained', result);
            resolve(result);
          },
          (error) => {
            logV17('❌ Location access denied', { error: error.message });
            resolve({ 
              error: 'Location access denied',
              message: 'Please enable location access to find nearby resources'
            });
          },
          { timeout: 10000, enableHighAccuracy: true }
        );
      });
    }
  });

  // Tool: Display notification
  conversation.registerTool?.({
    name: 'show_notification',
    description: 'Show a notification to the user',
    parameters: {
      title: { type: 'string', description: 'Notification title' },
      message: { type: 'string', description: 'Notification message' },
      type: { type: 'string', description: 'Notification type (info, warning, error)' }
    },
    handler: async ({ title, message, type = 'info' }) => {
      logV17('🔔 Agent requested notification', { title, message, type });

      // Show browser notification if permitted
      if (Notification.permission === 'granted') {
        new Notification(title as string, {
          body: message as string,
          icon: '/favicon.ico'
        });
      }

      return {
        success: true,
        message: `Notification displayed: ${title}`
      };
    }
  });

  // Tool: Open external link
  conversation.registerTool?.({
    name: 'open_link',
    description: 'Open an external link in new tab',
    parameters: {
      url: { type: 'string', description: 'URL to open' },
      title: { type: 'string', description: 'Link title/description' }
    },
    handler: async ({ url, title }) => {
      logV17('🔗 Agent requested to open link', { url, title });

      if (typeof window !== 'undefined') {
        window.open(url as string, '_blank', 'noopener,noreferrer');
      }

      return {
        success: true,
        message: `Link opened: ${title || url}`
      };
    }
  });

  logV17('✅ Client-side tools registered successfully');
}