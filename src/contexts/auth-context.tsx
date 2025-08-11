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

        // Don't recreate if we already have a valid verifier
        if (recaptchaVerifier) {
            console.log('[AUTH] Recaptcha already initialized');
            return;
        }

        try {
            const verifier = new RecaptchaVerifier(auth, elementId, {
                size: 'invisible',
                callback: () => {
                    // reCAPTCHA solved, allow signInWithPhoneNumber
                    console.log('[AUTH] Recaptcha verification successful');
                },
                'error-callback': (error: Error) => {
                    console.error('[AUTH] Recaptcha error:', error);
                    setRecaptchaVerifier(null);
                }
            });
            setRecaptchaVerifier(verifier);
            console.log('[AUTH] Recaptcha initialized successfully');
        } catch (error) {
            console.error('Error setting up recaptcha:', error);
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
            // Don't clear the verifier here - it causes the internal error
            // Only reset if it's a specific recaptcha error
            const authError = error as { code?: string };
            if (authError?.code === 'auth/recaptcha-not-verified') {
                try {
                    recaptchaVerifier.clear();
                    setRecaptchaVerifier(null);
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
            await firebaseSignOut(auth);
        } catch (error) {
            console.error('Error signing out:', error);
        }
    }, [firebaseAvailable]);

    const contextValue = useMemo(() => ({
        user,
        loading,
        firebaseAvailable,
        signInWithGoogle,
        signInWithApple,
        signInWithPhone,
        verifyPhoneCode,
        setupRecaptcha,
        signOut
    }), [user, loading, firebaseAvailable, signInWithGoogle, signInWithApple, signInWithPhone, verifyPhoneCode, setupRecaptcha, signOut]);

    return (
        <AuthContext.Provider value={contextValue}>
            {!loading && children}
        </AuthContext.Provider>
    );
}