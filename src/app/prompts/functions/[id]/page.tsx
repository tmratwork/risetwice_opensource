import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface FunctionTemplate {
  id: string
  name: string
  description: string
  category: string
  function_definition: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function FunctionTemplatePage({ params }: PageProps) {
  const { id } = await params
  // Using imported supabase client

  const { data: functionTemplate, error } = await supabase
    .from('function_templates')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !functionTemplate) {
    notFound()
  }

  const typedFunction = functionTemplate as FunctionTemplate
  const hasDescription = typedFunction.description && typedFunction.description.length > 0
  const functionDefinition = typedFunction.function_definition as Record<string, unknown>

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
          <h1 className="text-3xl font-bold text-gray-900">{typedFunction.name}</h1>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Function Template</h2>
                <p className="text-sm text-gray-600">
                  Last updated: {new Date(typedFunction.updated_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                  {typedFunction.category}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          {hasDescription ? (
            <div className="px-6 py-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Description</h3>
              <p className="text-gray-700">{typedFunction.description}</p>
            </div>
          ) : null}

          <div className="px-6 py-4 border-t border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Function Definition</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="text-sm text-gray-800 font-mono overflow-x-auto">
                {JSON.stringify(functionDefinition, null, 2)}
              </pre>
            </div>
          </div>

          {/* Function Details */}
          {functionDefinition ? (
            <div className="px-6 py-4 border-t border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Function Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {functionDefinition.name && typeof functionDefinition.name === 'string' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <p className="text-sm text-gray-900 bg-gray-50 rounded px-3 py-2">
                      {functionDefinition.name as string}
                    </p>
                  </div>
                ) : null}
                {functionDefinition.description && typeof functionDefinition.description === 'string' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <p className="text-sm text-gray-900 bg-gray-50 rounded px-3 py-2">
                      {functionDefinition.description as string}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Parameters */}
          {functionDefinition?.parameters ? (
            <div className="px-6 py-4 border-t border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Parameters</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="text-sm text-gray-800 font-mono">
                  {JSON.stringify(functionDefinition.parameters, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div>
                <span>Created: {new Date(typedFunction.created_at).toLocaleDateString()}</span>
              </div>
              <div>
                <span>ID: {typedFunction.id}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}