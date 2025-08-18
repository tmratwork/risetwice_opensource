import './global.css';
import React, { useEffect } from 'react';
import { StatusBar, useColorScheme, View, StyleSheet } from 'react-native';
import 'react-native-gesture-handler';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '@env';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import StackNavigator from './src/components/Navigation/StackNavigator';
import ErrorBoundary from './src/components/Common/ErrorBoundary';
import LoadingSpinner from './src/components/Common/LoadingSpinner';

function AppContent() {
  const { user, isLoading, isAuthenticated } = useAuth();
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
      <StackNavigator isAuthenticated={isAuthenticated} />
    </View>
  );
}

function App() {
  useEffect(() => {
    // Configure Google Sign-In
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID, // From environment variables
      offlineAccess: true, // If you want to access Google API on behalf of the user FROM YOUR SERVER
    });
    console.log('✅ Google Sign-In configured');
  }, []);

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
