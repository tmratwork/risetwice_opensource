'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ExternalLink, Save, Copy, Check } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

// V16 Memory Prompt configurations
const V16_MEMORY_PROMPT_CONFIGS = {
  v16_what_ai_remembers_extraction_system: {
    name: 'V16 What AI Remembers Extraction System Prompt',
    description: 'System prompt for extracting what AI should remember from conversations in V16 memory system',
    category: 'v16_what_ai_remembers_extraction_system'
  },
  v16_what_ai_remembers_extraction_user: {
    name: 'V16 What AI Remembers Extraction User Prompt',
    description: 'User prompt for extracting what AI should remember from conversations in V16 memory system',
    category: 'v16_what_ai_remembers_extraction_user'
  },
  v16_what_ai_remembers_profile_merge_system: {
    name: 'V16 What AI Remembers Profile Merge System Prompt',
    description: 'System prompt for merging AI memory profile data in V16 memory system',
    category: 'v16_what_ai_remembers_profile_merge_system'
  },
  v16_what_ai_remembers_profile_merge_user: {
    name: 'V16 What AI Remembers Profile Merge User Prompt',
    description: 'User prompt for merging AI memory profile data in V16 memory system',
    category: 'v16_what_ai_remembers_profile_merge_user'
  },
  v16_ai_summary_prompt: {
    name: 'V16 AI Summary Generation Prompt',
    description: 'Prompt for generating up to 5-sentence AI instruction summaries from V16 user profile data. Used to bridge V16 memory processing to prompt injection system.',
    category: 'v16_ai_summary_prompt'
  },
  warm_handoff_system: {
    name: 'V16 Warm Handoff System Prompt',
    description: 'System prompt for generating professional warm handoff summaries from V16 user profile data',
    category: 'warm_handoff_system'
  },
  warm_handoff_user: {
    name: 'V16 Warm Handoff User Prompt',
    description: 'User prompt template for generating professional warm handoff summaries from V16 user profile data',
    category: 'warm_handoff_user'
  }
};

export default function V16MemoryPromptPage() {
  const params = useParams();
  const promptId = params.promptId as string;

  // User state
  const [userId, setUserId] = useState('');

  // Prompt state
  const [content, setContent] = useState('');
  const [currentPrompt, setCurrentPrompt] = useState<{
    id: string;
    name: string;
    description: string;
    category: string;
    created_at: string;
    updated_at: string;
  } | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Copy state
  const [copiedEditor, setCopiedEditor] = useState(false);
  const [copiedDatabase, setCopiedDatabase] = useState(false);

  // Get prompt config
  const promptConfig = V16_MEMORY_PROMPT_CONFIGS[promptId as keyof typeof V16_MEMORY_PROMPT_CONFIGS];

  const loadCurrentPrompt = async () => {
    if (!promptConfig) return;

    setIsLoadingCurrent(true);
    try {
      console.log(`[V16] 📡 ADMIN: Loading V16 memory prompt for ${promptId}`);
      const response = await fetch(`/api/v15/prompts?category=${promptConfig.category}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`[V16] 📊 ADMIN: V15 prompts API response:`, data);
        
        if (data.content) {
          // V15 prompts API returns content directly, not in data.prompt structure
          console.log(`[V16] ✅ ADMIN: V16 memory prompt loaded`, {
            promptId: data.promptId,
            contentLength: data.content?.length || 0
          });
          
          // Create a synthetic prompt object for display
          setCurrentPrompt({
            id: data.promptId,
            name: data.content,
            description: promptConfig.description,
            category: data.category,
            created_at: new Date().toISOString(), // We don't have this from the API
            updated_at: new Date().toISOString()  // We don't have this from the API
          });
          setContent(data.content || '');
        } else {
          console.log(`[V16] 📭 ADMIN: No V16 memory prompt found for ${promptId}`);
          setCurrentPrompt(null);
          setContent('');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      console.error(`[V16] ❌ ADMIN: Error loading V16 memory prompt:`, error);
      setStatusMessage(`Error loading current prompt: ${(error as Error).message}`);
    } finally {
      setIsLoadingCurrent(false);
    }
  };

  // Get user auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId('admin'); // Fallback for non-authenticated admin
      }
    });

    return () => unsubscribe();
  }, []);

  // Load current prompt when component mounts
  useEffect(() => {
    if (promptConfig) {
      loadCurrentPrompt();
    }
  }, [promptConfig]);

  // Copy to clipboard functions
  const copyToClipboard = async (text: string, type: 'editor' | 'database') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'editor') {
        setCopiedEditor(true);
        setTimeout(() => setCopiedEditor(false), 2000);
      } else {
        setCopiedDatabase(true);
        setTimeout(() => setCopiedDatabase(false), 2000);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      setStatusMessage('Failed to copy to clipboard');
    }
  };

  const savePrompt = async () => {
    if (!promptConfig) return;

    if (!content.trim()) {
      setStatusMessage('Please enter prompt content');
      return;
    }

    setIsLoading(true);
    setStatusMessage('');

    try {
      console.log(`[V16] 💾 ADMIN: Saving V16 memory prompt for ${promptId}`, {
        contentLength: content.length
      });

      const response = await fetch('/api/v15/save-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId || 'admin',
          category: promptConfig.category,
          content: content,
          title: promptConfig.name,
          notes: `V16 Memory System Prompt - ${promptConfig.description}`
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log(`[V16] ✅ ADMIN: V16 memory prompt saved successfully`, {
          promptId: result.prompt.id
        });
        setStatusMessage(`Successfully saved ${promptConfig.name}`);
        // Reload current prompt to reflect changes
        loadCurrentPrompt();
      } else {
        throw new Error(result.error || 'Failed to save prompt');
      }
    } catch (error) {
      console.error(`[V16] ❌ ADMIN: Error saving V16 memory prompt:`, error);
      setStatusMessage(`Error saving prompt: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle invalid prompt ID
  if (!promptConfig) {
    return (
      <div className="max-w-4xl mx-auto p-6 pt-24">
        <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 p-4 rounded-md">
          <h1 className="text-xl font-bold mb-2">Invalid V16 Memory Prompt ID</h1>
          <p>The prompt ID &apos;{promptId}&apos; is not recognized as a valid V16 memory prompt type.</p>
          <p className="mt-2">
            <a
              href="/chatbotV16/admin"
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
          href="/chatbotV16/admin"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-2 text-green-600 hover:text-green-800 mr-4"
        >
          <ExternalLink size={20} />
          <span>Admin Dashboard</span>
        </a>
        <div>
          <h1 className="text-3xl font-bold">{promptConfig.name}</h1>
          <p className="text-gray-600 dark:text-gray-400">{promptConfig.description}</p>
          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
            V16 Memory System Prompt - Used by /chatbotV16/memory page
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
        {/* Status Message */}
        {statusMessage && (
          <div className={`p-3 rounded-md mb-4 ${statusMessage.includes('Error') || statusMessage.includes('Failed')
              ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200'
              : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200'
            }`}>
            {statusMessage}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Prompt Content *
              </label>
              {content && (
                <button
                  onClick={() => copyToClipboard(content, 'editor')}
                  className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded"
                >
                  {copiedEditor ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedEditor ? 'Copied!' : 'Copy'}</span>
                </button>
              )}
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={25}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
              placeholder={`Enter ${promptConfig.name.toLowerCase()} content...`}
            />
            <p className="text-xs text-gray-500 mt-1">
              The prompt content that guides the AI in {promptId.includes('extraction') ? 'extracting memory data from conversations' : 'merging memory profile data'}.
            </p>
            <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
              <p className="text-sm text-green-800 dark:text-green-200 font-medium mb-2">
                V16 Memory System Integration
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mb-2">
                This prompt is used by the V16 memory processing APIs:
              </p>
              <ul className="text-xs text-green-700 dark:text-green-300 list-disc list-inside space-y-1">
                <li><code className="bg-green-100 dark:bg-green-900/40 px-1 rounded">/api/v16/process-memory</code> - Uses extraction prompts</li>
                <li><code className="bg-green-100 dark:bg-green-900/40 px-1 rounded">/api/v16/generate-warm-handoff</code> - Uses merge prompts</li>
                <li><code className="bg-green-100 dark:bg-green-900/40 px-1 rounded">/chatbotV16/memory</code> - UI that triggers these APIs</li>
              </ul>
            </div>
          </div>

          <button
            onClick={savePrompt}
            disabled={isLoading}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center space-x-2"
          >
            <Save size={20} />
            <span>{isLoading ? 'Saving...' : `Save ${promptConfig.name}`}</span>
          </button>

          {/* Current Prompt Display */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Current {promptConfig.name} (In Database)
              </h3>
              {currentPrompt && (
                <button
                  onClick={() => copyToClipboard(currentPrompt.name, 'database')}
                  className="flex items-center space-x-1 px-2 py-1 text-xs bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-700 dark:text-green-300 rounded"
                >
                  {copiedDatabase ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedDatabase ? 'Copied!' : 'Copy'}</span>
                </button>
              )}
            </div>

            {isLoadingCurrent ? (
              <div className="text-center py-4">
                <div className="text-gray-500">Loading current prompt...</div>
              </div>
            ) : currentPrompt ? (
              <>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-md border max-h-96 overflow-y-auto">
                  <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                    {currentPrompt.name}
                  </pre>
                </div>

                <div className="mt-4 text-xs text-gray-500">
                  <p>ID: {currentPrompt.id}</p>
                  <p>Category: {currentPrompt.category}</p>
                  <p>Created: {new Date(currentPrompt.created_at).toLocaleString()}</p>
                  <p>Updated: {new Date(currentPrompt.updated_at).toLocaleString()}</p>
                </div>
              </>
            ) : (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200 rounded-md">
                <p className="font-medium">No prompt found in database</p>
                <p className="text-sm">This {promptConfig.name.toLowerCase()} has not been configured yet. Enter content above and save to create it.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}