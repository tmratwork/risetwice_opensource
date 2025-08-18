import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebRTCService, WebRTCConfig } from '../services/webrtc/WebRTCService';
import type { ConversationMessage, TriageSession, ResourceLocatorContext, ConnectionState, WebRTCStoreState } from '../types';
import { API_BASE_URL } from '@env';

interface WebRTCStoreActions {
  // Connection actions
  setConnectionState: (state: ConnectionState) => void;
  setConnected: (connected: boolean) => void;
  setPreparing: (preparing: boolean) => void;
  connect: (config: WebRTCConfig) => Promise<void>;
  disconnect: () => void;
  
  // V16 API Integration actions
  startSession: (params: { userId: string; specialistType: string; conversationId?: string; contextSummary?: string }) => Promise<{ success: boolean; error?: string }>;
  saveMessage: (params: { role: string; content: string; userId: string; specialistType: string; timestamp: number }) => Promise<void>;
  loadGreeting: (params: { specialistType: string; userId: string }) => Promise<void>;
  createConversation: () => Promise<string>;
  setConversationId: (id: string) => void;
  
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
  
  // Handoff management
  storePendingHandoff: (handoffData: any) => void;
  pendingHandoff: any;
  
  // Resource locator actions
  setResourceLocatorContext: (context: ResourceLocatorContext | null) => void;
  
  // Utility actions
  reset: () => void;
}

const initialState: WebRTCStoreState & { pendingHandoff: any; currentConversationId: string | null } = {
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
  pendingHandoff: null,
  currentConversationId: null,
};

// WebRTC service instance
let webrtcService: WebRTCService | null = null;

export const useWebRTCStore = create(
  persist<WebRTCStoreState & WebRTCStoreActions & { pendingHandoff: any; currentConversationId: string | null }>(
    (set, get) => ({
      ...initialState,
      
      // Connection actions
      setConnectionState: (connectionState) => set({ connectionState }),
      setConnected: (isConnected) => set({ isConnected }),
      setPreparing: (isPreparing) => set({ isPreparing }),
      
      connect: async (config: WebRTCConfig) => {
        console.log('[MOBILE] Connecting WebRTC service...');
        
        try {
          if (!webrtcService) {
            webrtcService = new WebRTCService();
          }
          
          // Set up event listeners
          webrtcService.on('connected', () => {
            console.log('[MOBILE] WebRTC connected');
            set({ isConnected: true, connectionState: 'connected' });
          });
          
          webrtcService.on('disconnected', () => {
            console.log('[MOBILE] WebRTC disconnected');
            set({ isConnected: false, connectionState: 'disconnected' });
          });
          
          webrtcService.on('audioData', (audioData) => {
            set({ isAudioPlaying: true });
          });
          
          webrtcService.on('audioComplete', () => {
            set({ isAudioPlaying: false });
          });
          
          webrtcService.on('textDelta', (delta) => {
            // Handle streaming text response
            console.log('[MOBILE] Text delta received:', delta);
          });
          
          webrtcService.on('error', (error) => {
            console.error('[MOBILE] WebRTC error:', error);
            set({ connectionState: 'failed', isConnected: false });
          });
          
          // Connect to the service
          await webrtcService.connect(config);
          
        } catch (error) {
          console.error('[MOBILE] Error connecting WebRTC:', error);
          set({ connectionState: 'failed', isConnected: false });
          throw error;
        }
      },
      
      disconnect: () => {
        console.log('[MOBILE] Disconnecting WebRTC service...');
        
        if (webrtcService) {
          webrtcService.disconnect();
          webrtcService = null;
        }
        
        set({ isConnected: false, connectionState: 'disconnected' });
      },
      
      // V16 API Integration
      startSession: async (params) => {
        console.log('[MOBILE] Starting V16 session:', params);
        
        try {
          console.log('[MOBILE] 🐛 DEBUG: Raw API_BASE_URL from @env:', API_BASE_URL);
          console.log('[MOBILE] 🐛 DEBUG: typeof API_BASE_URL:', typeof API_BASE_URL);
          const apiBaseUrl = API_BASE_URL || 'http://localhost:3000';
          console.log('[MOBILE] Using API base URL:', apiBaseUrl);
          
          const response = await fetch(`${apiBaseUrl}/api/v16/start-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: params.userId,
              specialistType: params.specialistType,
              conversationId: params.conversationId || null,
              contextSummary: params.contextSummary || null,
            }),
          });
          
          if (!response.ok) {
            throw new Error(`Session start failed: ${response.status}`);
          }
          
          const data = await response.json();
          console.log('[MOBILE] Session started successfully:', data);
          
          return { success: true, data };
        } catch (error) {
          console.error('[MOBILE] Error starting session:', error);
          return { success: false, error: (error as Error).message };
        }
      },
      
      saveMessage: async (params) => {
        console.log('[MOBILE] Saving message to V16 API:', params);
        
        try {
          const apiBaseUrl = API_BASE_URL || 'http://localhost:3000';
          const response = await fetch(`${apiBaseUrl}/api/v16/save-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: {
                role: params.role,
                content: params.content,
                timestamp: params.timestamp,
              },
              userId: params.userId,
              conversationId: get().currentConversationId,
              specialistType: params.specialistType,
            }),
          });
          
          if (!response.ok) {
            throw new Error(`Message save failed: ${response.status}`);
          }
          
          console.log('[MOBILE] Message saved successfully');
        } catch (error) {
          console.error('[MOBILE] Error saving message:', error);
          throw error;
        }
      },
      
      loadGreeting: async (params) => {
        console.log('[MOBILE] Loading greeting from V16 API:', params);
        
        try {
          const apiBaseUrl = API_BASE_URL || 'http://localhost:3000';
          // Use GET with query parameters to match API endpoint expectation
          const queryParams = new URLSearchParams({
            type: 'triage',
            userId: params.userId,
          });
          const response = await fetch(`${apiBaseUrl}/api/v16/greeting-prompt?${queryParams}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (!response.ok) {
            throw new Error(`Greeting load failed: ${response.status}`);
          }
          
          const data = await response.json();
          console.log('[MOBILE] Greeting loaded successfully:', data);
          
          // Add greeting message to conversation
          if (data.greeting) {
            let greetingText = '';
            
            // Handle different greeting data structures
            if (typeof data.greeting === 'string') {
              greetingText = data.greeting;
            } else if (data.greeting.content) {
              greetingText = typeof data.greeting.content === 'string' 
                ? data.greeting.content 
                : JSON.stringify(data.greeting.content);
            } else if (typeof data.greeting === 'object') {
              // If greeting is an object but no content field, stringify it
              greetingText = JSON.stringify(data.greeting);
            }
              
            console.log('[MOBILE] Adding greeting message with text:', greetingText);
            
            get().addMessage({
              id: `greeting-${Date.now()}`,
              role: 'assistant',
              text: greetingText,
              content: greetingText,
              timestamp: Date.now().toString(),
              isFinal: true,
            });
          }
        } catch (error) {
          console.error('[MOBILE] Error loading greeting:', error);
          throw error;
        }
      },
      
      createConversation: async () => {
        console.log('[MOBILE] Creating new conversation via V16 API');
        
        try {
          const apiBaseUrl = API_BASE_URL || 'http://localhost:3000';
          const response = await fetch(`${apiBaseUrl}/api/v16/create-conversation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          
          if (!response.ok) {
            throw new Error(`Conversation creation failed: ${response.status}`);
          }
          
          const data = await response.json();
          const conversationId = data.conversationId;
          
          console.log('[MOBILE] Conversation created:', conversationId);
          
          // Store conversation ID
          set({ currentConversationId: conversationId });
          
          return conversationId;
        } catch (error) {
          console.error('[MOBILE] Error creating conversation:', error);
          throw error;
        }
      },
      
      setConversationId: (id) => {
        console.log('[MOBILE] Setting conversation ID:', id);
        set({ currentConversationId: id });
      },
      
      // Audio actions
      setCurrentVolume: (currentVolume) => set({ currentVolume }),
      setAudioLevel: (audioLevel) => set({ audioLevel }),
      setAudioPlaying: (isAudioPlaying) => set({ isAudioPlaying }),
      setThinking: (isThinking) => set({ isThinking }),
      toggleMute: () => {
        const newMuted = !get().isMuted;
        set({ isMuted: newMuted });
        
        if (webrtcService) {
          webrtcService.setMuted(newMuted);
        }
      },
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
      
      // Handoff management
      storePendingHandoff: (handoffData) => {
        console.log('[MOBILE] Storing pending handoff:', handoffData);
        set({ pendingHandoff: handoffData });
      },
      
      // Resource locator actions
      setResourceLocatorContext: (resourceLocatorContext) => set({ resourceLocatorContext }),
      
      // Utility actions
      reset: () => set(initialState),
    }),
    {
      name: 'webrtc-store',
      storage: {
        getItem: async (name) => {
          const value = await AsyncStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: async (name, value) => {
          await AsyncStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: async (name) => {
          await AsyncStorage.removeItem(name);
        },
      },
      // Simplified - persist all state for now
      // partialize: (state) => {
      //   return {
      //     conversation: state.conversation,
      //     triageSession: state.triageSession,
      //     currentConversationId: state.currentConversationId,
      //   };
      // },
    }
  )
);