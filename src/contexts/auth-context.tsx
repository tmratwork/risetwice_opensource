// /contexts/auth-context.tsx
import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
    User,
    GoogleAuthProvider,
    OAuthProvider,
    signInWithPopup,
    signOut as firebaseSignOut
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

type AuthContextType = {
    user: User | null;
    loading: boolean;
    firebaseAvailable: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithApple: () => Promise<void>;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [firebaseAvailable, setFirebaseAvailable] = useState(true);

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
        signOut
    }), [user, loading, firebaseAvailable, signInWithGoogle, signInWithApple, signOut]);

    return (
        <AuthContext.Provider value={contextValue}>
            {!loading && children}
        </AuthContext.Provider>
    );
}