// src/app/s2/components/CustomizeAIPrompt.tsx
// Optional AI Preview Prompt Customization in S2 Onboarding

"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import StepNavigator from './StepNavigator';
import { StepCompletionStatus, FlowStep } from '@/utils/s2-validation';

interface CustomizeAIPromptProps {
  onNext: () => void;
  onBack: () => void;
  onStepNavigation?: (step: FlowStep) => void;
  canSkipToStep?: (targetStep: FlowStep, currentStep: FlowStep) => boolean;
  stepCompletionStatus?: StepCompletionStatus;
}

const CustomizeAIPrompt: React.FC<CustomizeAIPromptProps> = ({
  onNext,
  onBack,
  onStepNavigation,
  canSkipToStep,
  stepCompletionStatus
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasCustomPrompt, setHasCustomPrompt] = useState(false);
  const [isUsingDefault, setIsUsingDefault] = useState(true);
  const [promptContent, setPromptContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');

  // Load existing prompt (custom or default)
  useEffect(() => {
    const fetchPrompt = async () => {
      if (!user?.uid) return;

      try {
        setLoading(true);
        const response = await fetch('/api/provider/ai-preview-prompt', {
          headers: {
            'x-user-id': user.uid
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch prompt');
        }

        const data = await response.json();
        setHasCustomPrompt(data.hasCustomPrompt);
        setIsUsingDefault(data.isUsingDefault);
        setPromptContent(data.prompt.prompt_content);
        setOriginalContent(data.prompt.prompt_content);
      } catch (err) {
        console.error('Error fetching AI preview prompt:', err);
        setError(err instanceof Error ? err.message : 'Failed to load prompt');
      } finally {
        setLoading(false);
      }
    };

    fetchPrompt();
  }, [user?.uid]);

  const handleSave = async () => {
    if (!user?.uid) {
      setError('User not authenticated');
      return;
    }

    if (!promptContent.trim()) {
      setError('Prompt content cannot be empty');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/provider/ai-preview-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.uid
        },
        body: JSON.stringify({
          prompt_content: promptContent.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save prompt');
      }

      const data = await response.json();
      setHasCustomPrompt(true);
      setIsUsingDefault(false);
      setOriginalContent(promptContent);
      setSuccess(`Custom AI Preview prompt ${data.action}!`);

      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Error saving AI preview prompt:', err);
      setError(err instanceof Error ? err.message : 'Failed to save prompt');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPromptContent(originalContent);
    setError(null);
    setSuccess(null);
  };

  const handleResetToDefault = async () => {
    if (!user?.uid) return;

    if (!confirm('Are you sure you want to reset to the default AI Preview prompt? Your custom prompt will be deleted.')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/provider/ai-preview-prompt', {
        method: 'DELETE',
        headers: {
          'x-user-id': user.uid
        }
      });

      if (!response.ok) {
        throw new Error('Failed to reset to default');
      }

      // Reload to get default prompt
      const fetchResponse = await fetch('/api/provider/ai-preview-prompt', {
        headers: {
          'x-user-id': user.uid
        }
      });

      if (fetchResponse.ok) {
        const data = await fetchResponse.json();
        setPromptContent(data.prompt.prompt_content);
        setOriginalContent(data.prompt.prompt_content);
        setHasCustomPrompt(false);
        setIsUsingDefault(true);
        setSuccess('Reset to default prompt successfully');
        setTimeout(() => setSuccess(null), 5000);
      }
    } catch (err) {
      console.error('Error resetting to default:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = promptContent !== originalContent;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading AI Preview settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      {/* Step Navigator */}
      {onStepNavigation && canSkipToStep && stepCompletionStatus && (
        <StepNavigator
          currentStep="customize-ai-prompt"
          onStepClick={onStepNavigation}
          canSkipToStep={canSkipToStep}
          stepCompletionStatus={stepCompletionStatus}
        />
      )}

      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-4xl w-full space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Customize AI Preview Prompt (Optional)
            </h1>
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              Customize how your AI Preview introduces itself to potential clients, or skip to use the default.
            </p>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-800 font-medium">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-green-800 font-medium">{success}</p>
              </div>
            </div>
          )}

          {/* Prompt Status Badge */}
          <div className="flex items-center justify-center gap-2">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              isUsingDefault ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
            }`}>
              {isUsingDefault ? '📘 Using Default Prompt' : '✨ Using Custom Prompt'}
            </span>
          </div>

          {/* Editor */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="prompt-content" className="block text-sm font-medium text-gray-700 mb-2">
                  AI Preview System Prompt
                </label>
                <textarea
                  id="prompt-content"
                  value={promptContent}
                  onChange={(e) => setPromptContent(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm"
                  placeholder="Enter your custom AI Preview prompt..."
                />
                <div className="mt-2 flex items-center justify-between text-sm text-gray-500">
                  <span>{promptContent.length} characters</span>
                  {hasChanges && <span className="text-orange-600 font-medium">• Unsaved changes</span>}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="flex gap-3">
                  <button
                    onClick={handleReset}
                    disabled={saving || !hasChanges}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Discard Changes
                  </button>
                  {hasCustomPrompt && (
                    <button
                      onClick={handleResetToDefault}
                      disabled={saving}
                      className="px-4 py-2 text-red-600 hover:text-red-800 border border-red-300 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reset to Default
                    </button>
                  )}
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving || !hasChanges || !promptContent.trim()}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <>
                      <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Save Custom Prompt'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Information Card */}
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="text-sm font-medium text-blue-900 mb-3">How This Works</h3>
            <div className="text-sm text-blue-800 space-y-2">
              <p>
                • This prompt controls how your AI Preview behaves when potential clients test it
              </p>
              <p>
                • Your therapist personality prompt (generated from your profile data) will be appended to this base prompt
              </p>
              <p>
                • Customizing this is <strong>optional</strong> - the default prompt works great for most providers
              </p>
              <p>
                • You can always come back and edit this later from your provider dashboard
              </p>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center pt-8">
            <button
              onClick={onBack}
              className="control-button"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            >
              ← Back
            </button>
            <button
              onClick={onNext}
              className="control-button primary"
            >
              {hasChanges && !saving ? 'Skip & Continue Without Saving' : 'Continue →'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CustomizeAIPrompt;
