'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function V16AdminPage() {
  const { isAdmin, loading, error } = useAdminAuth();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 pt-24">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Verifying admin access...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if there was an issue checking permissions
  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6 pt-24">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
                Authentication Error
              </h2>
              <p className="text-red-600 dark:text-red-300 mb-4">{error}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Contact developers to gain access to these admin pages.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show access denied for non-admin users
  if (!isAdmin) {
    return (
      <div className="max-w-6xl mx-auto p-6 pt-24">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8">
              <div className="mb-4">
                <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                  <ExternalLink className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-blue-800 dark:text-blue-200 mb-3">
                Admin Access Required
              </h2>
              <p className="text-blue-600 dark:text-blue-300 mb-2">
                This page requires administrator privileges.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Contact developers to gain access to these admin pages.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render admin dashboard for authorized users

  const v16MemoryPrompts = [
    {
      id: 'v16_what_ai_remembers_extraction_system',
      name: 'V16 What AI Remembers Extraction System Prompt',
      description: 'System prompt for extracting what AI should remember from conversations in V16 memory system',
      category: 'V16 Memory System'
    },
    {
      id: 'v16_what_ai_remembers_extraction_user',
      name: 'V16 What AI Remembers Extraction User Prompt',
      description: 'User prompt for extracting what AI should remember from conversations in V16 memory system',
      category: 'V16 Memory System'
    },
    {
      id: 'v16_what_ai_remembers_profile_merge_system',
      name: 'V16 What AI Remembers Profile Merge System Prompt',
      description: 'System prompt for merging AI memory profile data in V16 memory system',
      category: 'V16 Memory System'
    },
    {
      id: 'v16_what_ai_remembers_profile_merge_user',
      name: 'V16 What AI Remembers Profile Merge User Prompt',
      description: 'User prompt for merging AI memory profile data in V16 memory system',
      category: 'V16 Memory System'
    },
    {
      id: 'v16_ai_summary_prompt',
      name: 'V16 AI Summary Generation Prompt',
      description: 'Prompt for generating up to 5-sentence AI instruction summaries from V16 user profile data',
      category: 'V16 Memory System'
    },
    {
      id: 'warm_handoff_system',
      name: 'V16 Warm Handoff System Prompt',
      description: 'System prompt for generating professional warm handoff summaries from V16 user profile data',
      category: 'V16 Warm Handoff'
    },
    {
      id: 'warm_handoff_user',
      name: 'V16 Warm Handoff User Prompt',
      description: 'User prompt template for generating professional warm handoff summaries from V16 user profile data',
      category: 'V16 Warm Handoff'
    }
  ];

  const v15Prompts = [
    {
      id: 'profile_analysis_system',
      name: 'What AI Remembers / Profile Analysis System Prompt',
      description: 'System prompt for extracting insights from conversation transcripts (Stage 1)',
      category: 'Memory System'
    },
    {
      id: 'profile_analysis_user',
      name: 'What AI Remembers / Profile Analysis User Prompt',
      description: 'User prompt for structuring conversation analysis and insight extraction (Stage 1)',
      category: 'Memory System'
    },
    {
      id: 'profile_merge_system',
      name: 'What AI Remembers / Profile Merge System Prompt',
      description: 'System prompt for merging user profile data from conversation analysis (Stage 2)',
      category: 'Memory System'
    },
    {
      id: 'profile_merge_user',
      name: 'What AI Remembers / Profile Merge User Prompt',
      description: 'User prompt for merging user profile data from conversation analysis (Stage 2)',
      category: 'Memory System'
    },
    {
      id: 'ai_summary_prompt',
      name: 'AI Summary Prompt',
      description: 'Prompt for generating concise AI instruction summaries from user profiles, that are inserted into system prompt of new conversations',
      category: 'Memory System'
    },
    {
      id: 'warm_handoff_analysis_system',
      name: 'V15 Warm Handoff Analysis System Prompt',
      description: 'V15-specific system prompt for analyzing individual conversations to extract warm handoff insights',
      category: 'V15 Warm Handoff'
    },
    {
      id: 'warm_handoff_analysis_user',
      name: 'V15 Warm Handoff Analysis User Prompt',
      description: 'V15-specific user prompt for extracting structured insights from individual conversations',
      category: 'V15 Warm Handoff'
    },
    {
      id: 'insights_system',
      name: 'User Insights System Prompt',
      description: 'System prompt for analyzing conversations to extract user insights (personal development focus)',
      category: 'User Insights'
    },
    {
      id: 'insights_user',
      name: 'User Insights User Prompt',
      description: 'User prompt for structuring conversation analysis and insight extraction (personal development focus)',
      category: 'User Insights'
    }
  ];

  const v16Prompts = [
    {
      id: 'triage',
      name: 'Triage AI Prompt',
      description: 'Initial assessment AI that routes users to appropriate specialists',
      category: 'V16 Triage System'
    },
    {
      id: 'crisis_specialist',
      name: 'Crisis Specialist AI',
      description: 'Handles immediate safety concerns, suicide prevention, and crisis intervention',
      category: 'V16 Specialists'
    },
    {
      id: 'anxiety_specialist',
      name: 'Anxiety Specialist AI',
      description: 'Specialized support for panic attacks, social anxiety, phobias, and GAD',
      category: 'V16 Specialists'
    },
    {
      id: 'depression_specialist',
      name: 'Depression Specialist AI',
      description: 'Support for depression, mood difficulties, grief, and loss',
      category: 'V16 Specialists'
    },
    {
      id: 'trauma_specialist',
      name: 'Trauma Specialist AI',
      description: 'PTSD support, trauma processing, and trauma-informed care',
      category: 'V16 Specialists'
    },
    {
      id: 'substance_use_specialist',
      name: 'Substance Use Specialist AI',
      description: 'Addiction support, recovery guidance, and harm reduction',
      category: 'V16 Specialists'
    },
    {
      id: 'practical_support_specialist',
      name: 'Practical Support Specialist AI',
      description: 'Resource location, basic needs assistance, and life skills',
      category: 'V16 Specialists'
    },
    {
      id: 'cbt_specialist',
      name: 'CBT Specialist AI',
      description: 'Cognitive Behavioral Therapy techniques and thought pattern work',
      category: 'V16 Specialists'
    },
    {
      id: 'dbt_specialist',
      name: 'DBT Specialist AI',
      description: 'Dialectical Behavior Therapy, emotional regulation, and interpersonal skills',
      category: 'V16 Specialists'
    },
    {
      id: 'universal',
      name: 'Universal Specialist Protocols',
      description: 'Common protocols and instructions shared by all V16 specialist AIs',
      category: 'V16 System'
    }
  ];

  const otherFunctions = [
    {
      id: 'circle-approval',
      name: 'Circle Approval',
      description: 'Review and approve pending community circles created by users',
      href: '/chatbotV16/admin/circle-approval'
    },
    {
      id: 'greetings',
      name: 'Greeting Management',
      description: 'Manage multilingual greeting prompts for triage, resources, and crisis scenarios (57+ languages)',
      href: '/chatbotV16/admin/greetings'
    },
    {
      id: 'user-memory',
      name: 'Process User Memory',
      description: 'Trigger memory processing (conversation analysis and profile update) for any user by entering their user ID',
      href: '/chatbotV16/admin/user-memory'
    },
    {
      id: 'conversation',
      name: 'View Conversation History',
      description: 'View all messages from a specific conversation by entering the conversation ID',
      href: '/chatbotV16/admin/conversation'
    },
    {
      id: 'usage',
      name: 'Conversation Report',
      description: 'View usage statistics and conversation activity from the past 7 days',
      href: '/chatbotV16/admin/usage'
    },
    {
      id: 'usage-stats',
      name: 'Usage Analytics',
      description: 'View detailed usage analytics including anonymous and authenticated users',
      href: '/chatbotV16/admin/usage-stats'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 pt-24 overflow-y-auto h-full">
      <h1 className="text-3xl font-bold mb-8">V16 Admin Dashboard</h1>

      <div className="grid gap-8">
        {/* V16 Memory System Prompts */}
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">V16 Memory System Prompts</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Configure V16 memory system prompts used by the new /chatbotV16/memory page for &quot;What AI Remembers&quot; functionality and warm handoff generation.
          </p>

          <div className="grid gap-4">
            {v16MemoryPrompts.map((prompt) => (
              <div key={prompt.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">
                        {prompt.name}
                      </h3>
                      <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                        {prompt.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {prompt.description}
                    </p>
                  </div>
                  <Link
                    href={`/chatbotV16/admin/v16-memory-prompt/${prompt.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors ml-4"
                  >
                    <span>Edit</span>
                    <ExternalLink size={16} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* V15 Memory System Prompts */}
        <div className="bg-gray-700 dark:bg-gray-900 shadow-md rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <h2 className="text-xl font-semibold text-white">V15 Memory System Prompts</h2>
            <span className="px-3 py-1 text-sm bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full">
              Legacy (not used)
            </span>
          </div>
          <p className="text-sm text-gray-200 mb-6">
            Legacy V15 memory system prompts for conversation analysis and profile management. These are not used by the new V16 system.
          </p>

          <div className="grid gap-4">
            {v15Prompts.map((prompt) => (
              <div key={prompt.id} className="border border-gray-500 rounded-lg p-4 bg-gray-600">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-medium text-white">
                        {prompt.name}
                      </h3>
                      <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                        {prompt.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-200">
                      {prompt.description}
                    </p>
                  </div>
                  <Link
                    href={`/chatbotV15/admin/prompt/${prompt.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-500 text-gray-300 rounded-md hover:bg-gray-600 transition-colors ml-4"
                  >
                    <span>Edit</span>
                    <ExternalLink size={16} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* V16 Triage & Specialist AI: Prompts, Functions, (someday) Greeting Instructions*/}
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">V16 Triage &amp; Specialist AI: Prompts, Functions, (someday) Greeting Instructions</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Configure V16 triage and specialist AI instructions. These prompts are used in the V16 hospital-style triage system where users are routed to appropriate specialists.
          </p>

          <div className="grid gap-4">
            {v16Prompts.map((prompt) => (
              <div key={prompt.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">
                        {prompt.name}
                      </h3>
                      <span className={`px-2 py-1 text-xs rounded ${prompt.category === 'V16 Triage System'
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                        : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                        }`}>
                        {prompt.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {prompt.description}
                    </p>
                  </div>
                  <Link
                    href={`/chatbotV16/admin/v16-prompt/${prompt.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors ml-4"
                  >
                    <span>Edit</span>
                    <ExternalLink size={16} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Other Admin Functions */}
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Other Admin Functions</h2>

          <div className="grid gap-4">
            {otherFunctions.map((func) => (
              <div key={func.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {func.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {func.description}
                    </p>
                  </div>
                  <Link
                    href={func.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors ml-4"
                  >
                    <span>Edit</span>
                    <ExternalLink size={16} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}