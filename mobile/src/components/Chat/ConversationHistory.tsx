import React, { useRef, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useWebRTCStore } from '../../stores/webrtc-store';
import MessageBubble from './MessageBubble';

export default function ConversationHistory() {
  const conversation = useWebRTCStore(state => state.conversation);
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [conversation.length]);

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {conversation.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      
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
  },
  bottomSpacer: {
    height: 20,
  },
});