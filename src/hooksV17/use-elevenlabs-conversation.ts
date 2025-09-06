// src/hooksV17/use-elevenlabs-conversation.ts
// V17 Eleven Labs Conversation Hook

import { useEffect, useCallback, useRef } from 'react';
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
  const conversationRef = useRef<ReturnType<typeof useConversation> | null>(null);

  // Initialize Eleven Labs conversation hook
  const conversation = useConversation({
    onConnect: () => {
      logV17('🔌 Connected to Eleven Labs');
      store.setIsConnected(true);
      store.setConnectionState('connected');
    },
    
    onDisconnect: () => {
      logV17('🔌 Disconnected from Eleven Labs');
      store.setIsConnected(false);
      store.setConnectionState('disconnected');
    },
    
    onMessage: (message: unknown) => {
      logV17('💬 Received message from Eleven Labs', {
        messageType: typeof message,
        hasContent: !!(message as Record<string, unknown>)?.content
      });
      
      // Handle incoming messages from AI
      if ((message as Record<string, unknown>)?.content) {
        const messageContent = (message as Record<string, unknown>).content as string;
        const messageId = `v17-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        store.addMessage({
          id: messageId,
          role: 'assistant',
          text: messageContent,
          timestamp: new Date().toISOString(),
          isFinal: true,
          status: 'final',
          specialist: store.triageSession?.currentSpecialist || 'triage',
        });
      }
    },
    
    onError: (error) => {
      logV17('❌ Eleven Labs error', error);
      store.setConnectionState('failed');
      console.error('[V17] Eleven Labs conversation error:', error);
    },
  });

  conversationRef.current = conversation;

  // Start a new conversation session
  const startSession = useCallback(async (
    specialistType: string = 'triage',
    contextSummary?: string
  ) => {
    try {
      logV17('🚀 Starting Eleven Labs session', { specialistType, hasContext: !!contextSummary });

      // Get the default agent ID from environment or use a fallback
      const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
      if (!agentId) {
        throw new Error('Missing NEXT_PUBLIC_ELEVENLABS_AGENT_ID environment variable');
      }

      store.setConnectionState('connecting');
      store.setIsPreparing(true);

      // Call V17 start-session API to get prompt and configuration
      const sessionResponse = await fetch('/api/v17/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid || 'anonymous',
          specialistType,
          conversationId: store.conversationId,
          contextSummary,
          agentId,
        }),
      });

      if (!sessionResponse.ok) {
        throw new Error(`Failed to start V17 session: ${sessionResponse.status}`);
      }

      const sessionData = await sessionResponse.json();
      logV17('✅ V17 session configured', {
        specialistType: sessionData.session.specialistType,
        promptLength: sessionData.session.prompt.content?.length || 0
      });

      // Get signed URL for connection
      const signedUrlResponse = await fetch('/api/v17/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          agentId,
          includeConversationId: false 
        }),
      });

      if (!signedUrlResponse.ok) {
        throw new Error(`Failed to get signed URL: ${signedUrlResponse.status}`);
      }

      const { signed_url } = await signedUrlResponse.json();
      
      // Update store with session information
      store.setAgentId(agentId);
      store.setSignedUrl(signed_url);
      
      // Update triage session
      const sessionId = `v17-session-${Date.now()}`;
      store.setTriageSession({
        sessionId,
        currentSpecialist: specialistType,
        conversationId: store.conversationId,
        contextSummary,
        isHandoffPending: false,
        agentId,
      });

      // Start the actual Eleven Labs conversation
      await conversation.startSession({
        agentId,
        connectionType: 'webrtc',
      });

      store.setIsPreparing(false);
      logV17('✅ Eleven Labs session started successfully');

    } catch (error) {
      logV17('❌ Failed to start Eleven Labs session', error);
      store.setConnectionState('failed');
      store.setIsPreparing(false);
      throw error;
    }
  }, [conversation, store, user]);

  // End the current conversation session
  const endSession = useCallback(async (reason: string = 'user_request') => {
    try {
      logV17('🛑 Ending Eleven Labs session', { reason });

      // End the Eleven Labs conversation
      if (conversation && store.isConnected) {
        await conversation.endSession();
      }

      // Call V17 end-session API
      await store.endSession(reason);

      logV17('✅ Eleven Labs session ended');

    } catch (error) {
      logV17('❌ Error ending Eleven Labs session', error);
      // Still update local state even if there's an error
      store.setIsConnected(false);
      store.setConnectionState('disconnected');
      throw error;
    }
  }, [conversation, store]);

  // Switch to a different specialist (handoff)
  const switchSpecialist = useCallback(async (
    newSpecialist: string,
    contextSummary: string
  ) => {
    try {
      logV17('🔄 Switching specialist via Eleven Labs', { 
        from: store.triageSession?.currentSpecialist,
        to: newSpecialist 
      });

      store.setIsHandoffInProgress(true);

      // End current session
      await endSession('specialist_handoff');

      // Brief delay for clean handoff
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Start new specialist session
      await startSession(newSpecialist, contextSummary);

      store.setIsHandoffInProgress(false);
      logV17('✅ Specialist handoff completed via Eleven Labs');

    } catch (error) {
      logV17('❌ Failed to switch specialist via Eleven Labs', error);
      store.setIsHandoffInProgress(false);
      throw error;
    }
  }, [store, endSession, startSession]);

  // Set output volume
  const setVolume = useCallback((volume: number) => {
    if (conversation) {
      conversation.setVolume({ volume });
      store.setCurrentVolume(volume);
      logV17('🔊 Volume set', { volume });
    }
  }, [conversation, store]);

  // Check if currently speaking
  const isSpeaking = conversation?.isSpeaking || false;

  // Update store with speaking status
  useEffect(() => {
    store.setIsAudioPlaying(isSpeaking);
  }, [isSpeaking, store.setIsAudioPlaying]);

  // Connection status from Eleven Labs
  const status = conversation?.status || 'disconnected';

  // Update store with connection status
  useEffect(() => {
    if (status === 'connected') {
      store.setConnectionState('connected');
      store.setIsConnected(true);
    } else if (status === 'connecting') {
      store.setConnectionState('connecting');
    } else {
      store.setConnectionState('disconnected');
      store.setIsConnected(false);
    }
  }, [status, store.setConnectionState, store.setIsConnected]);

  return {
    // Eleven Labs conversation instance
    conversation,
    
    // Connection state
    isConnected: store.isConnected,
    connectionState: store.connectionState,
    isPreparing: store.isPreparing,
    
    // Audio state
    isSpeaking,
    currentVolume: store.currentVolume,
    
    // Session management
    startSession,
    endSession,
    switchSpecialist,
    
    // Audio controls
    setVolume,
    
    // Triage state
    triageSession: store.triageSession,
    isHandoffInProgress: store.isHandoffInProgress,
  };
}