import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useWebRTCStore } from '../../stores/webrtc-store';
import { useAuth } from '../../contexts/AuthContext';
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
  
  const {
    isConnected,
    connectionState,
    conversation,
    setTriageSession,
  } = useWebRTCStore();

  useEffect(() => {
    initializeChat();
  }, [user, specialist]);

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
        setTriageSession({
          sessionId: `session_${Date.now()}`,
          currentSpecialist: specialist,
          conversationId: null,
          isHandoffPending: false,
        });
      }

      setIsInitialized(true);
    } catch (error) {
      console.error('Error initializing chat:', error);
      Alert.alert('Initialization Error', 'Failed to initialize chat interface');
    }
  };

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