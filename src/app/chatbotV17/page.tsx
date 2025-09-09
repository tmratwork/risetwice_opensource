// src/app/chatbotV17/page.tsx
// V17 Eleven Labs Implementation - Exact copy of V16 structure with Eleven Labs backend

"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useElevenLabsStore } from '@/stores/elevenlabs-store';
import { useElevenLabsConversation } from '@/hooksV17/use-elevenlabs-conversation';
import { AudioOrbV15 } from './components/AudioOrbV15';
import { SignInDialog } from './components/SignInDialog';

export default function ChatBotV17Page() {
  const { user } = useAuth();
  const [isSignInDialogOpen, setIsSignInDialogOpen] = useState(false);
  const [userMessage, setUserMessage] = useState('');
  const conversationHistoryRef = useRef<HTMLDivElement>(null);
  const store = useElevenLabsStore();
  const {
    startSession,
    isConnected,
    setVolume,
    conversationInstance,
    isPreparing
  } = useElevenLabsConversation();

  // Handle conversation start after auth
  const handleLetsTalk = useCallback(async () => {
    console.log('[V17] Authenticated user ready to talk');
    try {
      // Create conversation if needed
      if (!store.conversationId) {
        await store.createConversation();
      }

      // Start Eleven Labs session with triage specialist
      await startSession('triage');
      console.log('[V17] ✅ Eleven Labs conversation started successfully');
    } catch (error) {
      console.error('[V17] ❌ Failed to start conversation:', error);
    }
  }, [store, startSession]);

  // Handle Let's Talk button click
  const handleLetsTalkClick = useCallback(() => {
    if (!user) {
      // User is not signed in - show sign-in dialog
      setIsSignInDialogOpen(true);
    } else {
      // User is signed in - start conversation
      console.log('[V17] Starting conversation for authenticated user');
      handleLetsTalk();
    }
  }, [user, handleLetsTalk]);

  // Handle text message input
  const handleInputChange = useCallback((value: string) => {
    setUserMessage(value);
  }, []);

  // Handle sending text message
  const handleSendMessage = useCallback(() => {
    if (!userMessage.trim() || !isConnected) return;

    console.log('[V17] 📤 Sending text message:', userMessage);

    // Add user message to conversation history
    const messageId = `v17-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    store.addMessage({
      id: messageId,
      role: 'user',
      text: userMessage.trim(),
      timestamp: new Date().toISOString(),
      isFinal: true,
      status: 'final',
    });

    // Send via ElevenLabs conversation instance (not conversation history)
    const messageText = userMessage.trim();
    
    // Try different method names based on SDK version
    if (conversationInstance) {
      console.log('[V17] 🔍 Available conversation methods:', Object.keys(conversationInstance));
      
      // Try sendUserMessage first (most likely)
      if (typeof conversationInstance.sendUserMessage === 'function') {
        console.log('[V17] ✅ Using sendUserMessage method');
        conversationInstance.sendUserMessage(messageText);
      }
      // Try sendMessage as fallback (with type assertion)
      else if (typeof (conversationInstance as unknown as { sendMessage?: (text: string) => void }).sendMessage === 'function') {
        console.log('[V17] ✅ Using sendMessage method');
        (conversationInstance as unknown as { sendMessage: (text: string) => void }).sendMessage(messageText);
      }
      // Try sendTextMessage as fallback (with type assertion)
      else if (typeof (conversationInstance as unknown as { sendTextMessage?: (text: string) => void }).sendTextMessage === 'function') {
        console.log('[V17] ✅ Using sendTextMessage method');
        (conversationInstance as unknown as { sendTextMessage: (text: string) => void }).sendTextMessage(messageText);
      }
      else {
        console.error('[V17] ❌ No suitable send method found on conversationInstance:', {
          availableMethods: Object.keys(conversationInstance),
          conversationInstance
        });
      }
    } else {
      console.error('[V17] ❌ conversationInstance not available - typed messages cannot reach AI');
    }

    // Clear input
    setUserMessage('');
  }, [userMessage, isConnected, store, conversationInstance]);

  // Handle mute controls
  const toggleMicrophone = useCallback(() => {
    const newMuteState = !store.isMuted;
    console.log(`[V17] 🎤 ${newMuteState ? 'MUTING' : 'UNMUTING'} microphone`);

    // Immediately update state
    store.setIsMuted(newMuteState);

    // Visual feedback for user
    if (newMuteState) {
      console.log('[V17] 🔇 MICROPHONE MUTED - AI should not hear new audio input');
    } else {
      console.log('[V17] 🎤 MICROPHONE UNMUTED - AI can now hear audio input');
    }

    // Double-check the mute state was updated
    setTimeout(() => {
      console.log('[V17] 🎤 Final mute state:', {
        storeIsMuted: store.isMuted,
        expectedState: newMuteState,
        stateMatches: store.isMuted === newMuteState
      });
    }, 100);
  }, [store]);

  const toggleAudioOutputMute = useCallback(() => {
    console.log('[V17] 🔊 Toggle speaker:', !store.isAudioOutputMuted);
    store.setIsAudioOutputMuted(!store.isAudioOutputMuted);
    // Also adjust volume
    if (setVolume) {
      setVolume(store.isAudioOutputMuted ? 1.0 : 0.0);
    }
  }, [store, setVolume]);

  // Auto-scroll conversation to bottom when new messages arrive
  useEffect(() => {
    if (conversationHistoryRef.current && store.conversationHistory.length > 0) {
      const scrollContainer = conversationHistoryRef.current;

      // Use requestAnimationFrame to ensure DOM has updated before scrolling
      requestAnimationFrame(() => {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      });
    }
  }, [store.conversationHistory]);

  return (
    <div className="chatbot-v16-wrapper">
      {/* Main container - exact copy from V16 structure */}
      {/* Main container - exact structure as V16 */}
      <div className="main-container">

        {/* Start button overlay - positioned as sibling to conversation-container, just like V16 */}
        {!isConnected && (
          <div className="start-button-overlay flex flex-col items-center">
            <button
              className="control-button primary large-button"
              aria-label="Start a new conversation with RiseTwice AI assistant"
              onClick={handleLetsTalkClick}
              disabled={isPreparing}
            >
              {isPreparing ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="button-text">Connecting...</span>
                </div>
              ) : (
                <span className="button-text">Let&apos;s Talk</span>
              )}
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

        {/* Conversation container - naturally fills available space */}
        <div className={`conversation-container ${!isConnected ? 'conversation-container-with-overlay' : ''}`} style={{ position: 'relative', zIndex: 1 }}>
          <div
            className="conversation-history"
            ref={conversationHistoryRef}
            role="log"
            aria-live="polite"
            aria-label="Conversation with AI assistant"
          >
            {/* Show messages when conversation history exists */}
            {store.conversationHistory.map((msg) => (
              <div
                key={msg.id}
                className={`message ${msg.role} ${!msg.isFinal ? 'animate-pulse' : ''}`}
                role="article"
                aria-label={`${msg.role === 'user' ? 'Your message' : 'AI assistant response'} at ${new Date(msg.timestamp).toLocaleTimeString()}`}
              >
                <div className="message-content">
                  <p className="message-text">{msg.text}</p>
                  {msg.status && msg.status !== 'final' && (
                    <div className="message-status">
                      <span className="status-indicator">{msg.status}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Show placeholder when connected but no messages yet */}
            {isConnected && store.conversationHistory.length === 0 && (
              <div className="conversation-placeholder">
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="relative w-12 h-12 mb-4">
                    <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-gray-600">Getting ready...</p>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Text input - only show when connected */}
        {isConnected && (
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }} className="input-container">
            <button
              type="button"
              onClick={toggleAudioOutputMute}
              className={`control-button ${store.isAudioOutputMuted ? 'muted' : ''}`}
              aria-label={store.isAudioOutputMuted ? "Unmute speakers" : "Mute speakers"}
              style={{
                padding: '8px',
                borderRadius: '50%',
                minWidth: '40px',
                height: '40px',
                backgroundColor: store.isAudioOutputMuted ? '#ef4444' : '#6b7280',
                color: 'white'
              }}
            >
              {store.isAudioOutputMuted ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.63 3.63c-.39.39-.39 1.02 0 1.41L7.29 8.7 7 9H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.54-.77 2.2-1.31l1.34 1.34c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zm-7-8c-.15 0-.29.01-.43.03l1.85 1.85c.56.18 1.02.56 1.34 1.05L17 7.3c-.63-.9-1.68-1.3-2.71-1.3z" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm7-.17v6.34L7.83 13H5v-2h2.83L10 8.83zM16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77z" />
                </svg>
              )}
            </button>

            <label htmlFor="message-input" className="sr-only">
              Type your message to RiseTwice AI
            </label>
            <input
              id="message-input"
              type="text"
              value={userMessage}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Type your message here..."
              className="text-input"
              disabled={!isConnected}
            />
            <button
              type="submit"
              className="control-button primary"
              disabled={!userMessage.trim() || !isConnected}
              aria-label="Send message"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        )}
      </div>

      {/* Microphone status live region for screen readers */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {isConnected && (store.isMuted ? 'Microphone muted' : 'Microphone unmuted - you can now speak')}
      </div>

      {/* Enhanced Audio visualizer with real-time volume data */}
      {isConnected && (
        <div
          className="visualization-container"
          role="button"
          aria-label="Microphone control - click to mute or unmute your microphone"
          aria-describedby="mic-description"
          onClick={toggleMicrophone}
        >
          <AudioOrbV15 isFunctionExecuting={false} />
          <div id="mic-description" className="sr-only">
            Microphone control button located in the center of the screen. Click to toggle your microphone on or off. Visual indicator shows blue animation when AI is speaking.
          </div>
        </div>
      )}

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