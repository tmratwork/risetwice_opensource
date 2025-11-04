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
  // ✅ Keep store for initial values and non-callback usage
  const store = useElevenLabsStore();
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  // Track custom first message for logging after connection
  const customFirstMessageRef = useRef<string | null>(null);

  // WebRTC stream tracking for microphone mute control
  const activeStreamsRef = useRef<MediaStream[]>([]);
  const isMicrophoneMutedRef = useRef<boolean>(store.isMuted);
  const originalGetUserMediaRef = useRef<typeof navigator.mediaDevices.getUserMedia | null>(null);

  // VAD-based user speaking detection (no longer using message-based detection for V17)

  // Track VAD state for user speaking detection
  const vadDetectedSpeechRef = useRef<boolean>(false);
  const vadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize ElevenLabs conversation hook with agent support and VAD for thinking dots
  const conversation = useConversation({
    onConnect: () => {
      // ✅ Use getState() for store access in callbacks
      const state = useElevenLabsStore.getState();

      logV17('🔌 Connected to ElevenLabs agent', {
        agentId: currentAgentId,
        userId: user?.uid || 'anonymous',
        specialist: state.triageSession?.currentSpecialist
      });

      // Log whether custom first message or default greeting will be used
      if (customFirstMessageRef.current) {
        logV17('👋 AI Preview will use CUSTOM opening statement', {
          preview: customFirstMessageRef.current.substring(0, 100) + '...',
          fullLength: customFirstMessageRef.current.length
        });
      } else {
        logV17('👋 AI Preview will use DEFAULT greeting (no custom opening statement provided)');
      }

      state.setIsConnected(true);
      state.setConnectionState('connected');
      setIsPreparing(false);

      // Ensure microphone starts muted like V16
      logV17('🎤 Setting initial mic mute state to true (like V16)');
      const windowWithMicrophone = window as Window & { controlMicrophone?: (muted: boolean) => void };
      if (typeof windowWithMicrophone.controlMicrophone === 'function') {
        windowWithMicrophone.controlMicrophone(true);
      }
    },

    onDisconnect: () => {
      // ✅ Use getState() for store access in callbacks
      const state = useElevenLabsStore.getState();

      logV17('🔌 Disconnected from ElevenLabs agent', {
        agentId: currentAgentId,
        specialist: state.triageSession?.currentSpecialist
      });
      state.setIsConnected(false);
      state.setConnectionState('disconnected');
      setIsPreparing(false);

      // Reset thinking states on disconnect
      state.setIsUserSpeaking(false);
      state.setIsThinking(false);
      vadDetectedSpeechRef.current = false;

      // Clear custom first message ref
      customFirstMessageRef.current = null;
    },

    // VAD (Voice Activity Detection) callback - detects when user starts/stops speaking
    onVadScore: (event: { vadScore: number }) => {
      // Threshold for detecting speech
      const speechThreshold = 0.5;
      const isSpeechDetected = event.vadScore > speechThreshold;

      // Only update state when speech detection changes
      if (isSpeechDetected && !vadDetectedSpeechRef.current) {
        console.log('🎤 [VAD] User STARTED speaking');
        vadDetectedSpeechRef.current = true;
        useElevenLabsStore.getState().setIsUserSpeaking(true);
        useElevenLabsStore.getState().setIsThinking(false);

        // Clear any existing timeout
        if (vadTimeoutRef.current) {
          clearTimeout(vadTimeoutRef.current);
        }

      } else if (!isSpeechDetected && vadDetectedSpeechRef.current) {
        console.log('🎤 [VAD] User STOPPED speaking → Show Thinking...');
        vadDetectedSpeechRef.current = false;
        useElevenLabsStore.getState().setIsUserSpeaking(false);

        // ✅ Show "Thinking..." immediately when user stops speaking
        useElevenLabsStore.getState().setIsThinking(true);

        // Clear timeout
        if (vadTimeoutRef.current) {
          clearTimeout(vadTimeoutRef.current);
        }
      }

      // Safety: Force clear after 5 seconds of continuous speech
      if (isSpeechDetected) {
        if (vadTimeoutRef.current) {
          clearTimeout(vadTimeoutRef.current);
        }
        vadTimeoutRef.current = setTimeout(() => {
          console.log('🎤 [VAD] TIMEOUT: Forcing user speech end after 5s → Show Thinking...');
          vadDetectedSpeechRef.current = false;
          useElevenLabsStore.getState().setIsUserSpeaking(false);
          useElevenLabsStore.getState().setIsThinking(true);
        }, 5000);
      }
    },


    // Audio callback - equivalent to OpenAI's onAudioDone (agent starts responding)
    onAudio: (audio: unknown) => {
      logV17('🔊 Agent audio received - clearing thinking state', { hasAudio: !!audio });

      // Log audio event structure to understand the format
      console.log('[ai_audio_capture] 🎵 Audio event received:', {
        type: typeof audio,
        isNull: audio === null,
        isUndefined: audio === undefined,
        keys: audio ? Object.keys(audio as object) : [],
        firstChars: typeof audio === 'string' ? (audio as string).substring(0, 50) : 'N/A',
        sample: typeof audio === 'string' ? (audio as string).charCodeAt(0) + ',' + (audio as string).charCodeAt(1) + ',' + (audio as string).charCodeAt(2) : 'N/A'
      });

      // Broadcast AI audio event for voice recording hook
      const audioEvent = new CustomEvent('elevenlabs-ai-audio', { detail: audio });
      window.dispatchEvent(audioEvent);

      // ✅ Use getState() for store access in callbacks
      useElevenLabsStore.getState().setIsThinking(false); // Clear thinking when agent starts generating audio
    },
    
    onMessage: (message: unknown) => {
      // Extract and process message content
      const messageData = extractMessageData(message);

      if (messageData.text) {
        const role = messageData.isUserMessage ? 'user' : 'assistant';

        console.log(`💬 [MSG] ${role}:`, messageData.text.substring(0, 50));

        // Message-based thinking dots state management
        if (messageData.isUserMessage) {
          console.log('💬 [MSG] User message received (thinking already showing)');
          // Force clear listening state when user message arrives (safety)
          vadDetectedSpeechRef.current = false;
          useElevenLabsStore.getState().setIsUserSpeaking(false);
          // Don't set thinking here - already set by VAD when user stopped speaking
        } else {
          console.log('✅ [MSG] AI response received → Clear thinking');
          useElevenLabsStore.getState().setIsThinking(false);
        }

        // Prevent duplicate messages (same text within 2 seconds)
        // ✅ Use getState() for store access in callbacks
        const state = useElevenLabsStore.getState();
        const recentMessages = state.conversationHistory.slice(-3); // Check last 3 messages
        const isDuplicate = recentMessages.some(msg =>
          msg.text === messageData.text &&
          msg.role === role &&
          (Date.now() - new Date(msg.timestamp).getTime()) < 2000
        );

        if (!isDuplicate) {
          state.addMessage({
            id: `v17-${role}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            role: role,
            text: messageData.text,
            timestamp: new Date().toISOString(),
            isFinal: messageData.isFinal,
            specialist: state.triageSession?.currentSpecialist || 'triage'
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

      // ✅ Use getState() for store access in callbacks
      useElevenLabsStore.getState().setConnectionState('failed');
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

        // Expose stream globally for voice recording hook
        const windowWithStream = window as Window & { v17AudioStream?: MediaStream };
        windowWithStream.v17AudioStream = stream;
        logV17('🎤 Exposed stream globally for voice recording', { streamId: stream.id });

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
          // Clear global reference
          const windowWithStream = window as Window & { v17AudioStream?: MediaStream };
          if (windowWithStream.v17AudioStream === stream) {
            delete windowWithStream.v17AudioStream;
          }
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

  // Real-time audio monitoring - Stable implementation
  const audioMonitoringRef = useRef<{
    animationFrameId?: number;
    isRunning: boolean;
    conversation?: unknown;
  }>({ isRunning: false });

  // Fix conversation ID detection - try multiple possible ID properties with proper type handling
  const conversationId = (() => {
    if (!conversation) return null;
    const conv = conversation as Record<string, unknown>;
    return conv.id || conv.conversationId || conv.sessionId || null;
  })();
  const isConnected = store.isConnected;

  // Monitor for excessive parent re-renders (performance warning)
  const renderCount = useRef(0);
  renderCount.current++;

  // Only log excessive renders to identify parent component issues
  if (renderCount.current > 50 && renderCount.current % 50 === 0) {
    console.warn(`[DEBUG] EXCESSIVE RENDERS: Hook rendered ${renderCount.current} times - parent component issue`);
  }

  useEffect(() => {

    // Early exit if no connection or conversation
    if (!isConnected || !conversation) {
      // Stop monitoring if it's running
      if (audioMonitoringRef.current.isRunning) {
        audioMonitoringRef.current.isRunning = false;
        if (audioMonitoringRef.current.animationFrameId) {
          cancelAnimationFrame(audioMonitoringRef.current.animationFrameId);
          // Only log if V17 logs are enabled (reduce noise)
          if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
            console.log('[V17] 🎵 Audio monitoring stopped');
          }
        }
      }
      return;
    }

    // If already monitoring this conversation, don't restart
    if (audioMonitoringRef.current.isRunning &&
        audioMonitoringRef.current.conversation === conversation) {
      return;
    }

    // Stop any existing monitoring
    if (audioMonitoringRef.current.animationFrameId) {
      cancelAnimationFrame(audioMonitoringRef.current.animationFrameId);
    }

    // Start fresh monitoring
    audioMonitoringRef.current.isRunning = true;
    audioMonitoringRef.current.conversation = conversation;

    // Only log if V17 logs are enabled (reduce noise)
    if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
      console.log('[V17] 🎵 Audio monitoring started');
    }

    let lastOutputVolume = 0;
    let lastIsSpeaking = false;

    const monitorAudio = () => {
      // Only continue if still supposed to be running and connected
      if (!audioMonitoringRef.current.isRunning || !isConnected) {
        return;
      }

      try {
        const outputVolume = conversation.getOutputVolume?.() || 0;

        // ✅ FIX: Use volume threshold instead of isSpeaking property
        // ElevenLabs doesn't reliably set isSpeaking, so detect speech by volume
        const isSpeaking = outputVolume > 0.01; // Speaking if volume above threshold

        if (isSpeaking && !lastIsSpeaking) {
          console.log('🔊 [ORB] Agent STARTED speaking (volume detected)');
          // ✅ Use getState() for store access in callbacks
          useElevenLabsStore.getState().setIsThinking(false);
        } else if (!isSpeaking && lastIsSpeaking) {
          console.log('🔇 [ORB] Agent STOPPED speaking (volume dropped)');
        }

        if (Math.abs(outputVolume - lastOutputVolume) > 0.01 || isSpeaking !== lastIsSpeaking) {
          // ✅ Use getState() for store access in callbacks
          const state = useElevenLabsStore.getState();
          state.setCurrentVolume(outputVolume);
          state.setAudioLevel(Math.floor(outputVolume * 100));
          state.setIsAudioPlaying(isSpeaking);

          lastOutputVolume = outputVolume;
          lastIsSpeaking = isSpeaking;
        }

        if (audioMonitoringRef.current.isRunning) {
          audioMonitoringRef.current.animationFrameId = requestAnimationFrame(monitorAudio);
        }
      } catch (error) {
        if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
          console.error('[V17] ❌ Error in audio monitoring', error);
        }
        if (audioMonitoringRef.current.isRunning) {
          audioMonitoringRef.current.animationFrameId = requestAnimationFrame(monitorAudio);
        }
      }
    };

    audioMonitoringRef.current.animationFrameId = requestAnimationFrame(monitorAudio);

    return () => {
      audioMonitoringRef.current.isRunning = false;
      if (audioMonitoringRef.current.animationFrameId) {
        cancelAnimationFrame(audioMonitoringRef.current.animationFrameId);
        // Only log if V17 logs are enabled (reduce noise)
        if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
          console.log('[V17] 🎵 Audio monitoring stopped');
        }
      }
    };
  }, [conversationId, isConnected]); // Use stable conversationId instead of conversation object

  // Client-side tools integration - disabled for now as registerTool is not available in current SDK
  // useEffect(() => {
  //   if (conversation && store.isConnected) {
  //     registerClientTools(conversation);
  //   }
  // }, [conversation, store.isConnected]);

  // Start session with specific specialist agent (with optional demo parameters and custom first message)
  const startSession = useCallback(async (specialistType: string = 'triage', demoVoiceId?: string, demoPromptAppend?: string, customFirstMessage?: string) => {
    try {
      setIsPreparing(true);

      // Store custom first message in ref for logging after connection
      customFirstMessageRef.current = customFirstMessage || null;

      logV17('🚀 Starting ElevenLabs session', {
        specialistType,
        userId: user?.uid || 'anonymous',
        isDemoRequest: !!(demoVoiceId || demoPromptAppend),
        demoVoiceId,
        demoPromptLength: demoPromptAppend?.length || 0,
        hasCustomFirstMessage: !!customFirstMessage,
        customFirstMessagePreview: customFirstMessage?.substring(0, 50)
      });

      // 1. Load saved voice preferences from localStorage
      let voicePreferences = null;
      try {
        const savedPrefs = localStorage.getItem('v17_voice_preferences');
        if (savedPrefs) {
          voicePreferences = JSON.parse(savedPrefs);
          logV17('📖 Loaded voice preferences from localStorage', {
            hasPreferences: true,
            speed: voicePreferences.voice_settings?.speed,
            stability: voicePreferences.voice_settings?.stability,
            modelFamily: voicePreferences.model_family
          });
        }
      } catch (error) {
        logV17('⚠️ Failed to load voice preferences', { error });
      }

      // 2. Create or get agent for specialist with voice preferences
      const agentResponse = await fetch('/api/v17/agents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specialistType,
          userId: user?.uid || null,
          voiceId: demoVoiceId || 'EmtkmiOFoQVpKRVpXH2B', // Use demo voice or V17 default
          demoPromptAppend, // Pass demo prompt append if provided
          voicePreferences // ✅ Pass saved voice preferences to API
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
      // Include custom first message override if provided
      await conversation.startSession({
        agentId: agent.agent_id,
        connectionType: 'webrtc', // Use WebRTC for better audio quality
        userId: user?.uid || undefined, // Optional user tracking
        ...(customFirstMessage && {
          overrides: {
            agent: {
              firstMessage: customFirstMessage
            }
          }
        })
      });

      logV17('✅ ElevenLabs session started successfully', {
        agentId: agent.agent_id,
        specialistType,
        usedCustomFirstMessage: !!customFirstMessage
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

    // Extract text content - ElevenLabs uses "message" field
    const text = (
      (msgObj.message as string) ||  // ✅ ElevenLabs uses this
      (msgObj.content as string) ||
      (msgObj.text as string) ||
      (msgObj.data as string) ||
      (msgObj.transcript as string) ||
      ''
    );

    // Determine if this is a user message based on message structure
    // ✅ ElevenLabs uses source: "user" or source: "ai"
    const isUserMessage = (
      msgObj.source === 'user' ||  // ✅ ElevenLabs format
      msgObj.type === 'user_transcript' ||
      msgObj.role === 'user' ||
      msgObj.speaker === 'user' ||
      (msgObj.type === 'transcript' && msgObj.source !== 'agent') ||
      false
    );

    // ⚠️ ElevenLabs doesn't send tentative transcripts - all messages are final
    // We'll use VAD events for "Listening..." state instead
    const isFinal = true; // Always true for ElevenLabs messages

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