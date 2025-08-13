// src/app/chatbotV16/page.tsx

"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { User } from 'firebase/auth';
import { useWebRTCStore, FunctionRegistryManager } from '@/stores/webrtc-store';
// V16: Use proper Supabase functions hook for executable functions
import { useSupabaseFunctions } from '@/hooksV16/use-supabase-functions';
import { optimizedAudioLogger } from '@/hooksV15/audio/optimized-audio-logger';
// V16-specific components (reusing V15 components)
import { AudioOrbV15 } from './components/AudioOrbV15';
import { SignInDialog } from './components/SignInDialog';
// Use V11's voice and tool choice defaults
import { DEFAULT_VOICE, DEFAULT_TOOL_CHOICE } from '../chatbotV11/prompts';
// V16 greeting logging
import { logGreetingInstructions } from '@/lib/greeting-logger';
// V16 specialist greetings
import { getSpecialistGreeting } from '@/config/greetingInstructions';
// V16 resource locator greeting
import { getResourceWelcomeContent } from './prompts/resource-locator-welcome';
// Import V11's map display component for V16 to use
import MapResourcesDisplay from '../chatbotV11/MapResourcesDisplay';
// V16 language preference utilities
import { getStoredLanguagePreference } from '@/lib/language-utils';
// V16 uses its own CSS styles imported in layout.tsx
// Import bug report modal for feedback
import BugReportModal from '@/components/BugReportModal';
// Import Lucide icons for feedback buttons
import { ThumbsUp, ThumbsDown } from 'lucide-react';

// Conversation types (from V11 for compatibility)
interface Conversation {
  id: string; // Unique ID for React rendering and tracking
  role: string; // "user" or "assistant"
  text: string; // User or assistant message
  timestamp: string; // ISO string for message time
  isFinal: boolean; // Whether the transcription is final
  status?: "speaking" | "processing" | "final" | "thinking"; // Status for real-time conversation states
  specialist?: string; // V16 specialist tracking
}


// V16 Triage AI interface types
interface AIPrompt {
  id: string;
  type: string;
  content: string;
  voice_settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// TriageSession interface now imported from store

// Helper function for conditional specialist tracking logging
const logSpecialistTracking = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_SPECIALIST_TRACKING_LOGS === 'true') {
    console.log(`[specialist_tracking] ${message}`, ...args);
  }
};

// Helper function for resource reset debugging
const logResourceReset = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_RESET_LOGS === 'true') {
    console.log(`[resource_reset] ${message}`, ...args);
  }
};

// Helper function for map function logging
const logMapFunction = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_MAP_FUNCTION_LOGS === 'true') {
    console.log(`[map_function] ${message}`, ...args);
  }
};

// Helper function for resource greeting debugging - using single consistent prefix for multilingual support
const logResourceGreeting = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_MULTILINGUAL_SUPPORT_LOGS === 'true') {
    console.log(`[multilingual_support] ${message}`, ...args);
  }
};

// Main chat component implementing V16 Triage AI architecture
const ChatBotV16Component = memo(function ChatBotV16Component({
  user,
  // triagePrompt,
  resumableConversation,
  onLetsTalk,
  // shouldResume,
  // setShouldResume,
  isCheckingResume,
  loadFunctionsForAI
}: {
  user: User | null;
  triagePrompt: AIPrompt | null;
  resumableConversation: ResumableConversation | null;
  onLetsTalk: () => void;
  shouldResume: boolean;
  setShouldResume: (value: boolean) => void;
  isCheckingResume: boolean;
  loadFunctionsForAI: (aiType: string) => Promise<unknown[]>;
}) {
  // const renderTimestamp = performance.now();
  // console.log('[triage][resume] 🔄 ChatBotV16Component RENDER START:', {
  //   timestamp: renderTimestamp,
  //   hasUser: !!user,
  //   hasTriagePrompt: !!triagePrompt,
  //   hasResumableConversation: !!resumableConversation,
  //   resumableConversationId: resumableConversation?.id,
  //   hasOnLetsTalk: !!onLetsTalk,
  //   onLetsTalkType: typeof onLetsTalk,
  //   shouldResume,
  //   isCheckingResume,
  //   willShowResumeCheckbox: !!(user && resumableConversation && !isCheckingResume)
  // });

  const [mapVisible, setMapVisible] = useState(false);
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null);
  // Feedback modal state
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackMessageId, setFeedbackMessageId] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'thumbs_up' | 'thumbs_down' | null>(null);

  // Function execution state for visual indicator
  const [isFunctionExecuting, setIsFunctionExecuting] = useState(false);

  // Listen for function execution events to update visual indicator
  useEffect(() => {
    const handleFunctionStart = () => {
      setIsFunctionExecuting(true);
    };

    const handleFunctionEnd = () => {
      setIsFunctionExecuting(false);
    };

    // Add event listeners
    window.addEventListener('function-execution-start', handleFunctionStart);
    window.addEventListener('function-execution-end', handleFunctionEnd);

    return () => {
      // Cleanup event listeners
      window.removeEventListener('function-execution-start', handleFunctionStart);
      window.removeEventListener('function-execution-end', handleFunctionEnd);
    };
  }, []);

  // V16 Triage session state - now using Zustand store to persist across component re-mounts
  const triageSession = useWebRTCStore(state => state.triageSession);
  const setTriageSession = useWebRTCStore(state => state.setTriageSession);
  const updateTriageSession = useWebRTCStore(state => state.updateTriageSession);

  // Functions now passed as prop - exactly like AI instructions

  // Ref for auto-scrolling conversation
  const conversationHistoryRef = useRef<HTMLDivElement>(null);

  // FIXED: Use memoized selectors for Zustand to prevent unnecessary re-renders
  const isConnected = useWebRTCStore(state => state.isConnected);
  const connectionState = useWebRTCStore(state => state.connectionState);
  const isPreparing = useWebRTCStore(state => state.isPreparing);
  const conversation = useWebRTCStore(state => state.conversation);
  const userMessage = useWebRTCStore(state => state.userMessage);
  const isAudioOutputMuted = useWebRTCStore(state => state.isAudioOutputMuted);

  // Get stable function references - these are action functions that don't change
  const sendMessage = useWebRTCStore(state => state.sendMessage);
  const addConversationMessage = useWebRTCStore(state => state.addConversationMessage);
  const updateUserMessage = useWebRTCStore(state => state.updateUserMessage);
  const clearUserMessage = useWebRTCStore(state => state.clearUserMessage);
  const toggleAudioOutputMute = useWebRTCStore(state => state.toggleAudioOutputMute);

  // Smart Send state and actions
  const smartSendEnabled = useWebRTCStore(state => state.smartSendEnabled);
  const setSmartSendEnabled = useWebRTCStore(state => state.setSmartSendEnabled);
  const messageBuffer = useWebRTCStore(state => state.messageBuffer);
  const appendToMessageBuffer = useWebRTCStore(state => state.appendToMessageBuffer);
  const clearMessageBuffer = useWebRTCStore(state => state.clearMessageBuffer);

  // Smart Send timer ref (doesn't serialize well in Zustand)
  const smartSendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Register functions from hooks - this should be stable but let's track it
  const renderCount = useRef(0);
  renderCount.current++;
  // Reduced logging - only log excessive renders
  if (renderCount.current > 10 && renderCount.current % 10 === 0) {
    // console.log('[zustand-webrtc] 🚨 ChatBotV16Component excessive renders: #' + renderCount.current + ' at', new Date().toISOString());
  }

  // Functions now loaded in same fetchTriagePrompt function (simplified)

  // Simplified Resume Checkbox
  const resumeCheckboxJSX = null; /*useMemo(() => {
    if (!user || !resumableConversation || isCheckingResume) return null;

    return (
      <div className="flex items-center mt-4 space-x-2">
        <input
          type="checkbox"
          id="resume-checkbox"
          checked={shouldResume}
          style={{ pointerEvents: 'auto' }}
          ref={(el) => {
            if (el) {
              // const computed = window.getComputedStyle(el);
    // console.log('[resume] 🔍 Checkbox input DOM/CSS:', {
                element: el,
                hasOnClick: !!el.onclick,
                hasOnChange: !!el.onchange,
                pointerEvents: computed.pointerEvents,
                position: computed.position,
                zIndex: computed.zIndex,
                display: computed.display,
                visibility: computed.visibility,
                opacity: computed.opacity,
                clientRect: el.getBoundingClientRect()
              });
    // console.log('[resume] ⚛️ Checkbox handler attachment:', {
                hasOnChange: !!el.onchange,
                reactProps: Object.keys(el).filter(key => key.startsWith('__react'))
              });
            }
          }}
          onClickCapture={() => console.log('[resume] ⬇️ Checkbox input - click captured')}
          onClick={() => console.log('[resume] 🖱️ Checkbox input - click fired')}
          onChange={(e) => {
    // console.log('[V16] 🔄 RESUME: Checkbox onChange fired:', e.target.checked);
    // console.log('[V16] ✅ RESUME: Resume checkbox toggled:', e.target.checked);
    // console.log('[V16] 🔍 RESUME: shouldResume state changing:', {
              from: shouldResume,
              to: e.target.checked,
              hasUser: !!user,
              hasConversation: !!resumableConversation,
              timestamp: performance.now()
            });
            setShouldResume(e.target.checked);
          }}
          onMouseDown={() => console.log('[triage][resume] 🖱️ Checkbox mousedown'))
          onMouseUp={() => console.log('[triage][resume] 🖱️ Checkbox mouseup'))
          className="w-4 h-4 text-blue-600 bg-sage-200 dark:bg-gray-100 border-sage-400 dark:border-gray-300 rounded focus:ring-blue-500 focus:ring-2 pointer-events-auto"
        />
        <label
          htmlFor="resume-checkbox"
          className="text-sm text-sage-500 dark:text-gray-300 cursor-pointer"
          style={{ pointerEvents: 'auto' }}
          onClick={(e) => console.log('[triage][resume] 🏷️ Label clicked:', e.target))
        >
          Resume previous conversation
        </label>
      </div>
    );
  }, [user, resumableConversation, isCheckingResume, shouldResume, setShouldResume]); */

  // CRITICAL: Global event debugging - test if ANY clicks reach React
  useEffect(() => {
    const testClickHandler = () => {
      // const target = e.target as HTMLElement;
      // console.log('[triage][resume] 🌐 GLOBAL: Native click detected on document', {
      //   target: target,
      //     tagName: target?.tagName || 'unknown',
      //       className: target?.className || 'none',
      //         clientX: e.clientX,
      //           clientY: e.clientY
      // });
    };

    const testMouseHandler = () => {
      // console.log('[resume] 🖱️ GLOBAL: Mouse move detected', {
      //   clientX: e.clientX,
      //     clientY: e.clientY
      // });
    };

    document.addEventListener('click', testClickHandler, true); // Use capture
    document.addEventListener('mousemove', testMouseHandler, { passive: true, once: true }); // Only log once

    return () => {
      document.removeEventListener('click', testClickHandler, true);
      document.removeEventListener('mousemove', testMouseHandler);
    };
  }, []);

  // Functions are now registered at page level to prevent scope issues

  // CRITICAL: Set selectedBookId for message persistence (V16 with new therapeutic content)
  useEffect(() => {
    // V16 uses new therapeutic book: "Interaction Design Complete R2 AI v.3" (therapeutic_youth_v3 namespace)
    const specificBookId = '3f8df7a9-5d1f-47b4-ab0b-70aa31740e2e';
    localStorage.setItem('selectedBookId', specificBookId);
    // console.log('[V16] 📚 CRITICAL: Set selectedBookId for message persistence:', specificBookId);
  }, []);


  // Initialize Smart Send state from localStorage after component mounts
  useEffect(() => {
    const savedSmartSendEnabled = localStorage.getItem('smartSendEnabled');
    if (savedSmartSendEnabled !== null) {
      // Use saved preference if it exists
      const shouldEnable = savedSmartSendEnabled === 'true';
      const currentState = useWebRTCStore.getState().smartSendEnabled;
      if (shouldEnable !== currentState) {
        setSmartSendEnabled(shouldEnable);
      }
    }
    // If no saved preference, use default (now true from store)
  }, [setSmartSendEnabled]); // Only run once on mount

  // Subscribe to transcript events to update conversation
  useEffect(() => {
    // console.log('[V16] 📝 MESSAGE: Setting up transcript subscription for triage/specialist AI');

    // Map to track incomplete messages for streaming updates
    const incompleteMessages = new Map<string, Conversation>();

    const unsubscribe = useWebRTCStore.getState().onTranscript((message) => {
      // console.log('[V16] 📥 MESSAGE: Transcript event received', {
      //   messageId: message.id,
      //     isComplete: message.metadata?.isTranscriptComplete || false,
      //       role: (message.metadata as { role?: string })?.role || "assistant",
      //         dataLength: message.data?.length || 0,
      //           specialist: triageSession.currentSpecialist || 'triage'
      // });

      const { id, data, metadata } = message;
      const isComplete = metadata?.isTranscriptComplete || false;

      // Check if this is a user message (from custom role in the handler)
      const messageRole = (metadata as { role?: string })?.role || "assistant";

      if (isComplete) {
        // Final transcript - replace empty bubble or streaming version
        // console.log('[message_persistence] Adding final transcript to conversation:', { data, role: messageRole });
        // console.log('[message_persistence] [CONTENT_DEBUG] Final transcript content length:', data.length);
        // console.log('[message_persistence] [CONTENT_DEBUG] Final transcript preview:', data.substring(0, 100) + (data.length > 100 ? '...' : ''));
        // console.log('[message_persistence] [CONTENT_DEBUG] Final transcript full content:', data);

        const currentState = useWebRTCStore.getState();
        const updatedConversation = [...currentState.conversation];

        if (messageRole === "user") {
          // For user messages, find and replace the most recent user bubble (empty, "Thinking...", or streaming)
          const lastUserMessageIndex = updatedConversation.map(msg => msg.role).lastIndexOf("user");

          if (lastUserMessageIndex >= 0) {
            // console.log('[message_persistence] Replacing user bubble with final transcript and saving to database');

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
            // console.log('[message_persistence] No user bubble found, adding final message directly');
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
            status: "final",
            specialist: messageRole === 'assistant' ? (triageSession.currentSpecialist || undefined) : undefined
          };

          logSpecialistTracking('🎯 Final message created', {
            messageId: finalMessage.id,
            messageRole: finalMessage.role,
            assignedSpecialist: finalMessage.specialist,
            currentSpecialist: triageSession.currentSpecialist
          });

          const existingStreamingMessage = incompleteMessages.get(id);
          if (existingStreamingMessage) {
            // console.log('[message_persistence] Replacing streaming message with final version and saving to database');

            // Remove the streaming message from UI
            const filteredConversation = currentState.conversation.filter(msg => msg.id !== existingStreamingMessage.id);
            useWebRTCStore.setState({
              conversation: filteredConversation
            });

            // Add the final complete message (this will save to database)
            addConversationMessage(finalMessage);

            incompleteMessages.delete(id);
          } else {
            // console.log('[message_persistence] No streaming message found, adding final message directly');
            addConversationMessage(finalMessage);
          }
        }
      } else {
        // Streaming transcript - update or create incomplete message
        // console.log('[message_persistence] Updating streaming transcript:', { data, role: messageRole });

        if (messageRole === "user") {
          // For user streaming messages, find and update the existing bubble instead of creating new ones
          const currentState = useWebRTCStore.getState();
          const updatedConversation = [...currentState.conversation];
          const lastUserMessageIndex = updatedConversation.map(msg => msg.role).lastIndexOf("user");

          if (lastUserMessageIndex >= 0) {
            // console.log('[message_persistence] Updating existing user bubble with streaming text');
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
              status: "speaking",
              specialist: messageRole === 'assistant' ? (triageSession.currentSpecialist || undefined) : undefined
            };

            incompleteMessages.set(id, newMessage);
            addConversationMessage(newMessage);
          }
        }
      }
    });

    // console.log('[V16] ✅ MESSAGE: Transcript subscription set up successfully');

    return () => {
      // console.log('[V16] 🧹 MESSAGE: Cleaning up transcript subscription');
      unsubscribe();
    };
  }, [addConversationMessage, triageSession.currentSpecialist]);

  // Auto-scroll to bottom when conversation changes
  useEffect(() => {
    if (conversationHistoryRef.current && conversation.length > 0) {
      const scrollContainer = conversationHistoryRef.current;
      
      // Use requestAnimationFrame to ensure DOM has updated before scrolling
      requestAnimationFrame(() => {
        // Triple RAF to ensure all rendering and layout is complete
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Always scroll to bottom on new messages - no proximity check needed
            if (process.env.NEXT_PUBLIC_ENABLE_V16_AUTO_SCROLL_LOGS === 'true') {
              const currentScrollTop = scrollContainer.scrollTop;
              const maxScrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight;
              const distanceFromBottom = maxScrollTop - currentScrollTop;
              
              console.log('[v16_auto_scroll] Auto-scroll triggered', {
                currentScrollTop,
                scrollHeight: scrollContainer.scrollHeight,
                clientHeight: scrollContainer.clientHeight,
                maxScrollTop,
                distanceFromBottom,
                conversationLength: conversation.length
              });
            }
            
            // Always scroll to bottom for new messages
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
            
            if (process.env.NEXT_PUBLIC_ENABLE_V16_AUTO_SCROLL_LOGS === 'true') {
              console.log('[v16_auto_scroll] ✅ SCROLLED to bottom');
            }
          });
        });
      });
    }
  }, [conversation.length]);

  // Update triage session when resumable conversation changes (for resume flow)
  // Only run this during initial load, not after handoffs
  useEffect(() => {
    if (resumableConversation?.currentSpecialist && !triageSession.isHandoffPending) {
      // console.log('[triageAI] 🔄 RESUME: Updating triage session with specialist from resumable conversation', {
      //   specialist: resumableConversation.currentSpecialist,
      //     conversationId: resumableConversation.id,
      //       currentTriageSpecialist: triageSession.currentSpecialist
      // });

      // Only update if we're not already on the correct specialist (prevent overriding handoffs)
      if (triageSession.currentSpecialist !== resumableConversation.currentSpecialist) {
        // console.log('[triageAI] 🚨 RESET-DEBUG Line 407: Resume specialist update', {
        //   from: triageSession.currentSpecialist,
        //     to: resumableConversation.currentSpecialist,
        //       resumableId: resumableConversation.id,
        //         timestamp: new Date().toISOString()
        // });
        logSpecialistTracking('🔄 Specialist change during resume', {
          from: triageSession.currentSpecialist,
          to: resumableConversation.currentSpecialist,
          conversationId: resumableConversation.id
        });

        updateTriageSession({
          currentSpecialist: resumableConversation.currentSpecialist,
          conversationId: resumableConversation.id
        });
      }
    }
  }, [resumableConversation?.currentSpecialist, resumableConversation?.id, triageSession.isHandoffPending, triageSession.currentSpecialist]);

  // Debug: Track triageSession.currentSpecialist changes
  useEffect(() => {
    // console.log('[triageAI] 🔍 DEBUG: triageSession.currentSpecialist changed:', {
    //   currentSpecialist: triageSession.currentSpecialist,
    //     sessionId: triageSession.sessionId,
    //       conversationId: triageSession.conversationId,
    //         isHandoffPending: triageSession.isHandoffPending,
    //           timestamp: new Date().toISOString(),
    //             stack: new Error().stack?.split('\n').slice(0, 3).join('\n') // Show call stack for debugging
    // });
  }, [triageSession.currentSpecialist]);

  // Initialize V16 page
  useEffect(() => {
    // console.log('[triageAI] 🚨 RESET-DEBUG: Component Mount/Re-mount detected', {
    //   initialSpecialist: triageSession.currentSpecialist,
    //     timestamp: new Date().toISOString()
    // });
    // console.log('[V16] 🚀 Triage AI Page Initialized');
    // optimizedAudioLogger.info('webrtc', 'v16_triage_page_initialized', {
    //   timestamp: Date.now()
    // });

    return () => {
      // console.log('[V16] 🧹 Triage AI Page Cleanup');
      optimizedAudioLogger.info('webrtc', 'v16_triage_page_cleanup', {
        timestamp: Date.now()
      });
    };
  }, []);


  // Helper function for specialist handoff logging
  const logSpecialistHandoff = (message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_SPECIALIST_HANDOFF_LOGS === 'true') {
      console.log(`[specialist_handoff] ${message}`, ...args);
    }
  };

  // Listen for specialist handoff events from triage AI
  useEffect(() => {
    const handleSpecialistHandoff = async (e: Event) => {
      const handoffStartTime = performance.now();
      const handoffSessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);

      const customEvent = e as CustomEvent<{
        specialistType: string;
        contextSummary: string;
        conversationId: string;
        sessionId?: string;
        dispatchedAt?: number;
        responseSessionId?: string;
      }>;

      // Detect who initiated this handoff
      const currentSpecialist = triageSession.currentSpecialist || 'unknown';
      const isInterSpecialistHandoff = currentSpecialist !== 'triage' && currentSpecialist !== 'unknown';

      // Use appropriate logging based on handoff type
      const logHandoff = isInterSpecialistHandoff ? logSpecialistHandoff :
        (msg: string, ...args: unknown[]) => {
          if (process.env.NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS === 'true') {
            console.log(`[triage_handoff] ${msg}`, ...args);
          }
        };

      logHandoff(`===== HANDOFF EVENT RECEIVED =====`);
      logHandoff(`Handoff Session ID: ${handoffSessionId}`);
      logHandoff(`Event trigger time: ${handoffStartTime.toFixed(3)}ms since page load`);
      logHandoff(`Current specialist: ${currentSpecialist}`);
      logHandoff(`Target specialist: ${customEvent.detail.specialistType}`);
      logHandoff(`Context summary: ${customEvent.detail.contextSummary}`);
      logHandoff(`Conversation ID: ${customEvent.detail.conversationId}`);

      if (isInterSpecialistHandoff) {
        logSpecialistHandoff(`⚠️ INTER-SPECIALIST HANDOFF DETECTED!`);
        logSpecialistHandoff(`From: ${currentSpecialist} -> To: ${customEvent.detail.specialistType}`);
        logSpecialistHandoff(`⚠️ This should use unified persona seamless handoff`);
        logSpecialistHandoff(`⚠️ Should NOT disconnect WebRTC connection`);
      }

      // console.log(`[HANDOFF-DEBUG] 🔄 Step 1/5: HANDOFF INITIATED - Triage → ${customEvent.detail.specialistType}`, {
      //   handoffSessionId,
      //     specialist: customEvent.detail.specialistType,
      //       conversationId: customEvent.detail.conversationId,
      //         contextLength: customEvent.detail.contextSummary?.length || 0,
      //           timestamp: new Date().toISOString(),
      //             eventProcessingDelay: customEvent.detail.dispatchedAt ?
      //               (handoffStartTime - customEvent.detail.dispatchedAt).toFixed(3) + 'ms' : 'UNKNOWN'
      // });

      const { specialistType, contextSummary, conversationId } = customEvent.detail;

      try {
        logHandoff(`===== SEAMLESS HANDOFF INITIATED =====`);
        logHandoff(`${currentSpecialist} → ${specialistType}`);
        logHandoff(`Context summary length: ${contextSummary?.length || 0}`);
        logHandoff(`Conversation ID: ${conversationId}`);

        if (isInterSpecialistHandoff) {
          logSpecialistHandoff(`⚠️ CRITICAL: Inter-specialist handoff process starting`);
          logSpecialistHandoff(`⚠️ Using unified persona seamless handoff (no disconnect)`);
        }

        // Mark handoff as pending
        updateTriageSession({
          isHandoffPending: true,
          contextSummary
        });
        logHandoff(`✅ Step 1: Handoff marked as pending`);

        // Load new specialist configuration
        logHandoff(`⏳ Step 2: Loading specialist configuration from database`);
        const configResponse = await fetch('/api/v16/replace-session-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            specialistType,
            conversationId,
            contextSummary,
            userId: user?.uid || 'anonymous'
          })
        });

        if (!configResponse.ok) {
          const errorText = await configResponse.text();
          throw new Error(`Failed to load specialist configuration: ${configResponse.status} ${errorText}`);
        }

        const configData = await configResponse.json();
        logHandoff(`✅ Step 2: Configuration loaded`);
        logHandoff(`Instructions length: ${configData.config.instructions.length}`);
        logHandoff(`Tools count: ${configData.config.tools.length}`);

        // Clear existing functions and load specialist functions
        logHandoff(`⏳ Step 3: Clearing functions and loading specialist functions`);
        const registryManager = FunctionRegistryManager.getInstance();
        registryManager.clearAllFunctions();

        try {
          await loadFunctionsForAI(specialistType);
          logHandoff(`✅ Step 3: Specialist functions loaded successfully`);
        } catch (functionError) {
          logHandoff(`❌ CRITICAL ERROR: Failed to load specialist functions for ${specialistType}:`, functionError);
          throw new Error(`Failed to load specialist functions: ${(functionError as Error).message}`);
        }

        // Replace AI configuration seamlessly (no disconnect/reconnect)
        logHandoff(`⏳ Step 4: Replacing AI configuration seamlessly`);
        if (isInterSpecialistHandoff) {
          logSpecialistHandoff(`⚠️ Using session.update to replace AI config`);
          logSpecialistHandoff(`⚠️ WebRTC connection will remain active`);
        }
        const replaceSuccess = await useWebRTCStore.getState().replaceAIConfiguration({
          instructions: configData.config.instructions,
          tools: configData.config.tools
        });

        if (!replaceSuccess) {
          throw new Error('Failed to replace AI configuration');
        }
        logHandoff(`✅ Step 4: AI configuration replaced successfully`);

        // Update database to track specialist change
        logHandoff(`⏳ Step 5: Updating database with specialist change`);
        const endResponse = await fetch('/api/v16/end-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            specialistType: 'triage',
            contextSummary,
            reason: 'seamless_handoff_to_specialist'
          })
        });

        if (!endResponse.ok) {
          logHandoff(`⚠️ Database update warning: ${endResponse.status} ${endResponse.statusText}`);
        } else {
          logHandoff(`✅ Step 5: Database updated with handoff record`);
        }

        // Update UI state to reflect specialist change
        logHandoff(`⏳ Step 6: Updating UI state`);
        setTriageSession({
          sessionId: conversationId || '',
          currentSpecialist: specialistType,
          conversationId,
          contextSummary,
          isHandoffPending: false
        });
        logHandoff(`✅ Step 6: UI state updated to ${specialistType} specialist`);
        if (isInterSpecialistHandoff) {
          logSpecialistHandoff(`⚠️ Current specialist changed from ${currentSpecialist} to ${specialistType}`);
        }

        // Step 7: Specialist Greeting Injection
        logHandoff(`⏳ Step 7: Injecting specialist greeting`);

        // Get specialist greeting with context
        const greetingMessage = getSpecialistGreeting(specialistType, contextSummary);

        // Inject greeting as user message to trigger specialist response
        const connectionManager = useWebRTCStore.getState().connectionManager;
        if (connectionManager && connectionManager.isDataChannelReady()) {
          // Create conversation item with greeting message
          const greetingInjection = {
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: greetingMessage }]
            }
          };

          connectionManager.sendMessage(JSON.stringify(greetingInjection));

          // Trigger AI response to the injected message
          setTimeout(() => {
            const response = {
              type: "response.create",
              response: {
                modalities: ["text", "audio"],
                max_output_tokens: 2000
              }
            };
            connectionManager.sendMessage(JSON.stringify(response));
          }, 1000);

          logHandoff(`✅ Step 7: Specialist greeting injected successfully`);
          logHandoff(`🎉 SEAMLESS HANDOFF COMPLETED SUCCESSFULLY`);
          logHandoff(`User is now connected to ${specialistType} specialist`);
          logHandoff(`WebRTC connection maintained throughout handoff`);
          logHandoff(`No audio interruption experienced by user`);

          if (isInterSpecialistHandoff) {
            logSpecialistHandoff(`✅ INTER-SPECIALIST HANDOFF COMPLETED`);
            logSpecialistHandoff(`✅ Unified persona maintained`);
            logSpecialistHandoff(`✅ ${currentSpecialist} → ${specialistType} transition complete`);
          }
        } else {
          logHandoff(`⚠️ Step 7: Cannot inject greeting - WebRTC connection not ready`);
        }

      } catch (error) {
        logHandoff(`❌ SEAMLESS HANDOFF FAILED: ${currentSpecialist} → ${specialistType}`, {
          error: (error as Error).message,
          conversationId,
          specialistType
        });

        if (isInterSpecialistHandoff) {
          logSpecialistHandoff(`❌ CRITICAL: Inter-specialist handoff failed`);
          logSpecialistHandoff(`❌ This may cause disconnection or persona break`);
        }

        optimizedAudioLogger.error('triage', 'seamless_handoff_failed', error as Error, {
          specialistType,
          conversationId,
          handoffType: 'seamless_v2'
        });

        // Reset handoff state on failure
        updateTriageSession({
          isHandoffPending: false
        });

        // Since this is early beta and errors should be visible, throw the error
        // Do not show fallback message to user - let the error surface
        throw error;
      }
    };

    // console.log(`[triageAI] 👂 Event listener REGISTERED for specialist_handoff events`);
    // console.log(`[V16] 👂 Listening for specialist handoff events`);
    window.addEventListener('specialist_handoff', handleSpecialistHandoff);

    return () => {
      // console.log(`[triageAI] 🔇 Event listener REMOVED for specialist_handoff events`);
      // console.log(`[V16] 🔇 Removing specialist handoff event listener`);
      window.removeEventListener('specialist_handoff', handleSpecialistHandoff);
    };
  }, [user, addConversationMessage, loadFunctionsForAI]);


  // Listen for map display events from mental health functions
  useEffect(() => {
    logMapFunction('🔧 Setting up display_resource_map event listener', {
      timestamp: new Date().toISOString(),
      currentSearchId,
      mapVisible
    });

    const handleDisplayResourceMap = (e: CustomEvent<{ searchId: string }>) => {
      logMapFunction('🎯 display_resource_map EVENT RECEIVED', {
        searchId: e.detail.searchId,
        eventType: e.type,
        eventDetail: e.detail,
        timestamp: new Date().toISOString(),
        currentMapVisible: mapVisible,
        currentSearchId
      });

      optimizedAudioLogger.info('map', 'display_resource_map_triggered', {
        searchId: e.detail.searchId
      });

      logMapFunction('🔄 Setting map state', {
        previousSearchId: currentSearchId,
        newSearchId: e.detail.searchId,
        previousMapVisible: mapVisible,
        newMapVisible: true
      });

      setCurrentSearchId(e.detail.searchId);
      setMapVisible(true);

      logMapFunction('✅ Map state updated successfully', {
        searchId: e.detail.searchId,
        mapVisible: true
      });
    };

    window.addEventListener('display_resource_map', handleDisplayResourceMap as EventListener);

    logMapFunction('✅ Event listener added to window', {
      eventType: 'display_resource_map',
      listenerCount: (window as Window & { getEventListeners?: (eventType: string) => unknown[] }).getEventListeners?.('display_resource_map')?.length || 'unknown'
    });

    return () => {
      logMapFunction('🧹 Cleaning up display_resource_map event listener');
      window.removeEventListener('display_resource_map', handleDisplayResourceMap as EventListener);
    };
  }, [currentSearchId, mapVisible]);

  // V15 GREENFIELD FIX: Removed ai_end_session event listener
  // Voice-activated end session now uses the same graceful flow as button clicks
  // The end_session function returns success, AI says goodbye, WebRTC handles completion

  // REMOVED: Static orb visualization state - now using enhanced AudioOrbV15 component

  // Memoized callback for closing the map
  const handleCloseMap = useCallback(() => {
    // console.log(`%c [V16-MAP-DISPLAY] 🚪 Closing map display`, 'background: #1e3a5f; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
    optimizedAudioLogger.info('map', 'map_closed_by_user');
    setMapVisible(false);
    setCurrentSearchId(null);
  }, []);

  // Smart Send logging helper
  const logSmartSend = (message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_SMART_SEND_LOGS === 'true') {
      console.log(`[smart_send] ${message}`, ...args);
    }
  };

  // Smart Send timer functions
  const startSmartSendTimer = useCallback(() => {
    logSmartSend('🔄 Timer start/restart requested', {
      currentBuffer: messageBuffer,
      isConnected,
      hasExistingTimer: !!smartSendTimerRef.current
    });

    if (smartSendTimerRef.current) {
      clearTimeout(smartSendTimerRef.current);
      logSmartSend('⏹️ Cleared existing timer');
    }

    // Get delay from localStorage, default to 2 seconds
    const delaySeconds = Number(localStorage.getItem('smartSendDelay') || '2');
    const delayMs = delaySeconds * 1000;

    logSmartSend('⏳ Starting timer', {
      delaySeconds,
      delayMs,
      messageBuffer: messageBuffer.trim()
    });

    smartSendTimerRef.current = setTimeout(() => {
      // Get current buffer state from store (not stale closure)
      const bufferedMessage = useWebRTCStore.getState().messageBuffer.trim();
      // Get current text input state to check if user is still typing
      const currentUserMessage = useWebRTCStore.getState().userMessage.trim();

      logSmartSend('⏰ Timer completed - evaluating send conditions', {
        bufferedMessage,
        messageLength: bufferedMessage.length,
        currentUserMessage,
        isTextInputEmpty: !currentUserMessage,
        isConnected,
        connectionState
      });

      if (bufferedMessage && isConnected && !currentUserMessage) {
        logSmartSend('✅ Send conditions met - sending buffered message to AI', {
          finalMessage: bufferedMessage,
          messageLength: bufferedMessage.length
        });

        // NOTE: Message was already added to conversation for immediate UI display
        // Only send to AI via WebRTC here
        logSmartSend('📤 Attempting to send buffered message to AI via WebRTC');
        const success = sendMessage(bufferedMessage);

        if (success) {
          logSmartSend('✅ Message sent successfully - setting thinking state');
          useWebRTCStore.setState({ isThinking: true });
          clearMessageBuffer();
          logSmartSend('🧹 Buffer cleared after successful send');
        } else {
          logSmartSend('❌ Message send FAILED - keeping buffer', {
            bufferedMessage,
            connectionState,
            isConnected
          });
        }
      } else {
        logSmartSend('❌ Send conditions NOT met - skipping send', {
          hasMessage: !!bufferedMessage,
          messageLength: bufferedMessage.length,
          isConnected,
          connectionState,
          currentUserMessage,
          isTextInputEmpty: !currentUserMessage,
          reason: !bufferedMessage ? 'no_buffered_message' : !isConnected ? 'not_connected' : 'text_input_not_empty'
        });
      }
      smartSendTimerRef.current = null;
      logSmartSend('🏁 Timer reference cleared');
    }, delayMs);
  }, [messageBuffer, isConnected, connectionState, addConversationMessage, sendMessage, clearMessageBuffer, logSmartSend]);

  const cancelSmartSendTimer = useCallback(() => {
    // Add call stack tracking to identify what's canceling the timer
    const stack = new Error().stack;

    if (smartSendTimerRef.current) {
      logSmartSend('🛑 Canceling Smart Send timer - CALL STACK ANALYSIS', {
        hasTimer: true,
        timerRef: smartSendTimerRef.current,
        callStack: stack?.split('\n').slice(1, 5).join('\n') // First 4 stack frames
      });
      clearTimeout(smartSendTimerRef.current);
      smartSendTimerRef.current = null;
      logSmartSend('✅ Timer canceled and reference cleared');
    } else {
      logSmartSend('⚠️ Cancel requested but no timer exists - CALL STACK ANALYSIS', {
        hasTimer: false,
        callStack: stack?.split('\n').slice(1, 5).join('\n') // First 4 stack frames
      });
    }
  }, [logSmartSend]);

  // Handle input change with Smart Send timer restart
  const handleInputChange = useCallback((value: string) => {
    logSmartSend('⌨️ Input change detected', {
      oldValue: userMessage,
      newValue: value,
      smartSendEnabled,
      currentBuffer: messageBuffer
    });

    updateUserMessage(value);

    if (smartSendEnabled) {
      logSmartSend('🔄 Smart Send enabled - restarting timer on input change');
      // Restart timer on typing (debounce effect)
      startSmartSendTimer();
    } else {
      logSmartSend('⚠️ Smart Send disabled - no timer action on input change');
    }
  }, [updateUserMessage, smartSendEnabled, startSmartSendTimer, userMessage, messageBuffer, logSmartSend]);

  // Handle send message - memoized to prevent recreation on every render
  const handleSendMessage = useCallback(() => {
    logSmartSend('📨 handleSendMessage called', {
      userMessage: userMessage.trim(),
      messageLength: userMessage.trim().length,
      isConnected,
      connectionState,
      smartSendEnabled,
      currentBuffer: messageBuffer
    });

    if (!userMessage.trim() || !isConnected) {
      logSmartSend('❌ Send aborted - missing message or not connected', {
        hasMessage: !!userMessage.trim(),
        messageLength: userMessage.trim().length,
        isConnected,
        connectionState
      });
      return;
    }

    if (smartSendEnabled) {
      logSmartSend('🧠 Smart Send ENABLED - accumulating message', {
        userMessage: userMessage.trim(),
        currentBuffer: messageBuffer,
        willAppend: userMessage.trim()
      });

      // IMMEDIATE UI UPDATE: Add message to conversation for instant display
      const userMessageObj: Conversation = {
        id: `user-typed-${Date.now()}`,
        role: "user",
        text: userMessage,
        timestamp: new Date().toISOString(),
        isFinal: true,
        status: "final"
      };
      logSmartSend('📝 Adding message to conversation (IMMEDIATE for UI)', userMessageObj);
      addConversationMessage(userMessageObj);

      // SMART SEND LOGIC: Accumulate message for AI processing delay
      appendToMessageBuffer(userMessage);
      logSmartSend('📝 Message appended to buffer for AI processing');

      clearUserMessage();
      logSmartSend('🧹 Input field cleared');

      startSmartSendTimer();
      logSmartSend('⏰ Smart Send timer started/restarted');
      return;
    }

    logSmartSend('⚡ Smart Send DISABLED - immediate send mode', {
      userMessage: userMessage.trim()
    });

    // Original immediate send behavior (when Smart Send disabled)
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

    logSmartSend('📝 Adding message to conversation (immediate mode)', userMessageObj);
    addConversationMessage(userMessageObj);

    logSmartSend('📤 Sending message via WebRTC (immediate mode)');
    const success = sendMessage(userMessage);

    if (success) {
      logSmartSend('✅ Immediate send successful');
      // Set thinking state when text message is sent
      useWebRTCStore.setState({ isThinking: true });
      clearUserMessage();
    } else {
      logSmartSend('❌ Immediate send FAILED', {
        userMessage,
        connectionState,
        isConnected
      });
      optimizedAudioLogger.error('webrtc', 'send_message_failed', new Error('Message send failed'), {
        messageLength: userMessage.length
      });
      // Don't clear the message if sending failed, allow user to retry
    }
  }, [userMessage, isConnected, connectionState, smartSendEnabled, messageBuffer, appendToMessageBuffer, clearUserMessage, startSmartSendTimer, addConversationMessage, sendMessage, logSmartSend]);

  // Smart Send edge case handling - FIXED: Split into separate effects to avoid cleanup race condition

  // Page unload handler - stable, doesn't need to re-run
  useEffect(() => {
    const handleBeforeUnload = () => {
      logSmartSend('🚨 Page unload detected - checking for buffered message');
      // Get current state at time of unload
      const currentState = useWebRTCStore.getState();
      const bufferedMessage = currentState.messageBuffer.trim();

      if (bufferedMessage && currentState.isConnected) {
        logSmartSend('📤 Sending buffered message before page unload', { bufferedMessage });
        const userMessageObj: Conversation = {
          id: `user-typed-${Date.now()}`,
          role: "user",
          text: bufferedMessage,
          timestamp: new Date().toISOString(),
          isFinal: true,
          status: "final"
        };
        addConversationMessage(userMessageObj);
        sendMessage(bufferedMessage);
        clearMessageBuffer();
      } else {
        logSmartSend('⚠️ No buffered message to send on unload', {
          hasMessage: !!bufferedMessage,
          isConnected: currentState.isConnected
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // FIXED: Only cancel timer on actual component unmount, not on dependency changes
      logSmartSend('🧹 Component unmounting - cleaning up timer');
      cancelSmartSendTimer();
    };
  }, []); // FIXED: Empty dependency array - only run on mount/unmount

  // Connection loss handler - separate effect to avoid timer cancellation race condition
  useEffect(() => {
    if (!isConnected && messageBuffer.trim()) {
      logSmartSend('🚨 Connection lost with buffered message - clearing buffer and timer', {
        messageBuffer,
        isConnected
      });
      clearMessageBuffer();
      cancelSmartSendTimer();
    }
  }, [isConnected, messageBuffer, clearMessageBuffer, cancelSmartSendTimer, logSmartSend]);

  // Feedback handlers
  const handleFeedbackClick = useCallback((messageId: string, type: 'thumbs_up' | 'thumbs_down') => {
    setFeedbackMessageId(messageId);
    setFeedbackType(type);
    setIsFeedbackModalOpen(true);
  }, []);

  const handleCloseFeedbackModal = useCallback(() => {
    setIsFeedbackModalOpen(false);
    setFeedbackMessageId(null);
    setFeedbackType(null);
  }, []);

  // Layout debugging function
  const debugLayoutHeights = () => {
    if (process.env.NEXT_PUBLIC_ENABLE_LAYOUT_DEBUG_LOGS === 'true') {
      const mainContentRow = document.querySelector('.main-content-row');
      const mainContainer = document.querySelector('.main-container');
      const conversationContainer = document.querySelector('.conversation-container');

      console.log('[layout_debug] 🔍 LAYOUT HEIGHT ANALYSIS:');
      
      if (mainContentRow) {
        console.log('[layout_debug] main-content-row: offsetHeight = ' + (mainContentRow as HTMLElement).offsetHeight + 'px');
        console.log('[layout_debug] main-content-row: computedHeight = ' + window.getComputedStyle(mainContentRow).height);
        console.log('[layout_debug] main-content-row: display = ' + window.getComputedStyle(mainContentRow).display + ' (MUST be "flex" for children flex props to work)');
        console.log('[layout_debug] main-content-row: flexDirection = ' + window.getComputedStyle(mainContentRow).flexDirection);
        
        console.log('[layout_debug] 👶 CHILDREN OF main-content-row:');
        const children = Array.from(mainContentRow.children);
        children.forEach((child, index) => {
          const element = child as HTMLElement;
          console.log('[layout_debug] Child #' + index + ': ' + element.tagName + ' class="' + element.className + '" height=' + element.offsetHeight + 'px');
          console.log('[layout_debug] Child #' + index + ': flex=' + window.getComputedStyle(element).flex + ' flexGrow=' + window.getComputedStyle(element).flexGrow);
        });
        
        const totalChildrenHeight = children.reduce((sum, child) => sum + (child as HTMLElement).offsetHeight, 0);
        console.log('[layout_debug] Total children height: ' + totalChildrenHeight + 'px');
        console.log('[layout_debug] Missing space: ' + ((mainContentRow as HTMLElement).offsetHeight - totalChildrenHeight) + 'px (could be margins/padding)');
      } else {
        console.log('[layout_debug] main-content-row: NOT FOUND');
      }

      if (mainContainer) {
        console.log('[layout_debug] main-container: offsetHeight = ' + (mainContainer as HTMLElement).offsetHeight + 'px');
        console.log('[layout_debug] main-container: computedHeight = ' + window.getComputedStyle(mainContainer).height);
        console.log('[layout_debug] main-container: flex = ' + window.getComputedStyle(mainContainer).flex);
        console.log('[layout_debug] main-container: flexGrow = ' + window.getComputedStyle(mainContainer).flexGrow);
      } else {
        console.log('[layout_debug] main-container: NOT FOUND');
      }

      if (conversationContainer) {
        console.log('[layout_debug] conversation-container: offsetHeight = ' + (conversationContainer as HTMLElement).offsetHeight + 'px');
        console.log('[layout_debug] conversation-container: computedHeight = ' + window.getComputedStyle(conversationContainer).height);
        console.log('[layout_debug] conversation-container: flex = ' + window.getComputedStyle(conversationContainer).flex);
        console.log('[layout_debug] conversation-container: paddingTop = ' + window.getComputedStyle(conversationContainer).paddingTop);
        console.log('[layout_debug] conversation-container: marginTop = ' + window.getComputedStyle(conversationContainer).marginTop);
        console.log('[layout_debug] conversation-container: classes = ' + Array.from(conversationContainer.classList).join(' '));
      } else {
        console.log('[layout_debug] conversation-container: NOT FOUND');
      }

      console.log('[layout_debug] 🎯 CSS CHANGES VERIFICATION:');
      console.log('[layout_debug] isConnected = ' + isConnected);
      
      if (conversationContainer?.classList.contains('conversation-container-with-overlay')) {
        console.log('[layout_debug] HAS conversation-container-with-overlay class');
        console.log('[layout_debug] paddingTop with overlay = ' + window.getComputedStyle(conversationContainer).paddingTop + ' (should be 0px if fix worked)');
      } else {
        console.log('[layout_debug] NO conversation-container-with-overlay class');
      }
    }
  };

  // Run debugging after component mounts and on state changes
  useEffect(() => {
    // Add small delay to ensure DOM is fully rendered
    setTimeout(debugLayoutHeights, 100);
  }, [isConnected]); // Re-run when connection state changes

  // Expose debugging function to global scope for manual testing
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_LAYOUT_DEBUG_LOGS === 'true') {
      (window as Window & { debugLayoutHeights?: () => void }).debugLayoutHeights = debugLayoutHeights;
      console.log('[layout_debug] 🛠️ Debug function exposed to window.debugLayoutHeights()');
    }
  }, []);

  return (
    <div
      className="main-container"
      ref={(el) => {
        if (el) {
          // const computed = window.getComputedStyle(el);
          // console.log('[resume] 🏠 Main container DOM/CSS:', {
          //   element: el,
          //     className: el.className,
          //       pointerEvents: computed.pointerEvents,
          //         position: computed.position,
          //           zIndex: computed.zIndex,
          //             overflow: computed.overflow,
          //               width: computed.width,
          //                 height: computed.height,
          //                   clientRect: el.getBoundingClientRect()
          // });

          // CSS Override Detection Functions
          function logCSSCascade(element: Element, elementName: string, phase: string) {
            const allRules = [];
            for (const sheet of document.styleSheets) {
              try {
                for (const rule of sheet.cssRules) {
                  if ((rule as CSSStyleRule).selectorText && element.matches((rule as CSSStyleRule).selectorText)) {
                    allRules.push({
                      selector: (rule as CSSStyleRule).selectorText,
                      styles: (rule as CSSStyleRule).style.cssText,
                      sheet: sheet.href || 'inline',
                      specificity: (rule as CSSStyleRule).selectorText.split(/[\s,]+/).length // Basic specificity
                    });
                  }
                }
              } catch (e) {
                // console.log('error: ', e)
                void e;
              }
            }
            // console.log(`[layout-css-cascade] ${elementName}-${phase}: rules=${JSON.stringify(allRules)}`);
            void elementName;
            void phase;
          }

          function logStyleOverrides(element: Element, elementName: string, phase: string) {
            // const computed = getComputedStyle(element);
            const expected = ({
              'v11-layout-root': { display: 'grid', gridTemplateRows: 'auto 1fr auto', height: '100dvh', overflow: 'hidden' },
              'main-content-row': { overflow: 'auto', display: 'flex', flexDirection: 'column' },
              'footer-row': { display: 'block' }
            } as Record<string, Record<string, string>>)[elementName];

            if (expected) {
              Object.keys(expected).forEach(() => {
                // const actual = computed.getPropertyValue(prop) || (computed as unknown as Record<string, string>)[prop];
                // const expectedVal = expected[prop];
                // const matches = actual === expectedVal;
                // console.log(`[layout-style-check] ${elementName}-${phase}: ${prop} expected=${expectedVal}, actual=${actual}, matches=${matches}`);
              });
            }
            void element;
            void phase;
          }

          function logClassApplication(element: Element, elementName: string, phase: string) {
            // const classList = Array.from(element.classList);
            // const hasExpectedClass = element.classList.contains(elementName);
            // console.log(`[layout-class-check] ${elementName}-${phase}: hasClass=${hasExpectedClass}, allClasses=${JSON.stringify(classList)}`);

            // Check if styles are actually defined for this class
            let ruleFound = false;
            for (const sheet of document.styleSheets) {
              try {
                for (const rule of sheet.cssRules) {
                  if ((rule as CSSStyleRule).selectorText === `.${elementName}`) {
                    ruleFound = true;
                    // console.log(`[layout-class-definition] ${elementName}-${phase}: ruleFound=true, styles=${(rule as CSSStyleRule).style.cssText}`);
                    break;
                  }
                }
              } catch (e) {
                // console.log('error: ', e)
                void e;
              }
            }
            if (!ruleFound) {
              // console.log(`[layout-class-definition] ${elementName}-${phase}: ruleFound=false`);
            }
            void element;
            void phase;
          }

          function logCSSSource(element: Element, property: string, elementName: string, phase: string) {
            // Find what CSS rule is actually setting this property
            // const computed = getComputedStyle(element);
            // const value = computed.getPropertyValue(property) || (computed as unknown as Record<string, string>)[property];

            for (const sheet of document.styleSheets) {
              try {
                for (const rule of sheet.cssRules) {
                  if ((rule as CSSStyleRule).selectorText && element.matches((rule as CSSStyleRule).selectorText) && (rule as CSSStyleRule).style[property as keyof CSSStyleDeclaration]) {
                    // console.log(`[layout-css-source] ${elementName}-${phase}: ${property}=${value} from selector="${(rule as CSSStyleRule).selectorText}" sheet="${sheet.href || 'inline'}"`);
                  }
                }
              } catch (e) {
                // console.log('error: ', e)
                void e;
              }
            }
            void elementName;
            void phase;
          }

          // Run CSS Grid layout diagnostics
          const layoutElements = [
            { element: el.closest('.v11-layout-root'), name: 'v11-layout-root' },
            { element: el.closest('.main-content-row'), name: 'main-content-row' },
            { element: document.querySelector('.footer-row'), name: 'footer-row' }
          ];

          layoutElements.forEach(({ element, name }) => {
            if (element) {
              const phase = 'css-diagnostic';
              logClassApplication(element, name, phase);
              logStyleOverrides(element, name, phase);
              logCSSCascade(element, name, phase);
              logCSSSource(element, 'display', name, phase);
              logCSSSource(element, 'overflow', name, phase);
              if (name === 'v11-layout-root') {
                logCSSSource(element, 'gridTemplateRows', name, phase);
              }
            }
          });
        }
      }}
      onClickCapture={(e) => console.log('[resume] ⬇️ Main container - click captured:', e.target)}
      onClick={(e) => console.log('[resume] ⬆️ Main container - click bubbled:', e.target)}
    >
      {/* Start button overlay - positioned above chatbox with higher z-index - WITH DEBUGGING */}
      {
        !isConnected && (
          <div
            className="start-button-overlay flex flex-col items-center"
            ref={(el) => {
              if (el) {
                // const computed = window.getComputedStyle(el);
                // console.log('[resume] 🎯 Start overlay container DOM/CSS:', {
                //   element: el,
                //     className: el.className,
                //       pointerEvents: computed.pointerEvents,
                //         position: computed.position,
                //           zIndex: computed.zIndex,
                //             display: computed.display,
                //               visibility: computed.visibility,
                //                 opacity: computed.opacity,
                //                   width: computed.width,
                //                     height: computed.height,
                //                       top: computed.top,
                //                         left: computed.left,
                //                           clientRect: el.getBoundingClientRect()
                // });
              }
            }}
            onClickCapture={() => console.log('[resume] ⬇️ Start overlay - click captured')}
            onClick={() => {
              // console.log('[resume] ⬆️ Start overlay - click bubbled:');
              // console.log('[resume] 🖱️ Overlay clicked:', e.target);
            }}
            onMouseMove={(e) => {
              // Z-index investigation - check what elements are at cursor position
              const elements = document.elementsFromPoint(e.clientX, e.clientY);
              if (elements.length > 1) { // Only log if there are multiple elements (potential overlay)
                // console.log('[resume] 📍 Elements at cursor:', elements.slice(0, 3).map(el => ({
                //               tag: el.tagName,
                //                 classes: el.className,
                //     zIndex: window.getComputedStyle(el).zIndex,
                //     pointerEvents: window.getComputedStyle(el).pointerEvents,
                //     position: window.getComputedStyle(el).position
                // })));
              }
            }}
          >
            {/* Always show Let's Talk button - WITH DEBUGGING */}
            < button
              className={`control-button primary large-button ${connectionState === 'connecting' ? 'connecting' : ''} ${isPreparing ? 'preparing' : ''}`}
              ref={(el) => {
                if (el) {
                  // const computed = window.getComputedStyle(el);
                  // console.log('[resume] 🔍 Let\'s Talk button DOM/CSS:', {
                  //           element: el,
                  //             className: el.className,
                  //     disabled: el.disabled,
                  //     hasOnClick: !!el.onclick,
                  //     pointerEvents: computed.pointerEvents,
                  //     position: computed.position,
                  //     zIndex: computed.zIndex,
                  //     display: computed.display,
                  //     visibility: computed.visibility,
                  //     opacity: computed.opacity,
                  //     cursor: computed.cursor,
                  //     clientRect: el.getBoundingClientRect(),
                  //     style: el.getAttribute('style')
                  // });
                }
              }}
              onClickCapture={() => console.log('[resume] ⬇️ Let\'s Talk button - click captured')}
              onClick={() => {
                // console.log('[resume] 🖱️ Let\'s Talk button - click fired!');
                // console.log('[resume] 🎯 Event details:', {
                //         type: e.type,
                //           target: e.target,
                //       currentTarget: e.currentTarget,
                //       bubbles: e.bubbles,
                //       cancelable: e.cancelable,
                //       defaultPrevented: e.defaultPrevented,
                //       timeStamp: e.timeStamp
                // });
                // console.log('[V16] 🚀 USER: Let\'s Talk clicked', {
                //   shouldResume,
                //   hasResumableConversation: !!resumableConversation,
                // specialist: triageSession.currentSpecialist || 'triage',
                // hasTriagePrompt: !!triagePrompt,
                // userMode: user ? 'authenticated' : 'anonymous'
                //         });
                onLetsTalk();
              }}
              onMouseDown={() => console.log('[resume] 🖱️ Let\'s Talk button mousedown')}
              onMouseUp={() => console.log('[resume] 🖱️ Let\'s Talk button mouseup')}
              onMouseEnter={() => console.log('[resume] 📍 Let\'s Talk button mouse enter')}
              onMouseLeave={() => console.log('[resume] 📍 Let\'s Talk button mouse leave')}
              disabled={connectionState === 'connecting' || isPreparing}
              style={{ borderRadius: "9999px" }}
            >
              {connectionState === 'connecting' ? (
                <>
                  <span className="spinner"></span>
                  Connecting...
                </>
              ) : isPreparing ? (
                <>
                  <span className="spinner"></span>
                  Preparing...
                </>
              ) : (
                "Let's Talk"
              )}
            </button >

            {/* Show Resume checkbox if user has resumable conversation */}
            {resumeCheckboxJSX}

            {/* Spacing between Let's Talk and View conversation history */}
            <div className="mt-8"></div>

            {/* Show View conversation history button for authenticated users */}
            {
              user && (
                <button
                  onClick={() => window.location.href = '/chatbotV16/history'}
                  className="text-sm underline mt-2 cursor-pointer pointer-events-auto"
                  style={{ color: '#3b503c', pointerEvents: 'auto' }}
                  onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#9dbbac'}
                  onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#3b503c'}
                  onClickCapture={() => console.log('[history] ⬇️ History button - click captured')}
                  onMouseDown={() => console.log('[history] 🖱️ History button mousedown')}
                  onMouseUp={() => console.log('[history] 🖱️ History button mouseup')}
                  ref={(el) => {
                    if (el) {
                      // const computed = window.getComputedStyle(el);
                      // console.log('[history] 🔍 History button DOM/CSS:', {
                      //   element: el,
                      //     className: el.className,
                      //       hasOnClick: !!el.onclick,
                      //         pointerEvents: computed.pointerEvents,
                      //           position: computed.position,
                      //             zIndex: computed.zIndex,
                      //               display: computed.display,
                      //                 visibility: computed.visibility,
                      //                   opacity: computed.opacity,
                      //                     cursor: computed.cursor,
                      //                       clientRect: el.getBoundingClientRect(),
                      //                         style: el.getAttribute('style')
                      // });
                    }
                  }}
                >
                  View conversation history
                </button >
              )}

            {/* Show checking resume status */}
            {
              user && isCheckingResume && (
                <div className="text-xs text-gray-400 mt-2">
                  Checking for previous conversations...
                </div>
              )
            }
          </div >
        )}

      {/* Conversation container - naturally fills available space */}
      <div className={`conversation-container ${!isConnected ? 'conversation-container-with-overlay' : ''}`} style={{ position: 'relative', zIndex: 1 }}>
        <div className="conversation-history" ref={conversationHistoryRef}>
          {conversation.map((msg) => (
            <div
              key={msg.id}
              className={`message ${msg.role} ${!msg.isFinal ? 'animate-pulse' : ''}`}
            >
              {msg.role === 'assistant' && (msg.specialist || triageSession.currentSpecialist) && (
                <div className="text-xs font-medium text-blue-400 mb-1 uppercase tracking-wide">
                  {/* Displays specialist name + "AI" - currently shows "R2 AI" (was "TRIAGE AI") */}
                  {msg.specialist || triageSession.currentSpecialist} AI
                  {process.env.NEXT_PUBLIC_ENABLE_SPECIALIST_TRACKING_LOGS === 'true' && msg.isFinal && !((window as Window & { loggedMessages?: Set<string> }).loggedMessages)?.has(msg.id) && (() => {
                    const windowWithMessages = window as Window & { loggedMessages?: Set<string> };
                    if (!windowWithMessages.loggedMessages) windowWithMessages.loggedMessages = new Set();
                    windowWithMessages.loggedMessages.add(msg.id);
                    console.log('[specialist_tracking] 👁️ Message rendered', {
                      messageId: msg.id,
                      hasSpecialist: !!msg.specialist,
                      specialist: msg.specialist,
                      displayed: msg.specialist || triageSession.currentSpecialist
                    });
                    return null;
                  })()}
                </div>
              )}
              {msg.text}
              {/* Feedback buttons for recent assistant messages */}
              {msg.role === 'assistant' && msg.isFinal && (() => {
                // Show feedback buttons only for the last 5 assistant messages
                const assistantMessages = conversation.filter(m => m.role === 'assistant' && m.isFinal);
                const messageIndex = assistantMessages.findIndex(m => m.id === msg.id);
                const isRecent = messageIndex >= Math.max(0, assistantMessages.length - 5);
                return isRecent;
              })() && (
                <div className="feedback-buttons mt-2 flex gap-2 opacity-60 hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleFeedbackClick(msg.id, 'thumbs_up')}
                    className="feedback-button thumbs-up p-1.5 rounded-full hover:bg-green-100 dark:hover:bg-green-900/20 transition-colors"
                    aria-label="Thumbs up"
                  >
                    <ThumbsUp size={14} className="text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400" />
                  </button>
                  <button
                    onClick={() => handleFeedbackClick(msg.id, 'thumbs_down')}
                    className="feedback-button thumbs-down p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                    aria-label="Thumbs down"
                  >
                    <ThumbsDown size={14} className="text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400" />
                  </button>
                </div>
              )}
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
            <button
              type="button"
              onClick={toggleAudioOutputMute}
              className={`mute-button ${isAudioOutputMuted ? 'muted' : ''}`}
              aria-label={isAudioOutputMuted ? "Unmute speakers" : "Mute speakers"}
            >
              {isAudioOutputMuted ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" />
                  <path d="M11 5L6 9H2v6h4l3 3V16" stroke="currentColor" strokeWidth="2" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="2" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" stroke="currentColor" strokeWidth="2"
                    fill="none" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="2" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" strokeWidth="2" />
                </svg>
              )}
            </button>
            <input
              type="text"
              value={userMessage}
              onChange={(e) => handleInputChange(e.target.value)}
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
      {
        isConnected && (
          <div className="visualization-container">
            <AudioOrbV15 isFunctionExecuting={isFunctionExecuting} />
          </div>
        )
      }

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

      {/* Bug Report Modal for user feedback */}
      {isFeedbackModalOpen && (
        <BugReportModal
          onClose={handleCloseFeedbackModal}
          messageId={feedbackMessageId}
          feedbackType={feedbackType}
        />
      )}
    </div >
  );
}, (prevProps, nextProps) => {
  // FIXED: Custom comparison function for memo
  const userChanged = prevProps.user?.uid !== nextProps.user?.uid;
  const promptChanged = prevProps.triagePrompt?.id !== nextProps.triagePrompt?.id;
  const conversationChanged = prevProps.resumableConversation?.id !== nextProps.resumableConversation?.id;
  const onLetsTalkChanged = prevProps.onLetsTalk !== nextProps.onLetsTalk;
  const shouldResumeChanged = prevProps.shouldResume !== nextProps.shouldResume;
  const setShouldResumeChanged = prevProps.setShouldResume !== nextProps.setShouldResume;
  const isCheckingChanged = prevProps.isCheckingResume !== nextProps.isCheckingResume;
  const loadFunctionsChanged = prevProps.loadFunctionsForAI !== nextProps.loadFunctionsForAI;

  const propsChanged = userChanged || promptChanged || conversationChanged || onLetsTalkChanged ||
    shouldResumeChanged || setShouldResumeChanged || isCheckingChanged || loadFunctionsChanged;

  // console.log('[resume] 🔍 MEMO COMPARISON:', {
  //   timestamp: performance.now(),
  //     propsChanged,
  //     userChanged,
  //     promptChanged,
  //     conversationChanged,
  //     onLetsTalkChanged,
  //     shouldResumeChanged,
  //     setShouldResumeChanged,
  //     isCheckingChanged,
  //     loadFunctionsChanged,
  //     prevUserUid: prevProps.user?.uid,
  //       nextUserUid: nextProps.user?.uid,
  //         prevPromptId: prevProps.triagePrompt?.id,
  //           nextPromptId: nextProps.triagePrompt?.id,
  //             prevConversationId: prevProps.resumableConversation?.id,
  //               nextConversationId: nextProps.resumableConversation?.id,
  //                 prevOnLetsTalkRef: prevProps.onLetsTalk,
  //                   nextOnLetsTalkRef: nextProps.onLetsTalk,
  //                     prevSetShouldResumeRef: prevProps.setShouldResume,
  //                       nextSetShouldResumeRef: nextProps.setShouldResume,
  //                         prevLoadFunctionsRef: prevProps.loadFunctionsForAI,
  //                           nextLoadFunctionsRef: nextProps.loadFunctionsForAI,
  //                             willRerender: propsChanged
  // });

  if (propsChanged) {
    // console.log('[resume] 🔄 ChatBotV16Component props changed, will re-render');
  } else {
    // console.log('[resume] ✅ ChatBotV16Component props unchanged, skipping re-render');
  }

  return !propsChanged; // Return true to skip re-render, false to re-render
});

// V16: Simplified interfaces - no complex context states needed

// Resume conversation interface
interface ResumableConversation {
  id: string;
  currentSpecialist: string;
  specialistHistory: unknown[];
  createdAt: string;
  lastActivityAt: string;
  messages: unknown[];
}

// Main page component that initializes the Zustand WebRTC store
// Main page component implementing V16 Triage AI architecture
export default function ChatBotV16Page() {
  // const renderTimestamp = performance.now();
  // console.log('[resume] 🔄 ChatBotV16Page MAIN RENDER at', renderTimestamp);

  const { user, loading: authLoading } = useAuth();

  // V16: Use Supabase functions hook for proper function execution
  const {
    functionDefinitions: triageFunctions,
    functionRegistry,
    loading: functionsLoading,
    error: functionsError,
    loadFunctionsForAI
  } = useSupabaseFunctions();

  // V16 State: AI instructions (prompts still loaded via API like before)
  const [triagePrompt, setTriagePrompt] = useState<AIPrompt | null>(null);
  const [promptsLoading, setPromptsLoading] = useState(true);
  const [triageGreeting, setTriageGreeting] = useState<string | null>(null);

  // Resume functionality state
  const [resumableConversation, setResumableConversation] = useState<ResumableConversation | null>(null);
  const [isCheckingResume, setIsCheckingResume] = useState(false);
  const [shouldResume, setShouldResume] = useState(false); // Checkbox state
  const [historyResumeId, setHistoryResumeId] = useState<string | null>(null); // For resuming from history

  // V16 Resource context state from Zustand store
  const resourceLocatorContext = useWebRTCStore(state => state.resourceContext);
  const resourceLocatorAutoStarted = useWebRTCStore(state => state.resourceContextAutoStarted);
  const resourceGreeting = useWebRTCStore(state => state.resourceGreeting);
  const setResourceContext = useWebRTCStore(state => state.setResourceContext);
  const setResourceContextAutoStarted = useWebRTCStore(state => state.setResourceContextAutoStarted);
  const setResourceGreeting = useWebRTCStore(state => state.setResourceGreeting);
  // Sign-in dialog state
  const [isSignInDialogOpen, setIsSignInDialogOpen] = useState(false);

  // Use ref to track if API call is in progress (doesn't trigger re-renders)
  const isCheckingRef = useRef(false);

  // FIXED: Stabilize user reference - place early to maintain hook order
  const stableUser = useMemo(() => user, [user?.uid]);

  // FIXED: Stabilize resumableConversation reference - place early to maintain hook order
  const stableResumableConversation = useMemo(() => resumableConversation, [
    resumableConversation?.id
  ]);

  // console.log('[resume] 🎯 Resume state debug:', {
  //   timestamp: renderTimestamp,
  //     hasUser: !!user,
  //       userId: user?.uid,
  //         hasResumableConversation: !!resumableConversation,
  //           resumableConversationId: resumableConversation?.id,
  //             isCheckingResume,
  //             authLoading,
  //             promptsLoading,
  //             shouldShowResumeButton: !!(user && resumableConversation && !isCheckingResume)
  // });

  // Check for history resume parameters on mount - MOVED TO MAINTAIN HOOK ORDER
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const resumeParam = urlParams.get('resume');

      if (resumeParam === 'true') {
        const storedConversationId = localStorage.getItem('resumeConversationId');
        // const storedSpecialist = localStorage.getItem('resumeSpecialist');

        if (storedConversationId) {
          // console.log('[V16] 🔄 HISTORY-RESUME: Resuming conversation from history:', {
          //   conversationId: storedConversationId,
          //     specialist: storedSpecialist
          // });

          setHistoryResumeId(storedConversationId);
          setShouldResume(true);

          // Clean up localStorage
          localStorage.removeItem('resumeConversationId');
          localStorage.removeItem('resumeSpecialist');

          // Clean up URL
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        }
      }
    }
  }, []);

  // V16 removes specialized context states - triage AI handles all routing decisions

  // Get store functions and state
  const preInitialize = useWebRTCStore(state => state.preInitialize);
  const clearAnonymousSession = useWebRTCStore(state => state.clearAnonymousSession);
  const connect = useWebRTCStore(state => state.connect);
  const setConversationId = useWebRTCStore(state => state.setConversationId);
  const registerFunctions = useWebRTCStore(state => state.registerFunctions);
  const setPreparing = useWebRTCStore(state => state.setPreparing);

  // V16 functions now loaded directly via API in useEffect above (simplified architecture)

  // FIXED: Resume conversation logic - now called from Let's Talk button when checkbox is checked
  const handleResumeConversation = useCallback(async () => {
    // const resumeCallbackTimestamp = performance.now();
    // console.log('[resume] 🎯 handleResumeConversation CALLBACK CREATED at', resumeCallbackTimestamp);
    // console.log('[V16] 🚀 RESUME: handleResumeConversation function called');
    // Use the current value from state, don't put it in dependencies
    const currentConversation = resumableConversation;
    const currentUser = user;
    const currentHistoryResumeId = historyResumeId;

    // console.log('[V16] 🔍 RESUME: Pre-validation state check:', {
    //   hasUser: !!currentUser,
    //     userUid: currentUser?.uid,
    //       userEmail: currentUser?.email,
    //         hasConversation: !!currentConversation,
    //           conversationId: currentConversation?.id,
    //             conversationSpecialist: currentConversation?.currentSpecialist,
    //               conversationLastActivity: currentConversation?.lastActivityAt,
    //                 historyResumeId: currentHistoryResumeId,
    //                   resumeSource: currentHistoryResumeId ? 'history' : 'most_recent',
    //                     timestamp: performance.now()
    // });

    // Determine which conversation ID to use
    const conversationIdToResume = currentHistoryResumeId || currentConversation?.id;

    if (!currentUser?.uid || !conversationIdToResume) {
      // console.error('[V16] ❌ RESUME: Cannot resume - no user or conversation ID');
      // console.log('[V16] ❌ RESUME: Missing requirements details:', {
      //   hasUser: !!currentUser?.uid,
      //     hasConversation: !!currentConversation,
      //       hasHistoryResumeId: !!currentHistoryResumeId,
      //         conversationIdToResume,
      //         userState: currentUser ? 'exists' : 'null',
      //           conversationState: currentConversation ? 'exists' : 'null'
      // });
      return;
    }

    try {
      // console.log('[V16] 🔄 RESUME: Starting conversation resume', {
      //   conversationId: conversationIdToResume,
      //     resumeSource: currentHistoryResumeId ? 'history' : 'most_recent',
      //       specialist: currentConversation?.currentSpecialist,
      //         messageCount: currentConversation?.messages?.length || 0,
      //           hasMessages: !!currentConversation?.messages
      // });

      if (currentConversation) {
        // console.log('[V16] 🔍 RESUME: Current conversation messages check:', {
        //   messagesExists: !!currentConversation.messages,
        //     messagesType: typeof currentConversation.messages,
        //       messagesLength: currentConversation.messages?.length || 0
        // });
      }

      // Resume the conversation via API
      if (process.env.NEXT_PUBLIC_ENABLE_RESUME_CONVERSATION_LOGS === 'true') {
        console.log('[resume_conversation] 📡 Starting resume conversation API call', {
          userId: currentUser.uid,
          conversationId: conversationIdToResume
        });
      }

      const response = await fetch('/api/v16/resume-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.uid,
          conversationId: conversationIdToResume
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error('Failed to resume conversation');
      }

      if (process.env.NEXT_PUBLIC_ENABLE_RESUME_CONVERSATION_LOGS === 'true') {
        console.log('[resume_conversation] ✅ Resume conversation API response received', {
          success: data.success,
          conversationId: data.conversation?.id,
          messageCount: data.conversation?.messages?.length || 0,
          resumeSpecialist: data.conversation?.currentSpecialist
        });
      }

      // console.log('[V16] ✅ RESUME: Conversation resumed successfully', {
      // conversationId: data.conversation.id,
      //   specialist: data.conversation.currentSpecialist,
      //     messageCount: data.conversation.messages?.length || 0,
      //       hasMessages: !!data.conversation.messages
      //       });

      // console.log('[V16] 🔍 RESUME: API response messages check:', {
      // messagesExists: !!data.conversation.messages,
      //   messagesType: typeof data.conversation.messages,
      //     messagesLength: data.conversation.messages?.length || 0,
      //       fullConversationKeys: Object.keys(data.conversation)
      //       });

      // Set conversation ID in store
      setConversationId(data.conversation.id);

      // Load conversation history into UI - FAIL LOUDLY if messages missing
      if (!data.conversation.messages) {
        // console.error('[V16] ❌ CRITICAL: Resume API returned conversation without messages!', {
        //   conversationId: data.conversation.id,
        //     createdAt: data.conversation.createdAt,
        //       lastActivity: data.conversation.lastActivityAt,
        //         timespan: 'This conversation spans weeks - it MUST have messages!',
        //           apiEndpoint: '/api/v16/resume-conversation',
        //             expectedMessages: 'true',
        //               actualMessages: 'undefined'
        // });
        throw new Error(`BACKEND ERROR: Conversation ${data.conversation.id} missing messages array - this conversation has 6+ weeks of activity`);
      }

      if (data.conversation.messages.length === 0) {
        // console.error('[V16] ❌ CRITICAL: Resume API returned empty messages array!', {
        //   conversationId: data.conversation.id,
        //     timespan: 'May 13 to June 26 = 6+ weeks of activity',
        //       expectation: 'Should have multiple messages',
        //         actual: 'Empty array'
        // });
        throw new Error(`BACKEND ERROR: Conversation ${data.conversation.id} has empty messages - but was active for 6+ weeks`);
      }

      logSpecialistTracking('Loading conversation history', {
        conversationId: data.conversation.id,
        messageCount: data.conversation.messages.length,
        currentSpecialist: data.conversation.currentSpecialist
      });

      // Format conversation history for OpenAI
      const conversationHistory = data.conversation.messages.map((msg: {
        id: string;
        role: string;
        content: string;
        created_at: string;
        routing_metadata?: {
          specialist?: string;
          type?: string;
          context_summary?: string;
        };
      }) => {
        logSpecialistTracking('Processing historical message', {
          messageId: msg.id,
          messageRole: msg.role,
          routingMetadata: msg.routing_metadata,
          extractedSpecialist: msg.routing_metadata?.specialist
        });

        return {
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          timestamp: msg.created_at,
          specialist: msg.routing_metadata?.specialist
        };
      });

      // REMOVED: Don't load history into UI - let it rebuild naturally through message processing
      // This eliminates the double-loading conflict that causes infinite loops

      // Get the specialist to resume with
      const resumeSpecialist = data.conversation.currentSpecialist || 'triage';

      // Start session with the correct specialist
      // console.log(`[triageAI] 📡 API CALL: Resume conversation start-session request`, {
      // endpoint: '/api/v16/start-session',
      //   method: 'POST',
      //     userId: currentUser.uid,
      //       specialistType: resumeSpecialist,
      //         conversationId: data.conversation.id,
      //           contextSummary: `Resuming conversation from ${new Date(data.conversation.lastActivityAt).toLocaleString()}`,
      //             timestamp: new Date().toISOString()
      //       });

      const startResponse = await fetch('/api/v16/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.uid,
          specialistType: resumeSpecialist,
          conversationId: data.conversation.id,
          contextSummary: `Resuming conversation from ${new Date(data.conversation.lastActivityAt).toLocaleString()}`
        })
      });

      // console.log(`[triageAI] 📡 API RESPONSE: Resume start-session response received`, {
      // status: startResponse.status,
      //   statusText: startResponse.statusText,
      //     ok: startResponse.ok,
      //       headers: Object.fromEntries(startResponse.headers.entries()),
      //         timestamp: new Date().toISOString()
      //       });

      if (!startResponse.ok) {
        const errorText = await startResponse.text();
        // console.error(`[triageAI] ❌ API ERROR: Resume start-session failed`, {
        //   status: startResponse.status,
        //     statusText: startResponse.statusText,
        //       errorText,
        //       userId: currentUser.uid,
        //         specialistType: resumeSpecialist,
        //           conversationId: data.conversation.id,
        //             timestamp: new Date().toISOString()
        // });
        throw new Error(`Failed to start specialist session: ${startResponse.status} ${errorText}`);
      }

      const sessionData = await startResponse.json();
      // console.log(`[triageAI] ✅ API SUCCESS: Resume start-session response parsed`, {
      // hasSession: !!sessionData.session,
      //   hasPrompt: !!sessionData.session?.prompt,
      //     hasContent: !!sessionData.session?.prompt?.content,
      //       promptLength: sessionData.session?.prompt?.content?.length || 0,
      //         hasVoiceSettings: !!sessionData.session?.prompt?.voice_settings,
      //           sessionKeys: sessionData.session ? Object.keys(sessionData.session) : [],
      //             timestamp: new Date().toISOString()
      //       });
      // console.log('[V16] ✅ RESUME: Specialist session started', {
      // specialist: resumeSpecialist,
      //   promptLength: sessionData.session.prompt.content.length
      //       });

      // console.log('[systemInstructions] RESUME: Session data received from API:', {
      // hasSession: !!sessionData.session,
      //   hasPrompt: !!sessionData.session?.prompt,
      //     hasContent: !!sessionData.session?.prompt?.content,
      //       contentLength: sessionData.session?.prompt?.content?.length || 0,
      //         contentPreview: sessionData.session?.prompt?.content?.substring(0, 100) || 'EMPTY'
      //       });

      // CRITICAL: Include conversation history in the instructions BEFORE WebRTC config
      let instructionsWithHistory = sessionData.session.prompt.content;

      if (conversationHistory && conversationHistory.length > 0) {
        // Limit to most recent 100 messages to prevent overwhelming the AI  
        const recentHistory = conversationHistory.slice(-100);

        if (process.env.NEXT_PUBLIC_ENABLE_RESUME_CONVERSATION_LOGS === 'true') {
          console.log('[resume_conversation] 📝 Processing conversation history for instructions', {
            totalMessages: conversationHistory.length,
            recentMessagesSelected: recentHistory.length,
            firstMessageSample: recentHistory[0] ? {
              role: recentHistory[0].role,
              contentLength: recentHistory[0].text?.length || 0,
              contentPreview: recentHistory[0].text?.substring(0, 50) || 'NO CONTENT'
            } : 'NO MESSAGES'
          });
        }

        const formattedHistory = recentHistory
          .map((msg: Conversation) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
          .join('\n\n');

        if (process.env.NEXT_PUBLIC_ENABLE_RESUME_CONVERSATION_LOGS === 'true') {
          console.log('[resume_conversation] 📜 Formatted conversation history', {
            formattedLength: formattedHistory.length,
            formattedPreview: formattedHistory.substring(0, 200) + '...'
          });
        }

        instructionsWithHistory += `\n\nPrevious conversation history (${recentHistory.length} most recent messages):\n-----------------------------------\n${formattedHistory}\n-----------------------------------\n\nContinue the conversation naturally. Reference previous discussion when relevant. Always respond with both text and audio.`;

        // console.log('[systemInstructions] RESUME: Added conversation history to instructions:', {
        //   originalLength: sessionData.session.prompt.content.length,
        //     historyLength: formattedHistory.length,
        //       finalLength: instructionsWithHistory.length,
        //         messagesIncluded: recentHistory.length
        // });
      }

      // CRITICAL: Load functions for the specialist being resumed
      // console.log('[V16] 🔧 RESUME: Loading functions for specialist:', resumeSpecialist);
      const specialistFunctions = await loadFunctionsForAI(resumeSpecialist);
      // console.log('[V16] ✅ RESUME: Loaded functions for specialist:', {
      // specialist: resumeSpecialist,
      //   functionCount: specialistFunctions.length,
      //     functionNames: specialistFunctions.map(f => (f as { name: string }).name).join(', ')
      //       });

      // Configure WebRTC with the specialist prompt + conversation history, functions
      const resumeConfig = {
        enableDiagnostics: true,
        timeout: 120000,
        retryAttempts: 3,
        instructions: instructionsWithHistory, // Now includes conversation history
        tools: specialistFunctions,
        voice: sessionData.session.prompt.voice_settings?.voice || DEFAULT_VOICE,
        tool_choice: DEFAULT_TOOL_CHOICE,
        conversationHistory: [], // Clear this since history is now in instructions
        isResume: true // Use conversation item injection for greeting
      };

      // Log resume config creation
      logGreetingInstructions('V16_RESUME_CONFIG_CREATED', {
        greetingApproach: 'conversation_item_injection',
        resumeSpecialist,
        hasInstructions: !!resumeConfig.instructions,
        instructionsLength: resumeConfig.instructions?.length || 0,
        isResume: resumeConfig.isResume
      });

      // console.log('[systemInstructions] RESUME: WebRTC config created:', {
      // hasInstructions: !!resumeConfig.instructions,
      //   instructionsLength: resumeConfig.instructions?.length || 0,
      //     instructionsPreview: resumeConfig.instructions?.substring(0, 100) || 'EMPTY',
      //       hasConversationHistory: !!resumeConfig.conversationHistory,
      //         conversationHistoryLength: resumeConfig.conversationHistory?.length || 0
      //       });

      // Clear preparing state and start connection
      setPreparing(false);

      // Log before passing to WebRTC
      logGreetingInstructions('V16_BEFORE_PREINITIALIZE', {
        greetingApproach: 'conversation_item_injection',
        isResume: resumeConfig.isResume,
        configKeys: Object.keys(resumeConfig).join(', ')
      });

      await preInitialize(resumeConfig);
      connect();

      // console.log('[V16] 🎉 RESUME: Conversation resumed and connected successfully');

    } catch (error) {
      // console.error('[V16] ❌ RESUME: Failed to resume conversation', {
      //   error: (error as Error).message,
      //     conversationId: conversationIdToResume,
      //       resumeSource: currentHistoryResumeId ? 'history' : 'most_recent'
      // });

      optimizedAudioLogger.error('resume', 'conversation_resume_failed', error as Error, {
        conversationId: conversationIdToResume,
        userId: currentUser.uid,
        resumeSource: currentHistoryResumeId ? 'history' : 'most_recent'
      });

      alert(`Failed to resume conversation: ${(error as Error).message}`);
    } finally {
      // Clear history resume ID after attempting resume
      if (currentHistoryResumeId) {
        setHistoryResumeId(null);
      }
    }
  }, [user?.uid, resumableConversation, historyResumeId]); // ✅ Include ALL dependencies

  // console.log('[resume] 🎯 handleResumeConversation DEPENDENCY CHECK:', {
  // timestamp: performance.now(),
  //   userUid: user?.uid,
  //     resumableConversationId: resumableConversation?.id,
  //       historyResumeId,
  //       callbackRef: handleResumeConversation
  //   });

  // NEW: Combined handler for Let's Talk button - handles both normal and resume flows
  const handleLetsTalk = useCallback(async () => {
    // const callbackTimestamp = performance.now();
    // console.log('[resume] 🎯 handleLetsTalk CALLBACK CREATED at', callbackTimestamp);

    // CRITICAL: Multilingual support logging - track language preference when conversation starts
    const logMultilingualSupport = (message: string, ...args: unknown[]) => {
      if (process.env.NEXT_PUBLIC_ENABLE_MULTILINGUAL_SUPPORT_LOGS === 'true') {
        console.log(`[multilingual_support] ${message}`, ...args);
      }
    };

    // Get current language preference from localStorage
    const currentLanguagePreference = typeof window !== 'undefined' 
      ? localStorage.getItem('languagePreference') || 'en' 
      : 'en';

    logMultilingualSupport('🚀 CONVERSATION START: Let\'s Talk button clicked', {
      currentLanguagePreference,
      shouldResume,
      hasResumableConversation: !!resumableConversation,
      specialist: resumableConversation?.currentSpecialist || 'triage',
      userMode: user ? 'authenticated' : 'anonymous',
      userId: user?.uid || 'anonymous',
      timestamp: new Date().toISOString(),
      source: 'lets-talk-button-clicked',
      conversationType: shouldResume && (resumableConversation || historyResumeId) ? 'resume' : 'new',
      impact: 'Will determine what language greeting is requested from API'
    });

    // console.log('[V16] 🚀 USER: Let\'s Talk clicked', {
    //   shouldResume,
    //     hasResumableConversation: !!resumableConversation,
    //       specialist: resumableConversation?.currentSpecialist || 'triage',
    //         userMode: user ? 'authenticated' : 'anonymous'
    // });

    // console.log('[V16] 🔍 RESUME: Let\'s Talk state analysis:', {
    // shouldResume,
    //   hasUser: !!user,
    //     userUid: user?.uid,
    //       hasResumableConversation: !!resumableConversation,
    //         resumableConversationId: resumableConversation?.id,
    //           resumableConversationSpecialist: resumableConversation?.currentSpecialist,
    //             historyResumeId,
    //             hasHistoryResumeId: !!historyResumeId,
    //               allConditionsMet: shouldResume && (resumableConversation || historyResumeId) && user?.uid,
    //                 timestamp: performance.now()
    //     });

    if (shouldResume && (resumableConversation || historyResumeId) && user?.uid) {
      // Resume existing conversation (either most recent or from history)
      // console.log('[V16] 🔄 RESUME: Starting resume flow from Let\'s Talk button');
      logMultilingualSupport('🔄 RESUME: Starting resume conversation flow', {
        currentLanguagePreference,
        resumableConversationId: resumableConversation?.id,
        historyResumeId,
        specialist: resumableConversation?.currentSpecialist,
        source: 'resume-conversation-flow',
        impact: 'Resume flow will use existing conversation context'
      });
      await handleResumeConversation();
    } else {
      // Start new conversation
      // console.log('[V16] 🆕 NEW: Starting new triage session from Let\'s Talk button');
      logMultilingualSupport('🆕 NEW: Starting new conversation with triage AI', {
        currentLanguagePreference,
        userMode: user ? 'authenticated' : 'anonymous',
        userId: user?.uid || 'anonymous',
        source: 'new-conversation-flow',
        impact: 'New conversation will request greeting in selected language'
      });
      setPreparing(false);
      connect();
    }
  }, [shouldResume, resumableConversation, historyResumeId, user?.uid, handleResumeConversation, connect, setPreparing]);

  // Handler for Let's Talk button that shows sign-in dialog for non-authenticated users
  const handleLetsTalkClick = useCallback(() => {
    if (!user) {
      // User is not signed in - show sign-in dialog
      setIsSignInDialogOpen(true);
    } else {
      // User is signed in - proceed with normal flow
      handleLetsTalk();
    }
  }, [user, handleLetsTalk]);

  // console.log('[resume] 🎯 handleLetsTalk DEPENDENCY CHECK:', {
  // timestamp: performance.now(),
  //   shouldResume,
  //   resumableConversationId: resumableConversation?.id,
  //     historyResumeId,
  //     userUid: user?.uid,
  //       handleResumeConversationRef: handleResumeConversation,
  //         connectRef: connect,
  //           setPreparingRef: setPreparing,
  //             callbackRef: handleLetsTalk
  //   });

  // console.log('[resume] 🔧 Function reference debug:', {
  // handleResumeConversationExists: !!handleResumeConversation,
  //   handleResumeConversationType: typeof handleResumeConversation
  //   });

  // Auto-trigger Let's Talk when coming from history with valid resume data - MOVED TO MAINTAIN HOOK ORDER
  useEffect(() => {
    // Only make decision when all loading is complete
    if (!authLoading && !promptsLoading && !functionsLoading) {
      if (historyResumeId && shouldResume && user?.uid) {
        // console.log('[V16] 🤖 AUTO-RESUME: Automatically triggering Let\'s Talk for history resume');
        handleLetsTalk();
      } else {
        // console.log('[V16] 🎯 READY: No auto-connection needed, user can click Let\'s Talk');
        setPreparing(false); // Clear preparing state - show "Let's Talk"
      }
    }
  }, [historyResumeId, shouldResume, user?.uid, authLoading, promptsLoading, functionsLoading, handleLetsTalk, setPreparing]);

  // Handle user authentication changes - clear anonymous session when user signs in
  useEffect(() => {
    if (user) {
      // console.log('[V16] 🔐 AUTH: User signed in, clearing anonymous session', {
      //   userId: user.uid,
      //     userEmail: user.email
      // });
      clearAnonymousSession();

      // Store authenticated user ID in localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('userId', user.uid);
      }
    } else {
      // console.log('[V16] 🔒 AUTH: Anonymous mode or user signed out');
      // User signed out - remove authenticated user ID
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('userId');
      }
    }
  }, [user, clearAnonymousSession]);

  // Function to process resource locator context from sessionStorage
  const processResourceLocatorContext = useCallback(() => {
    logResourceGreeting('📍 [NAVIGATION] Processing resource locator context on navigation');

    if (typeof window !== 'undefined') {
      const resourceLocatorContextJson = sessionStorage.getItem('resourceLocatorContext');

      logResourceGreeting('📍 [NAVIGATION] SessionStorage check', {
        hasResourceContext: !!resourceLocatorContextJson,
        rawValue: resourceLocatorContextJson?.substring(0, 100) + '...' || 'null'
      });

      if (resourceLocatorContextJson) {
        logResourceGreeting('📍 [NAVIGATION] Found resourceLocatorContext, parsing...');
        try {
          const contextData = JSON.parse(resourceLocatorContextJson);
          logResourceGreeting('📍 [NAVIGATION] Parsed context data', {
            mode: contextData.mode,
            source: contextData.source,
            resourceTitle: contextData.selectedResource?.title,
            resourceId: contextData.selectedResource?.id,
            resourceCategory: contextData.selectedResource?.category,
            timestamp: contextData.timestamp
          });

          if (contextData.mode === 'resource_locator' && contextData.selectedResource) {
            logResourceGreeting('📍 [NAVIGATION] ✅ Valid resource locator context found, storing in Zustand store');
            logResourceReset('🔄 Resource context found, checking if conversation reset is needed');

            // Reset conversation state if user was in middle of chat
            const currentState = useWebRTCStore.getState();
            logResourceReset('🔍 Pre-reset state check', {
              isConnected: currentState.isConnected,
              conversationLength: currentState.conversation.length,
              resourceContextAutoStarted: currentState.resourceContextAutoStarted,
              connectionState: currentState.connectionState,
              hasResourceContext: !!currentState.resourceContext
            });

            if (currentState.isConnected || currentState.conversation.length > 0) {
              logResourceGreeting('📍 [NAVIGATION] 🔄 Existing conversation detected - resetting state for resource context');
              logResourceReset('🚨 RESETTING: Existing conversation detected, performing full reset');

              // Reset conversation and auto-start flags
              logResourceReset('🔌 Calling handleDisconnectWithReset()');
              currentState.handleDisconnectWithReset();

              logResourceReset('🔄 Setting resourceContextAutoStarted to false');
              setResourceContextAutoStarted(false);

              // Log state after reset
              const postResetState = useWebRTCStore.getState();
              logResourceReset('✅ Post-reset state', {
                isConnected: postResetState.isConnected,
                conversationLength: postResetState.conversation.length,
                resourceContextAutoStarted: postResetState.resourceContextAutoStarted,
                connectionState: postResetState.connectionState
              });

              logResourceGreeting('📍 [NAVIGATION] ✅ Conversation state reset complete');
            } else {
              logResourceReset('ℹ️ No existing conversation - no reset needed');
            }

            logResourceReset('💾 Storing resource context in Zustand store');
            setResourceContext(contextData);
            logResourceGreeting('📍 [NAVIGATION] Resource context stored - will trigger auto-start and greeting generation');
          } else {
            logResourceGreeting('📍 [NAVIGATION] ❌ Invalid context data:', {
              mode: contextData.mode,
              hasSelectedResource: !!contextData.selectedResource,
              expectedMode: 'resource_locator'
            });
          }

          // Clear the context after reading it
          logResourceGreeting('📍 [NAVIGATION] Clearing resourceLocatorContext from sessionStorage');
          sessionStorage.removeItem('resourceLocatorContext');
        } catch (error) {
          logResourceGreeting('📍 [NAVIGATION] ❌ Error parsing context:', error);
        }
      } else {
        logResourceGreeting('📍 [NAVIGATION] No resourceLocatorContext found - normal flow');
      }
    }
  }, [setResourceContext, setResourceContextAutoStarted]);

  // Listen for navigation events to process resource context when navigating to chatbotV16
  useEffect(() => {
    const handleRouteChange = () => {
      // Only process when we're actually on the chatbotV16 route
      if (window.location.pathname === '/chatbotV16') {
        processResourceLocatorContext();
      }
    };

    // Check immediately in case we're already on the route
    handleRouteChange();

    // Listen for browser navigation events (back/forward buttons)
    window.addEventListener('popstate', handleRouteChange);

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [processResourceLocatorContext]);

  // Resource Locator context detection (V16 Zustand pattern)
  useEffect(() => {
    logResourceGreeting('📍 STEP 1: V16 Resource context detection useEffect triggered');

    if (typeof window !== 'undefined') {
      const resourceLocatorContextJson = sessionStorage.getItem('resourceLocatorContext');

      logResourceGreeting('📍 STEP 2: SessionStorage check', {
        hasResourceContext: !!resourceLocatorContextJson,
        rawValue: resourceLocatorContextJson?.substring(0, 100) + '...' || 'null'
      });

      if (resourceLocatorContextJson) {
        logResourceGreeting('📍 STEP 3: Found resourceLocatorContext in sessionStorage, parsing...');
        try {
          const contextData = JSON.parse(resourceLocatorContextJson);
          logResourceGreeting('📍 STEP 4: Parsed Resource Locator context data', {
            mode: contextData.mode,
            source: contextData.source,
            resourceTitle: contextData.selectedResource?.title,
            resourceId: contextData.selectedResource?.id,
            resourceCategory: contextData.selectedResource?.category,
            timestamp: contextData.timestamp
          });

          if (contextData.mode === 'resource_locator' && contextData.selectedResource) {
            logResourceGreeting('📍 STEP 5: ✅ Valid resource locator context found, storing in Zustand store');
            setResourceContext(contextData);
            logResourceGreeting('📍 STEP 6: Resource context stored in Zustand - will trigger auto-start and greeting generation');
          } else {
            logResourceGreeting('📍 STEP 5: ❌ Invalid context data - missing mode or selectedResource:', {
              mode: contextData.mode,
              hasSelectedResource: !!contextData.selectedResource,
              expectedMode: 'resource_locator'
            });
          }

          // Clear the context after reading it
          logResourceGreeting('📍 STEP 7: Clearing resourceLocatorContext from sessionStorage');
          sessionStorage.removeItem('resourceLocatorContext');
        } catch (error) {
          logResourceGreeting('📍 STEP 5: ❌ Error parsing Resource Locator context from sessionStorage:', error);
          logResourceGreeting('📍 Raw sessionStorage value was:', resourceLocatorContextJson);
        }
      } else {
        logResourceGreeting('📍 STEP 3: No resourceLocatorContext found in sessionStorage - normal triage flow');
      }
    } else {
      logResourceGreeting('📍 STEP 2: Window not available - skipping sessionStorage check');
    }
  }, [setResourceContext]);

  // Generate resource greeting when resource context is detected (V16 anonymous support)
  useEffect(() => {
    logResourceGreeting('💬 STEP 8: Greeting generation useEffect triggered', {
      hasResourceContext: !!resourceLocatorContext,
      resourceTitle: resourceLocatorContext?.selectedResource?.title,
      hasUser: !!user,
      userId: user?.uid || 'anonymous'
    });

    if (resourceLocatorContext && resourceLocatorContext.selectedResource) {
      logResourceGreeting('💬 STEP 9: Resource context found, generating resource-specific greeting', {
        resourceTitle: resourceLocatorContext.selectedResource.title,
        resourceId: resourceLocatorContext.selectedResource.id,
        resourceCategory: resourceLocatorContext.selectedResource.category,
        resourceDescription: resourceLocatorContext.selectedResource.description.substring(0, 50) + '...'
      });

      const userId = user?.uid || 'anonymous';
      logResourceGreeting('💬 GREETING: Calling getResourceWelcomeContent', {
        userId: userId,
        resourceData: {
          id: resourceLocatorContext.selectedResource.id,
          title: resourceLocatorContext.selectedResource.title,
          subtitle: resourceLocatorContext.selectedResource.subtitle,
          category: resourceLocatorContext.selectedResource.category,
          hasId: !!resourceLocatorContext.selectedResource.id,
          idValue: resourceLocatorContext.selectedResource.id || 'MISSING'
        }
      });

      getResourceWelcomeContent(resourceLocatorContext.selectedResource, userId)
        .then((greeting) => {
          logResourceGreeting('💬 GREETING: ✅ Resource greeting generated successfully', {
            greetingLength: greeting.length,
            greetingPreview: greeting.substring(0, 200) + '...',
            resourceTitle: resourceLocatorContext.selectedResource.title,
            resourceId: resourceLocatorContext.selectedResource.id,
            contains_food: greeting.toLowerCase().includes('food'),
            contains_shelter: greeting.toLowerCase().includes('shelter'),
            contains_emergency: greeting.toLowerCase().includes('emergency')
          });
          
          logResourceGreeting('💬 GREETING: Setting resource greeting in state');
          setResourceGreeting(greeting);
          
          logResourceGreeting('💬 GREETING: ✅ Resource greeting set in state successfully');
        })
        .catch((error) => {
          logResourceGreeting('💬 STEP 11: ❌ CRITICAL ERROR generating resource greeting:', error);
          console.error('[V16] CRITICAL RESOURCE GREETING ERROR:', error);
          
          // Show verbose UI error - no fallbacks allowed
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          alert(`V16 RESOURCE GREETING SYSTEM FAILURE

${errorMessage}

This is a breaking error in the V16 system. The application cannot proceed without a resource greeting in your selected language.

Please contact an administrator to resolve this issue.

Resource: ${resourceLocatorContext.selectedResource.title}
Language: ${getStoredLanguagePreference(!!user)}
User: ${user?.uid || 'anonymous'}
Time: ${new Date().toLocaleString()}`);
          
          // Do not set null - leave existing greeting or show error state
          logResourceGreeting('💬 STEP 12: ❌ NOT setting greeting to null - showing breaking error instead');
        });
    } else if (!resourceLocatorContext) {
      logResourceGreeting('💬 STEP 9: No resource context - clearing resource greeting');
      // Clear resource greeting if no resource context
      setResourceGreeting(null);
    }
  }, [resourceLocatorContext, user, setResourceGreeting]);

  // Auto-start session for Resource Locator context (V16 Zustand pattern)
  useEffect(() => {
    const currentState = useWebRTCStore.getState();
    const isConnected = currentState.isConnected;
    const connect = currentState.connect;

    logResourceGreeting('🚀 STEP 13: Auto-start effect check', {
      hasResourceLocatorContext: !!resourceLocatorContext,
      resourceTitle: resourceLocatorContext?.selectedResource?.title,
      isConnected,
      resourceLocatorAutoStarted,
      hasTriagePrompt: !!triagePrompt,
      hasTriageFunctions: !!triageFunctions,
      shouldAutoStart: !!(resourceLocatorContext && !isConnected && !resourceLocatorAutoStarted && triagePrompt && triageFunctions)
    });

    logResourceReset('🚀 Auto-start effect triggered', {
      effectTriggeredAt: new Date().toISOString(),
      hasResourceContext: !!resourceLocatorContext,
      isConnected,
      resourceAutoStarted: resourceLocatorAutoStarted,
      connectionState: currentState.connectionState,
      conversationLength: currentState.conversation.length,
      resourceContextTimestamp: resourceLocatorContext?.timestamp
    });

    if (resourceLocatorContext && !isConnected && !resourceLocatorAutoStarted && triagePrompt && triageFunctions) {
      logResourceGreeting('🚀 STEP 14: ✅ Auto-starting Resource Locator session', {
        resourceTitle: resourceLocatorContext.selectedResource?.title,
        resourceId: resourceLocatorContext.selectedResource?.id,
        delay: '500ms'
      });

      logResourceReset('🎯 CONDITIONS MET: Starting auto-connect timer', {
        resourceTitle: resourceLocatorContext.selectedResource?.title,
        timerDelay: 500,
        currentTime: Date.now()
      });

      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        logResourceGreeting('🚀 STEP 15: Timer fired - calling WebRTC connect()');
        logResourceReset('⏰ TIMER FIRED: About to call connect()', {
          timerFiredAt: Date.now(),
          aboutToCallConnect: true
        });

        // Check WebRTC config readiness before calling connect
        const configState = useWebRTCStore.getState();
        logResourceReset('🔍 PRE-CONNECT STATE CHECK', {
          hasTriagePrompt: !!triagePrompt,
          hasTriageFunctions: !!triageFunctions,
          hasWebRTCConfig: !!webRTCConfig,
          connectionState: configState.connectionState,
          isConnected: configState.isConnected,
          isPreparing: configState.isPreparing
        });

        try {
          connect();
          logResourceReset('🔗 CONNECT CALLED: Function executed without error');
        } catch (error) {
          logResourceReset('❌ CONNECT ERROR: Exception thrown', { error });
        }

        // Check state immediately after connect call
        const postConnectState = useWebRTCStore.getState();
        logResourceReset('📊 POST-CONNECT STATE', {
          connectionState: postConnectState.connectionState,
          isConnected: postConnectState.isConnected,
          isPreparing: postConnectState.isPreparing,
          conversationLength: postConnectState.conversation.length
        });

        logResourceReset('🔗 CONNECT CALLED: Setting auto-started flag');
        // Mark as auto-started AFTER the session starts to prevent re-triggering
        setResourceContextAutoStarted(true);
        logResourceGreeting('🚀 STEP 16: Marked as auto-started - preventing re-triggering');

        logResourceReset('✅ AUTO-START COMPLETE: Flags set', {
          autoStartCompleteAt: Date.now(),
          resourceContextAutoStarted: true
        });
      }, 500);

      return () => {
        logResourceGreeting('🚀 STEP 15: Auto-start timer cleanup');
        logResourceReset('🧹 Timer cleanup called');
        clearTimeout(timer);
      };
    } else {
      logResourceGreeting('🚀 STEP 14: Auto-start conditions not met', {
        reason: !resourceLocatorContext ? 'no_resource_context' :
          isConnected ? 'already_connected' :
            resourceLocatorAutoStarted ? 'already_auto_started' :
              !triagePrompt ? 'no_triage_prompt' :
                !triageFunctions ? 'no_triage_functions' : 'unknown'
      });

      logResourceReset('❌ CONDITIONS NOT MET: Auto-start blocked', {
        hasResourceContext: !!resourceLocatorContext,
        isConnected,
        resourceAutoStarted: resourceLocatorAutoStarted,
        hasTriagePrompt: !!triagePrompt,
        hasTriageFunctions: !!triageFunctions,
        blockingReason: !resourceLocatorContext ? 'no_resource_context' :
          isConnected ? 'already_connected' :
            resourceLocatorAutoStarted ? 'already_auto_started' :
              !triagePrompt ? 'no_triage_prompt' :
                !triageFunctions ? 'no_triage_functions' : 'unknown',
        detailedState: {
          connectionState: currentState.connectionState,
          conversationLength: currentState.conversation.length,
          resourceContextTimestamp: resourceLocatorContext?.timestamp || null
        }
      });
    }
  }, [resourceLocatorContext, resourceLocatorAutoStarted, setResourceContextAutoStarted, triagePrompt, triageFunctions]);

  // Log dependency changes for debugging
  useEffect(() => {
    logResourceReset('📊 DEPENDENCY TRACKER: resourceLocatorContext changed', {
      timestamp: Date.now(),
      hasResourceContext: !!resourceLocatorContext,
      resourceTitle: resourceLocatorContext?.selectedResource?.title || null,
      resourceTimestamp: resourceLocatorContext?.timestamp || null,
      triggerTime: new Date().toISOString()
    });
  }, [resourceLocatorContext]);

  useEffect(() => {
    logResourceReset('📊 DEPENDENCY TRACKER: resourceLocatorAutoStarted changed', {
      timestamp: Date.now(),
      resourceAutoStarted: resourceLocatorAutoStarted,
      triggerTime: new Date().toISOString()
    });
  }, [resourceLocatorAutoStarted]);

  useEffect(() => {
    logResourceReset('📊 DEPENDENCY TRACKER: triagePrompt changed', {
      timestamp: Date.now(),
      hasTriagePrompt: !!triagePrompt,
      promptId: triagePrompt?.id || null,
      triggerTime: new Date().toISOString()
    });
  }, [triagePrompt]);

  useEffect(() => {
    logResourceReset('📊 DEPENDENCY TRACKER: triageFunctions changed', {
      timestamp: Date.now(),
      hasTriageFunctions: !!triageFunctions,
      functionsCount: triageFunctions?.length || 0,
      triggerTime: new Date().toISOString()
    });
  }, [triageFunctions]);


  // V16 Configuration: Always starts with triage AI
  const webRTCConfig = useMemo(() => {
    logResourceGreeting('⚙️ STEP 17: WebRTC configuration memoization triggered', {
      hasTriagePrompt: !!triagePrompt,
      hasFunctions: !!triageFunctions,
      hasResourceGreeting: !!resourceGreeting,
      resourceGreetingLength: resourceGreeting?.length || 0,
      resourceContextTitle: resourceLocatorContext?.selectedResource?.title || null,
      timestamp: new Date().toISOString()
    });

    // Log timing analysis for resource greeting vs WebRTC config
    if (process.env.NEXT_PUBLIC_ENABLE_MULTILINGUAL_SUPPORT_LOGS === 'true') {
      console.log('[multilingual_support] V16 page: WebRTC config useMemo execution', {
        resourceGreeting: resourceGreeting ? 'PRESENT' : 'MISSING',
        resourceGreetingLength: resourceGreeting?.length || 0,
        resourceContext: resourceLocatorContext?.selectedResource?.title || 'NONE',
        triagePrompt: triagePrompt ? 'LOADED' : 'MISSING',
        triageFunctions: triageFunctions ? 'LOADED' : 'MISSING',
        timestamp: new Date().toISOString()
      });
    }

    if (triagePrompt && triageFunctions) {
      // FIXED: Use triage greeting from Supabase instead of hardcoded English
      const defaultGreeting = 'Hello! I\'m here to help assess your needs and connect you with the right support. What brings you here today?';
      const finalGreeting = resourceGreeting || triageGreeting || defaultGreeting;

      logResourceGreeting('⚙️ STEP 18: ✅ WebRTC configuration created', {
        promptId: triagePrompt.id,
        promptType: triagePrompt.type,
        instructionsLength: triagePrompt.content.length,
        functionsCount: triageFunctions.length,
        voice: (triagePrompt.voice_settings as Record<string, unknown>)?.voice as string || DEFAULT_VOICE,
        greetingSource: resourceGreeting ? 'RESOURCE_SPECIFIC' : triageGreeting ? 'SUPABASE_TRIAGE' : 'DEFAULT_TRIAGE',
        greetingLength: finalGreeting.length,
        greetingPreview: finalGreeting.substring(0, 150) + '...',
        hasResourceContext: !!resourceLocatorContext,
        resourceTitle: resourceLocatorContext?.selectedResource?.title || null,
        // CRITICAL: Log the actual greeting content being sent
        ACTUAL_GREETING_INSTRUCTIONS: finalGreeting
      });

      // When resource context exists, modify the main instructions to be resource-focused
      const finalInstructions = resourceLocatorContext
        ? `${triagePrompt.content}\n\n# RESOURCE CONTEXT OVERRIDE\n${resourceGreeting}`
        : triagePrompt.content;

      logResourceGreeting('⚙️ STEP 18a: Final instructions configured', {
        hasResourceContext: !!resourceLocatorContext,
        instructionsSource: resourceLocatorContext ? 'TRIAGE_PLUS_RESOURCE' : 'TRIAGE_ONLY',
        finalInstructionsLength: finalInstructions.length,
        resourceContextAdded: !!resourceLocatorContext
      });

      // CRITICAL: Log exactly what greeting content will be sent to AI
      const logMultilingualSupport = (message: string, ...args: unknown[]) => {
        if (process.env.NEXT_PUBLIC_ENABLE_MULTILINGUAL_SUPPORT_LOGS === 'true') {
          console.log(`[multilingual_support] ${message}`, ...args);
        }
      };

      logMultilingualSupport('🤖 FINAL AI CONTENT: WebRTC configuration created - this is what AI will receive', {
        greetingSource: resourceGreeting ? 'RESOURCE_SPECIFIC' : triageGreeting ? 'SUPABASE_TRIAGE' : 'DEFAULT_TRIAGE', 
        hasResourceContext: !!resourceLocatorContext,
        resourceTitle: resourceLocatorContext?.selectedResource?.title || null,
        greetingInstructions: finalGreeting,
        greetingLength: finalGreeting.length,
        instructionsSource: resourceLocatorContext ? 'TRIAGE_WITH_RESOURCE_OVERRIDE' : 'TRIAGE_ONLY',
        finalInstructions: finalInstructions,
        finalInstructionsLength: finalInstructions.length,
        voice: (triagePrompt.voice_settings as Record<string, unknown>)?.voice as string || DEFAULT_VOICE,
        timestamp: new Date().toISOString(),
        source: 'webrtc-config-final',
        impact: 'This exact content determines what language and greeting the AI will use'
      });

      return {
        enableDiagnostics: true,
        timeout: 120000,
        retryAttempts: 3,
        instructions: finalInstructions,
        tools: triageFunctions,
        voice: (triagePrompt.voice_settings as Record<string, unknown>)?.voice as string || DEFAULT_VOICE,
        tool_choice: DEFAULT_TOOL_CHOICE,
        greetingInstructions: finalGreeting
      };
    } else {
      logResourceGreeting('⚙️ STEP 18: ⏳ WebRTC configuration not ready', {
        hasPrompt: !!triagePrompt,
        hasFunctions: !!triageFunctions,
        waiting: 'triagePrompt and triageFunctions from Supabase'
      });
      return null;
    }
  }, [triagePrompt, triageFunctions, resourceGreeting, triageGreeting, resourceLocatorContext]);

  // Track dependencies for timing analysis
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_MULTILINGUAL_SUPPORT_LOGS === 'true') {
      console.log('[multilingual_support] V16 page: webRTCConfig dependencies changed', {
        triagePrompt: triagePrompt ? 'LOADED' : 'MISSING',
        triageFunctions: triageFunctions ? 'LOADED' : 'MISSING',
        resourceGreeting: resourceGreeting ? 'PRESENT' : 'MISSING',
        resourceGreetingLength: resourceGreeting?.length || 0,
        triageGreeting: triageGreeting ? 'PRESENT' : 'MISSING',
        triageGreetingLength: triageGreeting?.length || 0,
        resourceLocatorContext: resourceLocatorContext ? 'PRESENT' : 'MISSING',
        resourceTitle: resourceLocatorContext?.selectedResource?.title || 'NONE',
        timestamp: new Date().toISOString()
      });
    }
  }, [triagePrompt, triageFunctions, resourceGreeting, triageGreeting, resourceLocatorContext]);

  // ALWAYS start with preparing state when screen loads
  useEffect(() => {
    // console.log(`[V16-UI-STATE] Setting initial preparing state: true (always show Preparing... on load)`);
    setPreparing(true);
  }, []); // Empty dependency array - only run once on mount

  // FIXED: Check for resumable conversations when user is authenticated - use stable reference
  useEffect(() => {
    if (!stableUser?.uid) {
      // console.log('[resume] 🔄 setResumableConversation(null) called at', performance.now());
      setResumableConversation(null);
      setIsCheckingResume(false);
      isCheckingRef.current = false;
      return;
    }

    const abortController = new AbortController();

    const checkResumableConversation = async () => {
      // Use ref for duplicate prevention instead of state (doesn't trigger re-renders)
      if (isCheckingRef.current) {
        // console.log('[V16] 🚫 RESUME: Already checking for resumable conversations, skipping duplicate call');
        return;
      }

      isCheckingRef.current = true;
      // console.log('[resume] 🔄 setIsCheckingResume(true) called at', performance.now());
      setIsCheckingResume(true);

      try {
        // console.log('[V16] 📡 RESUME: Checking for resumable conversations', {
        //   userId: stableUser.uid
        // });

        const response = await fetch(`/api/v16/get-resumable-conversation?userId=${stableUser.uid}`, {
          signal: abortController.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();

        // console.log('[V16] ✅ RESUME: API response received', data);

        // Check if request was aborted before updating state
        if (abortController.signal.aborted) {
          // console.log('[V16] 🚫 RESUME: Request was aborted, skipping state update');
          return;
        }

        if (data.success && data.hasResumableConversation) {
          // console.log('[V16] ✅ RESUME: Found resumable conversation', {
          //   conversationId: data.conversation.id,
          //     specialist: data.conversation.currentSpecialist,
          //       lastActivity: data.conversation.lastActivityAt
          // });
          // console.log('[V16] 🔍 RESUME: Setting resumable conversation state:', {
          // conversationData: data.conversation,
          //   hasId: !!data.conversation.id,
          //     hasSpecialist: !!data.conversation.currentSpecialist,
          //       timestamp: performance.now()
          //           });
          // console.log('[V16] 🔍 FULL CONVERSATION OBJECT:', {
          // fullObject: JSON.stringify(data.conversation, null, 2),
          //   hasMessages: !!data.conversation.messages,
          //     messageCount: data.conversation.messages?.length || 0,
          //       objectKeys: Object.keys(data.conversation)
          //           });

          // Check if get-resumable-conversation API is missing messages
          if (!data.conversation.messages) {
            // console.error('[V16] ❌ CRITICAL: get-resumable-conversation API missing messages!', {
            //   conversationId: data.conversation.id,
            //     createdAt: data.conversation.createdAt,
            //       lastActivity: data.conversation.lastActivityAt,
            //         timespan: 'This is a 6+ week old conversation - should have messages',
            //           apiEndpoint: '/api/v16/get-resumable-conversation',
            //             issue: 'Backend not returning messages with conversation metadata'
            // });
          }

          setResumableConversation(data.conversation);
        } else {
          // console.log('[V16] 📭 RESUME: No resumable conversations found');
          // console.log('[resume] 🔄 setResumableConversation(null) called at', performance.now());
          setResumableConversation(null);
        }
      } catch (error) {
        // Don't log abort errors as they're expected
        if ((error as Error).name !== 'AbortError') {
          // console.error('[V16] ❌ RESUME: Error checking resumable conversations', {
          //   error: (error as Error).message,
          //     userId: stableUser.uid
          // });
          // console.log('[resume] 🔄 setResumableConversation(null) called at', performance.now());
          setResumableConversation(null);
        } else {
          // console.log('[V16] 🚫 RESUME: Request aborted cleanly');
        }
      } finally {
        if (!abortController.signal.aborted) {
          isCheckingRef.current = false;
          // console.log('[resume] 🔄 setIsCheckingResume(false) called at', performance.now());
          setIsCheckingResume(false);
          // console.log('[V16] 🏁 RESUME: Check completed');
        }
      }
    };

    checkResumableConversation();

    // Cleanup function to abort request on unmount or dependency change
    return () => {
      // console.log('[V16] 🧹 RESUME: Aborting previous request');
      abortController.abort();
      isCheckingRef.current = false;
    };
  }, [stableUser?.uid]); // Use stable reference

  // Debug state changes - track resumableConversation
  useEffect(() => {
    // console.log('[V16] 🔍 STATE: resumableConversation changed:', {
    //   value: resumableConversation,
    //     hasValue: !!resumableConversation,
    //       id: resumableConversation?.id,
    //         specialist: resumableConversation?.currentSpecialist,
    //           timestamp: performance.now()
    // });
  }, [resumableConversation]);

  // Debug state changes - track shouldResume
  useEffect(() => {
    // console.log('[V16] 🔍 STATE: shouldResume changed:', {
    //   value: shouldResume,
    //     timestamp: performance.now()
    // });
  }, [shouldResume]);

  // V16: Fetch triage AI prompt on component mount
  useEffect(() => {
    const fetchTriagePrompt = async () => {
      // Add comprehensive triage handoff logging
      const logTriageHandoff = (message: string, ...args: unknown[]) => {
        if (process.env.NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS === 'true') {
          console.log(`[triage_handoff] ${message}`, ...args);
        }
      };

      try {
        // Get user's language preference for the API call
        const languagePreference = getStoredLanguagePreference(!!user);
        const promptApiUrl = `/api/v16/load-prompt?type=triage&userId=${user?.uid || 'anonymous'}&language=${languagePreference}`;
        const greetingApiUrl = `/api/v16/greeting-prompt?type=triage&language=${languagePreference}${user?.uid ? `&userId=${user.uid}` : ''}`;
        
        // Add comprehensive multilingual support logging
        const logMultilingualSupport = (message: string, ...args: unknown[]) => {
          if (process.env.NEXT_PUBLIC_ENABLE_MULTILINGUAL_SUPPORT_LOGS === 'true') {
            console.log(`[multilingual_support] ${message}`, ...args);
          }
        };

        logMultilingualSupport('🚀 PARALLEL LOADING: Starting triage prompt and greeting load in parallel', {
          languagePreference,
          userId: user?.uid || 'anonymous',
          promptApiUrl,
          greetingApiUrl,
          timestamp: new Date().toISOString(),
          source: 'parallel-triage-load-start',
          impact: 'Loading both prompt and greeting simultaneously for better performance'
        });

        logTriageHandoff('Page: Loading triage AI prompt from Supabase', {
          userId: user?.uid || 'anonymous',
          languagePreference,
          endpoint: promptApiUrl,
          source: 'page-fetch-triage-prompt'
        });

        // OPTIMIZED: Load triage prompt and greeting in parallel
        const [promptResponse, greetingResponse] = await Promise.all([
          fetch(promptApiUrl),
          fetch(greetingApiUrl)
        ]);
        
        logMultilingualSupport('📡 PARALLEL API RESPONSES: Received both responses', {
          promptOk: promptResponse.ok,
          promptStatus: promptResponse.status,
          greetingOk: greetingResponse.ok, 
          greetingStatus: greetingResponse.status,
          languagePreference,
          userId: user?.uid || 'anonymous',
          source: 'parallel-api-responses',
          impact: 'Both API calls completed - now processing data'
        });

        // Check prompt response
        if (!promptResponse.ok) {
          const errorText = await promptResponse.text();
          logMultilingualSupport('❌ TRIAGE PROMPT ERROR: API returned error', {
            status: promptResponse.status,
            statusText: promptResponse.statusText,
            errorText,
            languagePreference,
            promptType: 'triage',
            userId: user?.uid || 'anonymous',
            source: 'triage-prompt-api-error',
            impact: 'Will show breaking error - triage prompt unavailable'
          });
          throw new Error(`HTTP ${promptResponse.status}: ${errorText}`);
        }

        // Check greeting response (don't fail completely if greeting fails)
        let greetingError = null;
        if (!greetingResponse.ok) {
          const errorData = await greetingResponse.json().catch(() => ({ error: 'Unknown error' }));
          greetingError = new Error(`Triage greeting API error: ${errorData.error || greetingResponse.status}`);
          logMultilingualSupport('❌ TRIAGE GREETING ERROR: API returned error', {
            status: greetingResponse.status,
            statusText: greetingResponse.statusText,
            errorData,
            languagePreference,
            greetingType: 'triage',
            userId: user?.uid || 'anonymous',
            source: 'triage-greeting-api-error',
            impact: 'Will use fallback English greeting - this causes the multilingual bug'
          });
        }

        // OPTIMIZED: Parse both responses in parallel 
        const responsePromises = [
          promptResponse.json()
        ];
        
        if (!greetingError) {
          responsePromises.push(greetingResponse.json());
        }

        const responses = await Promise.all(responsePromises);
        const promptData = responses[0];
        const greetingData = greetingError ? null : responses[1];

        logMultilingualSupport('📄 PARALLEL DATA PARSING: Processing both API responses', {
          hasPromptData: !!promptData,
          hasGreetingData: !!greetingData,
          promptSuccess: !!promptData?.success,
          greetingSuccess: !!greetingData?.success,
          languagePreference,
          source: 'parallel-data-parsing',
          impact: 'Processing responses from both API calls'
        });

        // Validate prompt data
        if (!promptData.success || !promptData.prompt) {
          logMultilingualSupport('❌ TRIAGE VALIDATION: Invalid triage prompt response format', {
            success: promptData.success,
            hasPrompt: !!promptData.prompt,
            fullResponse: promptData,
            languagePreference,
            source: 'triage-prompt-validation-error',
            impact: 'Will show breaking error - invalid data structure'
          });
          throw new Error('Invalid triage prompt response format');
        }

        // Process greeting data (if available)
        let greetingContent = null;
        if (greetingData && greetingData.success && greetingData.greeting?.content) {
          greetingContent = greetingData.greeting.content;
          logMultilingualSupport('✅ TRIAGE GREETING SUCCESS: Triage greeting loaded successfully', {
            greetingId: greetingData.greeting.id,
            greetingType: greetingData.greeting.type,
            greetingLanguage: greetingData.greeting.language,
            contentLength: greetingData.greeting.content.length,
            contentPreview: greetingData.greeting.content.substring(0, 200) + '...',
            languagePreference,
            userId: user?.uid || 'anonymous',
            source: 'triage-greeting-success',
            impact: 'AI will now greet user in requested language instead of English'
          });
        } else {
          logMultilingualSupport('❌ TRIAGE GREETING FAILED: Will use fallback English greeting', {
            greetingError: greetingError?.message,
            hasGreetingData: !!greetingData,
            greetingSuccess: greetingData?.success,
            hasContent: !!greetingData?.greeting?.content,
            languagePreference,
            userId: user?.uid || 'anonymous',
            source: 'triage-greeting-fallback',
            impact: 'CRITICAL: Will fallback to hardcoded English greeting - this is the multilingual bug'
          });
        }

        // Set both states
        setTriagePrompt(promptData.prompt);
        setTriageGreeting(greetingContent);

        logMultilingualSupport('✅ PARALLEL LOADING SUCCESS: Both triage prompt and greeting processed', {
          promptId: promptData.prompt.id,
          promptType: promptData.prompt.type,
          promptLanguage: promptData.prompt.language_code,
          promptContentLength: promptData.prompt.content.length,
          promptContentPreview: promptData.prompt.content.substring(0, 200) + '...',
          hasGreeting: !!greetingContent,
          greetingLength: greetingContent?.length || 0,
          greetingPreview: greetingContent?.substring(0, 200) + '...' || 'NONE - USING FALLBACK',
          hasVoiceSettings: !!promptData.prompt.voice_settings,
          hasMetadata: !!promptData.prompt.metadata,
          languagePreference,
          userId: user?.uid || 'anonymous',
          source: 'parallel-loading-complete',
          impact: 'AI will use both prompt and greeting in requested language (or fallback for greeting)'
        });

        logTriageHandoff('✅ Page: Triage prompt loaded successfully', {
          promptId: promptData.prompt.id,
          promptType: promptData.prompt.type,
          contentLength: promptData.prompt.content.length,
          contentPreview: promptData.prompt.content.substring(0, 200),
          hasVoiceSettings: !!promptData.prompt.voice_settings,
          hasMetadata: !!promptData.prompt.metadata,
          source: 'page-fetch-success'
        });

        // [triage] Load functions using proper Supabase functions hook
        // console.log('[triage] 📡 FETCH: Loading triage functions using useSupabaseFunctions hook');
        await loadFunctionsForAI('triage');
        // console.log('[triage] ✅ FETCH: Functions loaded via hook with executable implementations');

      } catch (error) {
        // console.error('[V16] ❌ CRITICAL FAILURE: Triage prompt load failed', {
        //   error: (error as Error).message,
        //     userId: user?.uid || 'anonymous',
        //       endpoint: '/api/v16/load-prompt?type=triage'
        // });

        optimizedAudioLogger.error('triage', 'prompt_load_failed', error as Error, {
          userId: user?.uid || 'anonymous',
          errorType: 'triage_prompt_missing'
        });

        // This is a breaking error per V16 spec
        alert(`V16 Triage System Failed!\n\n${(error as Error).message}\n\nThe triage AI prompt could not be loaded from Supabase. This is a configuration error that needs to be fixed by an administrator.`);
      } finally {
        // console.log('[V16] 🏁 FETCH: Triage prompt loading completed');
        setPromptsLoading(false);
      }
    };

    fetchTriagePrompt();
  }, [user?.uid]); // Simple dependency like AI instructions

  // [triage] Register executable functions to FunctionRegistryManager when hook loads them
  useEffect(() => {
    if (Object.keys(functionRegistry).length > 0) {
      // console.log(`[triage] 📝 Registering ${Object.keys(functionRegistry).length} executable functions to FunctionRegistryManager`);

      // Import FunctionRegistryManager and register the executable functions
      import('@/stores/webrtc-store').then(({ FunctionRegistryManager }) => {
        const manager = FunctionRegistryManager.getInstance();
        manager.setRegistry(functionRegistry);
        if (process.env.NEXT_PUBLIC_ENABLE_FUNCTION_EXECUTION_LOGS === 'true') {
          console.log(`[function_execution] ✅ Functions registered to FunctionRegistryManager:`, Object.keys(functionRegistry).length, 'functions');
          console.log(`[function_execution] All registered functions:`, Object.keys(functionRegistry));
        }
      });

      // Also register to Zustand store for state tracking
      registerFunctions({ supabase: triageFunctions || [] });
    }
  }, [functionRegistry, triageFunctions, registerFunctions]);

  // [triage] Handle function loading errors  
  useEffect(() => {
    if (functionsError) {
      // console.error('[triage] ❌ CRITICAL FAILURE: Function loading failed', {
      //   error: functionsError,
      //     userId: user?.uid || 'anonymous'
      // });

      optimizedAudioLogger.error('triage', 'function_load_failed', new Error(functionsError), {
        userId: user?.uid || 'anonymous',
        errorType: 'supabase_function_loading_failure'
      });

      // This is a breaking error per V16 spec
      alert(`V16 Function System Failed!\n\n${functionsError}\n\nThe triage functions could not be loaded from Supabase. This is a configuration error that needs to be fixed by an administrator.`);
    }
  }, [functionsError, user?.uid]);

  // V16: No specialized context detection - triage AI handles everything

  // V16 OPTIMIZATION: Pre-initialize triage services with Supabase functions
  useEffect(() => {
    const hasFunctions = (triageFunctions?.length || 0) > 0;

    if (hasFunctions && !promptsLoading && webRTCConfig) {
      // Log timing analysis for preInitialize call
      if (process.env.NEXT_PUBLIC_ENABLE_MULTILINGUAL_SUPPORT_LOGS === 'true') {
        console.log('[multilingual_support] V16 page: about to call preInitialize', {
          resourceGreeting: resourceGreeting ? 'PRESENT' : 'MISSING',
          resourceGreetingLength: resourceGreeting?.length || 0,
          webRTCConfigGreeting: webRTCConfig.greetingInstructions ? 'PRESENT' : 'MISSING',
          webRTCConfigGreetingLength: webRTCConfig.greetingInstructions?.length || 0,
          webRTCConfigGreetingPreview: webRTCConfig.greetingInstructions?.substring(0, 200) + '...' || 'null',
          resourceContext: resourceLocatorContext?.selectedResource?.title || 'NONE',
          timestamp: new Date().toISOString()
        });
      }

      // Pre-initialize with triage AI configuration
      preInitialize(webRTCConfig)
        .then(() => {
          // console.log('[V16] ✅ OPTIMIZATION: Triage services pre-initialized successfully');
        })
        .catch((error) => {
          // console.error('[V16] ❌ OPTIMIZATION FAILURE: Triage pre-initialization failed', {
          //   error: (error as Error).message,
          //     userId: user?.uid || 'anonymous',
          //       configType: 'triage'
          // });

          optimizedAudioLogger.error('webrtc', 'v16_triage_pre_initialization_failed', error as Error, {
            userId: user?.uid || 'anonymous',
            errorType: 'triage_prompt_missing',
            actionRequired: 'add_triage_prompt'
          });

          alert(`V16 Triage Pre-Initialization Failed!\n\n${error.message}\n\nThis is a configuration error that needs to be fixed by an administrator.`);
        });
    } else if (!webRTCConfig) {
      // console.log('[V16] ⏳ OPTIMIZATION: Waiting for triage configuration before pre-initialization', {
      //   hasPrompt: !!triagePrompt,
      //     hasFunctions: !!triageFunctions,
      //       promptsLoading
      // });
    } else if (!hasFunctions && !promptsLoading && webRTCConfig) {
      // console.error('[V16] ❌ CRITICAL ERROR: V16 requires Supabase functions for pre-initialization', {
      //   triageFunctions: triageFunctions?.length || 0,
      //     hasPrompt: !!triagePrompt,
      //       promptsLoading
      // });
      // Don't throw here as the WebRTC store will handle the error when connection is attempted
    }
  }, [preInitialize, webRTCConfig, user, triageFunctions, promptsLoading, functionsLoading, triagePrompt]);

  // V16: Listen for language changes and reload triage prompt
  useEffect(() => {
    const handleLanguageChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ languageCode: string }>;
      const newLanguageCode = customEvent.detail.languageCode;
      
      // Add comprehensive multilingual support logging (local scope)
      const logMultilingualSupport = (message: string, ...args: unknown[]) => {
        if (process.env.NEXT_PUBLIC_ENABLE_MULTILINGUAL_SUPPORT_LOGS === 'true') {
          console.log(`[multilingual_support] ${message}`, ...args);
        }
      };
      
      // All logs use single consistent prefix for multilingual support debugging
      const logTriageHandoff = (message: string, ...args: unknown[]) => {
        if (process.env.NEXT_PUBLIC_ENABLE_MULTILINGUAL_SUPPORT_LOGS === 'true') {
          console.log(`[multilingual_support] ${message}`, ...args);
        }
      };
      
      logMultilingualSupport('🌐 CRITICAL: Language change detected in V16 page', {
        previousLanguage: 'unknown', // TODO: Store previous language for comparison
        newLanguage: newLanguageCode,
        userId: user?.uid || 'anonymous',
        timestamp: new Date().toISOString(),
        source: 'language-change-listener',
        hasResourceContext: !!resourceLocatorContext?.selectedResource,
        resourceTitle: resourceLocatorContext?.selectedResource?.title || 'none',
        impact: 'Will reload triage prompt and resource greeting'
      });
      
      logTriageHandoff('Language change detected - reloading triage prompt', {
        newLanguage: newLanguageCode,
        userId: user?.uid || 'anonymous',
        source: 'language-change-listener'
      });

      // Reload the triage prompt with new language preference
      const fetchTriagePrompt = async () => {
        try {
          const apiUrl = `/api/v16/load-prompt?type=triage&userId=${user?.uid || 'anonymous'}&language=${newLanguageCode}`;
          
          logMultilingualSupport('🔄 STEP 1: Reloading triage prompt with new language', {
            newLanguage: newLanguageCode,
            apiUrl,
            userId: user?.uid || 'anonymous',
            source: 'triage-prompt-reload'
          });
          
          const response = await fetch(apiUrl);

          logMultilingualSupport('📡 TRIAGE RELOAD API RESPONSE: Received response from triage prompt API', {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            newLanguage: newLanguageCode,
            promptType: 'triage',
            userId: user?.uid || 'anonymous',
            source: 'triage-prompt-reload-api-response',
            impact: response.ok ? 'Triage prompt reload successful' : 'Triage prompt reload failed'
          });

          if (!response.ok) {
            const errorText = await response.text();
            logMultilingualSupport('❌ TRIAGE RELOAD ERROR: API returned error', {
              status: response.status,
              statusText: response.statusText,
              errorText,
              newLanguage: newLanguageCode,
              promptType: 'triage',
              userId: user?.uid || 'anonymous',
              source: 'triage-prompt-reload-api-error',
              impact: 'Will continue using old language triage prompt'
            });
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const data = await response.json();

          logMultilingualSupport('📄 TRIAGE RELOAD DATA: Parsing triage prompt reload response', {
            hasSuccess: !!data.success,
            hasPrompt: !!data.prompt,
            promptId: data.prompt?.id,
            promptType: data.prompt?.type,
            promptLanguage: data.prompt?.language_code,
            contentLength: data.prompt?.content?.length || 0,
            contentPreview: data.prompt?.content?.substring(0, 200) + '...' || 'EMPTY',
            newLanguage: newLanguageCode,
            source: 'triage-prompt-reload-data-parse',
            impact: 'This reloaded content will update AI behavior and language'
          });

          if (!data.success || !data.prompt) {
            logMultilingualSupport('❌ TRIAGE RELOAD VALIDATION: Invalid response format', {
              success: data.success,
              hasPrompt: !!data.prompt,
              fullResponse: data,
              newLanguage: newLanguageCode,
              source: 'triage-prompt-reload-validation-error',
              impact: 'Will continue using old language triage prompt'
            });
            throw new Error('Invalid triage prompt response format');
          }

          setTriagePrompt(data.prompt);
          
          logMultilingualSupport('✅ STEP 1 SUCCESS: Triage prompt reloaded with new language', {
            newLanguage: newLanguageCode,
            promptId: data.prompt.id,
            contentLength: data.prompt.content?.length || 0,
            promptPreview: data.prompt.content?.substring(0, 200) + '...' || 'EMPTY',
            source: 'triage-prompt-reload-success',
            impact: 'AI will now use triage prompt in selected language'
          });

          // CRITICAL: Also reload triage greeting with new language
          logMultilingualSupport('🌐 STEP 1A: Reloading triage greeting with new language', {
            newLanguage: newLanguageCode,
            source: 'triage-greeting-language-change-reload',
            impact: 'This ensures AI greeting also uses new language'
          });

          try {
            const greetingApiUrl = `/api/v16/greeting-prompt?type=triage&language=${newLanguageCode}${user?.uid ? `&userId=${user.uid}` : ''}`;
            const greetingResponse = await fetch(greetingApiUrl);

            logMultilingualSupport('📡 TRIAGE GREETING RELOAD API RESPONSE: Received response', {
              ok: greetingResponse.ok,
              status: greetingResponse.status,
              statusText: greetingResponse.statusText,
              newLanguage: newLanguageCode,
              greetingType: 'triage',
              userId: user?.uid || 'anonymous',
              source: 'triage-greeting-reload-api-response',
              impact: greetingResponse.ok ? 'Triage greeting reload successful' : 'Triage greeting reload failed'
            });

            if (!greetingResponse.ok) {
              const errorData = await greetingResponse.json();
              logMultilingualSupport('❌ TRIAGE GREETING RELOAD ERROR: API returned error', {
                status: greetingResponse.status,
                statusText: greetingResponse.statusText,
                errorData,
                newLanguage: newLanguageCode,
                greetingType: 'triage',
                userId: user?.uid || 'anonymous',
                source: 'triage-greeting-reload-api-error',
                impact: 'Will continue using old language triage greeting'
              });
              throw new Error(`Triage greeting reload API error: ${errorData.error || greetingResponse.status}`);
            }

            const greetingData = await greetingResponse.json();

            logMultilingualSupport('📄 TRIAGE GREETING RELOAD DATA: Parsing response', {
              hasSuccess: !!greetingData.success,
              hasGreeting: !!greetingData.greeting,
              hasContent: !!greetingData.greeting?.content,
              greetingId: greetingData.greeting?.id,
              greetingType: greetingData.greeting?.type,
              greetingLanguage: greetingData.greeting?.language,
              contentLength: greetingData.greeting?.content?.length || 0,
              contentPreview: greetingData.greeting?.content?.substring(0, 200) + '...' || 'EMPTY',
              newLanguage: newLanguageCode,
              source: 'triage-greeting-reload-data-parse',
              impact: 'This reloaded greeting content will be sent to AI in new language'
            });

            if (!greetingData.success || !greetingData.greeting?.content) {
              logMultilingualSupport('❌ TRIAGE GREETING RELOAD VALIDATION: Invalid response format', {
                success: greetingData.success,
                hasGreeting: !!greetingData.greeting,
                hasContent: !!greetingData.greeting?.content,
                fullResponse: greetingData,
                newLanguage: newLanguageCode,
                source: 'triage-greeting-reload-validation-error',
                impact: 'Will continue using old language triage greeting'
              });
              throw new Error('Invalid triage greeting reload response format');
            }

            setTriageGreeting(greetingData.greeting.content);

            logMultilingualSupport('✅ STEP 1A SUCCESS: Triage greeting reloaded with new language', {
              greetingId: greetingData.greeting.id,
              greetingType: greetingData.greeting.type,
              greetingLanguage: greetingData.greeting.language,
              contentLength: greetingData.greeting.content.length,
              contentPreview: greetingData.greeting.content.substring(0, 200) + '...',
              newLanguage: newLanguageCode,
              userId: user?.uid || 'anonymous',
              source: 'triage-greeting-reload-success',
              impact: 'AI will now greet user in new language instead of old language'
            });
          } catch (error) {
            logMultilingualSupport('❌ STEP 1A FAILED: Triage greeting reload failed', {
              error: (error as Error).message,
              newLanguage: newLanguageCode,
              userId: user?.uid || 'anonymous',
              source: 'triage-greeting-reload-error',
              impact: 'CRITICAL: Will continue using old language greeting - partial multilingual fix'
            });

            console.error('Failed to reload triage greeting after language change:', error);
            // Don't fail the whole language change process if greeting fails
            // Just log the error and continue - the prompt change is more critical
          }
          
          logTriageHandoff('Successfully reloaded triage prompt with new language', {
            newLanguage: newLanguageCode,
            promptId: data.prompt.id,
            contentLength: data.prompt.content?.length || 0,
            source: 'language-change-reload'
          });
        } catch (error) {
          logMultilingualSupport('❌ STEP 1 FAILED: Triage prompt reload failed', {
            newLanguage: newLanguageCode,
            error: (error as Error).message,
            apiUrl: `/api/v16/load-prompt?type=triage&userId=${user?.uid || 'anonymous'}&language=${newLanguageCode}`,
            source: 'triage-prompt-reload-error',
            impact: 'AI will continue using old language for triage prompt'
          });
          
          console.error('Failed to reload triage prompt after language change:', error);
          logTriageHandoff('Failed to reload triage prompt after language change', {
            error: (error as Error).message,
            newLanguage: newLanguageCode,
            source: 'language-change-error'
          });
        }
      };
      
      // Also regenerate resource greeting if a resource is selected
      const regenerateResourceGreeting = async () => {
        if (resourceLocatorContext && resourceLocatorContext.selectedResource) {
          logMultilingualSupport('🔄 STEP 2: Regenerating resource greeting with new language', {
            newLanguage: newLanguageCode,
            resourceTitle: resourceLocatorContext.selectedResource.title,
            resourceId: resourceLocatorContext.selectedResource.id,
            resourceCategory: resourceLocatorContext.selectedResource.category,
            source: 'resource-greeting-regenerate'
          });
          
          logTriageHandoff('Language change detected - regenerating resource greeting', {
            newLanguage: newLanguageCode,
            resourceTitle: resourceLocatorContext.selectedResource.title,
            resourceId: resourceLocatorContext.selectedResource.id,
            source: 'language-change-resource-greeting'
          });
          
          try {
            const userId = user?.uid || 'anonymous';
            const newResourceGreeting = await getResourceWelcomeContent(resourceLocatorContext.selectedResource, userId);
            
            setResourceGreeting(newResourceGreeting);
            
            logMultilingualSupport('✅ STEP 2 SUCCESS: Resource greeting regenerated with new language', {
              newLanguage: newLanguageCode,
              resourceTitle: resourceLocatorContext.selectedResource.title,
              resourceId: resourceLocatorContext.selectedResource.id,
              greetingLength: newResourceGreeting.length,
              greetingPreview: newResourceGreeting.substring(0, 200) + '...',
              source: 'resource-greeting-regenerate-success',
              impact: 'AI will now greet user in selected language for this resource'
            });
            
            logTriageHandoff('Successfully regenerated resource greeting with new language', {
              newLanguage: newLanguageCode,
              resourceTitle: resourceLocatorContext.selectedResource.title,
              greetingLength: newResourceGreeting.length,
              greetingPreview: newResourceGreeting.substring(0, 200) + '...',
              source: 'language-change-resource-success'
            });
          } catch (error) {
            logMultilingualSupport('❌ STEP 2 FAILED: Resource greeting regeneration failed', {
              newLanguage: newLanguageCode,
              resourceTitle: resourceLocatorContext.selectedResource.title,
              resourceId: resourceLocatorContext.selectedResource.id,
              error: (error as Error).message,
              source: 'resource-greeting-regenerate-error',
              impact: 'AI will continue using old language for resource greeting'
            });
            
            console.error('Failed to regenerate resource greeting after language change:', error);
            logTriageHandoff('Failed to regenerate resource greeting after language change', {
              error: (error as Error).message,
              newLanguage: newLanguageCode,
              resourceTitle: resourceLocatorContext.selectedResource.title,
              source: 'language-change-resource-error'
            });
          }
        } else {
          logMultilingualSupport('⚠️ STEP 2 SKIPPED: No resource context for greeting regeneration', {
            newLanguage: newLanguageCode,
            hasResourceContext: !!resourceLocatorContext,
            hasSelectedResource: !!resourceLocatorContext?.selectedResource,
            source: 'resource-greeting-skip',
            impact: 'Only triage prompt will be updated, no resource greeting to update'
          });
        }
      };

      fetchTriagePrompt();
      regenerateResourceGreeting();
    };

    window.addEventListener('languageChanged', handleLanguageChange);
    
    return () => {
      window.removeEventListener('languageChanged', handleLanguageChange);
    };
  }, [user?.uid, resourceLocatorContext, setResourceGreeting]);

  // V16: No auto-start - user always clicks "Let's Talk" to begin with triage AI

  // Show loading while auth, triage prompt, or functions are loading
  if (authLoading || promptsLoading || functionsLoading) {
    // console.log('[V16] ⏳ LOADING: Displaying loading screen', {
    //   authLoading,
    //     promptsLoading,
    //     functionsLoading,
    //     hasTriagePrompt: !!triagePrompt,
    //       hasFunctions: (triageFunctions?.length || 0) > 0
    // });

    return (
      <div className="flex items-center justify-center min-h-screen bg-sage-200 dark:bg-[#131314] text-sage-500 dark:text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-500 dark:border-white mx-auto mb-4"></div>
          <p>
            {authLoading ? 'Loading...' :
              promptsLoading ? 'Loading triage AI...' :
                'Initializing triage system...'}
          </p>
        </div>
      </div>
    );
  }

  // console.log('[V16] 🎯 READY: Rendering main triage interface', {
  // hasTriagePrompt: !!triagePrompt,
  //   promptType: triagePrompt?.type,
  //     userMode: user ? 'authenticated' : 'anonymous',
  //       currentSpecialist: 'triage'
  //   });

  // V15 Anonymous support: Always proceed to main interface
  // Authentication is optional - users can use V15 without signing in
  // Login will be available in the header component if needed

  // console.log('[resume] 📤 PARENT RENDER - Passing props to ChatBotV16Component:', {
  // timestamp: performance.now(),
  //   hasUser: !!stableUser,
  //     hasTriagePrompt: !!triagePrompt,
  //       hasResumableConversation: !!stableResumableConversation,
  //         hasOnLetsTalk: !!handleLetsTalk,
  //           onLetsTalkType: typeof handleLetsTalk,
  //             onLetsTalkRef: handleLetsTalk,
  //               setShouldResumeRef: setShouldResume,
  //                 loadFunctionsForAIRef: loadFunctionsForAI,
  //                   shouldResume,
  //                   isCheckingResume,
  //                   historyResumeId,
  //                   stableUserRef: stableUser,
  //                     stableResumableConversationRef: stableResumableConversation
  //   });

  return (
    <div className="chatbot-v16-wrapper">
      <ChatBotV16Component
        user={stableUser}
        triagePrompt={triagePrompt}
        resumableConversation={stableResumableConversation}
        onLetsTalk={handleLetsTalkClick}
        shouldResume={shouldResume}
        setShouldResume={setShouldResume}
        isCheckingResume={isCheckingResume}
        loadFunctionsForAI={loadFunctionsForAI}
      />

      {/* Sign In Dialog for non-authenticated users */}
      <SignInDialog
        isOpen={isSignInDialogOpen}
        onClose={() => setIsSignInDialogOpen(false)}
        onSignedIn={() => {
          setIsSignInDialogOpen(false);
          // After signing in, proceed with Let's Talk
          handleLetsTalk();
        }}
        onContinueWithoutSignIn={() => {
          setIsSignInDialogOpen(false);
          // Continue with chat as anonymous user
          handleLetsTalk();
        }}
      />
    </div>
  );
}