import React from 'react';
import { StatusBar, useColorScheme, View, StyleSheet } from 'react-native';
import 'react-native-gesture-handler';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import StackNavigator from './src/components/Navigation/StackNavigator';
import ErrorBoundary from './src/components/Common/ErrorBoundary';
import LoadingSpinner from './src/components/Common/LoadingSpinner';

function AppContent() {
  const { user, isLoading } = useAuth();
  const isDarkMode = useColorScheme() === 'dark';

  if (isLoading) {
    return (
      <LoadingSpinner 
        fullScreen 
        text="Initializing RiseTwice..." 
        size="large" 
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <StackNavigator isAuthenticated={!!user} />
    </View>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
