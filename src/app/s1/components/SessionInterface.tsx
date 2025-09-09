// src/app/s1/components/SessionInterface.tsx

"use client";

import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';

interface Message {
  id: string;
  role: 'therapist' | 'ai_patient';
  content: string;
  timestamp_in_session: string;
  emotional_tone?: string;
  therapeutic_techniques?: Record<string, boolean>;
  ai_response_reasoning?: string;
  created_at: string;
}

interface SessionData {
  id: string;
  ai_patient_id: string;
  started_at: string;
  s1_ai_patients: {
    name: string;
    primary_concern: string;
    personality_traits: Record<string, any>;
    background_story?: string;
  };
}

interface Props {
  user: User;
  sessionId: string;
  onSessionEnd: () => void;
}

const SessionInterface: React.FC<Props> = ({ user, sessionId, onSessionEnd }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [currentMessage, setCurrentMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionTimer, setSessionTimer] = useState(0);
  
  // Session ending states
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [therapistNotes, setTherapistNotes] = useState('');
  const [allianceScore, setAllianceScore] = useState<number>(5);
  const [techniqueScore, setTechniqueScore] = useState<number>(5);
  const [ending, setEnding] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchSessionData();
    fetchMessages();
    startTimer();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setSessionTimer(prev => prev + 1);
    }, 1000);
  };

  const fetchSessionData = async () => {
    try {
      const response = await fetch(`/api/s1/therapy-sessions?session_id=${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.sessions && data.sessions.length > 0) {
          setSessionData(data.sessions[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching session data:', error);
      setError('Failed to load session data');
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/s1/therapy-sessions/messages?session_id=${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!currentMessage.trim() || sending) return;

    setSending(true);
    setError(null);

    try {
      // Send therapist message
      const therapistResponse = await fetch('/api/s1/therapy-sessions/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({
          session_id: sessionId,
          role: 'therapist',
          content: currentMessage
        })
      });

      if (!therapistResponse.ok) {
        throw new Error('Failed to send message');
      }

      const { message: therapistMessage } = await therapistResponse.json();
      setMessages(prev => [...prev, therapistMessage]);
      setCurrentMessage('');

      // Generate AI patient response
      const aiResponse = await fetch('/api/s1/therapy-sessions/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({
          session_id: sessionId,
          role: 'ai_patient',
          content: '[GENERATE_RESPONSE]'
        })
      });

      if (aiResponse.ok) {
        const { message: aiMessage } = await aiResponse.json();
        setMessages(prev => [...prev, aiMessage]);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const endSession = async () => {
    setEnding(true);
    setError(null);

    try {
      const response = await fetch('/api/s1/therapy-sessions/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({
          session_id: sessionId,
          therapist_notes: therapistNotes,
          therapeutic_alliance_score: allianceScore,
          technique_effectiveness_score: techniqueScore
        })
      });

      if (!response.ok) {
        throw new Error('Failed to end session');
      }

      const { session, case_study_ready } = await response.json();
      
      // Show success message
      alert(case_study_ready 
        ? 'Session completed successfully! Case study has been generated.'
        : 'Session completed successfully!'
      );

      onSessionEnd();

    } catch (error) {
      console.error('Error ending session:', error);
      setError('Failed to end session');
    } finally {
      setEnding(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Session Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-medium">
                {sessionData?.s1_ai_patients.name?.[0] || 'P'}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">
                {sessionData?.s1_ai_patients.name || 'AI Patient'}
              </h2>
              <p className="text-sm text-gray-500 capitalize">
                {sessionData?.s1_ai_patients.primary_concern?.replace('_', ' ') || 'Session'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">
                {formatTime(sessionTimer)}
              </div>
              <div className="text-xs text-gray-500">Session Time</div>
            </div>
            
            <button
              onClick={() => setShowEndDialog(true)}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm"
            >
              End Session
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-6 mt-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'therapist' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                message.role === 'therapist'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-900 shadow-sm border'
              }`}
            >
              <p className="text-sm">{message.content}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs opacity-75">
                  {message.timestamp_in_session}
                </span>
                {message.emotional_tone && (
                  <span className="text-xs opacity-75 capitalize">
                    {message.emotional_tone}
                  </span>
                )}
              </div>
              
              {/* Show AI reasoning for debugging */}
              {message.ai_response_reasoning && process.env.NODE_ENV === 'development' && (
                <div className="mt-2 text-xs opacity-60 border-t pt-2">
                  Reasoning: {message.ai_response_reasoning}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your therapeutic response..."
              disabled={sending}
              className="w-full px-3 py-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              rows={2}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!currentMessage.trim() || sending}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>

      {/* End Session Dialog */}
      {showEndDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">End Session</h3>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Session Notes
                </label>
                <textarea
                  value={therapistNotes}
                  onChange={(e) => setTherapistNotes(e.target.value)}
                  placeholder="Brief notes about the session..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Therapeutic Alliance Score (1-10)
                </label>
                <select
                  value={allianceScore}
                  onChange={(e) => setAllianceScore(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Technique Effectiveness Score (1-10)
                </label>
                <select
                  value={techniqueScore}
                  onChange={(e) => setTechniqueScore(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowEndDialog(false)}
                disabled={ending}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={endSession}
                disabled={ending}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {ending ? 'Ending...' : 'End Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionInterface;