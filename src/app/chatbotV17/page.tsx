// src/app/chatbotV17/page.tsx
// V17 Eleven Labs Implementation - Minimal Version

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useElevenLabsStore } from '@/stores/elevenlabs-store';
import { useElevenLabsConversation } from '@/hooksV17/use-elevenlabs-conversation';

// V17 conditional logging
const logV17 = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
    console.log(`[V17] ${message}`, ...args);
  }
};

// V17 Conversation interface (for future use)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface V17Conversation {
  id: string;
  role: string;
  text: string;
  timestamp: string;
  isFinal: boolean;
  status?: "speaking" | "processing" | "final" | "thinking";
  specialist?: string;
}

export default function ChatBotV17Page() {
  const { user, loading: authLoading } = useAuth();
  
  // V17 Eleven Labs store and conversation hook
  const store = useElevenLabsStore();
  const elevenLabsConversation = useElevenLabsConversation();
  
  // Local UI state
  const [isInitialized, setIsInitialized] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Initialize V17 when component mounts
  useEffect(() => {
    const initializeV17 = async () => {
      if (authLoading) return;
      
      try {
        logV17('🚀 Initializing V17 Eleven Labs interface');
        
        // Create conversation if needed
        if (!store.conversationId) {
          await store.createConversation();
        }
        
        // Load triage prompt
        const response = await fetch('/api/v17/load-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promptType: 'triage' }),
        });
        
        if (response.ok) {
          const { prompt } = await response.json();
          logV17('✅ Triage prompt loaded', { promptLength: prompt.content?.length || 0 });
        }
        
        setIsInitialized(true);
        logV17('✅ V17 initialization complete');
        
      } catch (error) {
        logV17('❌ Failed to initialize V17', error);
        setErrorMessage('Failed to initialize V17 interface');
      }
    };

    initializeV17();
  }, [authLoading, store]);

  // Handle start conversation
  const handleStartConversation = useCallback(async () => {
    try {
      logV17('🎙️ Starting V17 conversation');
      setErrorMessage('');
      
      await elevenLabsConversation.startSession('triage');
      
      logV17('✅ V17 conversation started');
      
    } catch (error) {
      logV17('❌ Failed to start V17 conversation', error);
      setErrorMessage('Failed to start conversation');
    }
  }, [elevenLabsConversation]);

  // Handle end conversation
  const handleEndConversation = useCallback(async () => {
    try {
      logV17('🛑 Ending V17 conversation');
      
      await elevenLabsConversation.endSession();
      
      logV17('✅ V17 conversation ended');
      
    } catch (error) {
      logV17('❌ Failed to end V17 conversation', error);
      setErrorMessage('Failed to end conversation');
    }
  }, [elevenLabsConversation]);

  // Handle specialist handoff
  const handleSpecialistHandoff = useCallback(async (specialist: string, context: string) => {
    try {
      logV17('🔄 Starting specialist handoff', { specialist });
      
      await elevenLabsConversation.switchSpecialist(specialist, context);
      
      logV17('✅ Specialist handoff completed', { specialist });
      
    } catch (error) {
      logV17('❌ Specialist handoff failed', error);
      setErrorMessage('Failed to switch to specialist');
    }
  }, [elevenLabsConversation]);

  // Listen for specialist handoff events (like V16)
  useEffect(() => {
    const handleSpecialistHandoffEvent = (event: CustomEvent) => {
      logV17('📡 Received specialist handoff event', event.detail);
      
      const { specialist, context } = event.detail;
      if (specialist && context) {
        handleSpecialistHandoff(specialist, context);
      }
    };

    window.addEventListener('specialist_handoff', handleSpecialistHandoffEvent as EventListener);
    
    return () => {
      window.removeEventListener('specialist_handoff', handleSpecialistHandoffEvent as EventListener);
    };
  }, [handleSpecialistHandoff]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading V17...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">V17 Eleven Labs</h1>
          <p className="text-gray-600 mb-6">Please sign in to continue</p>
          <button 
            onClick={() => window.location.href = '/login'}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                RiseTwice V17 (Eleven Labs)
              </h1>
              <p className="text-sm text-gray-600">
                AI Mental Health Assistant - Experimental Eleven Labs Version
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                store.isConnected 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {store.isConnected ? 'Connected' : 'Disconnected'}
              </div>
              {store.triageSession?.currentSpecialist && (
                <div className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                  {store.triageSession.currentSpecialist} AI
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Error Display */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{errorMessage}</p>
            <button 
              onClick={() => setErrorMessage('')}
              className="mt-2 text-sm text-red-600 hover:text-red-800"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Connection Status */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">V17 Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Connection:</span>
              <div className={`font-medium ${
                store.connectionState === 'connected' ? 'text-green-600' : 
                store.connectionState === 'connecting' ? 'text-yellow-600' :
                store.connectionState === 'failed' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {store.connectionState}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Agent ID:</span>
              <div className="font-medium text-gray-800">
                {store.agentId ? store.agentId.substring(0, 8) + '...' : 'Not set'}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Conversation:</span>
              <div className="font-medium text-gray-800">
                {store.conversationId ? 'Active' : 'None'}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Speaking:</span>
              <div className={`font-medium ${
                elevenLabsConversation.isSpeaking ? 'text-blue-600' : 'text-gray-600'
              }`}>
                {elevenLabsConversation.isSpeaking ? 'Yes' : 'No'}
              </div>
            </div>
          </div>
        </div>

        {/* Conversation History */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Conversation</h2>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {store.conversationHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No conversation history yet. Start a conversation to see messages here.
              </p>
            ) : (
              store.conversationHistory.map((message) => (
                <div
                  key={message.id}
                  className={`p-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-50 ml-8'
                      : 'bg-gray-50 mr-8'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${
                      message.role === 'user' ? 'text-blue-700' : 'text-gray-700'
                    }`}>
                      {message.role === 'user' ? 'You' : `AI${message.specialist ? ` (${message.specialist})` : ''}`}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-gray-800">{message.text}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Controls</h2>
          <div className="flex flex-wrap gap-4">
            {!store.isConnected ? (
              <button
                onClick={handleStartConversation}
                disabled={!isInitialized || elevenLabsConversation.isPreparing}
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {elevenLabsConversation.isPreparing ? 'Starting...' : 'Start Conversation'}
              </button>
            ) : (
              <button
                onClick={handleEndConversation}
                className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                End Conversation
              </button>
            )}
            
            {store.isConnected && (
              <>
                <button
                  onClick={() => handleSpecialistHandoff('anxiety', 'User requested anxiety specialist')}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                >
                  Switch to Anxiety Specialist
                </button>
                <button
                  onClick={() => handleSpecialistHandoff('depression', 'User requested depression specialist')}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                >
                  Switch to Depression Specialist
                </button>
              </>
            )}
          </div>

          {/* Volume Control */}
          {store.isConnected && (
            <div className="mt-4 pt-4 border-t">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Volume: {Math.round(store.currentVolume * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={store.currentVolume}
                onChange={(e) => elevenLabsConversation.setVolume(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          )}
        </div>

        {/* Debug Info */}
        {process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true' && (
          <div className="mt-6 bg-gray-100 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Debug Info</h3>
            <pre className="text-xs text-gray-600 overflow-x-auto">
              {JSON.stringify({
                connectionState: store.connectionState,
                isConnected: store.isConnected,
                agentId: store.agentId,
                conversationId: store.conversationId,
                triageSession: store.triageSession,
                messageCount: store.conversationHistory.length,
              }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}