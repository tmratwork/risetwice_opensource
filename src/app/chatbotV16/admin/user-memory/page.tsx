'use client';

import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function UserMemoryAdminPage() {
  const { isAdmin, loading: authLoading, error: authError } = useAdminAuth();
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    data?: Record<string, unknown>;
  } | null>(null);

  const processUserMemory = async () => {
    if (!userId.trim()) {
      setResult({
        success: false,
        message: 'Please enter a valid user ID'
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/v15/process-user-memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId.trim()
        })
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: data.userProfileUpdated 
            ? 'User memory processing completed successfully. Profile updated.'
            : 'User memory processing completed. No new data to process.',
          data: data
        });
      } else {
        let errorMessage = data.error || 'Failed to process user memory';
        if (data.details && data.details.error) {
          errorMessage += `: ${data.details.error}`;
        }
        
        setResult({
          success: false,
          message: errorMessage,
          data: data
        });
      }
    } catch (error) {
    // console.error('Error processing user memory:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processUserMemory();
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
      <h1 className="text-3xl font-bold mb-8">User Memory Processing</h1>
      
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Process User Memory</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Trigger memory processing (conversation analysis and profile update) for any user by entering their user ID.
          This performs the same action as the &quot;Refresh&quot; button in the &quot;What AI Remembers&quot; section of the mental health page.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="userId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              User ID
            </label>
            <input
              type="text"
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter user ID (e.g., firebase auth UID)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !userId.trim()}
            style={{ 
              width: '100%',
              padding: '12px 16px',
              backgroundColor: loading || !userId.trim() ? '#9ca3af' : '#2563eb',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: '500',
              border: 'none',
              borderRadius: '6px',
              cursor: loading || !userId.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!loading && userId.trim()) {
                e.currentTarget.style.backgroundColor = '#1d4ed8';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && userId.trim()) {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }
            }}
          >
            {loading ? 'Processing...' : 'Process User Memory'}
          </button>
        </form>

        {/* Results Display */}
        {result && (
          <div className={`mt-6 p-4 rounded-lg ${
            result.success 
              ? 'bg-green-100 dark:bg-green-900 border border-green-200 dark:border-green-700'
              : 'bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-700'
          }`}>
            <h3 className={`text-lg font-semibold mb-2 ${
              result.success 
                ? 'text-green-800 dark:text-green-200'
                : 'text-red-800 dark:text-red-200'
            }`}>
              {result.success ? 'Success' : 'Error'}
            </h3>
            <p className={`${
              result.success 
                ? 'text-green-700 dark:text-green-300'
                : 'text-red-700 dark:text-red-300'
            }`}>
              {result.message}
            </p>

            {/* Show additional data if available */}
            {result.data && (
              <details className="mt-4">
                <summary className={`cursor-pointer font-medium ${
                  result.success 
                    ? 'text-green-800 dark:text-green-200'
                    : 'text-red-800 dark:text-red-200'
                }`}>
                  View Details
                </summary>
                <pre className={`mt-2 p-3 rounded text-xs overflow-auto ${
                  result.success 
                    ? 'bg-green-50 dark:bg-green-800 text-green-900 dark:text-green-100'
                    : 'bg-red-50 dark:bg-red-800 text-red-900 dark:text-red-100'
                }`}>
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Information Section */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
            How This Works
          </h3>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>• Finds unprocessed conversations for the specified user</li>
            <li>• Analyzes conversations using OpenAI GPT-4 to extract insights</li>
            <li>• Updates the user profile using Claude AI to merge new insights</li>
            <li>• Same process as the user&apos;s own &quot;Refresh&quot; button in the mental health interface</li>
          </ul>
        </div>
      </div>
    </div>
  );
}