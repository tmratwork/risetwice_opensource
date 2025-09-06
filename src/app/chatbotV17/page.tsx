// src/app/chatbotV17/page.tsx
// V17 Eleven Labs Implementation - Exact copy of V16 structure with Eleven Labs backend

"use client";

import React, { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useElevenLabsStore } from '@/stores/elevenlabs-store';
import { SignInDialog } from './components/SignInDialog';

export default function ChatBotV17Page() {
  const { user } = useAuth();
  const [isSignInDialogOpen, setIsSignInDialogOpen] = useState(false);
  const store = useElevenLabsStore();

  // Handle Let's Talk button click
  const handleLetsTalkClick = useCallback(() => {
    if (!user) {
      // User is not signed in - show sign-in dialog
      setIsSignInDialogOpen(true);
    } else {
      // User is signed in - start conversation
      console.log('[V17] Starting conversation for authenticated user');
      // TODO: Start Eleven Labs conversation
    }
  }, [user]);

  // Handle conversation start after auth
  const handleLetsTalk = useCallback(async () => {
    console.log('[V17] Authenticated user ready to talk');
    // TODO: Initialize Eleven Labs conversation
  }, []);

  return (
    <div className="chatbot-v16-wrapper">
      {/* Main container - exact copy from V16 structure */}
      {/* Main container - exact structure as V16 */}
      <div className="main-container">
        
        {/* Start button overlay - positioned as sibling to conversation-container, just like V16 */}
        {!store.isConnected && (
          <div className="start-button-overlay flex flex-col items-center">
            <button
              className="control-button primary large-button"
              aria-label="Start a new conversation with RiseTwice AI assistant"
              onClick={handleLetsTalkClick}
            >
              <span className="button-text">Let&apos;s Talk</span>
            </button>

            {/* Spacing between Let's Talk and other elements - exact copy from V16 */}
            <div className="mt-8"></div>

            {/* Terms of Service - exact copy from V16 */}
            <button
              onClick={() => {
                console.log('[V17] Terms of Service clicked');
              }}
              disabled={false}
              className="text-sm underline mt-6 cursor-pointer pointer-events-auto block"
              style={{ color: '#3b503c', pointerEvents: 'auto' }}
              onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#9dbbac'}
              onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#3b503c'}
            >
              By selecting &ldquo;Let&apos;s Talk&rdquo; to start your session, you agree to these Terms of Service. Select here for details.
            </button>
          </div>
        )}

        {/* Conversation container - always present like V16 */}
        <div className="conversation-container">
          <div className="conversation-scroll-area">
            {/* Conversation history - always present, provides the background */}
            <div className="conversation-history" role="log" aria-live="polite" aria-label="Conversation with AI assistant">
              {/* Messages - only show when connected */}
              {store.isConnected && store.conversationHistory.length === 0 && (
                <div className="conversation-placeholder">
                  <p>Start a conversation to see messages here.</p>
                </div>
              )}
              
              {store.isConnected && store.conversationHistory.map((message) => (
                <div key={message.id} className={`message message-${message.role}`}>
                  <div className="message-content">
                    <p className="message-text">{message.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sign In Dialog - exact copy from V16 */}
      <SignInDialog
        isOpen={isSignInDialogOpen}
        onClose={() => setIsSignInDialogOpen(false)}
        onSignedIn={() => {
          setIsSignInDialogOpen(false);
          handleLetsTalk();
        }}
        onContinueWithoutSignIn={() => {
          setIsSignInDialogOpen(false);
          handleLetsTalk();
        }}
      />
    </div>
  );
}