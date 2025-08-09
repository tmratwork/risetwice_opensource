'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface ConversationUsage {
  conversation_id: string;
  user_id: string;
  first_message_date: string;
  message_count: number;
}

interface UsageSummary {
  total_conversations: number;
  total_user_messages: number;
  unique_users: number;
  authenticated_users: number;
  anonymous_users: number;
  anonymous_conversation_count: number;
}

interface UserGroup {
  user_id: string;
  conversations: ConversationUsage[];
  total_messages: number;
  first_message_date: string;
  last_message_date: string;
}

interface Message {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
}

export default function UsagePage() {
  const { isAdmin, loading: authLoading, error: authError } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<ConversationUsage[]>([]);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [expandedConversations, setExpandedConversations] = useState<Set<string>>(new Set());
  const [conversationMessages, setConversationMessages] = useState<Map<string, Message[]>>(new Map());
  const [loadingMessages, setLoadingMessages] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);

  useEffect(() => {
    const fetchUsageData = async () => {
      try {
        const response = await fetch('/api/v15/usage');

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success && result.data) {
          setUsageData(result.data);
          setSummary(result.summary);
        } else {
          setError(result.error || 'Failed to load usage data');
        }
      } catch (_err) {
        setError(_err instanceof Error ? _err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchUsageData();
  }, []);

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInDays === 0) {
      if (diffInHours === 0) {
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        if (diffInMinutes === 0) {
          return 'just now';
        }
        return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
      }
      return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
    } else if (diffInDays === 1) {
      return 'yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const groupByUser = (conversations: ConversationUsage[]): UserGroup[] => {
    const userMap = new Map<string, UserGroup>();

    conversations.forEach((conv) => {
      const existing = userMap.get(conv.user_id);
      if (existing) {
        existing.conversations.push(conv);
        existing.total_messages += conv.message_count;
        if (new Date(conv.first_message_date) < new Date(existing.first_message_date)) {
          existing.first_message_date = conv.first_message_date;
        }
        if (new Date(conv.first_message_date) > new Date(existing.last_message_date)) {
          existing.last_message_date = conv.first_message_date;
        }
      } else {
        userMap.set(conv.user_id, {
          user_id: conv.user_id,
          conversations: [conv],
          total_messages: conv.message_count,
          first_message_date: conv.first_message_date,
          last_message_date: conv.first_message_date
        });
      }
    });

    return Array.from(userMap.values()).sort((a, b) =>
      new Date(b.last_message_date).getTime() - new Date(a.last_message_date).getTime()
    );
  };

  const toggleUserExpansion = (userId: string) => {
    setExpandedUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      // console.error('Failed to copy:', err);
      void err; // Avoid unused variable error
    }
  };

  const fetchConversationMessages = async (conversationId: string) => {
    if (conversationMessages.has(conversationId)) {
      return; // Already fetched
    }

    setLoadingMessages(prev => new Set([...prev, conversationId]));

    try {
      const response = await fetch(`/api/v16/get-messages?conversationId=${encodeURIComponent(conversationId)}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.messages) {
        setConversationMessages(prev => new Map([...prev, [conversationId, result.messages]]));
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      // Set empty array to prevent retry
      setConversationMessages(prev => new Map([...prev, [conversationId, []]]));
    } finally {
      setLoadingMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(conversationId);
        return newSet;
      });
    }
  };

  const toggleConversationExpansion = async (conversationId: string) => {
    const isExpanded = expandedConversations.has(conversationId);
    
    if (isExpanded) {
      // Collapse
      setExpandedConversations(prev => {
        const newSet = new Set(prev);
        newSet.delete(conversationId);
        return newSet;
      });
    } else {
      // Expand and fetch messages
      setExpandedConversations(prev => new Set([...prev, conversationId]));
      await fetchConversationMessages(conversationId);
    }
  };

  const renderMessages = (conversationId: string, userId: string) => {
    const isLoading = loadingMessages.has(conversationId);
    const messages = conversationMessages.get(conversationId) || [];

    if (isLoading) {
      return (
        <div className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
          Loading messages...
        </div>
      );
    }

    if (messages.length === 0) {
      return (
        <div className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
          No messages found for this conversation.
        </div>
      );
    }

    return (
      <div className="px-6 py-4 space-y-3">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {messages.length} message{messages.length === 1 ? '' : 's'}
          </span>
          <button
            onClick={() => {
              const header = `User ID: ${userId}\nConversation ID: ${conversationId}\n\n`;
              const conversationText = messages.map(msg => 
                `${msg.role === 'user' ? 'User' : 'Assistant'} (${formatDate(msg.created_at)}):\n${msg.content}`
              ).join('\n\n---\n\n');
              const fullText = header + conversationText;
              
              navigator.clipboard.writeText(fullText).then(() => {
                setCopiedId(`copied-${conversationId}`);
                setTimeout(() => setCopiedId(null), 2000);
              }).catch((err) => {
                void err; // Avoid unused variable error
              });
            }}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title="Copy all messages to clipboard"
          >
            {copiedId === `copied-${conversationId}` ? (
              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
        
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`p-3 rounded text-sm ${
                message.role === 'user' 
                  ? 'bg-blue-50 dark:bg-blue-900/20 ml-4' 
                  : 'bg-gray-100 dark:bg-gray-700 mr-4'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`font-medium text-xs ${
                  message.role === 'user' 
                    ? 'text-blue-700 dark:text-blue-300' 
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {message.role === 'user' ? 'User' : 'Assistant'}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(message.created_at)}
                </span>
              </div>
              <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {message.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Show loading state while checking authentication
  if (authLoading || loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 pt-24">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              {authLoading ? 'Verifying admin access...' : 'Loading usage data...'}
            </p>
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

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6 mt-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">V16 Usage Report</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Last 7 days of activity</p>
        </div>
        <div className="bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-400 p-4 rounded-md mb-6">
          {error}
        </div>
        <Link
          href="/chatbotV16/admin"
          className="inline-block px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          Back to Admin
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 mt-16">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">V16 Usage Report</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Last 7 days of activity</p>
        </div>
        <Link
          href="/chatbotV16/admin"
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          Back to Admin
        </Link>
      </div>

      {summary && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Conversations</div>
              <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">{summary.total_conversations}</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <div className="text-sm text-green-600 dark:text-green-400 font-medium">Total User Messages</div>
              <div className="text-2xl font-bold text-green-800 dark:text-green-200">{summary.total_user_messages}</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">Unique Users</div>
              <div className="text-2xl font-bold text-purple-800 dark:text-purple-200">{summary.unique_users}</div>
              <div className="text-xs text-purple-600 dark:text-purple-400 mt-1 space-y-0.5">
                <div>✓ {summary.authenticated_users} authenticated</div>
                <div>⚠️ {summary.anonymous_users} anonymous {summary.anonymous_conversation_count > 0 && `(${summary.anonymous_conversation_count} conversations)`}</div>
              </div>
            </div>
          </div>

          <div className="mb-8 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowLegend(!showLegend)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-lg"
            >
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">How are these metrics calculated?</span>
              </div>
              <svg 
                className={`w-4 h-4 text-gray-600 dark:text-gray-400 transform transition-transform ${showLegend ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showLegend && (
              <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                <div className="pt-4 space-y-4">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                    All metrics are calculated based on data from the <strong>past 7 days</strong>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                      <div>
                        <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Conversations</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          Count of unique conversations that contain at least one user message in the past 7 days
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
                      <div>
                        <div className="text-sm font-medium text-green-700 dark:text-green-300">Total User Messages</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          Sum of all user messages across all conversations (excludes assistant responses)
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <div className="w-3 h-3 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></div>
                      <div>
                        <div className="text-sm font-medium text-purple-700 dark:text-purple-300">Unique Users</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                          Count of distinct user IDs across all conversations in the reporting period
                        </div>
                        {summary && (
                          <div className="text-xs space-y-1">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-green-700 dark:text-green-300">Authenticated: {summary.authenticated_users}</span>
                              <span className="text-gray-500 dark:text-gray-400">(reliable count)</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                              <span className="text-orange-700 dark:text-orange-300">
                                Anonymous: {summary.anonymous_users}
                                {summary.anonymous_conversation_count > 0 && 
                                  ` (${summary.anonymous_conversation_count} conversations)`
                                }
                              </span>
                              <span className="text-gray-500 dark:text-gray-400">(likely overcount)</span>
                            </div>
                            {summary.anonymous_users > 0 && (
                              <div className="text-xs space-y-1 mt-1 pl-4 border-l-2 border-orange-200 dark:border-orange-800">
                                <div className="text-orange-600 dark:text-orange-400">
                                  <strong>⚠️ Anonymous User Overcounting:</strong>
                                </div>
                                <div className="text-orange-700 dark:text-orange-300">
                                  • Each browser/device generates a unique anonymous ID
                                </div>
                                <div className="text-orange-700 dark:text-orange-300">
                                  • Same person using multiple browsers/devices = multiple &quot;users&quot;
                                </div>
                                <div className="text-orange-700 dark:text-orange-300">
                                  • Clearing browser data or incognito mode = new anonymous ID
                                </div>
                                <div className="text-orange-700 dark:text-orange-300">
                                  • True anonymous users likely fewer than {summary.anonymous_users}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold">Conversations (Past Week)</h2>
        </div>

        {usageData.length === 0 ? (
          <div className="p-6 text-gray-500 dark:text-gray-400 text-center">
            No conversations found in the past week.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    User ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Conversations
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Total Messages
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Last Active
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {groupByUser(usageData).map((userGroup) => (
                  <React.Fragment key={userGroup.user_id}>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          {userGroup.conversations.length > 1 ? (
                            <button
                              onClick={() => toggleUserExpansion(userGroup.user_id)}
                              className="flex items-center space-x-2 text-left text-gray-800 dark:text-gray-100"
                            >
                              <span className="text-gray-500 dark:text-gray-400">
                                {expandedUsers.has(userGroup.user_id) ? '▼' : '▶'}
                              </span>
                              <span className="font-medium">{userGroup.user_id}</span>
                            </button>
                          ) : (
                            <span className="text-gray-800 dark:text-gray-100 font-medium pl-6">
                              {userGroup.user_id}
                            </span>
                          )}
                          <button
                            onClick={() => copyToClipboard(userGroup.user_id)}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            title="Copy user ID to clipboard"
                          >
                            {copiedId === userGroup.user_id ? (
                              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {userGroup.conversations.length === 1 ? (
                          <button
                            onClick={() => copyToClipboard(userGroup.conversations[0].conversation_id)}
                            className="font-mono text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
                            title="Click to copy full conversation ID"
                          >
                            {userGroup.conversations[0].conversation_id.slice(0, 8)}...
                            {copiedId === userGroup.conversations[0].conversation_id && (
                              <span className="ml-2 text-green-600 dark:text-green-400 font-sans">✓ Copied!</span>
                            )}
                          </button>
                        ) : (
                          userGroup.conversations.length
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {userGroup.total_messages}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {formatRelativeTime(userGroup.last_message_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {userGroup.conversations.length > 1 ? (
                          <button
                            onClick={() => toggleUserExpansion(userGroup.user_id)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            {expandedUsers.has(userGroup.user_id) ? 'Collapse' : 'Expand'}
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleConversationExpansion(userGroup.conversations[0].conversation_id)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            {expandedConversations.has(userGroup.conversations[0].conversation_id) ? 'Hide Messages' : 'View Messages'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {/* Messages for single conversation */}
                    {userGroup.conversations.length === 1 && expandedConversations.has(userGroup.conversations[0].conversation_id) && (
                      <tr key={`${userGroup.conversations[0].conversation_id}-messages`} className="bg-gray-50 dark:bg-gray-900">
                        <td colSpan={5} className="p-0">
                          {renderMessages(userGroup.conversations[0].conversation_id, userGroup.user_id)}
                        </td>
                      </tr>
                    )}
                    {expandedUsers.has(userGroup.user_id) && userGroup.conversations.length > 1 && userGroup.conversations.map((conversation) => (
                      <React.Fragment key={conversation.conversation_id}>
                        <tr className="bg-gray-50 dark:bg-gray-900">
                          <td className="px-6 py-3 pl-12 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            -
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm">
                            <button
                              onClick={() => copyToClipboard(conversation.conversation_id)}
                              className="font-mono text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
                              title="Click to copy full conversation ID"
                            >
                              {conversation.conversation_id.slice(0, 8)}...
                              {copiedId === conversation.conversation_id && (
                                <span className="ml-2 text-green-600 dark:text-green-400">✓ Copied!</span>
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {conversation.message_count}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatRelativeTime(conversation.first_message_date)}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm">
                            <button
                              onClick={() => toggleConversationExpansion(conversation.conversation_id)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              {expandedConversations.has(conversation.conversation_id) ? 'Hide Messages' : 'View Messages'}
                            </button>
                          </td>
                        </tr>
                        {/* Messages for this conversation */}
                        {expandedConversations.has(conversation.conversation_id) && (
                          <tr className="bg-gray-100 dark:bg-gray-800">
                            <td colSpan={5} className="p-0">
                              {renderMessages(conversation.conversation_id, userGroup.user_id)}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}