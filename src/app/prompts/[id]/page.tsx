import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

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

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function AIPromptPage({ params }: PageProps) {
  const { id } = await params
  // Using imported supabase client

  const { data: prompt, error } = await supabase
    .from('ai_prompts')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (error || !prompt) {
    notFound()
  }

  const typedPrompt = prompt as AIPrompt

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link 
            href="/prompts"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Prompts
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            {typedPrompt.prompt_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </h1>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-gray-900">AI Specialist Prompt</h2>
                <p className="text-sm text-gray-600">
                  Last updated: {new Date(typedPrompt.updated_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                  Active
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                  {typedPrompt.functions?.length || 0} functions
                </span>
              </div>
            </div>
          </div>

          {/* Prompt Content */}
          <div className="px-6 py-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Prompt Instructions</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                {typedPrompt.prompt_content}
              </pre>
            </div>
          </div>

          {/* Voice Settings */}
          {typedPrompt.voice_settings && (
            <div className="px-6 py-4 border-t border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Voice Settings</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="text-sm text-gray-800 font-mono">
                  {JSON.stringify(typedPrompt.voice_settings, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Functions */}
          {typedPrompt.functions && typedPrompt.functions.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Available Functions</h3>
              <div className="space-y-4">
                {typedPrompt.functions.map((func, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-md font-medium text-gray-900">{String(func.name || 'Unnamed Function')}</h4>
                      <span className="text-sm text-gray-500">Function {index + 1}</span>
                    </div>
                    {typeof func.description === 'string' && func.description && (
                      <p className="text-sm text-gray-600 mb-3">{func.description}</p>
                    )}
                    <details className="group">
                      <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 mb-2">
                        View Function Definition
                      </summary>
                      <div className="bg-white rounded border p-3 mt-2">
                        <pre className="text-xs text-gray-800 font-mono overflow-x-auto">
                          {JSON.stringify(func, null, 2)}
                        </pre>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          {typedPrompt.metadata && (
            <div className="px-6 py-4 border-t border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Metadata</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="text-sm text-gray-800 font-mono">
                  {JSON.stringify(typedPrompt.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div>
                <span>Created: {new Date(typedPrompt.created_at).toLocaleDateString()}</span>
              </div>
              <div>
                <span>ID: {typedPrompt.id}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}