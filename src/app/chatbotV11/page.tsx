"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useBookFunctions } from '@/hooksV11/use-book-functions';
import { useMentalHealthFunctions } from '@/hooksV11/use-mental-health-functions';
import { useEnhancedAudioService } from '@/hooksV11';
import { toast } from 'sonner';
import './chatbotV11.css';
import '@/app/chatbotV11/debug-panel.css';
import { generateBookInstructions, DEFAULT_VOICE, DEFAULT_TOOL_CHOICE } from './prompts';
import { fetchFuturePathwaysGreeting } from './prompts/future-pathways-greeting';
import { getResourceWelcomeContent } from './prompts/resource-locator-welcome';
import BlueOrbVoiceUI from '@/components/BlueOrbVoiceUI';
import { ThemeDebug } from '@/components/ThemeDebug';
import { Power } from 'lucide-react';
import { initConversationTracker } from './conversation-tracker';
import MapResourcesDisplay from './MapResourcesDisplay';
import FuturesPathwaysCards from './components/FuturesPathwaysCards';

// Module-level variable to track manual end timeout
let manualEndTimeoutId: number | null = null;

// Custom event interface for message saving events
interface MessageSaveEvent extends CustomEvent {
  detail: {
    conversationId: string;
  };
}

// Declare the custom events
declare global {
  interface WindowEventMap {
    'message_saved': MessageSaveEvent;
    'display_resource_map': CustomEvent<{ searchId: string }>;
  }
}

console.log("executing ChatbotV11Page");

// Book interface matching the API response
interface Book {
  id: string;  // UUID format
  title: string;
  author: string;
}


export default function ChatbotV11Page() {
  // Initialize the conversation tracker (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Reset the profile update flag on page initialization
      // This prevents stale flags from blocking profile updates after page refreshes
      if (sessionStorage.getItem('profile_update_in_progress') === 'true') {
        console.log('%c [USER-PROFILE-UPDATE] 🔄 Clearing stale profile update flag on page initialization', 'background: #142d4c; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
        sessionStorage.removeItem('profile_update_in_progress');
      }

      const tracker = initConversationTracker();
      console.log('[ChatbotV11Page] Conversation tracker initialized');

      // Clean up on unmount
      return () => {
        // Clear conversation ID on page unmount
        tracker.clearConversationId();
      };
    }
  }, []);

  // Define a more specific type for diagnosticData
  interface ResponsePatterns {
    functionCalls: number;
    directResponses: number;
    lastResponseType?: string;
    lastFunctionName?: string;
  }

  interface DiagnosticData {
    responsePatterns?: ResponsePatterns;
    [key: string]: unknown;
  }

  // Use the enhanced audio service that includes WebRTC functionality plus enhanced audio monitoring
  const {
    status,
    isSessionActive,
    errorMessage,
    conversation,
    registerFunction,
    startSession,
    stopSession,
    sendTextMessage,
    isMuted,
    toggleMute,
    currentVolume,
    diagnosticData,
    // Enhanced audio features
    audioStream,
    audioLevel,
    isAudioPlaying,
    safeDisconnect,
    audioState
  } = useEnhancedAudioService();

  // Book functions hook for AI function calls
  const {
    bookFunctions,
    registerBookFunctions,
    lastFunctionResult: bookFunctionResult,
    functionError: bookFunctionError
  } = useBookFunctions();

  // Mental health functions hook
  const {
    mentalHealthFunctions,
    registerMentalHealthFunctions,
    lastFunctionResult: mhFunctionResult,
    functionError: mhFunctionError
  } = useMentalHealthFunctions();

  // Combined function results and errors for debugging
  const lastFunctionResult = bookFunctionResult || mhFunctionResult;
  const functionError = bookFunctionError || mhFunctionError;

  // State for book selection and text input
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<string>("");
  const [booksLoading, setBooksLoading] = useState(true);
  const [textInput, setTextInput] = useState('');
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [micMode, setMicMode] = useState<'phone' | 'walkie-talkie'>('phone');
  const [mapVisible, setMapVisible] = useState(false);
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null);
  const [currentFunctionCall, setCurrentFunctionCall] = useState<string | null>(null);

  // State for instructions that will be loaded when page loads
  const [greetingInstructions, setGreetingInstructions] = useState<string>(
    `Ask a general, warm, friendly, and open ended greeting question such as "What's on your mind?" or "How can I help you?" or any similar variation. Be brief and to the point.`
  );

  // State for custom AI instructions
  const [customAIInstructions, setCustomAIInstructions] = useState<string | null>(null);

  // State for immediate button feedback
  const [buttonClicked, setButtonClicked] = useState<boolean>(false);

  // State for user profile data
  const [userProfile, setUserProfile] = useState<Record<string, unknown> | null>(null);
  const [userProfileLoading, setUserProfileLoading] = useState<boolean>(false);
  const [userProfileError, setUserProfileError] = useState<string | null>(null);

  // Debug options for testing
  const [showFullInstructions, setShowFullInstructions] = useState<boolean>(true); // Enable for testing, disable in production

  // Force show instructions via console API for direct testing
  if (typeof window !== 'undefined') {
    (window as Window & { showAIInstructions?: (instructions: string) => string }).showAIInstructions = (instructions: string) => {
      console.log('📄 [FULL-AI-INSTRUCTIONS-DIRECT] ===============================');
      console.log(instructions);
      console.log('📄 [FULL-AI-INSTRUCTIONS-DIRECT] ===============================');
      return 'Instructions logged to console';
    };
  }

  // State for quest data
  const [questAiPrompt, setQuestAiPrompt] = useState<string | null>(null);
  const [questTitle, setQuestTitle] = useState<string | null>(null);
  const [questIntroduction, setQuestIntroduction] = useState<string | null>(null);
  const [questChallenge, setQuestChallenge] = useState<string | null>(null);
  const [questStartingQuestion, setQuestStartingQuestion] = useState<string | null>(null);

  // State for Future Pathways context
  interface FuturePathwaysContextType {
    source: string;
    timestamp: number;
    mode: string;
    selectedPathway?: {
      id: string;
      title: string;
      subtitle: string;
      description: string;
      functionName: string;
      category: string;
      parameters: Record<string, unknown>;
    };
  }

  const [futurePathwaysContext, setFuturePathwaysContext] = useState<FuturePathwaysContextType | null>(null);
  const [futurePathwaysAutoStarted, setFuturePathwaysAutoStarted] = useState<boolean>(false);

  // State for Resource Locator context
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

  const [resourceLocatorContext, setResourceLocatorContext] = useState<ResourceLocatorContextType | null>(null);
  const [resourceLocatorAutoStarted, setResourceLocatorAutoStarted] = useState<boolean>(false);

  // References
  const conversationContainerRef = useRef<HTMLDivElement>(null);

  // Add UI layout debugging
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const logUILayout = () => {
        console.log('[UI-LAYOUT-DEBUG] Starting comprehensive layout analysis...');
        
        // Find all key layout elements
        const layoutRoot = document.querySelector('.v11-layout-root');
        const mainContentRow = document.querySelector('.main-content-row');
        const mainContainer = document.querySelector('.main-container');
        const conversationContainer = document.querySelector('.conversation-container');
        const conversationHistory = document.querySelector('.conversation-history');
        
        console.log('[UI-LAYOUT-DEBUG] Element existence check:', {
          layoutRoot: !!layoutRoot,
          mainContentRow: !!mainContentRow,
          mainContainer: !!mainContainer,
          conversationContainer: !!conversationContainer,
          conversationHistory: !!conversationHistory
        });
        
        if (conversationContainer) {
          const computedStyles = window.getComputedStyle(conversationContainer);
          const rect = conversationContainer.getBoundingClientRect();
          
          console.log('[UI-LAYOUT-DEBUG] Conversation container details:', {
            className: conversationContainer.className,
            computedHeight: computedStyles.height,
            computedWidth: computedStyles.width,
            computedDisplay: computedStyles.display,
            computedFlex: computedStyles.flex,
            computedFlexDirection: computedStyles.flexDirection,
            computedMinHeight: computedStyles.minHeight,
            computedMaxHeight: computedStyles.maxHeight,
            computedPosition: computedStyles.position,
            actualRect: {
              width: rect.width,
              height: rect.height,
              top: rect.top,
              left: rect.left
            },
            offsetDimensions: {
              offsetWidth: (conversationContainer as HTMLElement).offsetWidth,
              offsetHeight: (conversationContainer as HTMLElement).offsetHeight,
              offsetTop: (conversationContainer as HTMLElement).offsetTop,
              offsetLeft: (conversationContainer as HTMLElement).offsetLeft
            }
          });
          
          // Check parent chain
          let parent = conversationContainer.parentElement;
          let level = 1;
          while (parent && level <= 5) {
            const parentStyles = window.getComputedStyle(parent);
            console.log(`[UI-LAYOUT-DEBUG] Parent level ${level} (${parent.className || parent.tagName}):`, {
              height: parentStyles.height,
              display: parentStyles.display,
              flex: parentStyles.flex,
              position: parentStyles.position,
              overflow: parentStyles.overflow
            });
            parent = parent.parentElement;
            level++;
          }
        }
        
        // Check viewport and available space
        console.log('[UI-LAYOUT-DEBUG] Viewport and available space:', {
          windowHeight: window.innerHeight,
          documentHeight: document.documentElement.scrollHeight,
          bodyHeight: document.body.scrollHeight
        });
        
        if (layoutRoot) {
          const rootRect = layoutRoot.getBoundingClientRect();
          const rootStyles = window.getComputedStyle(layoutRoot);
          console.log('[UI-LAYOUT-DEBUG] Layout root details:', {
            height: rootStyles.height,
            gridTemplateRows: rootStyles.gridTemplateRows,
            actualHeight: rootRect.height,
            actualWidth: rootRect.width
          });
        }
      };
      
      // Log immediately and after a delay to catch any dynamic changes
      setTimeout(logUILayout, 1000);
      setTimeout(logUILayout, 3000);
      
      // Log on resize
      window.addEventListener('resize', logUILayout);
      
      return () => {
        window.removeEventListener('resize', logUILayout);
      };
    }
  }, []);

  // Create debug panel element
  useEffect(() => {
    if (typeof document !== 'undefined') {
      // Check if debug panel already exists
      let debugPanel = document.getElementById('debug-panel');

      if (!debugPanel) {
        // Create debug panel if it doesn't exist
        debugPanel = document.createElement('div');
        debugPanel.id = 'debug-panel';
        debugPanel.style.display = 'none';
        document.body.appendChild(debugPanel);

        // Create toggle button
        const toggleButton = document.createElement('button');
        toggleButton.id = 'debug-panel-toggle';
        toggleButton.textContent = 'Debug';
        toggleButton.onclick = () => {
          if (debugPanel) {
            debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
          }
        };
        document.body.appendChild(toggleButton);
      }
    }

    // Clean up on unmount
    return () => {
      // Don't remove the debug panel on unmount to preserve logs across navigation
    };
  }, []);

  // Check for quest data, Future Pathways context, and Resource Locator context from sessionStorage on mount
  useEffect(() => {
    // Access sessionStorage to get quest data, Future Pathways context, and Resource Locator context
    if (typeof window !== 'undefined') {
      const questDataJson = sessionStorage.getItem('currentQuestData');
      const futurePathwaysContextJson = sessionStorage.getItem('futurePathwaysContext');
      const resourceLocatorContextJson = sessionStorage.getItem('resourceLocatorContext');

      // Handle quest data
      if (questDataJson) {
        try {
          const questData = JSON.parse(questDataJson);
          console.log('📩 Received quest data in chatbot page:', {
            id: questData.id,
            title: questData.quest_title,
            hasAiPrompt: !!questData.ai_prompt,
            aiPrompt: questData.ai_prompt?.substring(0, 50) + '...',
            hasIntroduction: !!questData.introduction,
            introduction: questData.introduction?.substring(0, 50) + '...',
            hasChallenge: !!questData.challenge,
            challenge: questData.challenge?.substring(0, 50) + '...',
            hasStartingQuestion: !!questData.starting_question,
            startingQuestion: questData.starting_question?.substring(0, 50) + '...'
          });

          // Store all quest data in state if available
          if (questData.ai_prompt) {
            console.log('Using quest-specific AI prompt for greeting instructions');
            setQuestAiPrompt(questData.ai_prompt);
          }

          if (questData.quest_title) {
            setQuestTitle(questData.quest_title);
          }

          if (questData.introduction) {
            setQuestIntroduction(questData.introduction);
          }

          if (questData.challenge) {
            setQuestChallenge(questData.challenge);
          }

          if (questData.starting_question) {
            setQuestStartingQuestion(questData.starting_question);
          }

          // Clear the data after reading it to avoid stale data on refresh
          sessionStorage.removeItem('currentQuestData');
        } catch (error) {
          console.error('Error parsing quest data from sessionStorage:', error);
        }
      }

      // Handle Future Pathways context
      if (futurePathwaysContextJson) {
        console.log('[FuturePathways] Found futurePathwaysContext in sessionStorage:', futurePathwaysContextJson);
        try {
          const contextData = JSON.parse(futurePathwaysContextJson);
          console.log('[FuturePathways] Parsed Future Pathways context data:', contextData);

          if (contextData.mode === 'future_pathways') {
            console.log('[FuturePathways] Valid future pathways context found, setting state');
            setFuturePathwaysContext(contextData);
            console.log('[FuturePathways] Future Pathways context set - will auto-start session');
          } else {
            console.warn('[FuturePathways] Invalid context data - missing mode:', {
              mode: contextData.mode,
              hasSelectedPathway: !!contextData.selectedPathway
            });
          }

          // Clear the context after reading it
          console.log('[FuturePathways] Clearing futurePathwaysContext from sessionStorage');
          sessionStorage.removeItem('futurePathwaysContext');
        } catch (error) {
          console.error('[FuturePathways] Error parsing Future Pathways context from sessionStorage:', error);
          console.error('[FuturePathways] Raw sessionStorage value was:', futurePathwaysContextJson);
        }
      } else {
        console.log('[FuturePathways] No futurePathwaysContext found in sessionStorage');
      }

      // Handle Resource Locator context
      if (resourceLocatorContextJson) {
        console.log('[ResourceLocator] Found resourceLocatorContext in sessionStorage:', resourceLocatorContextJson);
        try {
          const contextData = JSON.parse(resourceLocatorContextJson);
          console.log('[ResourceLocator] Parsed Resource Locator context data:', contextData);

          if (contextData.mode === 'resource_locator' && contextData.selectedResource) {
            console.log('[ResourceLocator] Valid resource locator context found, setting state');
            setResourceLocatorContext(contextData);
            console.log('[ResourceLocator] Resource Locator context set - will auto-start session');
          } else {
            console.warn('[ResourceLocator] Invalid context data - missing mode or selectedResource:', {
              mode: contextData.mode,
              hasSelectedResource: !!contextData.selectedResource
            });
          }

          // Clear the context after reading it
          console.log('[ResourceLocator] Clearing resourceLocatorContext from sessionStorage');
          sessionStorage.removeItem('resourceLocatorContext');
        } catch (error) {
          console.error('[ResourceLocator] Error parsing Resource Locator context from sessionStorage:', error);
          console.error('[ResourceLocator] Raw sessionStorage value was:', resourceLocatorContextJson);
        }
      } else {
        console.log('[ResourceLocator] No resourceLocatorContext found in sessionStorage');
      }
    }
  }, []);

  // Fetch books, custom greeting, AI instructions, and user profile on component mount
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const response = await fetch('/api/v11/books');
        if (!response.ok) {
          throw new Error('Failed to fetch books');
        }
        const data = await response.json();
        console.log('Fetched books:', data);

        setBooks(data);

        // Set the default book
        const specificBookId = 'f95206aa-165e-4c49-b43a-69d91bef8ed4';
        const specificBook = data.find((book: Book) => book.id === specificBookId);

        if (specificBook) {
          // Use the specific book ID if found
          setSelectedBook(specificBookId);
          localStorage.setItem('selectedBookId', specificBookId);
          console.log('Set default book to specific ID:', specificBookId);
        } else if (data.length > 0) {
          // Fallback to first book if specific ID not found
          setSelectedBook(data[0].id);
          localStorage.setItem('selectedBookId', data[0].id);
          console.log('Specific book ID not found, using first book:', data[0].id);
        }
      } catch (error) {
        console.error('Failed to load books', error);
        toast.error('Failed to load books');
      } finally {
        setBooksLoading(false);
      }
    };

    // Fetch greeting and AI instructions (for both signed-in and anonymous users)
    const fetchUserInstructions = async () => {
      try {
        const userId = localStorage.getItem('userId');

        // For custom greeting (default type)
        let greetingUrl = '/api/v11/greeting-prompt?greetingType=default';
        if (userId) {
          // User is signed in - fetch user-specific greeting
          console.log('Fetching custom greeting for user:', userId);
          greetingUrl += `&userId=${encodeURIComponent(userId)}`;
        } else {
          // User is not signed in - fetch global greeting
          console.log('No user ID found, fetching global greeting prompt');
          greetingUrl += '&anonymous=true';
        }

        const greetingResponse = await fetch(greetingUrl);
        if (greetingResponse.ok) {
          const greetingData = await greetingResponse.json();
          if (greetingData.promptContent) {
            const source = greetingData.source || 'unknown';
            console.log(`Greeting loaded from ${source} source:`, greetingData.promptContent.substring(0, 30) + '...');
            setGreetingInstructions(greetingData.promptContent);
          } else {
            console.log('No greeting found, using default');
          }
        } else {
          console.log(`Error ${greetingResponse.status} fetching greeting, using default`);
        }

        // For AI instructions
        let aiUrl = '/api/v11/ai-instructions';
        if (userId) {
          // User is signed in - fetch user-specific AI instructions
          console.log('Fetching custom AI instructions for user:', userId);
          aiUrl += `?userId=${encodeURIComponent(userId)}`;
        } else {
          // User is not signed in - fetch global AI instructions
          console.log('No user ID found, fetching global AI instructions');
          aiUrl += '?anonymous=true';
        }

        const aiResponse = await fetch(aiUrl);
        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          if (aiData.promptContent) {
            const source = aiData.source || 'unknown';
            console.log(`AI instructions loaded from ${source} source:`, aiData.promptContent.substring(0, 30) + '...');
            setCustomAIInstructions(aiData.promptContent);
          } else {
            console.log('No AI instructions found, using default');
          }
        } else {
          console.log(`Error ${aiResponse.status} fetching AI instructions, using default`);
        }
      } catch (error) {
        console.error('Error loading instructions:', error);
        // Keep default instructions
      }
    };

    // Fetch user profile if user is signed in
    const fetchUserProfile = async () => {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        console.log('No user ID found, skipping user profile fetch');
        return;
      }

      try {
        setUserProfileLoading(true);
        setUserProfileError(null);

        console.log('📥 [USER-PROFILE] Fetching user profile for user:', userId);
        const response = await fetch(`/api/v11/user-profile?userId=${encodeURIComponent(userId)}`);

        if (response.ok) {
          const data = await response.json();
          const profileSize = data?.profile ? Object.keys(data.profile).length : 0;
          const profileCategories = data?.profile ? Object.keys(data.profile).join(', ') : 'none';

          console.log('✅ [USER-PROFILE] Successfully loaded user profile:',
            `categories: ${profileCategories}`,
            `entries: ${profileSize}`,
            'last updated:', data?.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'unknown');
          setUserProfile(data.profile || null);
        } else if (response.status === 404) {
          // No profile exists yet - this is expected for new users
          console.log('ℹ️ [USER-PROFILE] No user profile found - user may be new or profile not yet generated');
          setUserProfile(null);
        } else {
          // Handle error
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('❌ [USER-PROFILE] Error fetching user profile:', errorData);
          setUserProfileError(errorData.error || `Failed to fetch user profile (${response.status})`);
        }
      } catch (error) {
        console.error('❌ [USER-PROFILE] Exception fetching user profile:', error);
        setUserProfileError(error instanceof Error ? error.message : String(error));
      } finally {
        setUserProfileLoading(false);
      }
    };

    // Execute fetch operations
    fetchBooks()
      .then(fetchUserInstructions)
      .then(fetchUserProfile);
  }, []);

  // Register functions and load preferences
  useEffect(() => {
    // Load saved mic mode preference if available
    if (typeof window !== 'undefined') {
      const savedMicMode = localStorage.getItem('micMode');
      if (savedMicMode === 'phone' || savedMicMode === 'walkie-talkie') {
        setMicMode(savedMicMode);
      }
    }

    // Register all functions with the WebRTC hook
    if (customAIInstructions && customAIInstructions.includes('mental health companion')) {
      console.log('Registering mental health functions due to custom instructions');
      // Type assertion needed due to incompatible function parameter definitions
      // This is safe because the mental health functions will be called correctly at runtime
      registerMentalHealthFunctions(registerFunction as unknown as Parameters<typeof registerMentalHealthFunctions>[0]);
    } else {
      console.log('Registering standard book functions');
      // Type assertion needed due to incompatible function parameter definitions
      // This is safe because the book functions will be called correctly at runtime
      registerBookFunctions(registerFunction as unknown as Parameters<typeof registerBookFunctions>[0]);
    }
  }, [registerBookFunctions, registerMentalHealthFunctions, registerFunction, customAIInstructions]);

  // Auto-start session for Future Pathways context
  useEffect(() => {
    if (futurePathwaysContext && !booksLoading && selectedBook && !isSessionActive && !futurePathwaysAutoStarted) {
      console.log('[FuturePathways] Auto-starting Future Pathways session for:', futurePathwaysContext.selectedPathway?.title || 'general pathways');

      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        handleStartSession();
        // Mark as auto-started AFTER the session starts to prevent re-triggering
        setFuturePathwaysAutoStarted(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [futurePathwaysContext, booksLoading, selectedBook, isSessionActive, futurePathwaysAutoStarted]);

  // Auto-start session for Resource Locator context
  useEffect(() => {
    console.log('[ResourceLocator] Auto-start effect check:', {
      hasResourceLocatorContext: !!resourceLocatorContext,
      booksLoading,
      selectedBook,
      isSessionActive,
      resourceLocatorAutoStarted
    });

    if (resourceLocatorContext && !booksLoading && selectedBook && !isSessionActive && !resourceLocatorAutoStarted) {
      console.log('[ResourceLocator] Auto-starting Resource Locator session for:', resourceLocatorContext.selectedResource?.title);

      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        console.log('[ResourceLocator] Timer fired - calling handleStartSession');
        handleStartSession();
        // Mark as auto-started AFTER the session starts to prevent re-triggering
        setResourceLocatorAutoStarted(true);
        console.log('[ResourceLocator] Marked as auto-started');
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [resourceLocatorContext, booksLoading, selectedBook, isSessionActive, resourceLocatorAutoStarted]);

  // Update selected book in localStorage and refresh AI instructions
  useEffect(() => {
    if (selectedBook) {
      localStorage.setItem('selectedBookId', selectedBook);

      // Build URL for fetching book-specific instructions
      let aiUrl = `/api/v11/ai-instructions?bookId=${encodeURIComponent(selectedBook)}`;

      // Add userId parameter if available
      const userId = localStorage.getItem('userId');
      if (userId) {
        aiUrl += `&userId=${encodeURIComponent(userId)}`;
      } else {
        aiUrl += '&anonymous=true';
      }

      // Fetch book-specific AI instructions
      console.log(`Fetching AI instructions for book ${selectedBook}`);
      fetch(aiUrl)
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          return null;
        })
        .then(data => {
          if (data && data.promptContent) {
            const source = data.source || 'unknown';
            console.log(`Book-specific AI instructions loaded from ${source} source`);
            setCustomAIInstructions(data.promptContent);
          } else {
            // Fallback to user-level instructions or default
            console.log('No book-specific AI instructions found, using general ones');
          }
        })
        .catch(error => {
          console.error('Error fetching book-specific AI instructions:', error);
        });
    }
  }, [selectedBook]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (conversationContainerRef.current) {
      conversationContainerRef.current.scrollTop = conversationContainerRef.current.scrollHeight;
    }
  }, [conversation]);

  // Memoized callback for closing the map
  const handleCloseMap = useCallback(() => {
    setMapVisible(false);
  }, []);

  // Function to create a new conversation in the database
  const createConversation = useCallback(async (userId: string) => {
    try {
      console.log('%c [CREATE-CONVERSATION] 🆕 Creating new conversation in database', 'background: #1e3a5f; color: #32CD32; font-weight: bold; padding: 4px; border-radius: 4px;');

      const response = await fetch('/api/v11/create-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('%c [CREATE-CONVERSATION] ❌ Failed to create conversation', 'background: #1e3a5f; color: #ff6347; font-weight: bold; padding: 4px; border-radius: 4px;', errorData);
        return null;
      }

      const data = await response.json();
      const conversationId = data.conversationId;

      console.log(`%c [CREATE-CONVERSATION] ✅ Created new conversation: ${conversationId}`, 'background: #1e3a5f; color: #32CD32; font-weight: bold; padding: 4px; border-radius: 4px;');

      // Store the new conversation ID in session storage
      sessionStorage.setItem('current_conversation_id', conversationId);

      return conversationId;
    } catch (error) {
      console.error('%c [CREATE-CONVERSATION] ❌ Error creating conversation', 'background: #1e3a5f; color: #ff6347; font-weight: bold; padding: 4px; border-radius: 4px;', error);
      return null;
    }
  }, []);

  // Function to end active conversation when chat ends
  const endActiveConversation = useCallback(async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      console.log('%c [END-CONVERSATION] ⚠️ No user ID found, skipping conversation end', 'background: #1e3a5f; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
      return { success: false, reason: 'no-user-id' };
    }

    try {
      console.log('%c [END-CONVERSATION] 🏁 Marking conversation as inactive', 'background: #1e3a5f; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');

      // Get the current conversation ID if available from sessionStorage
      const conversationId = sessionStorage.getItem('current_conversation_id');

      // Only proceed if we have a valid conversation ID
      if (conversationId) {
        console.log(`%c [END-CONVERSATION] 🔍 Targeting conversation ID: ${conversationId}`, 'background: #1e3a5f; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
      } else {
        console.log('%c [END-CONVERSATION] ℹ️ No specific conversation ID, will end all active conversations', 'background: #1e3a5f; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
      }

      // Make special Debug request to directly set conversation to inactive
      // This is a workaround if the normal endpoint isn't working
      // Commented out since the regular endpoint should work properly now that conversation IDs are correctly tracked
      /*
      try {
        // First make a direct update with Supabase using fetch
        const directUpdateUrl = `/api/v11/debug-end-conversation-direct?userId=${encodeURIComponent(userId)}${conversationId ? `&conversationId=${encodeURIComponent(conversationId)}` : ''}`;
        console.log(`%c [END-CONVERSATION] 🛠️ Attempting direct database update via: ${directUpdateUrl}`, 'background: #1e3a5f; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
        
        // Actually perform the fetch to the direct update endpoint
        const directResponse = await fetch(directUpdateUrl);
        const directData = await directResponse.json();
        
        if (directResponse.ok) {
          console.log(`%c [END-CONVERSATION] ✅ Direct update successful: ${JSON.stringify(directData)}`, 'background: #1e3a5f; color: #32CD32; font-weight: bold; padding: 4px; border-radius: 4px;');
        } else {
          console.log(`%c [END-CONVERSATION] ⚠️ Direct update failed: ${JSON.stringify(directData)}`, 'background: #1e3a5f; color: #ff6347; font-weight: bold; padding: 4px; border-radius: 4px;');
        }
      } catch (directError) {
        console.log(`%c [END-CONVERSATION] ⚠️ Direct update attempt failed, continuing with regular endpoint: ${directError.message}`, 'background: #1e3a5f; color: #ff6347; font-weight: bold; padding: 4px; border-radius: 4px;');
      }
      */

      // Call the regular endpoint as well
      const response = await fetch('/api/v11/end-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          conversationId: conversationId || undefined
        })
      });

      const data = await response.json();

      if (response.ok) {
        console.log(`%c [END-CONVERSATION] ✅ Successfully ended ${data.conversationsEnded} conversation(s)`, 'background: #1e3a5f; color: #32CD32; font-weight: bold; padding: 4px; border-radius: 4px;');

        if (data.message) {
          console.log(`%c [END-CONVERSATION] ℹ️ Server message: ${data.message}`, 'background: #1e3a5f; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
        }

        // Clear the conversation ID from session storage
        if (conversationId) {
          sessionStorage.removeItem('current_conversation_id');
        }

        // If no conversations were ended but we have a conversation ID, try a direct fallback
        if (data.conversationsEnded === 0 && conversationId) {
          console.log(`%c [END-CONVERSATION] ⚠️ No conversations were updated, trying direct SQL fallback`, 'background: #1e3a5f; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');

          try {
            // This is just for logging - actual fallback would be in a new endpoint
            console.log(`%c [END-CONVERSATION] 📝 Would execute: UPDATE conversations SET is_active = false WHERE id = '${conversationId}'`, 'background: #1e3a5f; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
          } catch (fallbackError) {
            console.error(`%c [END-CONVERSATION] ❌ Fallback also failed`, 'background: #1e3a5f; color: #ff6347; font-weight: bold; padding: 4px; border-radius: 4px;');
            console.log('fallbackError: ', fallbackError)
          }
        }

        return { success: true, conversationsEnded: data.conversationsEnded, message: data.message };
      } else {
        console.error('%c [END-CONVERSATION] ❌ Failed to end conversation', 'background: #1e3a5f; color: #ff6347; font-weight: bold; padding: 4px; border-radius: 4px;');
        console.error(`%c [END-CONVERSATION] Error details:`, 'background: #1e3a5f; color: #ff6347; font-weight: bold; padding: 4px; border-radius: 4px;', data);

        return { success: false, error: data.error || 'Unknown API error' };
      }
    } catch (error) {
      console.error('%c [END-CONVERSATION] ❌ Exception while ending conversation', 'background: #1e3a5f; color: #ff6347; font-weight: bold; padding: 4px; border-radius: 4px;');
      console.error(`%c [END-CONVERSATION] Error details:`, 'background: #1e3a5f; color: #ff6347; font-weight: bold; padding: 4px; border-radius: 4px;', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }, []);

  // Function to silently update user profile when chat ends
  const triggerUserProfileUpdate = useCallback(async () => {
    // Use a flag in sessionStorage to prevent duplicate calls
    const updateFlag = sessionStorage.getItem('profile_update_in_progress');
    if (updateFlag === 'true') {
      console.log('%c [USER-PROFILE-UPDATE] 🔄 Update already in progress, skipping duplicate call', 'background: #142d4c; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
      return;
    }

    // Set flag to prevent duplicate calls
    sessionStorage.setItem('profile_update_in_progress', 'true');

    const userId = localStorage.getItem('userId');
    if (!userId) {
      console.log('%c [USER-PROFILE-UPDATE] ⚠️ No user ID found, skipping profile update', 'background: #142d4c; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
      sessionStorage.removeItem('profile_update_in_progress');
      return;
    }

    // First end the active conversation to ensure clean data separation
    await endActiveConversation();

    try {
      console.log('%c [USER-PROFILE-UPDATE] 🚀 STARTING - Triggering background user profile update', 'background: #142d4c; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
      console.log(`%c [USER-PROFILE-UPDATE] 👤 User ID: ${userId.substring(0, 8)}...`, 'background: #142d4c; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');

      const startTime = Date.now();
      const response = await fetch('/api/v11/process-user-memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId
        })
      });

      const responseData = await response.json();

      if (response.ok) {
        const duration = Date.now() - startTime;
        console.log('%c [USER-PROFILE-UPDATE] ✅ SUCCESS - Profile update job initiated', 'background: #142d4c; color: #32CD32; font-weight: bold; padding: 4px; border-radius: 4px;');
        console.log(`%c [USER-PROFILE-UPDATE] ⏱️ API Response time: ${duration}ms`, 'background: #142d4c; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');

        if (responseData.jobId) {
          console.log(`%c [USER-PROFILE-UPDATE] 🔑 Background job ID: ${responseData.jobId}`, 'background: #142d4c; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
          console.log(`%c [USER-PROFILE-UPDATE] 📊 Processing ${responseData.totalConversations || 'unknown'} conversations in background`, 'background: #142d4c; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
        }
      } else {
        console.error('%c [USER-PROFILE-UPDATE] ❌ ERROR - Failed to initiate profile update', 'background: #142d4c; color: #ff6347; font-weight: bold; padding: 4px; border-radius: 4px;');
        console.error(`%c [USER-PROFILE-UPDATE] Status: ${response.status}`, 'background: #142d4c; color: #ff6347; font-weight: bold; padding: 4px; border-radius: 4px;');
        console.error(`%c [USER-PROFILE-UPDATE] Details:`, 'background: #142d4c; color: #ff6347; font-weight: bold; padding: 4px; border-radius: 4px;', responseData);
      }
    } catch (error) {
      console.error('%c [USER-PROFILE-UPDATE] ❌ EXCEPTION - Error triggering profile update', 'background: #142d4c; color: #ff6347; font-weight: bold; padding: 4px; border-radius: 4px;');
      console.error(`%c [USER-PROFILE-UPDATE] Error details:`, 'background: #142d4c; color: #ff6347; font-weight: bold; padding: 4px; border-radius: 4px;', error);
    } finally {
      // Clear the flag after request completes or fails
      setTimeout(() => {
        console.log('%c [USER-PROFILE-UPDATE] 🔚 Clearing update flag - future updates will be allowed', 'background: #142d4c; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
        sessionStorage.removeItem('profile_update_in_progress');
      }, 5000); // Keep flag for 5 seconds to prevent rapid consecutive calls
    }
  }, [endActiveConversation, createConversation]);

  // Listen for debug panel toggle events from layout
  useEffect(() => {
    const handleToggleDebugPanel = (e: CustomEvent<{ showDebugPanel: boolean }>) => {
      setShowDebugPanel(e.detail.showDebugPanel);
    };

    window.addEventListener('toggleDebugPanel', handleToggleDebugPanel as EventListener);

    return () => {
      window.removeEventListener('toggleDebugPanel', handleToggleDebugPanel as EventListener);
    };
  }, []);

  // Listen for message save events to track conversation ID
  useEffect(() => {
    const handleMessageSaved = (e: CustomEvent) => {
      const messageEvent = e as MessageSaveEvent;
      if (messageEvent.detail && messageEvent.detail.conversationId) {
        // Store the conversation ID in session storage
        sessionStorage.setItem('current_conversation_id', messageEvent.detail.conversationId);
        console.log(`%c [CONVERSATION-TRACKING] 📝 Conversation ID updated: ${messageEvent.detail.conversationId}`, 'background: #1e3a5f; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
      }
    };

    // Add event listeners
    window.addEventListener('message_saved', handleMessageSaved as EventListener);

    // Listen for display_resource_map events
    const handleDisplayResourceMap = (e: CustomEvent<{ searchId: string }>) => {
      console.log(`%c [MAP-DISPLAY] 🗺️ Displaying map for search ID: ${e.detail.searchId}`, 'background: #1e3a5f; color: #32CD32; font-weight: bold; padding: 4px; border-radius: 4px;');
      setCurrentSearchId(e.detail.searchId);
      setMapVisible(true);
    };

    window.addEventListener('display_resource_map', handleDisplayResourceMap as EventListener);

    // Listen for function execution events
    const handleFunctionStart = (e: CustomEvent<{ functionName: string }>) => {
      console.log(`%c [FUNCTION-START] ⚡ Function started: ${e.detail.functionName}`, 'background: #1e3a5f; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
      setCurrentFunctionCall(e.detail.functionName);
    };

    const handleFunctionEnd = () => {
      console.log(`%c [FUNCTION-END] ✅ Function execution completed`, 'background: #1e3a5f; color: #32CD32; font-weight: bold; padding: 4px; border-radius: 4px;');
      setCurrentFunctionCall(null);
    };

    window.addEventListener('function_execution_start', handleFunctionStart as EventListener);
    window.addEventListener('function_execution_end', handleFunctionEnd as EventListener);

    return () => {
      // Remove event listeners on cleanup
      window.removeEventListener('message_saved', handleMessageSaved as EventListener);
      window.removeEventListener('display_resource_map', handleDisplayResourceMap as EventListener);
      window.removeEventListener('function_execution_start', handleFunctionStart as EventListener);
      window.removeEventListener('function_execution_end', handleFunctionEnd as EventListener);
    };
  }, []);

  // Handle AI-initiated end session event with safe audio completion
  useEffect(() => {
    const handleAiEndSession = async () => {
      console.log('🔚 AI end_session function called, event received, safely stopping session');
      toast.success("AI is ending the session...");

      // Clear the manual timeout if it exists (when user clicked end and AI responded)
      if (manualEndTimeoutId) {
        console.log('Clearing manual end timeout since AI is handling the session end');
        clearTimeout(manualEndTimeoutId);
        manualEndTimeoutId = null;
      }

      // Use enhanced safe disconnect if audio stream is available
      if (audioStream) {
        console.log('Using enhanced safe disconnect to ensure audio completes');
        toast.info("Waiting for audio to complete...");

        try {
          // Use safe disconnect to wait for audio to finish
          await safeDisconnect(audioStream, stopSession);
          console.log('Safe disconnect completed successfully');

          // Silently trigger user profile update after session ends
          triggerUserProfileUpdate();
        } catch (error) {
          console.error('Error during safe disconnect:', error);
          // Fallback to regular disconnect
          stopSession();

          // Still try to update user profile
          triggerUserProfileUpdate();
        }
      } else {
        // Fallback to regular disconnect if no audio stream
        console.log('No audio stream available, using regular disconnect');
        stopSession();

        // Silently trigger user profile update after session ends
        triggerUserProfileUpdate();
      }
    };

    // Add event listener
    window.addEventListener('ai_end_session', handleAiEndSession);

    // Cleanup
    return () => {
      window.removeEventListener('ai_end_session', handleAiEndSession);
    };
  }, [stopSession, audioStream, safeDisconnect, triggerUserProfileUpdate]);

  // Format user profile data for AI instructions
  const formatUserProfileForAI = (profile: Record<string, unknown> | null): string => {
    if (!profile || Object.keys(profile).length === 0) {
      console.log('🚫 [USER-PROFILE] No profile data available to format for AI instructions');
      return '';
    }

    console.log('🔄 [USER-PROFILE] Formatting profile data for AI instructions');
    console.log('📊 [USER-PROFILE] Profile structure:',
      `categories: ${Object.keys(profile).join(', ')}`,
      `total size: ~${JSON.stringify(profile).length} chars`);

    // Define the framework for using the user profile data
    const framework = `
PERSONALIZED SUPPORT FRAMEWORK
When possible, use the user profile data to make the user feel like the current chat is a continuation of previous chats, and that you recall what is important about the user.
Natural Reference: Weave known information into responses naturally without stating "I remember" or "according to your data." Instead use phrases like:
"Since you've mentioned finding walks helpful before..."
"Considering your preference for practical advice..."
"Given your concerns about your brother..."
Continuity Building: Reference previous coping strategies when suggesting solutions: "Last time we discussed breaking tasks into smaller steps. Would you like to build on that approach?"
Growth Orientation: Treat known information as a starting point: "You've been working on motivation challenges. How have the small goals been working for you?"
Future Thinking: Ask questions that will make future chats more effective, and feel more personal. What you learn from this session will be remembered for future sessions.
User Profile Data
${JSON.stringify(profile, null, 2)}
Intensity Legend for user profile data.
1-2: Low
3: Moderate
4-5: High
`;

    const formattedSize = framework.length;
    console.log(`✅ [USER-PROFILE] Successfully formatted profile data (${formattedSize} chars) with ${Object.keys(profile).length} categories`);
    return framework;
  };

  // Handle start session
  const handleStartSession = async () => {
    console.log('[ResourceLocator] handleStartSession called - checking context:', {
      hasResourceLocatorContext: !!resourceLocatorContext,
      selectedResourceTitle: resourceLocatorContext?.selectedResource?.title
    });
    // Set immediate visual feedback
    setButtonClicked(true);

    // Make sure a book is selected
    if (!selectedBook) {
      toast.error('Please select a book first');
      setButtonClicked(false);
      return;
    }

    // Get the selected book's title and author
    const selectedBookObj = books.find(b => b.id === selectedBook);
    if (!selectedBookObj) {
      toast.error('Selected book not found');
      setButtonClicked(false);
      return;
    }

    // IMPORTANT: End any active conversation before starting a new one
    try {
      await endActiveConversation();
      console.log(`%c [START-SESSION] ✅ Successfully ended active conversation`, 'background: #1e3a5f; color: #32CD32; font-weight: bold; padding: 4px; border-radius: 4px;');
    } catch (error) {
      console.error(`%c [START-SESSION] ⚠️ Error ending conversation: ${error instanceof Error ? error.message : String(error)}`, 'background: #1e3a5f; color: #ff6347; font-weight: bold; padding: 4px; border-radius: 4px;');
    }

    // Clear current conversation ID from session storage
    sessionStorage.removeItem('current_conversation_id');
    console.log(`%c [START-SESSION] 🗑️ Cleared conversation ID from session storage`, 'background: #1e3a5f; color: #32CD32; font-weight: bold; padding: 4px; border-radius: 4px;');

    // Create a new conversation ID in the database before starting the session
    const userId = localStorage.getItem('userId');
    if (userId) {
      const newConversationId = await createConversation(userId);
      if (newConversationId) {
        console.log(`%c [START-SESSION] 🆕 Created new conversation ID: ${newConversationId}`, 'background: #1e3a5f; color: #32CD32; font-weight: bold; padding: 4px; border-radius: 4px;');
      } else {
        console.warn(`%c [START-SESSION] ⚠️ Failed to create new conversation ID, will rely on save-message fallback`, 'background: #1e3a5f; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
      }
    } else {
      console.warn(`%c [START-SESSION] ⚠️ No user ID found, cannot create conversation`, 'background: #1e3a5f; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
    }

    // Use custom AI instructions if available, otherwise generate default ones
    let baseInstructions;
    if (customAIInstructions) {
      console.log('Using custom AI instructions');
      baseInstructions = customAIInstructions;
    } else {
      console.log('Using default generated AI instructions');
      baseInstructions = generateBookInstructions(selectedBookObj.title, selectedBookObj.author);
    }

    // Format user profile data if available
    const userProfileSection = userProfile ? formatUserProfileForAI(userProfile) : '';

    // Apply hierarchical instructions with quest data and/or user profile
    let finalInstructions;
    if (questAiPrompt) {
      console.log('🎯 Integrating quest-specific data into system instructions');

      // Create hierarchical instructions with quest context at the top
      finalInstructions = `# QUEST CONTEXT

${questAiPrompt}

${questTitle ? `## Quest Title\n${questTitle}\n\n` : ''}${questIntroduction ? `## Introduction\n${questIntroduction}\n\n` : ''}${questChallenge ? `## Challenge\n${questChallenge}\n\n` : ''}${questStartingQuestion ? `## Starting Question\n${questStartingQuestion}\n\n` : ''}
# MENTAL HEALTH COMPANION FRAMEWORK

${baseInstructions}`;

      // Add user profile section if available
      if (userProfileSection) {
        const baseLength = finalInstructions.length;
        const profileLength = userProfileSection.length;
        const totalLength = baseLength + profileLength + 2; // +2 for the newlines

        console.log('👤 [USER-PROFILE] Adding user profile data to instructions with quest context');
        console.log(`📏 [USER-PROFILE] Size metrics: base=${baseLength} chars, profile=${profileLength} chars, total=${totalLength} chars`);

        finalInstructions = `${finalInstructions}\n\n${userProfileSection}`;
      }

      console.log('Created hierarchical instructions with quest context and user profile');
    } else {
      // If no quest data, just combine base instructions with user profile if available
      if (userProfileSection) {
        const baseLength = baseInstructions.length;
        const profileLength = userProfileSection.length;
        const totalLength = baseLength + profileLength + 2; // +2 for the newlines

        console.log('👤 [USER-PROFILE] Adding user profile data to instructions (without quest data)');
        console.log(`📏 [USER-PROFILE] Size metrics: base=${baseLength} chars, profile=${profileLength} chars, total=${totalLength} chars`);

        finalInstructions = `${baseInstructions}\n\n${userProfileSection}`;
      } else {
        console.log('🚫 [USER-PROFILE] No user profile data available to add to instructions');
        finalInstructions = baseInstructions;
      }
    }

    // Determine which function set to use based on the instructions or Future Pathways context
    const isMentalHealthMode = finalInstructions.includes('mental health companion') || futurePathwaysContext || resourceLocatorContext;
    const toolsToUse = isMentalHealthMode ? mentalHealthFunctions : bookFunctions;

    const modeDescription = resourceLocatorContext ? ' (Resource Locator)' : futurePathwaysContext ? ' (Future Pathways)' : '';
    console.log(`[ResourceLocator] Starting session in ${isMentalHealthMode ? 'mental health' : 'book discussion'} mode${modeDescription}`);
    console.log('[ResourceLocator] Resource locator context status:', {
      hasContext: !!resourceLocatorContext,
      contextMode: resourceLocatorContext?.mode,
      selectedResource: resourceLocatorContext?.selectedResource?.title
    });

    // Create hierarchical greeting instructions if quest data or Future Pathways context is available
    let finalGreeting;
    if (questAiPrompt) {
      console.log('🎯 Integrating quest-specific data into greeting instructions');
      finalGreeting = `# QUEST CONTEXT - BEGIN WITH THIS
${questAiPrompt}

${questTitle ? `## Quest Title\n${questTitle}\n\n` : ''}${questIntroduction ? `## Introduction\n${questIntroduction}\n\n` : ''}${questChallenge ? `## Challenge\n${questChallenge}\n\n` : ''}${questStartingQuestion ? `## Starting Question\n${questStartingQuestion}\n\n` : ''}

# GREETING INSTRUCTIONS
Begin your greeting by acknowledging the quest context above. This conversation is specifically for completing this quest. Incorporate this objective into a warm, supportive greeting.
`;
      // ${greetingInstructions}`;
      console.log('Replaced standard opening greeting with quest AI prompt, finalGreeting: \n', finalGreeting);
    } else if (futurePathwaysContext) {
      console.log('[FuturePathways] Using Future Pathways-specific greeting instructions');
      if (futurePathwaysContext.selectedPathway) {
        console.log('[FuturePathways] Selected pathway data:', futurePathwaysContext.selectedPathway);
        // Create pathway-specific greeting similar to resource locator
        finalGreeting = `# FUTURE PATHWAYS CONTEXT
You are helping a young person with their future pathways planning. They have selected the following pathway:

**${futurePathwaysContext.selectedPathway.title}**
${futurePathwaysContext.selectedPathway.subtitle}

${futurePathwaysContext.selectedPathway.description}

Category: ${futurePathwaysContext.selectedPathway.category}

# GREETING INSTRUCTIONS
Begin with a warm, encouraging greeting that acknowledges their specific choice of "${futurePathwaysContext.selectedPathway.title}". Show enthusiasm for their interest in future planning and explain how you'll help them with this specific pathway. Keep the tone supportive and motivating.`;
        console.log('[FuturePathways] Generated pathway-specific greeting for:', futurePathwaysContext.selectedPathway.title);
      } else {
        finalGreeting = await fetchFuturePathwaysGreeting(userId || undefined);
        console.log('[FuturePathways] Using general Future Pathways greeting');
      }
    } else if (resourceLocatorContext && resourceLocatorContext.selectedResource) {
      console.log('[ResourceLocator] Using Resource Locator-specific greeting instructions');
      console.log('[ResourceLocator] Selected resource data:', resourceLocatorContext.selectedResource);
      finalGreeting = await getResourceWelcomeContent(resourceLocatorContext.selectedResource, userId || undefined);
      console.log('[ResourceLocator] Generated greeting content length:', finalGreeting.length);
      console.log('[ResourceLocator] Using Resource Locator-specific greeting for:', resourceLocatorContext.selectedResource.title);
    } else {
      // Use default greeting if no quest, Future Pathways, or Resource Locator context
      finalGreeting = greetingInstructions;
    }

    // Log final summary of what's being sent to AI
    console.log('📋 [AI-INSTRUCTIONS-SUMMARY] Content being sent to AI:',
      `total size: ${finalInstructions.length} chars`,
      `has quest data: ${questAiPrompt ? 'yes' : 'no'}`,
      `has user profile: ${userProfile ? 'yes' : 'no'}`,
      `has future pathways context: ${futurePathwaysContext ? 'yes' : 'no'}`,
      `has resource locator context: ${resourceLocatorContext ? 'yes' : 'no'}`,
      `mode: ${resourceLocatorContext ? 'resource locator' : futurePathwaysContext ? `future pathways${futurePathwaysContext.selectedPathway ? ` (${futurePathwaysContext.selectedPathway.title})` : ''}` : finalInstructions.includes('mental health companion') ? 'mental health' : 'book discussion'}`
    );

    // Show complete instructions for testing if enabled
    if (showFullInstructions) {
      // Log in chunks to avoid truncation in some consoles
      console.log('📄 [FULL-AI-INSTRUCTIONS-BEGIN] ===============================');

      // Store in global for direct access via console
      if (typeof window !== 'undefined') {
        (window as Window & { lastAIInstructions?: string }).lastAIInstructions = finalInstructions;
        console.log('💡 TIP: Type window.showAIInstructions(window.lastAIInstructions) in console to view');
      }

      // Log the complete instructions without chunking
      console.log(finalInstructions);

      console.log('📄 [FULL-AI-INSTRUCTIONS-END] ===============================');
    }

    // Start the session with the WebRTC service, passing our instructions
    console.log('[ResourceLocator] About to start session with finalGreeting:', finalGreeting?.substring(0, 200) + '...');
    startSession({
      instructions: finalInstructions,
      voice: DEFAULT_VOICE,
      tools: toolsToUse,
      tool_choice: DEFAULT_TOOL_CHOICE,
      bookId: selectedBook,
      userId: localStorage.getItem('userId') || undefined,
      greetingInstructions: finalGreeting
    });

    // Include context info in success message if available
    if (questAiPrompt) {
      toast.success(`Starting quest session for "${selectedBookObj.title}"`);
    } else if (resourceLocatorContext) {
      toast.success(`Starting resource locator session for "${resourceLocatorContext.selectedResource.title}"`);
    } else if (futurePathwaysContext) {
      const pathwayTitle = futurePathwaysContext.selectedPathway?.title || 'Future Pathways';
      toast.success(`Starting ${pathwayTitle} session`);
    } else {
      toast.success(`Starting session for "${selectedBookObj.title}"`);
    }
  };

  // Handle text input submission
  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim() && isSessionActive) {
      sendTextMessage(textInput);
      setTextInput('');
    }
  };

  // Handle end session through AI with safe audio completion
  const handleEndSessionViaAI = async () => {
    if (isSessionActive) {
      console.log("🔚 End button clicked - sending message to AI to end session");

      // First approach: Ask AI to end gracefully
      sendTextMessage("Please end this session now.");
      toast.info("Asking AI to end the session...");

      // Second approach: Add a manual timeout for direct safe disconnection
      // This provides a fallback if the AI doesn't trigger the end_session function
      const endTimeout: number = setTimeout(async () => {
        console.log("🔚 Manual timeout - using safe disconnect");

        if (audioStream) {
          toast.info("Waiting for audio to complete before disconnecting...");

          try {
            // Use enhanced safe disconnect to wait for audio completion
            await safeDisconnect(audioStream, stopSession);
            console.log('Safe disconnect completed successfully');
            toast.success("Session ended safely");

            // Silently trigger user profile update after manual timeout
            triggerUserProfileUpdate();
          } catch (error) {
            console.error('Error during manual safe disconnect:', error);
            // Fallback to regular disconnect if safe disconnect fails
            stopSession();

            // Still attempt to update the user profile
            triggerUserProfileUpdate();
          }
        } else {
          // Fallback to regular disconnect if no audio stream
          stopSession();

          // Silently trigger user profile update after session ends
          triggerUserProfileUpdate();
        }
      }, 15000); // 15-second timeout

      // Track this timeout so we can cancel it if AI responds faster
      manualEndTimeoutId = endTimeout;
    }
  };

  // Get status indicator class
  // const getStatusIndicatorClass = () => {
  //   switch (status) {
  //     case 'Ready':
  //       return 'connected';
  //     case 'Session stopped':
  //       return 'disconnected';
  //     default:
  //       return status.includes('Error') ? 'disconnected' : 'connecting';
  //   }
  // };

  // Check if connection is in progress
  const isConnecting = status !== 'Ready' &&
    status !== 'Session stopped' &&
    status !== '' &&  // Don't show connecting when status is empty (initial state)
    !status.includes('Error') &&
    !isSessionActive;

  // Reset button clicked state when session becomes active or when there's an error
  useEffect(() => {
    if (isSessionActive || status.includes('Error')) {
      setButtonClicked(false);
    }
  }, [isSessionActive, status]);

  // Memoized values for BlueOrbVoiceUI to prevent infinite render loops
  const memoizedEffectiveVolume = useMemo(() => {
    return audioLevel > 0 ? audioLevel / 255 : currentVolume;
  }, [audioLevel, currentVolume]);

  const memoizedIsActuallyPlaying = useMemo(() => {
    return isAudioPlaying || (memoizedEffectiveVolume > 0.02);
  }, [isAudioPlaying, memoizedEffectiveVolume]);

  const memoizedIsAiThinking = useMemo(() => {
    return !!(diagnosticData && diagnosticData.isThinking);
  }, [diagnosticData]);

  const memoizedOnClick = useMemo(() => {
    return micMode === 'phone' ? toggleMute : undefined;
  }, [micMode, toggleMute]);

  // Debug logging with reduced frequency
  useEffect(() => {
    if (memoizedIsAiThinking) {
      console.log(`[THINKING-DOTS] AI is thinking, showing animation`);
    }
    // For debugging in console
    (window as Window & { __isAiThinking?: boolean }).__isAiThinking = memoizedIsAiThinking;
  }, [memoizedIsAiThinking]);

  useEffect(() => {
    // Only log volumes above a meaningful threshold to reduce console spam
    if (memoizedEffectiveVolume > 0.1 && Math.random() < 0.05) {
      console.log(`[AUDIO-VIZ] High volume detected: ${memoizedEffectiveVolume.toFixed(4)}, isActuallyPlaying: ${memoizedIsActuallyPlaying}`);
    }
  }, [memoizedEffectiveVolume, memoizedIsActuallyPlaying]);

  // Removed the complex DOM manipulation code for book selector
  // Book selection is now handled directly in the header component


  // Get the current speaking status for the indicator
  // const getSpeakingStatus = () => {
  //   // Check if user is currently speaking
  //   const isUserSpeaking = conversation.some(msg =>
  //     msg.role === 'user' && !msg.isFinal && msg.status === 'speaking'
  //   );

  //   // Show "Thinking..." when the AI is processing (including function calls)
  //   if (diagnosticData.isThinking) return { status: 'thinking', text: 'Thinking...' };
  //   if (isUserSpeaking) return { status: 'recording', text: 'Recording...' };
  //   if (currentVolume > 0.01) return { status: 'listening', text: 'Listening...' }; // Changed from 'AI Speaking...'
  //   if (isSessionActive) return { status: 'listening', text: 'Listening...' };
  //   return { status: 'inactive', text: 'Not Active' };
  // };

  return (
    <div className="main-container">
      {/* Start button overlay - positioned above chatbox with higher z-index */}
      {!isSessionActive && !booksLoading && (
        <div className="start-button-overlay">
          <button
            className={`control-button primary large-button rounded-full ${(status !== '' && isConnecting) || buttonClicked ? 'connecting' : ''}`}
            onClick={handleStartSession}
            disabled={!selectedBook || booksLoading || (status !== '' && isConnecting) || buttonClicked}
            style={{ borderRadius: "9999px" }}
          >
            {(status !== '' && isConnecting) || buttonClicked ? (
              <>
                <span className="spinner"></span>
                Connecting...
              </>
            ) : (
              questAiPrompt || questTitle ? "Begin Quest" : resourceLocatorContext ? "Find Resources" : futurePathwaysContext ? "Explore Pathways" : "Let's Talk"
            )}
          </button>
        </div>
      )}

      {/* Loading state */}
      {booksLoading && (
        <div className="flex justify-center items-center p-8">
          <p className="text-center">Loading books...</p>
        </div>
      )}

      {/* Audio visualizer with Blue Orb UI (when active) - positioned for dragging */}
      {isSessionActive && (
        <div className="visualization-container">
          <BlueOrbVoiceUI
            isSpeaking={memoizedIsActuallyPlaying}
            isThinking={memoizedIsAiThinking}
            isMuted={isMuted}
            currentVolume={memoizedEffectiveVolume}
            size={200}
            particleSizeMin={15}
            particleSizeMax={35}
            particleSpeedMin={0.1}
            particleSpeedMax={0.3}
            transitionSpeed={0.08}
            className="mx-auto"
            onClick={memoizedOnClick}
            draggable={true}
          />
        </div>
      )}

      {/* Conversation container - naturally fills available space */}
      <div className={`conversation-container ${!isSessionActive && !booksLoading ? 'conversation-container-with-overlay' : ''}`}>
        <div className="conversation-history" ref={conversationContainerRef}>
          {/* {conversation.length === 0 && (
            <div className="text-center text-gray-400 mt-10">
              {isSessionActive ?
                "Ask for a new question to begin..." :
                "Select a book, start a session, and ask for a question to begin."
              }
            </div>
          )} */}

          {conversation.map((msg, index) => (
            <React.Fragment key={msg.id || index}>
              <div
                className={`message ${msg.role} ${!msg.isFinal ? 'animate-pulse' : ''}`}
              >
                {typeof msg.text === 'function' ? '[Function]' : msg.text}
              </div>
              {/* Add clearfix div after each message */}
              <div style={{ clear: 'both' }}></div>

              {/* Show Future Pathways Cards after the first AI message (greeting) */}
              {futurePathwaysContext && !futurePathwaysContext.selectedPathway && index === 0 && msg.role === 'assistant' && (
                <FuturesPathwaysCards
                  onFunctionCall={(functionName) => {
                    // Create a text message that would prompt the AI to call this function
                    const functionPrompts: Record<string, string> = {
                      'futures_assessment_function': 'I would like to take the futures pathways assessment to understand my current situation, interests, and goals.',
                      'pathway_exploration_function': 'I want to explore different career options and educational pathways that match my interests and skills.',
                      'educational_guidance_function': 'I need information about educational pathways including colleges, trade schools, GED programs, and financial aid options.',
                      'skill_building_function': 'I want to work on building my life skills and job readiness, including resume writing and interview preparation.',
                      'goal_planning_function': 'I need help breaking down my goals into manageable steps and creating an action plan.',
                      'resource_connection_function': 'I want to find networking opportunities, volunteer work, internships, and ways to gain experience in my field of interest.'
                    };

                    const promptText = functionPrompts[functionName] || `Please help me with ${functionName}`;
                    sendTextMessage(promptText);
                  }}
                />
              )}
            </React.Fragment>
          ))}

          {/* Progress message for long-running functions */}
          {currentFunctionCall && (
            <div className="message assistant animate-pulse">
              {currentFunctionCall === 'resource_search_function' && (
                <div className="flex items-center gap-2">
                  <div className="inline-block">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                  <span>Searching for resources... This may take several minutes as I check multiple databases for the most relevant and up-to-date information.</span>
                </div>
              )}
              {currentFunctionCall === 'display_map_function' && (
                <div className="flex items-center gap-2">
                  <div className="inline-block">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                  <span>Preparing the map view with resource locations...</span>
                </div>
              )}
              {!['resource_search_function', 'display_map_function'].includes(currentFunctionCall) && (
                <div className="flex items-center gap-2">
                  <div className="inline-block">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                  <span>Processing your request...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Text input */}
        <form onSubmit={handleSendText} className="input-container">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={isSessionActive ? "Type your message and press Enter..." : "Select *Let's Talk* to begin..."}
            className="text-input"
            disabled={!isSessionActive}
          />
          <button
            type="submit"
            className="send-button-new"
            disabled={!isSessionActive || !textInput.trim()}
            aria-label="Send message"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 12h16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>

      {/* Fixed position mic button - only needed for walkie-talkie mode now */}
      {isSessionActive && micMode === 'walkie-talkie' && (
        <button
          className="fixed-mic-button"
          onMouseDown={isMuted ? () => toggleMute() : undefined}
          onTouchStart={isMuted ? () => toggleMute() : undefined}
          onMouseUp={!isMuted ? () => toggleMute() : undefined}
          onTouchEnd={!isMuted ? () => toggleMute() : undefined}
          onMouseLeave={!isMuted ? () => toggleMute() : undefined}
          title="Press and hold to talk"
        >
          {isMuted ? (
            <img src="/mic-muted.svg" alt="Press to talk" />
          ) : (
            <img src="/mic-unmuted.svg" alt="Release to mute" />
          )}
        </button>
      )}

      {/* End Session button */}
      {isSessionActive && (
        <div className="flex justify-start items-center mb-8">
          <button
            className="control-button danger"
            onClick={handleEndSessionViaAI}
            title="End session"
          >
            <Power />
          </button>
        </div>
      )}

      {/* Map Resources Display */}
      <MapResourcesDisplay
        searchId={currentSearchId || undefined}
        visible={mapVisible}
        onClose={handleCloseMap}
      />


      {/* Debug panel */}
      {showDebugPanel && (
        <div className="debug-panel">
          <h3 className="font-bold">Debug Information <span className="text-xs text-blue-400 ml-2">v11.0.4 - Enhanced Audio Monitoring</span></h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p><strong>Status:</strong> {status}</p>
              <p><strong>Active:</strong> {isSessionActive ? 'Yes' : 'No'}</p>
              <p><strong>Muted:</strong> {isMuted ? 'Yes' : 'No'}</p>
              <p><strong>Selected Book:</strong> {selectedBook}</p>
              <p><strong>Mode:</strong> {customAIInstructions?.includes('mental health companion') ? 'Mental Health Companion' : 'Book Discussion'}</p>
              <p><strong>Message Count:</strong> {conversation.length}</p>

              {/* User Profile Info */}
              <div className="mt-2 p-2 bg-blue-900/30 rounded">
                <p className="font-semibold">User Profile:</p>
                <p><strong>Available:</strong> {userProfile ? 'Yes' : 'No'}</p>
                {userProfileLoading && <p><strong>Status:</strong> Loading...</p>}
                {userProfileError && <p><strong>Error:</strong> {userProfileError}</p>}
                {userProfile && <p><strong>Data Categories:</strong> {Object.keys(userProfile).join(', ')}</p>}
              </div>

              {/* Enhanced audio monitoring stats */}
              <div className="mt-2 p-2 bg-blue-900/30 rounded">
                <p className="font-semibold">Enhanced Audio Monitoring:</p>
                <p><strong>Audio Playing:</strong> {isAudioPlaying ? 'Yes' : 'No'}</p>
                <p><strong>Audio Level:</strong> {audioLevel > 0 ? (audioLevel / 255).toFixed(4) : currentVolume.toFixed(4)}</p>
                {audioState && (
                  <>
                    <p><strong>Queue Length:</strong> {audioState.queueLength}</p>
                    <p><strong>Pending Chunks:</strong> {audioState.pendingChunksCount}</p>
                    <p><strong>Audio Context:</strong> {audioState.audioContextState}</p>
                  </>
                )}
              </div>

              {/* Quest data if available */}
              {questTitle && (
                <div className="mt-2 border-t border-gray-700 pt-2">
                  <p><strong>Quest Title:</strong> {questTitle}</p>
                  {questIntroduction && <p><strong>Has Introduction:</strong> Yes</p>}
                  {questChallenge && <p><strong>Has Challenge:</strong> Yes</p>}
                  {questStartingQuestion && <p><strong>Has Starting Question:</strong> Yes</p>}
                </div>
              )}

              {/* Mic Mode Toggle */}
              <div className="mt-4 p-2 bg-gray-800 rounded">
                <p className="font-medium mb-2">Mic Input Mode:</p>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={micMode === 'phone'}
                      onChange={() => {
                        setMicMode('phone');
                        localStorage.setItem('micMode', 'phone');
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm" title="Tap to toggle mic on/off">Phone Mode</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={micMode === 'walkie-talkie'}
                      onChange={() => {
                        setMicMode('walkie-talkie');
                        localStorage.setItem('micMode', 'walkie-talkie');
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm" title="Press and hold to talk">Walkie-Talkie Mode</span>
                  </label>
                </div>
              </div>

              {/* Debug Logging Toggle */}
              <div className="mt-4 p-2 bg-gray-800 rounded">
                <p className="font-medium mb-2">Debug Logging:</p>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={showFullInstructions}
                      onChange={() => setShowFullInstructions(!showFullInstructions)}
                      className="mr-2"
                    />
                    <span className="text-sm">Show Full AI Instructions in Console</span>
                  </label>

                  {/* Direct button to check AI Instructions */}
                  <button
                    className="mt-2 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    onClick={() => {
                      if (typeof window !== 'undefined' &&
                        (window as Window & { lastAIInstructions?: string }).lastAIInstructions) {
                        const typedWindow = window as Window & {
                          showAIInstructions?: (instructions: string) => string;
                          lastAIInstructions?: string
                        };
                        if (typedWindow.showAIInstructions && typedWindow.lastAIInstructions) {
                          typedWindow.showAIInstructions(typedWindow.lastAIInstructions);
                        }
                      } else {
                        console.log('No AI instructions available yet. Start a session first.');
                        alert('No AI instructions available yet. Start a session first.');
                      }
                    }}
                  >
                    Show Last AI Instructions in Console
                  </button>
                </div>
              </div>
            </div>

            <div>
              <p><strong>Error:</strong> {errorMessage || 'None'}</p>
              <p><strong>Function Error:</strong> {functionError || 'None'}</p>
              <p><strong>Last Function Result:</strong> {lastFunctionResult ? JSON.stringify(lastFunctionResult).substring(0, 50) + '...' : 'None'}</p>
            </div>
          </div>

          {/* Function Usage Stats */}
          <div className="mt-4">
            <h4 className="text-sm font-semibold">Function Usage Analysis:</h4>
            <div className="bg-black/50 p-2 rounded mt-1">
              {(diagnosticData as DiagnosticData).responsePatterns ? (
                <div>
                  <p><span className="text-green-400">Function calls:</span> {(diagnosticData as DiagnosticData).responsePatterns?.functionCalls}</p>
                  <p><span className="text-yellow-400">Direct responses:</span> {(diagnosticData as DiagnosticData).responsePatterns?.directResponses}</p>
                  <p><span className="text-blue-400">Last response type:</span> {(diagnosticData as DiagnosticData).responsePatterns?.lastResponseType || 'none'}</p>
                  {(diagnosticData as DiagnosticData).responsePatterns?.lastFunctionName && (
                    <p><span className="text-purple-400">Last function called:</span> {(diagnosticData as DiagnosticData).responsePatterns?.lastFunctionName}</p>
                  )}
                  <p><span className="text-teal-400">Function usage ratio:</span> {
                    ((diagnosticData as DiagnosticData).responsePatterns?.functionCalls || 0) +
                      ((diagnosticData as DiagnosticData).responsePatterns?.directResponses || 0) > 0
                      ? `${Math.round((((diagnosticData as DiagnosticData).responsePatterns?.functionCalls || 0) /
                        (((diagnosticData as DiagnosticData).responsePatterns?.functionCalls || 0) +
                          ((diagnosticData as DiagnosticData).responsePatterns?.directResponses || 0))) * 100)}%`
                      : 'N/A'
                  }</p>
                </div>
              ) : (
                <p className="text-gray-400">No response pattern data available yet</p>
              )}
            </div>
          </div>

          {/* WebRTC Diagnostics */}
          <div className="mt-4">
            <h4 className="text-sm font-semibold">WebRTC Diagnostics:</h4>
            <pre className="text-xs bg-black/50 p-2 rounded mt-1 overflow-x-auto">
              {JSON.stringify(diagnosticData, null, 2)}
            </pre>
          </div>

          {/* Theme Debug Integration */}
          <ThemeDebug />
        </div>
      )}

      {/* Debug panel element (created dynamically in useEffect) */}
      <div id="debug-panel"></div>
    </div>
  );
}