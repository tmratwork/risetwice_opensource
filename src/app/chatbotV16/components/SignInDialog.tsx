'use client';

import { useAuth } from '@/contexts/auth-context';
import { Apple, Phone, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
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
  const [showBenefits, setShowBenefits] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  
  // Focus management refs
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedElement = useRef<HTMLElement | null>(null);

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
    console.log('[PHONE_AUTH_OVERLAY] SignInDialog phone button clicked');
    setShowPhoneAuth(true);
  };

  const handlePhoneAuthBack = () => {
    setShowPhoneAuth(false);
  };

  const handleContinueWithoutSignIn = () => {
    onContinueWithoutSignIn?.();
    onClose();
  };

  // Screen size detection
  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 640); // Tailwind's sm breakpoint
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  // Focus management and keyboard handling
  useEffect(() => {
    if (isOpen) {
      // Save currently focused element
      lastFocusedElement.current = document.activeElement as HTMLElement;

      // Add body class to prevent scrolling
      document.body.style.overflow = 'hidden';

      // Focus the dialog
      setTimeout(() => {
        dialogRef.current?.focus();
      }, 100);

      // Handle Escape key
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('keydown', handleEscape);

      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';

        // Restore focus when dialog closes
        if (lastFocusedElement.current) {
          lastFocusedElement.current.focus();
        }
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Debug logging
  console.log('[PHONE_AUTH_OVERLAY] SignInDialog rendering, isOpen:', isOpen, 'showPhoneAuth:', showPhoneAuth);

  // Direct render without portal - use extremely high z-index to ensure it's on top
  return (
    <>
      {/* Full screen overlay */}
      <div
        data-modal-overlay="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 2147483646, // Maximum safe z-index value (just below max int)
          pointerEvents: 'auto',
        }}
        onClick={handleContinueWithoutSignIn}
        aria-hidden="true"
      />
      {/* Modal content */}
      <div
        data-modal-container="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 2147483647, // Maximum z-index value
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          pointerEvents: 'none',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-dialog-title"
        aria-describedby="signin-dialog-description"
      >
        <div
          ref={dialogRef}
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative',
            pointerEvents: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
        >
        <div className="p-6">
          {showPhoneAuth ? (
            <div>
              <button
                onClick={handlePhoneAuthBack}
                className="mb-4 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                aria-label="Go back to sign in options"
              >
                <span aria-hidden="true">←</span> Back to sign in options
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
                <h2 id="signin-dialog-title" className="text-2xl font-bold text-gray-800 dark:text-white mb-3">
                  Sign in to get the full experience
                </h2>
                <div id="signin-dialog-description" className="sr-only">
                  Modal dialog for signing in to RiseTwice. Choose from Google, Apple, Phone, or continue without signing in. Press Escape to close.
                </div>
                
                {/* Show expandable benefits on small screens */}
                {isSmallScreen ? (
                  <div className="text-gray-600 dark:text-gray-300">
                    <button
                      onClick={() => setShowBenefits(!showBenefits)}
                      className="flex items-center gap-2 mx-auto mb-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                      aria-expanded={showBenefits}
                      aria-controls="benefits-content"
                    >
                      <span>What&apos;s the full experience?</span>
                      {showBenefits ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    
                    {showBenefits && (
                      <div id="benefits-content" className="text-left space-y-2 text-sm animate-in slide-in-from-top duration-200">
                        <h3 className="sr-only">Benefits of signing in:</h3>
                        <ul className="space-y-2" role="list">
                          <li className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 font-bold" aria-hidden="true">✓</span>
                            <span>Continue previous conversations where you left off</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 font-bold" aria-hidden="true">✓</span>
                            <span>Get personalized support based on your conversation history</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 font-bold" aria-hidden="true">✓</span>
                            <span>Access your conversation history, insights & bookmarks</span>
                          </li>
                        </ul>
                        <div className="flex items-start gap-2 mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg" role="note" aria-label="Important notice">
                          <span className="text-orange-500 dark:text-orange-400 font-bold" aria-hidden="true">⚠</span>
                          <span className="text-gray-700 dark:text-gray-400">
                            <strong>Note:</strong> Without signing in, RiseTwice won&apos;t remember our previous conversations and can&apos;t provide personalized context.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Show full benefits on larger screens */
                  <div className="text-gray-600 dark:text-gray-300 space-y-3 text-left">
                    <div className="space-y-2 text-sm">
                      <h3 className="sr-only">Benefits of signing in:</h3>
                      <ul className="space-y-2" role="list">
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 dark:text-green-400 font-bold" aria-hidden="true">✓</span>
                          <span>Continue previous conversations where you left off</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 dark:text-green-400 font-bold" aria-hidden="true">✓</span>
                          <span>Get personalized support based on your conversation history</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 dark:text-green-400 font-bold" aria-hidden="true">✓</span>
                          <span>Access your conversation history, insights & bookmarks</span>
                        </li>
                      </ul>
                      <div className="flex items-start gap-2 mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg" role="note" aria-label="Important notice">
                        <span className="text-orange-500 dark:text-orange-400 font-bold" aria-hidden="true">⚠</span>
                        <span className="text-gray-700 dark:text-gray-400">
                          <strong>Note:</strong> Without signing in, RiseTwice won&apos;t remember our previous conversations and can&apos;t provide personalized context.
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={isSigningIn ? 'Signing in with Google...' : 'Sign in with Google account'}
                >
                  <span className="font-semibold text-lg" aria-hidden="true">G</span>
                  <span>Continue with Google</span>
                </button>

                <button
                  onClick={handleAppleSignIn}
                  disabled={isSigningIn}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={isSigningIn ? 'Signing in with Apple...' : 'Sign in with Apple ID'}
                >
                  <Apple size={20} aria-hidden="true" />
                  <span>Continue with Apple</span>
                </button>

                <button
                  onClick={handlePhoneClick}
                  disabled={isSigningIn}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Sign in with phone number"
                >
                  <Phone size={20} aria-hidden="true" />
                  <span>Continue with Phone</span>
                </button>

                <div className="flex items-center gap-3" role="separator" aria-label="Or choose alternative sign in method">
                  <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600" aria-hidden="true"></div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">OR</span>
                  <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600" aria-hidden="true"></div>
                </div>
              </div>

              <div className="mt-6 text-center">
                <button
                  onClick={handleContinueWithoutSignIn}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                  disabled={isSigningIn}
                >
                  Continue without signing in
                </button>
              </div>
            </>
          )}
        </div>
        </div>
      </div>
    </>
  );
}