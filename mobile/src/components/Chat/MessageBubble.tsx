import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ConversationMessage } from '../../types';

interface MessageBubbleProps {
  message: ConversationMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isThinking = message.status === 'thinking';
  const isProcessing = message.status === 'processing';
  
  // Ensure text is always a string to prevent React render errors
  const safeText = typeof message.text === 'string' 
    ? message.text 
    : JSON.stringify(message.text);

  return (
    <View style={[
      styles.container,
      isUser ? styles.userContainer : styles.assistantContainer
    ]}>
      <View style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.assistantBubble,
        (isThinking || isProcessing) && styles.processingBubble
      ]}>
        <Text style={[
          styles.text,
          isUser ? styles.userText : styles.assistantText
        ]}>
          {isThinking ? 'Thinking...' : 
           isProcessing ? 'Processing...' : 
           safeText}
        </Text>
        
        {message.specialist && (
          <Text style={styles.specialistTag}>
            {message.specialist}
          </Text>
        )}
      </View>
      
      <Text style={styles.timestamp}>
        {new Date(message.timestamp).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 4,
  },
  userBubble: {
    backgroundColor: '#3b82f6',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#f3f4f6',
    borderBottomLeftRadius: 4,
  },
  processingBubble: {
    opacity: 0.7,
  },
  text: {
    fontSize: 16,
    lineHeight: 20,
  },
  userText: {
    color: 'white',
  },
  assistantText: {
    color: '#1f2937',
  },
  specialistTag: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#9ca3af',
  },
});