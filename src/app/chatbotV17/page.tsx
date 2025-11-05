// src/app/chatbotV17/page.tsx
// V17 Eleven Labs Implementation - Exact copy of V16 structure with Eleven Labs backend

"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useElevenLabsStore } from '@/stores/elevenlabs-store';
import { useElevenLabsConversation } from '@/hooksV17/use-elevenlabs-conversation';
import { useChatState } from '@/contexts/chat-state-context';
import { AudioOrbV15 } from './components/AudioOrbV15';
import { SignInDialog } from './components/SignInDialog';
import { DemoButtons } from './components/DemoButtons';
import { VoiceSettingsModal } from './components/VoiceSettingsModal';
import SearchBar from './components/therapist-matching/SearchBar';
import FilterTags, { FilterTag } from './components/therapist-matching/FilterTags';
import TherapistList from './components/therapist-matching/TherapistList';
import { Therapist } from './components/therapist-matching/TherapistCard';
import DetailedTherapistView, { DetailedTherapist } from './components/therapist-matching/DetailedTherapistView';
import { useSearchParams, useRouter } from 'next/navigation';

// Type for pending demo data
interface PendingDemo {
  voiceId: string;
  promptAppend: string;
  doctorName: string;
}

// Extend window interface to include pending demo
declare global {
  interface Window {
    __pendingDemo?: PendingDemo;
  }
}

export default function ChatBotV17Page() {
  const { user } = useAuth();
  const { setSelectedTherapist: setChatStateTherapist } = useChatState();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Check if in provider mode
  const isProviderMode = searchParams.get('provider') === 'true';
  const [isSignInDialogOpen, setIsSignInDialogOpen] = useState(false);
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false);

  // Debug modal state
  useEffect(() => {
    console.log('[V17] Voice settings modal state changed:', isVoiceSettingsOpen);
  }, [isVoiceSettingsOpen]);

  // Handler for opening advanced voice settings
  const handleAdvancedSettings = useCallback(() => {
    console.log('[V17] Advanced settings button clicked, opening modal');
    setIsVoiceSettingsOpen(true);
  }, []);
  const [userMessage, setUserMessage] = useState('');
  const conversationHistoryRef = useRef<HTMLDivElement>(null);

  // Therapist matching state
  const [showMatching, setShowMatching] = useState(true);
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [filterTags, setFilterTags] = useState<FilterTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [selectedTherapist, setSelectedTherapist] = useState<Therapist | null>(null);
  const [detailedTherapistData, setDetailedTherapistData] = useState<DetailedTherapist | null>(null);

  // Mic hint callout state
  const [hasSeenMicHint, setHasSeenMicHint] = useState(false);
  const [showMicHint, setShowMicHint] = useState(false);

  // ✅ FIX: Use selectors for reactive state (bubble visibility)
  const isUserSpeaking = useElevenLabsStore((state) => state.isUserSpeaking);
  const isThinking = useElevenLabsStore((state) => state.isThinking);

  // Keep store object for actions and non-reactive data
  const store = useElevenLabsStore();

  const {
    startSession,
    endSession,
    isConnected,
    setVolume,
    conversationInstance,
    isPreparing
  } = useElevenLabsConversation();

  // V17 Note: ElevenLabs handles audio recording - no need for chunk uploads
  // Audio is retrieved via ElevenLabs API using elevenlabs_conversation_id

  // Track if cleanup has already been initiated to prevent double cleanup
  const cleanupInitiatedRef = useRef(false);

  // Reusable cleanup function (NOT async to use in useEffect cleanup)
  const performCleanup = useCallback(() => {
    if (cleanupInitiatedRef.current) {
      return;
    }

    cleanupInitiatedRef.current = true;

    try {
      // WebRTC cleanup (fire-and-forget since we're unmounting/navigating)
      if (isConnected) {
        endSession().catch(err =>
          console.error('[V17] Error during navigation cleanup:', err)
        );
      }

      // Clear conversation history
      store.clearConversation();
    } catch (error) {
      console.error('[V17] Cleanup error:', error);
    }
  }, [isConnected, endSession, store]);

  // Handle navigation away from page (React navigation - logo click, Link components)
  useEffect(() => {
    return () => {
      performCleanup();
    };
  }, [performCleanup]);

  // Handle browser navigation (back button, refresh, close tab)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      performCleanup();

      // Optional: Show warning if session is active
      if (isConnected) {
        e.preventDefault();
        e.returnValue = ''; // Some browsers require this
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [performCleanup, isConnected]);

  // Handle conversation start after auth
  const handleLetsTalk = useCallback(async () => {
    console.log('[V17] Authenticated user ready to talk');
    try {
      // Create conversation if needed
      if (!store.conversationId) {
        await store.createConversation();
      }

      // Start Eleven Labs session with triage specialist
      await startSession('triage');
      console.log('[V17] ✅ Eleven Labs conversation started successfully');
    } catch (error) {
      console.error('[V17] ❌ Failed to start conversation:', error);
    }
  }, [store, startSession]);

  // Handle Let's Talk button click
  const handleLetsTalkClick = useCallback(() => {
    if (!user) {
      // User is not signed in - show sign-in dialog
      setIsSignInDialogOpen(true);
    } else {
      // User is signed in - start conversation
      console.log('[V17] Starting conversation for authenticated user');
      handleLetsTalk();
    }
  }, [user, handleLetsTalk]);

  // Handle demo button clicks (Dr Mattu, Dr Judy)
  const handleDemoStart = useCallback((voiceId: string, promptAppend: string, doctorName: string, forceStart = false) => {
    const startDemo = async () => {
      console.log(`[V17] Starting demo conversation with ${doctorName}`, { voiceId, promptAppendLength: promptAppend.length });
      try {
        // Create conversation if needed
        if (!store.conversationId) {
          await store.createConversation();
        }

        // Start session with demo parameters
        await startSession('triage', voiceId, promptAppend);
        console.log(`[V17] ✅ ${doctorName} demo conversation started successfully`);
      } catch (error) {
        console.error(`[V17] ❌ Failed to start ${doctorName} demo conversation:`, error);
      }
    };

    if (!user && !forceStart) {
      // User is not signed in - show sign-in dialog, then start demo
      setIsSignInDialogOpen(true);
      // Store demo params for after sign in
      window.__pendingDemo = { voiceId, promptAppend, doctorName };
    } else {
      // User is signed in OR forceStart is true - start demo immediately
      startDemo();
    }
  }, [user, store, startSession]);

  // Handle therapist AI preview (replaces demo buttons)
  const handleTryAIPreview = useCallback(async (therapist: Therapist) => {
    console.log('[V17] Starting AI preview for therapist:', therapist.fullName);
    console.log('[V17] 🔍 Therapist object keys:', Object.keys(therapist));
    console.log('[V17] 🔍 Has openingStatement?', !!therapist.openingStatement);
    console.log('[V17] 🔍 openingStatement value:', therapist.openingStatement);
    setSelectedTherapist(therapist);
    setLoadingPrompt(true);
    setPromptError(null); // Clear any previous errors

    // Hide all views to show chat interface
    setShowMatching(false);
    setShowDetailedView(false);
    setDetailedTherapistData(null);

    try {
      // Fetch generated comprehensive therapist prompt from database
      console.log('[V17] Fetching generated therapist prompt for:', therapist.id);
      const response = await fetch(`/api/admin/s2/therapist-prompts?therapistId=${therapist.id}`);

      if (!response.ok) {
        console.error('[V17] ❌ Failed to fetch therapist prompt - HTTP error');
        throw new Error('Failed to fetch therapist prompt from server');
      }

      const data = await response.json();

      if (data.prompts && data.prompts.length > 0) {
        // Use the comprehensive generated prompt (latest version)
        const latestPrompt = data.prompts[0];
        const generatedTherapistPrompt = latestPrompt.prompt_text;

        console.log('[V17] ✅ Using generated therapist prompt:', {
          promptId: latestPrompt.id,
          version: latestPrompt.prompt_version,
          promptLength: generatedTherapistPrompt.length
        });

        // Use therapist's cloned voice if available
        const voiceId = therapist.clonedVoiceId || 'EmtkmiOFoQVpKRVpXH2B';

        if (therapist.clonedVoiceId) {
          console.log(`[V17] 🎤 Using cloned voice: ${therapist.clonedVoiceId} for ${therapist.fullName}`);
        } else {
          console.log(`[V17] 🎤 Using default voice (no cloned voice available for ${therapist.fullName})`);
        }

        // Log opening statement if available
        if (therapist.openingStatement) {
          console.log(`[V17] 👋 Using custom opening statement for ${therapist.fullName}:`, therapist.openingStatement.substring(0, 100) + '...');
        } else {
          console.log(`[V17] 👋 No custom opening statement for ${therapist.fullName}, using default`);
        }

        // ALWAYS create a NEW conversation for each AI Preview (each gets unique access code)
        console.log('[V17] Creating NEW conversation for AI Preview');
        const internalConversationId = await store.createConversation();
        console.log('[V17] ✅ Internal conversation ID created:', internalConversationId);

        // Start session with ai_preview specialist + comprehensive generated prompt + cloned voice + custom opening statement
        // Pass the internal conversation ID so it can be saved with the ElevenLabs conversation ID
        await startSession('ai_preview', voiceId, generatedTherapistPrompt, therapist.openingStatement, internalConversationId);

        console.log(`[V17] ✅ AI preview started with comprehensive prompt for: ${therapist.fullName}`);
      } else {
        // No generated prompt found - show error to user
        console.error('[V17] ❌ No generated prompt found for therapist:', therapist.fullName);
        const errorMessage = `AI Preview for ${therapist.fullName} has not been generated yet. It takes about ten minutes to generate the AI Preview after the provider selects the button to update or generate.`;
        setPromptError(errorMessage);

        // Restore matching view to show error
        setShowMatching(true);
        setLoadingPrompt(false);
        throw new Error(errorMessage);
      }
    } catch (error) {
      // Error fetching prompt - show error to user
      console.error('[V17] ❌ Error starting AI preview:', error);

      const errorMessage = error instanceof Error ? error.message : 'Failed to start AI preview';

      // Only set error if we haven't already set one
      if (!promptError) {
        setPromptError(errorMessage);
      }

      // Restore matching view to show error
      setShowMatching(true);
    } finally {
      setLoadingPrompt(false);
    }
  }, [store, startSession, promptError]);

  // Search therapists (or fetch user's own AI Preview in provider mode)
  const searchTherapists = useCallback(async () => {
    setLoading(true);
    try {
      if (isProviderMode) {
        // Provider mode: fetch user's own AI Preview
        if (!user?.uid) {
          console.log('[V17] Provider mode: No user authenticated');
          setTherapists([]);
          return;
        }

        console.log('[V17] Provider mode: Fetching user AI Preview');
        const response = await fetch('/api/therapists/my-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid })
        });

        if (!response.ok) {
          throw new Error('Failed to fetch AI Preview');
        }

        const data = await response.json();
        if (data.success && data.therapist) {
          setTherapists([data.therapist]);
          console.log('[V17] Provider mode: Loaded user AI Preview:', data.therapist.fullName);
        } else {
          console.error('[V17] Provider mode: No AI Preview found');
          setTherapists([]);
        }
      } else {
        // Patient mode: search all therapists
        const params = new URLSearchParams();
        if (searchQuery.trim()) {
          params.set('q', searchQuery.trim());
        }

        // Add filter tags as parameters
        filterTags.forEach(tag => {
          params.set(tag.type, tag.label);
        });

        const response = await fetch(`/api/therapists/search?${params}`);
        if (!response.ok) {
          throw new Error('Failed to search therapists');
        }

        const data = await response.json();
        if (data.success) {
          setTherapists(data.therapists);
        } else {
          console.error('[V17] Therapist search failed:', data.error);
          setTherapists([]);
        }
      }
    } catch (error) {
      console.error('[V17] Therapist search error:', error);
      setTherapists([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterTags, isProviderMode, user?.uid]);

  // Load therapists on page load (browse mode)
  useEffect(() => {
    console.log('[V17] Loading default therapists on page load');
    searchTherapists();
  }, [searchTherapists]);

  // Debounce search when query/filters change (patient mode only)
  useEffect(() => {
    if (isProviderMode) return; // Skip search debouncing in provider mode

    const timer = setTimeout(() => {
      searchTherapists();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, filterTags, searchTherapists, isProviderMode]);

  // Handle filter tag removal
  const handleRemoveTag = useCallback((tagId: string) => {
    setFilterTags(prev => prev.filter(tag => tag.id !== tagId));
  }, []);

  // Handle view more (detailed view)
  const handleViewMore = useCallback(async (therapist: Therapist) => {
    console.log('[V17] Loading detailed view for therapist:', therapist.fullName);
    setLoading(true);

    try {
      // Fetch complete therapist data from both S2 tables
      const response = await fetch('/api/therapists/detailed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ therapistId: therapist.id })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch detailed therapist data');
      }

      const data = await response.json();
      if (data.success && data.therapist) {
        setDetailedTherapistData(data.therapist);
        setShowMatching(false);
        setShowDetailedView(true);
        console.log('[V17] Detailed therapist data loaded successfully');
      } else {
        console.error('[V17] Failed to load detailed therapist data:', data.error);
        // Fallback: use basic therapist data
        setDetailedTherapistData(therapist);
        setShowMatching(false);
        setShowDetailedView(true);
      }
    } catch (error) {
      console.error('[V17] Error loading detailed therapist data:', error);
      // Fallback: use basic therapist data
      setDetailedTherapistData(therapist);
      setShowMatching(false);
      setShowDetailedView(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if user has completed intake form
  const checkIntakeStatus = useCallback(async (): Promise<boolean> => {
    try {
      // Check localStorage first (fast)
      const localAccessCode = localStorage.getItem('v17_patient_access_code');
      if (localAccessCode) {
        console.log('[V17] Intake already completed (found in localStorage)');
        return true;
      }

      // Check database if user is authenticated
      if (user?.uid) {
        console.log('[V17] Checking intake status for user:', user.uid);
        const response = await fetch(`/api/patient-intake/get?userId=${user.uid}`);
        const result = await response.json();

        if (response.ok && result.success && result.hasData) {
          console.log('[V17] Intake found in database');
          // Cache the access code in localStorage for next time
          localStorage.setItem('v17_patient_access_code', result.data.access_code);
          return true;
        }
      }

      console.log('[V17] No intake found');
      return false;
    } catch (error) {
      console.error('[V17] Error checking intake status:', error);
      return false; // Assume no intake on error
    }
  }, [user?.uid]);

  // Handle back to matching from detailed view
  const handleBackToMatchingFromDetail = useCallback(() => {
    console.log('[V17] Returning to matching from detailed view');
    setShowDetailedView(false);
    setDetailedTherapistData(null);
    setShowMatching(true);
  }, []);

  // Handle back to matching from chat (explicit "End Session" button)
  const handleBackToMatching = useCallback(async () => {
    // Reset flag first since this is a deliberate user action (not auto-cleanup)
    cleanupInitiatedRef.current = false;

    try {
      // End the WebRTC session first (await since this is explicit user action)
      if (isConnected) {
        await endSession();
      }
    } catch (error) {
      console.error('[V17] Error ending session:', error);
    }

    // Clear conversation history AND conversationId (so next session creates new conversation with new access code)
    store.clearConversation();
    store.setConversationId(null);
    console.log('[V17] Cleared conversationId - next session will create NEW conversation');

    // Check if user needs to complete intake form
    const hasCompletedIntake = await checkIntakeStatus();

    if (!hasCompletedIntake) {
      // User needs to complete intake - redirect to intake page
      console.log('[V17] Redirecting to intake page (required after first session)');
      router.push('/chatbotV17/intake?returnTo=therapistMatching');
      return; // Don't show matching page
    }

    // User has completed intake - show matching page
    console.log('[V17] Returning to therapist matching page');
    setShowMatching(true);
    setShowDetailedView(false);
    setDetailedTherapistData(null);
    setSelectedTherapist(null);
    setChatStateTherapist(null);
  }, [store, isConnected, endSession, setChatStateTherapist, checkIntakeStatus, router]);

  // Register/unregister handler using custom events
  useEffect(() => {
    let chatEvents: InstanceType<typeof import('@/utils/chat-events').ChatEvents> | null = null;

    import('@/utils/chat-events').then(({ ChatEvents }) => {
      chatEvents = ChatEvents.getInstance();
      chatEvents.setEndChatHandler(handleBackToMatching);
    });

    return () => {
      if (chatEvents) {
        chatEvents.setEndChatHandler(null);
      }
    };
  }, [handleBackToMatching]);

  // Update connection state using custom events
  useEffect(() => {
    import('@/utils/chat-events').then(({ ChatEvents }) => {
      const chatEvents = ChatEvents.getInstance();
      chatEvents.setConnectionState(isConnected);
    });
  }, [isConnected]);

  // Only sync therapist info - don't sync isConnected (causes infinite loop)
  useEffect(() => {
    setChatStateTherapist(selectedTherapist);
  }, [selectedTherapist]);


  // Handle text message input
  const handleInputChange = useCallback((value: string) => {
    setUserMessage(value);
  }, []);

  // Handle sending text message
  const handleSendMessage = useCallback(() => {
    if (!userMessage.trim() || !isConnected) return;

    console.log('[V17] 📤 Sending text message:', userMessage);

    // Start thinking state immediately when user sends text message (equivalent to OpenAI's onAudioBufferCommitted)
    store.setIsThinking(true);
    console.log('[V17] 🧠 Text message sent - setting thinking state to true');

    // Add user message to conversation history
    const messageId = `v17-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    store.addMessage({
      id: messageId,
      role: 'user',
      text: userMessage.trim(),
      timestamp: new Date().toISOString(),
      isFinal: true,
      status: 'final',
    });

    // Send via ElevenLabs conversation instance (not conversation history)
    const messageText = userMessage.trim();

    // Try different method names based on SDK version
    if (conversationInstance) {
      console.log('[V17] 🔍 Available conversation methods:', Object.keys(conversationInstance));

      // Try sendUserMessage first (most likely)
      if (typeof conversationInstance.sendUserMessage === 'function') {
        console.log('[V17] ✅ Using sendUserMessage method');
        conversationInstance.sendUserMessage(messageText);
      }
      // Try sendMessage as fallback (with type assertion)
      else if (typeof (conversationInstance as unknown as { sendMessage?: (text: string) => void }).sendMessage === 'function') {
        console.log('[V17] ✅ Using sendMessage method');
        (conversationInstance as unknown as { sendMessage: (text: string) => void }).sendMessage(messageText);
      }
      // Try sendTextMessage as fallback (with type assertion)
      else if (typeof (conversationInstance as unknown as { sendTextMessage?: (text: string) => void }).sendTextMessage === 'function') {
        console.log('[V17] ✅ Using sendTextMessage method');
        (conversationInstance as unknown as { sendTextMessage: (text: string) => void }).sendTextMessage(messageText);
      }
      else {
        console.error('[V17] ❌ No suitable send method found on conversationInstance:', {
          availableMethods: Object.keys(conversationInstance),
          conversationInstance
        });
      }
    } else {
      console.error('[V17] ❌ conversationInstance not available - typed messages cannot reach AI');
    }

    // Clear input
    setUserMessage('');
  }, [userMessage, isConnected, store, conversationInstance]);

  // Handle mute controls
  const toggleMicrophone = useCallback(() => {
    const newMuteState = !store.isMuted;
    console.log(`[V17] 🎤 ${newMuteState ? 'MUTING' : 'UNMUTING'} microphone`);

    // Immediately update state
    store.setIsMuted(newMuteState);

    // Visual feedback for user
    if (newMuteState) {
      console.log('[V17] 🔇 MICROPHONE MUTED - AI should not hear new audio input');
    } else {
      console.log('[V17] 🎤 MICROPHONE UNMUTED - AI can now hear audio input');
    }

    // Double-check the mute state was updated
    setTimeout(() => {
      console.log('[V17] 🎤 Final mute state:', {
        storeIsMuted: store.isMuted,
        expectedState: newMuteState,
        stateMatches: store.isMuted === newMuteState
      });
    }, 100);
  }, [store]);

  const toggleAudioOutputMute = useCallback(() => {
    console.log('[V17] 🔊 Toggle speaker:', !store.isAudioOutputMuted);
    store.setIsAudioOutputMuted(!store.isAudioOutputMuted);
    // Also adjust volume
    if (setVolume) {
      setVolume(store.isAudioOutputMuted ? 1.0 : 0.0);
    }
  }, [store, setVolume]);

  // Auto-scroll conversation to bottom when new messages arrive
  useEffect(() => {
    if (conversationHistoryRef.current && store.conversationHistory.length > 0) {
      const scrollContainer = conversationHistoryRef.current;

      // Use requestAnimationFrame to ensure DOM has updated before scrolling
      requestAnimationFrame(() => {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      });
    }
  }, [store.conversationHistory]);

  // Show mic hint callout after WebRTC connects (with delay)
  useEffect(() => {
    if (isConnected && !hasSeenMicHint) {
      const timer = setTimeout(() => {
        setShowMicHint(true);
      }, 500); // Show after 500ms delay

      return () => clearTimeout(timer);
    } else {
      setShowMicHint(false);
    }
  }, [isConnected, hasSeenMicHint]);

  // Hide mic hint when user unmutes
  useEffect(() => {
    if (showMicHint && !store.isMuted) {
      setShowMicHint(false);
      setHasSeenMicHint(true);
    }
  }, [store.isMuted, showMicHint]);

  // Show detailed therapist view
  if (showDetailedView && detailedTherapistData) {
    return (
      <div className="chatbot-v16-wrapper">
        <div className="main-container">
          <DetailedTherapistView
            therapist={detailedTherapistData}
            onBack={handleBackToMatchingFromDetail}
            onTryAIPreview={handleTryAIPreview}
            loadingPrompt={loadingPrompt}
          />
        </div>
      </div>
    );
  }

  // Show matching interface first, then conversation
  if (showMatching) {
    return (
      <div className="chatbot-v16-wrapper">
        <div className="main-container" style={{ backgroundColor: 'var(--bg-secondary)', paddingTop: '80px' }}>
          {/* Header */}
          <div className="text-center mb-4">
            {isProviderMode ? (
              <>
                <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                  Test Your AI Preview
                </h1>
                <p className="text-xl max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
                  Experience your AI Preview as patients would see it.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                  Find Your Therapist
                </h1>
                <p className="text-base max-w-4xl mx-auto mb-2 px-4" style={{ color: 'var(--text-secondary)' }}>
                  Browse our network of mental health professionals and start your journey by trying their AI Previews.
                </p>
                <p className="text-sm max-w-3xl mx-auto px-4" style={{ color: 'var(--text-secondary)' }}>
                  Note: AI Previews are not meant to administer treatment, but rather to give you a genuine feel for how your provider communicates before scheduling your first appointment.
                </p>
              </>
            )}
          </div>

          {/* Search and Filters - Only show in patient mode */}
          {!isProviderMode && (
            <div className="mb-0">
              <SearchBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                placeholder="Search by name, location, specialty..."
              />
              <FilterTags
                activeTags={filterTags}
                onRemoveTag={handleRemoveTag}
              />
            </div>
          )}

          {/* Therapist Results */}
          <div className="flex-1" style={{ marginTop: 0, paddingBottom: '20px' }}>
            {/* Disclaimer - inside scrollable area */}
            <div className="mt-0 mb-6">
              <div className="w-full h-px bg-gray-300 mb-6"></div>
              <div className="border border-green-700 rounded-lg text-sm text-gray-700 text-center px-6 py-4 leading-relaxed" style={{ backgroundColor: 'var(--bg-primary)' }}>
                Our therapy match software is currently being pilot tested and we are building live, in public. Some of the profiles listed are for demonstration purposes only during this initial testing phase.
              </div>
              <div className="w-full h-px bg-gray-300 mt-6"></div>
            </div>

            {/* Error Message - Prompt Not Found */}
            {promptError && (
              <div className="mb-6 p-6 bg-red-50 border-2 border-red-500 rounded-lg">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-red-900 mb-2">AI Preview Not Available</h3>
                    <p className="text-red-800 mb-4">{promptError}</p>
                    <button
                      onClick={() => setPromptError(null)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}

            <TherapistList
              therapists={therapists}
              onTryAIPreview={handleTryAIPreview}
              onViewMore={handleViewMore}
              onAdvancedSettings={isProviderMode ? handleAdvancedSettings : undefined}
              isProviderMode={isProviderMode}
              loading={loading}
              loadingPrompt={loadingPrompt}
            />

            {/* Playback Speed Settings - Patient Mode Only - COMMENTED OUT FOR NEXT VERSION */}
            {/* {!isProviderMode && !loading && therapists.length > 0 && (
              <div className="flex justify-center mt-8 mb-6">
                <button
                  onClick={() => {
                    console.log('[V17] Patient settings button clicked');
                    setIsVoiceSettingsOpen(true);
                  }}
                  className="px-6 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                  title="Adjust playback speed for AI Previews"
                >
                  <div className="text-sm font-medium text-gray-900">Playback Speed</div>
                </button>
              </div>
            )} */}
          </div>
        </div>

        {/* Voice Settings Modal - Also render in matching view */}
        <VoiceSettingsModal
          isOpen={isVoiceSettingsOpen}
          onClose={() => {
            console.log('[V17] Closing voice settings modal (matching view)');
            setIsVoiceSettingsOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="chatbot-v16-wrapper">
      {/* Back to matching button */}
      {!isConnected && selectedTherapist && (
        <div className="absolute top-20 left-4 z-10">
          <button
            onClick={handleBackToMatching}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Matching
          </button>
        </div>
      )}

      {/* Show selected therapist info */}
      {selectedTherapist && !isConnected && (
        <div className="absolute top-20 right-4 z-10 bg-white border border-gray-200 rounded-lg p-4 max-w-sm">
          <div className="flex items-center gap-3">
            {selectedTherapist.profilePhotoUrl && (
              <img
                src={selectedTherapist.profilePhotoUrl}
                alt={selectedTherapist.fullName}
                className="w-12 h-12 rounded-full object-cover"
              />
            )}
            <div>
              <h3 className="font-semibold text-gray-900">{selectedTherapist.fullName}</h3>
              <p className="text-sm text-gray-600">{selectedTherapist.title}</p>
            </div>
          </div>
        </div>
      )}
      {/* Main container - exact copy from V16 structure */}
      {/* Main container - exact structure as V16 */}
      <div className="main-container">

        {/* Start button overlay - positioned as sibling to conversation-container, just like V16 */}
        {!isConnected && (
          <div className="start-button-overlay flex flex-col items-center">

            {/* Demo Buttons */}
            <DemoButtons />

            <button
              className="control-button primary large-button"
              aria-label="Start a new conversation with RiseTwice AI assistant"
              onClick={handleLetsTalkClick}
              disabled={isPreparing}
            >
              {isPreparing ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="button-text">Connecting...</span>
                </div>
              ) : (
                <span className="button-text">Let&apos;s Talk</span>
              )}
            </button>

            {/* Spacing between Let's Talk and other elements - exact copy from V16 */}
            <div className="mt-8"></div>

            {/* Terms of Service - exact copy from V16 */}
            <button
              onClick={() => {
                console.log('[V17] Terms of Service clicked');
              }}
              disabled={false}
              className="text-sm underline mt-6 cursor-pointer pointer-events-auto block"
              style={{ color: '#3b503c', pointerEvents: 'auto' }}
              onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#9dbbac'}
              onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#3b503c'}
            >
              By selecting &ldquo;Let&apos;s Talk&rdquo; to start your session, you agree to these Terms of Service. Select here for details.
            </button>

          </div>
        )}

        {/* Conversation container - naturally fills available space */}
        <div className={`conversation-container ${!isConnected ? 'conversation-container-with-overlay' : ''}`} style={{ position: 'relative', zIndex: 1 }}>
          <div
            className="conversation-history"
            ref={conversationHistoryRef}
            role="log"
            aria-live="polite"
            aria-label="Conversation with AI assistant"
          >
            {/* Show messages when conversation history exists */}
            {store.conversationHistory.map((msg) => (
              <div
                key={msg.id}
                className={`message ${msg.role} ${!msg.isFinal ? 'animate-pulse' : ''}`}
                role="article"
                aria-label={`${msg.role === 'user' ? 'Your message' : 'AI assistant response'} at ${new Date(msg.timestamp).toLocaleTimeString()}`}
              >
                <div className="message-content">
                  <p className="message-text" style={{ display: 'block', marginBottom: '0' }}>{msg.text}</p>
                  {msg.role === 'assistant' && (
                    <div style={{ display: 'block', marginTop: '8px', clear: 'both' }}>
                      <button
                        type="button"
                        onClick={toggleAudioOutputMute}
                        className={`control-button ${store.isAudioOutputMuted ? 'muted' : ''}`}
                        aria-label={store.isAudioOutputMuted ? "Unmute speakers" : "Mute speakers"}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px',
                          borderRadius: '50%',
                          width: '28px',
                          height: '28px',
                          backgroundColor: store.isAudioOutputMuted ? '#ef4444' : 'white',
                          color: store.isAudioOutputMuted ? 'white' : '#6b7280',
                          border: '1px solid #e5e7eb'
                        }}
                      >
                        {store.isAudioOutputMuted ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3.63 3.63c-.39.39-.39 1.02 0 1.41L7.29 8.7 7 9H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.54-.77 2.2-1.31l1.34 1.34c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zm-7-8c-.15 0-.29.01-.43.03l1.85 1.85c.56.18 1.02.56 1.34 1.05L17 7.3c-.63-.9-1.68-1.3-2.71-1.3z" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 9v6h4l5 5V4L7 9H3zm7-.17v6.34L7.83 13H5v-2h2.83L10 8.83zM16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                  {msg.status && msg.status !== 'final' && (
                    <div className="message-status">
                      <span className="status-indicator">{msg.status}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* User speaking indicator with dancing dots - ElevenLabs VAD detection */}
            {isUserSpeaking && (
              <div className="message user" style={{
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid #22c55e',
                minHeight: '50px',
                display: 'flex',
                alignItems: 'center',
                padding: '10px'
              }}>
                <div className="flex space-x-2 items-center">
                  <span style={{ fontSize: '12px', marginRight: '10px', color: '#22c55e' }}>Listening...</span>
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" style={{ animationDuration: '0.6s' }}></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s', animationDuration: '0.6s' }}></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '0.6s' }}></div>
                </div>
              </div>
            )}

            {/* AI thinking indicator with dancing dots - matching S2 implementation */}
            {isThinking && (
              <div className="message assistant" style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid #3b82f6',
                minHeight: '50px',
                display: 'flex',
                alignItems: 'center',
                padding: '10px'
              }}>
                <div className="flex space-x-2 items-center">
                  <span style={{ fontSize: '12px', marginRight: '10px', color: '#3b82f6' }}>Thinking...</span>
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDuration: '0.6s' }}></div>
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s', animationDuration: '0.6s' }}></div>
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '0.6s' }}></div>
                </div>
              </div>
            )}

            {/* Show placeholder when connected but no messages yet */}
            {isConnected && store.conversationHistory.length === 0 && (
              <div className="conversation-placeholder">
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="relative w-12 h-12 mb-4">
                    <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-gray-600">Getting ready...</p>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Text input - only show when connected */}
        {isConnected && (
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }} className="input-container">
            <label htmlFor="message-input" className="sr-only">
              Type your message to RiseTwice AI
            </label>
            <input
              id="message-input"
              type="text"
              value={userMessage}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Type your message here..."
              className="text-input"
              disabled={!isConnected}
            />
            <button
              type="submit"
              className="control-button primary"
              disabled={!userMessage.trim() || !isConnected}
              aria-label="Send message"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        )}
      </div>

      {/* Microphone status live region for screen readers */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {isConnected && (store.isMuted ? 'Microphone muted' : 'Microphone unmuted - you can now speak')}
      </div>

      {/* Enhanced Audio visualizer with real-time volume data */}
      {isConnected && (
        <div
          className="visualization-container"
          role="button"
          aria-label="Microphone control - click to mute or unmute your microphone"
          aria-describedby="mic-description"
          onClick={toggleMicrophone}
          style={{ position: 'relative' }}
        >
          <AudioOrbV15 isFunctionExecuting={false} />
          <div id="mic-description" className="sr-only">
            Microphone control button located in the center of the screen. Click to toggle your microphone on or off. Visual indicator shows blue animation when AI is speaking.
          </div>

          {/* Mic hint callout */}
          {showMicHint && store.isMuted && (
            <div
              className="absolute px-6 py-4 text-base font-medium rounded-full shadow-2xl"
              style={{
                left: '50%',
                top: '-85px',
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 9999,
                background: '#1f2937',
                color: '#ffffff'
              }}
            >
              Unmute mic to talk
              {/* Arrow pointing down to the orb */}
              <div
                className="absolute left-1/2 transform -translate-x-1/2"
                style={{
                  top: '100%',
                  borderLeft: '10px solid transparent',
                  borderRight: '10px solid transparent',
                  borderTop: '12px solid #1f2937'
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Sign In Dialog - exact copy from V16 */}
      <SignInDialog
        isOpen={isSignInDialogOpen}
        onClose={() => {
          setIsSignInDialogOpen(false);
          // Clear pending demo if user cancels sign-in
          delete window.__pendingDemo;
        }}
        onSignedIn={() => {
          setIsSignInDialogOpen(false);
          // Check if there's a pending demo
          const pendingDemo = window.__pendingDemo;
          if (pendingDemo) {
            console.log('[V17] Executing pending demo after sign-in:', pendingDemo.doctorName);
            handleDemoStart(pendingDemo.voiceId, pendingDemo.promptAppend, pendingDemo.doctorName, true);
            delete window.__pendingDemo;
          } else {
            handleLetsTalk();
          }
        }}
        onContinueWithoutSignIn={() => {
          setIsSignInDialogOpen(false);
          // Check if there's a pending demo
          const pendingDemo = window.__pendingDemo;
          if (pendingDemo) {
            console.log('[V17] Executing pending demo without sign-in:', pendingDemo.doctorName);
            handleDemoStart(pendingDemo.voiceId, pendingDemo.promptAppend, pendingDemo.doctorName, true);
            delete window.__pendingDemo;
          } else {
            handleLetsTalk();
          }
        }}
      />

      {/* Voice Settings Modal */}
      <VoiceSettingsModal
        isOpen={isVoiceSettingsOpen}
        onClose={() => {
          console.log('[V17] Closing voice settings modal');
          setIsVoiceSettingsOpen(false);
        }}
      />
    </div>
  );
}