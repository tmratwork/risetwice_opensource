import React, { useRef, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { useWebRTCStore } from '../../stores/webrtc-store';
import { useAuth } from '../../contexts/AuthContext';
import MessageBubble from './MessageBubble';

export default function ConversationHistory() {
  const { user } = useAuth();
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  
  const {
    conversation,
    currentConversationId,
    addMessage,
    saveMessage,
  } = useWebRTCStore();
  
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (conversation.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [conversation.length]);

  // Load conversation history when conversation ID is available
  useEffect(() => {
    if (currentConversationId && !historyLoaded && user) {
      loadConversationHistory();
    }
  }, [currentConversationId, historyLoaded, user]);

  const loadConversationHistory = async () => {
    if (!currentConversationId || isLoadingHistory) return;

    console.log(`[MOBILE] Loading conversation history for: ${currentConversationId}`);
    setIsLoadingHistory(true);

    try {
      const response = await fetch(`http://localhost:3000/api/v16/conversation/${currentConversationId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log('[MOBILE] No existing conversation history found');
          setHistoryLoaded(true);
          return;
        }
        throw new Error(`Failed to load conversation: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[MOBILE] Loaded ${data.messages?.length || 0} messages from history`);

      // Add historical messages to conversation
      if (data.messages && Array.isArray(data.messages)) {
        data.messages.forEach((msg: any, index: number) => {
          addMessage({
            id: `history-${index}-${msg.timestamp}`,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            isHistorical: true,
          });
        });
      }

      setHistoryLoaded(true);
    } catch (error) {
      console.error('[MOBILE] Error loading conversation history:', error);
      // Don't throw error - allow conversation to continue without history
      setHistoryLoaded(true);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Auto-save new messages (non-historical ones)
  useEffect(() => {
    const newMessages = conversation.filter(msg => !msg.isHistorical);
    
    if (newMessages.length > 0 && user && historyLoaded) {
      const latestMessage = newMessages[newMessages.length - 1];
      
      // Only save if this message hasn't been saved yet
      if (!latestMessage.isSaved && currentConversationId) {
        saveNewMessage(latestMessage);
      }
    }
  }, [conversation, user, historyLoaded, currentConversationId]);

  const saveNewMessage = async (message: any) => {
    try {
      console.log(`[MOBILE] Auto-saving new message:`, message.content.slice(0, 50));
      
      await saveMessage({
        role: message.role,
        content: message.content,
        userId: user?.uid || 'anonymous',
        specialistType: 'mobile', // This should come from context
        timestamp: message.timestamp || Date.now(),
      });

      // Mark message as saved to prevent duplicate saves
      message.isSaved = true;
      console.log(`[MOBILE] Message saved successfully`);
    } catch (error) {
      console.error('[MOBILE] Error auto-saving message:', error);
    }
  };

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {isLoadingHistory && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading conversation history...</Text>
        </View>
      )}
      
      {conversation.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      
      {conversation.length === 0 && !isLoadingHistory && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Start a conversation by tapping the audio orb below</Text>
        </View>
      )}
      
      {/* Add some bottom spacing */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contentContainer: {
    paddingVertical: 16,
    flexGrow: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomSpacer: {
    height: 20,
  },
});