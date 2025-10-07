// src/app/chatbotV17/components/ProviderOptInModal.tsx
// Modal for users to opt-in to provider messaging

"use client";

import React, { useState } from 'react';

interface ProviderOptInModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerName: string;
  providerUserId: string;
  currentUserId: string;
}

export const ProviderOptInModal: React.FC<ProviderOptInModalProps> = ({
  isOpen,
  onClose,
  providerName,
  providerUserId,
  currentUserId
}) => {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleOptIn = async (optIn: boolean) => {
    if (!optIn) {
      onClose();
      return;
    }

    if (!displayName.trim() || !email.trim()) {
      setError('Please provide your name and email');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please provide a valid email address');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/provider/opt-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUserId,
          provider_user_id: providerUserId,
          opted_in: true,
          user_display_name: displayName.trim(),
          user_email: email.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save opt-in preference');
      }

      onClose();
    } catch (err) {
      setError('Failed to save your preference. Please try again.');
      console.error('Opt-in error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Stay Connected with {providerName}
          </h2>
          <p className="text-gray-600">
            Would you like to allow this therapist to reach out to you directly?
          </p>
        </div>

        {/* Privacy notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-900">
            <strong>Your Privacy:</strong> Your information will only be visible to this therapist if you opt-in. You can decline without affecting your ability to use the AI Preview.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4 mb-6">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
              Your Name
            </label>
            <input
              type="text"
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your full name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Your Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => handleOptIn(false)}
            disabled={submitting}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            No Thanks
          </button>
          <button
            onClick={() => handleOptIn(true)}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Yes, Allow Contact'}
          </button>
        </div>
      </div>
    </div>
  );
};
