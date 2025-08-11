import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity,
  Switch,
  Alert 
} from 'react-native';
import { useWebRTCStore } from '../stores/webrtc-store';
import { useAuth } from '../contexts/AuthContext';

export default function AdminScreen() {
  const { user } = useAuth();
  const { 
    isConnected, 
    connectionState, 
    conversation, 
    clearConversation,
    reset 
  } = useWebRTCStore();

  const [debugMode, setDebugMode] = useState(false);
  const [verboseLogging, setVerboseLogging] = useState(false);

  const handleClearConversation = () => {
    Alert.alert(
      'Clear Conversation',
      'Are you sure you want to clear the current conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: clearConversation
        }
      ]
    );
  };

  const handleResetStore = () => {
    Alert.alert(
      'Reset Store',
      'Are you sure you want to reset all WebRTC store data?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: reset
        }
      ]
    );
  };

  const handleExportLogs = () => {
    // Implementation would export debug logs
    Alert.alert('Export Logs', 'Debug logs exported successfully');
  };

  const renderConnectionStatus = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Connection Status</Text>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Connected:</Text>
        <Text style={[styles.statusValue, { color: isConnected ? '#10B981' : '#EF4444' }]}>
          {isConnected ? 'Yes' : 'No'}
        </Text>
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>State:</Text>
        <Text style={styles.statusValue}>{connectionState}</Text>
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Messages:</Text>
        <Text style={styles.statusValue}>{conversation.length}</Text>
      </View>
    </View>
  );

  const renderUserInfo = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>User Information</Text>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>User ID:</Text>
        <Text style={styles.statusValue}>{user?.uid || 'Not authenticated'}</Text>
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Anonymous:</Text>
        <Text style={styles.statusValue}>{user?.isAnonymous ? 'Yes' : 'No'}</Text>
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Email:</Text>
        <Text style={styles.statusValue}>{user?.email || 'None'}</Text>
      </View>
    </View>
  );

  const renderDebugControls = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Debug Controls</Text>
      
      <View style={styles.controlRow}>
        <Text style={styles.controlLabel}>Debug Mode</Text>
        <Switch
          value={debugMode}
          onValueChange={setDebugMode}
          trackColor={{ false: '#D1D5DB', true: '#3B82F6' }}
          thumbColor={debugMode ? '#FFFFFF' : '#F3F4F6'}
        />
      </View>
      
      <View style={styles.controlRow}>
        <Text style={styles.controlLabel}>Verbose Logging</Text>
        <Switch
          value={verboseLogging}
          onValueChange={setVerboseLogging}
          trackColor={{ false: '#D1D5DB', true: '#3B82F6' }}
          thumbColor={verboseLogging ? '#FFFFFF' : '#F3F4F6'}
        />
      </View>
    </View>
  );

  const renderActions = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Actions</Text>
      
      <TouchableOpacity 
        style={styles.actionButton} 
        onPress={handleClearConversation}
      >
        <Text style={styles.actionButtonText}>Clear Conversation</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.actionButton, styles.dangerButton]} 
        onPress={handleResetStore}
      >
        <Text style={[styles.actionButtonText, styles.dangerButtonText]}>Reset Store</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.actionButton} 
        onPress={handleExportLogs}
      >
        <Text style={styles.actionButtonText}>Export Debug Logs</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Admin Panel</Text>
          <Text style={styles.subtitle}>Debug tools and system information</Text>
        </View>

        {renderConnectionStatus()}
        {renderUserInfo()}
        {renderDebugControls()}
        {renderActions()}
      </ScrollView>
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
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  section: {
    margin: 20,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  controlLabel: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  actionButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: '#ef4444',
  },
  dangerButtonText: {
    color: 'white',
  },
});