'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface Message {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
}

export default function ConversationViewerPage() {
  const { isAdmin, loading: authLoading, error: authError } = useAdminAuth();
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = async () => {
    if (!conversationId.trim()) {
      setError('Please enter a conversation ID');
      return;
    }

    setLoading(true);
    setError(null);
    setMessages([]);

    try {
      const response = await fetch(`/api/v16/get-messages?conversationId=${encodeURIComponent(conversationId)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setMessages(result.data);
      } else {
        setError(result.error || 'Failed to load messages');
      }
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMessages();
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 pt-24">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Verifying admin access...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if there was an issue checking permissions
  if (authError) {
    return (
      <div className="max-w-6xl mx-auto p-6 pt-24">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
                Authentication Error
              </h2>
              <p className="text-red-600 dark:text-red-300 mb-4">{authError}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Contact developers to gain access to these admin pages.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show access denied for non-admin users
  if (!isAdmin) {
    return (
      <div className="max-w-6xl mx-auto p-6 pt-24">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8">
              <div className="mb-4">
                <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                  <ExternalLink className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-blue-800 dark:text-blue-200 mb-3">
                Admin Access Required
              </h2>
              <p className="text-blue-600 dark:text-blue-300 mb-2">
                This page requires administrator privileges.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Contact developers to gain access to these admin pages.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 pt-24">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-6">Conversation Viewer</h1>
        
        <form onSubmit={handleSubmit} className="flex gap-4 mb-6">
          <input
            type="text"
            value={conversationId}
            onChange={(e) => setConversationId(e.target.value)}
            placeholder="Enter conversation ID"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'View Conversation'}
          </button>
        </form>

        {error && (
          <div className="bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-400 p-4 rounded-md mb-6">
            {error}
          </div>
        )}
      </div>

      {messages.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Messages ({messages.length})</h2>
            <button
              onClick={() => {
                const conversationText = messages.map(msg => 
                  `${msg.role === 'user' ? 'User' : 'Assistant'} (${formatDate(msg.created_at)}):\n${msg.content}`
                ).join('\n\n---\n\n');
                
                navigator.clipboard.writeText(conversationText).then(() => {
                  alert('Conversation copied to clipboard!');
                }).catch((err) => {
    // console.error('Failed to copy:', err);
                  void err; // Avoid unused variable error
                  alert('Failed to copy conversation to clipboard');
                });
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Copy All Messages
            </button>
          </div>
          
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`p-4 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-blue-50 dark:bg-blue-900/20 ml-8' 
                  : 'bg-gray-50 dark:bg-gray-800 mr-8'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`font-medium ${
                  message.role === 'user' 
                    ? 'text-blue-700 dark:text-blue-300' 
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {message.role === 'user' ? 'User' : 'Assistant'}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(message.created_at)}
                </span>
              </div>
              <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {message.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {messages.length === 0 && !loading && !error && conversationId && (
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md text-center text-gray-600 dark:text-gray-400">
          No messages found for this conversation ID.
        </div>
      )}
    </div>
  );
}