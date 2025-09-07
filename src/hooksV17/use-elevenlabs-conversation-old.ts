// src/hooksV17/use-elevenlabs-conversation.ts
// V17 Eleven Labs Conversation Hook - Agent-based with webhook tools

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
  const originalGetUserMediaRef = useRef<typeof navigator.mediaDevices.getUserMedia | null>(null);
  const isMicrophoneMutedRef = useRef<boolean>(false);
  const activeStreamsRef = useRef<MediaStream[]>([]);
  const currentAgentRef = useRef<string | null>(null);

  // Initialize Eleven Labs conversation hook with agent support
  const conversation = useConversation({
    onConnect: () => {
      logV17('🔌 Connected to Eleven Labs agent', {
        agentId: currentAgentRef.current,
        userId: user?.uid || 'anonymous'
      });
      store.setIsConnected(true);
      store.setConnectionState('connected');
    },
    
    onDisconnect: () => {
      logV17('🔌 Disconnected from Eleven Labs agent', {
        agentId: currentAgentRef.current
      });
      store.setIsConnected(false);
      store.setConnectionState('disconnected');
      currentAgentRef.current = null;
    },
    
    onMessage: (message: unknown) => {
      // Enhanced message logging for agent-based conversations
      logV17('💬 Received message from ElevenLabs agent', {
        messageType: typeof message,
        agentId: currentAgentRef.current,
        timestamp: new Date().toISOString()
      });
      
      // Store message in conversation history
      store.addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        text: extractMessageText(message),
        timestamp: new Date().toISOString(),
        isFinal: true,
        specialist: store.triageSession?.currentSpecialist || 'triage'
      });
    },
      
      // Handle incoming messages from AI - try multiple possible structures
      const msgObj = message as Record<string, unknown>;
      let messageContent = '';
      let messageSource = 'ai'; // default to AI
      
      // Extract message content
      if (msgObj?.content) {
        messageContent = msgObj.content as string;
      } else if (msgObj?.text) {
        messageContent = msgObj.text as string;
      } else if (msgObj?.message) {
        messageContent = msgObj.message as string;
      } else if (typeof message === 'string') {
        messageContent = message;
      }
      
      // Extract message source to determine role
      if (msgObj?.source) {
        messageSource = msgObj.source as string;
      }
      
      if (messageContent && messageContent.trim()) {
        const messageId = `v17-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const role = messageSource === 'user' ? 'user' : 'assistant';
        
        console.log(`[V17] ✅ Adding ${role} message to conversation:`, messageContent);
        
        // Only add user messages from voice input - not typed messages (they're already added)
        if (role === 'user') {
          // Check if this is a duplicate of a typed message by comparing recent messages
          const recentMessages = store.conversationHistory.slice(-3);
          const isDuplicate = recentMessages.some(msg => 
            msg.role === 'user' && 
            msg.text.trim() === messageContent.trim() &&
            Date.now() - new Date(msg.timestamp).getTime() < 5000 // within 5 seconds
          );
          
          if (isDuplicate) {
            console.log('[V17] 🚫 Skipping duplicate user message:', messageContent);
            return;
          }
        }
        
        store.addMessage({
          id: messageId,
          role,
          text: messageContent,
          timestamp: new Date().toISOString(),
          isFinal: true,
          status: 'final',
          specialist: store.triageSession?.currentSpecialist || 'triage',
        });
      } else {
        console.log('[V17] ⚠️ No message content found in:', message);
      }
    },
    
    onError: (error) => {
      logV17('❌ Eleven Labs error', error);
      store.setConnectionState('failed');
      console.error('[V17] Eleven Labs conversation error:', error);
    },
  });

  conversationRef.current = conversation;
  
  // Debug: Log available conversation methods when conversation is initialized - run once
  useEffect(() => {
    if (conversation) {
      console.log('[V17] 🔧 Conversation object initialized with methods:', Object.keys(conversation));
      console.log('[V17] 🔧 Initial mute state - store:', store.isMuted, 'conversation micMuted:', conversation.micMuted);
    }
  }, [conversation]); // Remove store.isMuted dependency to prevent re-initialization

  // Simple getUserMedia interception with immediate mute state application - run once on mount
  useEffect(() => {
    console.log('[V17] 🎤 Setting up simple microphone control...');
    
    // Only setup interception once
    if (!originalGetUserMediaRef.current && typeof navigator !== 'undefined') {
      // Store original function
      originalGetUserMediaRef.current = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      
      // Simple mute state flag initialization
      isMicrophoneMutedRef.current = store.isMuted;
      
      // Intercept getUserMedia to apply mute state immediately and track streams
      navigator.mediaDevices.getUserMedia = async function(constraints: MediaStreamConstraints) {
        console.log('[V17] 🎤 getUserMedia called with constraints:', constraints);
        
        // Get the stream normally
        const originalGetUserMedia = originalGetUserMediaRef.current!;
        const stream = await originalGetUserMedia(constraints);
        
        // If this is an audio stream, track it and apply current mute state immediately
        if (constraints.audio) {
          // Track this stream
          activeStreamsRef.current.push(stream);
          console.log('[V17] 🎤 Added stream to tracking, total streams:', activeStreamsRef.current.length);
          
          // Apply mute state to all tracks
          stream.getAudioTracks().forEach((track, index) => {
            track.enabled = !isMicrophoneMutedRef.current;
            console.log(`[V17] 🎤 Audio track ${index} created - enabled:`, track.enabled);
          });
          console.log('[V17] 🎤 Applied mute state to new audio stream:', isMicrophoneMutedRef.current ? 'MUTED' : 'UNMUTED');
          
          // Clean up stream reference when it ends
          stream.addEventListener('ended', () => {
            console.log('[V17] 🎤 Stream ended, removing from tracking');
            activeStreamsRef.current = activeStreamsRef.current.filter(s => s !== stream);
          });
        }
        
        return stream;
      };
      
      // Enhanced global control function that affects both existing and future streams
      (window as any).controlMicrophone = (muted: boolean) => {
        console.log('[V17] 🎤 Setting microphone mute state:', muted);
        isMicrophoneMutedRef.current = muted;
        
        // Control ALL existing streams immediately
        console.log('[V17] 🎤 Controlling', activeStreamsRef.current.length, 'existing streams');
        activeStreamsRef.current.forEach((stream, streamIndex) => {
          stream.getAudioTracks().forEach((track, trackIndex) => {
            track.enabled = !muted;
            console.log(`[V17] 🎤 Stream ${streamIndex}, track ${trackIndex} - enabled:`, track.enabled);
          });
        });
        
        console.log('[V17] 🎤 Microphone control complete:', muted ? 'MUTED' : 'UNMUTED');
      };
      
      console.log('[V17] ✅ Simple microphone control setup complete');
    }
  }, []); // Run once on mount
  
  // Update the simple mute state when store changes
  useEffect(() => {
    console.log('[V17] 🎤 Store mute state changed:', store.isMuted);
    
    // Update the simple flag
    isMicrophoneMutedRef.current = store.isMuted;
    
    // Also call global function
    if (typeof (window as any).controlMicrophone === 'function') {
      (window as any).controlMicrophone(store.isMuted);
    }
    
    console.log('[V17] 🎤 Simple mute flag updated:', store.isMuted ? 'MUTED' : 'UNMUTED');
  }, [store.isMuted]);

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