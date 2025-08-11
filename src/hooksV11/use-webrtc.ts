// src/hooksV11/use-webrtc.ts
/* eslint-disable */
// @ts-nocheck
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import audioLogger from './audio-logger';
import audioCutoffDiagnostics from './audio-cutoff-diagnostics';
import audioService from './audio-service';
import { useAudioService } from './use-audio-service';

// Define types for conversation items
export interface Conversation {
  id: string; // Unique ID for React rendering and tracking
  role: string; // "user" or "assistant"
  text: string; // User or assistant message
  timestamp: string; // ISO string for message time
  isFinal: boolean; // Whether the transcription is final
  status?: "speaking" | "processing" | "final" | "thinking"; // Status for real-time conversation states
}

// Define types for tool/function definitions
export interface GPTFunction {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

// Define WebRTC session configuration
export interface SessionConfig {
  instructions: string;
  voice: string;
  tools?: GPTFunction[];
  tool_choice?: 'auto' | 'required' | null;
  temperature?: number;
  bookId?: string;   // Selected book ID (UUID format)
  userId?: string;   // User ID for tracking conversations
  greetingInstructions?: string; // Custom instructions for initial greeting
}

// Return type for the hook
interface UseWebRTCReturn {
  status: string;
  isSessionActive: boolean;
  errorMessage: string | null;
  conversation: Conversation[];
  registerFunction: (name: string, fn: Function) => void;
  startSession: (config: SessionConfig) => Promise<void>;
  stopSession: () => void;
  handleStartStopClick: () => void;
  sendTextMessage: (text: string) => void;
  isMuted: boolean;
  toggleMute: () => void;
  currentVolume: number;
  diagnosticData: any;
}

/**
 * Hook to manage a real-time session with OpenAI's Realtime endpoints.
 */
// Ensure TypeScript knows about our global variables
declare global {
  interface Window {
    __lastQuestionId?: number | null;
    __messageTypeCounts?: Record<string, number>;
    __lastMessageType?: string;
    __aiDeltaTypeCounts?: {
      string: number;
      function: number;
      other: number;
    };
    __deltaTypeCounts?: {
      string: number;
      function: number;
      other: number;
    };
    __responseQueue?: {
      queue: Array<{
        id: string;
        payload: any;
        source: string;
        timestamp: number;
      }>;
      isProcessing: boolean;
      activeResponseId: string | null;
    };
    __responseTimeoutId?: number;
    __transcriptTimeoutId?: number;
  }
}

// Configuration constants for timing and behavior
const MESSAGE_SEQUENCE_DELAY_MS = 1000; // Delay between consecutive messages to AI to prevent race conditions

// State tracking to prevent improper function sequences
let lastFunctionCall = null;
let lastMessageWasFromUser = false;

// Function to validate function calls and prevent improper sequences
function validateFunctionCall(fnName: string) {
  // Block fetch_next_question after query_book_content without user message
  if (fnName === 'fetch_next_question' && lastFunctionCall === 'query_book_content' && !lastMessageWasFromUser) {
    console.error(`[FUNCTION-VALIDATION] BLOCKING improper fetch_next_question call after query_book_content without user input`);
    return false;
  }

  // Record this function call
  lastFunctionCall = fnName;
  return true;
}

// Utility functions to track message flow
function onUserMessageReceived() {
  lastMessageWasFromUser = true;
  console.log(`[MESSAGE-FLOW] User message received, marking conversation state`);
}

function onAIResponseComplete() {
  lastMessageWasFromUser = false;
  console.log(`[MESSAGE-FLOW] AI response complete, now waiting for user input`);
}

export function useWebRTC(): UseWebRTCReturn {
  // Get access to the audio service
  const {
    queueAudioData,
    handleStopSignal,
    clearAudioQueue,
    startNewMessage,
    audioState
  } = useAudioService();

  // Response queue system to prevent "conversation_already_has_active_response" errors
  // This is a global singleton outside of React state to ensure it persists
  if (typeof window !== 'undefined' && !window.__responseQueue) {
    window.__responseQueue = {
      queue: [],
      isProcessing: false,
      activeResponseId: null,
      activeResponseStartTime: null,
      lastFunctionResponseTime: null
    };
  }


  // Global function call tracking to prevent duplicate calls
  if (typeof window !== 'undefined' && !window.__functionCallTracker) {
    window.__functionCallTracker = {
      recentCalls: {},  // Map of function names to arrays of timestamps
      isProcessingFunction: false,
      currentFunctionName: null,

      // Check if a function was recently called (within timeThreshold ms)
      wasRecentlyCalled: function (name, timeThreshold = 10000) {
        const calls = this.recentCalls[name] || [];
        const now = Date.now();

        // Filter to only keep calls within the threshold
        const recentCalls = calls.filter(time => (now - time) < timeThreshold);

        // Update the calls list (removing older calls outside threshold)
        this.recentCalls[name] = recentCalls;

        // If there are any recent calls (or we're currently processing this function), return true
        return recentCalls.length > 0 || (this.isProcessingFunction && this.currentFunctionName === name);
      },

      // Record a function call
      recordCall: function (name) {
        if (!this.recentCalls[name]) {
          this.recentCalls[name] = [];
        }
        this.recentCalls[name].push(Date.now());
        this.isProcessingFunction = true;
        this.currentFunctionName = name;

        // Cleanup old calls (older than 30 seconds)
        for (const funcName in this.recentCalls) {
          const now = Date.now();
          this.recentCalls[funcName] = this.recentCalls[funcName].filter(
            time => (now - time) < 30000
          );
        }
      },

      // Mark function processing as complete
      completeCall: function (name) {
        if (this.currentFunctionName === name) {
          this.isProcessingFunction = false;
          this.currentFunctionName = null;
        }
      }
    };
  }

  // Use a dedicated variable for the queue processing function
  let _processQueueFn = null;

  /**
   * Asynchronously save a message to Supabase without blocking the UI
   */
  const saveMessageToSupabase = useCallback(async (message: Conversation) => {
    try {
      const msgId = Date.now().toString().slice(-6);
      const logPrefix = `[SAVE-MSG-${msgId}]`;

      const userId = localStorage.getItem('userId');
      const bookId = localStorage.getItem('selectedBookId');
      
      // FIXED: Prioritize conversation ID from sessionStorage, fall back to localStorage
      const conversationId = sessionStorage.getItem('current_conversation_id') || localStorage.getItem('conversationId');

      console.log(`${logPrefix} Preparing to save ${message.role} message`);
      console.log(`${logPrefix} Using provided conversation ID: ${conversationId || 'not found'}`);
      
      if (sessionStorage.getItem('current_conversation_id')) {
        console.log(`${logPrefix} Using conversation ID from sessionStorage: ${sessionStorage.getItem('current_conversation_id')}`);
      } else if (localStorage.getItem('conversationId')) {
        console.log(`${logPrefix} Using conversation ID from localStorage: ${localStorage.getItem('conversationId')}`);
      }

      if (!userId || !bookId) {
        console.log(`${logPrefix} Missing userId or bookId, skipping save`);
        return;
      }

      // Fire-and-forget fetch call without awaiting
      fetch('/api/v11/save-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          bookId,
          message,
          conversationId
        })
      }).then(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Failed to save message');
      }).then(data => {
        // Always check for and update conversationId from the response
        // This ensures we're always using the most recent conversation ID
        if (data.conversationId) {
          const prevConversationId = localStorage.getItem('conversationId');
          const sessionConversationId = sessionStorage.getItem('current_conversation_id');

          // Update both storage locations to ensure consistency
          if (sessionConversationId !== data.conversationId) {
            console.log(`${logPrefix} Updating conversation ID in sessionStorage: ${sessionConversationId || 'none'} → ${data.conversationId}`);
            sessionStorage.setItem('current_conversation_id', data.conversationId);
          }
          
          if (prevConversationId !== data.conversationId) {
            console.log(`${logPrefix} Updating conversation ID in localStorage: ${prevConversationId || 'none'} → ${data.conversationId}`);
            localStorage.setItem('conversationId', data.conversationId);
          } else {
            console.log(`${logPrefix} Using existing conversation ID: ${data.conversationId}`);
          }
        }
      }).catch(err => {
        console.error(`${logPrefix} Background save failed:`, err);
      });
    } catch (err) {
      console.error('[saveMessageToSupabase] Error preparing message save:', err);
    }
  }, []);
  // Connection/session states
  const [status, setStatus] = useState("");
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // Reference to store the current session config
  const sessionConfigRef = useRef<SessionConfig | null>(null);

  // Audio references for local mic
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // WebRTC references
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  // Keep raw messages for diagnostic purposes
  const [rawMessages, setRawMessages] = useState<any[]>([]);

  // Main conversation state
  const [conversation, setConversation] = useState<Conversation[]>([]);

  // For function calls (AI "tools")
  const functionRegistry = useRef<Record<string, Function>>({});

  // Volume analysis (assistant inbound audio)
  const [currentVolume, setCurrentVolume] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const volumeIntervalRef = useRef<number | null>(null);

  // Track if we've initialized the session
  const hasSetupSessionRef = useRef<boolean>(false);

  // Diagnostic data - initialize with default values to avoid Unix epoch timestamps
  const [diagnosticData, setDiagnosticData] = useState<any>({
    thinkingStartTime: Date.now(),  // Initialize with current time
    thinkingStateTransitions: 0,
    thinkingSource: "initialization",
    isThinking: false
  });

  /**
   * We track message processing and thinking state with these refs
   * - ephemeralUserMessageIdRef: ID of the temporary user message being updated
   * - isThinkingRef: Whether the AI is in a "thinking" state (includes processing, function calls, etc.)
   */
  const ephemeralUserMessageIdRef = useRef<string | null>(null);
  const isThinkingRef = useRef<boolean>(false);

  // WebAI suggestion #6 - Track user interactions that might affect audio playback
  useEffect(() => {
    const handleInteraction = () => {
      userInteractedRef.current = true;
      console.log('[USER-INTERACTION] User interaction detected that might impact audio playback');

      // If user is navigating away during audio playback, log extra details
      if (isPlayingRef.current || audioQueueRef.current.length > 0) {
        console.warn('[USER-INTERACTION] User interaction during active audio playback!', {
          isPlaying: isPlayingRef.current,
          queueLength: audioQueueRef.current.length,
          pendingChunks: pendingChunksRef.current.size,
          receivedStopSignal: receivedStopSignalRef.current
        });

        // Optional: Handle this case by possibly modifying stopSession's behavior 
        // if userInteractedRef.current is true
      }
    };

    // Events that might indicate user navigating away or changing context
    window.addEventListener('beforeunload', handleInteraction);
    window.addEventListener('visibilitychange', handleInteraction);

    return () => {
      window.removeEventListener('beforeunload', handleInteraction);
      window.removeEventListener('visibilitychange', handleInteraction);
    };
  }, []);

  /**
   * Register a function (tool) so the AI can call it.
   */
  const registerFunction = useCallback((name: string, fn: Function) => {
    functionRegistry.current[name] = fn;
    console.log(`Registered function: ${name}`);
  }, []);

  /**
   * Helper function to get the current response text from the conversation
   * This avoids using the non-existent state variable that was causing the error
   */
  const getCurrentResponseText = useCallback(() => {
    // Try to get text from the last assistant message in the conversation
    const currentAssistantMessage = conversation.find(msg =>
      msg.role === 'assistant' && msg.text && msg.status !== 'thinking'
    );

    // Fall back to the global tracking variable if needed
    return currentAssistantMessage?.text || window.__currentResponseText || '';
  }, [conversation]);

  /**
   * Log device information for debugging
   * WebAI suggestion #7 - Implement logging for debugging on different devices
   */
  const logDeviceInfo = useCallback(() => {
    // Log browser/device info
    console.log(`[DEVICE-INFO] User agent: ${navigator.userAgent}`);
    console.log(`[DEVICE-INFO] Hardware concurrency: ${navigator.hardwareConcurrency || 'Not available'}`);
    console.log(`[DEVICE-INFO] Device memory: ${(navigator as any).deviceMemory || 'Not available'} GB`);

    // Log audio context info if available
    if (audioContextForPlaybackRef.current) {
      const audioContext = audioContextForPlaybackRef.current;
      console.log(`[DEVICE-INFO] Sample rate: ${audioContext.sampleRate}`);
      console.log(`[DEVICE-INFO] Base latency: ${audioContext.baseLatency || 'Not available'}`);
      console.log(`[DEVICE-INFO] Output latency: ${(audioContext as any).outputLatency || 'Not available'}`);
      console.log(`[DEVICE-INFO] State: ${audioContext.state}`);
    }

    // Log performance metrics if available
    if (devicePerformanceMetricsRef.current) {
      console.log(`[DEVICE-INFO] Detected as slow device: ${devicePerformanceMetricsRef.current.isSlowDevice}`);
      console.log(`[DEVICE-INFO] Average playback time: ${devicePerformanceMetricsRef.current.averagePlaybackTime.toFixed(2)}ms`);
      console.log(`[DEVICE-INFO] Playback count: ${devicePerformanceMetricsRef.current.playbackCount}`);
    }
  }, []);


  /**
   * Process the response queue
   * This function will send one response.create at a time and wait for it to complete
   * before sending the next one
   */
  const processResponseQueue = useCallback(() => {
    if (typeof window === 'undefined' || !window.__responseQueue) return;

    const { queue, isProcessing, activeResponseId } = window.__responseQueue;
    const logPrefix = `[QUEUE-PROCESS-${Date.now().toString().slice(-6)}]`;

    // Already processing or no data channel
    if (isProcessing || !dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      return;
    }

    // No items in queue
    if (queue.length === 0) {
      console.log(`${logPrefix} Queue empty, nothing to process`);
      window.__responseQueue.isProcessing = false;
      return;
    }

    // Check if there's already an active response
    if (activeResponseId) {
      // We have an active response - wait for it to complete
      console.log(`${logPrefix} Response ${activeResponseId.slice(0, 6)} still active, waiting...`);
      window.__responseQueue.isProcessing = true;
      return;
    }

    // Process next item
    const item = queue.shift();
    if (!item) {
      window.__responseQueue.isProcessing = false;
      return;
    }

    // Check for consecutive function results (potential race condition)
    // If we've just finished a fetch_next_question and are about to send another response.create
    // add a forced delay to make sure the AI has time to process the function result
    if (item.source === 'function-fetch_next_question-instructions' &&
      Date.now() - (window.__responseQueue.lastFunctionResponseTime || 0) < 3000) {
      console.log(`${logPrefix} Delaying ${item.id.slice(0, 6)} to prevent race condition after function call`);

      // Push back to the front of the queue and delay processing
      queue.unshift(item);
      setTimeout(() => {
        if (_processQueueFn) _processQueueFn();
      }, 2000);
      return;
    }

    // Mark as processing
    window.__responseQueue.isProcessing = true;
    window.__responseQueue.activeResponseId = item.id;

    // Track the special case of function result delivery
    if (item.source && item.source.startsWith('function-') && item.source.includes('-instructions')) {
      window.__responseQueue.lastFunctionResponseTime = Date.now();
    }

    console.log(`${logPrefix} Processing response ${item.id.slice(0, 6)} from ${item.source}`);
    console.log(`${logPrefix} Sending payload:`, JSON.stringify(item.payload));

    try {
      // Send payload
      dataChannelRef.current.send(JSON.stringify(item.payload));

      // Store active response timestamp
      window.__responseQueue.activeResponseStartTime = Date.now();

      // Setup timeout to clear stuck responses after 30 seconds
      const timeoutId = window.setTimeout(() => {
        if (window.__responseQueue?.activeResponseId === item.id) {
          console.warn(`${logPrefix} Response ${item.id.slice(0, 6)} timed out after 30 seconds`);
          window.__responseQueue.activeResponseId = null;
          window.__responseQueue.isProcessing = false;
          // Try to process next item
          if (_processQueueFn) _processQueueFn();
        }
      }, 30000);

      // Listen for response completion with automatic cleanup
      const handleResponseDone = (event: MessageEvent<any>) => {
        try {
          const data = JSON.parse(event.data);

          // The message events we look for to indicate completion
          if (data.type === 'response.done' || data.type === 'error') {
            // Only clear if it's our response ID
            if (window.__responseQueue?.activeResponseId === item.id) {
              const completionTime = Date.now() - (window.__responseQueue.activeResponseStartTime || 0);
              console.log(`${logPrefix} Response ${item.id.slice(0, 6)} completed with ${data.type} in ${completionTime}ms`);

              // Important: clear active response BEFORE scheduling next item
              window.__responseQueue.activeResponseId = null;
              window.__responseQueue.isProcessing = false;
              window.clearTimeout(timeoutId);

              // Remove this listener
              dataChannelRef.current?.removeEventListener('message', handleResponseDone);

              // Special handling for function calls - add more delay after function calls
              // to ensure the AI has time to process the response
              const delayTime = item.source && item.source.includes('function-') ? 1500 : 500;

              // Process next item after a delay
              setTimeout(() => {
                if (_processQueueFn) _processQueueFn();
              }, delayTime);

              // Important: adding cleanup guard in case the listener isn't removed properly
              // due to event loop timing issues
              setTimeout(() => {
                if (window.__responseQueue?.activeResponseId === item.id) {
                  console.warn(`${logPrefix} Response ${item.id.slice(0, 6)} listener cleanup triggered - emergency reset`);
                  window.__responseQueue.activeResponseId = null;
                  window.__responseQueue.isProcessing = false;
                }

                // Also mark any function as complete if we originated from a function call
                if (typeof window !== 'undefined' && window.__functionCallTracker &&
                  item.source && item.source.includes('function-')) {
                  const funcName = item.source.split('-')[1]; // Extract function name from source
                  if (funcName) {
                    console.log(`[FUNCTION-CLEANUP] Marking function ${funcName} as complete`);
                    window.__functionCallTracker.completeCall(funcName);
                  }
                }
              }, delayTime + 500);
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      };

      // Add listener
      dataChannelRef.current.addEventListener('message', handleResponseDone);
    } catch (error) {
      console.error(`${logPrefix} Error sending response:`, error);
      window.__responseQueue.activeResponseId = null;
      window.__responseQueue.isProcessing = false;
      // Try next item
      if (_processQueueFn) _processQueueFn();
    }
  }, []);

  // Store the reference to processResponseQueue
  _processQueueFn = processResponseQueue;

  /**
   * Queue a response.create message to prevent conflicts
   * This ensures only one response is active at a time
   */
  const queueResponseCreate = useCallback((payload: any, source: string) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      console.error(`[QUEUE-ERROR] Cannot queue response: data channel not open`);
      return;
    }

    const responseId = uuidv4();
    const timestamp = Date.now();
    const logPrefix = `[RESPONSE-QUEUE-${timestamp.toString().slice(-6)}]`;

    // Add to queue
    if (typeof window !== 'undefined' && window.__responseQueue) {
      window.__responseQueue.queue.push({
        id: responseId,
        payload,
        source,
        timestamp
      });

      console.log(`${logPrefix} Added response to queue from ${source}, queue length: ${window.__responseQueue.queue.length}`);

      // Process queue if not already processing
      if (!window.__responseQueue.isProcessing) {
        console.log(`${logPrefix} Starting queue processing`);
        if (_processQueueFn) _processQueueFn();
      } else {
        console.log(`${logPrefix} Queue is already being processed, request queued`);
      }
    }
  }, []);

  /**
   * Configure the data channel on open, sending a session update to the server.
   */
  const configureDataChannel = useCallback((dataChannel: RTCDataChannel, config: SessionConfig) => {
    // Don't re-initialize if already done
    if (hasSetupSessionRef.current) {
      console.log("Session already initialized, skipping");
      return;
    }

    // Build tools array from config or use empty array
    const tools = config.tools || [];

    // Send session update - using the exact same format as demo_webrtc
    const sessionUpdate = {
      type: "session.update",
      session: {
        instructions: config.instructions,
        voice: config.voice,
        tools: tools,
        tool_choice: config.tool_choice || 'auto',
        temperature: config.temperature || 1.0,
        input_audio_transcription: {
          model: "whisper-1",
        },
        turn_detection: {
          type: "server_vad",
          silence_duration_ms: 1000  // Wait 1 second of silence before completing speech
        }
      },
    };

    dataChannel.send(JSON.stringify(sessionUpdate));
    console.log("Session configuration sent:", sessionUpdate);

    // Mark session as initialized
    hasSetupSessionRef.current = true;

    // Send greeting by using the response.create approach
    console.log("Session initialized. Sending AI greeting...");
    setStatus('Preparing AI greeting...');

    // Delay to ensure session update is processed
    setTimeout(async () => {
      try {
        // Check if we're in quest mode based on greeting instructions
        const isQuestMode = config.greetingInstructions?.includes('QUEST CONTEXT');
        
        // Use the greeting instructions passed from the page component, or fall back to default
        const defaultGreetingInstructions = `Ask a general, warm, friendly, and open ended greeting question such as "What's on your mind?" or "How can I help you?" or any similar variation. Be brief and to the point.`;
        let greetingInstructions = config.greetingInstructions || defaultGreetingInstructions;
        console.log("Using greeting instructions:", greetingInstructions.substring(0, 30) + "...");
        
        if (isQuestMode) {
          // Using the modern direct response.create approach for quest mode
          // This avoids the empty message issue causing phantom "Thank you" detection
          console.log("Quest mode detected - using direct response.create approach to prevent phantom transcription");
          
          const response = {
            type: "response.create",
            response: {
              modalities: ["text", "audio"],
              instructions: greetingInstructions,
              max_output_tokens: 2000
            }
          };
          
          console.log("Sending direct response.create for quest greeting");
          dataChannel.send(JSON.stringify(response));
          
        } else {
          // Regular mode - use traditional approach with empty message first
          const message = {
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: " ", // Use a space instead of empty string
                },
              ],
            },
          };
  
          console.log("Sending initial message for greeting:", JSON.stringify(message));
          dataChannel.send(JSON.stringify(message));
          
          // Then queue response.create for regular mode
          const response = {
            type: "response.create",
            response: {
              modalities: ["text", "audio"],
              instructions: greetingInstructions,
              max_output_tokens: 2000
            }
          };
  
          console.log("Queueing response.create for greeting");
          // Use queue system to ensure only one response at a time
          queueResponseCreate(response, "initial-greeting");
        }
        console.log("AI greeting triggered");

        // Update status to Ready after greeting is sent
        setStatus('Ready');
      } catch (error) {
        console.error("Error sending AI greeting:", error);
        setStatus('Error sending greeting');
      }
    }, MESSAGE_SEQUENCE_DELAY_MS); // Using centralized delay constant
  }, []);

  /**
   * Return an ephemeral user ID, creating a new ephemeral message in conversation if needed.
   */
  const getOrCreateEphemeralUserId = useCallback((): string => {
    let ephemeralId = ephemeralUserMessageIdRef.current;
    if (!ephemeralId) {
      // Use uuidv4 for a robust unique ID
      ephemeralId = uuidv4();
      ephemeralUserMessageIdRef.current = ephemeralId;

      // Mark that AI is now thinking
      isThinkingRef.current = true;

      // Always update thinking timestamp when we set isThinkingRef to true
      setDiagnosticData((prev: Record<string, any>) => ({
        ...prev,
        isThinking: true,
        thinkingStartTime: Date.now(),
        thinkingSource: "ephemeral_message_creation",
        thinkingStateTransitions: (prev.thinkingStateTransitions || 0) + 1
      }));

      const newMessage: Conversation = {
        id: ephemeralId,
        role: "user",
        text: "",
        timestamp: new Date().toISOString(),
        isFinal: false,
        status: "speaking",
      };

      // Append the ephemeral item to conversation
      setConversation((prev: Conversation[]) => [...prev, newMessage]);
    }
    return ephemeralId;
  }, []);

  /**
   * Update the ephemeral user message (by ephemeralUserMessageIdRef) with partial changes.
   * Following the web AI's recommendations, we've completely redesigned this function
   * to handle different data types properly.
   */
  const updateEphemeralUserMessage = useCallback((partial: Partial<Conversation>) => {
    const ephemeralId = ephemeralUserMessageIdRef.current;
    if (!ephemeralId) {
      console.log('[updateEphemeralUserMessage] No ephemeral message ID available, skipping update');
      return;
    }

    // Create a safe copy of the partial update
    const safePartial: Partial<Conversation> = { ...partial };

    // Special handling for text field to ensure it's always a string
    if (partial.text !== undefined) {
      if (typeof partial.text === 'function') {
        // Log and handle function text (completely replace functional updates)
        console.error('[updateEphemeralUserMessage] Attempted to set text to a function, converting to string');

        try {
          // Try to extract function name for better logging
          const textAsFunction = partial.text as Function;
          const fnName = textAsFunction.name || 'anonymous';
          safePartial.text = `[Function: ${fnName}]`;
        } catch (e) {
          safePartial.text = '[Function]';
        }
      } else if (partial.text === null || partial.text === undefined) {
        // Handle null/undefined
        console.warn('[updateEphemeralUserMessage] Attempted to set text to null/undefined, using empty string');
        safePartial.text = '';
      } else if (typeof partial.text !== 'string') {
        // Handle any other non-string type
        console.warn(`[updateEphemeralUserMessage] Attempted to set text to ${typeof partial.text}, converting to string`);
        try {
          safePartial.text = String(partial.text);
        } catch (e) {
          safePartial.text = `[${typeof partial.text}]`;
        }
      }
      // String type passes through unchanged
    }

    // Apply the update with the sanitized partial object
    setConversation((prev: Conversation[]) => {
      // For debugging
      const targetMsg = prev.find(msg => msg.id === ephemeralId);
      const currentTextPreview = targetMsg
        ? (typeof targetMsg.text === 'string'
          ? (targetMsg.text.length > 20 ? targetMsg.text.substring(0, 20) + '...' : targetMsg.text)
          : `[${typeof targetMsg.text}]`)
        : 'not found';

      const newTextPreview = safePartial.text
        ? (typeof safePartial.text === 'string'
          ? (safePartial.text.length > 20 ? safePartial.text.substring(0, 20) + '...' : safePartial.text)
          : `[${typeof safePartial.text}]`)
        : 'unchanged';

      console.log(`[updateEphemeralUserMessage] Updating message ID ${ephemeralId}: "${currentTextPreview}" → "${newTextPreview}"`);

      // Create updated conversation
      return prev.map((msg) => {
        if (msg.id === ephemeralId) {
          return { ...msg, ...safePartial };
        }
        return msg;
      });
    });
  }, []);

  /**
   * Clear ephemeral user message ID so the next user speech starts fresh.
   * Note: We no longer clear this after transcription is complete - we'll keep the "Thinking..."
   * state active until the AI begins responding.
   */
  const clearEphemeralUserMessage = useCallback(() => {
    // Only clear the ephemeral message ID, but keep the thinking state active
    ephemeralUserMessageIdRef.current = null;
    // We don't clear isThinkingRef.current here - it stays true until the AI responds
  }, []);

  // Audio buffer queue and playback state
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextForPlaybackRef = useRef<AudioContext | null>(null);
  // New refs for enhanced audio tracking (WebAI suggestion #1)
  const pendingChunksRef = useRef<Set<string>>(new Set());
  const audioCompletionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const receivedStopSignalRef = useRef(false);
  const devicePerformanceMetricsRef = useRef({
    averagePlaybackTime: 0,
    playbackCount: 0,
    isSlowDevice: false
  });
  const userInteractedRef = useRef(false);

  /**
   * Convert PCM 16-bit data to Float32Array for Web Audio API
   */
  const convertPCM16ToFloat32 = useCallback((buffer: ArrayBuffer): Float32Array => {
    const view = new Int16Array(buffer);
    const output = new Float32Array(view.length);
    for (let i = 0; i < view.length; i++) {
      // Convert from int16 to float32 (range -32768 to 32767)
      output[i] = view[i] / 32768;
    }
    return output;
  }, []);

  /**
   * Clear audio queue and stop current playback
   * If forceAll is false, it will keep playing the current chunk and any remaining in queue
   */
  // Legacy audio queue management - renamed to make it clear we're using the new audio service
  // This is just a compatibility wrapper that delegates to the audio service
  const legacyClearAudioQueue = useCallback((forceAll = true) => {
    console.log(`[AUDIO-CLEAR] Delegating audio queue clearing to audio service (force=${forceAll})`);

    // Use the standalone audio service to clear the queue
    // Only force clear if explicitly requested
    return clearAudioQueue(forceAll);
  }, []);

  /**
   * Play the next audio chunk in the queue
   */
  const playNextInQueue = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;

      // Enhanced logging for empty queue situations
      if (!window.__emptyQueueTimings) {
        window.__emptyQueueTimings = {
          emptyCount: 0,
          timestamps: [],
          pendingChunksAtEmpty: []
        };
      }

      window.__emptyQueueTimings.emptyCount++;
      window.__emptyQueueTimings.timestamps.push(Date.now());
      window.__emptyQueueTimings.pendingChunksAtEmpty.push(pendingChunksRef.current.size);

      console.log(`[AUDIO-QUEUE-EMPTY] Queue is empty, playback paused. Empty count: ${window.__emptyQueueTimings.emptyCount}, pending chunks: ${pendingChunksRef.current.size}`);

      // Check if this could be a premature cutoff
      if (pendingChunksRef.current.size === 0 && !receivedStopSignalRef.current) {
        console.warn(`[AUDIO-CUTOFF-WARNING] Queue empty but no stop signal received. Possible premature cutoff.`);

        // Track when the last buffer was received vs this empty queue event
        if (window.__audioBufferTimings?.lastBufferTime) {
          const timeSinceLastBuffer = Date.now() - window.__audioBufferTimings.lastBufferTime;
          console.warn(`[AUDIO-TIMING-ANALYSIS] Time since last buffer received: ${timeSinceLastBuffer}ms`);

          // If it's been less than 500ms since the last buffer, this could be a gap
          if (timeSinceLastBuffer < 500) {
            console.warn(`[AUDIO-GAP-DETECTED] Short gap detected between audio chunks (${timeSinceLastBuffer}ms). This may indicate transmission issues.`);
          }
        }
      }

      return;
    }

    isPlayingRef.current = true;
    const audioData = audioQueueRef.current.shift();

    // Retrieve any chunk ID that might be attached to this buffer
    const chunkId = (audioData as any)?.__chunkId || `unknown-${Date.now()}`;

    if (!audioData) return;

    // Create an AudioContext if it doesn't exist
    if (!audioContextForPlaybackRef.current) {
      audioContextForPlaybackRef.current = new AudioContext({ sampleRate: 24000 });
      console.log(`[AUDIO-CONTEXT] Created new AudioContext with sample rate: ${audioContextForPlaybackRef.current.sampleRate}Hz`);
      // WebAI suggestion #7 - Log device info when AudioContext is created
      logDeviceInfo();

      // Log audio context state
      console.log(`[AUDIO-CONTEXT-STATE] Initial state: ${audioContextForPlaybackRef.current.state}`);

      // Track audio context state changes
      audioContextForPlaybackRef.current.addEventListener('statechange', () => {
        console.log(`[AUDIO-CONTEXT-STATE-CHANGE] State changed to: ${audioContextForPlaybackRef.current?.state}`);
        audioLogger.logAudioContextState(audioContextForPlaybackRef.current?.state || 'unknown');
      });
    }

    try {
      // We already have the chunkId from above, or use the existing code's generated ID as a backup
      const internalChunkId = `internal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const trackingId = chunkId || internalChunkId;

      // Track this chunk as pending
      pendingChunksRef.current.add(trackingId);

      // Track the start of playback in the lifecycle
      if (window.__audioChunkLifecycle && window.__audioChunkLifecycle[chunkId]) {
        window.__audioChunkLifecycle[chunkId].playStart = Date.now();
        window.__audioChunkLifecycle[chunkId].status = 'playing';

        // Calculate time from queuing to playing
        const queueToPlayTime = window.__audioChunkLifecycle[chunkId].playStart - window.__audioChunkLifecycle[chunkId].enqueued;
        console.log(`[AUDIO-LIFECYCLE-${chunkId}] Buffer took ${queueToPlayTime}ms to start playing after queuing`);
      }

      // Track detailed playback timing in window object
      if (!window.__audioPlaybackTimings) {
        window.__audioPlaybackTimings = {
          chunks: [],
          currentChunk: null,
          playbackSuccessCount: 0,
          playbackErrorCount: 0,
          totalDuration: 0
        };
      }

      // Record start time for performance metrics
      const startTime = Date.now();

      // Set current chunk
      window.__audioPlaybackTimings.currentChunk = {
        id: chunkId,
        startTime,
        size: audioData.byteLength,
        status: 'processing'
      };

      // Convert the buffer to the correct format
      const audioCtx = audioContextForPlaybackRef.current;
      const floatArray = convertPCM16ToFloat32(audioData);
      const audioBuffer = audioCtx.createBuffer(1, floatArray.length, audioCtx.sampleRate);
      audioBuffer.getChannelData(0).set(floatArray);

      // Calculate and track duration for this chunk
      const durationSeconds = audioBuffer.duration;
      const durationMs = durationSeconds * 1000;

      window.__audioPlaybackTimings.currentChunk.durationMs = durationMs;
      window.__audioPlaybackTimings.totalDuration += durationMs;

      console.log(`[AUDIO-CHUNK-PREPARE-${chunkId}] Preparing buffer: ${audioBuffer.length} samples, ${durationSeconds.toFixed(3)}s duration`);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);

      // Store the current source for potential interruption
      currentAudioSourceRef.current = source;

      // Update chunk status
      window.__audioPlaybackTimings.currentChunk.status = 'playing';
      window.__audioPlaybackTimings.currentChunk.playStart = Date.now();

      // When this chunk finishes, mark as complete and play the next one
      source.onended = () => {
        // Track performance for this chunk
        const playbackTime = Date.now() - startTime;
        const playbackEndTime = Date.now();

        // Track playback completion in the lifecycle
        if (window.__audioChunkLifecycle && window.__audioChunkLifecycle[chunkId]) {
          window.__audioChunkLifecycle[chunkId].playEnd = playbackEndTime;
          window.__audioChunkLifecycle[chunkId].status = 'completed';
          window.__audioChunkLifecycle[chunkId].playDuration = playbackEndTime - window.__audioChunkLifecycle[chunkId].playStart;

          // Calculate complete lifecycle time
          const totalLifecycle = playbackEndTime - window.__audioChunkLifecycle[chunkId].received;
          console.log(`[AUDIO-LIFECYCLE-${chunkId}] Complete lifecycle: ${totalLifecycle}ms (Receive→Queue: ${window.__audioChunkLifecycle[chunkId].enqueued - window.__audioChunkLifecycle[chunkId].received}ms, Queue→Play: ${window.__audioChunkLifecycle[chunkId].playStart - window.__audioChunkLifecycle[chunkId].enqueued}ms, Play: ${window.__audioChunkLifecycle[chunkId].playDuration}ms)`);
        }

        // Calculate actual vs expected duration
        const actualDuration = playbackEndTime - window.__audioPlaybackTimings.currentChunk.playStart;
        const expectedDuration = durationMs;
        const durationRatio = actualDuration / expectedDuration;

        // Update current chunk status
        window.__audioPlaybackTimings.currentChunk.status = 'complete';
        window.__audioPlaybackTimings.currentChunk.endTime = playbackEndTime;
        window.__audioPlaybackTimings.currentChunk.actualDuration = actualDuration;
        window.__audioPlaybackTimings.currentChunk.durationRatio = durationRatio;

        // Add to chunks history
        window.__audioPlaybackTimings.chunks.push({ ...window.__audioPlaybackTimings.currentChunk });
        window.__audioPlaybackTimings.playbackSuccessCount++;

        // Check for duration anomalies
        if (durationRatio < 0.9 || durationRatio > 1.1) {
          console.warn(`[AUDIO-DURATION-ANOMALY-${chunkId}] Playback duration abnormal: expected ${expectedDuration.toFixed(0)}ms, actual ${actualDuration.toFixed(0)}ms, ratio ${durationRatio.toFixed(2)}`);
        }

        // Update performance metrics
        const metrics = devicePerformanceMetricsRef.current;
        metrics.averagePlaybackTime =
          (metrics.averagePlaybackTime * metrics.playbackCount + playbackTime) /
          (metrics.playbackCount + 1);
        metrics.playbackCount++;

        // Detect slow devices after we have enough data
        if (metrics.playbackCount >= 5 && metrics.averagePlaybackTime > 200) {
          metrics.isSlowDevice = true;
        }

        // Remove this chunk from pending list
        pendingChunksRef.current.delete(chunkId);
        console.log(`[AUDIO-CHUNK-COMPLETE-${chunkId}] Finished playing (${actualDuration.toFixed(0)}ms), ${pendingChunksRef.current.size} chunks still pending, queue: ${audioQueueRef.current.length}`);

        // Log enhanced playback metrics
        if (metrics.playbackCount % 5 === 0) {
          const totalPlaybackDuration = window.__audioPlaybackTimings.totalDuration;
          console.log(`[AUDIO-METRICS] Completed ${metrics.playbackCount} chunks, avg playback time: ${metrics.averagePlaybackTime.toFixed(1)}ms, total audio: ${(totalPlaybackDuration / 1000).toFixed(1)}s`);
        }

        currentAudioSourceRef.current = null;

        // Clean up this source
        source.disconnect();

        // Play next if available
        if (audioQueueRef.current.length > 0) {
          playNextInQueue();
        } else if (pendingChunksRef.current.size === 0 && receivedStopSignalRef.current) {
          // This was the last chunk and we've received stop signal
          console.log(`[AUDIO-COMPLETE] All chunks played and stop signal received. Finalizing playback.`);
          finalizeAudioPlayback();
        } else if (pendingChunksRef.current.size === 0) {
          // Queue is empty but no stop signal - might be waiting for more chunks
          console.log(`[AUDIO-WAITING] Queue empty but no stop signal. Waiting for more chunks...`);
        }
      };

      // Handle errors
      source.onerror = (event) => {
        console.error(`[AUDIO-ERROR-${chunkId}]`, "Audio source error", event);

        // Update error tracking
        window.__audioPlaybackTimings.currentChunk.status = 'error';
        window.__audioPlaybackTimings.currentChunk.errorTime = Date.now();
        window.__audioPlaybackTimings.currentChunk.errorDetails = {
          timeElapsed: Date.now() - startTime
        };

        // Track error in the lifecycle
        if (window.__audioChunkLifecycle && window.__audioChunkLifecycle[chunkId]) {
          window.__audioChunkLifecycle[chunkId].errorTime = Date.now();
          window.__audioChunkLifecycle[chunkId].status = 'error';
          window.__audioChunkLifecycle[chunkId].errorDetails = {
            timeElapsed: Date.now() - startTime,
            event: 'onerror'
          };

          console.error(`[AUDIO-LIFECYCLE-ERROR-${chunkId}] Audio playback error after ${window.__audioChunkLifecycle[chunkId].errorTime - window.__audioChunkLifecycle[chunkId].playStart}ms of playback`);
        }

        // Add to chunks history
        window.__audioPlaybackTimings.chunks.push({ ...window.__audioPlaybackTimings.currentChunk });
        window.__audioPlaybackTimings.playbackErrorCount++;

        pendingChunksRef.current.delete(chunkId); // Still mark as complete to avoid hanging

        // Continue to next chunk on error
        setTimeout(playNextInQueue, 0);
      };

      // Start playback
      source.start(0);

      // Enhanced logging with more details about this chunk and overall state
      console.log(`[AUDIO-PLAY-START-${chunkId}] Started playing chunk: ${durationMs.toFixed(1)}ms duration, ${audioQueueRef.current.length} chunks in queue, ${pendingChunksRef.current.size} pending, context: ${audioCtx.state}`);

      // Use the advanced audio logger
      audioLogger.logAudioBuffer(
        audioData.byteLength,
        'processed',
        {
          sampleRate: audioCtx.sampleRate,
          duration: durationSeconds,
          channelCount: 1,
          expectedDuration: durationSeconds
        }
      );
    } catch (error) {
      console.error("Error playing audio buffer:", error);

      // Track error in our timing system
      if (window.__audioPlaybackTimings?.currentChunk) {
        window.__audioPlaybackTimings.currentChunk.status = 'processing_error';
        window.__audioPlaybackTimings.currentChunk.errorTime = Date.now();
        window.__audioPlaybackTimings.currentChunk.errorDetails = {
          message: error.message,
          timeElapsed: Date.now() - window.__audioPlaybackTimings.currentChunk.startTime
        };

        // Add to chunks history
        window.__audioPlaybackTimings.chunks.push({ ...window.__audioPlaybackTimings.currentChunk });
        window.__audioPlaybackTimings.playbackErrorCount++;
      }

      // Continue to next chunk on error
      setTimeout(playNextInQueue, 0);
    }
  }, [convertPCM16ToFloat32, logDeviceInfo]);

  /**
   * Add a new audio chunk to the queue and start playback if not already playing
   */
  const playAudioData = useCallback((audioData: ArrayBuffer, chunkId?: string) => {
    // Track enqueuing time for the chunk lifecycle if an ID is provided
    if (chunkId && window.__audioChunkLifecycle && window.__audioChunkLifecycle[chunkId]) {
      window.__audioChunkLifecycle[chunkId].enqueued = Date.now();
      window.__audioChunkLifecycle[chunkId].status = 'queued';
      window.__audioChunkLifecycle[chunkId].queuePosition = audioQueueRef.current.length;

      // Calculate time from receipt to queuing
      const receiptToQueueTime = window.__audioChunkLifecycle[chunkId].enqueued - window.__audioChunkLifecycle[chunkId].received;
      if (receiptToQueueTime > 50) {
        console.log(`[AUDIO-LIFECYCLE-${chunkId}] Buffer took ${receiptToQueueTime}ms to be enqueued after receipt`);
      }

      // Store the chunk ID with the buffer for tracking
      (audioData as any).__chunkId = chunkId;
    }

    // Add the new audio data to the queue
    audioQueueRef.current.push(audioData);

    // If not currently playing, start playback
    if (!isPlayingRef.current) {
      playNextInQueue();
    }
  }, [playNextInQueue]);

  /**
   * Finalize audio playback with complete cleanup
   * WebAI suggestion #4 - Robust finalization function
   */
  const finalizeAudioPlayback = useCallback(() => {
    // Record finalization timestamp
    const finalizeTimestamp = Date.now();

    // Perform analysis to detect potential cutoff issues
    const audioAnalysis = {
      timestamp: finalizeTimestamp,
      queueEmpty: audioQueueRef.current.length === 0,
      pendingChunks: pendingChunksRef.current.size,
      isPlaying: isPlayingRef.current,
      receivedStopSignal: receivedStopSignalRef.current,
      userInteracted: userInteractedRef.current,
      timeSinceLastBuffer: window.__audioBufferTimings?.lastBufferTime
        ? finalizeTimestamp - window.__audioBufferTimings.lastBufferTime
        : null,
      totalBuffersReceived: window.__audioBufferTimings?.totalBuffers || 0,
      totalPlaybackDuration: window.__audioPlaybackTimings?.totalDuration || 0,
      totalSuccessfulChunks: window.__audioPlaybackTimings?.playbackSuccessCount || 0,
      totalErrorChunks: window.__audioPlaybackTimings?.playbackErrorCount || 0,
      emptyQueueCount: window.__emptyQueueTimings?.emptyCount || 0
    };

    // ENHANCEMENT: Run advanced audio cutoff diagnostics
    const msgId = Date.now().toString().slice(-6);
    if (window.__audioBufferTimings) {
      try {
        // Get current response text from the conversation
        // Instead of relying on undefined 'state' variable
        const currentAssistantMessage = conversation.find(msg =>
          msg.role === 'assistant' && msg.text && msg.status !== 'thinking'
        );

        const responseText = currentAssistantMessage?.text || window.__currentResponseText || '';

        if (responseText) {
          const expectedDuration = audioCutoffDiagnostics.estimateAudioDuration(responseText);
          const actualDuration = window.__audioPlaybackTimings?.totalDuration || 0;
          const durationRatio = actualDuration / expectedDuration;

          console.log(`[AUDIO-TEXT-ANALYSIS-${msgId}] Text length: ${responseText.length} chars`);
          console.log(`[AUDIO-TEXT-ANALYSIS-${msgId}] Expected: ~${expectedDuration}ms, Actual: ${actualDuration}ms, Ratio: ${durationRatio.toFixed(2)}`);

          // Store in global diagnostics for reference
          if (!window.__audioCutoffInstances) {
            window.__audioCutoffInstances = [];
          }

          if (!receivedStopSignalRef.current) {
            // This is a potentially problematic case - audio finalized without stop signal
            console.warn(`[AUDIO-FINALIZE-NO-STOP-${msgId}] Audio finalized without receiving stop signal!`);

            if (durationRatio < 0.9 && expectedDuration > 1000) {
              console.error(`[AUDIO-CUTOFF-DETECTED-${msgId}] Audio likely cut off prematurely!`);
              console.error(`[AUDIO-CUTOFF-ANALYSIS-${msgId}] Only ${(durationRatio * 100).toFixed(1)}% of expected audio was played`);
              console.error(`[AUDIO-CUTOFF-DETAIL-${msgId}] Text: "${responseText}"`);

              // Log to audio logger
              audioLogger.logError('audio_cutoff_confirmed', `Audio cutoff detected - only ${(durationRatio * 100).toFixed(1)}% of expected audio played`, {
                componentName: 'finalizeAudioPlayback',
                context: {
                  textLength: responseText.length,
                  expectedDuration,
                  actualDuration,
                  durationRatio,
                  totalBuffers: window.__audioBufferTimings.totalBuffers
                }
              });

              window.__audioCutoffInstances.push({
                timestamp: finalizeTimestamp,
                textLength: responseText.length,
                text: responseText,
                expectedDuration,
                actualDuration,
                durationRatio,
                totalBuffers: window.__audioBufferTimings.totalBuffers,
                bufferTimings: { ...window.__audioBufferTimings },
                receivedStopSignal: receivedStopSignalRef.current
              });
            }
          } else {
            // Normal case with stop signal - but still check for potential cutoffs
            // IMPORTANT: Even with stop signal, we can detect premature cutoffs by comparing text length and audio duration
            if (durationRatio < 0.9 && expectedDuration > 1000) {
              console.warn(`[AUDIO-CUTOFF-POSSIBLE-${msgId}] Even with stop signal, audio appears shorter than expected`);
              console.warn(`[AUDIO-CUTOFF-ANALYSIS-${msgId}] Only ${(durationRatio * 100).toFixed(1)}% of expected audio duration was played`);

              // Analyze buffer timing for clues
              const bufferTimings = window.__audioBufferTimings;
              const stopTime = bufferTimings.stopSignalTime || finalizeTimestamp;
              const timeSinceLastBuffer = stopTime - bufferTimings.lastBufferTime;

              console.warn(`[AUDIO-BUFFER-TIMING-${msgId}] Time between last buffer and stop signal: ${timeSinceLastBuffer}ms`);

              if (timeSinceLastBuffer < 300) {
                console.error(`[AUDIO-PREMATURE-STOP-${msgId}] Stop signal received too soon after last buffer (${timeSinceLastBuffer}ms)`);

                window.__audioCutoffInstances.push({
                  timestamp: finalizeTimestamp,
                  type: 'premature_stop_signal',
                  textLength: responseText.length,
                  text: responseText,
                  expectedDuration,
                  actualDuration,
                  durationRatio,
                  timeSinceLastBuffer,
                  totalBuffers: window.__audioBufferTimings.totalBuffers,
                  bufferTimings: { ...window.__audioBufferTimings },
                  receivedStopSignal: true
                });
              }
            }
          }
        } else {
          console.log(`[AUDIO-TEXT-ANALYSIS-${msgId}] No response text available for analysis`);
        }
      } catch (error) {
        console.error(`[AUDIO-TEXT-ANALYSIS-${msgId}] Error analyzing audio completion:`, error);
      }
    }

    // Track all finalizations for debugging
    if (!window.__audioFinalizations) {
      window.__audioFinalizations = [];
    }
    window.__audioFinalizations.push(audioAnalysis);

    // Log comprehensive analysis of the audio session
    console.log(`[AUDIO-FINALIZE-ANALYSIS] Finalizing audio playback:`, JSON.stringify(audioAnalysis, null, 2));

    // Detect potential premature cutoff
    if (!receivedStopSignalRef.current && audioAnalysis.timeSinceLastBuffer !== null && audioAnalysis.timeSinceLastBuffer < 500) {
      console.warn(`[AUDIO-CUTOFF-DETECTED] Potential premature cutoff detected. Last buffer received ${audioAnalysis.timeSinceLastBuffer}ms ago without stop signal.`);
    }

    // Clean up any timers
    if (audioCompletionTimerRef.current) {
      console.log(`[AUDIO-TIMER-CLEANUP] Clearing audio completion timer`);
      clearTimeout(audioCompletionTimerRef.current);
      audioCompletionTimerRef.current = null;
    }

    // Stop current audio source if playing
    if (currentAudioSourceRef.current) {
      try {
        // Log that we're stopping an active audio source
        console.log(`[AUDIO-SOURCE-STOP] Stopping active audio source during finalization`);
        const wasPlaying = isPlayingRef.current;

        // Track in our diagnostics
        if (wasPlaying && window.__audioPlaybackTimings?.currentChunk) {
          window.__audioPlaybackTimings.currentChunk.status = 'interrupted';
          window.__audioPlaybackTimings.currentChunk.interruptTime = Date.now();
          window.__audioPlaybackTimings.chunks.push({ ...window.__audioPlaybackTimings.currentChunk });

          // Calculate partial playback ratio
          const partialDuration = Date.now() - window.__audioPlaybackTimings.currentChunk.playStart;
          const expectedDuration = window.__audioPlaybackTimings.currentChunk.durationMs || 0;
          const partialRatio = partialDuration / expectedDuration;

          console.warn(`[AUDIO-INTERRUPT] Interrupting chunk ${window.__audioPlaybackTimings.currentChunk.id} after ${partialDuration}ms (${(partialRatio * 100).toFixed(1)}% complete)`);
        }

        // Properly cleanup source
        currentAudioSourceRef.current.onended = null;
        currentAudioSourceRef.current.stop();
        currentAudioSourceRef.current.disconnect();
        currentAudioSourceRef.current = null;
      } catch (error) {
        console.error(`[AUDIO-ERROR] Error stopping current audio source:`, error);
      }
    }

    // Reset all state
    const queueSize = audioQueueRef.current.length;
    const pendingSize = pendingChunksRef.current.size;

    if (queueSize > 0 || pendingSize > 0) {
      console.warn(`[AUDIO-CLEANUP] Clearing non-empty queue: ${queueSize} remaining buffers and ${pendingSize} pending chunks`);
    }

    audioQueueRef.current = [];
    pendingChunksRef.current.clear();
    isPlayingRef.current = false;
    receivedStopSignalRef.current = false;

    // Log user interaction events
    if (userInteractedRef.current) {
      console.log(`[AUDIO-USER-INTERACTION] User interaction detected during audio playback, forcefully cleaning up`);
      // Log device info for diagnostics
      logDeviceInfo();

      // Register event in audio logger
      audioLogger.logUserInteraction('interrupt_playback', {
        timestamp: finalizeTimestamp,
        audioQueueSize: queueSize,
        pendingChunks: pendingSize,
        hadReceivedStopSignal: audioAnalysis.receivedStopSignal
      });
    }

    // Log completion in the audio logger
    audioLogger.logCompletionEvent(
      audioAnalysis.receivedStopSignal ? 'normal_completion' : 'forced_completion',
      queueSize,
      false,
      audioAnalysis.receivedStopSignal
        ? 'Normal completion with stop signal'
        : `Forced completion without stop signal (${queueSize} buffers discarded)`
    );

    // Enhanced diagnostics for audio playback finalization
    if (typeof window !== 'undefined') {
      if (!window.__audioCompletionStats) {
        window.__audioCompletionStats = {
          completions: 0,
          normalCompletions: 0,
          forcedCompletions: 0,
          potentialCutoffs: 0,
          lastCompletionTime: null,
          averageBuffersPerCompletion: 0,
          totalBuffersPlayed: 0
        };
      }

      // Update audio completion statistics
      window.__audioCompletionStats.completions++;
      window.__audioCompletionStats.lastCompletionTime = finalizeTimestamp;
      window.__audioCompletionStats.totalBuffersPlayed += audioAnalysis.totalSuccessfulChunks;
      window.__audioCompletionStats.averageBuffersPerCompletion =
        window.__audioCompletionStats.totalBuffersPlayed / window.__audioCompletionStats.completions;

      if (audioAnalysis.receivedStopSignal) {
        window.__audioCompletionStats.normalCompletions++;
      } else {
        window.__audioCompletionStats.forcedCompletions++;
        if (audioAnalysis.timeSinceLastBuffer !== null && audioAnalysis.timeSinceLastBuffer < 500) {
          window.__audioCompletionStats.potentialCutoffs++;
        }
      }

      console.log(`[AUDIO-COMPLETION-STATS] Updated stats:`, JSON.stringify(window.__audioCompletionStats, null, 2));
    }

    console.log(`[AUDIO-FINALIZE-COMPLETE] Audio playback finalized at ${new Date(finalizeTimestamp).toISOString()}`);

    // Notify any listeners that playback has truly completed
    console.log(`[AUDIO-FINALIZE] Audio playback fully completed and resources cleaned up`);
  }, [logDeviceInfo, conversation]);


  /**
   * Calculate RMS volume from inbound assistant audio
   */
  const getVolume = useCallback((): number => {
    if (!analyserRef.current) return 0;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const float = (dataArray[i] - 128) / 128;
      sum += float * float;
    }
    return Math.sqrt(sum / dataArray.length);
  }, []);

  /**
   * Main data channel message handler: interprets events from the server.
   */
  const handleDataChannelMessage = useCallback(async (event: MessageEvent<string>) => {
    try {
      const msg = JSON.parse(event.data);

      // Create unique ID for this message for correlation in logs
      const msgId = Date.now().toString().slice(-6);

      // Create counters to limit logging of repetitive messages
      if (!window.__messageTypeCounts) {
        window.__messageTypeCounts = {};
      }

      // Enhanced logging for function calls and payloads - always log these
      if (msg.type === "error") {
        console.error(`[ERROR-MESSAGE-${msgId}] WebRTC server returned error:`, msg);
        setErrorMessage(`WebRTC error: ${msg.message || "Unknown error"}`);
      }
      else if (msg.type === "response.function_call_arguments.done") {
        console.log(`[FUNCTION-PAYLOAD-${msgId}] AI FUNCTION CALL: ${msg.name}`);
        console.log(`[FUNCTION-PAYLOAD-${msgId}] Call ID: ${msg.call_id}`);
        console.log(`[FUNCTION-PAYLOAD-${msgId}] Raw arguments:`, msg.arguments);

        try {
          const parsedArgs = JSON.parse(msg.arguments);
          console.log(`[FUNCTION-PAYLOAD-${msgId}] Parsed arguments:`, parsedArgs);
        } catch (e) {
          console.error(`[FUNCTION-PAYLOAD-${msgId}] Failed to parse arguments:`, e);
        }
      }
      // Log user transcriptions with keyword detection - always log these
      else if (msg.type === "conversation.item.input_audio_transcription.completed" && typeof msg.transcript === 'string') {
        console.log(`[TRANSCRIPT-${msgId}] Final user transcription:`, msg.transcript);

        // Check for common function call trigger phrases
        const lowerTranscript = msg.transcript.toLowerCase();
        const nextQuestionKeywords = ['next question', 'another question', 'different question', 'move on', 'topic transition', 'change topic', 'what else', 'tell me more', 'switch', 'something else'];

        for (const keyword of nextQuestionKeywords) {
          if (lowerTranscript.includes(keyword)) {
            console.log(`[FUNCTION-TRIGGER-${msgId}] Detected potential "fetch_next_question" trigger: "${keyword}" in: "${msg.transcript}"`);
            break;
          }
        }
      }
      // Catch AI messages that might be preparing function calls - only log these if they contain function keywords
      else if (msg.type === "response.audio_transcript.delta" && typeof msg.delta === 'string' &&
        (msg.delta.includes("function") || msg.delta.includes("fetch_next_question") || msg.delta.includes("query_book_content"))) {
        console.log(`[FUNCTION-INDICATOR-${msgId}] Potential function mention in AI response:`, msg.delta);
      }
      // Log regular message types with rate limiting
      else {
        // Use type as the key for counting
        const msgType = msg.type;

        // Initialize counter for this message type if needed
        if (!window.__messageTypeCounts[msgType]) {
          window.__messageTypeCounts[msgType] = 0;
        }

        // Increment the counter
        window.__messageTypeCounts[msgType]++;

        // Log only the first message, every 10th message, and messages when a type changes
        if (window.__messageTypeCounts[msgType] === 1 ||
          window.__messageTypeCounts[msgType] % 10 === 0 ||
          window.__lastMessageType !== msgType) {

          console.log(`[MESSAGE-${msgId}] Type: ${msgType} (${window.__messageTypeCounts[msgType]})`);

          // Additional debug for first few audio transcript deltas to show content format
          if (msgType === "response.audio_transcript.delta" && window.__messageTypeCounts[msgType] <= 3) {
            console.log(`[TRANSCRIPT-SAMPLE-${msgId}] Delta type: ${typeof msg.delta}`);
          }
        }

        // Update the last message type
        window.__lastMessageType = msgType;
      }

      // Always log the raw message for diagnostics
      setRawMessages((prevMsgs: any[]) => [...prevMsgs, msg]);

      switch (msg.type) {
        /**
         * User speech started
         */
        case "input_audio_buffer.speech_started": {
          // Mark that a user message is being received to enable proper function calling
          onUserMessageReceived();

          getOrCreateEphemeralUserId();
          updateEphemeralUserMessage({ status: "speaking" });
          break;
        }

        /**
         * User speech stopped
         */
        case "input_audio_buffer.speech_stopped": {
          // optional: you could set "stopped" or just keep "speaking"
          updateEphemeralUserMessage({ status: "speaking" });
          break;
        }

        /**
         * Audio buffer committed => "Thinking..."
         */
        case "input_audio_buffer.committed": {
          // Reset delta counter for next response cycle
          if (window.__aiDeltaTypeCounts) {
            window.__aiDeltaTypeCounts.string = 0;
            window.__aiDeltaTypeCounts.function = 0;
            window.__aiDeltaTypeCounts.other = 0;
          }

          // Set thinking state and update the UI
          const wasThinking = isThinkingRef.current;
          isThinkingRef.current = true;
          updateEphemeralUserMessage({
            text: "Thinking...",
            status: "thinking",
          });

          console.log(`[THINKING-STATE-${msgId}] Entered thinking state from input_audio_buffer.committed (was already thinking: ${wasThinking})`);

          // Update diagnostics for UI to use with timestamp
          const thinkingStartTime = Date.now();

          // Keep track of message flow state for debugging
          if (typeof window !== 'undefined') {
            window.__messageFlowState = {
              ...window.__messageFlowState,
              lastThinkingStartTime: thinkingStartTime,
              lastThinkingSource: "input_audio_buffer.committed",
              thinkingSetCount: (window.__messageFlowState?.thinkingSetCount || 0) + 1
            };
          }

          setDiagnosticData((prev: Record<string, any>) => ({
            ...prev,
            isThinking: true,
            thinkingStartTime: thinkingStartTime,
            thinkingSource: "input_audio_buffer.committed",
            thinkingStateTransitions: (prev.thinkingStateTransitions || 0) + 1,
            wasAlreadyThinking: wasThinking
          }));
          break;
        }

        /**
         * Partial user transcription
         */
        case "conversation.item.input_audio_transcription.delta": {
          // Get current message text first before any updates
          let currentText = "";
          setConversation((prev: Conversation[]) => {
            const ephemeralId = ephemeralUserMessageIdRef.current;
            if (ephemeralId) {
              const currentMsg = prev.find(msg => msg.id === ephemeralId);
              if (currentMsg && typeof currentMsg.text === 'string') {
                currentText = currentMsg.text;
              }
            }
            return prev; // Don't modify state here
          });

          // Create counters to track delta types if not exists
          if (!window.__deltaTypeCounts) {
            window.__deltaTypeCounts = { string: 0, function: 0, other: 0 };
          }

          if (msg.delta && typeof msg.delta === 'string') {
            // Handle string delta (normal case)
            window.__deltaTypeCounts.string++;

            // Only log first one and then every 20th delta
            if (window.__deltaTypeCounts.string === 1 || window.__deltaTypeCounts.string % 20 === 0) {
              console.log(`[DELTA-STRING-${window.__deltaTypeCounts.string}] Sample:`,
                msg.delta.length > 20 ? msg.delta.substring(0, 20) + '...' : msg.delta);
            }

            // Use direct text update instead of function update
            updateEphemeralUserMessage({
              text: currentText + msg.delta,
              status: "speaking",
              isFinal: false,
            });
          } else if (msg.delta && typeof msg.delta === 'function') {
            // Handle function delta case - log it or convert to string
            window.__deltaTypeCounts.function++;
            console.log(`[UNUSUAL-DELTA-${msgId}] Received function delta (occurrence #${window.__deltaTypeCounts.function})`);

            const deltaString = String(msg.delta);
            // Use direct text update instead of function update
            updateEphemeralUserMessage({
              text: currentText + deltaString,
              status: "speaking",
              isFinal: false,
            });
          } else if (msg.delta) {
            // Handle other non-string delta types
            window.__deltaTypeCounts.other++;
            console.log(`[UNUSUAL-DELTA-${msgId}] Received non-string delta type: ${typeof msg.delta} (occurrence #${window.__deltaTypeCounts.other})`);

            const deltaString = String(msg.delta);
            // Use direct text update instead of function update
            updateEphemeralUserMessage({
              text: currentText + deltaString,
              status: "speaking",
              isFinal: false,
            });
          }
          break;
        }

        /**
         * Final user transcription
         */
        case "conversation.item.input_audio_transcription.completed": {
          // Log user transcription with special formatting
          if (typeof msg.transcript === 'string') {
            console.log(`[USER-TRANSCRIPT-${msgId}] ${msg.transcript}`);
            console.log(`[USER-TRANSCRIPT-${msgId}] Data channel state: ${dataChannelRef.current?.readyState}`);
            console.log(`[USER-TRANSCRIPT-${msgId}] Peer connection state: ${peerConnectionRef.current?.connectionState}`);

            // Normal string transcript
            updateEphemeralUserMessage({
              text: msg.transcript || "",
              isFinal: true,
              status: "final",
            });

            // This is the single point where we save user messages
            // Only save final transcriptions with meaningful content
            if (msg.transcript && msg.transcript.trim() !== "" && msg.transcript !== "Thinking...") {
              const finalUserMessage = {
                id: ephemeralUserMessageIdRef.current || uuidv4(),
                role: "user",
                text: msg.transcript,
                timestamp: new Date().toISOString(),
                isFinal: true
              };
              // Save user message to Supabase exactly once when transcription is complete
              saveMessageToSupabase(finalUserMessage);

              // CRITICAL: Ensure we're actually triggering an AI response with response.create
              // after the transcript is finalized
              try {
                if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
                  console.log(`[USER-TRANSCRIPT-${msgId}] Transcript finalized, sending explicit response.create`);
                  // Explicitly request AI response
                  const responseCreate = {
                    type: "response.create"
                  };

                  // Add confirmation detection listener (for logging only in this stage)
                  const confirmationListener = (event: MessageEvent<any>) => {
                    try {
                      const data = JSON.parse(event.data);
                      if (data.type === "conversation.item.created" &&
                        data.item && data.item.type === "message") {
                        console.log(`[TRANSCRIPT-CONFIRMATION-${msgId}] Detected AI received transcript`);
                        // Remove listener after detection
                        dataChannelRef.current?.removeEventListener('message', confirmationListener);
                      }
                    } catch (e) {
                      // Ignore parse errors
                    }
                  };

                  // Add the listener
                  dataChannelRef.current.addEventListener('message', confirmationListener);

                  // Set a timeout to clean up the listener if we don't get confirmation
                  setTimeout(() => {
                    dataChannelRef.current?.removeEventListener('message', confirmationListener);
                  }, 10000); // 10 second timeout for listener cleanup

                  // Delay to ensure transcription is fully processed before sending follow-up message
                  setTimeout(() => {
                    // CRITICAL FIX: Check if a function call is already in progress before sending response.create
                    const isFunctionInProgress = typeof window !== 'undefined' &&
                      window.__functionCallTracker &&
                      window.__functionCallTracker.isProcessingFunction;

                    if (isFunctionInProgress) {
                      console.log(`[USER-TRANSCRIPT-${msgId}] ⚠️ Not sending response.create because a function is already being processed`);
                      return;
                    }

                    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
                      console.log(`[USER-TRANSCRIPT-${msgId}] Queueing response.create after transcription`);
                      console.log(`[USER-TRANSCRIPT-${msgId}] commented out the following as a test: Queueing response.create after transcription`);
                      // queueResponseCreate(responseCreate, "transcription-completion");

                      // CRITICAL FIX: Remove the automatic retry logic that was causing double questions
                      // Instead, just log if we're still thinking after a longer period
                      setTimeout(() => {
                        // Get the latest function status
                        const isStillProcessingFunction = typeof window !== 'undefined' &&
                          window.__functionCallTracker &&
                          window.__functionCallTracker.isProcessingFunction;

                        // Only log if we're still thinking but not processing a function
                        if (isThinkingRef.current && !isStillProcessingFunction &&
                          dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
                          console.warn(`[USER-TRANSCRIPT-${msgId}] Still thinking after 5s but no function call in progress - system may be stuck`);
                          // We no longer automatically send another response.create
                        }
                      }, 5000);
                    } else {
                      console.error(`[USER-TRANSCRIPT-${msgId}] Data channel not open for response.create`);
                    }
                  }, MESSAGE_SEQUENCE_DELAY_MS); // Using centralized delay constant

                  // This older detection system has been removed and replaced with the enhanced thinking state monitoring system
                  // The enhanced system in thinking-state-observer.ts and enhanced-error-interceptor.ts 
                  // now handles this more accurately with better false positive prevention
                  const transcriptTimeoutId = null;

                  // No timeout to store or clean up since we're using the enhanced monitoring system
                  if (typeof window !== 'undefined') {
                    window.__transcriptTimeoutId = null;
                  }
                } else {
                  console.error(`[USER-TRANSCRIPT-${msgId}] Data channel not ready, can't request AI response`);
                }
              } catch (responseError) {
                console.error(`[USER-TRANSCRIPT-${msgId}] Error sending response.create:`, responseError);
              }
            }
          } else if (typeof msg.transcript === 'function') {
            // Handle function transcript (unusual case)
            console.log(`[UNUSUAL-TRANSCRIPT-${msgId}] Received function transcript`);
            const transcriptString = String(msg.transcript);
            updateEphemeralUserMessage({
              text: transcriptString || "",
              isFinal: true,
              status: "final",
            });
          } else {
            // Handle other non-string transcript types (unusual case)
            console.log(`[UNUSUAL-TRANSCRIPT-${msgId}] Received non-string transcript type: ${typeof msg.transcript}`);
            const transcriptString = msg.transcript ? String(msg.transcript) : "";
            updateEphemeralUserMessage({
              text: transcriptString,
              isFinal: true,
              status: "final",
            });
          }

          clearEphemeralUserMessage();
          break;
        }

        /**
         * Streaming AI transcripts (assistant partial)
         */
        case "response.audio_transcript.delta": {
          // Create counters to track AI delta types if not exists
          if (!window.__aiDeltaTypeCounts) {
            window.__aiDeltaTypeCounts = { string: 0, function: 0, other: 0 };
          }

          if (typeof msg.delta === 'string') {
            // Normal string delta - count but limit logging
            window.__aiDeltaTypeCounts.string++;

            // This is the first sign of AI responding, so clear thinking state
            if (window.__aiDeltaTypeCounts.string === 1) {
              isThinkingRef.current = false;
              // Update diagnostics for UI to use
              setDiagnosticData((prev: Record<string, any>) => ({
                ...prev,
                isThinking: false
              }));
            }

            // Only log the first couple and then periodically
            if (window.__aiDeltaTypeCounts.string <= 2 || window.__aiDeltaTypeCounts.string % 50 === 0) {
              console.log(`[AI-DELTA-${window.__aiDeltaTypeCounts.string}] Sample:`,
                msg.delta.length > 30 ? msg.delta.substring(0, 30) + '...' : msg.delta);
            }

            // Normal string delta
            setConversation((prev: Conversation[]) => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.role === "assistant" && !lastMsg.isFinal) {
                // Append to existing assistant partial
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...lastMsg,
                  text: lastMsg.text + msg.delta,
                };
                return updated;
              } else {
                // Start a new assistant partial
                const newMessage: Conversation = {
                  id: uuidv4(),
                  role: "assistant",
                  text: msg.delta,
                  timestamp: new Date().toISOString(),
                  isFinal: false,
                };
                return [...prev, newMessage];
              }
            });
          } else if (typeof msg.delta === 'function') {
            // Handle function delta - unusual case, always log
            window.__aiDeltaTypeCounts.function++;
            console.log(`[UNUSUAL-AI-DELTA-${msgId}] Received function delta in AI transcript (occurrence #${window.__aiDeltaTypeCounts.function})`);
            const deltaString = String(msg.delta);

            setConversation((prev: Conversation[]) => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.role === "assistant" && !lastMsg.isFinal) {
                // Append to existing assistant partial
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...lastMsg,
                  text: lastMsg.text + deltaString,
                };
                return updated;
              } else {
                // Start a new assistant partial
                const newMessage: Conversation = {
                  id: uuidv4(),
                  role: "assistant",
                  text: deltaString,
                  timestamp: new Date().toISOString(),
                  isFinal: false,
                };
                return [...prev, newMessage];
              }
            });
          } else if (msg.delta) {
            // Handle other non-string delta types - unusual case, always log
            window.__aiDeltaTypeCounts.other++;
            console.log(`[UNUSUAL-AI-DELTA-${msgId}] Received non-string delta type: ${typeof msg.delta} (occurrence #${window.__aiDeltaTypeCounts.other})`);
            const deltaString = String(msg.delta);

            setConversation((prev: Conversation[]) => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.role === "assistant" && !lastMsg.isFinal) {
                // Append to existing assistant partial
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...lastMsg,
                  text: lastMsg.text + deltaString,
                };
                return updated;
              } else {
                // Start a new assistant partial
                const newMessage: Conversation = {
                  id: uuidv4(),
                  role: "assistant",
                  text: deltaString,
                  timestamp: new Date().toISOString(),
                  isFinal: false,
                };
                return [...prev, newMessage];
              }
            });
          }
          break;
        }

        /**
         * Mark the last assistant message as final
         */
        case "response.audio_transcript.done": {
          // Check transcript type and log it
          console.log("AI final transcript type:", typeof msg.transcript);

          // Track response patterns - function calls vs direct responses
          if (typeof window !== 'undefined') {
            // Initialize tracking object if it doesn't exist
            if (!window.__aiResponseStats) {
              window.__aiResponseStats = {
                directResponses: 0,
                functionCalls: 0,
                lastResponseType: null,
                responseLog: []
              };
            }

            // Determine if this response included a function call
            const responseIncludedFunction = lastFunctionCall !== null;

            if (!responseIncludedFunction) {
              // This was a direct response without function call
              window.__aiResponseStats.directResponses += 1;
              window.__aiResponseStats.lastResponseType = 'direct';
              console.log(`[RESPONSE-PATTERN] AI responded directly without calling a function. Direct responses: ${window.__aiResponseStats.directResponses}, Function calls: ${window.__aiResponseStats.functionCalls}`);
            } else {
              // Reset function call tracking for next turn
              lastFunctionCall = null;
            }

            // Log the response for analysis
            window.__aiResponseStats.responseLog.push({
              type: responseIncludedFunction ? 'function' : 'direct',
              timestamp: Date.now(),
              text: msg.transcript && typeof msg.transcript === 'string'
                ? msg.transcript.substring(0, 100)
                : 'non-text transcript'
            });

            // Limit log size
            if (window.__aiResponseStats.responseLog.length > 20) {
              window.__aiResponseStats.responseLog.shift();
            }

            // Update diagnostic data with response pattern info
            setDiagnosticData((prev: Record<string, any>) => ({
              ...prev,
              responsePatterns: {
                directResponses: window.__aiResponseStats.directResponses,
                functionCalls: window.__aiResponseStats.functionCalls,
                lastResponseType: window.__aiResponseStats.lastResponseType
              }
            }));
          }

          // Ensure thinking state is cleared at the end of AI response
          isThinkingRef.current = false;
          setDiagnosticData((prev: Record<string, any>) => ({
            ...prev,
            isThinking: false
          }));

          // Mark AI response as complete to enforce turn-taking
          onAIResponseComplete();

          // This is the single point where we save all AI messages
          // Only save when the transcript is complete, not during stream
          if (msg.transcript && typeof msg.transcript === 'string') {
            // Get question ID from global variable if it exists (much simpler approach)
            const questionId = typeof window !== 'undefined' ? window.__lastQuestionId : null;

            if (questionId) {
              console.log(`Using stored question ID for AI message: ${questionId}`);
            }

            const finalAIMessage = {
              id: uuidv4(),
              role: "assistant",
              text: msg.transcript,
              timestamp: new Date().toISOString(),
              isFinal: true,
              // Include question_id with correct snake_case field name for Supabase
              // The API endpoint will determine whether to use question_id or quest_id based on format
              ...(questionId ? { question_id: questionId } : {})
            };

            // Save AI message to Supabase exactly once when response is complete
            saveMessageToSupabase(finalAIMessage);

            // Clear the global variable after use
            if (typeof window !== 'undefined' && window.__lastQuestionId) {
              window.__lastQuestionId = null;
              console.log('Cleared question ID after saving AI message');
            }
          }

          if (typeof msg.transcript === 'string') {
            // Handle string transcript (normal case)
            console.log(`[TRANSCRIPT-COMPLETE-${msgId}] Final AI transcript length: ${msg.transcript.length} chars`);
            console.log(`[TRANSCRIPT-COMPLETE-${msgId}] First 50 chars: ${msg.transcript.substring(0, 50)}`);
            console.log(`[TRANSCRIPT-COMPLETE-${msgId}] Last 50 chars: ${msg.transcript.substring(msg.transcript.length - 50)}`);

            setConversation((prev: Conversation[]) => {
              if (prev.length === 0) return prev;
              const updated = [...prev];

              // Get the current partial message for comparison
              const currentText = updated[updated.length - 1].text;
              console.log(`[TRANSCRIPT-UPDATE-${msgId}] Current partial length: ${currentText.length} chars`);
              console.log(`[TRANSCRIPT-UPDATE-${msgId}] Current partial last 50 chars: ${currentText.substring(currentText.length - 50)}`);

              // Compare if final transcript contains current partial (should usually be true)
              const containsPartial = msg.transcript.includes(currentText.substring(0, Math.min(50, currentText.length)));
              console.log(`[TRANSCRIPT-COMPARE-${msgId}] Final transcript contains current partial: ${containsPartial}`);

              const finalMessage = {
                ...updated[updated.length - 1],
                isFinal: true,
                text: msg.transcript || updated[updated.length - 1].text
              };
              updated[updated.length - 1] = finalMessage;

              // For debugging truncation issues
              setTimeout(() => {
                setConversation(prev => {
                  const lastMsg = prev[prev.length - 1];
                  if (lastMsg && lastMsg.role === "assistant" && lastMsg.id === finalMessage.id) {
                    console.log(`[VERIFY-TEXT-${msgId}] Verifying message with id ${finalMessage.id} still has correct length: ${lastMsg.text.length} chars`);
                    if (lastMsg.text.length < msg.transcript.length) {
                      console.warn(`[VERIFY-TEXT-${msgId}] TEXT WAS TRUNCATED! Original: ${msg.transcript.length} chars, Current: ${lastMsg.text.length} chars`);
                    }
                  }
                  return prev; // No changes, just verification
                });
              }, 500);

              return updated;
            });
          } else if (typeof msg.transcript === 'function') {
            // Handle function transcript
            console.log("Received function transcript for AI final transcript");
            const transcriptString = String(msg.transcript);

            setConversation((prev: Conversation[]) => {
              if (prev.length === 0) return prev;
              const updated = [...prev];
              const finalMessage = {
                ...updated[updated.length - 1],
                isFinal: true,
                text: transcriptString || updated[updated.length - 1].text
              };
              updated[updated.length - 1] = finalMessage;

              // We'll save the AI message at a single point below
              return updated;
            });
          } else {
            // Handle other or missing transcript types
            setConversation((prev: Conversation[]) => {
              if (prev.length === 0) return prev;
              const updated = [...prev];
              let finalText = updated[updated.length - 1].text;

              if (msg.transcript) {
                try {
                  finalText = String(msg.transcript);
                } catch (e) {
                  console.error("Could not convert transcript to string:", e);
                }
              }

              const finalMessage = {
                ...updated[updated.length - 1],
                isFinal: true,
                text: finalText
              };
              updated[updated.length - 1] = finalMessage;

              // We'll save the AI message at a single point below
              return updated;
            });
          }
          break;
        }

        /**
         * AI calls a function (tool)
         */
        case "response.function_call_arguments.done": {
          const fnName = msg.name;
          const fn = functionRegistry.current[fnName];
          const callId = msg.call_id;
          const executionId = Date.now().toString().slice(-6);
          const logPrefix = `[FUNCTION-EXECUTION-${executionId}]`;

          console.log(`${logPrefix} EXECUTING FUNCTION: ${fnName}`);
          console.log(`${logPrefix} Call ID: ${callId}`);
          console.log(`${logPrefix} AI decided to use function: ${fnName}`);
          
          // Emit event for function execution start
          if (typeof window !== 'undefined') {
            const event = new CustomEvent('function_execution_start', { 
              detail: { functionName: fnName }
            });
            window.dispatchEvent(event);
          }

          // Track function calls for response pattern analysis
          if (typeof window !== 'undefined') {
            // Initialize tracking object if it doesn't exist
            if (!window.__aiResponseStats) {
              window.__aiResponseStats = {
                directResponses: 0,
                functionCalls: 0,
                lastResponseType: null,
                responseLog: []
              };
            }

            // Record the function call
            window.__aiResponseStats.functionCalls += 1;
            window.__aiResponseStats.lastResponseType = 'function';
            console.log(`[RESPONSE-PATTERN] AI called function: ${fnName}. Direct responses: ${window.__aiResponseStats.directResponses}, Function calls: ${window.__aiResponseStats.functionCalls}`);

            // Update diagnostic data with response pattern info
            setDiagnosticData((prev: Record<string, any>) => ({
              ...prev,
              responsePatterns: {
                directResponses: window.__aiResponseStats.directResponses,
                functionCalls: window.__aiResponseStats.functionCalls,
                lastResponseType: window.__aiResponseStats.lastResponseType,
                lastFunctionName: fnName
              }
            }));
          }

          // Validate the function call - prevent improper sequences
          if (!validateFunctionCall(fnName)) {
            console.log(`${logPrefix} Function call ${fnName} rejected due to invalid state`);

            // Return error result to AI
            const errorResponse = {
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({
                  success: false,
                  error: `Function ${fnName} cannot be called in this state - waiting for user input before calling ${fnName}`
                })
              }
            };

            dataChannelRef.current?.send(JSON.stringify(errorResponse));

            // Send minimal response.create to continue the conversation
            setTimeout(() => {
              const responseCreate = {
                type: "response.create",
                response: {
                  instructions: "CRITICAL: You called a function at the wrong time. You must WAIT for user input before calling functions. Please acknowledge this error and wait for the user to respond.",
                  max_output_tokens: 500
                }
              };
              queueResponseCreate(responseCreate, `function-validation-error`);
            }, 500);

            // Don't execute the function
            return;
          }

          // Check for duplicate function calls using our global tracker
          if (typeof window !== 'undefined' && window.__functionCallTracker) {
            const timeThreshold = fnName === 'fetch_next_question' ? 10000 : 3000;

            if (window.__functionCallTracker.wasRecentlyCalled(fnName, timeThreshold)) {
              console.log(`${logPrefix} ⚠️ DUPLICATE FUNCTION CALL DETECTED: ${fnName} was called recently (within ${timeThreshold}ms)`);

              // For fetch_next_question, we'll return a special message to avoid changing topics
              if (fnName === 'fetch_next_question') {
                console.log(`${logPrefix} ⚠️ PREVENTING DUPLICATE fetch_next_question - Returning throttle message`);

                // Send function result indicating throttling
                const response = {
                  type: "conversation.item.create",
                  item: {
                    type: "function_call_output",
                    call_id: callId,
                    output: JSON.stringify({
                      success: true,
                      throttled: true,
                      message: "This question was already fetched. Please respond to the current question.",
                      ai_instructions: "This function call was throttled to prevent duplicate questions. Continue the conversation without changing topics or showing this message to the user."
                    })
                  }
                };

                console.log(`${logPrefix} Sending throttle response for duplicate function call`);
                dataChannelRef.current?.send(JSON.stringify(response));

                // Trigger AI to handle this response
                const responseCreate = {
                  type: "response.create"
                };

                queueResponseCreate(responseCreate, `function-${fnName}-throttled`);
                return; // Exit early - don't execute the function
              }
            }

            // Record this function call
            window.__functionCallTracker.recordCall(fnName);
          }

          // Special handling for fetch_next_question and query_book_content to prevent race conditions
          if (fnName === 'fetch_next_question' || fnName === 'query_book_content') {
            console.log(`${logPrefix} Special function handling for ${fnName} to prevent race conditions`);

            // Clear any pending responses in the queue that might interfere with our function result
            if (typeof window !== 'undefined' && window.__responseQueue) {
              // Stash the current state - we'll check what's in the queue
              const queueLength = window.__responseQueue.queue.length;

              // Filter out specific response types that could cause race conditions
              const safeQueue = window.__responseQueue.queue.filter(
                item => !item.source.includes('transcription-')
              );

              // If we removed any items, log it
              if (safeQueue.length < queueLength) {
                console.log(`${logPrefix} ⚠️ Race condition prevention: Filtered out ${queueLength - safeQueue.length} transcription-related responses from queue`);
                window.__responseQueue.queue = safeQueue;
              }
            }
          }

          // Log the raw incoming payload
          console.log(`${logPrefix} === INCOMING PAYLOAD FROM AI ===`);
          console.log(`${logPrefix} Message type: ${msg.type}`);
          console.log(`${logPrefix} Function name: ${fnName}`);
          console.log(`${logPrefix} Raw arguments: ${msg.arguments}`);

          if (fn) {
            try {
              // Parse arguments with additional logging
              let args;
              try {
                args = JSON.parse(msg.arguments);
                console.log(`${logPrefix} Parsed arguments for ${fnName}:`, JSON.stringify(args, null, 2));
              } catch (parseError) {
                console.error(`${logPrefix} Failed to parse arguments for ${fnName}:`, {
                  error: parseError,
                  rawArguments: msg.arguments
                });
                throw new Error(`Failed to parse function arguments: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
              }

              // Execute the function with timing information
              console.log(`${logPrefix} Executing function ${fnName} with args:`, args);
              const startTime = performance.now();
              const result = await fn(args);
              const endTime = performance.now();
              const executionTime = (endTime - startTime).toFixed(2);
              console.log(`${logPrefix} Function ${fnName} executed in ${executionTime}ms`);

              // Type check the result for debugging
              console.log(`${logPrefix} === FUNCTION RESULT ===`);
              console.log(`${logPrefix} Result type: ${typeof result}`);
              console.log(`${logPrefix} Has error: ${result.error ? 'YES' : 'NO'}`);
              console.log(`${logPrefix} Success: ${result.success ? 'YES' : 'NO'}`);
              console.log(`${logPrefix} Result content:`, JSON.stringify(result, null, 2));

              // Safely stringify the result
              let outputJson;
              try {
                outputJson = JSON.stringify(result);
                console.log(`${logPrefix} Successfully serialized ${fnName} result`);

                // CRITICAL FIX: Check if this is a function result that includes a new conversationId
                // This handles the case where a function like fetch_next_question creates a new conversation
                if (fnName === 'fetch_next_question' && result.conversationId && typeof window !== 'undefined') {
                  console.log(`${logPrefix} Function ${fnName} returned new conversationId: ${result.conversationId}`);
                  // Update localStorage with the new conversationId
                  localStorage.setItem('conversationId', result.conversationId);
                  console.log(`${logPrefix} Updated localStorage with new conversationId`);
                }
              } catch (stringifyError) {
                console.error(`${logPrefix} Failed to stringify ${fnName} result:`, stringifyError);
                // Create a safe result without non-serializable data
                const safeResult = {
                  error: true,
                  message: `Function result couldn't be serialized: ${stringifyError instanceof Error ? stringifyError.message : String(stringifyError)}`,
                  partialResult: typeof result === 'object' ? Object.keys(result) : typeof result
                };
                outputJson = JSON.stringify(safeResult);
              }

              // Respond with function output
              console.log(`${logPrefix} === SENDING FUNCTION RESULT TO AI ===`);
              const response = {
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: callId,
                  output: outputJson,
                }
              };

              console.log(`${logPrefix} Sending function output payload: ${JSON.stringify(response, null, 2)}`);
              dataChannelRef.current?.send(JSON.stringify(response));
              console.log(`${logPrefix} Function ${fnName} result sent with call_id: ${callId}`);

              // Add function result confirmation detection
              const confirmationLogPrefix = `[FUNCTION-CONFIRMATION-${executionId}]`;
              const confirmationListener = (event: MessageEvent<any>) => {
                try {
                  const data = JSON.parse(event.data);
                  // Look for conversation.item.created events with type = function_call_output
                  if (data.type === "conversation.item.created" &&
                    data.item && data.item.type === "function_call_output" &&
                    data.item.call_id === callId) {
                    console.log(`${confirmationLogPrefix} Detected AI received function result for call_id: ${callId}`);
                    // Remove this listener once we've detected the confirmation
                    dataChannelRef.current?.removeEventListener('message', confirmationListener);
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              };

              // Add the temporary confirmation listener
              dataChannelRef.current?.addEventListener('message', confirmationListener);

              // Set a timeout to clean up the listener if we don't get confirmation
              setTimeout(() => {
                dataChannelRef.current?.removeEventListener('message', confirmationListener);
              }, 10000); // 10 second timeout

              // Special handling for end_session function
              if (fnName === 'end_session') {
                console.log(`${logPrefix} Skipping response.create for end_session function`);
                console.log(`${logPrefix} Function call process completed for ${fnName}`);
              }
              // Special handling for fetch_next_question - still need minimal response.create but without duplicated instructions
              else if (fnName === 'fetch_next_question' && result.ai_instructions) {
                console.log(`${logPrefix} Function ${fnName} includes AI instructions in its response`);
                console.log(`${logPrefix} Sending minimal response.create without duplicate instructions`);

                // Send minimal response.create to trigger AI response without instructions
                const responseCreate = {
                  type: "response.create"
                };

                // Delay to prevent race condition with previous message
                setTimeout(() => {
                  console.log(`${logPrefix} Queueing minimal response.create for fetch_next_question`);
                  console.log(`[FUNCTION-EXECUTION-${executionId}] About to send response.create for ${fnName}`);
                  queueResponseCreate(responseCreate, `function-${fnName}-minimal`);
                }, MESSAGE_SEQUENCE_DELAY_MS); // Using centralized delay constant

                console.log(`${logPrefix} Function call process completed for ${fnName}`);
              }
              // Special handling for query_book_content - provide explicit instructions instead of minimal response
              else if (fnName === 'query_book_content') {
                console.log(`${logPrefix} Function ${fnName} requires contextual response.create message`);

                // Send response.create with clear, explicit instructions to ensure proper AI behavior
                const responseCreate = {
                  type: "response.create",
                  response: {
                    instructions: "Using the book content that was just provided, answer the user's question or address their comment. Explain the information from the book in a helpful and conversational way. CRITICAL: After this response, STOP and WAIT for the user to respond. DO NOT call any other functions, especially fetch_next_question, until after the user has sent another message. Always wait for user input before proceeding.",
                    max_output_tokens: 2000
                  }
                };

                // Add function result confirmation detection
                const confirmationLogPrefix = `[FUNCTION-CONFIRMATION-${executionId}]`;
                const confirmationListener = (event: MessageEvent<any>) => {
                  try {
                    const data = JSON.parse(event.data);
                    // Look for conversation.item.created events with type = function_call_output
                    if (data.type === "conversation.item.created" &&
                      data.item && data.item.type === "function_call_output" &&
                      data.item.call_id === callId) {
                      console.log(`${confirmationLogPrefix} Detected AI received function result for call_id: ${callId}`);
                      // Remove this listener once we've detected the confirmation
                      dataChannelRef.current?.removeEventListener('message', confirmationListener);
                    }
                  } catch (e) {
                    // Ignore parse errors
                  }
                };

                // Add the temporary confirmation listener
                dataChannelRef.current?.addEventListener('message', confirmationListener);

                // Set a timeout to clean up the listener if we don't get confirmation
                setTimeout(() => {
                  dataChannelRef.current?.removeEventListener('message', confirmationListener);
                }, 10000); // 10 second timeout

                // Delay to prevent race condition with previous message
                setTimeout(() => {
                  console.log(`${logPrefix} Queueing contextual response.create for book content`);
                  console.log(`[FUNCTION-EXECUTION-${executionId}] About to send response.create for ${fnName}`);
                  queueResponseCreate(responseCreate, `function-${fnName}-contextual`);
                }, MESSAGE_SEQUENCE_DELAY_MS); // Using centralized delay constant

                console.log(`${logPrefix} Function call process completed for ${fnName}`);
              } else {
                // For all other functions, trigger AI to continue with default behavior
                const responseCreate = {
                  type: "response.create"
                };

                console.log(`${logPrefix} Queueing standard response.create message to trigger AI continuation`);
                console.log(`[FUNCTION-EXECUTION-${executionId}] About to send response.create for ${fnName}`);
                queueResponseCreate(responseCreate, `function-${fnName}-standard`);
                console.log(`${logPrefix} Function call and response process completed for ${fnName}`);
              }
              console.log(`${logPrefix} === FUNCTION EXECUTION COMPLETE ===`);
              
              // Emit event for function execution end
              if (typeof window !== 'undefined') {
                const event = new CustomEvent('function_execution_end', { 
                  detail: { functionName: fnName }
                });
                window.dispatchEvent(event);
              }

              // Mark function as complete in the tracker
              if (typeof window !== 'undefined' && window.__functionCallTracker) {
                window.__functionCallTracker.completeCall(fnName);
                console.log(`${logPrefix} Function ${fnName} marked as complete in tracker`);
              }
            } catch (error) {
              console.error(`${logPrefix} Error executing function ${fnName}:`, {
                error,
                stack: error instanceof Error ? error.stack : undefined,
                errorType: error instanceof Error ? error.constructor.name : typeof error
              });

              // Send error as function output
              console.log(`${logPrefix} === SENDING ERROR RESULT TO AI ===`);
              const errorResponse = {
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: callId,
                  output: JSON.stringify({
                    error: true,
                    message: `Error executing function: ${error instanceof Error ? error.message : String(error)}`
                  }),
                }
              };

              console.log(`${logPrefix} Sending error response payload: ${JSON.stringify(errorResponse, null, 2)}`);
              dataChannelRef.current?.send(JSON.stringify(errorResponse));

              // Trigger AI to handle the error
              const responseCreate = {
                type: "response.create"
              };

              console.log(`${logPrefix} Queueing response.create message after error`);
              queueResponseCreate(responseCreate, `function-${fnName}-error`);
              console.log(`${logPrefix} === FUNCTION ERROR HANDLING COMPLETE ===`);
              
              // Emit event for function execution end (even on error)
              if (typeof window !== 'undefined') {
                const event = new CustomEvent('function_execution_end', { 
                  detail: { functionName: fnName }
                });
                window.dispatchEvent(event);
              }

              // Mark function as complete in the tracker even on error
              if (typeof window !== 'undefined' && window.__functionCallTracker) {
                window.__functionCallTracker.completeCall(fnName);
                console.log(`${logPrefix} Function ${fnName} marked as complete in tracker (after error)`);
              }
            }
          } else {
            console.error(`${logPrefix} Function ${fnName} not registered`);

            // Send error as function output
            console.log(`${logPrefix} === SENDING UNREGISTERED FUNCTION ERROR TO AI ===`);
            const errorResponse = {
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({
                  error: true,
                  message: `Function ${fnName} not registered`
                }),
              }
            };

            console.log(`${logPrefix} Sending unregistered function error payload: ${JSON.stringify(errorResponse, null, 2)}`);
            dataChannelRef.current?.send(JSON.stringify(errorResponse));

            // Trigger AI to handle the error
            const responseCreate = {
              type: "response.create"
            };

            console.log(`${logPrefix} Queueing response.create message for unregistered function`);
            queueResponseCreate(responseCreate, `function-${fnName}-unregistered`);
            console.log(`${logPrefix} === UNREGISTERED FUNCTION HANDLING COMPLETE ===`);
            
            // Emit event for function execution end (even for unregistered)
            if (typeof window !== 'undefined') {
              const event = new CustomEvent('function_execution_end', { 
                detail: { functionName: fnName }
              });
              window.dispatchEvent(event);
            }

            // Mark function as complete in the tracker even for unregistered functions
            if (typeof window !== 'undefined' && window.__functionCallTracker) {
              window.__functionCallTracker.completeCall(fnName);
              console.log(`${logPrefix} Function ${fnName} marked as complete in tracker (unregistered)`);
            }
          }
          break;
        }

        case "session.created": {
          console.log("Session created successfully", msg);
          break;
        }

        case "output_audio_buffer.started": {
          console.log(`[AUDIO-STARTED-${msgId}] Audio playback started`);
          // Always clear completely when starting a new audio sequence
          legacyClearAudioQueue(true);
          break;
        }

        case "output_audio_buffer.stopped": {
          // Add diagnostics to see if audio completed before all audio data was received
          console.log(`[AUDIO-COMPLETE-${msgId}] Audio playback reported as completed`);
          console.log(`[AUDIO-COMPLETE-${msgId}] Audio service state: ${audioState.queueLength} chunks remaining, ${audioState.pendingChunksCount} chunks playing`);
          console.log(`[AUDIO-COMPLETE-${msgId}] Currently playing: ${audioState.isPlaying ? 'Yes' : 'No'}`);

          // CHANGED: Use audio service to handle stop signal
          handleStopSignal(msgId);

          // Keep the diagnostic logging for now
          if (window.__audioBufferTimings) {
            window.__audioBufferTimings.stopSignalTime = Date.now();
            window.__audioBufferTimings.stopSignalMsgId = msgId;

            // Calculate time since last buffer
            const timeSinceLastBuffer = window.__audioBufferTimings.stopSignalTime - window.__audioBufferTimings.lastBufferTime;
            console.log(`[AUDIO-STOP-TIMING-${msgId}] Stop signal received ${timeSinceLastBuffer}ms after last buffer`);

            // We still log premature stops for diagnostics, but the audio service
            // now handles the actual protection logic
            if (timeSinceLastBuffer < 300 && audioState.isPlaying) {
              console.warn(`[AUDIO-PREMATURE-STOP-${msgId}] Stop signal received only ${timeSinceLastBuffer}ms after last buffer while audio is still playing`);

              // Store premature stop signals for analysis
              if (!window.__prematureStopSignals) {
                window.__prematureStopSignals = [];
              }

              // Get response text once to avoid multiple calls
              const responseText = getCurrentResponseText();

              window.__prematureStopSignals.push({
                timestamp: window.__audioBufferTimings.stopSignalTime,
                msgId,
                timeSinceLastBuffer,
                queueLength: audioQueueRef.current.length,
                pendingChunks: pendingChunksRef.current.size,
                isPlaying: isPlayingRef.current,
                bufferCount: window.__audioBufferTimings.totalBuffers,
                responseText: responseText,
                responseLength: responseText.length
              });
            }
          }

          // Log completion event
          audioLogger.logCompletionEvent('output_stopped', audioQueueRef.current.length, isPlayingRef.current,
            `Audio playback reported as completed with ${audioQueueRef.current.length} chunks remaining`);

          // WebAI suggestion #2 - Mark that we've received the stop signal
          receivedStopSignalRef.current = true;

          // WebAI suggestion #2 - Set a completion verification timer
          if (audioCompletionTimerRef.current) {
            clearTimeout(audioCompletionTimerRef.current);
          }

          // WebAI suggestion #5 - Use device performance for grace period
          const graceDelay = devicePerformanceMetricsRef.current.isSlowDevice ? 5000 : 2000;

          // Allow extra time for all chunks to complete playback
          audioCompletionTimerRef.current = setTimeout(() => {
            const remainingChunks = pendingChunksRef.current.size + audioQueueRef.current.length;

            if (remainingChunks > 0) {
              console.warn(`[AUDIO-VERIFY-${msgId}] Still have ${remainingChunks} audio chunks after grace period - forcing completion`);
              finalizeAudioPlayback();
            }
          }, graceDelay);

          // Important: DON'T clear the queue immediately if we still have audio to play!
          if (audioQueueRef.current.length > 0 || pendingChunksRef.current.size > 0) {
            const totalRemainingChunks = audioQueueRef.current.length + pendingChunksRef.current.size;
            console.warn(`[AUDIO-COMPLETE-${msgId}] WARNING: Still have ${totalRemainingChunks} audio chunks to play but received stop signal!`);
            console.log(`[AUDIO-COMPLETE-${msgId}] Continuing playback of remaining chunks despite stop signal`);
            // Don't clear the queue, let playback continue with remaining data
            legacyClearAudioQueue(false); // Pass false to indicate we want to keep playing

            // Log this special case
            audioLogger.logCompletionEvent('continuing_after_stop', totalRemainingChunks, isPlayingRef.current,
              'Continuing playback of remaining chunks despite stop signal');
          } else {
            console.log(`[AUDIO-COMPLETE-${msgId}] Normal completion - no pending chunks, finalizing`);
            // Log normal completion
            audioLogger.logCompletionEvent('normal_completion', 0, isPlayingRef.current,
              'Normal completion - no pending chunks');
            // Ensure all resources are properly cleaned up
            finalizeAudioPlayback();
          }
          break;
        }

        case "output_audio_buffer.push": {
          if (msg.buffer) {
            try {
              // Store the timestamp when this buffer was received
              const bufferReceivedTime = Date.now();

              // Get buffer size for diagnostics
              const binaryString = atob(msg.buffer);
              const bufferSize = binaryString.length;

              // Create a unique ID for this audio chunk for complete lifecycle tracking
              const chunkId = `chunk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

              // We still maintain the enhanced chunk lifecycle tracking for diagnostics
              if (!window.__audioChunkLifecycle) {
                window.__audioChunkLifecycle = {};
              }

              // Record receipt time
              window.__audioChunkLifecycle[chunkId] = {
                received: Date.now(),
                size: bufferSize,
                status: 'received',
                msgId: msgId,
                bufferIndex: window.__audioBufferCount || 0
              };

              // Track buffer timings in window for debugging
              if (!window.__audioBufferTimings) {
                window.__audioBufferTimings = {
                  firstBufferTime: bufferReceivedTime,
                  lastBufferTime: bufferReceivedTime,
                  bufferIntervals: [],
                  totalBuffers: 0,
                  totalBufferSize: bufferSize,
                  bufferSizes: [bufferSize],
                  responseStartTime: state.responseStartTime || bufferReceivedTime,
                  // Calculate expected duration based on buffer size and sample rate
                  // 16-bit PCM, mono at 24kHz = 2 bytes per sample, 24000 samples per second
                  expectedTotalDuration: (bufferSize / 2 / 24000) * 1000 // in ms
                };
              } else {
                // Calculate interval from last buffer
                const interval = bufferReceivedTime - window.__audioBufferTimings.lastBufferTime;
                window.__audioBufferTimings.bufferIntervals.push(interval);
                window.__audioBufferTimings.lastBufferTime = bufferReceivedTime;

                // Track buffer sizes and expected duration
                window.__audioBufferTimings.totalBufferSize += bufferSize;
                window.__audioBufferTimings.bufferSizes.push(bufferSize);

                // Update expected duration
                const estimatedDurationMs = (bufferSize / 2 / 24000) * 1000;
                window.__audioBufferTimings.expectedTotalDuration += estimatedDurationMs;

                // Log significant buffers (every few buffers)
                if (window.__audioBufferTimings.totalBuffers % 5 === 0) {
                  console.log(`[AUDIO-BUFFER-STATS-${msgId}] Total received: ${window.__audioBufferTimings.totalBuffers + 1} buffers, ${window.__audioBufferTimings.totalBufferSize} bytes, expected duration: ${window.__audioBufferTimings.expectedTotalDuration.toFixed(0)}ms`);
                }
              }

              window.__audioBufferTimings.totalBuffers++;

              // If this is the first audio buffer in a new sequence, log it
              if (audioQueueRef.current.length === 0 && !isPlayingRef.current) {
                console.log(`[AUDIO-START-${msgId}] Receiving first audio buffer of new sequence at ${new Date(bufferReceivedTime).toISOString()}`);
                console.log(`[AUDIO-TIMING-${msgId}] Time since response start: ${bufferReceivedTime - window.__audioBufferTimings.responseStartTime}ms`);
                audioLogger.logCompletionEvent('audio_sequence_start', 0, false, 'Starting new audio sequence');

                // Enhanced logging for timing tracking
                audioLogger.logAudioBuffer(
                  msg.buffer.length,
                  'webrtc',
                  {
                    sampleRate: 24000,
                    expectedDuration: 0.1, // Placeholder until we calculate actual duration
                  }
                );
              }

              // Log each audio chunk
              audioLogger.logAudioChunk();

              // Count audio buffers with a global counter for debugging
              if (!window.__audioBufferCount) {
                window.__audioBufferCount = 0;
              }
              window.__audioBufferCount++;

              // Enhanced logging - log more frequently to detect timing issues
              if (window.__audioBufferCount % 3 === 0) {
                // Calculate average interval between buffers
                const intervals = window.__audioBufferTimings.bufferIntervals;
                const avgInterval = intervals.length > 0
                  ? intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
                  : 0;

                console.log(`[AUDIO-BUFFER-${msgId}] Processing buffer #${window.__audioBufferCount}, queue length: ${audioQueueRef.current.length}, avg interval: ${avgInterval.toFixed(2)}ms`);

                // Log if we detect unusual timing between buffers
                const lastInterval = intervals[intervals.length - 1];
                if (lastInterval > avgInterval * 2 && intervals.length > 5) {
                  console.warn(`[AUDIO-TIMING-ANOMALY-${msgId}] Unusual gap detected between buffers: ${lastInterval}ms (avg: ${avgInterval.toFixed(2)}ms)`);
                }
              }

              // Convert base64 to ArrayBuffer - reuse the binary string from earlier
              const bytes = new Uint8Array(bufferSize);
              for (let i = 0; i < bufferSize; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }

              // Estimate audio duration based on buffer size and sample rate (rough approximation)
              // 16-bit PCM, mono at 24kHz = 2 bytes per sample, 24000 samples per second
              const estimatedDurationMs = (bufferSize / 2 / 24000) * 1000;

              // Enhanced timing logging
              if (window.__audioBufferCount % 3 === 0 || estimatedDurationMs > 100) {
                console.log(`[AUDIO-DURATION-${msgId}] Buffer #${window.__audioBufferCount} size: ${bufferSize} bytes, ~${estimatedDurationMs.toFixed(2)}ms of audio`);
              }

              // CHANGED: Use audio service instead of internal queue for playback
              queueAudioData(bytes.buffer, chunkId, msgId);

              // If this is the first audio buffer of a message, register this as a new message
              if (!window.__hasStartedMessage || window.__lastMessageId !== msgId) {
                window.__hasStartedMessage = true;
                window.__lastMessageId = msgId;
                startNewMessage(msgId);
              }

              // Log the queue state after adding this buffer
              if (window.__audioBufferCount % 3 === 0) {
                const totalDuration = window.__audioBufferTimings.lastBufferTime - window.__audioBufferTimings.firstBufferTime;
                console.log(`[AUDIO-QUEUE-${msgId}] Audio service state: Queue length: ${audioState.queueLength}, playing: ${audioState.isPlaying}, total session: ${totalDuration}ms`);
              }

              // Logging is now handled by the audio service internally
            } catch (error) {
              console.error(`[AUDIO-ERROR-${msgId}] Error processing audio buffer:`, error);
            }
          } else {
            console.warn(`[AUDIO-WARNING-${msgId}] Received output_audio_buffer.push without buffer data`);
          }
          break;
        }

        case "response.cancel": {
          console.log(`[RESPONSE-CANCEL-${msgId}] Response cancelled by user or system`);
          // Always force stop on explicit cancel
          // CHANGED: Use audio service's force clear
          legacyClearAudioQueue(true); // Force clear because it's a user-initiated cancellation
          break;
        }

        case "response.done": {
          const prevThinkingState = isThinkingRef.current;
          console.log(`[RESPONSE-DONE-${msgId}] Final AI response completed, clearing thinking state (was: ${prevThinkingState})`);

          // Reset thinking state when the entire response is done
          isThinkingRef.current = false;

          // Track thinking state duration if we have a start time
          const thinkingEndTime = Date.now();
          const thinkingStartTime = (diagnosticData?.thinkingStartTime || 0);
          const thinkingDuration = thinkingStartTime ? thinkingEndTime - thinkingStartTime : null;

          if (thinkingDuration) {
            console.log(`[THINKING-STATE-${msgId}] Thinking state duration: ${thinkingDuration}ms, source: ${diagnosticData?.thinkingSource || 'unknown'}`);
          }

          // Log detailed state info for later debugging
          const currentOpenAIMessage = window.__lastMessageType || 'unknown';
          console.log(`[THINKING-STATE-RESET-${msgId}] Resetting thinking state from ${diagnosticData?.thinkingSource || 'unknown'} after response.done`);
          console.log(`[THINKING-STATE-RESET-${msgId}] Message flow: ${JSON.stringify({
            responseType: currentOpenAIMessage,
            prevThinking: prevThinkingState,
            thinkingDuration: thinkingDuration ? Math.round(thinkingDuration / 1000) + 's' : 'unknown',
            resetTime: new Date().toISOString()
          })}`);

          // Update global state tracker for debugging
          if (typeof window !== 'undefined') {
            window.__messageFlowState = {
              ...window.__messageFlowState,
              lastThinkingResetTime: thinkingEndTime,
              lastThinkingResetSource: "response.done",
              thinkingResetCount: (window.__messageFlowState?.thinkingResetCount || 0) + 1,
              lastResetDuration: thinkingDuration
            };
          }

          setDiagnosticData((prev: Record<string, any>) => ({
            ...prev,
            isThinking: false,
            thinkingEndTime: thinkingEndTime,
            lastThinkingDuration: thinkingDuration,
            thinkingStateTransitions: (prev.thinkingStateTransitions || 0) + 1,
            lastThinkingResetSource: "response.done"
          }));

          break;
        }

        case "error": {
          console.error(`[ERROR-SWITCH-${msgId}] WebRTC server error:`, msg);
          setErrorMessage(`WebRTC error: ${msg.message || "Unknown server error"}`);
          // Always force stop on errors
          legacyClearAudioQueue(true);
          break;
        }

        default: {
          // Unhandled message type
          break;
        }
      }

      return msg;
    } catch (error) {
      console.error("Error handling data channel message:", error);
    }
  }, [getOrCreateEphemeralUserId, updateEphemeralUserMessage, clearEphemeralUserMessage, legacyClearAudioQueue, playAudioData, saveMessageToSupabase, queueResponseCreate, getCurrentResponseText]);

  /**
   * Fetch ephemeral token from API endpoint
   */
  const getEphemeralToken = useCallback(async (config: SessionConfig) => {
    try {
      const response = await fetch("/api/v11/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`Failed to get ephemeral token: ${response.status}`);
      }

      const data = await response.json();
      return data.client_secret.value;
    } catch (err) {
      console.error("getEphemeralToken error:", err);
      throw err;
    }
  }, []);

  /**
   * Sets up a local audio visualization for mic input
   */
  const setupAudioVisualization = useCallback((stream: MediaStream) => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 256;
    source.connect(analyzer);

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    audioContextRef.current = audioContext;
  }, []);


  /**
   * Start a new session
   */
  const startSession = useCallback(async (config: SessionConfig) => {
    try {
      // Store the config for potential reconnects
      sessionConfigRef.current = config;

      // Reset error message
      setErrorMessage(null);

      // Reset hasSetupSession flag to ensure configuration happens
      hasSetupSessionRef.current = false;

      // Reset user interaction tracking
      userInteractedRef.current = false;

      setStatus("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      setupAudioVisualization(stream);

      setStatus("Fetching ephemeral token...");
      const ephemeralToken = await getEphemeralToken(config);

      setStatus("Establishing connection...");
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // Hidden <audio> element for inbound assistant TTS
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;

      // Inbound track => assistant's TTS
      pc.ontrack = (event) => {
        // Keep the audio element for backward compatibility
        // But we won't actually use it for playback - our buffer system will handle playback
        audioEl.srcObject = event.streams[0];

        // Note: We're not playing through the audio element directly anymore
        // Instead, we process the audio through our buffer system via output_audio_buffer.push events
        console.log("Track received - audio will be played through buffer system");

        // Create analyzer for volume visualization
        const audioCtx = new (window.AudioContext || window.AudioContext)();
        const src = audioCtx.createMediaStreamSource(event.streams[0]);
        const inboundAnalyzer = audioCtx.createAnalyser();
        inboundAnalyzer.fftSize = 256;
        src.connect(inboundAnalyzer);
        analyserRef.current = inboundAnalyzer;

        // Start volume monitoring (this is for visualization, actual audio comes from buffer)
        volumeIntervalRef.current = window.setInterval(() => {
          setCurrentVolume(getVolume());
        }, 100);
      };

      // Data channel for transcripts
      const dataChannel = pc.createDataChannel("oai");
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        console.log("Data channel open");
        configureDataChannel(dataChannel, config);
      };

      dataChannel.onmessage = handleDataChannelMessage;

      // Add local (mic) track
      const audioTrack = stream.getAudioTracks()[0];
      pc.addTrack(audioTrack, stream);

      // Apply mute state if needed
      if (isMuted && audioTrack) {
        audioTrack.enabled = false;
      }

      // Create offer & set local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send SDP offer to OpenAI Realtime
      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";
      const voice = config.voice || "alloy";

      const response = await fetch(`${baseUrl}?model=${model}&voice=${voice}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralToken}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch SDP answer: ${errorText}`);
      }

      // Set remote description
      const answerSdp = await response.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      // Update status
      setIsSessionActive(true);
      setStatus("Ready");

      // Update diagnostic data
      setDiagnosticData({
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        dataChannelState: dataChannel.readyState,
        sessionConfig: config,
        isThinking: isThinkingRef.current
      });
    } catch (err) {
      console.error("startSession error:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      setStatus(`Error: ${errorMsg}`);
      setErrorMessage(errorMsg);
      stopSession();
    }
  }, [setupAudioVisualization, getEphemeralToken, getVolume, handleDataChannelMessage, configureDataChannel, isMuted]);

  /**
   * Stop the session & cleanup
   */
  const stopSession = useCallback(() => {
    // Reference to track if we're in farewell sequence
    const isFarewellRef = { current: false };
    let audioCompletionPromise = null;

    // Create a Promise that resolves when all audio has finished playing
    function createAudioCompletionPromise() {
      return new Promise((resolve) => {
        // Keep track of whether audio is still playing
        const checkInterval = setInterval(() => {
          // CHANGED: Use audio service state instead of internal refs
          // If audio queue is empty and no audio is currently playing
          if (audioState.queueLength === 0 && !audioState.isPlaying) {
            clearInterval(checkInterval);
            // Add a small buffer time to ensure everything is processed
            setTimeout(resolve, 1000);
          }
        }, 100);

        // Safety timeout in case something goes wrong
        setTimeout(() => {
          console.log("Safety timeout in case something goes wrong reached, cleaning up session");
          // Log safety timeout event
          audioLogger.logCompletionEvent('safety_timeout', audioState.queueLength, audioState.isPlaying,
            `Safety timeout triggered after 8 seconds with ${audioState.queueLength} chunks remaining`);
          clearInterval(checkInterval);
          resolve();
        }, 8000); // Increased safety timeout
      });
    };

    // Function to handle actual cleanup after farewell is complete
    async function completeCleanup() {
      // Make sure we only clean up once
      if (!isFarewellRef.current) return;

      console.log("Waiting for all audio to complete playing...");

      // Wait for audio to complete if we have a promise
      if (audioCompletionPromise) {
        await audioCompletionPromise;
      }

      console.log("All audio completed, proceeding with cleanup");
      isFarewellRef.current = false;

      // Close data channel
      if (dataChannelRef.current) {
        dataChannelRef.current.close();
        dataChannelRef.current = null;
      }

      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // Close audio contexts
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // Close audio playback context
      if (audioContextForPlaybackRef.current) {
        audioContextForPlaybackRef.current.close();
        audioContextForPlaybackRef.current = null;
      }

      // CHANGED: We do NOT clear audio queue during cleanup
      // This is critical to prevent audio cutoffs during component unmounts
      // The audio service will continue playing outside React lifecycle
      console.log(`[CLEANUP] Skipping audio queue clearing during cleanup to prevent cutoffs`);

      // Stop audio tracks
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }

      // Clear volume interval
      if (volumeIntervalRef.current) {
        clearInterval(volumeIntervalRef.current);
        volumeIntervalRef.current = null;
      }

      // Reset all refs
      analyserRef.current = null;
      ephemeralUserMessageIdRef.current = null;
      hasSetupSessionRef.current = false;

      // Reset state
      setCurrentVolume(0);
      setIsSessionActive(false);
      setStatus("Session stopped");
      setRawMessages([]);
      setConversation([]);

      // Reset thinking state
      isThinkingRef.current = false;
      setDiagnosticData({
        isThinking: false
      });
    }

    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      // Start farewell sequence
      try {
        // Mark that we're in farewell sequence
        isFarewellRef.current = true;

        // Update UI status to indicate we're ending the session
        setStatus("Ending conversation...");

        const message = {
          type: "response.create",
          response: {
            modalities: ["text", "audio"],
            instructions: "Give a quick good-bye and end the conversation.",
            max_output_tokens: 2000
          }
        };
        dataChannelRef.current.send(JSON.stringify(message));
        console.log("Goodbye message sent");

        // Create the audio completion promise
        audioCompletionPromise = createAudioCompletionPromise();

        // Set up a listener for completion of audio
        const handleAudioComplete = (event: MessageEvent<any>) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "output_audio_buffer.stopped" && isFarewellRef.current) {
              console.log("Received farewell audio completion signal");

              // We still want to wait for the actual audio to finish playing
              // before cleaning up, which is handled by our promise

              // Remove this listener
              if (dataChannelRef.current) {
                dataChannelRef.current.removeEventListener('message', handleAudioComplete);
              }

              // Now proceed with cleanup
              completeCleanup();
            }
          } catch (err) {
            console.error("Error in farewell audio complete handler:", err);
          }
        };

        // Add listener for audio completion
        dataChannelRef.current.addEventListener('message', handleAudioComplete);

        // Safety timeout in case we don't get the audio completion event
        setTimeout(() => {
          if (isFarewellRef.current) {
            console.log("Farewell timeout reached, cleaning up session");
            completeCleanup();
          }
        }, 10000); // Extended to 10 seconds for better reliability

      } catch (e) {
        console.error("Error sending goodbye:", e);
        // If error in farewell, just do normal cleanup
        completeCleanup();
      }
    } else {
      // No open data channel, just do normal cleanup
      isFarewellRef.current = true; // Set this so completeCleanup will run
      completeCleanup();
    }
  }, [legacyClearAudioQueue]);

  /**
   * Toggle start/stop from a single button
   */
  const handleStartStopClick = useCallback(() => {
    if (isSessionActive) {
      stopSession();
    } else if (sessionConfigRef.current) {
      startSession(sessionConfigRef.current);
    } else {
      setErrorMessage("No session configuration available");
    }
  }, [isSessionActive, startSession, stopSession]);

  /**
   * Toggle microphone mute state
   */
  const toggleMute = useCallback(() => {
    if (audioStreamRef.current) {
      const tracks = audioStreamRef.current.getAudioTracks();
      if (tracks.length > 0) {
        const newMutedState = !isMuted;
        tracks[0].enabled = !newMutedState;
        setIsMuted(newMutedState);
        return newMutedState;
      }
    }
    return isMuted;
  }, [isMuted]);

  /**
   * Send a text message through the data channel
   */
  const sendTextMessage = useCallback((text: string) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== "open") {
      console.error("Data channel not ready");
      return;
    }

    // Mark that a user message is being sent to enable proper function calling
    onUserMessageReceived();

    const messageId = uuidv4();
    const msgId = Date.now().toString().slice(-6);
    const logPrefix = `[TEXT-MESSAGE-${msgId}]`;

    console.log(`${logPrefix} === SENDING USER TEXT MESSAGE ===`);
    console.log(`${logPrefix} Message ID: ${messageId}`);
    console.log(`${logPrefix} Text content: "${text}"`);
    console.log(`${logPrefix} Data channel state: ${dataChannelRef.current.readyState}`);
    console.log(`${logPrefix} Peer connection state: ${peerConnectionRef.current?.connectionState}`);
    console.log(`${logPrefix} ICE connection state: ${peerConnectionRef.current?.iceConnectionState}`);

    // Reset delta counter for next response cycle
    if (window.__aiDeltaTypeCounts) {
      window.__aiDeltaTypeCounts.string = 0;
      window.__aiDeltaTypeCounts.function = 0;
      window.__aiDeltaTypeCounts.other = 0;
    }

    // Set thinking state for text messages too
    isThinkingRef.current = true;
    setDiagnosticData((prev: Record<string, any>) => ({
      ...prev,
      isThinking: true
    }));

    // Starting timeout to detect lack of response
    const responseTimeoutId = setTimeout(() => {
      // If we're still thinking after 15 seconds, something might be wrong
      if (isThinkingRef.current) {
        console.error(`${logPrefix} WARNING: No response received within 15 seconds of sending message!`);
        console.error(`${logPrefix} Current connection states: datachannel=${dataChannelRef.current?.readyState}, peer=${peerConnectionRef.current?.connectionState}, ice=${peerConnectionRef.current?.iceConnectionState}`);
      }
    }, 15000);

    // Store timeout ID in window for cleanup if needed
    if (typeof window !== 'undefined') {
      window.__responseTimeoutId = responseTimeoutId;
    }

    // Check for function call trigger words
    const lowerText = text.toLowerCase();
    const nextQuestionKeywords = ['next question', 'another question', 'different question', 'move on', 'topic transition', 'change topic', 'what else', 'tell me more', 'switch', 'something else'];

    for (const keyword of nextQuestionKeywords) {
      if (lowerText.includes(keyword)) {
        console.log(`${logPrefix} DETECTED POTENTIAL "fetch_next_question" TRIGGER: "${keyword}" in user message`);
        break;
      }
    }

    // Check if message might be asking for book content
    if (lowerText.includes('what') || lowerText.includes('how') || lowerText.includes('why') ||
      lowerText.includes('when') || lowerText.includes('where') || lowerText.includes('who') ||
      lowerText.includes('character') || lowerText.includes('book') || lowerText.includes('explain')) {
      console.log(`${logPrefix} DETECTED POTENTIAL "query_book_content" TRIGGER: Question format or book-related terms found`);
    }

    // Add message to conversation immediately
    const newMessage: Conversation = {
      id: messageId,
      role: "user",
      text,
      timestamp: new Date().toISOString(),
      isFinal: true,
      status: "final",
    };

    setConversation((prev: Conversation[]) => [...prev, newMessage]);

    // Text messages are saved at this single point when sent manually
    saveMessageToSupabase(newMessage);

    // Make sure session is initialized first
    if (!hasSetupSessionRef.current && sessionConfigRef.current) {
      console.log(`${logPrefix} Session not initialized, sending system config first`);
      configureDataChannel(dataChannelRef.current, sessionConfigRef.current);
    }

    // Using the exact same message format as demo_webrtc
    const message = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: text,
          },
        ],
      },
    };

    const response = {
      type: "response.create"
    };

    try {
      // CRITICAL: Check if data channel is still open before sending
      if (dataChannelRef.current.readyState !== 'open') {
        console.error(`${logPrefix} ERROR: Data channel no longer open before sending! State: ${dataChannelRef.current.readyState}`);
        setErrorMessage('Connection lost. Please refresh the page and try again.');
        return;
      }

      // First message - should trigger transcription
      console.log(`${logPrefix} Sending message payload:`, JSON.stringify(message, null, 2));
      dataChannelRef.current.send(JSON.stringify(message));

      // Delay before sending response.create to prevent race conditions
      setTimeout(() => {
        try {
          // Double-check channel is still open
          if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
            console.log(`${logPrefix} Queueing response.create message`);
            // Use the queue system instead of sending directly
            queueResponseCreate(response, "text-message");

            // Start a 3-second timer to retry response.create if needed
            setTimeout(() => {
              if (isThinkingRef.current && dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
                console.warn(`${logPrefix} Still in thinking state after 3s - queuing another response.create`);
                // Use the queue system instead of sending directly
                queueResponseCreate(response, `${logPrefix}-retry`);
              }
            }, 3000);
          } else {
            console.error(`${logPrefix} ERROR: Data channel closed or null before sending response.create!`);
          }
        } catch (responseError) {
          console.error(`${logPrefix} Error sending response.create:`, responseError);
        }
      }, MESSAGE_SEQUENCE_DELAY_MS); // Using centralized delay constant

      console.log(`${logPrefix} === TEXT MESSAGE SENDING INITIATED ===`);
    } catch (error) {
      console.error(`${logPrefix} Error sending text message:`, error);
      setErrorMessage(`Failed to send message: ${error.message || 'Unknown error'}`);
    }
  }, [configureDataChannel, saveMessageToSupabase, queueResponseCreate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  // Update global state for bug reporting
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__webrtcState = {
        status,
        isSessionActive,
        errorMessage,
        conversationLength: conversation.length,
        isMuted,
        currentVolume,
        diagnosticSummary: diagnosticData
      };
    }
  }, [status, isSessionActive, errorMessage, conversation.length, isMuted, currentVolume, diagnosticData]);

  return {
    status,
    isSessionActive,
    errorMessage,
    conversation,
    registerFunction,
    startSession,
    stopSession,
    handleStartStopClick,
    sendTextMessage,
    isMuted,
    toggleMute,
    currentVolume,
    diagnosticData
  };
}

// Function is already exported with declaration on line 125 as 'export function useWebRTC()'
// Removed redundant export to fix duplicate export error