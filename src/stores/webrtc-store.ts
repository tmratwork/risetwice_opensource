// src/stores/webrtc-store.ts
// Zustand-based WebRTC Store for V15
// Implements industry best practices to eliminate render storms and provide reliable disconnect detection
//
// CRITICAL V15 AUDIO MONITORING ARCHITECTURE:
// ==========================================
// V15 uses WebRTC MediaStreams for real-time audio from OpenAI Realtime API.
// Audio volume monitoring MUST use createMediaStreamSource() NOT createMediaElementSource().
// 
// CORRECT: audioContext.createMediaStreamSource(webrtcStream) - monitors live WebRTC audio
// WRONG:   audioContext.createMediaElementSource(audioElement) - only works with file/URL playback
//
// The silence detection system depends on this to properly detect when AI stops speaking
// during end session flow. Using the wrong audio source will cause premature disconnections.
//
// DO NOT CHANGE THE AUDIO MONITORING SOURCE WITHOUT UNDERSTANDING THIS ARCHITECTURE!

import { create } from 'zustand';
import { optimizedAudioLogger } from '@/hooksV15/audio/optimized-audio-logger';
import { ConnectionManager } from '@/hooksV15/webrtc/connection-manager';

// Helper function for conditional triage handoff logging
const logTriageHandoff = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS === 'true') {
    console.log(`[triage_handoff] ${message}`, ...args);
  }
};

// Helper function for conditional specialist tracking logging
const logSpecialistTracking = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_SPECIALIST_TRACKING_LOGS === 'true') {
    console.log(`[specialist_tracking] ${message}`, ...args);
  }
};
import { ComprehensiveMessageHandler, type MessageHandlerCallbacks } from '@/hooksV15/webrtc/comprehensive-message-handler';
import audioService from '@/hooksV15/audio/audio-service';
import type { ConnectionConfig } from '@/hooksV15/types';
import { APP_VERSION } from '@/version';

console.log('***************************************************');
console.log('[zustand-webrtc] Store module loaded:', APP_VERSION);
console.log('***************************************************');

// Conversation message interface
interface ConversationMessage {
  id: string;
  role: string;
  text: string;
  timestamp: string;
  isFinal: boolean;
  status?: "speaking" | "processing" | "final" | "thinking";
  specialist?: string; // V16 specialist tracking
}

// V16 Triage session state
export interface TriageSession {
  sessionId: string;
  currentSpecialist: string | null;
  conversationId: string | null;
  contextSummary?: string;
  isHandoffPending: boolean;
}

// Resource locator context interface (V16 Zustand pattern)
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

// Connection state type
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

// Store state interface
export interface WebRTCStoreState {
  // Connection state
  isConnected: boolean;
  connectionState: ConnectionState;
  isPreparing: boolean;

  // Enhanced audio visualization state
  currentVolume: number;
  audioLevel: number;
  isAudioPlaying: boolean;
  isThinking: boolean;

  // User microphone input monitoring (V18)
  userAudioLevel: number;
  isUserSpeaking: boolean;
  micMonitoringActive: boolean;

  // Mute state
  isMuted: boolean;
  isAudioOutputMuted: boolean;

  // V18: Manual send mode - when true, don't auto-set "Thinking..." on audio buffer commit
  manualSendMode: boolean;

  // Conversation state
  conversation: ConversationMessage[];
  userMessage: string;
  hasActiveConversation: boolean;
  conversationId: string | null;

  // Smart Send feature
  smartSendEnabled: boolean;
  messageBuffer: string;

  // V16 Triage session state
  triageSession: TriageSession;

  // V16 Resource context state
  resourceContext: ResourceLocatorContextType | null;
  resourceContextAutoStarted: boolean;
  resourceGreeting: string | null;

  // V16 Handoff state
  pendingHandoff: {
    specialistType: string;
    contextSummary: string;
    conversationId: string;
    reason: string;
    urgencyLevel: string;
    sessionId: string;
  } | null;

  // Volume detection session tracking
  activeVolumeDetectionSessions: Set<string>;

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

  // Function definitions for AI
  availableFunctions: {
    book: unknown[];
    mentalHealth: unknown[];
    sleep: unknown[];
    supabase: unknown[]; // V16: Functions loaded from Supabase
  };

  // Store actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (message: string) => boolean;
  // V18: Manual push-to-talk control methods
  commitAudioBuffer: () => boolean;
  createResponse: () => boolean;
  toggleMute: () => boolean;
  toggleAudioOutputMute: () => boolean;
  startMicrophoneMonitoring: (stream: MediaStream) => void;
  addConversationMessage: (message: ConversationMessage) => void;
  saveMessageToSupabase: (message: ConversationMessage) => Promise<void>;
  createConversation: () => Promise<string | null>;
  clearAnonymousSession: () => void;
  updateUserMessage: (message: string) => void;
  clearUserMessage: () => void;
  setConversationId: (id: string | null) => void;

  // Smart Send actions
  setSmartSendEnabled: (enabled: boolean) => void;
  appendToMessageBuffer: (text: string) => void;
  clearMessageBuffer: () => void;

  // V16 Triage session actions
  setTriageSession: (session: TriageSession) => void;
  updateTriageSession: (updates: Partial<TriageSession>) => void;

  // V16 Resource context actions
  setResourceContext: (context: ResourceLocatorContextType) => void;
  clearResourceContext: () => void;
  setResourceContextAutoStarted: (started: boolean) => void;
  setResourceGreeting: (greeting: string | null) => void;

  // V16 Handoff actions
  storePendingHandoff: (handoffData: {
    specialistType: string;
    contextSummary: string;
    conversationId: string;
    reason: string;
    urgencyLevel: string;
    sessionId: string;
  }) => void;
  clearPendingHandoff: () => void;

  // Function registration
  registerFunctions: (functions: { book?: unknown[]; mentalHealth?: unknown[]; sleep?: unknown[]; supabase?: unknown[] }) => void;
  clearFunctions: () => void;

  // AI Configuration replacement (for seamless handoffs)
  replaceAIConfiguration: (newConfig: { instructions: string; tools: unknown[] }) => Promise<boolean>;

  // Connection lifecycle
  preInitialize: (config: ConnectionConfig) => Promise<void>;
  initialize: (config?: ConnectionConfig) => Promise<void>;
  handleConnectionChange: (state: ConnectionState) => void;
  handleDisconnectWithReset: () => void;
  setPreparing: (preparing: boolean) => void;

  // Subscription management
  onTranscript: (callback: (message: { id: string; data: string; metadata?: Record<string, unknown> }) => void) => () => void;
  onError: (callback: (error: Error) => void) => () => void;

  // Diagnostics
  getDiagnostics: () => Record<string, unknown>;
  getVisualizationData: () => Record<string, unknown>;
}

// Store-based silence detection using existing volume monitoring
interface SilenceDetector {
  isActive: boolean;
  silentTime: number;
  startTime: number;
  timeoutId: number | null;
  failsafeTimeoutId: number | null;
  onComplete: (() => void) | null;
}

// Global silence detector state
const silenceDetector: SilenceDetector = {
  isActive: false,
  silentTime: 0,
  startTime: 0,
  timeoutId: null,
  failsafeTimeoutId: null,
  onComplete: null // Keep for failsafe timeout compatibility
};

// Store-based silence detection function that accepts get as parameter
// CRITICAL V15 ARCHITECTURE NOTE: This function monitors WebRTC audio volume through
// the Web Audio API using createMediaStreamSource() to track live WebRTC MediaStreams.
// DO NOT change this to monitor HTML audio elements - V15 uses real-time WebRTC streams.
const startSilenceDetection = (onComplete: () => void, getState: () => WebRTCStoreState) => {
  console.log(`[END-SESSION-DEBUG] 🎯 Starting silence detection (waiting: ${getState().waitingForEndSession})`);

  // CRITICAL: Prevent duplicate startSilenceDetection calls from INITIAL and RECONNECT handlers
  if (silenceDetector.isActive) {
    console.log('[END-SESSION-DEBUG] 🚫 DUPLICATE CALL BLOCKED - silence detection already active');
    console.log('[END-SESSION-DEBUG] 🔍 This prevents the failsafe timeout bug from duplicate onAudioDone handlers');
    return; // Do NOT start another silence detection
  }

  silenceDetector.isActive = true;
  silenceDetector.silentTime = 0;
  silenceDetector.startTime = Date.now();
  // Don't store callback - keep it in closure to prevent stale reference

  const checkInterval = 100; // Check every 100ms
  const silenceThreshold = 0.01; // Volume threshold for silence
  const silenceDuration = 2000; // 2 seconds of silence required

  console.log(`[END-SESSION-DEBUG] ⚙️ Config: ${silenceDuration}ms silence required`);

  const checkSilence = () => {
    if (!silenceDetector.isActive) {
      console.log('[END-SESSION-DEBUG] 🚫 checkSilence called but detector not active - returning');
      return;
    }

    // CRITICAL V15 AUDIO MONITORING: This function reads audio volume from the WebRTC store
    // The volume data comes from createMediaStreamSource() monitoring live WebRTC audio streams
    // NOT from HTML audio elements. This is essential for proper V15 end session detection.
    const state = getState(); // Use the passed getState function
    const currentVolume = state.currentVolume;
    const isAudioPlaying = state.isAudioPlaying;
    const connectionState = state.connectionState;
    const isConnected = state.isConnected;
    const waitingForEndSession = state.waitingForEndSession;

    console.log(`[END-SESSION-DEBUG] 🔍 Silence check: volume=${currentVolume.toFixed(4)}, playing=${isAudioPlaying}, connected=${isConnected}, waiting=${waitingForEndSession}, state=${connectionState}`);

    // CRITICAL: Check if connection was lost - this could cause premature reset
    if (!isConnected || connectionState !== 'connected') {
      console.log(`[END-SESSION-DEBUG] 🚨 CONNECTION LOST during silence detection! isConnected=${isConnected}, state=${connectionState}`);
      console.log('[END-SESSION-DEBUG] 🚨 This could be causing premature session reset!');
      stopSilenceDetection();
      return;
    }

    // CRITICAL: Check if we're still supposed to be waiting for end session
    if (!waitingForEndSession) {
      console.log('[END-SESSION-DEBUG] 🚨 No longer waiting for end session - something reset the state!');
      console.log('[END-SESSION-DEBUG] 🚨 This indicates premature state reset occurred!');
      stopSilenceDetection();
      return;
    }

    // Check if audio is silent (low volume and not playing)
    const isSilent = currentVolume < silenceThreshold && !isAudioPlaying;

    if (isSilent) {
      silenceDetector.silentTime += checkInterval;
      // Enhanced logging every 250ms during end session
      if (silenceDetector.silentTime % 250 === 0 || silenceDetector.silentTime >= silenceDuration - 100) {
        console.log(`[END-SESSION-DEBUG] 🔇 Silent: ${silenceDetector.silentTime}ms / ${silenceDuration}ms (volume=${currentVolume.toFixed(4)}, playing=${isAudioPlaying})`);
      }

      if (silenceDetector.silentTime >= silenceDuration) {
        console.log('[END-SESSION-DEBUG] ✅ 2 seconds silence reached - executing callback');
        console.log(`[END-SESSION-DEBUG] 🔍 Final state check before callback: connected=${isConnected}, waiting=${waitingForEndSession}, conversation=${state.conversation.length} messages`);
        stopSilenceDetection();
        try {
          onComplete(); // Use closure callback instead of stored reference
        } catch (error) {
          console.log('[END-SESSION-DEBUG] ❌ Callback error:', error);
        }
        return;
      }
    } else {
      // Reset silence timer when audio is detected
      if (silenceDetector.silentTime > 0) {
        console.log(`[END-SESSION-DEBUG] 🔊 Audio detected - reset timer (was ${silenceDetector.silentTime}ms, volume=${currentVolume.toFixed(4)}, playing=${isAudioPlaying})`);
        silenceDetector.silentTime = 0;
      }
    }

    // Schedule next check
    silenceDetector.timeoutId = window.setTimeout(checkSilence, checkInterval);
  };

  // Start checking
  checkSilence();

  // Failsafe timeout (8 seconds maximum)
  silenceDetector.failsafeTimeoutId = window.setTimeout(() => {
    if (silenceDetector.isActive) {
      console.log('[END-SESSION-DEBUG] ⏰ Failsafe timeout - executing callback');
      stopSilenceDetection();
      try {
        onComplete(); // Use closure callback for failsafe too
      } catch (error) {
        console.log('[END-SESSION-DEBUG] ❌ Failsafe callback error:', error);
      }
    }
  }, 8000);

  console.log('[SILENCE-DETECTOR] ✅ Store-based silence detection started');
};

const stopSilenceDetection = () => {
  console.log('[SILENCE-DETECTOR] 🛑 Stopping silence detection');

  if (silenceDetector.timeoutId) {
    clearTimeout(silenceDetector.timeoutId);
    silenceDetector.timeoutId = null;
  }

  if (silenceDetector.failsafeTimeoutId) {
    clearTimeout(silenceDetector.failsafeTimeoutId);
    silenceDetector.failsafeTimeoutId = null;
  }

  silenceDetector.isActive = false;
  silenceDetector.silentTime = 0;
  silenceDetector.onComplete = null;

  console.log('[SILENCE-DETECTOR] ✅ Silence detection stopped');
};

// Create the Zustand store
export const useWebRTCStore = create<WebRTCStoreState>((set, get) => {
  console.log('[zustand-webrtc] Creating store instance');

  // Function registry cache - use robust registry manager with fallback validation
  const getFunctionRegistry = (): Record<string, (args: unknown) => Promise<unknown>> => {
    const registryManager = FunctionRegistryManager.getInstance();

    if (!registryManager.isInitialized()) {
      console.warn('[FUNCTION-REGISTRY] Registry not yet initialized, checking window fallback');
      // Fallback to window object if registry manager not ready
      return (window as unknown as { webrtcFunctionRegistry?: Record<string, (args: unknown) => Promise<unknown>> }).webrtcFunctionRegistry || {};
    }

    const registry = registryManager.getRegistry();
    console.log('[FUNCTION-REGISTRY] Retrieved registry with', Object.keys(registry).length, 'functions');
    return registry;
  };


  return {
    // Initial state
    isConnected: false,
    connectionState: 'disconnected' as ConnectionState,
    isPreparing: false,

    // Enhanced audio visualization state
    currentVolume: 0,
    audioLevel: 0,
    isAudioPlaying: false,
    isThinking: false,

    // User microphone input monitoring (V18)
    userAudioLevel: 0,
    isUserSpeaking: false,
    micMonitoringActive: false,

    // Mute state - V15: Start in muted state by default
    isMuted: true,
    isAudioOutputMuted: false,

    // V18: Manual send mode - when true, don't auto-set "Thinking..." on audio buffer commit
    manualSendMode: false,

    conversation: [],
    userMessage: '',
    hasActiveConversation: false,
    conversationId: null,

    // Smart Send initial state (default: disabled)
    smartSendEnabled: false,
    messageBuffer: '',

    // V16 Triage session initial state
    triageSession: {
      sessionId: '',
      // SPECIALIST NAME CHANGE: Changed from 'triage' to 'R2'
      // To revert: change 'R2' back to 'triage'
      currentSpecialist: 'R2', // Original: 'triage'
      conversationId: null,
      isHandoffPending: false
    },

    // V16 Resource context initial state
    resourceContext: null,
    resourceContextAutoStarted: false,
    resourceGreeting: null,

    // V16 Handoff initial state
    pendingHandoff: null,
    activeVolumeDetectionSessions: new Set<string>(),
    connectionManager: null,
    messageHandler: null,
    transcriptCallback: null,
    errorCallback: null,
    expectingEndSessionGoodbye: false,
    waitingForEndSession: false,
    endSessionCallId: null,
    volumeMonitoringActive: false,
    fallbackTimeoutId: null,
    storedConnectionConfig: null,

    // Function definitions for AI
    availableFunctions: {
      book: [],
      mentalHealth: [],
      sleep: [],
      supabase: [] // V16: Functions loaded from Supabase
    },

    // Pre-initialize services (called on page load)
    preInitialize: async (config: ConnectionConfig) => {
      // Add comprehensive triage handoff logging
      const logTriageHandoff = (message: string, ...args: unknown[]) => {
        if (process.env.NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS === 'true') {
          console.log(`[triage_handoff] ${message}`, ...args);
        }
      };

      console.log('[V15-OPTIMIZATION] 🚀 Pre-initializing services on page load');
      console.log('[zustand-webrtc] 🔧 Pre-initializing WebRTC with config:', config);

      logTriageHandoff('WebRTC Store: preInitialize called', {
        hasInstructions: !!config.instructions,
        instructionsLength: config.instructions?.length || 0,
        instructionsPreview: config.instructions?.substring(0, 200) || 'EMPTY',
        source: 'webrtc-store-preInitialize'
      });

      // Log FULL INSTRUCTIONS received by WebRTC Store
      logTriageHandoff('🔍 FULL INSTRUCTIONS RECEIVED BY WEBRTC STORE:', {
        fullInstructions: config.instructions || 'EMPTY',
        source: 'webrtc-store-full-instructions'
      });

      // Log greeting instructions in WebRTC store
      if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_GREETING_LOGS === 'true') {
        console.log('[resource_greeting] WebRTC store: preInitialize received config', {
          greetingInstructions: config.greetingInstructions || null,
          hasGreetingInstructions: !!config.greetingInstructions,
          greetingInstructionsLength: config.greetingInstructions?.length || 0,
          greetingPreview: config.greetingInstructions?.substring(0, 200) + '...' || 'null',
          configKeys: Object.keys(config).join(', ')
        });
      }

      console.log('[systemInstructions] WEBRTC STORE: preInitialize received config:', {
        hasInstructions: !!config.instructions,
        instructionsLength: config.instructions?.length || 0,
        instructionsPreview: config.instructions?.substring(0, 100) || 'EMPTY',
        hasConversationHistory: !!config.conversationHistory,
        conversationHistoryLength: config.conversationHistory?.length || 0
      });

      optimizedAudioLogger.info('webrtc', 'zustand_store_pre_initializing', {
        config,
        version: 'v15-zustand-optimized'
      });

      // V15 GREENFIELD FIX: Get function definitions from store
      const currentState = get();
      const bookFunctionDefinitions = currentState.availableFunctions.book;
      const mentalHealthFunctionDefinitions = currentState.availableFunctions.mentalHealth;
      const sleepFunctionDefinitions = currentState.availableFunctions.sleep;

      console.log('[AI-INTERACTION] Book function definitions from store:', (bookFunctionDefinitions as { name: string }[]).map(f => f.name));
      console.log('[AI-INTERACTION] Mental health function definitions from store:', (mentalHealthFunctionDefinitions as { name: string }[]).map(f => f.name));
      console.log('[AI-INTERACTION] Sleep function definitions from store:', (sleepFunctionDefinitions as { name: string }[]).map(f => f.name));

      // V15 GREENFIELD FIX: Use memory-enhanced instructions from config instead of fetching separately
      const finalInstructions = config.instructions || '';
      const aiInstructionsSource = 'memory-enhanced-from-page';

      console.log('[V15-MEMORY] Using memory-enhanced AI instructions from page component');
      console.log('[V15-MEMORY] Instructions length:', finalInstructions.length, 'characters');
      console.log('[V15-MEMORY] Instructions source:', aiInstructionsSource);

      try {
        const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') : null;
        const bookId = typeof localStorage !== 'undefined' ? localStorage.getItem('selectedBookId') : null;

        // V15 GREENFIELD FIX: Use the memory-enhanced instructions already prepared by the page component
        // No need to fetch - the instructions come from the config parameter with user profile memory
        console.log('[V15-MEMORY] Using memory-enhanced AI instructions from page component, not fetching separately');

        // Check if this is a sleep book for logging consistency
        if (bookId) {
          const sleepBooks = ['325f8e1a-c9f9-4fbd-a6e4-5b04fb3c9a0a', '486fbb7e-19ec-474e-8296-60ff1d82580d'];
          if (sleepBooks.includes(bookId)) {
            console.log(`[sleep-book] 🏪 WebRTC store detected sleep book: ${bookId}`);
            console.log(`[sleep-book] 🎯 Using memory-enhanced instructions for sleep book`);
          }
        }

        // ===== COMPREHENSIVE AI INSTRUCTIONS LOGGING =====
        console.log(`[AI_instructions] ===== MEMORY-ENHANCED AI INSTRUCTIONS FROM PAGE =====`);
        console.log(`[AI_instructions] Source: ${aiInstructionsSource}`);
        console.log(`[AI_instructions] User ID: ${userId || 'anonymous'}`);
        console.log(`[AI_instructions] Instructions Character Count: ${finalInstructions.length}`);
        console.log(`[AI_instructions] AI INSTRUCTIONS sent to OpenAI Realtime API (first 200 chars):`);
        console.log(`[AI_instructions]`, finalInstructions.substring(0, 200) + '...');
        console.log(`[AI_instructions] ===== END OF MEMORY-ENHANCED AI INSTRUCTIONS =====`);

        // Functions handled same as instructions - passed through config.tools, not validated from store
        console.log(`[triage] Using functions from config.tools (same pattern as instructions)`);
        const toolsToUse = config.tools || [];

        console.log(`[AI-INTERACTION] Functions being sent to AI: ${toolsToUse.map((f: { name: string }) => f.name).join(', ')}`);
        console.log(`[AI-INTERACTION] Function count: ${toolsToUse.length}`);

        // Verification for functions (same as instructions verification)
        const hasTriageHandoff = toolsToUse.some((f: { name: string }) => f.name === 'trigger_specialist_handoff');
        console.log(`[triage] ✅ TRIAGE HANDOFF VERIFICATION: trigger_specialist_handoff included: ${hasTriageHandoff}`);

        console.log('[FUNCTION-INIT] CRITICAL DEBUG - Tools being passed to AI:', JSON.stringify(toolsToUse, null, 2));

        // ===== COMPREHENSIVE FUNCTION DEFINITIONS LOGGING =====
        console.log(`[triage][AI_instructions] ===== FUNCTION DEFINITIONS SELECTED FOR AI =====`);
        console.log(`[triage][AI_instructions] Mode: V16 Supabase Functions`);
        console.log(`[triage][AI_instructions] Function Count: ${toolsToUse.length}`);
        console.log(`[triage][AI_instructions] Function Names: ${toolsToUse.map(f => f.name).join(', ')}`);
        console.log(`[triage][AI_instructions] COMPLETE FUNCTION DEFINITIONS:`);
        toolsToUse.forEach((tool, index) => {
          console.log(`[triage][AI_instructions] === FUNCTION ${index + 1}: ${tool.name} ===`);
          console.log(`[triage][AI_instructions]`, JSON.stringify(tool, null, 2));
          console.log(`[triage][AI_instructions] === END FUNCTION ${index + 1} ===`);
        });
        console.log(`[triage][AI_instructions] ===== END OF FUNCTION DEFINITIONS =====`);

        const connectionConfig: ConnectionConfig = {
          ...config,
          instructions: finalInstructions, // V15 FIX: Use Supabase instructions
          tools: toolsToUse, // Functions passed through config same as instructions
          tool_choice: 'auto' as const
        };

        // ===== COMPREHENSIVE CONNECTION CONFIG LOGGING =====
        console.log(`[triage][AI_instructions] ===== FINAL CONNECTION CONFIG FOR AI =====`);
        console.log(`[triage][AI_instructions] Voice: ${connectionConfig.voice || 'default'}`);
        console.log(`[triage][AI_instructions] Tool Choice: ${connectionConfig.tool_choice}`);
        console.log(`[triage][AI_instructions] Timeout: ${connectionConfig.timeout || 'default'}`);
        console.log(`[triage][AI_instructions] Enable Diagnostics: ${connectionConfig.enableDiagnostics || false}`);
        console.log(`[triage][AI_instructions] Retry Attempts: ${connectionConfig.retryAttempts || 'default'}`);
        if (connectionConfig.greetingInstructions) {
          console.log(`[triage][AI_instructions] Greeting Instructions Character Count: ${connectionConfig.greetingInstructions.length}`);
          console.log(`[triage][AI_instructions] GREETING INSTRUCTIONS (first 200 chars):`);
          console.log(`[triage][AI_instructions]`, connectionConfig.greetingInstructions.substring(0, 200) + '...');
        } else {
          console.log(`[triage][AI_instructions] NO GREETING INSTRUCTIONS IN CONFIG`);
        }
        console.log(`[triage][AI_instructions] Instructions Character Count: ${connectionConfig.instructions?.length || 0}`);
        console.log(`[triage][AI_instructions] Function Count: ${(connectionConfig.tools as Array<unknown>)?.length || 0}`);
        console.log(`[triage][AI_instructions] COMPLETE CONNECTION CONFIG JSON:`);
        console.log(`[triage][AI_instructions]`, JSON.stringify(connectionConfig, null, 2));
        console.log(`[triage][AI_instructions] ===== END OF CONNECTION CONFIG =====`);

        // Determine AI type from instructions
        const aiType = connectionConfig.instructions?.includes('You are a Triage AI') ? 'TRIAGE' :
          connectionConfig.instructions?.includes('Crisis Intervention Specialist') ? 'CRISIS' :
            connectionConfig.instructions?.includes('Anxiety Specialist') ? 'ANXIETY' :
              connectionConfig.instructions?.includes('Depression Specialist') ? 'DEPRESSION' :
                connectionConfig.instructions?.includes('Trauma Specialist') ? 'TRAUMA' :
                  connectionConfig.instructions?.includes('Substance Use Specialist') ? 'SUBSTANCE' :
                    connectionConfig.instructions?.includes('Practical Support Specialist') ? 'PRACTICAL' :
                      connectionConfig.instructions?.includes('CBT Specialist') ? 'CBT' :
                        connectionConfig.instructions?.includes('DBT Specialist') ? 'DBT' : 'UNKNOWN';

        // Enhanced AI instructions logging for triage handoff debugging
        console.log(`[triage] ===== AI CONFIGURATION PREPARED =====`);
        console.log(`[triage] AI Type: ${aiType}`);
        console.log(`[triage] Instructions length: ${connectionConfig.instructions?.length || 0} characters`);
        console.log(`[triage] Functions count: ${(connectionConfig.tools as Array<unknown>)?.length || 0}`);
        console.log(`[triage] AI instructions include triage handoff capability: ${connectionConfig.instructions?.includes('trigger_specialist_handoff') || false}`);
        console.log(`[triage] Functions include trigger_specialist_handoff: ${(connectionConfig.tools as Array<{ name: string }>)?.some(tool => tool.name === 'trigger_specialist_handoff') || false}`);
        console.log(`[triage] Function names being sent to AI: ${(connectionConfig.tools as Array<{ name: string }>)?.map(tool => tool.name).join(', ') || 'none'}`);

        // Log first 500 characters of instructions for debugging
        if (connectionConfig.instructions) {
          console.log(`[triage] AI instructions preview (first 500 chars):`, connectionConfig.instructions.substring(0, 500) + (connectionConfig.instructions.length > 500 ? '...' : ''));
        }

        // Log each function being sent to AI
        if (connectionConfig.tools && Array.isArray(connectionConfig.tools)) {
          console.log(`[triage] ===== FUNCTIONS BEING SENT TO AI =====`);
          (connectionConfig.tools as Array<{ name: string; description?: string }>).forEach((tool, index) => {
            console.log(`[triage] Function ${index + 1}: ${tool.name}${tool.description ? ` - ${tool.description.substring(0, 100)}${tool.description.length > 100 ? '...' : ''}` : ''}`);
          });
        }

        // Check if we're updating existing stored config
        const currentState = get();
        const isUpdate = !!currentState.storedConnectionConfig;

        // Store configuration for later use (don't create connection yet)
        set({
          storedConnectionConfig: connectionConfig
        });

        // If we're updating and there's an existing connection manager, 
        // update its config directly so it uses the new greeting instructions
        if (isUpdate && currentState.connectionManager) {
          if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_GREETING_LOGS === 'true') {
            console.log('[resource_greeting] WebRTC store: updating existing connection manager config via updateConfig method');
          }

          // Update the connection manager's config using the public method
          currentState.connectionManager.updateConfig(connectionConfig);
        }

        logTriageHandoff('WebRTC Store: Configuration stored', {
          hasStoredConfig: true,
          storedInstructionsLength: connectionConfig.instructions?.length || 0,
          storedInstructionsPreview: connectionConfig.instructions?.substring(0, 200) || 'EMPTY',
          source: 'webrtc-store-config-stored',
          isUpdate: isUpdate
        });

        // Log FULL INSTRUCTIONS that will be sent to OpenAI
        logTriageHandoff('🔍 FULL INSTRUCTIONS BEING SENT TO OPENAI:', {
          fullInstructions: connectionConfig.instructions || 'EMPTY',
          source: 'webrtc-store-openai-instructions'
        });

        // Log greeting instructions when config is stored
        if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_GREETING_LOGS === 'true') {
          console.log(`[resource_greeting] WebRTC store: config ${isUpdate ? 'updated' : 'stored initially'}`, {
            greetingInstructions: connectionConfig.greetingInstructions || null,
            hasGreetingInstructions: !!connectionConfig.greetingInstructions,
            greetingInstructionsLength: connectionConfig.greetingInstructions?.length || 0,
            greetingPreview: connectionConfig.greetingInstructions?.substring(0, 200) + '...' || 'null',
            isUpdate: isUpdate,
            operation: isUpdate ? 'CONFIG_UPDATE' : 'CONFIG_INITIAL_STORE'
          });
        }

      } catch (error) {
        console.error('[zustand-webrtc] ❌ CRITICAL ERROR: Cannot initialize without custom user or global AI instructions');
        console.error('[zustand-webrtc] ❌ Error details:', error);

        // V15 GREENFIELD: FAIL LOUDLY - no fallbacks allowed
        const errorMessage = error instanceof Error ? error.message : String(error);
        optimizedAudioLogger.error('webrtc', 'ai_instructions_load_failed', error as Error, {
          userId: typeof localStorage !== 'undefined' ? localStorage.getItem('userId') : null,
          errorType: 'no_fallback_policy',
          requiresAction: 'add_global_instructions_in_admin'
        });

        throw new Error(`V15 INITIALIZATION FAILED: ${errorMessage}. Please add global AI instructions in the admin interface at /chatbotV11/admin`);
      }

      // V18: Set initial mute state based on config
      if (config.startUnmuted === true) {
        console.log('[V18-MANUAL-VAD] Setting store isMuted to FALSE for manual mode');
        set({ isMuted: false });
      }

      console.log('[V15-OPTIMIZATION] ✅ Pre-initialization complete - config stored');
      optimizedAudioLogger.info('webrtc', 'zustand_store_pre_initialized', {
        version: 'v15-zustand-optimized',
        configStored: true,
        startUnmuted: config.startUnmuted || false
      });
    },

    // Initialize WebRTC connection manager (called on "Let's Talk" click)
    initialize: async (config: ConnectionConfig = {}) => {
      console.log('[V15-OPTIMIZATION] 🚀 Fast initialize using pre-computed config');
      console.log('[zustand-webrtc] 🔧 Fast initialization using pre-computed config');

      optimizedAudioLogger.info('webrtc', 'zustand_store_fast_initializing', {
        config,
        version: 'v15-zustand-optimized'
      });

      // Use stored config - should already be available from preInitialize
      const currentState = get();
      const finalConfig = currentState.storedConnectionConfig;

      if (!finalConfig) {
        console.error('[V15-OPTIMIZATION] ❌ No stored config found - preInitialize should have been called');
        throw new Error('No stored configuration found. Please ensure preInitialize was called on page load.');
      }

      // Log greeting instructions when config is retrieved for initialization
      if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_GREETING_LOGS === 'true') {
        console.log('[resource_greeting] WebRTC store: config retrieved for initialization', {
          greetingInstructions: finalConfig.greetingInstructions || null,
          hasGreetingInstructions: !!finalConfig.greetingInstructions,
          greetingInstructionsLength: finalConfig.greetingInstructions?.length || 0,
          greetingPreview: finalConfig.greetingInstructions?.substring(0, 200) + '...' || 'null',
          retrievedFromStorage: true
        });
      }

      console.log('[V15-OPTIMIZATION] ✅ Using pre-computed config with', (finalConfig.tools as Array<unknown>).length, 'tools');

      // ===== COMPREHENSIVE FAST INITIALIZE LOGGING =====
      console.log('[AI_instructions] ===== FAST INITIALIZE USING PRE-COMPUTED CONFIG =====');
      console.log('[AI_instructions] This is when "Let\'s Connect" is clicked and we use stored configuration');
      console.log('[AI_instructions] Stored Config Available: YES');
      console.log('[AI_instructions] Instructions Character Count:', finalConfig.instructions?.length || 0);
      console.log('[AI_instructions] Function Count:', (finalConfig.tools as Array<unknown>)?.length || 0);
      console.log('[AI_instructions] Voice:', finalConfig.voice || 'default');
      console.log('[AI_instructions] Tool Choice:', finalConfig.tool_choice);
      console.log('[AI_instructions] STORED CONFIG WILL BE SENT TO OPENAI VIA SESSION API');
      console.log('[AI_instructions] ===== END OF FAST INITIALIZE =====');

      // Create connection manager with pre-computed config (fast!)
      const connectionManager = new ConnectionManager(finalConfig);

      // Subscribe to connection state changes - this is the key to reliable disconnect detection
      const handleConnectionStateChange = (state: ConnectionState) => {
        console.log(`[END-SESSION-DEBUG] 🔍 Native WebRTC state change: ${state}`);

        const currentState = get();
        const wasConnected = currentState.isConnected;
        const isNowConnected = state === 'connected';

        console.log(`[END-SESSION-DEBUG] 🔍 WebRTC state change details: was=${currentState.connectionState}, now=${state}, wasConnected=${wasConnected}, isNowConnected=${isNowConnected}`);
        console.log(`[END-SESSION-DEBUG] 🔍 Current end session state: waiting=${currentState.waitingForEndSession}, expecting=${currentState.expectingEndSessionGoodbye}`);

        // Detect disconnect with conversation reset
        if (wasConnected && !isNowConnected && currentState.hasActiveConversation) {
          console.log('[END-SESSION-DEBUG] 🚨 DISCONNECT DETECTED in WebRTC state handler - This could be premature!');
          console.log(`[END-SESSION-DEBUG] 🚨 Conversation length before reset: ${currentState.conversation.length}`);
          console.log(`[END-SESSION-DEBUG] 🚨 Current end session flags: waiting=${currentState.waitingForEndSession}, expecting=${currentState.expectingEndSessionGoodbye}`);

          if (currentState.waitingForEndSession) {
            console.log('[END-SESSION-DEBUG] 🚨 🚨 CRITICAL: Disconnect detected while waiting for end session - this is premature!');
            console.log('[END-SESSION-DEBUG] 🚨 🚨 This suggests WebRTC connection dropped before silence detection completed!');
          }

          optimizedAudioLogger.info('webrtc', 'disconnect_detected_conversation_reset', {
            previousState: currentState.connectionState,
            newState: state,
            conversationLength: currentState.conversation.length,
            hadUserMessage: currentState.userMessage.length > 0,
            conversationCleared: true,
            waitingForEndSession: currentState.waitingForEndSession,
            expectingGoodbye: currentState.expectingEndSessionGoodbye,
            isPremature: currentState.waitingForEndSession
          });

          // Stop any active silence detection
          if (silenceDetector.isActive) {
            console.log('[END-SESSION-DEBUG] 🛑 Stopping silence detection due to WebRTC disconnect');
            stopSilenceDetection();
          }

          // Reset conversation immediately using Zustand
          set({
            conversation: [],
            hasActiveConversation: false,
            userMessage: '',
            conversationId: null,
            expectingEndSessionGoodbye: false,
            waitingForEndSession: false,
            endSessionCallId: null
          });

          console.log('[END-SESSION-DEBUG] ✅ WebRTC disconnect reset complete - conversation cleared');
        }

        // Update connection state
        const shouldSetThinking = state === 'connected';
        const currentIsThinking = get().isThinking;
        console.log('[function] Connection state change:', {
          connectionState: state,
          shouldSetThinking,
          currentIsThinking
        });

        set({
          connectionState: state,
          isConnected: isNowConnected,
          // Set thinking state when connection is established (waiting for AI greeting)
          isThinking: shouldSetThinking ? true : currentIsThinking
        });

        if (shouldSetThinking) {
          console.log('[function] Setting isThinking: true (connection established)');
        }

        console.log(`[END-SESSION-DEBUG] 🔍 WebRTC state change complete: final state=${state}, connected=${isNowConnected}`);
      };

      connectionManager.onStateChange(handleConnectionStateChange);

      // Create comprehensive message handler with inline callbacks
      const messageCallbacks: MessageHandlerCallbacks = {
        // V11-style visual feedback callbacks
        onSpeechStarted: () => {
          console.log('[V15-VISUAL-FEEDBACK] Creating listening user bubble');
          const listeningUserMessage: ConversationMessage = {
            id: `user-listening-${Date.now()}`,
            role: "user",
            text: "Listening...",
            timestamp: new Date().toISOString(),
            isFinal: false,
            status: "speaking"
          };

          set(state => ({
            conversation: [...state.conversation, listeningUserMessage],
            hasActiveConversation: true
          }));
        },

        onSpeechStopped: () => {
          console.log('[V15-VISUAL-FEEDBACK] Speech stopped, AI is thinking');
          // Set thinking state when user stops speaking
          set(state => {
            console.log('[function] Setting isThinking: true (onSpeechStopped)');
            const newState = { ...state, isThinking: true };
            console.log('[function] New state:', { isThinking: newState.isThinking });
            return newState;
          });
        },

        onAudioBufferCommitted: () => {
          // V18: Skip "Thinking..." update if in manual send mode
          const currentState = get();
          if (currentState.manualSendMode) {
            console.log('[V18] onAudioBufferCommitted: Skipping "Thinking..." update (manual send mode)');
            return;
          }

          console.log('[V15-VISUAL-FEEDBACK] Setting "Thinking..." state');

          // Find the most recent user message and update it to "Thinking..."
          set(state => {
            const updatedConversation = [...state.conversation];
            const lastUserMessageIndex = updatedConversation.map(msg => msg.role).lastIndexOf("user");

            if (lastUserMessageIndex >= 0) {
              updatedConversation[lastUserMessageIndex] = {
                ...updatedConversation[lastUserMessageIndex],
                text: "Thinking...",
                status: "thinking"
              };
            }

            const newState = {
              conversation: updatedConversation,
              isThinking: true  // Set thinking state for orb visualization
            };
            console.log('[function] Setting isThinking: true (onAudioBufferCommitted)');
            console.log('[function] New state:', { isThinking: newState.isThinking });
            return newState;
          });
        },

        onFunctionCall: async (msg: Record<string, unknown>) => {
          const functionCallTime = performance.now();
          const functionSessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);

          const functionName = msg.name as string;
          const callId = msg.call_id as string;
          const argumentsStr = msg.arguments as string;

          console.log(`[HANDOFF-DEBUG] ===== FUNCTION CALL HANDLER TRIGGERED =====`);
          console.log(`[HANDOFF-DEBUG] Function Session ID: ${functionSessionId}`);
          console.log(`[HANDOFF-DEBUG] Function call time: ${functionCallTime.toFixed(3)}ms since page load`);
          console.log(`[HANDOFF-DEBUG] AI called function: ${functionName} with callId: ${callId}`);
          console.log(`[HANDOFF-DEBUG] Function arguments: ${argumentsStr}`);

          // USER RESPONSE IMPACT ANALYSIS: Check timing between user input and handoff
          if (functionName === 'trigger_specialist_handoff' && typeof window !== 'undefined' && (window as unknown as { __handoffDebugData?: { lastUserInput: { transcript: string; timestamp: string; hasHandoffTriggers: boolean; triggeredWords: string[] } } }).__handoffDebugData?.lastUserInput) {
            const lastUserInput = (window as unknown as { __handoffDebugData: { lastUserInput: { transcript: string; timestamp: string; hasHandoffTriggers: boolean; triggeredWords: string[] } } }).__handoffDebugData.lastUserInput;
            const timeBetweenInputAndHandoff = new Date().getTime() - new Date(lastUserInput.timestamp).getTime();

            console.log(`[HANDOFF-DEBUG] ===== USER RESPONSE IMPACT ANALYSIS =====`);
            console.log(`[HANDOFF-DEBUG] Function Session ID: ${functionSessionId}`);
            console.log(`[HANDOFF-DEBUG] 🚨 HANDOFF FUNCTION TRIGGERED AFTER USER INPUT!`);
            console.log(`[HANDOFF-DEBUG] Last user input: "${lastUserInput.transcript}"`);
            console.log(`[HANDOFF-DEBUG] User input timestamp: ${lastUserInput.timestamp}`);
            console.log(`[HANDOFF-DEBUG] Time between user input and handoff: ${timeBetweenInputAndHandoff}ms`);
            console.log(`[HANDOFF-DEBUG] User input had handoff triggers: ${lastUserInput.hasHandoffTriggers}`);
            console.log(`[HANDOFF-DEBUG] Triggered words in user input: ${lastUserInput.triggeredWords}`);
            console.log(`[HANDOFF-DEBUG] This confirms user input directly led to handoff function call`);

            // Store correlation data
            (window as unknown as { __handoffDebugData: { lastHandoffCorrelation: { userInput: unknown; handoffFunctionCall: unknown; functionSessionId: string } } }).__handoffDebugData.lastHandoffCorrelation = {
              userInput: lastUserInput,
              handoffFunctionCall: {
                functionName,
                callId,
                arguments: argumentsStr,
                timestamp: new Date().toISOString(),
                timeSinceUserInput: timeBetweenInputAndHandoff
              },
              functionSessionId: functionSessionId
            };
            console.log(`[HANDOFF-DEBUG] Correlation data stored in window.__handoffDebugData.lastHandoffCorrelation`);
          } else if (functionName === 'trigger_specialist_handoff') {
            console.log(`[HANDOFF-DEBUG] ⚠️ HANDOFF FUNCTION CALLED BUT NO USER INPUT DATA AVAILABLE`);
            console.log(`[HANDOFF-DEBUG] Function Session ID: ${functionSessionId}`);
            console.log(`[HANDOFF-DEBUG] This may indicate immediate handoff after user response`);
          }

          // Keep thinking state active during function execution

          try {
            const parsedArgs = JSON.parse(argumentsStr);
            console.log(`[FUNCTION-CALL] Parsed arguments:`, parsedArgs);

            // Get function from registry
            const currentFunctionRegistry = getFunctionRegistry();
            console.log(`[FUNCTION-CALL] Available functions in registry:`, Object.keys(currentFunctionRegistry));

            const fn = currentFunctionRegistry[functionName];
            if (fn) {
              console.log(`[FUNCTION-CALL] Function ${functionName} found in registry, executing...`);
              
              // Add function execution logging
              if (process.env.NEXT_PUBLIC_ENABLE_FUNCTION_EXECUTION_LOGS === 'true') {
                console.log(`[function_execution] 🚀 WEBRTC-DIRECT: ${functionName} executing via WebRTC`);
              }
              const result = await fn(parsedArgs);
              console.log(`[FUNCTION-CALL] Function ${functionName} execution result:`, result);

              // Send function result back using connection manager
              const currentState = get();
              if (currentState.connectionManager) {
                const success = currentState.connectionManager.sendFunctionResult(callId, result);
                if (success) {
                  console.log(`[FUNCTION-CALL] Function result sent successfully for ${functionName} (callId: ${callId})`);

                  // For end_session, track that we're expecting a goodbye response
                  if (functionName === 'end_session' && (result as { success: boolean }).success) {
                    console.log(`[FUNCTION-CALL] end_session function succeeded, setting expectingEndSessionGoodbye=true`);
                    set({
                      expectingEndSessionGoodbye: true,
                      endSessionCallId: callId
                    });
                  }
                } else {
                  console.error(`[FUNCTION-CALL] Failed to send function result for ${functionName} (callId: ${callId})`);
                }
              } else {
                console.error(`[FUNCTION-CALL] No connection manager available to send function result for ${functionName}`);
              }
            } else {
              console.error(`[FUNCTION-CALL] Function ${functionName} not found in registry. Available functions:`, Object.keys(currentFunctionRegistry));
            }

          } catch (error) {
            console.error(`[FUNCTION-CALL] Error executing function ${functionName}:`, error);
          }
        },

        onAudioTranscriptDelta: (msg: Record<string, unknown>) => {
          const delta = msg.delta as string;
          const responseId = msg.response_id as string || 'unknown';
          const role = msg.role as string || 'assistant';

          if (process.env.ENABLE_V15_TRANSCRIPT_DEBUG_LOGS === 'true') {
            console.log('[V15-TRANSCRIPT-DEBUG] Audio transcript delta received:', { delta, responseId, role });
          }

          // Only clear thinking state when AI assistant starts responding (not for user transcripts)
          if (role === 'assistant') {
            set(state => {
              console.log('[function] Clearing isThinking: false (onAudioTranscriptDelta - assistant)');
              const newState = { ...state, isThinking: false };
              console.log('[function] New state:', { isThinking: newState.isThinking });
              return newState;
            });
          } else if (role === 'user') {
            // V18: In manual VAD mode, accumulate user transcription to show what they're saying
            console.log('[V18-MANUAL-VAD] Accumulating user speech delta:', delta);
            set(state => ({
              ...state,
              userMessage: state.userMessage + delta
            }));
          } else {
            console.log('[function] Keeping thinking state - transcript is from user role');
          }

          const currentState = get();
          if (delta && currentState.transcriptCallback) {
            if (process.env.ENABLE_V15_TRANSCRIPT_DEBUG_LOGS === 'true') {
              console.log('[V15-TRANSCRIPT-DEBUG] Calling transcript callback with delta');
            }
            currentState.transcriptCallback({
              id: responseId,
              data: delta,
              metadata: { isTranscriptComplete: false, role: role }
            });
          } else {
            if (process.env.ENABLE_V15_TRANSCRIPT_DEBUG_LOGS === 'true') {
              console.log('[V15-TRANSCRIPT-DEBUG] No transcript callback set or no delta data');
            }
          }
        },

        onAudioTranscriptDone: (msg: Record<string, unknown>) => {
          const transcript = msg.transcript as string;
          const responseId = msg.response_id as string || 'unknown';
          const role = msg.role as string || 'assistant';

          if (process.env.ENABLE_V15_TRANSCRIPT_DEBUG_LOGS === 'true') {
            console.log('[V15-TRANSCRIPT-DEBUG] Audio transcript done received:', { transcript, responseId, role });
          }

          const currentState = get();
          if (transcript && currentState.transcriptCallback) {
            if (process.env.ENABLE_V15_TRANSCRIPT_DEBUG_LOGS === 'true') {
              console.log('[V15-TRANSCRIPT-DEBUG] Calling transcript callback with complete transcript');
            }
            currentState.transcriptCallback({
              id: responseId,
              data: transcript,
              metadata: { isTranscriptComplete: true, role: role }
            });
          } else {
            if (process.env.ENABLE_V15_TRANSCRIPT_DEBUG_LOGS === 'true') {
              console.log('[V15-TRANSCRIPT-DEBUG] No transcript callback set or no transcript data');
            }
          }
        },

        onAudioDelta: (msg: Record<string, unknown>) => {
          // Handle audio chunks for playback
          const delta = msg.delta as string;
          const responseId = msg.response_id as string;

          if (delta && responseId) {
            // Audio playback will be handled by existing audio service
          }
        },

        onAudioDone: (msg: Record<string, unknown>) => {
          console.log('[END-SESSION-DEBUG] 🎵 onAudioDone CALLED - checking state');
          optimizedAudioLogger.info('webrtc', 'response_audio_done', msg);

          // Clear thinking state when AI finishes generating audio
          set(state => {
            console.log('[function] Clearing isThinking: false (onAudioDone)');
            const newState = { ...state, isThinking: false };
            console.log('[function] New state:', { isThinking: newState.isThinking });
            return newState;
          });

          const currentState = get();

          console.log('[END-SESSION-DEBUG] 🔍 onAudioDone state check:', {
            responseId: msg.response_id,
            waitingForEndSession: currentState.waitingForEndSession,
            expectingGoodbye: currentState.expectingEndSessionGoodbye,
            endSessionCallId: currentState.endSessionCallId,
            messageKeys: Object.keys(msg)
          });

          // CRITICAL: If we're waiting for end session, ONLY start end session detection
          // Stop any regular conversation detection that might be running
          if (currentState.waitingForEndSession) {
            console.log('[END-SESSION-DEBUG] 🛑 PRIORITY: End session mode - stopping any existing detection');
            stopSilenceDetection(); // Clear any existing detection first
          }

          if (currentState.waitingForEndSession) {
            console.log('[function] 🎚️ Starting silence detection for END SESSION');

            optimizedAudioLogger.info('session', 'server_audio_generation_complete', {
              responseId: msg.response_id,
              action: 'starting_store_based_silence_detection_end_session',
              method: 'store_volume_monitoring_plus_silence_detection'
            });

            // End session completion callback - disconnect when done
            const endSessionCallback = async () => {
              console.log('[END-SESSION-DEBUG] 🔍 END SESSION CALLBACK EXECUTING - starting 2-second grace period');

              // Check state before grace period
              const beforeState = get();
              console.log(`[END-SESSION-DEBUG] 🔍 State before grace period: connected=${beforeState.isConnected}, waiting=${beforeState.waitingForEndSession}, conversation=${beforeState.conversation.length} messages`);

              // Add 2-second grace period before disconnecting
              setTimeout(async () => {
                console.log('[END-SESSION-DEBUG] 🔚 Grace period complete - starting disconnect sequence');

                // Check state after grace period
                const afterState = get();
                console.log(`[END-SESSION-DEBUG] 🔍 State after grace period: connected=${afterState.isConnected}, waiting=${afterState.waitingForEndSession}, conversation=${afterState.conversation.length} messages`);

                if (!afterState.isConnected) {
                  console.log('[END-SESSION-DEBUG] 🚨 Already disconnected during grace period - something else caused disconnect!');
                  return;
                }

                try {
                  console.log('[END-SESSION-DEBUG] 🔌 Calling disconnect() method now');
                  await get().disconnect();
                  console.log('[END-SESSION-DEBUG] ✅ disconnect() completed successfully');
                } catch (error) {
                  console.log('[END-SESSION-DEBUG] ❌ disconnect() ERROR:', error);
                }
              }, 2000);
            };

            console.log('[END-SESSION-DEBUG] 🎯 Creating END SESSION silence detection with disconnect callback');
            startSilenceDetection(endSessionCallback, get);
          } else {
            // Double-check: don't start regular detection if we're actually waiting for end session
            const finalCheck = get();
            if (finalCheck.waitingForEndSession) {
              console.log('[END-SESSION-DEBUG] ⚠️ RACE CONDITION: State changed to waitingForEndSession=true, skipping regular detection');
              return;
            }
            console.log('[function] 🎚️ Starting silence detection for REGULAR CONVERSATION');

            optimizedAudioLogger.info('session', 'server_audio_generation_complete', {
              responseId: msg.response_id,
              action: 'starting_store_based_silence_detection_regular',
              method: 'store_volume_monitoring_plus_silence_detection'
            });

            // Regular conversation completion callback - just mark complete
            const regularCallback = () => {
              console.log('[END-SESSION-DEBUG] 🔍 REGULAR CALLBACK EXECUTING - this is harmless');
              console.log('[function] ✅ Regular conversation silence detection complete');
              console.log('[function] 🎯 AI finished speaking - user can speak again');

              optimizedAudioLogger.info('session', 'regular_conversation_audio_complete', {
                responseId: msg.response_id,
                method: 'store_based_silence_detection'
              });

              // No special state changes needed for regular conversation
              // User can start speaking again naturally
            };

            console.log('[END-SESSION-DEBUG] 🎯 Creating REGULAR CHAT silence detection with harmless callback');
            startSilenceDetection(regularCallback, get);
          }
        },

        onOutputAudioBufferStopped: (msg: Record<string, unknown>) => {
          logTriageHandoff('===== OUTPUT_AUDIO_BUFFER.STOPPED HANDLER TRIGGERED =====');
          logTriageHandoff('Audio buffer stopped - all server audio has been streamed');
          logTriageHandoff('ResponseId:', msg.response_id);
          logTriageHandoff('Full message object:', msg);

          const currentState = get();

          // V16 HANDOFF: Check for pending handoff and dispatch when audio buffer is stopped
          if (currentState.pendingHandoff) {
            logTriageHandoff(`🎯 Audio buffer stopped - dispatching pending handoff to ${currentState.pendingHandoff.specialistType}`);
            logTriageHandoff('This is the definitive audio completion event from OpenAI');

            const handoffEvent = new CustomEvent('specialist_handoff', {
              detail: {
                specialistType: currentState.pendingHandoff.specialistType,
                contextSummary: currentState.pendingHandoff.contextSummary,
                conversationId: currentState.pendingHandoff.conversationId,
                reason: currentState.pendingHandoff.reason,
                urgencyLevel: currentState.pendingHandoff.urgencyLevel,
                sessionId: currentState.pendingHandoff.sessionId,
                dispatchedAt: performance.now(),
                triggeredBy: 'output_audio_buffer.stopped'
              }
            });

            window.dispatchEvent(handoffEvent);

            // Clear the pending handoff and any active volume detection sessions
            set({
              pendingHandoff: null,
              activeVolumeDetectionSessions: new Set()
            });

            logTriageHandoff('✅ Handoff dispatched via output_audio_buffer.stopped');
          } else {
            logTriageHandoff('No pending handoff - audio buffer stopped normally');
          }
        },

        onResponseDone: (msg: Record<string, unknown>) => {
          const responseStartTime = performance.now();
          const responseSessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);

          console.log(`[HANDOFF-DEBUG] ===== onResponseDone HANDLER TRIGGERED =====`);
          console.log(`[HANDOFF-DEBUG] Response Session ID: ${responseSessionId}`);
          console.log(`[HANDOFF-DEBUG] Response time: ${responseStartTime.toFixed(3)}ms since page load`);
          console.log(`[HANDOFF-DEBUG] ResponseId: ${msg.response_id}`);
          console.log(`[HANDOFF-DEBUG] Full message object:`, msg);

          optimizedAudioLogger.info('webrtc', 'response_completed', { responseId: msg.response_id });

          // Don't clear thinking state here - wait for actual speech
          // Thinking state persists through function calls

          // Check if this is the goodbye response after end_session
          const currentState = get();
          console.log(`[HANDOFF-DEBUG] Current WebRTC state at response completion:`, {
            responseSessionId,
            isConnected: currentState.isConnected,
            connectionState: currentState.connectionState,
            isAudioPlaying: currentState.isAudioPlaying,
            currentVolume: currentState.currentVolume,
            isThinking: currentState.isThinking,
            conversationLength: currentState.conversation?.length || 0,
            hasActiveConversation: currentState.hasActiveConversation,
            expectingEndSessionGoodbye: currentState.expectingEndSessionGoodbye,
            waitingForEndSession: currentState.waitingForEndSession,
            pendingHandoff: currentState.pendingHandoff ? 'EXISTS' : 'NULL',
            triageSessionCurrentSpecialist: currentState.triageSession?.currentSpecialist || 'UNKNOWN'
          });

          console.log(`[END-SESSION-DEBUG] 🔍 onResponseDone current state: expecting=${currentState.expectingEndSessionGoodbye}, waiting=${currentState.waitingForEndSession}, connected=${currentState.isConnected}`);

          // V16 HANDOFF: Check for pending handoff - now relying primarily on output_audio_buffer.stopped
          if (currentState.pendingHandoff) {
            const handoffDispatchTime = performance.now();
            console.log(`[HANDOFF-DEBUG] ===== PENDING HANDOFF DETECTED =====`);
            console.log(`[HANDOFF-DEBUG] Waiting for output_audio_buffer.stopped event for definitive audio completion`);

            // Check if we already have a volume detection session running for this handoff
            const handoffSessionId = currentState.pendingHandoff.sessionId || 'unknown';
            if (currentState.activeVolumeDetectionSessions.has(handoffSessionId)) {
              console.log(`[HANDOFF-DEBUG] ⚠️ Volume detection already running for session ${handoffSessionId} - ignoring duplicate onResponseDone`);
              return;
            }
            console.log(`[HANDOFF-DEBUG] Response Session ID: ${responseSessionId}`);
            console.log(`[HANDOFF-DEBUG] Stored handoff session ID: ${currentState.pendingHandoff.sessionId || 'MISSING'}`);
            console.log(`[HANDOFF-DEBUG] Time since response start: ${(handoffDispatchTime - responseStartTime).toFixed(3)}ms`);
            console.log(`[HANDOFF-DEBUG] AI response complete - but waiting for audio completion before handoff dispatch`);
            console.log(`[HANDOFF-DEBUG] Handoff context preview: ${currentState.pendingHandoff.contextSummary.substring(0, 100)}...`);
            console.log(`[HANDOFF-DEBUG] Full handoff data:`, currentState.pendingHandoff);

            // Log audio state at detection
            console.log(`[HANDOFF-DEBUG] Audio state at handoff detection:`, {
              isAudioPlaying: currentState.isAudioPlaying,
              currentVolume: currentState.currentVolume,
              audioLevel: currentState.audioLevel,
              connectionState: currentState.connectionState
            });

            // CRITICAL FIX: Wait for audio completion before dispatching handoff
            console.log(`[HANDOFF-DEBUG] ===== VOLUME-BASED HANDOFF DISPATCH DELAY =====`);
            console.log(`[HANDOFF-DEBUG] Waiting for AI to finish speaking before starting handoff...`);

            // ALWAYS wait for output_audio_buffer.stopped event - never dispatch immediately
            console.log(`[HANDOFF-DEBUG] 🎯 ALWAYS waiting for output_audio_buffer.stopped event - never dispatching immediately`);
            console.log(`[HANDOFF-DEBUG] Current audio state: isPlaying=${currentState.isAudioPlaying}, volume=${currentState.currentVolume.toFixed(6)}`);
            console.log(`[HANDOFF-DEBUG] Even if audio appears stopped, AI may have more to say after function call`);

            // Start timeout-based fallback (only if output_audio_buffer.stopped never comes)
            setTimeout(async () => {
              const delaySessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
              const delayStartTime = performance.now();

              console.log(`[HANDOFF-DEBUG] 🎯 Starting volume-based delay for handoff dispatch`);
              console.log(`[HANDOFF-DEBUG] Delay session ID: ${delaySessionId}`);
              console.log(`[HANDOFF-DEBUG] Delay start time: ${delayStartTime.toFixed(3)}ms`);

              // Add this session to active tracking
              set(state => ({
                ...state,
                activeVolumeDetectionSessions: new Set([...state.activeVolumeDetectionSessions, handoffSessionId])
              }));

              // Wait for audio completion using volume detection
              await new Promise<void>((resolve) => {
                let silenceStartTime = 0;
                let isMonitoring = true;
                let totalChecks = 0;
                let silentChecks = 0;
                let volumeReadings: number[] = [];
                const silenceThreshold = 1000; // 1 second of silence (shorter since buffer stopped is primary)
                const checkInterval = 100; // Check every 100ms
                const volumeThreshold = 0.01; // Same threshold as store's silence detection
                const maxWaitTime = 5000; // 5 second safety timeout (shorter fallback)

                console.log(`[HANDOFF-DEBUG] Volume detection configuration:`, {
                  silenceThreshold,
                  checkInterval,
                  volumeThreshold,
                  maxWaitTime,
                  sessionId: delaySessionId
                });

                // Safety timeout
                const timeoutId = setTimeout(() => {
                  console.log(`[HANDOFF-DEBUG] ⏰ Volume detection timeout reached (${maxWaitTime}ms) - proceeding with handoff`);
                  console.log(`[HANDOFF-DEBUG] Timeout stats: ${totalChecks} checks, ${silentChecks} silent, ${volumeReadings.length} volume readings`);
                  // Clean up session tracking
                  set(state => ({
                    ...state,
                    activeVolumeDetectionSessions: new Set([...state.activeVolumeDetectionSessions].filter(id => id !== handoffSessionId))
                  }));
                  isMonitoring = false;
                  resolve();
                }, maxWaitTime);

                const volumeDelayDetection = () => {
                  if (!isMonitoring) {
                    console.log(`[HANDOFF-DEBUG] 🛑 Volume monitoring stopped - delay session ${delaySessionId} terminated`);
                    return;
                  }

                  const checkTime = performance.now();
                  const webrtcState = get();
                  const isAudioPlaying = webrtcState.isAudioPlaying;
                  const currentVolume = webrtcState.currentVolume;
                  const timeSinceStart = checkTime - delayStartTime;

                  totalChecks++;
                  volumeReadings.push(currentVolume);

                  // Keep only last 50 volume readings
                  if (volumeReadings.length > 50) {
                    volumeReadings = volumeReadings.slice(-50);
                  }

                  // Calculate volume statistics
                  const avgVolume = volumeReadings.reduce((sum, vol) => sum + vol, 0) / volumeReadings.length;

                  // Enhanced logging every 500ms
                  if (totalChecks % 5 === 0) {
                    console.log(`[HANDOFF-DEBUG] 📊 Volume check #${totalChecks} (${timeSinceStart.toFixed(0)}ms):`, {
                      sessionId: delaySessionId,
                      isAudioPlaying,
                      currentVolume: currentVolume.toFixed(6),
                      avgVolume: avgVolume.toFixed(6),
                      isConnected: webrtcState.isConnected,
                      silentChecks,
                      totalChecks
                    });
                  }

                  // Check if we're still connected
                  if (!webrtcState.isConnected) {
                    console.log(`[HANDOFF-DEBUG] ⚠️ CONNECTION LOST during volume delay - proceeding with handoff`);
                    console.log(`[HANDOFF-DEBUG] Session ${delaySessionId} terminated due to connection loss after ${timeSinceStart.toFixed(0)}ms`);
                    // Clean up session tracking
                    set(state => ({
                      ...state,
                      activeVolumeDetectionSessions: new Set([...state.activeVolumeDetectionSessions].filter(id => id !== handoffSessionId))
                    }));
                    clearTimeout(timeoutId);
                    isMonitoring = false;
                    resolve();
                    return;
                  }

                  // Audio is considered silent if volume is low (don't rely on isAudioPlaying as it often stays true)
                  const isSilent = currentVolume < volumeThreshold;

                  if (isSilent) {
                    silentChecks++;

                    if (silenceStartTime === 0) {
                      silenceStartTime = Date.now();
                      console.log(`[HANDOFF-DEBUG] 🔇 SILENCE DETECTED - starting 1-second timer for fallback handoff dispatch`);
                      console.log(`[HANDOFF-DEBUG] Silence start conditions:`, {
                        sessionId: delaySessionId,
                        isAudioPlaying,
                        currentVolume: currentVolume.toFixed(6),
                        volumeThreshold,
                        timeSinceDelayStart: timeSinceStart.toFixed(0) + 'ms',
                        checkNumber: totalChecks
                      });
                    }

                    const silenceDuration = Date.now() - silenceStartTime;

                    // Log silence progress every 500ms
                    if (silenceDuration % 500 === 0 || silenceDuration >= silenceThreshold - 200) {
                      console.log(`[HANDOFF-DEBUG] ⏱️ Silence progress: ${silenceDuration}ms / ${silenceThreshold}ms (${((silenceDuration / silenceThreshold) * 100).toFixed(1)}%)`);
                    }

                    if (silenceDuration >= silenceThreshold) {
                      const completionTime = performance.now();
                      const totalDelayTime = completionTime - delayStartTime;

                      console.log(`[HANDOFF-DEBUG] ✅ VOLUME-BASED DELAY COMPLETED - AI speech finished`);
                      console.log(`[HANDOFF-DEBUG] Final delay results:`, {
                        sessionId: delaySessionId,
                        silenceThresholdMs: silenceThreshold,
                        actualSilenceDuration: silenceDuration,
                        totalDelayTime: totalDelayTime.toFixed(0) + 'ms',
                        totalChecks,
                        silentChecks,
                        finalVolume: currentVolume.toFixed(6),
                        completionTimestamp: new Date().toISOString()
                      });

                      console.log(`[HANDOFF-DEBUG] 🎯 1 second of confirmed silence detected - dispatching fallback handoff now`);
                      // Clean up session tracking
                      set(state => ({
                        ...state,
                        activeVolumeDetectionSessions: new Set([...state.activeVolumeDetectionSessions].filter(id => id !== handoffSessionId))
                      }));
                      clearTimeout(timeoutId);
                      isMonitoring = false;
                      resolve();
                      return;
                    }
                  } else {
                    // Audio resumed or volume increased - reset silence timer
                    if (silenceStartTime > 0) {
                      const resetReason = isAudioPlaying ? 'audio_resumed' : 'volume_increased';
                      console.log(`[HANDOFF-DEBUG] 🔊 SILENCE RESET - ${resetReason}`);
                      console.log(`[HANDOFF-DEBUG] Reset details:`, {
                        sessionId: delaySessionId,
                        resetReason,
                        timeSinceStart: timeSinceStart.toFixed(0) + 'ms',
                        wasAudioPlaying: isAudioPlaying,
                        currentVolume: currentVolume.toFixed(6),
                        previousSilenceDuration: Date.now() - silenceStartTime + 'ms',
                        checkNumber: totalChecks
                      });
                    }
                    silenceStartTime = 0;
                  }

                  // Continue monitoring
                  setTimeout(volumeDelayDetection, checkInterval);
                };

                // Start volume detection
                volumeDelayDetection();
              });

              // After volume detection completes, dispatch the handoff
              console.log(`[HANDOFF-DEBUG] 📡 Audio completion detected - now dispatching handoff event`);

              // Get fresh state in case something changed during delay
              const finalState = get();
              if (finalState.pendingHandoff) {
                const handoffEvent = new CustomEvent('specialist_handoff', {
                  detail: {
                    specialistType: finalState.pendingHandoff.specialistType,
                    contextSummary: finalState.pendingHandoff.contextSummary,
                    conversationId: finalState.pendingHandoff.conversationId,
                    reason: finalState.pendingHandoff.reason,
                    urgencyLevel: finalState.pendingHandoff.urgencyLevel,
                    sessionId: finalState.pendingHandoff.sessionId,
                    dispatchedAt: performance.now(),
                    responseSessionId: responseSessionId,
                    delaySessionId: delaySessionId,
                    triggeredBy: 'volume_detection_fallback'
                  }
                });

                const eventDispatchTime = performance.now();
                window.dispatchEvent(handoffEvent);
                console.log(`[HANDOFF-DEBUG] ✅ Handoff event dispatched after audio completion (${(performance.now() - eventDispatchTime).toFixed(3)}ms)`);
                console.log(`[HANDOFF-DEBUG] Total processing time including delay: ${(performance.now() - handoffDispatchTime).toFixed(3)}ms`);

                // Clear the pending handoff
                set({ pendingHandoff: null });
                console.log(`[HANDOFF-DEBUG] Pending handoff cleared after delayed dispatch`);
              } else {
                console.log(`[HANDOFF-DEBUG] ⚠️ Pending handoff was cleared during delay - skipping dispatch`);
              }
            }, 100); // Small delay to ensure response processing is complete

            // Add simple safety timeout fallback (only if output_audio_buffer.stopped never comes)
            setTimeout(() => {
              console.log(`[HANDOFF-DEBUG] ⏰ SAFETY TIMEOUT: No output_audio_buffer.stopped event received - dispatching fallback handoff`);

              const currentState = get();
              if (currentState.pendingHandoff) {
                const handoffEvent = new CustomEvent('specialist_handoff', {
                  detail: {
                    specialistType: currentState.pendingHandoff.specialistType,
                    contextSummary: currentState.pendingHandoff.contextSummary,
                    conversationId: currentState.pendingHandoff.conversationId,
                    reason: currentState.pendingHandoff.reason,
                    urgencyLevel: currentState.pendingHandoff.urgencyLevel,
                    sessionId: currentState.pendingHandoff.sessionId,
                    dispatchedAt: performance.now(),
                    responseSessionId: responseSessionId,
                    triggeredBy: 'safety_timeout_fallback'
                  }
                });

                window.dispatchEvent(handoffEvent);
                set({ pendingHandoff: null });
                console.log(`[HANDOFF-DEBUG] ✅ Safety timeout handoff dispatched`);
              }
            }, 10000); // 10 second safety timeout
          } else {
            console.log(`[HANDOFF-DEBUG] No pending handoff found - normal response completion`);
            console.log(`[HANDOFF-DEBUG] Response Session ID: ${responseSessionId}`);
          }

          // DEBUG: Always log response done events when expecting goodbye
          if (currentState.expectingEndSessionGoodbye) {
            console.log('[END-SESSION-DEBUG] 🔍 onResponseDone called while expecting goodbye:', {
              responseId: msg.response_id,
              expectingGoodbye: currentState.expectingEndSessionGoodbye,
              endSessionCallId: currentState.endSessionCallId,
              fullMessage: msg
            });

            const response = msg.response as Record<string, unknown> | undefined;
            const hasContent = response && response.status === 'completed';

            console.log('[END-SESSION-DEBUG] 🔍 Response content analysis:', {
              response,
              hasContent,
              responseStatus: response?.status,
              responseKeys: response ? Object.keys(response) : 'no response object'
            });

            if (hasContent) {
              console.log('[END-SESSION-DEBUG] ✅ Goodbye response detected! Setting waitingForEndSession=true');

              optimizedAudioLogger.info('session', 'goodbye_response_detected', {
                responseId: msg.response_id,
                callId: currentState.endSessionCallId,
                nextStep: 'waiting_for_server_audio_done_signal'
              });

              // CRITICAL FIX: Stop any existing silence detection to prevent race conditions
              console.log('[END-SESSION-DEBUG] 🛁 Stopping all regular audio monitoring to prevent race conditions');
              stopSilenceDetection();

              // Mark that goodbye was received, now wait for server audio done signal
              set({
                expectingEndSessionGoodbye: false,
                waitingForEndSession: true
              });

              console.log('[END-SESSION-DEBUG] 🎯 State transition complete:', {
                expectingEndSessionGoodbye: false,
                waitingForEndSession: true
              });

              optimizedAudioLogger.info('debug', 'end_session_flow_ready', {
                waitingForServerAudioDone: true,
                flow: 'server_signal_plus_volume_monitoring'
              });
            } else {
              console.log('[END-SESSION-DEBUG] ❌ Response did not meet goodbye criteria');

              optimizedAudioLogger.warn('debug', 'unexpected_response_after_end_session', {
                responseId: msg.response_id,
                hasContent,
                expectedGoodbye: true,
                responseStatus: response?.status,
                fullResponse: response
              });
            }
          } else {
            console.log('[END-SESSION-DEBUG] 📝 Normal response done (not expecting goodbye):', {
              responseId: msg.response_id
            });
          }
        },

        onError: (error: Error) => {
          optimizedAudioLogger.error('webrtc', 'comprehensive_handler_error', error);

          const currentState = get();
          if (currentState.errorCallback) {
            currentState.errorCallback(error);
          }
        }
      };

      const messageHandler = new ComprehensiveMessageHandler(messageCallbacks);

      // Subscribe to connection messages
      connectionManager.onMessage(async (event) => {
        if (messageHandler) {
          await messageHandler.handleMessage(event);
        }
      });

      // Subscribe to connection errors
      connectionManager.onError((error) => {
        optimizedAudioLogger.error('webrtc', 'connection_error', error);

        const currentState = get();
        if (currentState.errorCallback) {
          currentState.errorCallback(error);
        }
      });

      // Subscribe to incoming audio streams for real-time audio monitoring
      connectionManager.onAudioStream((stream) => {
        console.log('[V15-ORB-DEBUG] Zustand store onAudioStream callback triggered:', {
          streamId: stream.id,
          trackCount: stream.getTracks().length,
          audioTracks: stream.getAudioTracks().length,
          streamActive: stream.active,
          tracks: stream.getTracks().map(track => ({
            id: track.id,
            kind: track.kind,
            enabled: track.enabled,
            readyState: track.readyState
          })),
          timestamp: Date.now()
        });

        optimizedAudioLogger.info('webrtc', 'audio_stream_connected', {
          streamId: stream.id,
          trackCount: stream.getTracks().length,
          audioTracks: stream.getAudioTracks().length
        });

        // Create audio element with stable event handlers
        const audioElement = document.createElement('audio');
        audioElement.srcObject = stream;
        audioElement.autoplay = true;
        audioElement.volume = 1.0;
        audioElement.style.display = 'none';
        audioElement.id = `zustand-audio-${stream.id}`;

        console.log('[V15-ORB-DEBUG] Audio element created in Zustand store:', {
          elementId: audioElement.id,
          srcObject: !!audioElement.srcObject,
          autoplay: audioElement.autoplay,
          volume: audioElement.volume,
          streamId: stream.id
        });

        // Real-time volume monitoring setup
        let audioContext: AudioContext | null = null;
        let analyser: AnalyserNode | null = null;
        let volumeMonitoringInterval: number | null = null;
        let lastEventDispatchTime: number = 0;

        const setupVolumeMonitoring = () => {
          console.log('[V15-ORB-DEBUG] setupVolumeMonitoring called for element:', audioElement.id);
          try {
            audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            analyser = audioContext.createAnalyser();

            console.log('[V15-ORB-DEBUG] AudioContext created:', {
              contextState: audioContext.state,
              sampleRate: audioContext.sampleRate,
              elementId: audioElement.id
            });

            // CRITICAL V15 FIX: Use createMediaStreamSource for WebRTC streams, NOT createMediaElementSource
            // createMediaElementSource() only works with HTML audio elements playing files/URLs
            // createMediaStreamSource() works with live WebRTC MediaStreams from OpenAI Realtime API
            // This is the core fix for V15 silence detection - we must monitor the WebRTC stream directly
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            // Note: Do NOT connect to destination as that would cause audio to play twice
            // The audio element already handles playback, we only need volume monitoring

            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            console.log('[V15-ORB-DEBUG] Volume monitoring setup complete:', {
              fftSize: analyser.fftSize,
              bufferLength: bufferLength,
              audioContextState: audioContext.state,
              elementId: audioElement.id,
              sourceConnected: true
            });

            // Volume monitoring state tracking
            let lastLogTime = 0;

            // Start optimized volume monitoring loop
            volumeMonitoringInterval = window.setInterval(() => {
              if (!analyser) return;

              const currentState = get();

              // Continue monitoring during all states - let actual audio levels determine values

              analyser.getByteFrequencyData(dataArray);

              // Calculate RMS (Root Mean Square) for volume
              let sum = 0;
              for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i] * dataArray[i];
              }
              const rms = Math.sqrt(sum / bufferLength);
              const normalizedVolume = rms / 255; // Normalize to 0-1
              const audioLevel = Math.floor(rms); // Keep original scale for compatibility
              const isAudioPlaying = rms > 10; // Threshold for detecting audio activity

              // Minimal logging during end session only for critical events
              if (currentState.waitingForEndSession && silenceDetector.isActive && (rms < 5 || rms > 50)) {
                console.log(`[END-SESSION-DEBUG] 🎤 Audio: ${rms.toFixed(1)} (${isAudioPlaying ? 'playing' : 'silent'})`);
              }

              // STATE CHANGE DETECTION: Only update if values actually changed
              const volumeChanged = Math.abs(currentState.currentVolume - normalizedVolume) > 0.01;
              const levelChanged = Math.abs(currentState.audioLevel - audioLevel) > 1;
              const playingChanged = currentState.isAudioPlaying !== isAudioPlaying;

              if (volumeChanged || levelChanged || playingChanged) {
                // DRASTICALLY REDUCED LOGGING: Only log major state changes or every 5 seconds
                const now = Date.now();
                const shouldLog = playingChanged || (now - lastLogTime > 5000);

                if (shouldLog) {
                  if (process.env.ENABLE_V15_VOLUME_LOGS === 'true') {
                    console.log('[V15-VOLUME] Audio state change:', {
                      rms: rms.toFixed(2),
                      normalizedVolume: normalizedVolume.toFixed(4),
                      audioLevel: audioLevel,
                      isAudioPlaying: isAudioPlaying,
                      changes: { volumeChanged, levelChanged, playingChanged }
                    });
                  }
                  lastLogTime = now;
                }

                // Update store only when values actually change
                set(state => ({
                  ...state,
                  currentVolume: normalizedVolume,
                  audioLevel: audioLevel,
                  isAudioPlaying: isAudioPlaying
                }));

                // REMOVE EXCESSIVE DEBUG LOGGING - only log during critical state changes
                // Blue orb rotation works, no need for constant logging

                // Check if webrtc-audio-level events should be dispatched (like the old system)
                // Throttle event dispatching to prevent excessive logging (dispatch every 500ms instead of 100ms)
                const eventNow = Date.now();
                if (isAudioPlaying && typeof window !== 'undefined' &&
                  (!lastEventDispatchTime || eventNow - lastEventDispatchTime > 500)) {
                  // Dispatch webrtc-audio-level event for blue orb (this might be what's missing)
                  const event = new CustomEvent('webrtc-audio-level', {
                    detail: { level: rms } // Send raw RMS value (0-255 scale)
                  });
                  window.dispatchEvent(event);
                  lastEventDispatchTime = eventNow;
                  // REDUCED LOGGING: Event dispatched successfully (no need to log constantly)
                }
              }
            }, 100); // Reduced to 10fps - still smooth but less intensive

            console.log('[zustand-webrtc] ✅ Real-time volume monitoring started');
          } catch (error) {
            console.error('[zustand-webrtc] ❌ Failed to setup volume monitoring:', error);
          }
        };

        audioElement.onplay = () => {
          console.log('[V15-ORB-DEBUG] Zustand audio element onplay event:', {
            elementId: audioElement.id,
            streamId: stream.id,
            currentTime: audioElement.currentTime,
            duration: audioElement.duration,
            paused: audioElement.paused,
            readyState: audioElement.readyState
          });
          optimizedAudioLogger.audioPlayback('started', stream.id);
          setupVolumeMonitoring();
          set(state => ({ ...state, isAudioPlaying: true }));
        };

        audioElement.onended = () => {
          optimizedAudioLogger.audioPlayback('ended', stream.id);
          set(state => ({ ...state, isAudioPlaying: false, currentVolume: 0, audioLevel: 0 }));
          if (volumeMonitoringInterval) {
            clearInterval(volumeMonitoringInterval);
            volumeMonitoringInterval = null;
          }
        };

        audioElement.onpause = () => {
          set(state => ({ ...state, isAudioPlaying: false, currentVolume: 0, audioLevel: 0 }));
          if (volumeMonitoringInterval) {
            clearInterval(volumeMonitoringInterval);
            volumeMonitoringInterval = null;
          }
        };

        audioElement.onerror = (error) => {
          console.log('[V15-ORB-DEBUG] Zustand audio element error:', {
            elementId: audioElement.id,
            streamId: stream.id,
            error: error
          });
          optimizedAudioLogger.error('webrtc', 'audio_element_error', new Error(`Audio element error: ${error}`));
          set(state => ({ ...state, isAudioPlaying: false, currentVolume: 0, audioLevel: 0 }));
        };

        document.body.appendChild(audioElement);

        console.log('[V15-ORB-DEBUG] Audio element appended to DOM:', {
          elementId: audioElement.id,
          parentNode: !!audioElement.parentNode,
          inDOM: document.contains(audioElement),
          streamId: stream.id
        });

        stream.getTracks().forEach(track => {
          track.onended = () => {
            optimizedAudioLogger.info('webrtc', 'audio_track_ended', { trackId: track.id });
            if (volumeMonitoringInterval) {
              clearInterval(volumeMonitoringInterval);
              volumeMonitoringInterval = null;
            }
            if (audioElement.parentNode) {
              document.body.removeChild(audioElement);
            }
            set(state => ({ ...state, isAudioPlaying: false, currentVolume: 0, audioLevel: 0 }));
          };
        });
      });

      // Store the connection manager and message handler (config already stored)
      set({
        connectionManager,
        messageHandler
      });

      optimizedAudioLogger.info('webrtc', 'zustand_store_initialized', {
        version: 'v15-zustand'
      });
    },

    // Connect action - optimized for fast connection
    connect: async () => {
      const currentState = get();
      let { connectionManager } = currentState;
      const { storedConnectionConfig } = currentState;

      // If no connection manager, create one using fast initialize
      if (!connectionManager) {
        console.log('[V15-OPTIMIZATION] 🚀 First connection - calling fast initialize');

        if (!storedConnectionConfig) {
          console.error('[V15-OPTIMIZATION] ❌ No stored config - preInitialize should have been called on page load');
          throw new Error('No stored configuration found. Please ensure the page loaded correctly and try refreshing.');
        }

        // Fast initialize using pre-computed config (no function definitions needed - already stored)
        await get().initialize();
        connectionManager = get().connectionManager;

        if (!connectionManager) {
          throw new Error('Fast initialization failed to create connection manager');
        }
      }
      // If connection manager exists but needs reconnection setup
      else if (connectionManager.getState() === 'disconnected' && connectionManager.isCleanedUp()) {
        console.log('[FUNCTION-RECONNECT] Creating new connection manager for reconnection');

        if (!storedConnectionConfig) {
          console.error('[FUNCTION-RECONNECT] No stored connection config available - need to reinitialize');
          throw new Error('Connection manager lost and no stored config - please refresh the page to reinitialize');
        }

        console.log('[FUNCTION-RECONNECT] Using stored connection config with', (storedConnectionConfig.tools as Array<unknown>).length, 'tools');
        console.log('[FUNCTION-RECONNECT] Available functions:', (storedConnectionConfig.tools as Array<{ name: string }>).map(f => f.name));

        // Create new connection manager with stored config
        connectionManager = new ConnectionManager(storedConnectionConfig);

        // Set up the COMPLETE event handlers for reconnection (NOT simplified!)
        const handleConnectionStateChange = (state: ConnectionState) => {
          console.log('[FUNCTION-RECONNECT] Connection state changed:', state);
          const currentState = get();
          const wasConnected = currentState.isConnected;
          const isNowConnected = state === 'connected';

          // Detect disconnect with conversation reset
          if (wasConnected && !isNowConnected && currentState.hasActiveConversation) {
            console.log('[FUNCTION-RECONNECT] DISCONNECT DETECTED - Resetting conversation');
            set({
              conversation: [],
              hasActiveConversation: false,
              userMessage: '',
              conversationId: null,
              expectingEndSessionGoodbye: false,
              waitingForEndSession: false,
              endSessionCallId: null
            });
          }

          const shouldSetThinking = state === 'connected';
          const currentIsThinking = get().isThinking;
          console.log('[function] RECONNECT Connection state change:', {
            connectionState: state,
            shouldSetThinking,
            currentIsThinking
          });

          set({
            connectionState: state,
            isConnected: isNowConnected,
            // Set thinking state when connection is established (waiting for AI greeting)
            isThinking: shouldSetThinking ? true : currentIsThinking
          });

          if (shouldSetThinking) {
            console.log('[function] Setting isThinking: true (RECONNECT connection established)');
          }
        };

        connectionManager.onStateChange(handleConnectionStateChange);

        // Create comprehensive message handler with ALL callbacks
        const messageCallbacks: MessageHandlerCallbacks = {
          onSpeechStarted: () => {
            console.log('[FUNCTION-RECONNECT] Creating listening user bubble');
            const listeningUserMessage: ConversationMessage = {
              id: `user-listening-${Date.now()}`,
              role: "user",
              text: "Listening...",
              timestamp: new Date().toISOString(),
              isFinal: false,
              status: "speaking"
            };

            set(state => ({
              conversation: [...state.conversation, listeningUserMessage],
              hasActiveConversation: true
            }));
          },

          onSpeechStopped: () => {
            console.log('[FUNCTION-RECONNECT] Speech stopped, AI is thinking');
            // Set thinking state when user stops speaking
            set(state => {
              console.log('[function] Setting isThinking: true (RECONNECT onSpeechStopped)');
              const newState = { ...state, isThinking: true };
              console.log('[function] New state:', { isThinking: newState.isThinking });
              return newState;
            });
          },

          onAudioBufferCommitted: () => {
            // V18: Skip "Thinking..." update if in manual send mode
            const currentState = get();
            if (currentState.manualSendMode) {
              console.log('[V18] RECONNECT onAudioBufferCommitted: Skipping "Thinking..." update (manual send mode)');
              return;
            }

            console.log('[FUNCTION-RECONNECT] Setting "Thinking..." state');

            set(state => {
              const updatedConversation = [...state.conversation];
              const lastUserMessageIndex = updatedConversation.map(msg => msg.role).lastIndexOf("user");

              if (lastUserMessageIndex >= 0) {
                updatedConversation[lastUserMessageIndex] = {
                  ...updatedConversation[lastUserMessageIndex],
                  text: "Thinking...",
                  status: "thinking"
                };
              }

              const newState = {
                conversation: updatedConversation,
                isThinking: true  // Set thinking state for orb visualization
              };
              console.log('[function] Setting isThinking: true (RECONNECT onAudioBufferCommitted)');
              console.log('[function] New state:', { isThinking: newState.isThinking });
              return newState;
            });
          },

          onFunctionCall: async (msg: Record<string, unknown>) => {
            const functionName = msg.name as string;
            const callId = msg.call_id as string;
            const argumentsStr = msg.arguments as string;

            console.log(`[triage][FUNCTION-CALL] AI called function: ${functionName} with callId: ${callId}`);
            console.log(`[triage][FUNCTION-CALL] Function arguments: ${argumentsStr}`);

            // Keep thinking state active during function execution

            try {
              const parsedArgs = JSON.parse(argumentsStr);
              console.log(`[triage][FUNCTION-CALL] Parsed arguments:`, parsedArgs);

              // Get function from registry
              const currentFunctionRegistry = getFunctionRegistry();
              console.log(`[triage][FUNCTION-CALL] Available functions in registry:`, Object.keys(currentFunctionRegistry));

              const fn = currentFunctionRegistry[functionName];
              if (fn) {
                console.log(`[triage][FUNCTION-CALL] Function ${functionName} found in registry, executing...`);
                
                // Add function execution logging
                if (process.env.NEXT_PUBLIC_ENABLE_FUNCTION_EXECUTION_LOGS === 'true') {
                  console.log(`[function_execution] 🎯 TRIAGE AI FUNCTION CALL: ${functionName}`);
                  console.log(`[function_execution] Call ID: ${callId}`);
                  console.log(`[function_execution] Arguments:`, parsedArgs);
                  console.log(`[function_execution] Source: V16 Triage AI via WebRTC Direct`);
                }
                const result = await fn(parsedArgs);
                console.log(`[triage][FUNCTION-CALL] Function ${functionName} execution result:`, result);
                
                // Log function completion
                if (process.env.NEXT_PUBLIC_ENABLE_FUNCTION_EXECUTION_LOGS === 'true') {
                  console.log(`[function_execution] ✅ TRIAGE AI FUNCTION COMPLETED: ${functionName}`);
                  console.log(`[function_execution] Result:`, result);
                }

                // Send function result back using connection manager
                const currentState = get();
                if (currentState.connectionManager) {
                  const success = currentState.connectionManager.sendFunctionResult(callId, result);
                  if (success) {
                    console.log(`[triage][FUNCTION-CALL] Function result sent successfully for ${functionName} (callId: ${callId})`);

                    // For end_session, track that we're expecting a goodbye response
                    if (functionName === 'end_session' && (result as { success: boolean }).success) {
                      console.log('[function] 🎯 end_session function succeeded, setting expectingEndSessionGoodbye=true');
                      console.log('[function] ⏰ Setting smart fallback timeout for voice-activated end session');

                      // SMART FALLBACK: Only activates if volume monitoring fails to start
                      const timeoutId = window.setTimeout(() => {
                        const currentState = get();
                        const isVolumeMonitoringActive = currentState.volumeMonitoringActive;
                        const needsFallback = currentState.expectingEndSessionGoodbye || currentState.waitingForEndSession;

                        if (!isVolumeMonitoringActive && needsFallback) {
                          console.log('[function] 🚨 Smart fallback triggered - volume monitoring never started');
                          console.log('[function] Current state:', {
                            expectingGoodbye: currentState.expectingEndSessionGoodbye,
                            waitingForEndSession: currentState.waitingForEndSession,
                            volumeMonitoringActive: isVolumeMonitoringActive,
                            callId: currentState.endSessionCallId
                          });

                          optimizedAudioLogger.warn('session', 'zustand_smart_fallback_timeout', {
                            reason: 'volume_monitoring_failed_to_start',
                            volumeMonitoringActive: isVolumeMonitoringActive,
                            forcingDisconnect: true
                          });

                          // Reset all end session state
                          set({
                            expectingEndSessionGoodbye: false,
                            waitingForEndSession: false,
                            endSessionCallId: null,
                            volumeMonitoringActive: false,
                            fallbackTimeoutId: null
                          });

                          // Force disconnect using store's disconnect method (same as button)
                          console.log('[function] 🔌 Smart fallback calling store disconnect() (same as button)');
                          get().disconnect();
                        } else if (isVolumeMonitoringActive) {
                          console.log('[function] 🎯 Smart fallback skipped - volume monitoring is active');
                        } else {
                          console.log('[function] ✅ Smart fallback skipped - graceful flow completed');
                        }

                        // Clear the timeout reference
                        set({ fallbackTimeoutId: null });
                      }, 15000); // 15 second timeout since it's only for failure cases

                      // Store the timeout ID
                      set({
                        expectingEndSessionGoodbye: true,
                        endSessionCallId: callId,
                        fallbackTimeoutId: timeoutId
                      });
                    }
                  } else {
                    console.error(`[FUNCTION-CALL] Failed to send function result for ${functionName} (callId: ${callId})`);
                  }
                } else {
                  console.error(`[FUNCTION-CALL] No connection manager available to send function result for ${functionName}`);
                }
              } else {
                console.error(`[FUNCTION-CALL] Function ${functionName} not found in registry. Available functions:`, Object.keys(currentFunctionRegistry));
                
                // Log triage function not found
                if (process.env.NEXT_PUBLIC_ENABLE_FUNCTION_EXECUTION_LOGS === 'true') {
                  console.error(`[function_execution] 🚫 TRIAGE AI FUNCTION NOT FOUND: ${functionName}`);
                  console.error(`[function_execution] Available functions:`, Object.keys(currentFunctionRegistry));
                  console.error(`[function_execution] Total functions in registry:`, Object.keys(currentFunctionRegistry).length);
                }
              }

            } catch (error) {
              console.error(`[FUNCTION-CALL] Error executing function ${functionName}:`, error);
              
              // Log triage function execution error
              if (process.env.NEXT_PUBLIC_ENABLE_FUNCTION_EXECUTION_LOGS === 'true') {
                console.error(`[function_execution] ❌ TRIAGE AI FUNCTION ERROR: ${functionName}`);
                console.error(`[function_execution] Error:`, error);
                console.error(`[function_execution] Call ID: ${callId || 'unknown'}`);
              }
            }
          },

          onAudioTranscriptDelta: (msg: Record<string, unknown>) => {
            const delta = msg.delta as string;
            const responseId = msg.response_id as string || 'unknown';
            const role = msg.role as string || 'assistant';

            // Only clear thinking state when AI assistant starts responding (not for user transcripts)
            if (role === 'assistant') {
              set(state => {
                console.log('[function] Clearing isThinking: false (RECONNECT onAudioTranscriptDelta - assistant)');
                const newState = { ...state, isThinking: false };
                console.log('[function] New state:', { isThinking: newState.isThinking });
                return newState;
              });
            } else if (role === 'user') {
              // V18: In manual VAD mode, accumulate user transcription to show what they're saying
              console.log('[V18-MANUAL-VAD] (RECONNECT) Accumulating user speech delta:', delta);
              set(state => ({
                ...state,
                userMessage: state.userMessage + delta
              }));
            } else {
              console.log('[function] Keeping thinking state - transcript is from user role (RECONNECT)');
            }

            const currentState = get();
            if (delta && currentState.transcriptCallback) {
              currentState.transcriptCallback({
                id: responseId,
                data: delta,
                metadata: { isTranscriptComplete: false, role: role }
              });
            }
          },

          onAudioTranscriptDone: (msg: Record<string, unknown>) => {
            const transcript = msg.transcript as string;
            const responseId = msg.response_id as string || 'unknown';
            const role = msg.role as string || 'assistant';

            const currentState = get();
            if (transcript && currentState.transcriptCallback) {
              currentState.transcriptCallback({
                id: responseId,
                data: transcript,
                metadata: { isTranscriptComplete: true, role: role }
              });
            }
          },

          onAudioDelta: (msg: Record<string, unknown>) => {
            // Handle audio chunks for playback
            const delta = msg.delta as string;
            const responseId = msg.response_id as string;

            if (delta && responseId) {
              // Audio playback will be handled by existing audio service
            }
          },

          onAudioDone: () => {
            console.log('[FUNCTION-RECONNECT] Response audio done - starting volume monitoring');

            // Clear thinking state when AI finishes generating audio
            set(state => {
              console.log('[function] Clearing isThinking: false (RECONNECT onAudioDone)');
              const newState = { ...state, isThinking: false };
              console.log('[function] New state:', { isThinking: newState.isThinking });
              return newState;
            });

            const currentState = get();

            if (currentState.waitingForEndSession) {
              console.log('[FUNCTION-RECONNECT] Starting volume monitoring for END SESSION');

              const endSessionCallback = () => {
                console.log('[END-SESSION-DEBUG] 🔍 END SESSION CALLBACK EXECUTING - starting 2-second grace period');

                // Add 2-second grace period before disconnecting
                setTimeout(() => {
                  console.log('[END-SESSION-DEBUG] 🔚 Grace period complete - disconnecting session');

                  const state = get();

                  if (state.fallbackTimeoutId) {
                    clearTimeout(state.fallbackTimeoutId);
                  }

                  set({
                    waitingForEndSession: false,
                    endSessionCallId: null,
                    expectingEndSessionGoodbye: false,
                    volumeMonitoringActive: false,
                    fallbackTimeoutId: null
                  });

                  get().disconnect();
                }, 2000);
              };

              startSilenceDetection(endSessionCallback, get);
            } else {
              console.log('[FUNCTION-RECONNECT] Starting silence detection for REGULAR CONVERSATION');

              const regularCallback = () => {
                console.log('[FUNCTION-RECONNECT] Regular conversation silence detection complete');
              };

              startSilenceDetection(regularCallback, get);
            }
          },

          onResponseDone: (msg: Record<string, unknown>) => {
            console.log('[FUNCTION-RECONNECT] Response completed');

            // Don't clear thinking state here - wait for actual speech
            // Thinking state persists through function calls

            const currentState = get();

            // V16 HANDOFF: Check for pending handoff in RECONNECT handler too
            if (currentState.pendingHandoff) {
              console.log(`[triageAI][handoff] 🎯 [RECONNECT] AI response complete - dispatching pending handoff to ${currentState.pendingHandoff.specialistType}`);

              const handoffEvent = new CustomEvent('specialist_handoff', {
                detail: {
                  specialistType: currentState.pendingHandoff.specialistType,
                  contextSummary: currentState.pendingHandoff.contextSummary,
                  conversationId: currentState.pendingHandoff.conversationId,
                  reason: currentState.pendingHandoff.reason,
                  urgencyLevel: currentState.pendingHandoff.urgencyLevel
                }
              });

              window.dispatchEvent(handoffEvent);
              console.log(`[triageAI][handoff] ✅ [RECONNECT] Handoff event dispatched successfully`);
              set({ pendingHandoff: null });
            }

            if (currentState.expectingEndSessionGoodbye) {
              const response = msg.response as Record<string, unknown> | undefined;
              const hasContent = response && response.status === 'completed';

              if (hasContent) {
                set({
                  expectingEndSessionGoodbye: false,
                  waitingForEndSession: true
                });
              }
            }
          },

          onError: (error: Error) => {
            console.error('[FUNCTION-RECONNECT] Message handler error:', error);

            const currentState = get();
            if (currentState.errorCallback) {
              currentState.errorCallback(error);
            }
          }
        };

        const messageHandler = new ComprehensiveMessageHandler(messageCallbacks);

        // Subscribe to connection messages
        connectionManager.onMessage(async (event) => {
          if (messageHandler) {
            await messageHandler.handleMessage(event);
          }
        });

        // Subscribe to connection errors
        connectionManager.onError((error) => {
          console.error('[FUNCTION-RECONNECT] Connection error:', error);

          const currentState = get();
          if (currentState.errorCallback) {
            currentState.errorCallback(error);
          }
        });

        // Re-register enhanced audio stream handler for reconnection
        connectionManager.onAudioStream((stream) => {
          console.log('[V15-ORB-DEBUG] Zustand store onAudioStream callback triggered (reconnection):', {
            streamId: stream.id,
            trackCount: stream.getTracks().length,
            audioTracks: stream.getAudioTracks().length,
            streamActive: stream.active,
            tracks: stream.getTracks().map(track => ({
              id: track.id,
              kind: track.kind,
              enabled: track.enabled,
              readyState: track.readyState
            })),
            timestamp: Date.now()
          });

          optimizedAudioLogger.info('webrtc', 'audio_stream_connected_reconnection', {
            streamId: stream.id,
            trackCount: stream.getTracks().length,
            audioTracks: stream.getAudioTracks().length
          });

          // Create audio element with stable event handlers
          const audioElement = document.createElement('audio');
          audioElement.srcObject = stream;
          audioElement.autoplay = true;
          audioElement.volume = 1.0;
          audioElement.style.display = 'none';
          audioElement.id = `zustand-audio-reconnect-${stream.id}`;

          console.log('[V15-ORB-DEBUG] Audio element created in Zustand store (reconnection):', {
            elementId: audioElement.id,
            srcObject: !!audioElement.srcObject,
            autoplay: audioElement.autoplay,
            volume: audioElement.volume,
            streamId: stream.id
          });

          // Real-time volume monitoring setup (same as main handler)
          let audioContext: AudioContext | null = null;
          let analyser: AnalyserNode | null = null;
          let volumeMonitoringInterval: number | null = null;

          const setupVolumeMonitoring = () => {
            console.log('[V15-ORB-DEBUG] setupVolumeMonitoring called for element (reconnection):', audioElement.id);
            try {
              audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
              analyser = audioContext.createAnalyser();

              console.log('[V15-ORB-DEBUG] AudioContext created (reconnection):', {
                contextState: audioContext.state,
                sampleRate: audioContext.sampleRate,
                elementId: audioElement.id
              });

              // CRITICAL V15 FIX: Use createMediaStreamSource for WebRTC streams, NOT createMediaElementSource
              // createMediaElementSource() only works with HTML audio elements playing files/URLs
              // createMediaStreamSource() works with live WebRTC MediaStreams from OpenAI Realtime API
              // This is the core fix for V15 silence detection - we must monitor the WebRTC stream directly
              const source = audioContext.createMediaStreamSource(stream);
              source.connect(analyser);
              // Note: Do NOT connect to destination as that would cause audio to play twice
              // The audio element already handles playback, we only need volume monitoring

              analyser.fftSize = 256;
              const bufferLength = analyser.frequencyBinCount;
              const dataArray = new Uint8Array(bufferLength);

              console.log('[V15-ORB-DEBUG] Volume monitoring setup complete (reconnection):', {
                fftSize: analyser.fftSize,
                bufferLength: bufferLength,
                audioContextState: audioContext.state,
                elementId: audioElement.id,
                sourceConnected: true
              });

              // Volume monitoring state tracking (reconnection)
              let lastLogTime = 0;

              // Start optimized volume monitoring loop (reconnection)
              volumeMonitoringInterval = window.setInterval(() => {
                if (!analyser) return;

                const currentState = get();

                // Continue monitoring during all states - let actual audio levels determine values

                analyser.getByteFrequencyData(dataArray);

                // Calculate RMS (Root Mean Square) for volume
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                  sum += dataArray[i] * dataArray[i];
                }
                const rms = Math.sqrt(sum / bufferLength);
                const normalizedVolume = rms / 255; // Normalize to 0-1
                const audioLevel = Math.floor(rms); // Keep original scale for compatibility
                const isAudioPlaying = rms > 10; // Threshold for detecting audio activity

                // STATE CHANGE DETECTION: Only update if values actually changed
                const volumeChanged = Math.abs(currentState.currentVolume - normalizedVolume) > 0.01;
                const levelChanged = Math.abs(currentState.audioLevel - audioLevel) > 1;
                const playingChanged = currentState.isAudioPlaying !== isAudioPlaying;

                if (volumeChanged || levelChanged || playingChanged) {
                  // REDUCED LOGGING: Only log during audio activity or every 2 seconds during silence
                  const now = Date.now();
                  const shouldLog = isAudioPlaying || (now - lastLogTime > 2000);

                  if (shouldLog) {
                    console.log('[V15-VOLUME-RECONNECT] Audio state change:', {
                      rms: rms.toFixed(2),
                      normalizedVolume: normalizedVolume.toFixed(4),
                      audioLevel: audioLevel,
                      isAudioPlaying: isAudioPlaying,
                      changes: { volumeChanged, levelChanged, playingChanged }
                    });
                    lastLogTime = now;
                  }

                  // Update store only when values actually change
                  set(state => ({
                    ...state,
                    currentVolume: normalizedVolume,
                    audioLevel: audioLevel,
                    isAudioPlaying: isAudioPlaying
                  }));
                }
              }, 100); // Reduced to 10fps - still smooth but less intensive

              console.log('[zustand-webrtc] ✅ Real-time volume monitoring started (reconnection)');
            } catch (error) {
              console.error('[zustand-webrtc] ❌ Failed to setup volume monitoring (reconnection):', error);
            }
          };

          audioElement.onplay = () => {
            console.log('[V15-ORB-DEBUG] Zustand audio element onplay event (reconnection):', {
              elementId: audioElement.id,
              streamId: stream.id,
              currentTime: audioElement.currentTime,
              duration: audioElement.duration,
              paused: audioElement.paused,
              readyState: audioElement.readyState
            });
            optimizedAudioLogger.audioPlayback('started', stream.id);
            setupVolumeMonitoring();
            set(state => ({ ...state, isAudioPlaying: true }));
          };

          audioElement.onended = () => {
            optimizedAudioLogger.audioPlayback('ended', stream.id);
            set(state => ({ ...state, isAudioPlaying: false, currentVolume: 0, audioLevel: 0 }));
            if (volumeMonitoringInterval) {
              clearInterval(volumeMonitoringInterval);
              volumeMonitoringInterval = null;
            }
          };

          audioElement.onpause = () => {
            set(state => ({ ...state, isAudioPlaying: false, currentVolume: 0, audioLevel: 0 }));
            if (volumeMonitoringInterval) {
              clearInterval(volumeMonitoringInterval);
              volumeMonitoringInterval = null;
            }
          };

          audioElement.onerror = (error) => {
            console.log('[V15-ORB-DEBUG] Zustand audio element error (reconnection):', {
              elementId: audioElement.id,
              streamId: stream.id,
              error: error
            });
            optimizedAudioLogger.error('webrtc', 'audio_element_error', new Error(`Audio element error: ${error}`));
            set(state => ({ ...state, isAudioPlaying: false, currentVolume: 0, audioLevel: 0 }));
          };

          document.body.appendChild(audioElement);

          console.log('[V15-ORB-DEBUG] Audio element appended to DOM (reconnection):', {
            elementId: audioElement.id,
            parentNode: !!audioElement.parentNode,
            inDOM: document.contains(audioElement),
            streamId: stream.id
          });

          stream.getTracks().forEach(track => {
            track.onended = () => {
              optimizedAudioLogger.info('webrtc', 'audio_track_ended', { trackId: track.id });
              if (volumeMonitoringInterval) {
                clearInterval(volumeMonitoringInterval);
                volumeMonitoringInterval = null;
              }
              if (audioElement.parentNode) {
                document.body.removeChild(audioElement);
              }
              set(state => ({ ...state, isAudioPlaying: false, currentVolume: 0, audioLevel: 0 }));
            };
          });
        });

        // Store the new connection manager AND message handler
        set({ connectionManager, messageHandler });

        console.log('[FUNCTION-RECONNECT] Connection manager recreated successfully with stored config');
      }

      // Add detailed logging for resource reset debugging
      const logResourceReset = (message: string, ...args: unknown[]) => {
        if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_RESET_LOGS === 'true') {
          console.log(`[resource_reset] ${message}`, ...args);
        }
      };

      logResourceReset('🔌 STORE CONNECT: Function called', {
        hasConnectionManager: !!connectionManager,
        connectionManagerState: connectionManager?.getState(),
        storeConnectionState: get().connectionState,
        storedConfigExists: !!get().storedConnectionConfig,
        callStack: new Error().stack?.split('\n')[1]?.trim()
      });

      optimizedAudioLogger.logUserAction('connect_requested', {
        currentState: get().connectionState,
        isReconnection: false
      });

      try {
        logResourceReset('🔌 STORE CONNECT: About to call connectionManager.connect()', {
          connectionManagerState: connectionManager.getState(),
          connectionManagerExists: !!connectionManager
        });

        await connectionManager.connect();

        logResourceReset('🔌 STORE CONNECT: connectionManager.connect() completed successfully', {
          newConnectionManagerState: connectionManager.getState(),
          newStoreState: {
            isConnected: get().isConnected,
            connectionState: get().connectionState,
            isPreparing: get().isPreparing
          }
        });

        // V18: Start monitoring user's microphone input for audio wave animation
        const micStream = connectionManager.getAudioInputStream();
        if (micStream) {
          get().startMicrophoneMonitoring(micStream);
        }

        optimizedAudioLogger.logUserAction('connect_succeeded');
      } catch (error) {
        logResourceReset('🔌 STORE CONNECT: connectionManager.connect() failed', { 
          error: error instanceof Error ? error.message : error,
          errorStack: error instanceof Error ? error.stack : 'No stack'
        });

        optimizedAudioLogger.error('webrtc', 'connect_failed', error as Error);
        throw error;
      }
    },

    // Disconnect action
    disconnect: async () => {
      console.log('[END-SESSION-DEBUG] 🔚 DISCONNECT METHOD CALLED - starting disconnect sequence');
      const disconnectStartTime = Date.now();

      const currentState = get();
      const { connectionManager, conversation, userMessage, hasActiveConversation } = currentState;

      console.log(`[END-SESSION-DEBUG] 🔍 Pre-disconnect state: connected=${currentState.isConnected}, hasConversation=${hasActiveConversation}, conversationLength=${conversation.length}, waiting=${currentState.waitingForEndSession}`);

      // Check for any active silence detection that might interfere
      if (silenceDetector.isActive) {
        console.log('[END-SESSION-DEBUG] 🛑 Stopping active silence detection during disconnect');
        stopSilenceDetection();
      }

      // IMMEDIATE RESET: Don't wait for WebRTC state change - manual disconnect should reset immediately
      if (hasActiveConversation && conversation.length > 0) {
        console.log('[END-SESSION-DEBUG] 🔄 MANUAL DISCONNECT - Resetting conversation immediately');
        console.log(`[END-SESSION-DEBUG] 📝 Conversation length before reset: ${conversation.length}`);
        console.log(`[END-SESSION-DEBUG] 📝 User message before reset: ${userMessage.length > 0 ? `"${userMessage}"` : 'empty'}`);

        // MEMORY SYSTEM: Trigger automatic conversation processing for completed conversation
        const finalConversationId = currentState.conversationId;
        if (finalConversationId && conversation.length >= 2) { // Only process if there's meaningful conversation
          console.log('[memory] Triggering automatic conversation processing for completed conversation:', finalConversationId);

          // Get current user ID (authenticated or anonymous)
          let userId: string | null = null;

          // Try to get authenticated user ID first
          if (typeof localStorage !== 'undefined') {
            userId = localStorage.getItem('userId');
          }

          // If no authenticated user, try anonymous session ID
          if (!userId && typeof localStorage !== 'undefined') {
            userId = localStorage.getItem('anonymousSessionId');
          }

          if (userId) {
            console.log('[memory] Processing conversation for user:', userId, 'conversation:', finalConversationId);

            // Trigger V16 memory job creation (don't await to avoid blocking disconnect)
            fetch('/api/v16/memory-jobs/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId,
              }),
            })
              .then(async response => {
                if (response.ok) {
                  console.log('[memory] V16 memory job creation initiated successfully');
                  const data = await response.json().catch(() => null);
                  if (data && data.success && data.job) {
                    console.log(`[memory] Created V16 memory job ${data.job.id} for user ${userId}`);
                    console.log(`[memory] Job will process ${data.job.totalConversations} conversations asynchronously`);
                  } else {
                    console.warn('[memory] V16 job creation succeeded but response format unexpected:', data);
                  }
                } else {
                  console.warn('[memory] V16 memory job creation failed:', response.status);
                  // Less intrusive error handling - just log, don't alert user
                  console.warn(`[memory] Failed to create V16 memory job for conversation ${finalConversationId}, user: ${userId}`);
                }
              })
              .catch(error => {
                console.warn('[memory] Error creating V16 memory job:', error);
                console.warn(`[memory] V16 memory job creation error for conversation ${finalConversationId}, user ${userId}:`, error.message || error);
              });
          } else {
            console.log('[memory] No user ID found - skipping conversation processing');
          }
        } else {
          console.log('[memory] Skipping conversation processing:', {
            hasConversationId: !!finalConversationId,
            conversationLength: conversation.length,
            minLengthRequired: 2
          });
        }

        // Reset conversation and session state immediately
        set({
          conversation: [],
          hasActiveConversation: false,
          userMessage: '',
          conversationId: null,
          expectingEndSessionGoodbye: false,
          waitingForEndSession: false,
          endSessionCallId: null,
          // Update connection state immediately too
          isConnected: false,
          connectionState: 'disconnected',
          // Reset mute state to default
          isMuted: true
        });

        console.log('[END-SESSION-DEBUG] ✅ Immediate reset complete - conversation cleared');
        console.log(`[END-SESSION-DEBUG] ⏱️ Reset completed in ${Date.now() - disconnectStartTime}ms`);

        optimizedAudioLogger.info('webrtc', 'manual_disconnect_conversation_reset', {
          conversationLength: conversation.length,
          hadUserMessage: userMessage.length > 0,
          resetMethod: 'immediate_manual_reset',
          resetDuration: Date.now() - disconnectStartTime
        });
      }

      if (!connectionManager) {
        console.log('[END-SESSION-DEBUG] ❌ No connection manager - but conversation already reset');
        console.log(`[END-SESSION-DEBUG] ⏱️ Total disconnect time: ${Date.now() - disconnectStartTime}ms`);
        return;
      }

      console.log('[END-SESSION-DEBUG] 🔌 Connection manager exists, proceeding with WebRTC disconnect');
      optimizedAudioLogger.logUserAction('disconnect_requested');

      try {
        console.log('[END-SESSION-DEBUG] 📞 Calling connectionManager.disconnect()');
        const webrtcDisconnectStart = Date.now();
        await connectionManager.disconnect();
        console.log(`[END-SESSION-DEBUG] 📞 connectionManager.disconnect() completed in ${Date.now() - webrtcDisconnectStart}ms`);

        console.log('[END-SESSION-DEBUG] 🧹 Clearing audio service state');
        const audioServiceClearStart = Date.now();
        // Clear audio state
        audioService.clearAll();
        console.log(`[END-SESSION-DEBUG] 🧹 Audio service cleared in ${Date.now() - audioServiceClearStart}ms`);

        console.log(`[END-SESSION-DEBUG] ✅ WebRTC disconnect completed successfully - SESSION ENDED (total time: ${Date.now() - disconnectStartTime}ms)`);
        optimizedAudioLogger.logUserAction('disconnect_succeeded');
      } catch (error) {
        console.log(`[END-SESSION-DEBUG] ❌ WebRTC disconnect failed after ${Date.now() - disconnectStartTime}ms:`, error);
        optimizedAudioLogger.error('webrtc', 'disconnect_failed', error as Error);
        throw error;
      }
    },

    // Send message action
    sendMessage: (message: string): boolean => {
      console.log('[systemInstructions] USER MESSAGE: Attempting to send message:', message);

      const { connectionManager } = get();
      if (!connectionManager) {
        console.log('[systemInstructions] USER MESSAGE: ❌ Connection manager not initialized');
        optimizedAudioLogger.error('webrtc', 'send_message_failed', new Error('Connection manager not initialized'));
        return false;
      }

      const success = connectionManager.sendMessage(message);
      console.log('[systemInstructions] USER MESSAGE: Send result:', success);

      if (success) {
        // Mark that we have an active conversation
        set({ hasActiveConversation: true });
      }

      return success;
    },

    // V18: Manually commit audio buffer for push-to-talk mode
    commitAudioBuffer: (): boolean => {
      const { connectionManager } = get();
      if (!connectionManager) {
        optimizedAudioLogger.error('webrtc', 'commit_audio_buffer_failed', new Error('Connection manager not initialized'));
        return false;
      }

      return connectionManager.commitInputAudioBuffer();
    },

    // V18: Manually trigger AI response for push-to-talk mode
    createResponse: (): boolean => {
      const { connectionManager } = get();
      if (!connectionManager) {
        optimizedAudioLogger.error('webrtc', 'create_response_failed', new Error('Connection manager not initialized'));
        return false;
      }

      return connectionManager.createResponse();
    },

    // Toggle mute action - implements V11-style mute functionality
    toggleMute: (): boolean => {
      const currentState = get();
      const { connectionManager, isMuted } = currentState;

      if (!connectionManager) {
        optimizedAudioLogger.warn('webrtc', 'toggle_mute_no_connection', {
          currentMuteState: isMuted,
          hasConnectionManager: false
        });
        return isMuted; // Return current state if no connection manager
      }

      // Use connection manager's toggle mute functionality
      const newMutedState = connectionManager.toggleMute();

      // Update store state
      set({ isMuted: newMutedState });

      return newMutedState;
    },

    // Toggle audio output mute action - controls speaker volume
    toggleAudioOutputMute: (): boolean => {
      const currentState = get();
      const { isAudioOutputMuted } = currentState;

      const newMutedState = !isAudioOutputMuted;

      // iOS-compatible mute implementation using .muted property
      // NOTE: iOS Safari ignores audioElement.volume changes, but respects .muted
      // See docs/audio_out_muting.md for rollback instructions
      const audioElement = document.querySelector('audio') as HTMLAudioElement;
      if (audioElement) {
        audioElement.muted = newMutedState; // ✅ Works on iOS Safari
        audioElement.volume = newMutedState ? 0 : 1; // ✅ Fallback for other browsers
      }

      // ROLLBACK: To revert to original approach, replace above with:
      // audioElement.volume = newMutedState ? 0 : 1;

      // Update store state
      set({ isAudioOutputMuted: newMutedState });

      return newMutedState;
    },

    // V18: Monitor user's microphone input for audio wave animation
    startMicrophoneMonitoring: (stream: MediaStream) => {
      const state = get();
      if (state.micMonitoringActive) {
        return;
      }

      if (!stream) {
        return;
      }

      try {
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        let animationFrameId: number;

        const analyze = () => {
          if (!get().isConnected) {
            cancelAnimationFrame(animationFrameId);
            audioContext.close();
            set({ micMonitoringActive: false, userAudioLevel: 0, isUserSpeaking: false });
            return;
          }

          analyser.getByteFrequencyData(dataArray);

          // Calculate RMS (Root Mean Square) for volume
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i] * dataArray[i];
          }
          const rms = Math.sqrt(sum / bufferLength);
          const normalizedLevel = rms / 255; // 0-1 normalized
          const isSpeaking = rms > 15; // Threshold for detecting speech

          // Only update if changed significantly
          const currentState = get();
          const levelChanged = Math.abs(currentState.userAudioLevel - normalizedLevel) > 0.01;
          const speakingChanged = currentState.isUserSpeaking !== isSpeaking;

          if (levelChanged || speakingChanged) {
            set({
              userAudioLevel: normalizedLevel,
              isUserSpeaking: isSpeaking
            });
          }

          animationFrameId = requestAnimationFrame(analyze);
        };

        set({ micMonitoringActive: true });
        analyze();
      } catch (error) {
        console.error('[V18-MIC-MONITOR] Failed to setup monitoring:', error);
        set({ micMonitoringActive: false });
      }
    },

    // Add conversation message
    addConversationMessage: (message: ConversationMessage) => {
      console.log('[message_persistence] [CONTENT_DEBUG] Adding message to conversation:', {
        id: message.id,
        role: message.role,
        textLength: message.text.length,
        textPreview: message.text.substring(0, 100) + (message.text.length > 100 ? '...' : ''),
        fullText: message.text,
        isFinal: message.isFinal,
        status: message.status
      });

      set(state => ({
        conversation: [...state.conversation, message],
        hasActiveConversation: true
      }));

      // Only save final messages to Supabase - streaming messages are UI-only
      if (message.isFinal) {
        console.log('[message_persistence] Message is final, saving to Supabase');
        const currentState = get();
        currentState.saveMessageToSupabase(message).catch(error => {
          console.error('[message_persistence] Failed to save message to Supabase:', error);
          // Don't break the conversation flow on save errors
        });
      } else {
        console.log('[message_persistence] Message is streaming/incomplete, skipping Supabase save');
      }
    },

    // Save message to Supabase
    saveMessageToSupabase: async (message: ConversationMessage) => {
      const logPrefix = '[message_persistence]';

      try {
        // Get required data from localStorage
        let userId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') : null;
        const bookId = typeof localStorage !== 'undefined' ? localStorage.getItem('selectedBookId') : null;

        // V15 GREENFIELD: Handle anonymous users by generating a session-based ID
        if (!userId) {
          // Generate or retrieve anonymous user ID for this session
          let anonymousUserId = typeof localStorage !== 'undefined' ? localStorage.getItem('anonymousUserId') : null;
          if (!anonymousUserId) {
            anonymousUserId = `anonymous-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('anonymousUserId', anonymousUserId);
            }
            console.log(`${logPrefix} Generated anonymous user ID: ${anonymousUserId}`);
            console.log(`${logPrefix} Anonymous conversations will be persisted but won't sync across devices`);
          }
          userId = anonymousUserId;
        }

        if (!bookId) {
          console.warn(`${logPrefix} Missing bookId, skipping message save`);
          return;
        }

        // Ensure we have a conversation ID
        const currentState = get();
        let conversationId = currentState.conversationId;

        if (!conversationId) {
          console.log(`${logPrefix} No conversation ID, creating new conversation`);
          conversationId = await currentState.createConversation();
          if (!conversationId) {
            throw new Error('Failed to create conversation');
          }
          set({ conversationId });
          // CRITICAL: Sync with localStorage for V16 handoff compatibility
          // This prevents UUID format errors during specialist handoffs
          // V16 handoff functions check localStorage for conversation ID
          // WITHOUT this sync, handoffs create new fake IDs and fail database operations
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('currentConversationId', conversationId);
          }
        }

        // Get current specialist from triage session for V16 specialist tracking
        const storeState = get();
        const currentSpecialist = storeState.triageSession.currentSpecialist;

        // Only log final assistant messages to reduce noise
        if (message.role === 'assistant' && message.isFinal) {
          logSpecialistTracking('💾 Saving assistant message', {
            messageId: message.id,
            specialist: currentSpecialist,
            messageText: message.text.substring(0, 30) + '...'
          });
        }

        // Use V16 save-message API with specialist tracking
        const requestData = {
          userId,
          bookId,
          message,
          conversationId,
          specialist: currentSpecialist
        };

        console.log(`${logPrefix} [CONTENT_DEBUG] Preparing request data with message:`, {
          messageId: message.id,
          messageRole: message.role,
          messageTextLength: message.text.length,
          messageTextPreview: message.text.substring(0, 100) + (message.text.length > 100 ? '...' : ''),
          messageTextFull: message.text,
          conversationId,
          userId,
          bookId,
          specialist: currentSpecialist
        });
        console.log(`${logPrefix} Sending request data to V16 API with specialist tracking:`, requestData);

        const response = await fetch('/api/v16/save-message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData)
        });

        console.log(`${logPrefix} Response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          console.error(`${logPrefix} HTTP error: ${response.status} ${response.statusText}`);
          const errorText = await response.text();
          console.error(`${logPrefix} Error response body:`, errorText);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        console.log(`${logPrefix} API response:`, result);

        if (!result.success) {
          console.error(`${logPrefix} API returned error:`, result.error);
          console.error(`${logPrefix} Full response:`, result);
          throw new Error(result.error || 'Save message failed');
        }

        console.log(`${logPrefix} Successfully saved message to conversation: ${result.conversationId}`);
      } catch (error) {
        console.error(`${logPrefix} Error saving message:`, error);
        throw error;
      }
    },

    // Create conversation
    // CRITICAL: This is the ONLY proper way to create conversation IDs
    // Returns database-generated UUIDs, not client-side strings
    // Used by both V15 and V16 - do NOT create separate conversation creation methods
    createConversation: async () => {
      const logPrefix = '[message_persistence]';

      try {
        let userId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') : null;

        // V15 GREENFIELD: Handle anonymous users by generating a session-based ID
        if (!userId) {
          // Generate or retrieve anonymous user ID for this session
          let anonymousUserId = typeof localStorage !== 'undefined' ? localStorage.getItem('anonymousUserId') : null;
          if (!anonymousUserId) {
            anonymousUserId = `anonymous-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('anonymousUserId', anonymousUserId);
            }
            console.log(`${logPrefix} Generated anonymous user ID for conversation: ${anonymousUserId}`);
            console.log(`${logPrefix} Anonymous conversations will be persisted but won't sync across devices`);
          }
          userId = anonymousUserId;
        }

        console.log(`${logPrefix} Creating new conversation for user: ${userId}`);

        const response = await fetch('/api/v16/create-conversation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId })
        });

        const result = await response.json();

        console.log(`${logPrefix} Create conversation API response:`, result);

        if (!result.success) {
          console.error(`${logPrefix} Create conversation failed:`, result.error);
          throw new Error(result.error || 'Create conversation failed');
        }

        console.log(`${logPrefix} Successfully created conversation: ${result.conversationId}`);

        // Generate access code for this conversation (creates new patient_intake record)
        console.log(`${logPrefix} 🔑 Generating access code for conversation: ${result.conversationId}, user: ${userId}`);
        try {
          const accessCodeResponse = await fetch('/api/v17/generate-access-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId: result.conversationId, userId })
          });

          if (!accessCodeResponse.ok) {
            const errorData = await accessCodeResponse.json();
            console.error(`${logPrefix} ⚠️ Failed to generate access code`, {
              status: accessCodeResponse.status,
              error: errorData
            });
          } else {
            const { accessCode } = await accessCodeResponse.json();
            console.log(`${logPrefix} ✅ Access code generated and stored in patient_intake:`, accessCode);
            console.log(`${logPrefix} 🎉 NEW ACCESS CODE:`, accessCode); // Always visible
          }
        } catch (error) {
          console.error(`${logPrefix} ⚠️ Access code generation exception:`, error);
        }

        return result.conversationId;
      } catch (error) {
        console.error(`${logPrefix} Error creating conversation:`, error);
        return null;
      }
    },

    // Clear anonymous session data (call when user signs in)
    clearAnonymousSession: () => {
      const logPrefix = '[message_persistence]';

      if (typeof localStorage !== 'undefined') {
        const anonymousUserId = localStorage.getItem('anonymousUserId');
        if (anonymousUserId) {
          localStorage.removeItem('anonymousUserId');
          console.log(`${logPrefix} Cleared anonymous user session: ${anonymousUserId}`);
        }
      }

      // Reset conversation ID so a new conversation is created for the authenticated user
      set({ conversationId: null });
    },

    // Update user message
    updateUserMessage: (message: string) => {
      set({ userMessage: message });
    },

    // Clear user message
    clearUserMessage: () => {
      set({ userMessage: '' });
    },

    // Set conversation ID (for resuming conversations)
    setConversationId: (id: string | null) => {
      set({ conversationId: id });
      // CRITICAL: Sync with localStorage for V16 handoff compatibility
      // This is essential for conversation resume and specialist handoffs
      // V16 handoff system relies on localStorage.getItem('currentConversationId')
      // WITHOUT this sync, V16 will generate fake conversation IDs during handoffs
      if (typeof localStorage !== 'undefined') {
        if (id) {
          localStorage.setItem('currentConversationId', id);
        } else {
          localStorage.removeItem('currentConversationId');
        }
      }
    },

    // Smart Send actions
    setSmartSendEnabled: (enabled: boolean) => {
      if (process.env.NEXT_PUBLIC_ENABLE_SMART_SEND_LOGS === 'true') {
        console.log('[smart_send] 🏪 ZUSTAND: setSmartSendEnabled called', {
          from: get().smartSendEnabled,
          to: enabled,
          timestamp: new Date().toISOString()
        });
      }
      set({ smartSendEnabled: enabled });
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('smartSendEnabled', enabled.toString());
      }
    },

    appendToMessageBuffer: (text: string) => {
      const currentBuffer = get().messageBuffer;
      const newBuffer = currentBuffer ? `${currentBuffer} ${text.trim()}` : text.trim();
      if (process.env.NEXT_PUBLIC_ENABLE_SMART_SEND_LOGS === 'true') {
        console.log('[smart_send] 🏪 ZUSTAND: appendToMessageBuffer called', {
          currentBuffer,
          appendText: text.trim(),
          newBuffer,
          bufferLength: newBuffer.length,
          timestamp: new Date().toISOString()
        });
      }
      set({ messageBuffer: newBuffer });
    },

    clearMessageBuffer: () => {
      const currentBuffer = get().messageBuffer;
      if (process.env.NEXT_PUBLIC_ENABLE_SMART_SEND_LOGS === 'true') {
        console.log('[smart_send] 🏪 ZUSTAND: clearMessageBuffer called', {
          clearedBuffer: currentBuffer,
          bufferLength: currentBuffer.length,
          timestamp: new Date().toISOString()
        });
      }
      set({ messageBuffer: '' });
    },

    // V16 Triage session actions
    setTriageSession: (session: TriageSession) => {
      console.log('[triageAI] 🏪 ZUSTAND: setTriageSession called', {
        from: get().triageSession.currentSpecialist,
        to: session.currentSpecialist,
        timestamp: new Date().toISOString()
      });
      set({ triageSession: session });
    },

    updateTriageSession: (updates: Partial<TriageSession>) => {
      const currentSession = get().triageSession;
      const newSession = { ...currentSession, ...updates };
      console.log('[triageAI] 🏪 ZUSTAND: updateTriageSession called', {
        from: currentSession.currentSpecialist,
        to: newSession.currentSpecialist,
        updates,
        timestamp: new Date().toISOString()
      });
      set({ triageSession: newSession });
    },

    // V16 Resource context actions implementation
    setResourceContext: (context: ResourceLocatorContextType) => {
      console.log('[V16-ResourceLocator] 🏪 ZUSTAND: setResourceContext called', {
        resourceTitle: context.selectedResource.title,
        resourceId: context.selectedResource.id,
        mode: context.mode,
        timestamp: new Date().toISOString()
      });
      set({ resourceContext: context });
    },

    clearResourceContext: () => {
      const currentContext = get().resourceContext;
      console.log('[V16-ResourceLocator] 🏪 ZUSTAND: clearResourceContext called', {
        hadContext: !!currentContext,
        previousResource: currentContext?.selectedResource?.title || null,
        timestamp: new Date().toISOString()
      });
      set({
        resourceContext: null,
        resourceContextAutoStarted: false,
        resourceGreeting: null
      });
    },

    setResourceContextAutoStarted: (started: boolean) => {
      console.log('[V16-ResourceLocator] 🏪 ZUSTAND: setResourceContextAutoStarted called', {
        started,
        timestamp: new Date().toISOString()
      });
      set({ resourceContextAutoStarted: started });
    },

    setResourceGreeting: (greeting: string | null) => {
      // V16 Resource Greeting Logging
      if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_GREETING_LOGS === 'true') {
        console.log('[resource_greeting] WebRTC store: setResourceGreeting called', {
          hasGreeting: !!greeting,
          greetingLength: greeting?.length || 0,
          greetingPreview: greeting?.substring(0, 200) + '...' || 'null',
          timestamp: new Date().toISOString()
        });
      }

      set({ resourceGreeting: greeting });
    },

    // V16 Handoff actions implementation
    storePendingHandoff: (handoffData) => {
      const currentState = get();
      const currentSpecialist = currentState.triageSession?.currentSpecialist || 'unknown';
      const isInterSpecialistHandoff = currentSpecialist !== 'triage' && currentSpecialist !== 'unknown';

      // Use appropriate logging based on handoff type
      if (isInterSpecialistHandoff && process.env.NEXT_PUBLIC_ENABLE_SPECIALIST_HANDOFF_LOGS === 'true') {
        console.log('[specialist_handoff] 🏪 ZUSTAND: Storing inter-specialist handoff', {
          from: currentSpecialist,
          to: handoffData.specialistType,
          conversationId: handoffData.conversationId,
          contextLength: handoffData.contextSummary.length,
          timestamp: new Date().toISOString()
        });
        console.log('[specialist_handoff] ⚠️ CRITICAL: Inter-specialist handoff detected in store');
      } else if (process.env.NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS === 'true') {
        console.log('[triage_handoff] 🏪 ZUSTAND: Storing triage handoff', {
          specialistType: handoffData.specialistType,
          conversationId: handoffData.conversationId,
          contextLength: handoffData.contextSummary.length,
          timestamp: new Date().toISOString()
        });
      }
      set({ pendingHandoff: handoffData });
    },

    clearPendingHandoff: () => {
      console.log('[triageAI][handoff] 🏪 ZUSTAND: Clearing pending handoff');
      set({ pendingHandoff: null });
    },

    // Function registration actions
    registerFunctions: (functions: { book?: unknown[]; mentalHealth?: unknown[]; sleep?: unknown[]; supabase?: unknown[] }) => {
      const currentState = get();
      const newFunctions = {
        book: functions.book || currentState.availableFunctions.book,
        mentalHealth: functions.mentalHealth || currentState.availableFunctions.mentalHealth,
        sleep: functions.sleep || currentState.availableFunctions.sleep,
        supabase: functions.supabase || currentState.availableFunctions.supabase // V16: Support Supabase functions
      };

      console.log(`[triage] ===== FUNCTION REGISTRATION =====`);
      console.log(`[triage] Registering functions to store:`, {
        book: newFunctions.book.length,
        mentalHealth: newFunctions.mentalHealth.length,
        sleep: newFunctions.sleep.length,
        supabase: newFunctions.supabase.length
      });

      console.log(`[triage] Function registration - Supabase functions: ${newFunctions.supabase.length}`);

      // Log individual function names being registered
      if (newFunctions.supabase.length > 0) {
        console.log(`[triage] Supabase function names being registered:`, (newFunctions.supabase as Array<{ name: string }>).map(f => f.name).join(', '));
      }

      set({ availableFunctions: newFunctions });
    },

    clearFunctions: () => {
      console.log(`[AI-INTERACTION] 🗑️ Clearing all functions from store`);
      set({
        availableFunctions: {
          book: [],
          mentalHealth: [],
          sleep: [],
          supabase: [] // V16: Clear Supabase functions too
        }
      });
    },

    // Replace AI configuration seamlessly (for triage handoffs)
    replaceAIConfiguration: async (newConfig: { instructions: string; tools: unknown[] }) => {
      const currentState = get();
      const currentSpecialist = currentState.triageSession?.currentSpecialist || 'unknown';
      const isInterSpecialistHandoff = currentSpecialist !== 'triage' && currentSpecialist !== 'unknown';

      // Use appropriate logging based on handoff type
      if (isInterSpecialistHandoff && process.env.NEXT_PUBLIC_ENABLE_SPECIALIST_HANDOFF_LOGS === 'true') {
        console.log(`[specialist_handoff] [WEBRTC_STORE] Starting AI configuration replacement for inter-specialist handoff`);
        console.log(`[specialist_handoff] [WEBRTC_STORE] Current specialist: ${currentSpecialist}`);
        console.log(`[specialist_handoff] [WEBRTC_STORE] Instructions length: ${newConfig.instructions.length}`);
        console.log(`[specialist_handoff] [WEBRTC_STORE] Tools count: ${newConfig.tools.length}`);
        console.log(`[specialist_handoff] ⚠️ Using session.update API - no WebRTC disconnect`);
      } else if (process.env.NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS === 'true') {
        console.log(`[triage_handoff] [WEBRTC_STORE] Starting AI configuration replacement`);
        console.log(`[triage_handoff] [WEBRTC_STORE] Instructions length: ${newConfig.instructions.length}`);
        console.log(`[triage_handoff] [WEBRTC_STORE] Tools count: ${newConfig.tools.length}`);
      }

      if (!currentState.connectionManager) {
        throw new Error('CRITICAL: Connection manager not available during AI configuration replacement - WebRTC connection may be broken');
      }

      const success = await currentState.connectionManager.replaceAIConfiguration(newConfig);

      if (!success) {
        throw new Error('CRITICAL: AI configuration replacement failed - OpenAI rejected session.update or WebRTC data channel is unavailable');
      }

      // Update store with new function definitions
      if (process.env.NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS === 'true') {
        console.log(`[triage_handoff] [WEBRTC_STORE] ✅ AI configuration replaced successfully`);
        console.log(`[triage_handoff] [WEBRTC_STORE] Updating store with ${newConfig.tools.length} new functions`);
      }

      set({
        availableFunctions: {
          ...currentState.availableFunctions,
          supabase: newConfig.tools
        }
      });

      return true;
    },

    // Set preparing state
    setPreparing: (preparing: boolean) => {
      console.log(`[V16-UI-STATE] setPreparing: ${preparing}`);
      set({ isPreparing: preparing });
    },

    // Handle connection state changes (native WebRTC events)
    handleConnectionChange: (state: ConnectionState) => {
      console.log(`[END-SESSION-DEBUG] 🔍 handleConnectionChange called: ${state}`);
      const currentState = get();
      const wasConnected = currentState.isConnected;
      const isNowConnected = state === 'connected';

      console.log(`[END-SESSION-DEBUG] 🔍 Connection change details: was=${currentState.connectionState}, now=${state}, wasConnected=${wasConnected}, isNowConnected=${isNowConnected}`);

      // Detect disconnect with conversation reset
      if (wasConnected && !isNowConnected && currentState.hasActiveConversation) {
        console.log('[END-SESSION-DEBUG] 🚨 DISCONNECT DETECTED in handleConnectionChange - This could be premature!');
        console.log(`[END-SESSION-DEBUG] 🚨 Current state: waiting=${currentState.waitingForEndSession}, expecting=${currentState.expectingEndSessionGoodbye}`);
        console.log(`[END-SESSION-DEBUG] 🚨 If waiting=true, this disconnect is happening too early!`);

        optimizedAudioLogger.info('webrtc', 'disconnect_detected_conversation_reset', {
          previousState: currentState.connectionState,
          newState: state,
          conversationCleared: true,
          waitingForEndSession: currentState.waitingForEndSession,
          expectingGoodbye: currentState.expectingEndSessionGoodbye
        });

        // Stop any active silence detection
        if (silenceDetector.isActive) {
          console.log('[END-SESSION-DEBUG] 🛑 Stopping silence detection due to connection change');
          stopSilenceDetection();
        }

        // Reset conversation immediately
        set({
          conversation: [],
          hasActiveConversation: false,
          userMessage: '',
          conversationId: null,
          expectingEndSessionGoodbye: false,
          waitingForEndSession: false,
          endSessionCallId: null,
          // Reset mute state to default
          isMuted: true
        });

        console.log('[END-SESSION-DEBUG] ✅ handleConnectionChange reset complete');
      }

      // Update connection state
      set({
        connectionState: state,
        isConnected: isNowConnected,
        // Set thinking state when connection is established (waiting for AI greeting)
        isThinking: state === 'connected' ? true : get().isThinking
      });

      console.log(`[END-SESSION-DEBUG] 🔍 handleConnectionChange complete: final state=${state}, connected=${isNowConnected}`);
    },

    // Handle disconnect with conversation reset
    handleDisconnectWithReset: () => {
      // Add detailed logging for resource reset debugging
      const logResourceReset = (message: string, ...args: unknown[]) => {
        if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_RESET_LOGS === 'true') {
          console.log(`[resource_reset] ${message}`, ...args);
        }
      };

      console.log('[END-SESSION-DEBUG] 🚨 handleDisconnectWithReset called - This is a manual reset!');
      logResourceReset('🔌 DISCONNECT RESET: Function called');
      
      const currentState = get();
      console.log(`[END-SESSION-DEBUG] 🚨 State before reset: waiting=${currentState.waitingForEndSession}, expecting=${currentState.expectingEndSessionGoodbye}, connected=${currentState.isConnected}`);
      
      logResourceReset('🔌 DISCONNECT RESET: State before reset', {
        storeConnected: currentState.isConnected,
        storeConnectionState: currentState.connectionState,
        hasConnectionManager: !!currentState.connectionManager,
        connectionManagerState: currentState.connectionManager?.getState(),
        conversationLength: currentState.conversation.length
      });

      // Stop any active silence detection
      if (silenceDetector.isActive) {
        console.log('[END-SESSION-DEBUG] 🛑 Stopping silence detection due to manual reset');
        stopSilenceDetection();
      }

      // IMPORTANT: Check if we need to actually disconnect the connection manager
      if (currentState.connectionManager) {
        const cmState = currentState.connectionManager.getState();
        logResourceReset('🔌 DISCONNECT RESET: ConnectionManager state before reset', { 
          connectionManagerState: cmState 
        });
        
        // If connection manager is connected/connecting, we should disconnect it
        if (cmState === 'connected' || cmState === 'connecting') {
          logResourceReset('🔌 DISCONNECT RESET: ConnectionManager is active, calling disconnect()');
          try {
            // Call disconnect on connection manager to properly clean up
            currentState.connectionManager.disconnect();
            logResourceReset('🔌 DISCONNECT RESET: ConnectionManager disconnect() called successfully');
          } catch (error) {
            logResourceReset('🔌 DISCONNECT RESET: ConnectionManager disconnect() failed', { error });
          }
        } else {
          logResourceReset('🔌 DISCONNECT RESET: ConnectionManager already disconnected, no action needed');
        }
      } else {
        logResourceReset('🔌 DISCONNECT RESET: No connectionManager to disconnect');
      }

      set({
        isConnected: false,
        connectionState: 'disconnected',
        conversation: [],
        hasActiveConversation: false,
        userMessage: '',
        conversationId: null,
        expectingEndSessionGoodbye: false,
        waitingForEndSession: false,
        endSessionCallId: null,
        // Reset mute state to default
        isMuted: true
      });

      logResourceReset('🔌 DISCONNECT RESET: Store state reset complete', {
        newStoreState: {
          isConnected: get().isConnected,
          connectionState: get().connectionState,
          conversationLength: get().conversation.length
        }
      });

      console.log('[END-SESSION-DEBUG] ✅ handleDisconnectWithReset complete');
    },

    // Subscribe to transcript events
    onTranscript: (callback) => {
      set({ transcriptCallback: callback });

      return () => {
        set({ transcriptCallback: null });
      };
    },

    // Subscribe to error events
    onError: (callback) => {
      set({ errorCallback: callback });

      return () => {
        set({ errorCallback: null });
      };
    },

    // Get diagnostics - Enhanced with V11-style diagnostic data
    getDiagnostics: () => {
      const state = get();
      const { connectionManager } = state;
      const connectionDiagnostics = connectionManager?.getDiagnostics() || {};
      const audioDiagnostics = audioService.getDiagnostics();

      return {
        timestamp: Date.now(),
        connection: connectionDiagnostics,
        audio: audioDiagnostics,

        // V11-style diagnostic data for orb compatibility
        diagnosticData: {
          isThinking: state.isThinking,
          audioLevel: state.audioLevel,
          currentVolume: state.currentVolume,
          isAudioPlaying: state.isAudioPlaying,
          connectionState: state.connectionState,
          isConnected: state.isConnected
        },

        zustandStore: {
          storeType: 'zustand',
          version: 'v15',
          enhancedVisualization: true
        },
        optimizedAudioLogger: {
          sessionId: optimizedAudioLogger.getSessionId(),
          diagnosticCount: optimizedAudioLogger.getDiagnosticData().length
        }
      };
    },

    // Get enhanced visualization data (V11 compatibility)
    getVisualizationData: () => {
      const state = get();
      return {
        currentVolume: state.currentVolume,
        audioLevel: state.audioLevel,
        isAudioPlaying: state.isAudioPlaying,
        isThinking: state.isThinking,
        connectionState: state.connectionState,
        isConnected: state.isConnected,

        // V11-style calculated values
        effectiveVolume: state.isConnected ? (state.isAudioPlaying ? state.currentVolume : 0.1) : 0,
        isActuallyPlaying: state.isAudioPlaying && state.currentVolume > 0.01,
        isAiThinking: state.connectionState === 'connecting' || state.isThinking
      };
    }
  };
});

// Function Registry Manager - Robust global registry pattern
export class FunctionRegistryManager {
  private static instance: FunctionRegistryManager;
  private registry: Record<string, (args: unknown) => Promise<unknown>> = {};
  private initialized = false;

  static getInstance(): FunctionRegistryManager {
    if (!FunctionRegistryManager.instance) {
      FunctionRegistryManager.instance = new FunctionRegistryManager();
    }
    return FunctionRegistryManager.instance;
  }

  setRegistry(functions: Record<string, (args: unknown) => Promise<unknown>>) {
    this.registry = { ...functions };
    this.initialized = true;

    // Also set on window for backward compatibility
    if (typeof window !== 'undefined') {
      (window as unknown as { webrtcFunctionRegistry?: Record<string, (args: unknown) => Promise<unknown>> }).webrtcFunctionRegistry = this.registry;
    }

    console.log('[FUNCTION-REGISTRY] Registry updated with functions:', Object.keys(this.registry));
  }

  getRegistry(): Record<string, (args: unknown) => Promise<unknown>> {
    return this.registry;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  clearAllFunctions(): void {
    const previousCount = Object.keys(this.registry).length;

    // Detect if this is an inter-specialist handoff
    let currentSpecialist = 'unknown';
    let isInterSpecialistHandoff = false;

    // Try to get current specialist from WebRTC store if available
    if (typeof window !== 'undefined' && (window as unknown as { useWebRTCStore?: { getState: () => { triageSession?: { currentSpecialist?: string } } } }).useWebRTCStore) {
      const state = (window as unknown as { useWebRTCStore: { getState: () => { triageSession?: { currentSpecialist?: string } } } }).useWebRTCStore.getState();
      currentSpecialist = state.triageSession?.currentSpecialist || 'unknown';
      isInterSpecialistHandoff = currentSpecialist !== 'triage' && currentSpecialist !== 'unknown';
    }

    this.registry = {};
    this.initialized = false;

    // Clear window registry as well for compatibility
    if (typeof window !== 'undefined') {
      (window as unknown as { webrtcFunctionRegistry?: Record<string, (args: unknown) => Promise<unknown>> }).webrtcFunctionRegistry = {};
    }

    // Use appropriate logging based on handoff type
    if (isInterSpecialistHandoff && process.env.NEXT_PUBLIC_ENABLE_SPECIALIST_HANDOFF_LOGS === 'true') {
      console.log(`[specialist_handoff] [FUNCTION_REGISTRY] 🗑️ Clearing all functions for inter-specialist handoff`);
      console.log(`[specialist_handoff] [FUNCTION_REGISTRY] Current specialist: ${currentSpecialist}`);
      console.log(`[specialist_handoff] [FUNCTION_REGISTRY] Cleared ${previousCount} functions from registry`);
      console.log(`[specialist_handoff] ⚠️ Function registry cleared for specialist transition`);
    } else if (process.env.NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS === 'true') {
      console.log(`[triage_handoff] [FUNCTION_REGISTRY] Cleared ${previousCount} functions from registry`);
    }
    console.log('[FUNCTION-REGISTRY] All functions cleared from registry');
  }
}

// V15 ARCHITECTURE: Function registration now handled at component level
// Components use hooks directly and register functions to store via registerFunctions action

console.log('[zustand-webrtc] Store created successfully');

// V16 HANDOFF: Expose store to window object for function access
if (typeof window !== 'undefined') {
  (window as unknown as { useWebRTCStore: typeof useWebRTCStore }).useWebRTCStore = useWebRTCStore;
  console.log('[zustand-webrtc] Store exposed to window.useWebRTCStore for handoff functionality');
}