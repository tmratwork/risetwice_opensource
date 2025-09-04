// /contexts/auth-context.tsx
import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
    User,
    GoogleAuthProvider,
    OAuthProvider,
    signInWithPopup,
    signOut as firebaseSignOut,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    ConfirmationResult
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

type AuthContextType = {
    user: User | null;
    loading: boolean;
    firebaseAvailable: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithApple: () => Promise<void>;
    signInWithPhone: (phoneNumber: string) => Promise<ConfirmationResult | undefined>;
    verifyPhoneCode: (confirmationResult: ConfirmationResult, code: string) => Promise<void>;
    setupRecaptcha: (elementId: string) => void;
    resetRecaptcha: () => void;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [firebaseAvailable, setFirebaseAvailable] = useState(true);
    const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);

    useEffect(() => {
        // V15 Firebase resilience: Handle Firebase service unavailability
        const initializeAuth = async () => {
            try {
                const unsubscribe = auth.onAuthStateChanged((user) => {
                    setUser(user);
                    setLoading(false);
                    setFirebaseAvailable(true);
                });

                return unsubscribe;
            } catch (error) {
                console.warn('[AUTH] Firebase services unavailable, enabling anonymous mode:', error);
                setUser(null);
                setLoading(false);
                setFirebaseAvailable(false);
                return () => { }; // Empty cleanup function
            }
        };

        const cleanup = initializeAuth();
        
        return () => {
            if (cleanup && typeof cleanup.then === 'function') {
                cleanup.then((unsubscribe) => {
                    if (unsubscribe) unsubscribe();
                });
            }
        };
    }, []);

    const signInWithGoogle = useCallback(async () => {
        if (!firebaseAvailable) {
            console.warn('[AUTH] Firebase unavailable - cannot sign in with Google');
            return;
        }
        
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error('Error signing in with Google:', error);
        }
    }, [firebaseAvailable]);

    const signInWithApple = useCallback(async () => {
        if (!firebaseAvailable) {
            console.warn('[AUTH] Firebase unavailable - cannot sign in with Apple');
            return;
        }
        
        const provider = new OAuthProvider('apple.com');
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error('Error signing in with Apple:', error);
        }
    }, [firebaseAvailable]);

    const setupRecaptcha = useCallback((elementId: string) => {
        if (!firebaseAvailable) {
            console.warn('[AUTH] Firebase unavailable - cannot setup recaptcha');
            return;
        }

        // Check if element exists before initializing
        const element = document.getElementById(elementId);
        if (!element) {
            console.warn('[AUTH] Recaptcha container element not found:', elementId);
            return;
        }

        // Clean up any existing verifier first
        if (recaptchaVerifier) {
            console.log('[AUTH] Cleaning up existing reCAPTCHA verifier before reinitializing');
            try {
                recaptchaVerifier.clear();
                setRecaptchaVerifier(null);
            } catch (clearError) {
                console.error('[AUTH] Error clearing existing verifier:', clearError);
                setRecaptchaVerifier(null);
            }
        }

        try {
            // Clear any existing recaptcha content in the container
            element.innerHTML = '';
            
            const verifier = new RecaptchaVerifier(auth, elementId, {
                size: 'invisible',
                callback: () => {
                    // reCAPTCHA solved, allow signInWithPhoneNumber
                    console.log('[AUTH] Recaptcha verification successful');
                },
                'error-callback': (error: Error) => {
                    console.error('[AUTH] Recaptcha error:', error);
                    // Clear the verifier and element content on error
                    setRecaptchaVerifier(null);
                    const errorElement = document.getElementById(elementId);
                    if (errorElement) {
                        errorElement.innerHTML = '';
                    }
                }
            });
            
            setRecaptchaVerifier(verifier);
            console.log('[AUTH] Recaptcha initialized successfully');
        } catch (error) {
            console.error('Error setting up recaptcha:', error);
            // Clear element content on setup error
            element.innerHTML = '';
            setRecaptchaVerifier(null);
        }
    }, [firebaseAvailable, recaptchaVerifier]);

    const signInWithPhone = useCallback(async (phoneNumber: string) => {
        if (!firebaseAvailable) {
            console.warn('[AUTH] Firebase unavailable - cannot sign in with phone');
            return undefined;
        }

        if (!recaptchaVerifier) {
            console.error('[AUTH] Recaptcha not initialized');
            return undefined;
        }

        try {
            console.log('[AUTH] Attempting to sign in with phone:', phoneNumber);
            const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
            console.log('[AUTH] SMS sent successfully');
            return confirmationResult;
        } catch (error) {
            console.error('Error signing in with phone:', error);
            // Handle recaptcha-related errors more gracefully
            const authError = error as { code?: string; message?: string };
            
            // Don't clear the container if the error mentions "client element has been removed"
            // This happens during the reCAPTCHA v2 fallback flow
            if (authError?.message?.includes('reCAPTCHA client element has been removed')) {
                console.log('[AUTH] reCAPTCHA element removal error - likely during fallback flow');
                throw error; // Re-throw without clearing
            }
            
            if (authError?.code === 'auth/recaptcha-not-verified' || 
                authError?.message?.includes('recaptcha') ||
                authError?.message?.includes('style')) {
                try {
                    if (recaptchaVerifier) {
                        recaptchaVerifier.clear();
                    }
                    setRecaptchaVerifier(null);
                    // Don't clear container innerHTML to avoid breaking reCAPTCHA v2 fallback
                    console.log('[AUTH] Recaptcha cleared due to error');
                } catch (clearError) {
                    console.error('Error clearing recaptcha:', clearError);
                }
            }
            throw error; // Re-throw the error so the UI can handle it
        }
    }, [firebaseAvailable, recaptchaVerifier]);

    const verifyPhoneCode = useCallback(async (confirmationResult: ConfirmationResult, code: string) => {
        if (!firebaseAvailable) {
            console.warn('[AUTH] Firebase unavailable - cannot verify phone code');
            return;
        }

        try {
            await confirmationResult.confirm(code);
        } catch (error) {
            console.error('Error verifying phone code:', error);
            throw error;
        }
    }, [firebaseAvailable]);

    const signOut = useCallback(async () => {
        if (!firebaseAvailable) {
            console.warn('[AUTH] Firebase unavailable - cannot sign out');
            return;
        }
        
        try {
            // Clean up reCAPTCHA verifier before signing out
            if (recaptchaVerifier) {
                try {
                    console.log('[AUTH] Cleaning up reCAPTCHA verifier during sign out');
                    recaptchaVerifier.clear();
                    setRecaptchaVerifier(null);
                    
                    // Clear the container element to ensure clean state
                    const element = document.getElementById('recaptcha-container');
                    if (element) {
                        element.innerHTML = '';
                    }
                } catch (clearError) {
                    console.error('[AUTH] Error clearing reCAPTCHA during sign out:', clearError);
                }
            }
            
            await firebaseSignOut(auth);
            console.log('[AUTH] Sign out completed successfully');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    }, [firebaseAvailable, recaptchaVerifier]);

    const resetRecaptcha = useCallback(() => {
        console.log('[AUTH] Manually resetting reCAPTCHA state');
        if (recaptchaVerifier) {
            try {
                recaptchaVerifier.clear();
            } catch (error) {
                console.error('[AUTH] Error clearing reCAPTCHA verifier:', error);
            }
        }
        setRecaptchaVerifier(null);
        
        // Clear the container element
        const element = document.getElementById('recaptcha-container');
        if (element) {
            element.innerHTML = '';
        }
    }, [recaptchaVerifier]);

    const contextValue = useMemo(() => ({
        user,
        loading,
        firebaseAvailable,
        signInWithGoogle,
        signInWithApple,
        signInWithPhone,
        verifyPhoneCode,
        setupRecaptcha,
        resetRecaptcha,
        signOut
    }), [user, loading, firebaseAvailable, signInWithGoogle, signInWithApple, signInWithPhone, verifyPhoneCode, setupRecaptcha, resetRecaptcha, signOut]);

    return (
        <AuthContext.Provider value={contextValue}>
            {!loading && children}
        </AuthContext.Provider>
    );
}