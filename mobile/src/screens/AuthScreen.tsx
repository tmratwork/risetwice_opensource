import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function AuthScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const { signInWithGoogle, signInWithPhone, continueWithoutAuth } = useAuth();

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      Alert.alert('Google Sign-In Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneSignIn = async () => {
    // For now, using a test phone number - in production you'd get this from user input
    const phoneNumber = '+1234567890'; // Replace with actual phone input
    setIsLoading(true);
    try {
      await signInWithPhone(phoneNumber);
      Alert.alert('Verification Sent', 'Check your phone for the verification code');
    } catch (error: any) {
      Alert.alert('Phone Sign-In Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueWithoutAuth = () => {
    console.log('User chose to continue without authentication');
    continueWithoutAuth();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>RiseTwice</Text>
        <Text style={styles.subtitle}>Therapeutic AI</Text>

        <TouchableOpacity
          style={[styles.button, styles.googleButton]}
          onPress={handleGoogleSignIn}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Signing in...' : 'Sign in with Google'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.phoneButton]}
          onPress={handlePhoneSignIn}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            Sign in with Phone
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.anonymousButton]}
          onPress={handleContinueWithoutAuth}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            Anonymous
          </Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          Sign in for enhanced features, or start chatting immediately
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#6b7280',
    marginBottom: 48,
    textAlign: 'center',
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 24,
    marginBottom: 16,
    minWidth: 250,
  },
  googleButton: {
    backgroundColor: '#4285f4', // Google blue
  },
  phoneButton: {
    backgroundColor: '#34d399', // Green for phone
  },
  anonymousButton: {
    backgroundColor: '#6b7280', // Gray for anonymous
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
});