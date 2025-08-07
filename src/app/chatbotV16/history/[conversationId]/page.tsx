"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
  routing_metadata?: {
    specialist?: string;
    type?: string;
    context_summary?: string;
    timestamp?: string;
  };
}

interface ConversationDetail {
  id: string;
  created_at: string;
  last_activity_at: string;
  current_specialist: string;
  messages: Message[];
}

export default function ConversationDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;
  
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isResuming, setIsResuming] = useState(false);

  useEffect(() => {
    if (!user?.uid || !conversationId) {
      setLoading(false);
      return;
    }

    const fetchConversation = async () => {
      try {
        const response = await fetch(`/api/v16/conversation-detail?userId=${user.uid}&conversationId=${conversationId}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();
        
        if (!data.success) {
          throw new Error('Failed to fetch conversation');
        }

        setConversation(data.conversation);
      } catch (error) {
    // console.error('[HISTORY] Error fetching conversation:', error);
        setError((error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchConversation();
  }, [user?.uid, conversationId]);

  const handleContinueConversation = async () => {
    if (!user?.uid || !conversation) return;

    setIsResuming(true);
    
    try {
      // Store the conversation ID to resume in localStorage
      localStorage.setItem('resumeConversationId', conversation.id);
      localStorage.setItem('resumeSpecialist', conversation.current_specialist);
      
      // Navigate back to main chat
      router.push('/chatbotV16?resume=true');
    } catch {
    // console.error('[HISTORY] Error preparing to resume conversation:', _error);
      setIsResuming(false);
    }
  };

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#131314] text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#131314] text-white">
        <div className="text-center">
          <h1 className="text-xl mb-4">Please sign in to view conversations</h1>
          <Link href="/chatbotV16" className="text-blue-400 hover:text-blue-300 underline">
            Back to Chat
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#131314] text-white">
        <div className="text-center">
          <h1 className="text-xl mb-4 text-red-400">Error loading conversation</h1>
          <p className="mb-4 text-gray-300">{error}</p>
          <div className="space-x-4">
            <Link href="/chatbotV16/history" className="text-blue-400 hover:text-blue-300 underline">
              Back to History
            </Link>
            <Link href="/chatbotV16" className="text-blue-400 hover:text-blue-300 underline">
              Back to Chat
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#131314] text-white">
        <div className="text-center">
          <h1 className="text-xl mb-4">Conversation not found</h1>
          <div className="space-x-4">
            <Link href="/chatbotV16/history" className="text-blue-400 hover:text-blue-300 underline">
              Back to History
            </Link>
            <Link href="/chatbotV16" className="text-blue-400 hover:text-blue-300 underline">
              Back to Chat
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#131314] text-white">
      {/* Header section */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 pt-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold mb-1">
              Conversation with {conversation.current_specialist}
            </h1>
            <p className="text-sm text-gray-400">
              {formatTimestamp(conversation.created_at)} • {conversation.messages.length} messages
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleContinueConversation}
              disabled={isResuming}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded-lg font-medium"
            >
              {isResuming ? 'Resuming...' : 'Continue this conversation'}
            </button>
            <Link href="/chatbotV16/history" className="text-blue-400 hover:text-blue-300 underline">
              Back to History
            </Link>
          </div>
        </div>
      </div>

      {/* Messages section */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="space-y-4">
          {conversation.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-3xl ${
                message.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-100'
              } rounded-lg px-4 py-3`}>
                <div className="whitespace-pre-wrap break-words">
                  {message.content}
                </div>
                <div className={`text-xs mt-2 ${
                  message.role === 'user' ? 'text-blue-200' : 'text-gray-400'
                }`}>
                  {formatRelativeTime(message.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {conversation.messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">No messages in this conversation</p>
          </div>
        )}

        {/* Continue button at bottom */}
        <div className="text-center mt-8 pt-8 border-t border-gray-700 pb-6">
          <button
            onClick={handleContinueConversation}
            disabled={isResuming}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-medium"
          >
            {isResuming ? 'Resuming...' : 'Continue this conversation'}
          </button>
        </div>
      </div>
    </div>
  );
}