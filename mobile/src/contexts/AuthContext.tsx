import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import type { User } from '../types';

console.log('✅ React Native Firebase Auth imported successfully:', auth);
console.log('typeof auth:', typeof auth);
console.log('AuthContext.tsx loaded - about to export AuthProvider');

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithPhone: (phoneNumber: string) => Promise<void>;
  continueWithoutAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    console.log('AuthProvider: Initializing without required authentication');
    
    // Like your Next.js app - allow usage without authentication
    // Still monitor for Firebase auth changes, but don't require it
    const unsubscribe = auth().onAuthStateChanged((firebaseUser: FirebaseAuthTypes.User | null) => {
      console.log('Auth state changed:', firebaseUser ? 'User logged in' : 'No authenticated user');
      
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || undefined,
          displayName: firebaseUser.displayName || undefined,
          isAnonymous: firebaseUser.isAnonymous,
        });
        setIsAuthenticated(true);
      } else {
        setUser(null);
        // Don't require authentication - user can still use the app
      }
      setIsLoading(false);
    });

    return () => {
      console.log('AuthProvider: Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      if (user) {
        await auth().signOut();
        console.log('✅ Sign out successful');
      }
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
      console.error('❌ Sign out failed:', error);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      // Check if Google Sign-in is available
      if (!GoogleSignin) {
        throw new Error('Google Sign-in is not available. Please ensure the package is properly installed.');
      }

      // Check if your device supports Google Play
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      
      // Get the users ID token
      const userInfo = await GoogleSignin.signIn();
      
      // Create a Google credential with the token
      const googleCredential = auth.GoogleAuthProvider.credential(userInfo.data?.idToken);
      
      // Sign-in the user with the credential
      await auth().signInWithCredential(googleCredential);
      setIsAuthenticated(true);
      console.log('✅ Google sign-in successful');
    } catch (error) {
      console.error('❌ Google sign-in failed:', error);
      throw error;
    }
  };

  const signInWithApple = async () => {
    try {
      // Note: Apple Sign-In requires @invertase/react-native-apple-authentication
      // This is a placeholder - would need proper Apple Auth implementation
      console.log('Apple sign-in not yet implemented');
    } catch (error) {
      console.error('❌ Apple sign-in failed:', error);
      throw error;
    }
  };

  const signInWithPhone = async (phoneNumber: string) => {
    try {
      const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
      console.log('✅ Phone verification sent, confirmation:', confirmation);
      setIsAuthenticated(true);
      // Note: This returns confirmation for OTP verification
      return confirmation;
    } catch (error) {
      console.error('❌ Phone sign-in failed:', error);
      throw error;
    }
  };

  const continueWithoutAuth = () => {
    console.log('✅ Continuing without authentication (like Next.js app)');
    setIsAuthenticated(true); // Allow app usage without Firebase auth
    setIsLoading(false);
  };

  const value = {
    user,
    isLoading,
    isAuthenticated,
    signOut,
    signInWithGoogle,
    signInWithApple,
    signInWithPhone,
    continueWithoutAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}