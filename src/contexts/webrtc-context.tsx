"use client";

// webrtc-context.tsx - Industry standard pattern
// Based on real production WebRTC apps to solve render storm issues

import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { optimizedAudioLogger } from '@/hooksV16/audio/optimized-audio-logger';
import { ConnectionManager } from '@/hooksV16/webrtc/connection-manager';
import { ComprehensiveMessageHandler, type MessageHandlerCallbacks } from '@/hooksV16/webrtc/comprehensive-message-handler';
import { useBookFunctionsV16 } from '@/hooksV16/use-book-functions-v16';
import { useMentalHealthFunctionsV16 } from '@/hooksV16/use-mental-health-functions-v16';
import type { ConnectionConfig } from '@/hooksV16/types';

// Conversation message type
interface ConversationMessage {
  id: string;
  role: string;
  text: string;
  timestamp: string;
  isFinal: boolean;
  status?: "speaking" | "processing" | "final" | "thinking";
}

// Minimal React state - only for UI updates
interface WebRTCState {
  isConnected: boolean;
  connectionState: string;
}

// All heavy WebRTC data stays in refs (no re-renders)
interface WebRTCRefs {
  connectionManager: React.MutableRefObject<ConnectionManager | null>;
  messageHandler: React.MutableRefObject<ComprehensiveMessageHandler | null>;
  conversation: React.MutableRefObject<ConversationMessage[]>;
  hasActiveConversation: React.MutableRefObject<boolean>;
  userMessage: React.MutableRefObject<string>;
  ephemeralUserMessageId: React.MutableRefObject<string | null>;
}

interface WebRTCContextType {
  // Minimal reactive state for UI
  state: WebRTCState;
  
  // Non-reactive refs for WebRTC data
  refs: WebRTCRefs;
  
  // Stable functions that don't cause re-renders
  actions: {
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    sendMessage: (message: string) => boolean;
    addConversationMessage: (message: ConversationMessage) => void;
    updateUserMessage: (message: string) => void;
    clearUserMessage: () => void;
    forceUIReset: () => void;
  };
  
  // Event subscriptions
  onTranscript: (callback: (message: { id: string; data: string; metadata?: Record<string, unknown> }) => void) => () => void;
  onError: (callback: (error: Error) => void) => () => void;
}

const WebRTCContext = createContext<WebRTCContextType | null>(null);

// Industry standard: Use refs for WebRTC, minimal state for UI
export function WebRTCProvider({ 
  children, 
  config = {} 
}: { 
  children: React.ReactNode;
  config?: ConnectionConfig;
}) {
  // Debug context recreation
  const contextInstanceId = useRef(`context-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  console.log('🔧 WebRTC Provider render - Instance ID:', contextInstanceId.current);
  
  // Stabilize config to prevent useEffect re-runs
  const configRef = useRef(config);
  configRef.current = config;
  
  // MINIMAL React state - only what UI needs to re-render for
  const [state, setState] = useState<WebRTCState>({
    isConnected: false,
    connectionState: 'disconnected'
  });

  // ALL WebRTC data in refs - no re-renders
  const connectionManagerRef = useRef<ConnectionManager | null>(null);
  const messageHandlerRef = useRef<ComprehensiveMessageHandler | null>(null);
  const conversationRef = useRef<ConversationMessage[]>([]);
  const hasActiveConversationRef = useRef(false);
  const userMessageRef = useRef('');
  const ephemeralUserMessageIdRef = useRef<string | null>(null);

  // Function hooks (only used in callbacks, not as dependencies)
  const bookFunctions = useBookFunctionsV16();
  const mentalHealthFunctions = useMentalHealthFunctionsV16();

  // Stable refs object - doesn't change between renders
  const refs = useRef({
    connectionManager: connectionManagerRef,
    messageHandler: messageHandlerRef,
    conversation: conversationRef,
    hasActiveConversation: hasActiveConversationRef,
    userMessage: userMessageRef,
    ephemeralUserMessageId: ephemeralUserMessageIdRef
  }).current;

  // Transcript callback ref
  const transcriptCallbackRef = useRef<((message: { id: string; data: string; metadata?: Record<string, unknown> }) => void) | null>(null);
  const errorCallbackRef = useRef<((error: Error) => void) | null>(null);

  // Stable state setter ref to avoid callback recreation
  const setStateRef = useRef(setState);
  setStateRef.current = setState;

  // WebRTC event handlers - completely stable, no dependencies
  const handleConnectionStateChange = useRef((connectionState: string) => {
    const isConnected = connectionState === 'connected';
    
    console.log('🔍 WebRTC native state change:', connectionState);
    
    // Check for disconnect with conversation (using refs)
    if (!isConnected && hasActiveConversationRef.current) {
      console.log('🔄 DISCONNECT DETECTED - Resetting conversation');
      
      // Reset conversation immediately (no React state involved)
      conversationRef.current = [];
      hasActiveConversationRef.current = false;
      userMessageRef.current = '';
      ephemeralUserMessageIdRef.current = null;
      
      // Trigger UI reset via DOM event (industry pattern)
      window.dispatchEvent(new CustomEvent('webrtc-ui-reset'));
      
      optimizedAudioLogger.info('webrtc', 'disconnect_detected_conversation_reset', {
        connectionState,
        conversationCleared: true
      });
    }
    
    // Only update UI state (minimal re-render) - use ref to avoid callback recreation
    setStateRef.current(prev => ({ 
      ...prev, 
      isConnected, 
      connectionState 
    }));
  }).current;

  // Stable actions that don't change between renders
  const actions = useRef({
    connect: async (): Promise<void> => {
      if (!connectionManagerRef.current) {
        throw new Error('Connection manager not initialized');
      }

      optimizedAudioLogger.logUserAction('connect_requested', {
        currentState: state.connectionState
      });

      try {
        await connectionManagerRef.current.connect();
        optimizedAudioLogger.logUserAction('connect_succeeded');
      } catch (error) {
        optimizedAudioLogger.error('webrtc', 'connect_failed', error as Error);
        throw error;
      }
    },

    disconnect: async (): Promise<void> => {
      if (!connectionManagerRef.current) {
        return;
      }

      optimizedAudioLogger.logUserAction('disconnect_requested');

      try {
        await connectionManagerRef.current.disconnect();
        optimizedAudioLogger.logUserAction('disconnect_succeeded');
      } catch (error) {
        optimizedAudioLogger.error('webrtc', 'disconnect_failed', error as Error);
        throw error;
      }
    },

    sendMessage: (message: string): boolean => {
      if (!connectionManagerRef.current) {
        optimizedAudioLogger.error('webrtc', 'send_message_failed', new Error('Connection manager not initialized'));
        return false;
      }

      const success = connectionManagerRef.current.sendMessage(message);
      
      if (success) {
        // Mark that we have an active conversation
        hasActiveConversationRef.current = true;
      }
      
      return success;
    },

    addConversationMessage: (message: ConversationMessage): void => {
      // Add to ref (no re-render)
      conversationRef.current.push(message);
      hasActiveConversationRef.current = true;
      
      // Notify UI via custom event (industry pattern)
      window.dispatchEvent(new CustomEvent('webrtc-conversation-update', {
        detail: { 
          message, 
          conversation: [...conversationRef.current] 
        }
      }));
    },

    updateUserMessage: (message: string): void => {
      userMessageRef.current = message;
      
      // Notify UI via custom event
      window.dispatchEvent(new CustomEvent('webrtc-user-message-update', {
        detail: { message }
      }));
    },

    clearUserMessage: (): void => {
      userMessageRef.current = '';
      
      // Notify UI via custom event
      window.dispatchEvent(new CustomEvent('webrtc-user-message-update', {
        detail: { message: '' }
      }));
    },

    forceUIReset: (): void => {
      conversationRef.current = [];
      hasActiveConversationRef.current = false;
      userMessageRef.current = '';
      ephemeralUserMessageIdRef.current = null;
      
      window.dispatchEvent(new CustomEvent('webrtc-ui-reset'));
    }
  }).current;

  // Setup WebRTC native event listeners (industry standard)
  useEffect(() => {
    console.log('🔧 WebRTC Context: Setting up connection manager with config:', configRef.current);
    
    const connectionConfig: ConnectionConfig = {
      ...configRef.current,
      tools: [], // Functions will be registered in callbacks
      tool_choice: 'auto' as const
    };
    
    console.log('🔧 WebRTC Context: Final connection config:', connectionConfig);
    
    connectionManagerRef.current = new ConnectionManager(connectionConfig);

    // Subscribe to connection state changes
    const unsubscribeConnection = connectionManagerRef.current.onStateChange(handleConnectionStateChange);

    // Create comprehensive message handler with inline callbacks
    const messageCallbacks: MessageHandlerCallbacks = {
      onFunctionCall: async (msg: Record<string, unknown>) => {
        const functionName = msg.name as string;
        const callId = msg.call_id as string;
        const argumentsStr = msg.arguments as string;

        try {
          const parsedArgs = JSON.parse(argumentsStr);
          
          // Get functions from hooks (not as dependencies)
          const bookFunctionRegistry = bookFunctions.functionRegistry;
          const mentalHealthFunctionRegistry = mentalHealthFunctions.functionRegistry;
          const allFunctionRegistry = { ...bookFunctionRegistry, ...mentalHealthFunctionRegistry };

          const fn = allFunctionRegistry[functionName as keyof typeof allFunctionRegistry];
          if (fn) {
            const result = await fn(parsedArgs);
            
            // Send function result back
            if (connectionManagerRef.current) {
              const success = connectionManagerRef.current.sendFunctionResult(callId, result);
              if (success) {
                optimizedAudioLogger.info('function', 'function_result_sent', { functionName, callId });
              }
            }
          } else {
            optimizedAudioLogger.error('function', 'function_not_found', new Error(`Function ${functionName} not registered`));
          }

        } catch (error) {
          optimizedAudioLogger.error('function', 'function_call_failed', error as Error, { functionName, callId });
        }
      },
      
      onAudioTranscriptDelta: (msg: Record<string, unknown>) => {
        const delta = msg.delta as string;
        const responseId = msg.response_id as string || 'unknown';
        
        if (delta && transcriptCallbackRef.current) {
          transcriptCallbackRef.current({
            id: responseId,
            data: delta,
            metadata: { isTranscriptComplete: false }
          });
        }
      },
      
      onAudioTranscriptDone: (msg: Record<string, unknown>) => {
        const transcript = msg.transcript as string;
        const responseId = msg.response_id as string || 'unknown';
        
        if (transcript && transcriptCallbackRef.current) {
          transcriptCallbackRef.current({
            id: responseId,
            data: transcript,
            metadata: { isTranscriptComplete: true }
          });
        }
      },
      
      onAudioDelta: (msg: Record<string, unknown>) => {
        // Audio chunks handled by audio service
        const delta = msg.delta as string;
        const responseId = msg.response_id as string;
        
        if (delta && responseId) {
          // Audio playback will be handled by existing audio service
        }
      },
      
      onAudioDone: (msg: Record<string, unknown>) => {
        optimizedAudioLogger.info('webrtc', 'response_audio_done', msg);
      },
      
      onResponseDone: (msg: Record<string, unknown>) => {
        optimizedAudioLogger.info('webrtc', 'response_completed', { responseId: msg.response_id });
      },
      
      onError: (error: Error) => {
        optimizedAudioLogger.error('webrtc', 'comprehensive_handler_error', error);
        
        if (errorCallbackRef.current) {
          errorCallbackRef.current(error);
        }
      }
    };

    messageHandlerRef.current = new ComprehensiveMessageHandler(messageCallbacks);

    // Subscribe to connection messages
    const unsubscribeMessages = connectionManagerRef.current.onMessage(async (event) => {
      if (messageHandlerRef.current) {
        await messageHandlerRef.current.handleMessage(event);
      }
    });

    // Subscribe to connection errors
    const unsubscribeErrors = connectionManagerRef.current.onError((error) => {
      optimizedAudioLogger.error('webrtc', 'connection_error', error);
      
      if (errorCallbackRef.current) {
        errorCallbackRef.current(error);
      }
    });

    optimizedAudioLogger.info('webrtc', 'context_initialized', {
      version: 'v15-industry-pattern'
    });

    return () => {
      optimizedAudioLogger.info('webrtc', 'context_cleanup');
      
      unsubscribeConnection();
      unsubscribeMessages();
      unsubscribeErrors();

      if (connectionManagerRef.current?.getState() === 'connected') {
        connectionManagerRef.current.disconnect();
      }
    };
  }, []); // Empty deps - setup once

  // Stable subscription functions
  const onTranscript = useCallback((callback: (message: { id: string; data: string; metadata?: Record<string, unknown> }) => void) => {
    transcriptCallbackRef.current = callback;
    
    return () => {
      transcriptCallbackRef.current = null;
    };
  }, []);

  const onError = useCallback((callback: (error: Error) => void) => {
    errorCallbackRef.current = callback;
    
    return () => {
      errorCallbackRef.current = null;
    };
  }, []);

  return (
    <WebRTCContext.Provider value={{ state, refs, actions, onTranscript, onError }}>
      {children}
    </WebRTCContext.Provider>
  );
}

// Hook for components that need WebRTC state
export function useWebRTC() {
  const context = useContext(WebRTCContext);
  if (!context) {
    throw new Error('useWebRTC must be used within WebRTCProvider');
  }
  return context;
}

// Hook for components that need conversation state (industry pattern)
export function useConversation() {
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const { refs } = useWebRTC();

  useEffect(() => {
    // Get initial conversation from ref
    setConversation([...refs.conversation.current]);

    // Listen for updates via custom events (no React state cascade)
    const handleConversationUpdate = (event: CustomEvent) => {
      setConversation(event.detail.conversation);
    };

    const handleUIReset = () => {
      console.log('🔄 UI Reset triggered');
      setConversation([]);
    };

    window.addEventListener('webrtc-conversation-update', handleConversationUpdate as EventListener);
    window.addEventListener('webrtc-ui-reset', handleUIReset);

    return () => {
      window.removeEventListener('webrtc-conversation-update', handleConversationUpdate as EventListener);
      window.removeEventListener('webrtc-ui-reset', handleUIReset);
    };
  }, []); // Empty deps - setup once

  return conversation;
}

// Hook for user message state
export function useUserMessage() {
  const [userMessage, setUserMessage] = useState('');
  const { refs, actions } = useWebRTC();

  useEffect(() => {
    // Get initial message from ref
    setUserMessage(refs.userMessage.current);

    // Listen for updates via custom events
    const handleUserMessageUpdate = (event: CustomEvent) => {
      setUserMessage(event.detail.message);
    };

    const handleUIReset = () => {
      setUserMessage('');
    };

    window.addEventListener('webrtc-user-message-update', handleUserMessageUpdate as EventListener);
    window.addEventListener('webrtc-ui-reset', handleUIReset);

    return () => {
      window.removeEventListener('webrtc-user-message-update', handleUserMessageUpdate as EventListener);
      window.removeEventListener('webrtc-ui-reset', handleUIReset);
    };
  }, [refs]);

  const updateUserMessage = useCallback((message: string) => {
    actions.updateUserMessage(message);
  }, [actions]);

  const clearUserMessage = useCallback(() => {
    actions.clearUserMessage();
  }, [actions]);

  return { userMessage, updateUserMessage, clearUserMessage };
}