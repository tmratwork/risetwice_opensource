// src/app/admin/s2/components/AIPreviewSettings.tsx
// AI Preview Settings Component for S2 Admin Panel

"use client";

import React, { useState, useEffect } from 'react';

interface AIPreviewPrompt {
  id: string;
  prompt_type: string;
  prompt_content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  metadata: {
    purpose?: string;
    usage?: string;
    created_for?: string;
  };
}

const AIPreviewSettings: React.FC = () => {
  const [prompt, setPrompt] = useState<AIPreviewPrompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState('');

  // Load existing ai_preview prompt
  useEffect(() => {
    const fetchAIPreviewPrompt = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/s2/ai-preview-settings');

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.prompt) {
          setPrompt(data.prompt);
          setEditedContent(data.prompt.prompt_content);
        }
      } catch (err) {
        console.error('Failed to fetch AI Preview settings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    fetchAIPreviewPrompt();
  }, []);

  const handleSave = async () => {
    if (!editedContent.trim()) {
      setError('Prompt content cannot be empty');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/admin/s2/ai-preview-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt_content: editedContent.trim(),
          action: prompt ? 'update' : 'create'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save AI Preview settings');
      }

      const data = await response.json();
      setPrompt(data.prompt);
      setSuccess('AI Preview settings saved successfully!');

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);

    } catch (err) {
      console.error('Failed to save AI Preview settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (prompt) {
      setEditedContent(prompt.prompt_content);
    }
    setError(null);
    setSuccess(null);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading AI Preview settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">AI Preview Settings</h2>
          <p className="text-gray-600 mt-1">
            Configure the base system prompt used for AI Preview sessions in therapist testing
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {prompt && (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              prompt.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {prompt.is_active ? '✅ Active' : '❌ Inactive'}
            </span>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-100 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-green-800">{success}</p>
          </div>
        </div>
      )}

      {/* Prompt Editor */}
      <div className="space-y-4">
        <div>
          <label htmlFor="prompt-content" className="block text-sm font-medium text-gray-700 mb-2">
            AI Preview System Prompt
          </label>
          <textarea
            id="prompt-content"
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            placeholder="Enter the system prompt for AI Preview sessions..."
          />
          <div className="mt-2 flex items-center justify-between text-sm text-gray-500">
            <span>{editedContent.length} characters</span>
            {prompt && (
              <span>Last updated: {new Date(prompt.updated_at).toLocaleString()}</span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <button
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset Changes
          </button>

          <div className="flex space-x-3">
            <button
              onClick={handleSave}
              disabled={saving || !editedContent.trim() || (prompt && editedContent === prompt.prompt_content)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75" />
                  </svg>
                  Saving...
                </>
              ) : prompt ? 'Update AI Preview Prompt' : 'Create AI Preview Prompt'}
            </button>
          </div>
        </div>
      </div>

      {/* Information Card */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">How AI Preview Works</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>
            • This prompt serves as the base system prompt for all AI Preview sessions
          </p>
          <p>
            • When testing a therapist, the generated therapist personality prompt is appended to this base prompt
          </p>
          <p>
            • The AI will role-play as that specific therapist while maintaining preview-appropriate behavior
          </p>
          <p>
            • Keep this prompt focused on preview/testing behaviors rather than actual therapy protocols
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIPreviewSettings;