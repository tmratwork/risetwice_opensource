// src/components/DisplayNameDialog.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

interface DisplayNameDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserProfileResponse {
  user_id: string;
  display_name: string | null;
  has_display_name: boolean;
}

export default function DisplayNameDialog({ isOpen, onClose }: DisplayNameDialogProps) {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentDisplayName, setCurrentDisplayName] = useState<string | null>(null);
  const [isEdit, setIsEdit] = useState(false);

  // Fetch current display name when dialog opens
  useEffect(() => {
    if (isOpen && user) {
      fetchCurrentDisplayName();
    }
  }, [isOpen, user]);

  const fetchCurrentDisplayName = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/v16/user/profile?user_id=${user.uid}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const data: UserProfileResponse = await response.json();
      setCurrentDisplayName(data.display_name);
      setDisplayName(data.display_name || '');
      setIsEdit(data.has_display_name);
    } catch (err) {
      console.error('Error fetching display name:', err);
      setError('Failed to load current display name');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !displayName.trim()) {
      setError('Display name is required');
      return;
    }

    const trimmedName = displayName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      setError('Display name must be between 2 and 50 characters');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/v16/user/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.uid,
          display_name: trimmedName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save display name');
      }

      // Success - close dialog
      onClose();
    } catch (err) {
      console.error('Error saving display name:', err);
      setError(err instanceof Error ? err.message : 'Failed to save display name');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setDisplayName(currentDisplayName || '');
    setError('');
    onClose();
  };

  const handleEscape = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSave();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleCancel}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleEscape}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
            {isEdit ? 'Edit Display Name' : 'Create Display Name'}
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Explanation */}
          <div className="text-sm text-gray-600 dark:text-gray-300">
            <p className="mb-3">
              {isEdit 
                ? 'Update your display name. This is how other users will see you.'
                : 'Choose a display name. This is how other users will see you.'
              }
            </p>
          </div>

          {/* Display Name Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={handleEnter}
              placeholder="Enter your display name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-600 dark:focus:border-blue-600"
              disabled={loading}
              maxLength={50}
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>2-50 characters</span>
              <span>{displayName.length}/50</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Current Status */}
          {currentDisplayName && (
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                <strong>Current Display Name:</strong> {currentDisplayName}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={handleCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !displayName.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : (isEdit ? 'Update' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
}