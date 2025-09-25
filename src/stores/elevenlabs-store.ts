// src/stores/elevenlabs-store.ts
// V17 Eleven Labs WebRTC Store - Separate from V16 WebRTC store

import { create } from 'zustand';

// V17 conditional logging
const logV17 = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
    console.log(`[V17] ${message}`, ...args);
  }
};

// V17 Conversation message interface
interface ConversationMessage {
  id: string;
  role: string;
  text: string;
  timestamp: string;
  isFinal: boolean;
  status?: "speaking" | "processing" | "final" | "thinking";
  specialist?: string; // V17 specialist tracking
}

// V17 Triage session state
export interface TriageSession {
  sessionId: string;
  currentSpecialist: string | null;
  conversationId: string | null;
  contextSummary?: string;
  isHandoffPending: boolean;
  agentId: string | null;
}

// V17 Resource locator context interface
export interface ResourceLocatorContextType {
  source: string;
  timestamp: number;
  mode: string;
  selectedResource: {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    functionName: string;
    category: string;
    parameters: Record<string, unknown>;
  };
}

// V17 Connection state type
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

// V17 Store state interface
export interface ElevenLabsStoreState {
  // Connection state
  isConnected: boolean;
  connectionState: ConnectionState;
  isPreparing: boolean;
  connectionType: 'webrtc' | 'websocket';

  // Audio visualization state
  currentVolume: number;
  audioLevel: number;
  isAudioPlaying: boolean;
  isThinking: boolean;
  isUserSpeaking: boolean;

  // Mute state
  isMuted: boolean;
  isAudioOutputMuted: boolean;

  // Conversation state
  conversationHistory: ConversationMessage[];
  pendingResponses: Map<string, ConversationMessage>;
  conversationId: string | null;

  // V17 Triage state
  triageSession: TriageSession | null;
  isHandoffInProgress: boolean;
  
  // V17 Resource locator state
  resourceLocatorContext: ResourceLocatorContextType | null;

  // V17 Eleven Labs specific
  agentId: string | null;
  signedUrl: string | null;
  conversationToken: string | null;
  
  // Actions
  setConnectionState: (state: ConnectionState) => void;
  setIsConnected: (connected: boolean) => void;
  setIsPreparing: (preparing: boolean) => void;
  
  // Audio actions
  setCurrentVolume: (volume: number) => void;
  setAudioLevel: (level: number) => void;
  setIsAudioPlaying: (playing: boolean) => void;
  setIsThinking: (thinking: boolean) => void;
  setIsUserSpeaking: (speaking: boolean) => void;
  setIsMuted: (muted: boolean) => void;
  setIsAudioOutputMuted: (muted: boolean) => void;

  // Conversation actions
  addMessage: (message: ConversationMessage) => void;
  updateMessage: (id: string, updates: Partial<ConversationMessage>) => void;
  clearConversation: () => void;
  setConversationId: (id: string | null) => void;

  // V17 Triage actions
  setTriageSession: (session: TriageSession | null) => void;
  setIsHandoffInProgress: (inProgress: boolean) => void;
  updateTriageSession: (updates: Partial<TriageSession>) => void;

  // V17 Resource locator actions
  setResourceLocatorContext: (context: ResourceLocatorContextType | null) => void;

  // V17 Eleven Labs actions
  setAgentId: (id: string | null) => void;
  setSignedUrl: (url: string | null) => void;
  setConversationToken: (token: string | null) => void;
  setConnectionType: (type: 'webrtc' | 'websocket') => void;

  // V17 Session management
  createConversation: () => Promise<string>;
  startSession: (agentId: string, specialistType?: string, contextSummary?: string) => Promise<void>;
  endSession: (reason?: string) => Promise<void>;
  switchSpecialist: (specialistType: string, contextSummary: string) => Promise<void>;

  // Reset store
  resetStore: () => void;
}

// V17 Default triage session
const defaultTriageSession: TriageSession = {
  sessionId: '',
  currentSpecialist: null,
  conversationId: null,
  contextSummary: undefined,
  isHandoffPending: false,
  agentId: null,
};

// V17 Eleven Labs store implementation
export const useElevenLabsStore = create<ElevenLabsStoreState>((set, get) => ({
  // Initial state
  isConnected: false,
  connectionState: 'disconnected',
  isPreparing: false,
  connectionType: 'webrtc',
  
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
  conversationHistory: [],
  pendingResponses: new Map(),
  conversationId: null,
  
  // V17 Triage state
  triageSession: defaultTriageSession,
  isHandoffInProgress: false,
  
  // V17 Resource locator state
  resourceLocatorContext: null,
  
  // V17 Eleven Labs specific
  agentId: null,
  signedUrl: null,
  conversationToken: null,

  // Basic actions
  setConnectionState: (state) => {
    logV17('🔄 Connection state changed', { from: get().connectionState, to: state });
    set({ connectionState: state });
  },
  
  setIsConnected: (connected) => {
    logV17('🔌 Connection status changed', { connected });
    set({ isConnected: connected });
  },
  
  setIsPreparing: (preparing) => set({ isPreparing: preparing }),

  // Audio actions
  setCurrentVolume: (volume) => set({ currentVolume: volume }),
  setAudioLevel: (level) => set({ audioLevel: level }),
  setIsAudioPlaying: (playing) => set({ isAudioPlaying: playing }),
  setIsThinking: (thinking) => set({ isThinking: thinking }),
  setIsUserSpeaking: (speaking) => set({ isUserSpeaking: speaking }),
  setIsMuted: (muted) => set({ isMuted: muted }),
  setIsAudioOutputMuted: (muted) => set({ isAudioOutputMuted: muted }),

  // Conversation actions
  addMessage: (message) => {
    logV17('💬 Adding message', { 
      id: message.id, 
      role: message.role, 
      textLength: message.text.length,
      specialist: message.specialist 
    });
    set((state) => ({
      conversationHistory: [...state.conversationHistory, message]
    }));
  },

  updateMessage: (id, updates) => {
    set((state) => ({
      conversationHistory: state.conversationHistory.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      )
    }));
  },

  clearConversation: () => {
    logV17('🗑️ Clearing conversation history');
    set({ conversationHistory: [], pendingResponses: new Map() });
  },

  setConversationId: (id) => {
    logV17('🆔 Setting conversation ID', { id });
    set({ conversationId: id });
    // Sync to localStorage for handoff functions compatibility
    if (id) {
      localStorage.setItem('currentConversationId', id);
    } else {
      localStorage.removeItem('currentConversationId');
    }
  },

  // V17 Triage actions
  setTriageSession: (session) => {
    logV17('🏥 Setting triage session', session);
    set({ triageSession: session });
  },

  setIsHandoffInProgress: (inProgress) => {
    logV17('🔄 Handoff status changed', { inProgress });
    set({ isHandoffInProgress: inProgress });
  },

  updateTriageSession: (updates) => {
    set((state) => ({
      triageSession: state.triageSession ? { ...state.triageSession, ...updates } : null
    }));
  },

  // V17 Resource locator actions
  setResourceLocatorContext: (context) => {
    logV17('📍 Setting resource locator context', context);
    set({ resourceLocatorContext: context });
  },

  // V17 Eleven Labs actions
  setAgentId: (id) => {
    logV17('🤖 Setting agent ID', { id });
    set({ agentId: id });
  },

  setSignedUrl: (url) => {
    logV17('🔐 Setting signed URL', { hasUrl: !!url });
    set({ signedUrl: url });
  },

  setConversationToken: (token) => {
    logV17('🎫 Setting conversation token', { hasToken: !!token });
    set({ conversationToken: token });
  },

  setConnectionType: (type) => {
    logV17('🔗 Setting connection type', { type });
    set({ connectionType: type });
  },

  // V17 Session management
  createConversation: async () => {
    logV17('🆕 Creating new V17 conversation');
    
    try {
      // For now, create a simple UUID-like ID
      // TODO: Replace with actual API call to create conversation in database
      const conversationId = `v17-conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      get().setConversationId(conversationId);
      
      logV17('✅ V17 conversation created', { conversationId });
      return conversationId;
    } catch (error) {
      logV17('❌ Failed to create V17 conversation', error);
      throw error;
    }
  },

  startSession: async (agentId, specialistType = 'triage', contextSummary) => {
    logV17('🚀 Starting V17 session', { agentId, specialistType, hasContext: !!contextSummary });
    
    try {
      const state = get();
      
      // Get signed URL from server
      const response = await fetch('/api/v17/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get signed URL: ${response.status}`);
      }

      const { signed_url } = await response.json();
      
      // Update store with session info
      set({
        agentId,
        signedUrl: signed_url,
        connectionState: 'connecting',
      });

      // Update triage session
      const sessionId = `v17-session-${Date.now()}`;
      const updatedTriageSession: TriageSession = {
        sessionId,
        currentSpecialist: specialistType,
        conversationId: state.conversationId,
        contextSummary,
        isHandoffPending: false,
        agentId,
      };
      
      get().setTriageSession(updatedTriageSession);
      
      logV17('✅ V17 session started', { sessionId, specialistType, agentId });
      
    } catch (error) {
      logV17('❌ Failed to start V17 session', error);
      set({ connectionState: 'failed' });
      throw error;
    }
  },

  endSession: async (reason = 'user_request') => {
    logV17('🛑 Ending V17 session', { reason });
    
    try {
      const state = get();
      
      if (state.conversationId && state.triageSession) {
        // Call end-session API
        await fetch('/api/v17/end-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: state.conversationId,
            specialistType: state.triageSession.currentSpecialist,
            contextSummary: state.triageSession.contextSummary,
            reason,
          }),
        });
      }
      
      // Reset connection state
      set({
        isConnected: false,
        connectionState: 'disconnected',
        agentId: null,
        signedUrl: null,
        conversationToken: null,
      });
      
      // Reset triage session
      get().setTriageSession(defaultTriageSession);
      
      logV17('✅ V17 session ended');
      
    } catch (error) {
      logV17('❌ Failed to end V17 session properly', error);
      // Still reset local state even if API call fails
      set({
        isConnected: false,
        connectionState: 'disconnected',
        agentId: null,
        signedUrl: null,
        conversationToken: null,
      });
    }
  },

  switchSpecialist: async (specialistType, contextSummary) => {
    logV17('🔄 Switching to specialist', { specialistType, hasContext: !!contextSummary });
    
    try {
      const state = get();
      
      // Mark handoff in progress
      get().setIsHandoffInProgress(true);
      
      // End current session
      await get().endSession('specialist_handoff');
      
      // Start new specialist session
      if (state.agentId) {
        await get().startSession(state.agentId, specialistType, contextSummary);
      }
      
      // Update triage session
      get().updateTriageSession({
        currentSpecialist: specialistType,
        contextSummary,
        isHandoffPending: false,
      });
      
      get().setIsHandoffInProgress(false);
      
      logV17('✅ Specialist switch completed', { specialistType });
      
    } catch (error) {
      logV17('❌ Failed to switch specialist', error);
      get().setIsHandoffInProgress(false);
      throw error;
    }
  },

  // Reset store
  resetStore: () => {
    logV17('🔄 Resetting V17 store');
    set({
      isConnected: false,
      connectionState: 'disconnected',
      isPreparing: false,
      connectionType: 'webrtc',
      currentVolume: 0,
      audioLevel: 0,
      isAudioPlaying: false,
      isThinking: false,
      isUserSpeaking: false,
      isMuted: false,
      isAudioOutputMuted: false,
      conversationHistory: [],
      pendingResponses: new Map(),
      conversationId: null,
      triageSession: defaultTriageSession,
      isHandoffInProgress: false,
      resourceLocatorContext: null,
      agentId: null,
      signedUrl: null,
      conversationToken: null,
    });
  },
}));