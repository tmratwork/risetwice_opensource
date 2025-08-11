import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert 
} from 'react-native';
import { useUserMemory } from '../hooks/useUserMemory';
import { useAuth } from '../contexts/AuthContext';

export default function MemoryScreen() {
  const { user } = useAuth();
  const { memory, loading, error, loadUserMemory } = useUserMemory();

  const handleRefreshMemory = () => {
    loadUserMemory();
  };

  const handleClearMemory = () => {
    Alert.alert(
      'Clear Memory',
      'Are you sure you want to clear all user memory? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: () => {
            // Implementation would clear memory
            console.log('Memory cleared');
          }
        }
      ]
    );
  };

  const renderMemoryContent = () => {
    if (!memory?.memory_content) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No memory data available</Text>
          <Text style={styles.emptySubtext}>
            Start conversations to build your AI memory profile
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.memoryContent}>
        {Object.entries(memory.memory_content).map(([key, value]) => (
          <View key={key} style={styles.memoryItem}>
            <Text style={styles.memoryKey}>{key}</Text>
            <Text style={styles.memoryValue}>
              {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Memory Management</Text>
        <Text style={styles.subtitle}>
          Your AI conversation memory and profile
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading memory...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Error: {error}</Text>
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={handleRefreshMemory}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          renderMemoryContent()
        )}

        {memory && (
          <View style={styles.memoryInfo}>
            <Text style={styles.infoText}>
              Last updated: {new Date(memory.last_updated).toLocaleString()}
            </Text>
            <Text style={styles.infoText}>
              User ID: {user?.uid}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={handleRefreshMemory}
          disabled={loading}
        >
          <Text style={styles.refreshButtonText}>Refresh Memory</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.clearButton} 
          onPress={handleClearMemory}
          disabled={loading}
        >
          <Text style={styles.clearButtonText}>Clear Memory</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
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
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  memoryContent: {
    marginBottom: 20,
  },
  memoryItem: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  memoryKey: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  memoryValue: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  memoryInfo: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  refreshButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});