'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';

interface NameSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNameSet: (displayName: string) => void;
}

export function NameSelectionModal({ isOpen, onClose, onNameSet }: NameSelectionModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('You must be signed in to set a display name');
      return;
    }

    if (!displayName.trim()) {
      setError('Please enter a display name');
      return;
    }

    if (displayName.trim().length < 2 || displayName.trim().length > 50) {
      setError('Display name must be between 2 and 50 characters');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/v16/user/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.uid,
          display_name: displayName.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to set display name');
      }

      const data = await response.json();
      onNameSet(data.display_name);
      onClose();
    } catch (error) {
      console.error('Error setting display name:', error);
      setError(error instanceof Error ? error.message : 'Failed to set display name');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value);
    if (error) setError(''); // Clear error when user starts typing
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-[#1a1a1b] border border-gray-700 rounded-lg max-w-md w-full">
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-2">Choose Your Display Name</h2>
          <p className="text-gray-400 text-sm mb-4">
            Choose a display name to participate in community conversation.
            This name will be visible to others when you post.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-300 mb-2">
                Display Name
              </label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={handleInputChange}
                placeholder="Enter your display name"
                className="w-full px-3 py-2 bg-[#2a2a2b] border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={50}
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500 mt-1">
                2-50 characters, must be unique
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!displayName.trim() || isSubmitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors"
              >
                {isSubmitting ? 'Setting...' : 'Set Display Name'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}