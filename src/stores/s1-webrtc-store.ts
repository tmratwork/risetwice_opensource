// src/stores/s1-webrtc-store.ts
// S1-specific WebRTC Store for Therapy Sessions
// Based on V16 architecture but adapted for S1 (therapist practicing with AI patients)

import { create } from 'zustand';
import { optimizedAudioLogger } from '@/hooksV15/audio/optimized-audio-logger';
import { ConnectionManager } from '@/hooksV15/webrtc/connection-manager';
import { ComprehensiveMessageHandler, type MessageHandlerCallbacks } from '@/hooksV15/webrtc/comprehensive-message-handler';
import audioService from '@/hooksV15/audio/audio-service';
import type { ConnectionConfig } from '@/hooksV15/types';

// S1 conversation message interface
interface S1ConversationMessage {
  id: string;
  role: 'therapist' | 'ai_patient';
  text: string;
  timestamp: string;
  isFinal: boolean;
  status?: "speaking" | "processing" | "final" | "thinking";
  emotional_tone?: string; // S1-specific: track patient emotional state
}

// S1 Session state
export interface S1Session {
  sessionId: string;
  aiPatientId: string;
  aiPatientName: string;
  primaryConcern: string;
  sessionStatus: 'scheduled' | 'active' | 'completed';
}

// Connection state type
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

// S1 Store state interface
export interface S1WebRTCStoreState {
  // Connection state
  isConnected: boolean;
  connectionState: ConnectionState;
  isPreparing: boolean;

  // Audio visualization state
  currentVolume: number;
  audioLevel: number;
  isAudioPlaying: boolean;
  isThinking: boolean;

  // Mute state
  isMuted: boolean;
  isAudioOutputMuted: boolean;

  // S1 Conversation state
  conversation: S1ConversationMessage[];
  therapistMessage: string;
  hasActiveConversation: boolean;

  // S1-specific: Track if therapist has spoken first (to filter auto-greetings)
  therapistHasSpokenFirst: boolean;

  // S1 Session state
  s1Session: S1Session | null;

  // Internal state (not reactive)
  connectionManager: ConnectionManager | null;
  messageHandler: ComprehensiveMessageHandler | null;
  transcriptCallback: ((message: { id: string; data: string; metadata?: Record<string, unknown> }) => void) | null;
  errorCallback: ((error: Error) => void) | null;

  // End session flow state
  expectingEndSessionGoodbye: boolean;
  waitingForEndSession: boolean;
  endSessionCallId: string | null;

  // Smart fallback system
  volumeMonitoringActive: boolean;
  fallbackTimeoutId: number | null;

  // Stored configuration for reconnection
  storedConnectionConfig: ConnectionConfig | null;

  // Store actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (message: string) => boolean;
  toggleMute: () => boolean;
  toggleAudioOutputMute: () => boolean;
  addConversationMessage: (message: S1ConversationMessage) => void;
  saveMessageToSupabase: (message: S1ConversationMessage) => Promise<void>;
  updateTherapistMessage: (message: string) => void;
  clearTherapistMessage: () => void;

  // S1 Session actions
  setS1Session: (session: S1Session) => void;
  clearS1Session: () => void;

  // Internal management
  setConnectionManager: (manager: ConnectionManager) => void;
  setMessageHandler: (handler: ComprehensiveMessageHandler) => void;
  setTranscriptCallback: (callback: ((message: { id: string; data: string; metadata?: Record<string, unknown> }) => void) | null) => void;
  setErrorCallback: (callback: ((error: Error) => void) | null) => void;
  
  // Pre-initialization for config caching
  preInitialize: (config: ConnectionConfig) => Promise<void>;
}

// Create the S1 WebRTC store
export const useS1WebRTCStore = create<S1WebRTCStoreState>((set, get) => ({
  // Initial state
  isConnected: false,
  connectionState: 'disconnected',
  isPreparing: false,

  // Audio state
  currentVolume: 0,
  audioLevel: 0,
  isAudioPlaying: false,
  isThinking: false,

  // Mute state - start muted like V16
  isMuted: true,
  isAudioOutputMuted: false,

  // S1 Conversation state
  conversation: [],
  therapistMessage: '',
  hasActiveConversation: false,

  // S1-specific: Track therapist first message
  therapistHasSpokenFirst: false,

  // S1 Session state
  s1Session: null,

  // Internal state
  connectionManager: null,
  messageHandler: null,
  transcriptCallback: null,
  errorCallback: null,

  // End session flow
  expectingEndSessionGoodbye: false,
  waitingForEndSession: false,
  endSessionCallId: null,

  // Smart fallback system
  volumeMonitoringActive: false,
  fallbackTimeoutId: null,

  // Stored config
  storedConnectionConfig: null,

  // Actions
  connect: async () => {
    const state = get();
    if (!state.storedConnectionConfig) {
      console.error('[S1] No stored connection config available');
      return;
    }

    try {
      set({ 
        isPreparing: true, 
        connectionState: 'connecting',
        conversation: [], // Clear conversation history at start like V16
        therapistMessage: '', // Clear any typed message
        isMuted: true, // Reset mic to muted state for new session
        isAudioOutputMuted: false // Reset speaker to unmuted state for new session
      });
      
      console.log('[S1] Connecting with config:', {
        hasInstructions: !!state.storedConnectionConfig.instructions,
        instructionsLength: state.storedConnectionConfig.instructions?.length || 0,
        voice: state.storedConnectionConfig.voice
      });
      
      // Create ConnectionManager with the config (like V16 does)
      const manager = new ConnectionManager(state.storedConnectionConfig);
      
      // Set up message handler with proper callbacks (like V16 does)
      const messageCallbacks: MessageHandlerCallbacks = {
        onAudioTranscriptDelta: (msg: Record<string, unknown>) => {
          const delta = msg.delta as string;
          const responseId = msg.response_id as string || 'unknown';
          const role = msg.role as string || 'assistant';
          
          const currentState = get();
          
          // S1: Mark therapist as spoken when we see user input (before AI filtering)
          if (role === 'user' && !currentState.therapistHasSpokenFirst) {
            console.log('[S1] ✅ Therapist speaking detected (delta) - enabling AI responses');
            set({ therapistHasSpokenFirst: true });
          }
          
          // S1: Allow initial AI greeting deltas but filter subsequent ones
          if (role === 'assistant' && !currentState.therapistHasSpokenFirst && currentState.conversation.length > 0) {
            console.log('[S1] 🚫 Filtering out additional auto-greeting AI delta (therapist hasn\'t spoken first)');
            return;
          }
          
          if (delta && currentState.transcriptCallback) {
            currentState.transcriptCallback({
              id: responseId,
              data: delta,
              metadata: { isFinal: false, role: role === 'user' ? 'therapist' : 'ai_patient' }
            });
          }
        },
        
        onAudioTranscriptDone: (msg: Record<string, unknown>) => {
          const transcript = msg.transcript as string;
          const responseId = msg.response_id as string || 'unknown';
          const role = msg.role as string || 'assistant';
          
          console.log('[S1] Audio transcript done:', { transcriptLength: transcript?.length, responseId, role });
          
          const currentState = get();
          
          // S1: Mark therapist as spoken when we see completed user input (before AI filtering)
          if (role === 'user' && !currentState.therapistHasSpokenFirst) {
            console.log('[S1] ✅ Therapist speaking completed - enabling AI responses');
            set({ therapistHasSpokenFirst: true });
          }
          
          // S1: Allow initial AI greeting but filter subsequent auto-responses
          // User wants to hear/see AI's initial greeting, so only filter if we've seen one already
          if (role === 'assistant' && !currentState.therapistHasSpokenFirst && currentState.conversation.length > 0) {
            console.log('[S1] 🚫 Filtering out additional auto-greeting AI response (therapist hasn\'t spoken first)');
            return;
          }
          
          if (transcript && currentState.transcriptCallback) {
            currentState.transcriptCallback({
              id: responseId,
              data: transcript,
              metadata: { isFinal: true, role: role === 'user' ? 'therapist' : 'ai_patient' }
            });
          }
        },

        // Add user input handling (missing from original implementation)
        onInputAudioTranscriptionCompleted: (msg: Record<string, unknown>) => {
          const transcript = msg.transcript as string;
          const itemId = msg.item_id as string;
          
          console.log('[S1] User input transcript completed:', { transcriptLength: transcript?.length, itemId });
          
          const currentState = get();
          
          // S1: Mark that therapist has spoken when we receive voice input
          if (!currentState.therapistHasSpokenFirst) {
            console.log('[S1] ✅ Therapist spoke via voice - enabling AI responses');
            set({ therapistHasSpokenFirst: true });
          }
          
          if (transcript && currentState.transcriptCallback) {
            currentState.transcriptCallback({
              id: itemId,
              data: transcript,
              metadata: { isFinal: true, role: 'therapist' }
            });
          }
        },

        onAudioDelta: (msg: Record<string, unknown>) => {
          // Handle audio chunks for playback (copy from V16)
          const delta = msg.delta as string;
          const responseId = msg.response_id as string;
          
          // Reduced logging: audio deltas are frequent and not critical to debug
          if (delta && responseId) {
            // Audio playback will be handled by existing audio service
            // console.log('[S1] Audio chunk ready for playback'); // Commented out to reduce noise
          }
        },

        onAudioDone: (msg: Record<string, unknown>) => {
          console.log('[S1] Audio done - AI finished speaking');
          
          // Clear thinking state when AI finishes generating audio (copy from V16)
          set(state => {
            console.log('[S1] Clearing isThinking: false (onAudioDone)');
            return { ...state, isThinking: false };
          });
        },

        onFunctionCall: () => {
          // S1 doesn't use function calls - AI patients don't need tools
          console.log('[S1] Function call received (but S1 doesn\'t use functions)');
        },

        onError: (error: Error) => {
          console.error('[S1] Message handler error:', error);
          const currentState = get();
          if (currentState.errorCallback) {
            currentState.errorCallback(error);
          }
        }
      };

      const messageHandler = new ComprehensiveMessageHandler(messageCallbacks);

      // Subscribe message handler to connection manager (critical step!)
      manager.onMessage(async (event) => {
        if (messageHandler) {
          await messageHandler.handleMessage(event);
        }
      });

      // Subscribe to connection errors
      manager.onError((error) => {
        console.error('[S1] Connection manager error:', error);
        const currentState = get();
        if (currentState.errorCallback) {
          currentState.errorCallback(error);
        }
      });

      // CRITICAL: Subscribe to incoming audio streams for real-time audio monitoring (copied from V16)
      manager.onAudioStream((stream) => {
        console.log('[S1] Audio stream connected:', {
          streamId: stream.id,
          trackCount: stream.getTracks().length,
          audioTracks: stream.getAudioTracks().length,
          streamActive: stream.active
        });

        // Create audio element for AI voice playback (copied from V16)
        const audioElement = document.createElement('audio');
        audioElement.srcObject = stream;
        audioElement.autoplay = true;
        audioElement.volume = 1.0;
        audioElement.style.display = 'none';
        audioElement.id = `s1-audio-${stream.id}`;

        // Real-time volume monitoring setup (copied from V16)
        let audioContext: AudioContext | null = null;
        let analyser: AnalyserNode | null = null;
        let volumeMonitoringInterval: number | null = null;

        const setupVolumeMonitoring = () => {
          console.log('[S1] Setting up volume monitoring for audio element:', audioElement.id);
          try {
            audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            analyser = audioContext.createAnalyser();

            // Use createMediaStreamSource for WebRTC streams (critical for real-time monitoring)
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            console.log('[S1] Volume monitoring setup complete');

            // Start volume monitoring loop (copied from V16)
            volumeMonitoringInterval = window.setInterval(() => {
              if (!analyser) return;

              const currentState = get();

              analyser.getByteFrequencyData(dataArray);

              // Calculate RMS for volume
              let sum = 0;
              for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i] * dataArray[i];
              }
              const rms = Math.sqrt(sum / bufferLength);
              const normalizedVolume = rms / 255;
              const audioLevel = Math.floor(rms);
              const isAudioPlaying = rms > 10;

              // Update audio state in store
              const volumeChanged = Math.abs(currentState.currentVolume - normalizedVolume) > 0.01;
              const levelChanged = Math.abs(currentState.audioLevel - audioLevel) > 1;
              const playingChanged = currentState.isAudioPlaying !== isAudioPlaying;

              if (volumeChanged || levelChanged || playingChanged) {
                set({
                  currentVolume: normalizedVolume,
                  audioLevel: audioLevel,
                  isAudioPlaying: isAudioPlaying
                });
              }
            }, 50); // 20 FPS monitoring

          } catch (error) {
            console.error('[S1] Volume monitoring setup failed:', error);
          }
        };

        // Set up event handlers for audio element
        audioElement.oncanplay = () => {
          console.log('[S1] Audio element can play - setting up volume monitoring');
          setupVolumeMonitoring();
        };

        audioElement.onerror = (error) => {
          console.error('[S1] Audio element error:', error);
        };

        // Append to DOM for playback
        document.body.appendChild(audioElement);

        // Cleanup on stream end
        stream.addEventListener('inactive', () => {
          console.log('[S1] Audio stream inactive - cleaning up');
          if (volumeMonitoringInterval) {
            clearInterval(volumeMonitoringInterval);
          }
          if (audioContext) {
            audioContext.close();
          }
          if (audioElement.parentNode) {
            audioElement.parentNode.removeChild(audioElement);
          }
        });
      });
      
      await manager.connect();
      
      set({ 
        connectionManager: manager,
        messageHandler: messageHandler,
        isConnected: true, 
        connectionState: 'connected',
        isPreparing: false,
        hasActiveConversation: true,
        therapistHasSpokenFirst: false // Reset for new session
      });

      console.log('[S1] WebRTC connection established with message handler');
      
    } catch (error) {
      console.error('[S1] Connection failed:', error);
      set({ 
        isConnected: false, 
        connectionState: 'failed',
        isPreparing: false 
      });
    }
  },

  disconnect: async () => {
    const state = get();
    
    try {
      if (state.connectionManager) {
        await state.connectionManager.disconnect();
      }
      
      set({ 
        isConnected: false, 
        connectionState: 'disconnected',
        hasActiveConversation: false,
        conversation: [], // Clear conversation history like V16
        therapistMessage: '', // Clear any typed message
        connectionManager: null,
        messageHandler: null,
        therapistHasSpokenFirst: false // Reset for next session
      });

      console.log('[S1] WebRTC connection closed');
      
    } catch (error) {
      console.error('[S1] Disconnect error:', error);
    }
  },

  sendMessage: (message: string) => {
    const state = get();
    
    if (!state.connectionManager || !state.isConnected) {
      console.warn('[S1] Cannot send message: not connected');
      return false;
    }

    try {
      // S1: Mark that therapist has spoken first (enables AI responses)
      if (!state.therapistHasSpokenFirst) {
        console.log('[S1] ✅ Therapist speaking first - enabling AI responses');
        set({ therapistHasSpokenFirst: true });
      }
      
      // Create conversation item for the therapist message
      const conversationItem = {
        type: "conversation.item.create",
        item: {
          id: `therapist_${Date.now()}`,
          type: "message",
          role: "user", // Therapist is the user in OpenAI's perspective
          content: [{ type: "input_text", text: message }]
        }
      };

      // Send the conversation item - OpenAI will handle response automatically
      state.connectionManager.sendMessage(JSON.stringify(conversationItem));

      return true;
    } catch (error) {
      console.error('[S1] Send message error:', error);
      return false;
    }
  },

  toggleMute: () => {
    const currentState = get();
    const { connectionManager, isMuted } = currentState;

    if (!connectionManager) {
      console.warn('[S1] Cannot toggle mute: no connection manager');
      return isMuted; // Return current state if no connection manager
    }

    // Use connection manager's toggle mute functionality (like V16)
    const newMutedState = connectionManager.toggleMute();

    // Update store state
    set({ isMuted: newMutedState });

    return newMutedState;
  },

  toggleAudioOutputMute: () => {
    const currentState = get().isAudioOutputMuted;
    const newState = !currentState;

    // iOS-compatible mute implementation using .muted property (copied from V16)
    const audioElement = document.querySelector('audio') as HTMLAudioElement;
    if (audioElement) {
      audioElement.muted = newState; // ✅ Works on iOS Safari
      audioElement.volume = newState ? 0 : 1; // ✅ Fallback for other browsers
      console.log('[S1] Audio output mute toggled:', { muted: newState, volume: audioElement.volume });
    } else {
      console.warn('[S1] No audio element found for muting');
    }
    
    set({ isAudioOutputMuted: newState });
    return newState;
  },

  addConversationMessage: (message: S1ConversationMessage) => {
    set(state => ({
      conversation: [...state.conversation, message]
    }));

    // Auto-save final messages to database
    if (message.isFinal) {
      get().saveMessageToSupabase(message);
    }
  },

  saveMessageToSupabase: async (message: S1ConversationMessage) => {
    const state = get();
    
    if (!state.s1Session) {
      console.warn('[S1] Cannot save message: no active session');
      return;
    }

    try {
      await fetch('/api/s1/session-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: state.s1Session.sessionId,
          role: message.role,
          content: message.text,
          emotional_tone: message.emotional_tone
        })
      });
    } catch (error) {
      console.error('[S1] Failed to save message:', error);
    }
  },

  updateTherapistMessage: (message: string) => {
    set({ therapistMessage: message });
  },

  clearTherapistMessage: () => {
    set({ therapistMessage: '' });
  },

  setS1Session: (session: S1Session) => {
    set({ s1Session: session });
  },

  clearS1Session: () => {
    set({ s1Session: null });
  },

  // Internal management methods
  setConnectionManager: (manager: ConnectionManager) => {
    set({ connectionManager: manager });
  },

  setMessageHandler: (handler: ComprehensiveMessageHandler) => {
    set({ messageHandler: handler });
  },

  setTranscriptCallback: (callback) => {
    set({ transcriptCallback: callback });
  },

  setErrorCallback: (callback) => {
    set({ errorCallback: callback });
  },

  preInitialize: async (config: ConnectionConfig) => {
    console.log('[S1] Pre-initializing WebRTC config:', {
      hasInstructions: !!config.instructions,
      instructionsLength: config.instructions?.length || 0,
      voice: config.voice
    });

    // Store the config for later connection
    set({ storedConnectionConfig: config });
  }
}));

// Export singleton access for compatibility
export const FunctionRegistryManager = {
  getInstance: () => ({
    registerFunctions: () => {},
    clearFunctions: () => {}
  })
};