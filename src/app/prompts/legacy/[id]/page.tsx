import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

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

interface PromptVersion {
  id: string
  prompt_id: string
  content: string
  version_number: number
  title: string
  notes: string
  created_by: string
  created_at: string
  updated_at: string
}

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function LegacyPromptPage({ params }: PageProps) {
  const { id } = await params
  // Using imported supabase client

  const { data: prompt, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (error || !prompt) {
    notFound()
  }

  // Get latest version of the prompt
  const { data: versions } = await supabase
    .from('prompt_versions')
    .select('*')
    .eq('prompt_id', id)
    .order('version_number', { ascending: false })

  const typedPrompt = prompt as LegacyPrompt
  const typedVersions = versions as PromptVersion[] || []
  const latestVersion = typedVersions[0]

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
          <h1 className="text-3xl font-bold text-gray-900">{typedPrompt.name}</h1>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Legacy Prompt</h2>
                <p className="text-sm text-gray-600">
                  Last updated: {new Date(typedPrompt.updated_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800">
                  {typedPrompt.category}
                </span>
                {typedPrompt.is_global && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800">
                    Global
                  </span>
                )}
                {typedVersions.length > 0 && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                    v{latestVersion.version_number}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {typedPrompt.description && (
            <div className="px-6 py-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Description</h3>
              <p className="text-gray-700">{typedPrompt.description}</p>
            </div>
          )}

          {/* Latest Version Content */}
          {latestVersion && (
            <div className="px-6 py-4 border-t border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-3">
                Latest Version Content
                {latestVersion.title && (
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    - {latestVersion.title}
                  </span>
                )}
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                  {latestVersion.content}
                </pre>
              </div>
              {latestVersion.notes && (
                <div className="mt-3">
                  <h4 className="text-sm font-medium text-gray-900 mb-1">Version Notes</h4>
                  <p className="text-sm text-gray-600">{latestVersion.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Version History */}
          {typedVersions.length > 1 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Version History</h3>
              <div className="space-y-3">
                {typedVersions.map((version) => (
                  <div key={version.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          Version {version.version_number}
                        </span>
                        {version.title && (
                          <span className="text-sm text-gray-600">- {version.title}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Created: {new Date(version.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <details className="group">
                      <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                        View Content
                      </summary>
                      <div className="absolute right-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-10">
                        <pre className="whitespace-pre-wrap text-xs text-gray-800 font-mono max-h-40 overflow-y-auto">
                          {version.content}
                        </pre>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prompt Details */}
          <div className="px-6 py-4 border-t border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Prompt Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {typedPrompt.greeting_type && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Greeting Type</label>
                  <p className="text-sm text-gray-900 bg-gray-50 rounded px-3 py-2">
                    {typedPrompt.greeting_type}
                  </p>
                </div>
              )}
              {typedPrompt.book_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Book ID</label>
                  <p className="text-sm text-gray-900 bg-gray-50 rounded px-3 py-2">
                    {typedPrompt.book_id}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
                <p className="text-sm text-gray-900 bg-gray-50 rounded px-3 py-2">
                  {typedPrompt.created_by}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                <p className="text-sm text-gray-900 bg-gray-50 rounded px-3 py-2">
                  {typedPrompt.is_global ? 'Global' : 'Local'}
                </p>
              </div>
            </div>
          </div>

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