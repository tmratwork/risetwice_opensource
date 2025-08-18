import React, { useEffect } from 'react';
import { View, StyleSheet, Text, StatusBar } from 'react-native';
import ChatInterface from '../components/Chat/ChatInterface';

export default function MentalHealthScreen() {
  useEffect(() => {
    console.log('[MOBILE] Mental Health Screen mounted');
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mental Health Support</Text>
        <Text style={styles.subtitle}>Specialized AI support for mental wellness</Text>
      </View>
      
      {/* Chat Interface with mental health specialist */}
      <ChatInterface 
        specialist="mental_health" 
        mode="mental-health" 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    backgroundColor: '#f8fafc',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
});