'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Copy, Check, ExternalLink } from 'lucide-react';

// Prompt configurations
const PROMPT_CONFIGS = {
  profile_analysis_system: {
    name: 'Profile Analysis System Prompt',
    description: 'System prompt for extracting insights from conversation transcripts (Stage 1)',
    category: 'profile_analysis_system'
  },
  profile_analysis_user: {
    name: 'Profile Analysis User Prompt',
    description: 'User prompt for structuring conversation analysis and insight extraction (Stage 1)',
    category: 'profile_analysis_user'
  },
  profile_merge_system: {
    name: 'Profile Merge System Prompt',
    description: 'System prompt for merging user profile data from conversation analysis (Stage 2)',
    category: 'profile_merge_system'
  },
  profile_merge_user: {
    name: 'Profile Merge User Prompt',
    description: 'User prompt for merging user profile data from conversation analysis (Stage 2)',
    category: 'profile_merge_user'
  },
  ai_summary_prompt: {
    name: 'AI Summary Prompt',
    description: 'Prompt for generating concise AI instruction summaries from user profiles',
    category: 'ai_summary_prompt'
  },
  warm_handoff_analysis_system: {
    name: 'Warm Handoff Analysis System Prompt',
    description: 'System prompt for analyzing individual conversations to extract warm handoff insights',
    category: 'warm_handoff_analysis_system'
  },
  warm_handoff_analysis_user: {
    name: 'Warm Handoff Analysis User Prompt',
    description: 'User prompt for extracting structured insights from individual conversations',
    category: 'warm_handoff_analysis_user'
  },
  warm_handoff_system: {
    name: 'Warm Handoff Merge System Prompt',
    description: 'System prompt for merging conversation insights into warm handoff summaries',
    category: 'warm_handoff_system'
  },
  warm_handoff_user: {
    name: 'Warm Handoff Merge User Prompt',
    description: 'User prompt for combining insights into final warm handoff summary sheets',
    category: 'warm_handoff_user'
  },
  insights_system: {
    name: 'User Insights System Prompt',
    description: 'System prompt for analyzing conversations to extract user insights (personal development focus)',
    category: 'insights_system'
  },
  insights_user: {
    name: 'User Insights User Prompt',
    description: 'User prompt for structuring conversation analysis and insight extraction (personal development focus)',
    category: 'insights_user'
  }
};

export default function SinglePromptPage() {
  const params = useParams();
  const promptId = params.promptId as string;
  
  const [userId, setUserId] = useState('');
  
  // Prompt state
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [currentPrompt, setCurrentPrompt] = useState('Loading current prompt...');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Get prompt config
  const promptConfig = PROMPT_CONFIGS[promptId as keyof typeof PROMPT_CONFIGS];

  useEffect(() => {
    // Get the current logged-in user's ID from Firebase
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      }
    });

    return () => unsubscribe();
  }, []);

  const loadCurrentPrompt = async () => {
    if (!promptConfig) return;
    
    try {
      const response = await fetch(`/api/v15/prompts?category=${promptConfig.category}&userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        const promptContent = data.content || `No ${promptConfig.category} prompt found in database.`;
        setCurrentPrompt(promptContent);
      }
    } catch (error) {
      console.error('Error loading current prompt:', error);
      setCurrentPrompt('Error loading current prompt');
    }
  };

  const loadCurrentPromptIntoEditor = async () => {
    if (!promptConfig) return;
    
    try {
      const response = await fetch(`/api/v15/prompts?category=${promptConfig.category}&userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.content) {
          setContent(data.content);
          setCurrentPrompt(data.content);
        } else {
          setContent('');
          setCurrentPrompt(`No ${promptConfig.category} prompt found in database.`);
        }
      }
    } catch (error) {
      console.error('Error loading current prompt:', error);
      setContent('');
      setCurrentPrompt('Error loading current prompt');
    }
  };

  // Initialize content from database
  useEffect(() => {
    if (userId && promptConfig) {
      loadCurrentPromptIntoEditor();
    }
  }, [userId, promptConfig]);

  // Load current prompt when user changes
  useEffect(() => {
    if (userId && promptConfig) {
      loadCurrentPrompt();
    }
  }, [userId, promptConfig]);

  const savePrompt = async () => {
    if (!promptConfig) return;
    
    if (!userId.trim()) {
      setStatusMessage('Please enter a User ID');
      return;
    }

    if (!content.trim()) {
      setStatusMessage('Please enter prompt content');
      return;
    }

    setIsLoading(true);
    setStatusMessage('');

    try {
      const response = await fetch('/api/v15/save-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          category: promptConfig.category,
          content,
          title: title || `${promptConfig.name} updated ${new Date().toLocaleString()}`,
          notes: notes || `Updated via V15 admin interface`,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setStatusMessage(`Successfully saved ${promptConfig.name} for user ${userId}`);
        // Reload both the current prompt display and editor content
        loadCurrentPromptIntoEditor();
      } else {
        setStatusMessage(`Error: ${result.message || 'Failed to save prompt'}`);
      }
    } catch (error) {
      console.error('Error saving prompt:', error);
      setStatusMessage('Error saving prompt. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle invalid prompt ID
  if (!promptConfig) {
    return (
      <div className="max-w-4xl mx-auto p-6 pt-24">
        <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 p-4 rounded-md">
          <h1 className="text-xl font-bold mb-2">Invalid Prompt ID</h1>
          <p>The prompt ID &apos;{promptId}&apos; is not recognized.</p>
          <p className="mt-2">
            <a 
              href="/chatbotV15/admin" 
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Return to Admin Dashboard
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 pt-24">
      <div className="flex items-center mb-8">
        <a 
          href="/chatbotV15/admin"
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 mr-4"
        >
          <ExternalLink size={20} />
          <span>Admin Dashboard</span>
        </a>
        <div>
          <h1 className="text-3xl font-bold">{promptConfig.name}</h1>
          <p className="text-gray-600 dark:text-gray-400">{promptConfig.description}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            User ID
          </label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="Enter user ID..."
          />
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className={`p-3 rounded-md mb-4 ${
            statusMessage.includes('Error') || statusMessage.includes('Failed')
              ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200'
              : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200'
          }`}>
            {statusMessage}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder={`Title for ${promptConfig.name}`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Prompt Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
              placeholder={`Enter ${promptConfig.name.toLowerCase()}...`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Notes about this prompt..."
            />
          </div>

          <button
            onClick={savePrompt}
            disabled={isLoading}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isLoading ? 'Saving...' : `Save ${promptConfig.name}`}
          </button>

          <div className="mt-8">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Current {promptConfig.name} (In Use)
              </h3>
              <button
                onClick={() => copyToClipboard(currentPrompt)}
                className="flex items-center space-x-1 px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {copied ? (
                  <>
                    <Check size={14} />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md border">
              <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                {currentPrompt}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}