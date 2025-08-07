'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Copy, Check, ExternalLink, Save } from 'lucide-react';
import { THERAPEUTIC_CONTINUITY_GUIDELINES } from '@/app/api/v16/utils/memory-prompt';

// V16 Prompt configurations based on V16.md
const V16_PROMPT_CONFIGS = {
  // V16 Memory System Prompts
  v16_what_ai_remembers_extraction_system: {
    name: 'V16 What AI Remembers Extraction System Prompt',
    description: 'System prompt for extracting what AI should remember from conversations in V16 memory system',
    category: 'V16 Memory System',
    instructions: 'This system prompt guides the extraction of memory data from conversations for the V16 memory system.'
  },
  v16_what_ai_remembers_extraction_user: {
    name: 'V16 What AI Remembers Extraction User Prompt',
    description: 'User prompt for extracting what AI should remember from conversations in V16 memory system',
    category: 'V16 Memory System',
    instructions: 'This user prompt structures the conversation analysis for memory extraction in the V16 system.'
  },
  v16_what_ai_remembers_profile_merge_system: {
    name: 'V16 What AI Remembers Profile Merge System Prompt',
    description: 'System prompt for merging AI memory profile data in V16 memory system',
    category: 'V16 Memory System',
    instructions: 'This system prompt guides the merging of new memory data with existing profiles in the V16 system.'
  },
  v16_what_ai_remembers_profile_merge_user: {
    name: 'V16 What AI Remembers Profile Merge User Prompt',
    description: 'User prompt for merging AI memory profile data in V16 memory system',
    category: 'V16 Memory System',
    instructions: 'This user prompt structures the merging process for AI memory profile data in the V16 system.'
  },
  // V16 Specialist AI Prompts
  triage: {
    name: 'Triage AI Prompt',
    description: 'Initial assessment AI that routes users to appropriate specialists',
    category: 'V16 Triage System',
    instructions: 'This is the main triage AI that conducts initial assessment, ensures safety, and routes users to appropriate specialists.'
  },
  crisis_specialist: {
    name: 'Crisis Specialist AI',
    description: 'Handles immediate safety concerns, suicide prevention, and crisis intervention',
    category: 'V16 Specialists',
    instructions: 'Crisis intervention specialist focused on immediate safety stabilization and crisis de-escalation.'
  },
  anxiety_specialist: {
    name: 'Anxiety Specialist AI',
    description: 'Specialized support for panic attacks, social anxiety, phobias, and GAD',
    category: 'V16 Specialists',
    instructions: 'Anxiety specialist using CBT-based interventions, grounding techniques, and exposure planning.'
  },
  depression_specialist: {
    name: 'Depression Specialist AI',
    description: 'Support for depression, mood difficulties, grief, and loss',
    category: 'V16 Specialists',
    instructions: 'Depression specialist focused on behavioral activation, mood tracking, and interpersonal support.'
  },
  trauma_specialist: {
    name: 'Trauma Specialist AI',
    description: 'PTSD support, trauma processing, and trauma-informed care',
    category: 'V16 Specialists',
    instructions: 'Trauma specialist using trauma-informed principles, stabilization techniques, and body-based interventions.'
  },
  substance_use_specialist: {
    name: 'Substance Use Specialist AI',
    description: 'Addiction support, recovery guidance, and harm reduction',
    category: 'V16 Specialists',
    instructions: 'Substance use specialist using motivational interviewing, harm reduction, and recovery support.'
  },
  practical_support_specialist: {
    name: 'Practical Support Specialist AI',
    description: 'Resource location, basic needs assistance, and life skills',
    category: 'V16 Specialists',
    instructions: 'Practical support specialist focused on resource location, benefits navigation, and life skills coaching.'
  },
  cbt_specialist: {
    name: 'CBT Specialist AI',
    description: 'Cognitive Behavioral Therapy techniques and thought pattern work',
    category: 'V16 Specialists',
    instructions: 'CBT specialist focused on thought records, behavioral experiments, and cognitive restructuring.'
  },
  dbt_specialist: {
    name: 'DBT Specialist AI',
    description: 'Dialectical Behavior Therapy, emotional regulation, and interpersonal skills',
    category: 'V16 Specialists',
    instructions: 'DBT specialist focused on distress tolerance, emotion regulation, and interpersonal effectiveness.'
  },
  universal: {
    name: 'Universal Specialist Protocols',
    description: 'Common protocols and instructions shared by all V16 specialist AIs',
    category: 'V16 System',
    instructions: 'Universal protocols that are automatically appended to all specialist AI prompts for consistent handoff procedures, crisis escalation, and session continuity.'
  }
};

export default function V16PromptPage() {
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
  const [functionTemplates, setFunctionTemplates] = useState<Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    function_definition: Record<string, unknown>;
  }>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  // Helper function to parse function names from JSON string
  const getFunctionNames = (): string[] => {
    try {
      const parsedFunctions = JSON.parse(functions);
      if (Array.isArray(parsedFunctions)) {
        return parsedFunctions
          .filter(func => func && typeof func === 'object' && func.name)
          .map(func => func.name);
      }
    } catch (error) {
      // Return empty array for invalid JSON
      console.log('error: ', error)
    }
    return [];
  };
  const [isLoadingFunctionTemplates, setIsLoadingFunctionTemplates] = useState(false);
  const [universalFunctions, setUniversalFunctions] = useState('[]');
  const [mergeWithUniversalFunctions, setMergeWithUniversalFunctions] = useState(true);
  const [isLoadingUniversalFunctions, setIsLoadingUniversalFunctions] = useState(false);
  const [functionValidationResult, setFunctionValidationResult] = useState<{
    valid: boolean;
    errors: string[];
  } | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<'prompts' | 'functions'>('prompts');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Get prompt config
  const promptConfig = V16_PROMPT_CONFIGS[promptId as keyof typeof V16_PROMPT_CONFIGS];

  // Skip universal merge only for 'universal' prompt itself (allow triage to be configurable)
  const shouldShowMerge = promptId !== 'universal';

  // Skip universal function merge for 'universal_functions' itself
  const shouldShowMergeFunctions = promptId !== 'universal_functions';

  // Calculate merged prompt content
  const mergedContent = shouldShowMerge && mergeWithUniversal && universalProtocols
    ? `${content}\\n\\n--- UNIVERSAL SPECIALIST PROTOCOLS ---\\n\\n${universalProtocols}`
    : content;

  // Calculate merged functions content
  const getMergedFunctions = () => {
    try {
      const specialistFunctions = JSON.parse(functions);
      if (!shouldShowMergeFunctions || !mergeWithUniversalFunctions) {
        return JSON.stringify(specialistFunctions, null, 2);
      }

      const universalFuncs = JSON.parse(universalFunctions);
      const mergedArray = [...specialistFunctions, ...universalFuncs];
      return JSON.stringify(mergedArray, null, 2);
    } catch {
      return functions;
    }
  };

  const mergedFunctions = getMergedFunctions();

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
      console.log(`[V16] 📡 ADMIN: Loading current prompt for ${promptId} (API type: ${apiPromptType})`);
      const response = await fetch(`/api/v16/admin/ai-prompts?type=${apiPromptType}`);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.prompt) {
          console.log(`[V16] ✅ ADMIN: Current prompt loaded`, {
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
          console.log(`[V16] 📭 ADMIN: No prompt found for ${promptId}`);
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
      console.error(`[V16] ❌ ADMIN: Error loading current prompt:`, error);
      setStatusMessage(`Error loading current prompt: ${(error as Error).message}`);
    } finally {
      setIsLoadingCurrent(false);
    }
  };

  const loadUniversalProtocols = async () => {
    setIsLoadingUniversal(true);
    try {
      console.log(`[V16] 📡 ADMIN: Loading universal protocols`);
      const response = await fetch(`/api/v16/admin/ai-prompts?type=universal`);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.prompt) {
          console.log(`[V16] ✅ ADMIN: Universal protocols loaded`);
          setUniversalProtocols(data.prompt.prompt_content || '');
        } else {
          console.log(`[V16] 📭 ADMIN: No universal protocols found`);
          setUniversalProtocols('');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      console.error(`[V16] ❌ ADMIN: Error loading universal protocols:`, error);
      setUniversalProtocols('');
    } finally {
      setIsLoadingUniversal(false);
    }
  };

  const loadUniversalFunctions = async () => {
    setIsLoadingUniversalFunctions(true);
    try {
      console.log(`[V16] 📡 ADMIN: Loading universal functions`);
      const response = await fetch(`/api/v16/admin/ai-prompts?type=universal_functions`);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.prompt) {
          console.log(`[V16] ✅ ADMIN: Universal functions loaded`);
          setUniversalFunctions(JSON.stringify(data.prompt.functions || [], null, 2));
        } else {
          console.log(`[V16] 📭 ADMIN: No universal functions found`);
          setUniversalFunctions('[]');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      console.error(`[V16] ❌ ADMIN: Error loading universal functions:`, error);
      setUniversalFunctions('[]');
    } finally {
      setIsLoadingUniversalFunctions(false);
    }
  };

  const loadFunctionTemplates = async () => {
    try {
      setIsLoadingFunctionTemplates(true);
      console.log(`[V16] 📡 ADMIN: Loading function templates`);
      const response = await fetch('/api/v16/admin/function-templates');

      if (response.ok) {
        const data = await response.json();
        console.log(`[V16] 📊 ADMIN: API response:`, data);
        if (data.success) {
          console.log(`[V16] ✅ ADMIN: Function templates loaded:`, data.templates.length);
          console.log(`[V16] 📋 ADMIN: Sample templates:`, data.templates.slice(0, 3));
          setFunctionTemplates(data.templates);
        } else {
          console.error(`[V16] ❌ ADMIN: API returned error:`, data.error);
        }
      } else {
        console.error(`[V16] ❌ ADMIN: Error loading function templates:`, response.status);
        const errorText = await response.text();
        console.error(`[V16] ❌ ADMIN: Error response:`, errorText);
      }
    } catch (error) {
      console.error(`[V16] ❌ ADMIN: Error loading function templates:`, error);
    } finally {
      setIsLoadingFunctionTemplates(false);
    }
  };

  const addTemplateFunction = () => {
    if (!selectedTemplate) return;

    const template = functionTemplates.find(t => t.id === selectedTemplate);
    if (!template) return;

    try {
      const currentFunctions = JSON.parse(functions);
      const newFunction = template.function_definition;

      // Check if function already exists
      const exists = currentFunctions.some((f: Record<string, unknown>) => f.name === newFunction.name);
      if (exists) {
        setStatusMessage(`Function "${newFunction.name}" already exists`);
        return;
      }

      const updatedFunctions = [...currentFunctions, newFunction];
      setFunctions(JSON.stringify(updatedFunctions, null, 2));
      setSelectedTemplate('');
      setStatusMessage(`Added function "${newFunction.name}"`);
    } catch {
      setStatusMessage('Error adding function - invalid JSON format');
    }
  };

  const validateFunctions = () => {
    try {
      const functionsArray = JSON.parse(functions);
      const errors: string[] = [];

      if (!Array.isArray(functionsArray)) {
        errors.push('Functions must be an array');
      } else {
        functionsArray.forEach((func: Record<string, unknown>, index: number) => {
          if (!func.type || func.type !== 'function') {
            errors.push(`Function ${index + 1}: Missing or invalid 'type' field`);
          }
          if (!func.name || typeof func.name !== 'string') {
            errors.push(`Function ${index + 1}: Missing or invalid 'name' field`);
          }
          if (!func.description || typeof func.description !== 'string') {
            errors.push(`Function ${index + 1}: Missing or invalid 'description' field`);
          }
          if (!func.parameters || typeof func.parameters !== 'object') {
            errors.push(`Function ${index + 1}: Missing or invalid 'parameters' field`);
          }
        });
      }

      setFunctionValidationResult({
        valid: errors.length === 0,
        errors
      });

      setStatusMessage(errors.length === 0 ? 'Functions validation passed!' : `Validation failed: ${errors.length} errors found`);
    } catch {
      setFunctionValidationResult({
        valid: false,
        errors: ['Invalid JSON format']
      });
      setStatusMessage('Validation failed: Invalid JSON format');
    }
  };

  // Load current prompt when component mounts
  useEffect(() => {
    if (promptConfig) {
      loadCurrentPrompt();
      loadUniversalProtocols();
      loadUniversalFunctions();
      loadFunctionTemplates();
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
      console.log(`[V16] 💾 ADMIN: Saving prompt for ${promptId}`, {
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
        console.log(`[V16] ✅ ADMIN: Prompt saved successfully`, {
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
      console.error(`[V16] ❌ ADMIN: Error saving prompt:`, error);
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
      <div className="max-w-4xl mx-auto p-6 pt-24">
        <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 p-4 rounded-md">
          <h1 className="text-xl font-bold mb-2">Invalid V16 Prompt ID</h1>
          <p>The prompt ID &apos;{promptId}&apos; is not recognized as a valid V16 prompt type.</p>
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
          className="flex items-center space-x-2 text-purple-600 hover:text-purple-800 mr-4"
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
              {promptId === 'triage' && (
                <>
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                    <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2">
                      Memory Integration for Signed-in Users
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                      If a user is signed in, the triage AI system prompt and user history will be merged as follows:
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
{`IMPORTANT: Always communicate in \${languagePreference} unless the user explicitly requests a different language. The user has selected \${languagePreference} as their preferred language for this conversation.`}
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
                        src/app/api/v16/load-prompt/route.ts
                      </code>
                    </p>
                  </div>
                </>
              )}
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
                          ✅ This is the complete prompt that will be sent to the AI when this specialist is activated.
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
                placeholder='{"category": "purple"}'
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional metadata for this prompt. Must be valid JSON.
              </p>
            </div>

            <button
              onClick={savePrompt}
              disabled={isLoading}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center space-x-2"
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

        {/* Functions Tab */}
        {activeTab === 'functions' && (
          <div className="space-y-6">
            {/* Function Template Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Add Function from Template
              </label>
              <div className="flex space-x-2">
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  disabled={isLoadingFunctionTemplates}
                  className="flex-1 min-w-0 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                >
                  <option value="">
                    {isLoadingFunctionTemplates ? 'Loading templates...' : 'Select a function template...'}
                  </option>
                  {(() => {
                    console.log(`[V16] 🔍 ADMIN: Rendering dropdown with ${functionTemplates.length} templates`);
                    return functionTemplates
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} - {template.description}
                        </option>
                      ));
                  })()}
                </select>
                <button
                  onClick={addTemplateFunction}
                  disabled={!selectedTemplate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Add Function
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Select a function template to add to this AI&apos;s function list.
              </p>
            </div>

            {/* Functions JSON Editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Functions (JSON Array)
                </label>
                <button
                  onClick={validateFunctions}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Validate Functions
                </button>
              </div>

              {/* Function Names List */}
              {(() => {
                const functionNames = getFunctionNames();
                if (functionNames.length > 0) {
                  return (
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-600">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {promptId === 'universal'
                          ? `Universal Functions (${functionNames.length}) - Shared by ALL AIs:`
                          : `Functions for this AI (${functionNames.length}):`
                        }
                      </h4>
                      {promptId === 'universal' && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mb-3 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-800">
                          ℹ️ These functions are automatically merged with each specialist AI&apos;s specific functions
                        </p>
                      )}
                      <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        {functionNames.map((name, index) => (
                          <li key={index} className="flex items-start">
                            <span className="font-mono text-xs text-gray-500 dark:text-gray-500 mr-2 mt-0.5">
                              {index + 1}.
                            </span>
                            <span className="font-mono text-blue-600 dark:text-blue-400">
                              {name}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  );
                } else {
                  return (
                    <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        No functions defined for this AI
                      </p>
                    </div>
                  );
                }
              })()}
              <textarea
                value={functions}
                onChange={(e) => setFunctions(e.target.value)}
                rows={20}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                placeholder="[]"
              />
              <p className="text-xs text-gray-500 mt-1">
                JSON array of function definitions that this AI can call. Each function should have type, name, description, and parameters fields.
              </p>

              {/* Function Validation Results */}
              {functionValidationResult && (
                <div className={`mt-2 p-3 rounded-md ${functionValidationResult.valid
                    ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200'
                    : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200'
                  }`}>
                  {functionValidationResult.valid ? (
                    <p>✅ Functions validation passed!</p>
                  ) : (
                    <div>
                      <p className="font-medium">❌ Validation failed:</p>
                      <ul className="mt-1 text-sm">
                        {functionValidationResult.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Universal Functions Merge Section */}
            {shouldShowMergeFunctions && (
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Universal Functions Integration
                  </h3>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={mergeWithUniversalFunctions}
                      onChange={(e) => setMergeWithUniversalFunctions(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Merge with Universal Functions
                    </span>
                  </label>
                </div>

                {isLoadingUniversalFunctions ? (
                  <div className="text-center py-4">
                    <div className="text-gray-500">Loading universal functions...</div>
                  </div>
                ) : universalFunctions !== '[]' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Universal Functions (Read-only)
                      </label>
                      <textarea
                        value={universalFunctions}
                        readOnly
                        rows={10}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        These functions are automatically appended when enabled.
                        <a href="/chatbotV16/admin" target="_blank" className="text-blue-600 hover:text-blue-800 ml-1">
                          Edit Universal Functions
                        </a>
                      </p>
                    </div>

                    {mergeWithUniversalFunctions && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Final Merged Functions (What API Returns)
                        </label>
                        <textarea
                          value={mergedFunctions}
                          readOnly
                          rows={25}
                          className="w-full p-3 border border-green-300 dark:border-green-600 rounded-md bg-green-50 dark:bg-green-900/20 text-gray-900 dark:text-gray-100 font-mono text-sm"
                        />
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          ✅ This is the complete function list that will be available to the AI when this specialist is activated.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200 rounded-md">
                    <p>No universal functions configured yet.</p>
                  </div>
                )}
              </div>
            )}

            {/* Save Button for Functions */}
            <button
              onClick={savePrompt}
              disabled={isLoading}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center space-x-2"
            >
              <Save size={20} />
              <span>{isLoading ? 'Saving...' : `Save ${promptConfig.name} Functions`}</span>
            </button>

            {/* Current Functions Display */}
            <div className="mt-8">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Current Functions (In Database)
              </h3>
              {isLoadingCurrent ? (
                <div className="text-center py-4">
                  <div className="text-gray-500">Loading current functions...</div>
                </div>
              ) : currentPrompt?.functions ? (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-md border">
                  <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                    {JSON.stringify(currentPrompt.functions, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200 rounded-md">
                  <p className="font-medium">No functions found in database</p>
                  <p className="text-sm">This {promptConfig.name.toLowerCase()} has no functions configured yet. Add functions above and save to create them.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}