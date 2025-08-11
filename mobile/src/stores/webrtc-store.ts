import { create } from 'zustand';
import type { ConversationMessage, TriageSession, ResourceLocatorContext, ConnectionState, WebRTCStoreState } from '../types';

interface WebRTCStoreActions {
  // Connection actions
  setConnectionState: (state: ConnectionState) => void;
  setConnected: (connected: boolean) => void;
  setPreparing: (preparing: boolean) => void;
  
  // Audio actions
  setCurrentVolume: (volume: number) => void;
  setAudioLevel: (level: number) => void;
  setAudioPlaying: (playing: boolean) => void;
  setThinking: (thinking: boolean) => void;
  toggleMute: () => void;
  toggleAudioOutput: () => void;
  
  // Conversation actions
  addMessage: (message: ConversationMessage) => void;
  updateMessage: (id: string, updates: Partial<ConversationMessage>) => void;
  clearConversation: () => void;
  
  // Triage session actions
  setTriageSession: (session: TriageSession | null) => void;
  updateTriageSession: (updates: Partial<TriageSession>) => void;
  
  // Resource locator actions
  setResourceLocatorContext: (context: ResourceLocatorContext | null) => void;
  
  // Utility actions
  reset: () => void;
}

const initialState: WebRTCStoreState = {
  isConnected: false,
  connectionState: 'disconnected',
  isPreparing: false,
  currentVolume: 0,
  audioLevel: 0,
  isAudioPlaying: false,
  isThinking: false,
  isMuted: false,
  isAudioOutputMuted: false,
  conversation: [],
  triageSession: null,
  resourceLocatorContext: null,
};

export const useWebRTCStore = create<WebRTCStoreState & WebRTCStoreActions>((set, get) => ({
  ...initialState,
  
  // Connection actions
  setConnectionState: (connectionState) => set({ connectionState }),
  setConnected: (isConnected) => set({ isConnected }),
  setPreparing: (isPreparing) => set({ isPreparing }),
  
  // Audio actions
  setCurrentVolume: (currentVolume) => set({ currentVolume }),
  setAudioLevel: (audioLevel) => set({ audioLevel }),
  setAudioPlaying: (isAudioPlaying) => set({ isAudioPlaying }),
  setThinking: (isThinking) => set({ isThinking }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleAudioOutput: () => set((state) => ({ isAudioOutputMuted: !state.isAudioOutputMuted })),
  
  // Conversation actions
  addMessage: (message) => set((state) => ({
    conversation: [...state.conversation, message]
  })),
  updateMessage: (id, updates) => set((state) => ({
    conversation: state.conversation.map(msg => 
      msg.id === id ? { ...msg, ...updates } : msg
    )
  })),
  clearConversation: () => set({ conversation: [] }),
  
  // Triage session actions
  setTriageSession: (triageSession) => set({ triageSession }),
  updateTriageSession: (updates) => set((state) => ({
    triageSession: state.triageSession ? { ...state.triageSession, ...updates } : null
  })),
  
  // Resource locator actions
  setResourceLocatorContext: (resourceLocatorContext) => set({ resourceLocatorContext }),
  
  // Utility actions
  reset: () => set(initialState),
}));