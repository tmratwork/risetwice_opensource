import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface AIPrompt {
  id: string
  prompt_type: string
  prompt_content: string
  voice_settings: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  functions: Record<string, unknown>[]
  is_active: boolean
  created_at: string
  updated_at: string
}

interface FunctionTemplate {
  id: string
  name: string
  description: string
  category: string
  function_definition: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface LegacyPrompt {
  id: string
  name: string
  description: string
  category: string
  created_by: string
  is_active: boolean
  is_global: boolean
  book_id: string
  greeting_type: string
  created_at: string
  updated_at: string
}

export default async function PromptsPage() {
  // Using imported supabase client

  // Fetch V16 AI prompts
  const { data: aiPrompts, error: aiPromptsError } = await supabase
    .from('ai_prompts')
    .select('*')
    .eq('is_active', true)
    .order('prompt_type')

  // Fetch function templates
  const { data: functionTemplates, error: functionsError } = await supabase
    .from('function_templates')
    .select('*')
    .order('category', { ascending: true })

  // Fetch legacy prompts
  const { data: legacyPrompts, error: legacyError } = await supabase
    .from('prompts')
    .select('*')
    .eq('is_active', true)
    .order('category', { ascending: true })

  if (aiPromptsError || functionsError || legacyError) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">AI Prompts & Functions</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Error loading prompts and functions</p>
          </div>
        </div>
      </div>
    )
  }

  const typedAIPrompts = aiPrompts as AIPrompt[]
  const typedFunctionTemplates = functionTemplates as FunctionTemplate[]
  const typedLegacyPrompts = legacyPrompts as LegacyPrompt[]

  // Group prompts by category and keep only the most recent per category
  const groupedLegacyPrompts = typedLegacyPrompts.reduce((acc, prompt) => {
    if (!acc[prompt.category]) {
      acc[prompt.category] = []
    }
    acc[prompt.category].push(prompt)
    return acc
  }, {} as Record<string, LegacyPrompt[]>)

  // Keep only the most recent prompt per category
  const mostRecentPromptsByCategory = Object.keys(groupedLegacyPrompts).reduce((acc, category) => {
    const prompts = groupedLegacyPrompts[category]
    const mostRecent = prompts.reduce((latest, current) => {
      return new Date(current.created_at) > new Date(latest.created_at) ? current : latest
    })
    acc[category] = [mostRecent]
    return acc
  }, {} as Record<string, LegacyPrompt[]>)

  const groupedFunctionTemplates = typedFunctionTemplates.reduce((acc, func) => {
    if (!acc[func.category]) {
      acc[func.category] = []
    }
    acc[func.category].push(func)
    return acc
  }, {} as Record<string, FunctionTemplate[]>)

  // Memory system categories that should not have "Legacy" prefix
  const memorySystemCategories = new Set([
    'profile_analysis_system',
    'profile_analysis_user', 
    'profile_merge_system',
    'profile_merge_user',
    'ai_summary_prompt'
  ])

  // Separate memory system categories from legacy categories
  const memorySystemCategoriesArray = Object.keys(mostRecentPromptsByCategory).filter(category => 
    memorySystemCategories.has(category)
  )
  
  const legacyCategoriesArray = Object.keys(mostRecentPromptsByCategory).filter(category => 
    !memorySystemCategories.has(category)
  )

  // Get all categories for the navigation
  const allCategories = [
    // V16 AI Specialists
    { name: 'V16 AI Specialists', id: 'v16-specialists', count: typedAIPrompts.length },
    // Function categories
    ...Object.keys(groupedFunctionTemplates).map(category => ({
      name: `Functions: ${category}`,
      id: `functions-${category.replace(/\s+/g, '-').toLowerCase()}`,
      count: groupedFunctionTemplates[category].length
    })),
    // Memory system categories (without "Legacy" prefix)
    ...memorySystemCategoriesArray.map(category => ({
      name: category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      id: `legacy-${category.replace(/\s+/g, '-').toLowerCase()}`,
      count: mostRecentPromptsByCategory[category].length
    })),
    // Legacy categories (with "Legacy" prefix) - at the bottom
    ...legacyCategoriesArray.map(category => ({
      name: `Legacy: ${category}`,
      id: `legacy-${category.replace(/\s+/g, '-').toLowerCase()}`,
      count: mostRecentPromptsByCategory[category].length
    }))
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">AI Prompts & Functions</h1>
          <p className="text-gray-700">
            Explore the AI instructions and functions that power our mental health support system. 
            These prompts and functions are shared openly to encourage learning and feedback.
          </p>
        </div>

        {/* Category Navigation */}
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Browse by Category</h2>
          <div className="flex flex-wrap gap-2">
            {allCategories.map((category) => (
              <a
                key={category.id}
                href={`#${category.id}`}
                className="inline-flex items-center px-3 py-2 rounded-full text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
              >
                {category.name}
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs bg-gray-100 text-gray-600 rounded-full">
                  {category.count}
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* V16 AI Prompts Section */}
        <section id="v16-specialists" className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">V16 AI Specialists</h2>
          <div className="grid gap-4">
            {typedAIPrompts.map((prompt) => (
              <div key={prompt.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {prompt.prompt_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </h3>
                    <p className="text-gray-600 mb-3 line-clamp-2">
                      {prompt.prompt_content.slice(0, 200)}...
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>{prompt.functions?.length || 0} functions</span>
                      <span>Updated: {new Date(prompt.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Link 
                    href={`/prompts/${prompt.id}`}
                    className="ml-4 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Function Templates Section - Grouped by Category */}
        {Object.entries(groupedFunctionTemplates).map(([category, functions]) => (
          <section key={category} id={`functions-${category.replace(/\s+/g, '-').toLowerCase()}`} className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Functions: {category}</h2>
            <div className="grid gap-4">
              {functions.map((func) => (
                <div key={func.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">{func.name}</h3>
                      <p className="text-gray-600 mb-3">{func.description}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                          {func.category}
                        </span>
                        <span>Created: {new Date(func.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Link 
                      href={`/prompts/functions/${func.id}`}
                      className="ml-4 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      View Function
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Memory System Prompts Section - Without Legacy prefix */}
        {memorySystemCategoriesArray.map(category => (
          <section key={category} id={`legacy-${category.replace(/\s+/g, '-').toLowerCase()}`} className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </h2>
            <div className="grid gap-4">
              {mostRecentPromptsByCategory[category].map((prompt) => (
                <div key={prompt.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">{prompt.name}</h3>
                      <p className="text-gray-600 mb-3">{prompt.description}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                          {prompt.category}
                        </span>
                        <span>Created: {new Date(prompt.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Link 
                      href={`/prompts/legacy/${prompt.id}`}
                      className="ml-4 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      View Prompt
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Legacy Prompts Section - With Legacy prefix, at the bottom */}
        {legacyCategoriesArray.map(category => (
          <section key={category} id={`legacy-${category.replace(/\s+/g, '-').toLowerCase()}`} className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Legacy: {category}</h2>
            <div className="grid gap-4">
              {mostRecentPromptsByCategory[category].map((prompt) => (
                <div key={prompt.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">{prompt.name}</h3>
                      <p className="text-gray-600 mb-3">{prompt.description}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                          {prompt.category}
                        </span>
                        <span>Created: {new Date(prompt.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Link 
                      href={`/prompts/legacy/${prompt.id}`}
                      className="ml-4 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      View Prompt
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}