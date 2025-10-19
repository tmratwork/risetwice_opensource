'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Copy, Check, ExternalLink, Save } from 'lucide-react';
import { THERAPEUTIC_CONTINUITY_GUIDELINES } from '@/app/api/v16/utils/memory-prompt';
import { getLanguageInstructionTemplate } from '@/app/api/v16/utils/language-prompt';

// V18 Prompt configurations
const V18_PROMPT_CONFIGS = {
  v18_patient_intake: {
    name: 'V18 Patient Intake AI Prompt',
    description: 'Initial patient intake assessment AI for V18 mental health support system',
    category: 'V18 Patient Intake',
    instructions: 'This is the main patient intake AI that conducts initial assessment, ensures safety, and provides mental health support in the V18 system.'
  }
};

export default function V18PromptPage() {
  const params = useParams();
  const promptId = params.promptId as string;

  const [userId, setUserId] = useState('');

  // Prompt state
  const [content, setContent] = useState('');
  const [voiceSettings, setVoiceSettings] = useState('');
  const [metadata, setMetadata] = useState('');
  const [currentPrompt, setCurrentPrompt] = useState<{
    id: string;
    type: string;
    content: string;
    prompt_content: string;
    voice_settings?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    functions?: Record<string, unknown>[];
    created_at: string;
    updated_at: string;
  } | null>(null);

  // Universal protocols state
  const [universalProtocols, setUniversalProtocols] = useState('');
  const [mergeWithUniversal, setMergeWithUniversal] = useState(true);
  const [isLoadingUniversal, setIsLoadingUniversal] = useState(false);

  // Functions state
  const [functions, setFunctions] = useState('[]');
  const [mergeWithUniversalFunctions, setMergeWithUniversalFunctions] = useState(true);

  // UI state
  const [activeTab, setActiveTab] = useState<'prompts' | 'functions'>('prompts');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Get prompt config
  const promptConfig = V18_PROMPT_CONFIGS[promptId as keyof typeof V18_PROMPT_CONFIGS];

  // Show merge options (V18 patient intake can merge with universal protocols)
  const shouldShowMerge = true;

  // Calculate merged prompt content
  const mergedContent = shouldShowMerge && mergeWithUniversal && universalProtocols
    ? `${content}\\n\\n--- UNIVERSAL SPECIALIST PROTOCOLS ---\\n\\n${universalProtocols}`
    : content;

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

    setIsLoadingCurrent(true);
    try {
      // Use promptId directly as the API type
      const apiPromptType = promptId;
      console.log(`[V18] 📡 ADMIN: Loading current prompt for ${promptId} (API type: ${apiPromptType})`);
      const response = await fetch(`/api/v16/admin/ai-prompts?type=${apiPromptType}`);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.prompt) {
          console.log(`[V18] ✅ ADMIN: Current prompt loaded`, {
            promptId: data.prompt.id,
            contentLength: data.prompt.prompt_content?.length || 0
          });
          setCurrentPrompt(data.prompt);
          setContent(data.prompt.prompt_content || '');
          setVoiceSettings(JSON.stringify(data.prompt.voice_settings, null, 2) || '');
          setMetadata(JSON.stringify(data.prompt.metadata, null, 2) || '');
          setFunctions(JSON.stringify(data.prompt.functions || [], null, 2));

          // Load merge preferences
          setMergeWithUniversalFunctions(data.prompt.merge_with_universal_functions ?? true);
          setMergeWithUniversal(data.prompt.merge_with_universal_protocols ?? true);
        } else {
          console.log(`[V18] 📭 ADMIN: No prompt found for ${promptId}`);
          setCurrentPrompt(null);
          setContent('');
          setVoiceSettings('');
          setMetadata('');
          setFunctions('[]');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      console.error(`[V18] ❌ ADMIN: Error loading current prompt:`, error);
      setStatusMessage(`Error loading current prompt: ${(error as Error).message}`);
    } finally {
      setIsLoadingCurrent(false);
    }
  };

  const loadUniversalProtocols = async () => {
    setIsLoadingUniversal(true);
    try {
      console.log(`[V18] 📡 ADMIN: Loading universal protocols`);
      const response = await fetch(`/api/v16/admin/ai-prompts?type=universal`);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.prompt) {
          console.log(`[V18] ✅ ADMIN: Universal protocols loaded`);
          setUniversalProtocols(data.prompt.prompt_content || '');
        } else {
          console.log(`[V18] 📭 ADMIN: No universal protocols found`);
          setUniversalProtocols('');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      console.error(`[V18] ❌ ADMIN: Error loading universal protocols:`, error);
      setUniversalProtocols('');
    } finally {
      setIsLoadingUniversal(false);
    }
  };





  // Load current prompt when component mounts
  useEffect(() => {
    if (promptConfig) {
      loadCurrentPrompt();
      loadUniversalProtocols();
    }
  }, [promptConfig]);

  const savePrompt = async () => {
    if (!promptConfig) return;

    if (!content.trim()) {
      setStatusMessage('Please enter prompt content');
      return;
    }

    setIsLoading(true);
    setStatusMessage('');

    try {
      console.log(`[V18] 💾 ADMIN: Saving prompt for ${promptId}`, {
        contentLength: content.length,
        hasVoiceSettings: voiceSettings.trim() !== '',
        hasMetadata: metadata.trim() !== '',
        hasFunctions: functions.trim() !== '[]'
      });

      // Parse JSON fields
      let parsedVoiceSettings = null;
      let parsedMetadata = null;
      let parsedFunctions = [];

      if (voiceSettings.trim()) {
        try {
          parsedVoiceSettings = JSON.parse(voiceSettings);
        } catch {
          setStatusMessage('Invalid JSON in Voice Settings');
          setIsLoading(false);
          return;
        }
      }

      if (metadata.trim()) {
        try {
          parsedMetadata = JSON.parse(metadata);
        } catch {
          setStatusMessage('Invalid JSON in Metadata');
          setIsLoading(false);
          return;
        }
      }

      if (functions.trim()) {
        try {
          parsedFunctions = JSON.parse(functions);
          if (!Array.isArray(parsedFunctions)) {
            setStatusMessage('Functions must be a JSON array');
            setIsLoading(false);
            return;
          }
        } catch {
          setStatusMessage('Invalid JSON in Functions');
          setIsLoading(false);
          return;
        }
      }

      const response = await fetch('/api/v16/admin/ai-prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          promptType: promptId,
          content,
          voiceSettings: parsedVoiceSettings,
          metadata: parsedMetadata,
          functions: parsedFunctions,
          mergeWithUniversalFunctions,
          mergeWithUniversalProtocols: mergeWithUniversal,
          userId: userId || 'admin'
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log(`[V18] ✅ ADMIN: Prompt saved successfully`, {
          action: result.action,
          promptId: result.prompt.id
        });
        setStatusMessage(`Successfully ${result.action} ${promptConfig.name}`);
        // Reload current prompt to reflect changes
        loadCurrentPrompt();
      } else {
        throw new Error(result.error || 'Failed to save prompt');
      }
    } catch (error) {
      console.error(`[V18] ❌ ADMIN: Error saving prompt:`, error);
      setStatusMessage(`Error saving prompt: ${(error as Error).message}`);
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
      <div className="max-w-4xl mx-auto p-6 pt-24 overflow-y-auto h-full">
        <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 p-4 rounded-md">
          <h1 className="text-xl font-bold mb-2">Invalid V18 Prompt ID</h1>
          <p>The prompt ID &apos;{promptId}&apos; is not recognized as a valid V18 prompt type.</p>
          <p className="mt-2">
            <a
              href="/chatbotV18/admin"
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
    <div className="max-w-6xl mx-auto p-6 pt-24 pb-12 overflow-y-auto h-full">
      <div className="flex items-center mb-8">
        <a
          href="/chatbotV18/admin"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-2 text-orange-600 hover:text-orange-800 mr-4"
        >
          <ExternalLink size={20} />
          <span>Admin Dashboard</span>
        </a>
        <div>
          <h1 className="text-3xl font-bold">{promptConfig.name}</h1>
          <p className="text-gray-600 dark:text-gray-400">{promptConfig.description}</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{promptConfig.instructions}</p>
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

        {/* Tab Navigation */}
        <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-600 mb-6">
          <button
            onClick={() => setActiveTab('prompts')}
            className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'prompts'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
          >
            Prompts
          </button>
          <button
            onClick={() => setActiveTab('functions')}
            className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'functions'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
          >
            Functions
          </button>
        </div>

        {/* Prompts Tab */}
        {activeTab === 'prompts' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Prompt Content *
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={25}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                placeholder={`Enter ${promptConfig.name.toLowerCase()} instructions...`}
              />
              <p className="text-xs text-gray-500 mt-1">
                The AI instructions that define how this {promptId.replace('_', ' ')} behaves and responds to users.
              </p>
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2">
                  Memory Integration for Signed-in Users
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                  If a user is signed in, the V18 patient intake AI system prompt and user history will be merged as follows:
                </p>
                <pre className="text-xs text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 p-2 rounded border font-mono overflow-x-auto">
{`\${baseContent}
IMPORTANT USER MEMORY CONTEXT:
The following information has been learned about this user from previous conversations. Use this context to provide more personalized and relevant support.
\${aiSummary}

${THERAPEUTIC_CONTINUITY_GUIDELINES}`}
                </pre>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  These continuity guidelines are hard-coded at{' '}
                  <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded text-blue-800 dark:text-blue-200">
                    src/app/api/v16/utils/memory-prompt.ts
                  </code>
                </p>
              </div>

              <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <p className="text-sm text-green-800 dark:text-green-200 font-medium mb-2">
                  Language Preference Integration
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mb-2">
                  The system automatically injects language preference instructions based on user selection:
                </p>
                <pre className="text-xs text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40 p-2 rounded border font-mono overflow-x-auto">
{getLanguageInstructionTemplate().replace(/\${languageName}/g, '${languagePreference}')}
                </pre>
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                  • Default language: English
                  <br />
                  • Language selector available in header dropdown
                  <br />
                  • Supports 57+ languages from GPT-4o Realtime API
                  <br />
                  • Language preference stored in localStorage and user profile
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                  Language injection handled by{' '}
                  <code className="bg-green-200 dark:bg-green-800 px-1 rounded text-green-800 dark:text-green-200">
                    src/app/api/v18/load-prompt/route.ts
                  </code>
                </p>
              </div>
            </div>

            {/* Universal Protocols Merge Section */}
            {shouldShowMerge && (
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Universal Protocols Integration
                  </h3>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={mergeWithUniversal}
                      onChange={(e) => setMergeWithUniversal(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Merge with Universal Protocols
                    </span>
                  </label>
                </div>

                {isLoadingUniversal ? (
                  <div className="text-center py-4">
                    <div className="text-gray-500">Loading universal protocols...</div>
                  </div>
                ) : universalProtocols ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Universal Protocols (Read-only)
                      </label>
                      <textarea
                        value={universalProtocols}
                        readOnly
                        rows={10}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        These protocols are automatically appended when enabled.
                        <a href="/chatbotV16/admin" target="_blank" className="text-blue-600 hover:text-blue-800 ml-1">
                          Edit Universal Protocols
                        </a>
                      </p>
                    </div>

                    {mergeWithUniversal && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Final Merged Prompt (What API Returns)
                        </label>
                        <textarea
                          value={mergedContent}
                          readOnly
                          rows={35}
                          className="w-full p-3 border border-green-300 dark:border-green-600 rounded-md bg-green-50 dark:bg-green-900/20 text-gray-900 dark:text-gray-100 font-mono text-sm"
                        />
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          ✅ This is the complete prompt that will be sent to the AI for V18 patient intake.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200 rounded-md">
                    <p>No universal protocols configured yet.</p>
                  </div>
                )}
              </div>
            )}

            {/* Voice Settings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Voice Settings (JSON)
              </label>
              <textarea
                value={voiceSettings}
                onChange={(e) => setVoiceSettings(e.target.value)}
                rows={8}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                placeholder='{"voice": "alloy", "speed": 1.0}'
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional voice configuration for this AI. Must be valid JSON.
              </p>
            </div>

            {/* Metadata */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Metadata (JSON)
              </label>
              <textarea
                value={metadata}
                onChange={(e) => setMetadata(e.target.value)}
                rows={6}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                placeholder='{"category": "patient_intake", "version": "v18"}'
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional metadata for this prompt. Must be valid JSON.
              </p>
            </div>

            <button
              onClick={savePrompt}
              disabled={isLoading}
              className="w-full px-4 py-3 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center space-x-2"
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
                <div className="flex space-x-2">
                  {currentPrompt?.prompt_content && (
                    <button
                      onClick={() => copyToClipboard(currentPrompt.prompt_content || '')}
                      className="flex items-center space-x-1 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>

              {isLoadingCurrent ? (
                <div className="text-center py-4">
                  <div className="text-gray-500">Loading current prompt...</div>
                </div>
              ) : currentPrompt ? (
                <>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-md border max-h-96 overflow-y-auto">
                    <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                      {currentPrompt.prompt_content}
                    </pre>
                  </div>

                  {currentPrompt.voice_settings && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Voice Settings:</h4>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md border">
                        <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                          {JSON.stringify(currentPrompt.voice_settings, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {currentPrompt.metadata && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Metadata:</h4>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md border">
                        <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                          {JSON.stringify(currentPrompt.metadata, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 text-xs text-gray-500">
                    <p>ID: {currentPrompt.id}</p>
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
        )}

        {/* Functions Tab - Similar structure to V16 but omitted for brevity */}
        {activeTab === 'functions' && (
          <div className="space-y-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-200 rounded-md">
              <p>Functions tab implementation similar to V16 - can be expanded if needed for V18 patient intake functions.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
