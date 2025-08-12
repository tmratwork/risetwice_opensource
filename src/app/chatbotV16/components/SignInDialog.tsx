'use client';

import { useAuth } from '@/contexts/auth-context';
import { Apple, Phone } from 'lucide-react';
import { useState } from 'react';
import PhoneAuth from '@/components/PhoneAuth';

interface SignInDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSignedIn?: () => void;
  onContinueWithoutSignIn?: () => void;
}

export function SignInDialog({ isOpen, onClose, onSignedIn, onContinueWithoutSignIn }: SignInDialogProps) {
  const { signInWithGoogle, signInWithApple } = useAuth();
  const [showPhoneAuth, setShowPhoneAuth] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await signInWithGoogle();
      onSignedIn?.();
      onClose();
    } catch (error) {
      console.error('Google sign in failed:', error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await signInWithApple();
      // Add a small delay to ensure auth state has time to update
      setTimeout(() => {
        onSignedIn?.();
        onClose();
      }, 100);
    } catch (error) {
      console.error('Apple sign in failed:', error);
      setIsSigningIn(false);
    }
  };

  const handlePhoneClick = () => {
    setShowPhoneAuth(true);
  };

  const handlePhoneAuthBack = () => {
    setShowPhoneAuth(false);
  };

  const handleContinueWithoutSignIn = () => {
    onContinueWithoutSignIn?.();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
      onClick={handleContinueWithoutSignIn}
    >
      <div 
        className="bg-white dark:bg-[#1a1a1b] border border-gray-200 dark:border-gray-700 rounded-lg max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {showPhoneAuth ? (
            <div>
              <button
                onClick={handlePhoneAuthBack}
                className="mb-4 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                ← Back to sign in options
              </button>
              <PhoneAuth 
                onBack={handlePhoneAuthBack} 
                onSignedIn={() => {
                  // Add a small delay to ensure auth state has time to update
                  setTimeout(() => {
                    onSignedIn?.();
                    onClose();
                  }, 100);
                }}
              />
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">
                  Sign in to get the full experience
                </h2>
                <div className="text-gray-600 dark:text-gray-300 space-y-3 text-left">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                      <span>Continue previous conversations where you left off</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                      <span>Get personalized support based on your conversation history</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                      <span>Access your conversation history, insights & bookmarks</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-orange-500 dark:text-orange-400 font-bold">⚠</span>
                      <span className="text-gray-700 dark:text-gray-400">
                        Without signing in, RiseTwice won&apos;t remember our previous conversations and can&apos;t provide personalized context.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="font-semibold text-lg">G</span>
                  <span>Continue with Google</span>
                </button>

                <button
                  onClick={handleAppleSignIn}
                  disabled={isSigningIn}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Apple size={20} />
                  <span>Continue with Apple</span>
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">OR</span>
                  <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                </div>

                <button
                  onClick={handlePhoneClick}
                  disabled={isSigningIn}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Phone size={20} />
                  <span>Continue with Phone</span>
                </button>
              </div>

              <div className="mt-6 text-center">
                <button
                  onClick={handleContinueWithoutSignIn}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                  disabled={isSigningIn}
                >
                  Continue without signing in
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  You can always sign in later to save your conversation history
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}