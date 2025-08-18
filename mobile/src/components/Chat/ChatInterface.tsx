import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useWebRTCStore } from '../../stores/webrtc-store';
import { useAuth } from '../../contexts/AuthContext';
import { useSupabaseFunctions } from '../../hooks/useSupabaseFunctions';
import ConversationHistory from './ConversationHistory';
import AudioOrbMobile from '../AudioOrb/AudioOrbMobile';
import { PermissionsManager } from '../../utils/permissions';

interface ChatInterfaceProps {
  specialist?: string;
  mode?: string;
}

export default function ChatInterface({ specialist, mode = 'general' }: ChatInterfaceProps) {
  const { user } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const {
    isConnected,
    connectionState,
    conversation,
    setTriageSession,
    connect,
    disconnect,
    startSession,
    loadGreeting,
    saveMessage,
  } = useWebRTCStore();

  // Re-enable useSupabaseFunctions with proper error handling
  let supabaseFunctions;
  try {
    console.log('ChatInterface: Attempting to load useSupabaseFunctions...');
    supabaseFunctions = useSupabaseFunctions();
    console.log('ChatInterface: ✅ useSupabaseFunctions loaded successfully');
  } catch (error) {
    console.error('ChatInterface: ❌ Failed to load useSupabaseFunctions:', error);
    // Provide safe fallback
    supabaseFunctions = {
      loadFunctionsForAI: async (aiType: string) => {
        console.log(`[MOBILE] Fallback: Loading functions for AI type: ${aiType}`);
        console.log(`[MOBILE] Fallback: Loaded 0 functions for ${aiType}`);
        return [];
      },
      functionRegistry: {},
      functionDefinitions: [],
      loading: false,
      error: 'Functions not available due to initialization error',
      clearError: () => {}
    };
  }

  const {
    loadFunctionsForAI,
    functionRegistry,
    functionDefinitions,
    loading: functionsLoading,
    error: functionsError,
  } = supabaseFunctions;

  useEffect(() => {
    initializeChat();
  }, [user, specialist]);

  // Load AI functions when specialist changes
  useEffect(() => {
    if (isInitialized && specialist) {
      loadAIFunctions(specialist);
    }
  }, [isInitialized, specialist]);

  const loadAIFunctions = async (aiType: string) => {
    console.log(`[MOBILE] Loading functions for AI type: ${aiType}`);
    
    try {
      const functions = await loadFunctionsForAI(aiType);
      console.log(`[MOBILE] Loaded ${functions.length} functions for ${aiType}`);
    } catch (error) {
      console.error(`[MOBILE] Error loading functions for ${aiType}:`, error);
      Alert.alert('Function Loading Error', 'Failed to load AI functions');
    }
  };

  const initializeChat = async () => {
    if (!user) return;

    try {
      // Check microphone permission
      const hasPermission = await PermissionsManager.checkMicrophonePermission();
      if (!hasPermission) {
        const granted = await PermissionsManager.requestMicrophonePermission();
        if (!granted) {
          PermissionsManager.showPermissionAlert();
          return;
        }
      }

      // Initialize triage session if specialist is specified
      if (specialist) {
        console.log(`[MOBILE] Setting up chat for specialist: ${specialist}`);
        
        setTriageSession({
          sessionId: `session_${Date.now()}`,
          currentSpecialist: specialist,
          conversationId: null,
          isHandoffPending: false,
        });
      }

      setIsInitialized(true);
    } catch (error) {
      console.error('[MOBILE] Error initializing chat:', error);
      Alert.alert('Initialization Error', 'Failed to initialize chat interface');
    }
  };

  const startChatSession = useCallback(async () => {
    if (isConnecting || isConnected) return;

    setIsConnecting(true);
    console.log(`[MOBILE] Starting chat session for mode: ${mode}, specialist: ${specialist}`);

    try {
      // Start session through WebRTC store - calls /api/v16/start-session
      const sessionResult = await startSession({
        userId: user?.uid || 'anonymous',
        specialistType: specialist || mode,
        sessionType: 'mobile_chat',
      });

      if (!sessionResult.success) {
        throw new Error(sessionResult.error || 'Failed to start session');
      }

      console.log(`[MOBILE] Session started successfully:`, sessionResult);

      // Load greeting for this specialist/mode
      await loadGreeting({
        specialistType: specialist || mode,
        userId: user?.uid || 'anonymous',
      });

      // Connect WebRTC with AI functions
      await connect({
        apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY || '',
        model: 'gpt-4o-realtime-preview-2024-10-01',
        voice: 'alloy',
        instructions: `You are a helpful assistant in ${specialist || mode} mode.`,
        functions: functionDefinitions,
      });

      console.log(`[MOBILE] Chat session fully initialized`);

    } catch (error) {
      console.error('[MOBILE] Error starting chat session:', error);
      Alert.alert('Connection Error', 'Failed to start chat session. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, isConnected, mode, specialist, user, functionDefinitions, startSession, loadGreeting, connect]);

  const handleSaveMessage = useCallback(async (message: {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: number;
  }) => {
    try {
      console.log(`[MOBILE] Saving message:`, message);
      
      await saveMessage({
        ...message,
        userId: user?.uid || 'anonymous',
        specialistType: specialist || mode,
        timestamp: message.timestamp || Date.now(),
      });
      
      console.log(`[MOBILE] Message saved successfully`);
    } catch (error) {
      console.error('[MOBILE] Error saving message:', error);
    }
  }, [user, specialist, mode, saveMessage]);

  // Auto-start session when initialized and functions loaded
  useEffect(() => {
    if (isInitialized && functionDefinitions.length > 0 && !isConnected && !isConnecting) {
      startChatSession();
    }
  }, [isInitialized, functionDefinitions.length, isConnected, isConnecting, startChatSession]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ConversationHistory />
        
        <View style={styles.audioOrbContainer}>
          <AudioOrbMobile size={140} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
  },
  audioOrbContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
});