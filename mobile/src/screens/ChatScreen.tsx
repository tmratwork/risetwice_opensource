import React from 'react';
import ChatInterface from '../components/Chat/ChatInterface';

// Simplified mobile app - always defaults to mental health support
export default function ChatScreen() {
  return <ChatInterface specialist="mental_health" mode="mental-health" />;
}