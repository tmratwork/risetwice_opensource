'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

export default function V15AdminPage() {

  const v15Prompts = [
    {
      id: 'profile_analysis_system',
      name: 'Profile Analysis System Prompt',
      description: 'System prompt for extracting insights from conversation transcripts (Stage 1)',
      category: 'Memory System'
    },
    {
      id: 'profile_analysis_user',
      name: 'Profile Analysis User Prompt',
      description: 'User prompt for structuring conversation analysis and insight extraction (Stage 1)',
      category: 'Memory System'
    },
    {
      id: 'profile_merge_system',
      name: 'Profile Merge System Prompt',
      description: 'System prompt for merging user profile data from conversation analysis (Stage 2)',
      category: 'Memory System'
    },
    {
      id: 'profile_merge_user',
      name: 'Profile Merge User Prompt',
      description: 'User prompt for merging user profile data from conversation analysis (Stage 2)',
      category: 'Memory System'
    },
    {
      id: 'ai_summary_prompt',
      name: 'AI Summary Prompt',
      description: 'Prompt for generating concise AI instruction summaries from user profiles',
      category: 'Memory System'
    },
    {
      id: 'warm_handoff_analysis_system',
      name: 'Warm Handoff Analysis System Prompt',
      description: 'System prompt for analyzing individual conversations to extract warm handoff insights',
      category: 'Warm Handoff'
    },
    {
      id: 'warm_handoff_analysis_user',
      name: 'Warm Handoff Analysis User Prompt',
      description: 'User prompt for extracting structured insights from individual conversations',
      category: 'Warm Handoff'
    },
    {
      id: 'warm_handoff_system',
      name: 'Warm Handoff Merge System Prompt',
      description: 'System prompt for merging conversation insights into warm handoff summaries',
      category: 'Warm Handoff'
    },
    {
      id: 'warm_handoff_user',
      name: 'Warm Handoff Merge User Prompt',
      description: 'User prompt for combining insights into final warm handoff summary sheets',
      category: 'Warm Handoff'
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
      id: 'user-memory',
      name: 'Process User Memory',
      description: 'Trigger memory processing (conversation analysis and profile update) for any user by entering their user ID',
      href: '/chatbotV15/admin/user-memory'
    },
    {
      id: 'conversation',
      name: 'View Conversation History',
      description: 'View all messages from a specific conversation by entering the conversation ID',
      href: '/chatbotV15/admin/conversation'
    },
    {
      id: 'usage',
      name: 'View Usage Report',
      description: 'View usage statistics and conversation activity from the past 7 days',
      href: '/chatbotV15/admin/usage'
    },
    {
      id: 'usage-stats',
      name: 'Usage Analytics',
      description: 'View detailed usage analytics including anonymous and authenticated users',
      href: '/chatbotV16/admin/usage-stats'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 pt-24">
      <h1 className="text-3xl font-bold mb-8">V15 Admin Dashboard</h1>

      <div className="grid gap-8">
        {/* V15 Memory System Prompts */}
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">V15 Memory System Prompts</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Configure V15 memory system prompts for conversation analysis and profile management.
          </p>

          <div className="grid gap-4">
            {v15Prompts.map((prompt) => (
              <div key={prompt.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">
                        {prompt.name}
                      </h3>
                      <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                        {prompt.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {prompt.description}
                    </p>
                  </div>
                  <Link
                    href={`/chatbotV15/admin/prompt/${prompt.id}`}
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

        {/* V16 Triage & Specialist AI: Prompts, Functions, (someday) Greeting Instructions*/}
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">V16 Triage & Specialist AI: Prompts, Functions, (someday) Greeting Instructions</h2>
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
                    href={`/chatbotV15/admin/v16-prompt/${prompt.id}`}
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