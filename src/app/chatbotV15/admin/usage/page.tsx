'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

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
}

interface UserGroup {
  user_id: string;
  conversations: ConversationUsage[];
  total_messages: number;
  first_message_date: string;
  last_message_date: string;
}

export default function UsagePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<ConversationUsage[]>([]);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
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
      console.error('Failed to copy:', err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 mt-16">
        <div>
          <h1 className="text-3xl font-bold">V15 Usage Report</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Last 7 days of activity</p>
        </div>
        <div className="text-center py-12">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6 mt-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">V15 Usage Report</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Last 7 days of activity</p>
        </div>
        <div className="bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-400 p-4 rounded-md mb-6">
          {error}
        </div>
        <Link 
          href="/chatbotV15/admin"
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
          <h1 className="text-3xl font-bold">V15 Usage Report</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Last 7 days of activity</p>
        </div>
        <Link 
          href="/chatbotV15/admin"
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          Back to Admin
        </Link>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
          </div>
        </div>
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
                          <Link
                            href={`/chatbotV15/admin/conversation?conversationId=${userGroup.conversations[0].conversation_id}`}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            View Messages
                          </Link>
                        )}
                      </td>
                    </tr>
                    {expandedUsers.has(userGroup.user_id) && userGroup.conversations.length > 1 && userGroup.conversations.map((conversation) => (
                      <tr key={conversation.conversation_id} className="bg-gray-50 dark:bg-gray-900">
                        <td className="px-6 py-3 pl-12 whitespace-nowrap text-sm">
                          <button
                            onClick={() => copyToClipboard(conversation.conversation_id)}
                            className="font-mono text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
                            title="Click to copy full ID"
                          >
                            {conversation.conversation_id.slice(0, 8)}...
                            {copiedId === conversation.conversation_id && (
                              <span className="ml-2 text-green-600 dark:text-green-400">✓ Copied!</span>
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          -
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {conversation.message_count}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatRelativeTime(conversation.first_message_date)}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm">
                          <Link
                            href={`/chatbotV15/admin/conversation?conversationId=${conversation.conversation_id}`}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            View Messages
                          </Link>
                        </td>
                      </tr>
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