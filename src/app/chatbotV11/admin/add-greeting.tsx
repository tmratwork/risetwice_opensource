'use client';

import { useState } from 'react';
import { createPrompt, assignPromptToUser } from '@/lib/prompts';

export default function AddGreetingPrompt() {
  const [userId, setUserId] = useState('');
  const [promptName, setPromptName] = useState('');
  const [promptDescription, setPromptDescription] = useState('');
  const [promptContent, setPromptContent] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // First verify the prompt tables exist and have the right structure
      const setupResponse = await fetch('/api/v11/setup-prompt-tables');
      
      if (!setupResponse.ok) {
        throw new Error(`Failed to set up prompt tables: ${setupResponse.status}`);
      }
      
      console.log('Setup tables response:', await setupResponse.json());
      
      // Create the prompt
      console.log('Creating prompt with:', { promptName, promptDescription, promptContent, userId });
      
      const promptId = await createPrompt(
        promptName,
        promptDescription,
        promptContent,
        'greeting', // Category for greeting prompts
        userId, // Created by the same user it's assigned to
        false // Not global
      );

      if (!promptId) {
        throw new Error('Failed to create prompt - no ID returned');
      }

      console.log('Prompt created with ID:', promptId);

      // Get the prompt version ID (first version)
      const response = await fetch('/api/v11/prompt-versions?promptId=' + promptId);
      
      if (!response.ok) {
        const responseText = await response.text();
        console.error('Prompt versions API error:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          response: responseText
        });
        throw new Error(`Failed to get prompt version ID: ${response.status} ${response.statusText}`);
      }
      
      const responseText = await response.text();
      console.log('Prompt versions API response text:', responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError, 'Response was:', responseText);
        throw new Error('Failed to parse prompt versions response');
      }

      console.log('Parsed versions result:', result);
      
      if (!result.data || result.data.length === 0) {
        throw new Error('No prompt versions found');
      }

      const versionId = result.data[0].id;
      console.log('Using version ID:', versionId);

      // Assign the prompt to the user
      const assigned = await assignPromptToUser(
        userId,
        versionId,
        userId // Assigned by the same user
      );

      console.log('Prompt assignment result:', assigned);
      
      setSuccess('Custom greeting prompt added and assigned successfully!');
    } catch (err) {
      console.error('Error adding greeting prompt:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Add Custom Greeting Prompt</h1>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4" role="alert">
          <p>{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="userId" className="block text-sm font-medium">
            User ID
          </label>
          <input
            type="text"
            id="userId"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>

        <div>
          <label htmlFor="promptName" className="block text-sm font-medium">
            Prompt Name
          </label>
          <input
            type="text"
            id="promptName"
            value={promptName}
            onChange={(e) => setPromptName(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>

        <div>
          <label htmlFor="promptDescription" className="block text-sm font-medium">
            Prompt Description
          </label>
          <input
            type="text"
            id="promptDescription"
            value={promptDescription}
            onChange={(e) => setPromptDescription(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>

        <div>
          <label htmlFor="promptContent" className="block text-sm font-medium">
            Greeting Instructions
          </label>
          <textarea
            id="promptContent"
            value={promptContent}
            onChange={(e) => setPromptContent(e.target.value)}
            rows={10}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
          <p className="mt-1 text-sm text-gray-500">
            Instructions for the AI on how to greet the user.
          </p>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Add Custom Greeting'}
          </button>
        </div>
      </form>
    </div>
  );
}