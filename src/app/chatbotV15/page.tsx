"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useWebRTCStore } from '@/stores/webrtc-store';
import { useFunctionRegistration } from '@/hooksV15/use-function-registration';
import { optimizedAudioLogger } from '@/hooksV15/audio/optimized-audio-logger';
// V15-specific components
// Use enhanced V15 AudioOrbV15 component instead of direct BlueOrbVoiceUI
import { AudioOrbV15 } from './components/AudioOrbV15';
// Use V11's voice and tool choice defaults (but not hardcoded instructions)
import { DEFAULT_VOICE, DEFAULT_TOOL_CHOICE } from '../chatbotV11/prompts';
// V15 resource locator welcome message
import { getResourceWelcomeContent } from './prompts/resource-locator-welcome';
// V15 future pathways welcome message
import { getFuturePathwaysWelcomeContent } from './prompts/future-pathways-welcome';
// V15 mental health quest welcome message
import { getMentalHealthQuestWelcomeContent } from './prompts/mental-health-quest-welcome';
// Import V11's map display component for V15 to use
import MapResourcesDisplay from '../chatbotV11/MapResourcesDisplay';
// V15 CSS styles
import '../chatbotV11/chatbotV11.css';

// Conversation types (from V11 for compatibility)
interface Conversation {
  id: string; // Unique ID for React rendering and tracking
  role: string; // "user" or "assistant"
  text: string; // User or assistant message
  timestamp: string; // ISO string for message time
  isFinal: boolean; // Whether the transcription is final
  status?: "speaking" | "processing" | "final" | "thinking"; // Status for real-time conversation states
}

// Main chat component that uses the Zustand WebRTC store
function ChatBotV15Component() {
  const [mapVisible, setMapVisible] = useState(false);
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null);
  
  // Ref for auto-scrolling conversation
  const conversationHistoryRef = useRef<HTMLDivElement>(null);

  // Use stable individual selectors to prevent infinite loops
  const isConnected = useWebRTCStore(state => state.isConnected);
  const connectionState = useWebRTCStore(state => state.connectionState);
  const conversation = useWebRTCStore(state => state.conversation);
  const userMessage = useWebRTCStore(state => state.userMessage);

  // Get stable function references - these are action functions that don't change
  const connect = useWebRTCStore(state => state.connect);
  const sendMessage = useWebRTCStore(state => state.sendMessage);
  const addConversationMessage = useWebRTCStore(state => state.addConversationMessage);
  const updateUserMessage = useWebRTCStore(state => state.updateUserMessage);
  const clearUserMessage = useWebRTCStore(state => state.clearUserMessage);;

  // Register functions from hooks - this should be stable but let's track it
  const renderCount = useRef(0);
  renderCount.current++;
  // Reduced logging - only log excessive renders
  if (renderCount.current > 10 && renderCount.current % 10 === 0) {
    console.log('[zustand-webrtc] 🚨 ChatBotV15Component excessive renders: #' + renderCount.current + ' at', new Date().toISOString());
  }

  // Functions are now registered at page level to prevent scope issues

  // Subscribe to transcript events to update conversation
  useEffect(() => {
    console.log('[message_persistence] Setting up transcript subscription');

    // Map to track incomplete messages for streaming updates
    const incompleteMessages = new Map<string, Conversation>();

    const unsubscribe = useWebRTCStore.getState().onTranscript((message) => {
      console.log('[message_persistence] Transcript event received:', message);

      const { id, data, metadata } = message;
      const isComplete = metadata?.isTranscriptComplete || false;

      // Check if this is a user message (from custom role in the handler)
      const messageRole = (metadata as { role?: string })?.role || "assistant";

      if (isComplete) {
        // Final transcript - replace empty bubble or streaming version
        console.log('[message_persistence] Adding final transcript to conversation:', { data, role: messageRole });
        console.log('[message_persistence] [CONTENT_DEBUG] Final transcript content length:', data.length);
        console.log('[message_persistence] [CONTENT_DEBUG] Final transcript preview:', data.substring(0, 100) + (data.length > 100 ? '...' : ''));
        console.log('[message_persistence] [CONTENT_DEBUG] Final transcript full content:', data);

        const currentState = useWebRTCStore.getState();
        const updatedConversation = [...currentState.conversation];

        if (messageRole === "user") {
          // For user messages, find and replace the most recent user bubble (empty, "Thinking...", or streaming)
          const lastUserMessageIndex = updatedConversation.map(msg => msg.role).lastIndexOf("user");

          if (lastUserMessageIndex >= 0) {
            console.log('[message_persistence] Replacing user bubble with final transcript and saving to database');

            // Remove the existing user bubble from UI
            const filteredConversation = updatedConversation.filter((_, index) => index !== lastUserMessageIndex);
            useWebRTCStore.setState({
              conversation: filteredConversation
            });

            // Add the final complete user message (this will save to database)
            addConversationMessage({
              id: `user-final-${id}`,
              role: "user",
              text: data,
              timestamp: new Date().toISOString(),
              isFinal: true,
              status: "final"
            });
          } else {
            console.log('[message_persistence] No user bubble found, adding final message directly');
            addConversationMessage({
              id: `user-final-${id}`,
              role: "user",
              text: data,
              timestamp: new Date().toISOString(),
              isFinal: true,
              status: "final"
            });
          }
        } else {
          // For assistant messages, use existing logic
          const finalMessage: Conversation = {
            id: `${messageRole}-final-${id}`,
            role: messageRole,
            text: data,
            timestamp: new Date().toISOString(),
            isFinal: true,
            status: "final"
          };

          const existingStreamingMessage = incompleteMessages.get(id);
          if (existingStreamingMessage) {
            console.log('[message_persistence] Replacing streaming message with final version and saving to database');

            // Remove the streaming message from UI
            const filteredConversation = currentState.conversation.filter(msg => msg.id !== existingStreamingMessage.id);
            useWebRTCStore.setState({
              conversation: filteredConversation
            });

            // Add the final complete message (this will save to database)
            addConversationMessage(finalMessage);

            incompleteMessages.delete(id);
          } else {
            console.log('[message_persistence] No streaming message found, adding final message directly');
            addConversationMessage(finalMessage);
          }
        }
      } else {
        // Streaming transcript - update or create incomplete message
        console.log('[message_persistence] Updating streaming transcript:', { data, role: messageRole });

        if (messageRole === "user") {
          // For user streaming messages, find and update the existing bubble instead of creating new ones
          const currentState = useWebRTCStore.getState();
          const updatedConversation = [...currentState.conversation];
          const lastUserMessageIndex = updatedConversation.map(msg => msg.role).lastIndexOf("user");

          if (lastUserMessageIndex >= 0) {
            console.log('[message_persistence] Updating existing user bubble with streaming text');
            updatedConversation[lastUserMessageIndex] = {
              ...updatedConversation[lastUserMessageIndex],
              text: data, // Replace with streaming text (not append since user deltas are usually complete)
              status: "speaking",
              isFinal: false
            };

            useWebRTCStore.setState({
              conversation: updatedConversation
            });
          }
        } else {
          // For assistant messages, use existing streaming logic
          const existingMessage = incompleteMessages.get(id);

          if (existingMessage) {
            // Update existing incomplete message
            const updatedMessage: Conversation = {
              ...existingMessage,
              text: existingMessage.text + data,
              timestamp: new Date().toISOString()
            };

            incompleteMessages.set(id, updatedMessage);

            // Update in conversation by removing old and adding updated
            const currentState = useWebRTCStore.getState();
            const filteredConversation = currentState.conversation.filter(msg => msg.id !== existingMessage.id);

            useWebRTCStore.setState({
              conversation: [...filteredConversation, updatedMessage]
            });
          } else {
            // Create new incomplete message
            const newMessage: Conversation = {
              id: `${messageRole}-streaming-${id}`,
              role: messageRole,
              text: data,
              timestamp: new Date().toISOString(),
              isFinal: false,
              status: "speaking"
            };

            incompleteMessages.set(id, newMessage);
            addConversationMessage(newMessage);
          }
        }
      }
    });

    console.log('[message_persistence] Transcript subscription set up');

    return () => {
      console.log('[message_persistence] Cleaning up transcript subscription');
      unsubscribe();
    };
  }, [addConversationMessage]);

  // Auto-scroll to bottom when conversation changes
  useEffect(() => {
    if (conversationHistoryRef.current) {
      const scrollContainer = conversationHistoryRef.current;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [conversation]);

  // Initialize V15 page
  useEffect(() => {
    optimizedAudioLogger.info('webrtc', 'v15_page_initialized', {
      timestamp: Date.now()
    });

    return () => {
      optimizedAudioLogger.info('webrtc', 'v15_page_cleanup', {
        timestamp: Date.now()
      });
    };
  }, []);


  // Listen for map display events from mental health functions
  useEffect(() => {
    const handleDisplayResourceMap = (e: CustomEvent<{ searchId: string }>) => {
      console.log(`%c [V15-MAP-DISPLAY] 🗺️ Displaying map for search ID: ${e.detail.searchId}`, 'background: #1e3a5f; color: #32CD32; font-weight: bold; padding: 4px; border-radius: 4px;');
      optimizedAudioLogger.info('map', 'display_resource_map_triggered', {
        searchId: e.detail.searchId
      });
      setCurrentSearchId(e.detail.searchId);
      setMapVisible(true);
    };

    window.addEventListener('display_resource_map', handleDisplayResourceMap as EventListener);

    return () => {
      window.removeEventListener('display_resource_map', handleDisplayResourceMap as EventListener);
    };
  }, []);

  // V15 GREENFIELD FIX: Removed ai_end_session event listener
  // Voice-activated end session now uses the same graceful flow as button clicks
  // The end_session function returns success, AI says goodbye, WebRTC handles completion

  // REMOVED: Static orb visualization state - now using enhanced AudioOrbV15 component

  // Memoized callback for closing the map
  const handleCloseMap = useCallback(() => {
    console.log(`%c [V15-MAP-DISPLAY] 🚪 Closing map display`, 'background: #1e3a5f; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
    optimizedAudioLogger.info('map', 'map_closed_by_user');
    setMapVisible(false);
    setCurrentSearchId(null);
  }, []);

  // Handle send message - memoized to prevent recreation on every render
  const handleSendMessage = useCallback(() => {
    if (!userMessage.trim() || !isConnected) {
      return;
    }

    optimizedAudioLogger.logUserAction('message_sent', {
      messageLength: userMessage.length,
      connectionState
    });

    // Add user message to conversation immediately when typed
    const userMessageObj: Conversation = {
      id: `user-typed-${Date.now()}`,
      role: "user",
      text: userMessage,
      timestamp: new Date().toISOString(),
      isFinal: true,
      status: "final"
    };

    addConversationMessage(userMessageObj);

    const success = sendMessage(userMessage);

    if (success) {
      clearUserMessage();
    } else {
      optimizedAudioLogger.error('webrtc', 'send_message_failed', new Error('Message send failed'), {
        messageLength: userMessage.length
      });
      // Don't clear the message if sending failed, allow user to retry
    }
  }, [userMessage, isConnected, connectionState, addConversationMessage, sendMessage, clearUserMessage]);

  return (
    <div className="main-container">
      {/* Start button overlay - positioned above chatbox with higher z-index */}
      {!isConnected && (
        <div className="start-button-overlay">
          <button
            className={`control-button primary large-button rounded-full ${connectionState === 'connecting' ? 'connecting' : ''}`}
            onClick={connect}
            disabled={connectionState === 'connecting'}
            style={{ borderRadius: "9999px" }}
          >
            {connectionState === 'connecting' ? (
              <>
                <span className="spinner"></span>
                Connecting...
              </>
            ) : (
              "Let's Talk"
            )}
          </button>
        </div>
      )}

      {/* Conversation container - naturally fills available space */}
      <div className={`conversation-container ${!isConnected ? 'conversation-container-with-overlay' : ''}`} style={{ position: 'relative', zIndex: 1 }}>
        <div className="conversation-history" ref={conversationHistoryRef}>
          {conversation.map((msg) => (
            <div
              key={msg.id}
              className={`message ${msg.role} ${!msg.isFinal ? 'animate-pulse' : ''}`}
            >
              {msg.text}
              {!msg.isFinal && msg.status === 'speaking' && msg.text !== 'Thinking...' && msg.text !== 'Listening...' && (
                <div className="text-xs opacity-50 mt-1">
                  Listening...
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Text input - only show when connected */}
        {isConnected && (
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }} className="input-container">
            <input
              type="text"
              value={userMessage}
              onChange={(e) => updateUserMessage(e.target.value)}
              placeholder="Type your message..."
              className="text-input"
            />
            <button
              type="submit"
              className="send-button-new"
              disabled={!userMessage.trim()}
              aria-label="Send message"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 12h16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        )}
      </div>

      {/* Enhanced Audio visualizer with real-time volume data */}
      {isConnected && (
        <div className="visualization-container">
          <AudioOrbV15 />
        </div>
      )}

      {/* Map Resources Display - reusing V11's proven component */}
      <MapResourcesDisplay
        searchId={currentSearchId || undefined}
        visible={mapVisible}
        onClose={handleCloseMap}
      />

      {/* DIAGNOSTICS PANEL - NOT YET IMPLEMENTED
          Commented out for alpha testing to avoid mock data confusion.
          Currently shows hardcoded/fake data instead of real diagnostics.
          Will implement real diagnostics if/when performance issues arise.
          
      {showDiagnostics && (
        <DiagnosticsPanelV15
          audioState={{
            queueLength: 0,
            isPlaying: false,
            currentMessageId: null,
            lastProcessedChunk: 0,
            audioContextState: 'running',
            totalChunksProcessed: 0,
            totalPlaybackTime: 0
          }}
          connectionState={connectionState}
          diagnostics={{
            getEventHistory: () => [],
            getPerformanceMetrics: () => {
              const diagnostics = getDiagnostics();
              const connection = diagnostics.connection as Record<string, unknown>;
              return {
                connectionTime: connection.connectionDuration as number || 0,
                audioLatency: 0,
                messageProcessingTime: 0,
                memoryUsage: performance && 'memory' in performance ?
                  (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize : 0
              };
            },
            exportDiagnostics: () => JSON.stringify(getDiagnostics(), null, 2)
          }}
          onClose={() => setShowDiagnostics(false)}
        />
      )}
      */}
    </div>
  );
}

// Book interface matching the API response
interface Book {
  id: string;  // UUID format
  title: string;
  author: string;
}

// Resource locator context interface (matching V11)
interface ResourceLocatorContextType {
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

// Future pathways context interface (matching V11)
interface FuturePathwaysContextType {
  source: string;
  timestamp: number;
  mode: string;
  selectedPathway: {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    functionName: string;
    category: string;
    parameters: Record<string, unknown>;
  };
}

// Mental health quest context interface (from V11 quest data)
interface MentalHealthQuestContextType {
  id: string;
  book_id: string;
  chapter_number: number;
  chapter_title: string;
  quest_title: string;
  introduction: string;
  challenge: string;
  reward: string;
  starting_question: string;
  ai_prompt?: string;
  status?: 'not_started' | 'active' | 'completed';
  completion_date?: string | null;
}

// Main page component that initializes the Zustand WebRTC store
export default function ChatBotV15Page() {
  const { user, loading: authLoading, firebaseAvailable } = useAuth();

  // Book selection state (like V11)
  const [, setBooks] = useState<Book[]>([]);
  const [, setSelectedBook] = useState<string>("");
  const [booksLoading, setBooksLoading] = useState(true);
  const [customAIInstructions, setCustomAIInstructions] = useState<string | null>(null);
  const [greetingInstructions, setGreetingInstructions] = useState<string | null>(null);

  // Resource locator context state (matching V11)
  const [resourceLocatorContext, setResourceLocatorContext] = useState<ResourceLocatorContextType | null>(null);
  const [resourceLocatorAutoStarted, setResourceLocatorAutoStarted] = useState<boolean>(false);
  const [resourceGreeting, setResourceGreeting] = useState<string | null>(null);

  // Future pathways context state (matching V11)
  const [futurePathwaysContext, setFuturePathwaysContext] = useState<FuturePathwaysContextType | null>(null);
  const [futurePathwaysAutoStarted, setFuturePathwaysAutoStarted] = useState<boolean>(false);
  const [futurePathwaysGreeting, setFuturePathwaysGreeting] = useState<string | null>(null);

  // Mental health quest context state (from quest data)
  const [mentalHealthQuestContext, setMentalHealthQuestContext] = useState<MentalHealthQuestContextType | null>(null);
  const [mentalHealthQuestAutoStarted, setMentalHealthQuestAutoStarted] = useState<boolean>(false);
  const [mentalHealthQuestGreeting, setMentalHealthQuestGreeting] = useState<string | null>(null);

  // Get store functions
  const preInitialize = useWebRTCStore(state => state.preInitialize);
  const connect = useWebRTCStore(state => state.connect);
  const isConnected = useWebRTCStore(state => state.isConnected);
  const clearAnonymousSession = useWebRTCStore(state => state.clearAnonymousSession);

  // Register functions from hooks to store - V15 architecture
  const { functionCounts } = useFunctionRegistration();

  // Handle user authentication changes - clear anonymous session when user signs in
  useEffect(() => {
    if (user) {
      console.log('[V15-AUTH] User signed in, clearing anonymous session');
      clearAnonymousSession();

      // Store authenticated user ID in localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('userId', user.uid);
      }
    } else {
      // User signed out - remove authenticated user ID
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('userId');
      }
    }
  }, [user, clearAnonymousSession]);

  // Configuration for WebRTC store - memoized to prevent recreation
  const webRTCConfig = useMemo(() => {
    // V15 GREENFIELD: Use only global AI instructions and greeting from Supabase (no hardcoded instructions)
    // Use specialized greetings in priority order: resource > future pathways > mental health quest > default
    const effectiveGreeting = resourceGreeting || futurePathwaysGreeting || mentalHealthQuestGreeting || greetingInstructions;

    if (customAIInstructions && effectiveGreeting) {
      const greetingType = resourceGreeting ? 'resource-specific' :
        futurePathwaysGreeting ? 'future-pathways-specific' :
          mentalHealthQuestGreeting ? 'mental-health-quest-specific' : 'default';
      console.log('[V15-CONFIG] Using global AI instructions from Supabase');
      console.log('[V15-CONFIG] Instructions length:', customAIInstructions.length, 'chars');
      console.log('[V15-CONFIG] Greeting type:', greetingType, 'length:', effectiveGreeting.length, 'chars');
      console.log('[V15-CONFIG] Connection timeout set to 120 seconds for specialized searches');

      return {
        enableDiagnostics: true,
        timeout: 120000, // Increased from 30s to 120s for long-running specialized searches
        retryAttempts: 3,
        instructions: customAIInstructions,
        voice: DEFAULT_VOICE,
        tool_choice: DEFAULT_TOOL_CHOICE,
        greetingInstructions: effectiveGreeting
      };
    } else {
      console.log('[V15-CONFIG] ⚠️ Waiting for Supabase data:', {
        hasInstructions: !!customAIInstructions,
        hasGreeting: !!greetingInstructions,
        hasResourceGreeting: !!resourceGreeting,
        hasFuturePathwaysGreeting: !!futurePathwaysGreeting,
        hasMentalHealthQuestGreeting: !!mentalHealthQuestGreeting
      });
      // Return null to prevent initialization until both instructions and greeting are loaded
      return null;
    }
  }, [customAIInstructions, greetingInstructions, resourceGreeting, futurePathwaysGreeting, mentalHealthQuestGreeting]);

  // Fetch books and AI instructions on component mount (like V11)
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const response = await fetch('/api/v11/books');
        if (!response.ok) {
          throw new Error('Failed to fetch books');
        }
        const data = await response.json();
        console.log('[V15-BOOKS] Fetched books:', data);

        setBooks(data);

        // Set the default book (same as V11)
        const specificBookId = 'f95206aa-165e-4c49-b43a-69d91bef8ed4';
        const specificBook = data.find((book: Book) => book.id === specificBookId);

        if (specificBook) {
          // Use the specific book ID if found
          setSelectedBook(specificBookId);
          localStorage.setItem('selectedBookId', specificBookId);
          console.log('[V15-BOOKS] Set default book to specific ID:', specificBookId);
        } else if (data.length > 0) {
          // Fallback to first book if specific ID not found
          setSelectedBook(data[0].id);
          localStorage.setItem('selectedBookId', data[0].id);
          console.log('[V15-BOOKS] Specific book ID not found, using first book:', data[0].id);
        }
      } catch (error) {
        console.error('[V15-BOOKS] Failed to load books', error);
      } finally {
        setBooksLoading(false);
      }
    };

    // V15 Memory-Enhanced AI Instructions: Fetch with user profile context
    const fetchInstructions = async () => {
      try {
        const userId = user?.uid;

        console.log('[memory] V15 fetching memory-enhanced AI instructions for:', userId || 'anonymous');

        // Use V15 memory-enhanced AI instructions
        const { fetchV15AIInstructionsWithMemory } = await import('@/lib/prompts-v15');
        const result = await fetchV15AIInstructionsWithMemory(userId, !userId);

        console.log('[memory] AI instructions result:', {
          source: result.source,
          hasMemory: result.hasMemory,
          instructionsLength: result.instructions.length
        });

        // ===== COMPREHENSIVE AI INSTRUCTIONS LOGGING FROM PAGE =====
        console.log(`[AI_instructions] ===== V15 MEMORY-ENHANCED AI INSTRUCTIONS =====`);
        console.log(`[AI_instructions] Source: ${result.source}`);
        console.log(`[AI_instructions] User ID: ${userId || 'anonymous'}`);
        console.log(`[AI_instructions] Has Memory Context: ${result.hasMemory}`);
        console.log(`[AI_instructions] Instructions Character Count: ${result.instructions.length}`);
        console.log(`[AI_instructions] AI INSTRUCTIONS FROM PAGE (first 200 chars):`);
        console.log(`[AI_instructions]`, result.instructions.substring(0, 200) + '...');
        if (result.hasMemory) {
          console.log(`[memory] Memory-enhanced instructions detected - user profile context included`);
        }
        console.log(`[AI_instructions] ===== END OF V15 MEMORY-ENHANCED AI INSTRUCTIONS =====`);

        setCustomAIInstructions(result.instructions);

        // Fetch greeting instructions with anonymous support
        let greetingUrl = '/api/v11/greeting-prompt?greetingType=default';
        if (userId) {
          console.log('[V15-GREETING] Fetching custom greeting for user:', userId);
          greetingUrl += `&userId=${encodeURIComponent(userId)}`;
        } else {
          console.log('[V15-GREETING] No user ID found, fetching global greeting prompt (anonymous mode)');
          greetingUrl += '&anonymous=true';
        }

        const greetingResponse = await fetch(greetingUrl);
        if (greetingResponse.ok) {
          const greetingData = await greetingResponse.json();
          if (greetingData.promptContent) {
            const source = greetingData.source || 'unknown';
            console.log(`[V15-GREETING] Greeting loaded from ${source} source:`, greetingData.promptContent.substring(0, 30) + '...');

            // ===== COMPREHENSIVE GREETING INSTRUCTIONS LOGGING FROM PAGE =====
            console.log(`[AI_instructions] ===== GREETING INSTRUCTIONS FETCHED BY PAGE COMPONENT =====`);
            console.log(`[AI_instructions] Fetch URL: ${greetingUrl}`);
            console.log(`[AI_instructions] Source: ${source}`);
            console.log(`[AI_instructions] User ID: ${userId || 'anonymous'}`);
            console.log(`[AI_instructions] Greeting Type: default`);
            console.log(`[AI_instructions] Greeting Character Count: ${greetingData.promptContent.length}`);
            console.log(`[AI_instructions] GREETING INSTRUCTIONS FROM PAGE (first 200 chars):`);
            console.log(`[AI_instructions]`, greetingData.promptContent.substring(0, 200) + '...');
            console.log(`[AI_instructions] ===== END OF GREETING INSTRUCTIONS FROM PAGE =====`);

            setGreetingInstructions(greetingData.promptContent);
          } else {
            console.log('[V15-GREETING] No greeting found');
            console.log(`[AI_instructions] NO GREETING INSTRUCTIONS FOUND IN RESPONSE FROM: ${greetingUrl}`);
          }
        } else {
          console.log(`[V15-GREETING] Error ${greetingResponse.status} fetching greeting`);
          console.log(`[AI_instructions] ERROR ${greetingResponse.status} FETCHING GREETING INSTRUCTIONS FROM: ${greetingUrl}`);
        }
      } catch (error) {
        console.error('[V15-INSTRUCTIONS] Error loading instructions:', error);
      }
    };

    // Execute fetch operations
    fetchBooks().then(fetchInstructions);
  }, [user?.uid, firebaseAvailable]);

  // Resource Locator context detection (matching V11 pattern)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const resourceLocatorContextJson = sessionStorage.getItem('resourceLocatorContext');

      if (resourceLocatorContextJson) {
        console.log('[V15-ResourceLocator] Found resourceLocatorContext in sessionStorage:', resourceLocatorContextJson);
        try {
          const contextData = JSON.parse(resourceLocatorContextJson);
          console.log('[V15-ResourceLocator] Parsed Resource Locator context data:', contextData);

          if (contextData.mode === 'resource_locator' && contextData.selectedResource) {
            console.log('[V15-ResourceLocator] Valid resource locator context found, setting state');
            setResourceLocatorContext(contextData);
            console.log('[V15-ResourceLocator] Resource Locator context set - will auto-start session');
          } else {
            console.warn('[V15-ResourceLocator] Invalid context data - missing mode or selectedResource:', {
              mode: contextData.mode,
              hasSelectedResource: !!contextData.selectedResource
            });
          }

          // Clear the context after reading it
          console.log('[V15-ResourceLocator] Clearing resourceLocatorContext from sessionStorage');
          sessionStorage.removeItem('resourceLocatorContext');
        } catch (error) {
          console.error('[V15-ResourceLocator] Error parsing Resource Locator context from sessionStorage:', error);
          console.error('[V15-ResourceLocator] Raw sessionStorage value was:', resourceLocatorContextJson);
        }
      } else {
        console.log('[V15-ResourceLocator] No resourceLocatorContext found in sessionStorage');
      }
    }
  }, []);

  // Future Pathways context detection (matching V11 pattern)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const futurePathwaysContextJson = sessionStorage.getItem('futurePathwaysContext');

      if (futurePathwaysContextJson) {
        console.log('[V15-FuturePathways] Found futurePathwaysContext in sessionStorage:', futurePathwaysContextJson);
        try {
          const contextData = JSON.parse(futurePathwaysContextJson);
          console.log('[V15-FuturePathways] Parsed Future Pathways context data:', contextData);

          if (contextData.mode === 'future_pathways' && contextData.selectedPathway) {
            console.log('[V15-FuturePathways] Valid future pathways context found, setting state');
            setFuturePathwaysContext(contextData);
            console.log('[V15-FuturePathways] Future Pathways context set - will auto-start session');
          } else {
            console.warn('[V15-FuturePathways] Invalid context data - missing mode or selectedPathway:', {
              mode: contextData.mode,
              hasSelectedPathway: !!contextData.selectedPathway
            });
          }

          // Clear the context after reading it
          console.log('[V15-FuturePathways] Clearing futurePathwaysContext from sessionStorage');
          sessionStorage.removeItem('futurePathwaysContext');
        } catch (error) {
          console.error('[V15-FuturePathways] Error parsing Future Pathways context from sessionStorage:', error);
          console.error('[V15-FuturePathways] Raw sessionStorage value was:', futurePathwaysContextJson);
        }
      } else {
        console.log('[V15-FuturePathways] No futurePathwaysContext found in sessionStorage');
      }
    }
  }, []);

  // Mental Health Quest context detection (from quest data)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const questDataJson = sessionStorage.getItem('currentQuestData');

      if (questDataJson) {
        console.log('[V15-MentalHealthQuest] Found currentQuestData in sessionStorage:', questDataJson);
        try {
          const questData = JSON.parse(questDataJson);
          console.log('[V15-MentalHealthQuest] Parsed Mental Health Quest data:', questData);

          if (questData.quest_title && questData.introduction) {
            console.log('[V15-MentalHealthQuest] Valid mental health quest data found, setting state');
            setMentalHealthQuestContext(questData);
            console.log('[V15-MentalHealthQuest] Mental Health Quest context set - will auto-start session');
          } else {
            console.warn('[V15-MentalHealthQuest] Invalid quest data - missing quest_title or introduction:', {
              hasQuestTitle: !!questData.quest_title,
              hasIntroduction: !!questData.introduction
            });
          }

          // Clear the context after reading it
          console.log('[V15-MentalHealthQuest] Clearing currentQuestData from sessionStorage');
          sessionStorage.removeItem('currentQuestData');
        } catch (error) {
          console.error('[V15-MentalHealthQuest] Error parsing Quest data from sessionStorage:', error);
          console.error('[V15-MentalHealthQuest] Raw sessionStorage value was:', questDataJson);
        }
      } else {
        console.log('[V15-MentalHealthQuest] No currentQuestData found in sessionStorage');
      }
    }
  }, []);

  // Generate resource-specific greeting when resource context is detected (V15 anonymous support)
  useEffect(() => {
    if (resourceLocatorContext && resourceLocatorContext.selectedResource) {
      console.log('[V15-ResourceLocator] Generating resource-specific greeting for:', resourceLocatorContext.selectedResource.title);

      const userId = user?.uid || 'anonymous';
      getResourceWelcomeContent(resourceLocatorContext.selectedResource, userId)
        .then((greeting) => {
          console.log('[V15-ResourceLocator] Resource greeting generated, length:', greeting.length);
          setResourceGreeting(greeting);
        })
        .catch((error) => {
          console.error('[V15-ResourceLocator] Error generating resource greeting:', error);
          // Fall back to default greeting if resource greeting fails
          setResourceGreeting(null);
        });
    } else if (!resourceLocatorContext) {
      // Clear resource greeting if no resource context
      setResourceGreeting(null);
    }
  }, [resourceLocatorContext, user]);

  // Generate future pathways greeting when pathway context is detected (V15 anonymous support)
  useEffect(() => {
    if (futurePathwaysContext && futurePathwaysContext.selectedPathway) {
      console.log('[V15-FuturePathways] Generating pathway-specific greeting for:', futurePathwaysContext.selectedPathway.title);

      const userId = user?.uid || 'anonymous';
      getFuturePathwaysWelcomeContent(futurePathwaysContext.selectedPathway, userId)
        .then((greeting) => {
          console.log('[V15-FuturePathways] Future pathways greeting generated, length:', greeting.length);
          setFuturePathwaysGreeting(greeting);
        })
        .catch((error) => {
          console.error('[V15-FuturePathways] Error generating future pathways greeting:', error);
          // Fall back to default greeting if pathways greeting fails
          setFuturePathwaysGreeting(null);
        });
    } else if (!futurePathwaysContext) {
      // Clear future pathways greeting if no pathways context
      setFuturePathwaysGreeting(null);
    }
  }, [futurePathwaysContext, user]);

  // Generate mental health quest greeting when quest context is detected (V15 anonymous support)
  useEffect(() => {
    if (mentalHealthQuestContext && mentalHealthQuestContext.quest_title) {
      console.log('[V15-MentalHealthQuest] Generating quest-specific greeting for:', mentalHealthQuestContext.quest_title);

      const userId = user?.uid || 'anonymous';
      getMentalHealthQuestWelcomeContent(mentalHealthQuestContext, userId)
        .then((greeting) => {
          console.log('[V15-MentalHealthQuest] Mental health quest greeting generated, length:', greeting.length);
          setMentalHealthQuestGreeting(greeting);
        })
        .catch((error) => {
          console.error('[V15-MentalHealthQuest] Error generating mental health quest greeting:', error);
          // Fall back to default greeting if quest greeting fails
          setMentalHealthQuestGreeting(null);
        });
    } else if (!mentalHealthQuestContext) {
      // Clear mental health quest greeting if no quest context
      setMentalHealthQuestGreeting(null);
    }
  }, [mentalHealthQuestContext, user]);

  // V15 OPTIMIZATION: Pre-initialize services on page load (heavy operations) - anonymous support
  useEffect(() => {
    if (functionCounts.book > 0 && functionCounts.mentalHealth > 0 && !booksLoading && webRTCConfig) {
      console.log('[V15-OPTIMIZATION] 🚀 Pre-initializing services on page load (anonymous support)');

      // V15 GREENFIELD FIX: Functions are now registered to store via useFunctionRegistration hook
      // Store will use bookId-based selection logic to determine which functions to use
      console.log('[V15-OPTIMIZATION] 📋 Function registration status:', {
        functionCounts,
        userMode: user ? 'authenticated' : 'anonymous',
        resourceContext: resourceLocatorContext ? resourceLocatorContext.selectedResource?.title : 'none',
        futurePathwaysContext: futurePathwaysContext ? futurePathwaysContext.selectedPathway?.title : 'none',
        mentalHealthQuestContext: mentalHealthQuestContext ? mentalHealthQuestContext.quest_title : 'none'
      });

      // Pre-initialize heavy operations (AI instructions, config preparation)
      // Functions are automatically available from store via registerFunctions hook
      preInitialize(webRTCConfig).catch((error) => {
        console.error('[V15-OPTIMIZATION] ❌ CRITICAL PRE-INITIALIZATION FAILURE:', error);
        optimizedAudioLogger.error('webrtc', 'v15_pre_initialization_failed', error as Error, {
          userId: user?.uid || 'anonymous',
          errorType: 'ai_instructions_missing',
          actionRequired: 'add_global_instructions'
        });

        // Display error to user
        alert(`V15 Pre-Initialization Failed!\n\n${error.message}\n\nThis is a configuration error that needs to be fixed by an administrator.`);
      });
    } else if (!webRTCConfig) {
      console.log('[V15-OPTIMIZATION] ⏳ Waiting for AI instructions from Supabase before pre-initialization');
    }
  }, [preInitialize, webRTCConfig, user, functionCounts, booksLoading, resourceLocatorContext, futurePathwaysContext, mentalHealthQuestContext]);

  // Auto-start session for Resource Locator context (matching V11 pattern)
  useEffect(() => {
    console.log('[V15-ResourceLocator] Auto-start effect check:', {
      hasResourceLocatorContext: !!resourceLocatorContext,
      booksLoading,
      isConnected,
      resourceLocatorAutoStarted
    });

    if (resourceLocatorContext && !booksLoading && !isConnected && !resourceLocatorAutoStarted && webRTCConfig) {
      console.log('[V15-ResourceLocator] Auto-starting Resource Locator session for:', resourceLocatorContext.selectedResource?.title);

      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        console.log('[V15-ResourceLocator] Timer fired - calling connect');
        connect();
        // Mark as auto-started AFTER the session starts to prevent re-triggering
        setResourceLocatorAutoStarted(true);
        console.log('[V15-ResourceLocator] Marked as auto-started');
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [resourceLocatorContext, booksLoading, isConnected, resourceLocatorAutoStarted, webRTCConfig, connect]);

  // Auto-start session for Future Pathways context (matching V11 pattern)
  useEffect(() => {
    console.log('[V15-FuturePathways] Auto-start effect check:', {
      hasFuturePathwaysContext: !!futurePathwaysContext,
      booksLoading,
      isConnected,
      futurePathwaysAutoStarted
    });

    if (futurePathwaysContext && !booksLoading && !isConnected && !futurePathwaysAutoStarted && webRTCConfig) {
      console.log('[V15-FuturePathways] Auto-starting Future Pathways session for:', futurePathwaysContext.selectedPathway?.title);

      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        console.log('[V15-FuturePathways] Timer fired - calling connect');
        connect();
        // Mark as auto-started AFTER the session starts to prevent re-triggering
        setFuturePathwaysAutoStarted(true);
        console.log('[V15-FuturePathways] Marked as auto-started');
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [futurePathwaysContext, booksLoading, isConnected, futurePathwaysAutoStarted, webRTCConfig, connect]);

  // Auto-start session for Mental Health Quest context
  useEffect(() => {
    console.log('[V15-MentalHealthQuest] Auto-start effect check:', {
      hasMentalHealthQuestContext: !!mentalHealthQuestContext,
      booksLoading,
      isConnected,
      mentalHealthQuestAutoStarted
    });

    if (mentalHealthQuestContext && !booksLoading && !isConnected && !mentalHealthQuestAutoStarted && webRTCConfig) {
      console.log('[V15-MentalHealthQuest] Auto-starting Mental Health Quest session for:', mentalHealthQuestContext.quest_title);

      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        console.log('[V15-MentalHealthQuest] Timer fired - calling connect');
        connect();
        // Mark as auto-started AFTER the session starts to prevent re-triggering
        setMentalHealthQuestAutoStarted(true);
        console.log('[V15-MentalHealthQuest] Marked as auto-started');
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [mentalHealthQuestContext, booksLoading, isConnected, mentalHealthQuestAutoStarted, webRTCConfig, connect]);

  // Show loading while auth, books, AI instructions, or greeting are loading
  if (authLoading || booksLoading || !customAIInstructions || !greetingInstructions) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#131314] text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>
            {authLoading ? 'Loading...' :
              booksLoading ? 'Loading books...' :
                !customAIInstructions ? 'Loading AI instructions from Supabase...' :
                  'Loading greeting instructions from Supabase...'}
          </p>
        </div>
      </div>
    );
  }

  // V15 Anonymous support: Always proceed to main interface
  // Authentication is optional - users can use V15 without signing in
  // Login will be available in the header component if needed

  return <ChatBotV15Component />;
}