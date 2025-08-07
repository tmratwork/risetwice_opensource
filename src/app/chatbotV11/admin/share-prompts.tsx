'use client';

import { useState } from 'react';

export default function SharePrompts() {
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [promptCategory, setPromptCategory] = useState<'greeting' | 'ai_instructions'>('greeting');
  const [status, setStatus] = useState<{ success?: boolean; message: string }>({ message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ message: 'Processing...' });

    try {
      const response = await fetch('/api/v11/share-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromUserId,
          toUserId,
          promptCategory
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setStatus({
          success: true,
          message: result.message || 'Prompt shared successfully!'
        });
      } else {
        setStatus({
          success: false,
          message: result.error || 'Failed to share prompt'
        });
      }
    } catch (error) {
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Share Prompts Between Users</h1>

      {status.message && (
        <div
          className={`p-4 mb-6 rounded-md ${
            status.success === undefined
              ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              : status.success
                ? 'bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-400'
          }`}
        >
          {status.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="fromUserId" className="block text-sm font-medium mb-1">
            From User ID (Source)
          </label>
          <input
            type="text"
            id="fromUserId"
            value={fromUserId}
            onChange={(e) => setFromUserId(e.target.value)}
            className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
            placeholder="User ID who has the prompts to share"
          />
        </div>

        <div>
          <label htmlFor="toUserId" className="block text-sm font-medium mb-1">
            To User ID (Destination)
          </label>
          <input
            type="text"
            id="toUserId"
            value={toUserId}
            onChange={(e) => setToUserId(e.target.value)}
            className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
            placeholder="User ID who will receive the prompts"
          />
        </div>

        <div>
          <label htmlFor="promptCategory" className="block text-sm font-medium mb-1">
            Prompt Type
          </label>
          <select
            id="promptCategory"
            value={promptCategory}
            onChange={(e) => setPromptCategory(e.target.value as 'greeting' | 'ai_instructions')}
            className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="greeting">Greeting</option>
            <option value="ai_instructions">AI Instructions</option>
          </select>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Share Prompt'}
          </button>
        </div>
      </form>
    </div>
  );
}