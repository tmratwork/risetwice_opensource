// src/stores/s2-webrtc-store.ts
// S2-specific WebRTC Store for Case Simulation Sessions
// Based on V16's proven message handling pattern

import { create } from 'zustand';
import { ConnectionManager } from '@/hooksV15/webrtc/connection-manager';
import { ComprehensiveMessageHandler, type MessageHandlerCallbacks } from '@/hooksV15/webrtc/comprehensive-message-handler';
import type { ConnectionConfig } from '@/hooksV15/types';

// S2 conversation message interface
interface S2ConversationMessage {
  id: string;
  role: 'therapist' | 'patient';
  text: string;
  timestamp: string;
  isFinal: boolean;
  status?: "speaking" | "processing" | "final" | "thinking";
  emotional_tone?: string;
  word_count?: number;
  sentiment_score?: number;
  clinical_relevance?: string;
}

// S2 Session state
export interface S2Session {
  sessionId: string;
  therapistProfileId: string;
  generatedScenarioId: string;
  sessionNumber: number;
  sessionStatus: 'created' | 'active' | 'completed';
  aiPersonalityPrompt: string;
}

// Connection state type
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

// S2 Store state interface
export interface S2WebRTCStoreState {
  // Connection state
  isConnected: boolean;
  connectionState: ConnectionState;
  isPreparing: boolean;

  // Audio visualization state
  currentVolume: number;
  audioLevel: number;
  isAudioPlaying: boolean;
  isThinking: boolean;
  isUserSpeaking: boolean;

  // Mute state
  isMuted: boolean;
  isAudioOutputMuted: boolean;

  // S2 Conversation state
  conversation: S2ConversationMessage[];
  hasActiveConversation: boolean;

  // S2 Session state
  s2Session: S2Session | null;

  // Internal state (not reactive)
  connectionManager: ConnectionManager | null;
  messageHandler: ComprehensiveMessageHandler | null;
  transcriptCallback: ((message: { id: string; data: string; metadata?: Record<string, unknown> }) => void) | null;
  errorCallback: ((error: Error) => void) | null;

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
  addConversationMessage: (message: S2ConversationMessage) => void;
  saveMessageToSupabase: (message: S2ConversationMessage) => Promise<void>;

  // S2 Session actions
  setS2Session: (session: S2Session) => void;
  clearS2Session: () => void;

  // Internal management
  setConnectionManager: (manager: ConnectionManager) => void;
  setMessageHandler: (handler: ComprehensiveMessageHandler) => void;
  setTranscriptCallback: (callback: ((message: { id: string; data: string; metadata?: Record<string, unknown> }) => void) | null) => void;
  setErrorCallback: (callback: ((error: Error) => void) | null) => void;

  // Pre-initialization for config caching
  preInitialize: (config: ConnectionConfig) => Promise<void>;
}

// Create the S2 WebRTC store
export const useS2WebRTCStore = create<S2WebRTCStoreState>((set, get) => ({
  // Initial state
  isConnected: false,
  connectionState: 'disconnected',
  isPreparing: false,

  // Audio state
  currentVolume: 0,
  audioLevel: 0,
  isAudioPlaying: false,
  isThinking: false,
  isUserSpeaking: false,

  // Mute state
  isMuted: false,
  isAudioOutputMuted: false,

  // Conversation state
  conversation: [],
  hasActiveConversation: false,

  // Session state
  s2Session: null,

  // Internal state
  connectionManager: null,
  messageHandler: null,
  transcriptCallback: null,
  errorCallback: null,
  volumeMonitoringActive: false,
  fallbackTimeoutId: null,
  storedConnectionConfig: null,

  // Connection management - following V16 pattern
  connect: async () => {
    const currentState = get();
    let { connectionManager } = currentState;
    const { storedConnectionConfig } = currentState;

    console.log('[S2] [DEBUG] Connect called with stored config:', {
      hasConnectionManager: !!connectionManager,
      hasStoredConfig: !!storedConnectionConfig,
      configInstructionsLength: storedConnectionConfig?.instructions?.length || 0
    });

    // If no connection manager, create one using stored config
    if (!connectionManager) {
      console.log('[S2] First connection - initializing connection manager');

      if (!storedConnectionConfig) {
        console.error('[S2] No stored config - preInitialize should have been called');
        throw new Error('No stored configuration found. Please ensure preInitialize was called.');
      }

      // Create connection manager with stored config (CRITICAL: config must be passed to constructor!)
      console.log('[S2] [DEBUG] Creating ConnectionManager with config instructions length:', storedConnectionConfig.instructions?.length || 0);
      connectionManager = new ConnectionManager(storedConnectionConfig);
      set({ connectionManager });
    }

    try {
      set({ connectionState: 'connecting', isPreparing: true });
      console.log('[S2] [DEBUG] Calling connectionManager.connect with config instructions length:', storedConnectionConfig?.instructions?.length || 0);
      await connectionManager.connect(storedConnectionConfig!);
      set({ isConnected: true, connectionState: 'connected', isPreparing: false });
      console.log('[S2] ✅ Connected successfully');
    } catch (error) {
      console.error('[S2] Connection failed:', error);
      set({ isConnected: false, connectionState: 'failed', isPreparing: false });
    }
  },

  disconnect: async () => {
    const state = get();
    if (state.connectionManager) {
      await state.connectionManager.disconnect();
    }
    set({
      isConnected: false,
      connectionState: 'disconnected',
      isPreparing: false,
      isThinking: false,
      isUserSpeaking: false
    });
    console.log('[S2] Disconnected');
  },

  sendMessage: (message: string) => {
    const state = get();
    if (!state.connectionManager || !state.isConnected) {
      console.warn('[S2] Cannot send message: not connected');
      return false;
    }

    try {
      state.connectionManager.sendMessage(message);
      console.log('[S2] Message sent:', message.substring(0, 50) + '...');
      return true;
    } catch (error) {
      console.error('[S2] Failed to send message:', error);
      return false;
    }
  },

  toggleMute: () => {
    const state = get();
    const newMutedState = !state.isMuted;

    if (state.connectionManager) {
      if (newMutedState) {
        state.connectionManager.mute();
      } else {
        state.connectionManager.unmute();
      }
    }

    set({ isMuted: newMutedState });
    console.log('[S2] Microphone', newMutedState ? 'muted' : 'unmuted');
    return newMutedState;
  },

  toggleAudioOutputMute: () => {
    const state = get();
    const newMutedState = !state.isAudioOutputMuted;

    if (state.connectionManager) {
      state.connectionManager.setAudioOutputMuted(newMutedState);
    }

    set({ isAudioOutputMuted: newMutedState });
    console.log('[S2] Audio output', newMutedState ? 'muted' : 'unmuted');
    return newMutedState;
  },

  // Key message handling - based on V16's proven approach
  addConversationMessage: (message: S2ConversationMessage) => {
    console.log('[S2] [message_persistence] Adding message to conversation:', {
      id: message.id,
      role: message.role,
      textLength: message.text.length,
      textPreview: message.text.substring(0, 100) + (message.text.length > 100 ? '...' : ''),
      isFinal: message.isFinal,
      status: message.status
    });

    set(state => ({
      conversation: [...state.conversation, message],
      hasActiveConversation: true
    }));

    // Only save final messages to Supabase - streaming messages are UI-only
    if (message.isFinal) {
      console.log('[S2] [message_persistence] Message is final, saving to Supabase');
      const currentState = get();
      currentState.saveMessageToSupabase(message).catch(error => {
        console.error('[S2] [message_persistence] Failed to save message to Supabase:', error);
        // Don't break the conversation flow on save errors
      });
    } else {
      console.log('[S2] [message_persistence] Message is streaming/incomplete, skipping Supabase save');
    }
  },

  // Save message to S2-specific Supabase tables
  saveMessageToSupabase: async (message: S2ConversationMessage) => {
    const logPrefix = '[S2] [message_persistence]';

    try {
      const state = get();

      if (!state.s2Session) {
        console.warn(`${logPrefix} Cannot save message: no active S2 session`);
        return;
      }

      // Get therapist user ID from localStorage
      let therapistUserId: string | null = null;
      if (typeof localStorage !== 'undefined') {
        therapistUserId = localStorage.getItem('userId') || localStorage.getItem('s2UserId');
      }

      if (!therapistUserId) {
        console.warn(`${logPrefix} Missing therapist user ID, skipping message save`);
        return;
      }

      console.log(`${logPrefix} [CONTENT_DEBUG] Preparing to save message:`, {
        messageId: message.id,
        messageRole: message.role,
        messageTextLength: message.text.length,
        messageTextPreview: message.text.substring(0, 100) + (message.text.length > 100 ? '...' : ''),
        messageTextFull: message.text,
        sessionId: state.s2Session.sessionId,
        therapistUserId
      });

      // Use S2's dedicated API endpoint
      const requestData = {
        action: 'save_message',
        sessionId: state.s2Session.sessionId,
        userId: therapistUserId,
        messageData: {
          role: message.role,
          content: message.text,
          timestamp: message.timestamp,
          messageId: message.id,
          emotional_tone: message.emotional_tone,
          word_count: message.word_count,
          sentiment_score: message.sentiment_score,
          clinical_relevance: message.clinical_relevance
        }
      };

      console.log(`${logPrefix} Sending request to S2 API:`, requestData);

      const response = await fetch('/api/s2/session', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      console.log(`${logPrefix} Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${response.status} - ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(`Save failed: ${data.error || 'Unknown error'}`);
      }

      console.log(`${logPrefix} ✅ Message saved successfully to s2_session_messages table`);
    } catch (error) {
      console.error(`${logPrefix} ❌ Failed to save message:`, error);
      throw error; // Let caller handle the error
    }
  },

  // S2 Session management
  setS2Session: (session: S2Session) => {
    set({ s2Session: session });
    console.log('[S2] S2 session set:', session.sessionId);
  },

  clearS2Session: () => {
    set({ s2Session: null, conversation: [], hasActiveConversation: false });
    console.log('[S2] S2 session cleared');
  },

  // Internal management
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
    console.log('[S2] [DEBUG] Pre-initializing with config:', {
      hasInstructions: !!config.instructions,
      instructionsLength: config.instructions?.length || 0,
      instructionsPreview: config.instructions?.substring(0, 100) || 'EMPTY',
      voice: config.voice,
      hasGreetingInstructions: !!config.greetingInstructions
    });

    // Store the complete config for later use
    set({ storedConnectionConfig: config });

    // Don't create connection manager here - wait for connect()
    // This matches V16 pattern where connection manager is created during connect

    console.log('[S2] [DEBUG] Pre-initialization complete - config stored');
  }
}));