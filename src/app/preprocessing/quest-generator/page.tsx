"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

// Define types for our API responses
interface QuestResult {
  success: boolean;
  message?: string;
  processedCount?: number;
  bookTitle?: string;
  quests?: Array<{
    id: string;
    book_id: string;
    chapter_number: number;
    chapter_title: string;
    quest_title: string;
    introduction: string;
    challenge: string;
    reward: string;
    starting_question: string;
    ai_prompt: string;
    created_at?: string;
  }>;
}

interface DeleteResult {
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
  deletedCounts?: {
    book_quests: number;
    user_quests: number;
  };
}

export default function QuestGeneratorPage() {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [results, setResults] = useState<QuestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [processCount, setProcessCount] = useState<number>(0);
  const [deleteConfirm, setDeleteConfirm] = useState<boolean>(false);
  const [useCustomPrompt, setUseCustomPrompt] = useState<boolean>(false);
  const [userId, setUserId] = useState<string>("");
  const router = useRouter();

  // The specific book ID we're targeting
  const bookId = "f95206aa-165e-4c49-b43a-69d91bef8ed4";

  const handleGenerateQuests = async () => {
    // Validate user ID if custom prompt is enabled
    if (useCustomPrompt && !userId.trim()) {
      setError("User ID is required when using custom prompt");
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(false);
    setResults(null);
    setProgressMessage("Starting quest generation process...");

    try {
      const payload = {
        bookId,
        ...(useCustomPrompt && userId ? { userId } : {})
      };

      const response = await fetch('/api/preprocessing/generate-quests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData: { error?: string; details?: string } = await response.json();
        throw new Error(errorData.error || 'Failed to generate quests');
      }

      const data: QuestResult = await response.json();
      setResults(data);
      setSuccess(true);
      setProcessCount(data.processedCount || 0);
      setProgressMessage(`Successfully generated ${data.processedCount || 0} quests!`);
    } catch (err) {
      console.error('Error generating quests:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setProgressMessage("Error occurred during quest generation.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewQuests = () => {
    router.push('/chatbotV11/quests');
  };

  const handleDeleteQuests = async () => {
    // Show confirmation prompt first
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setProgressMessage("Please confirm deletion by clicking the button again");
      return;
    }
    
    setDeleting(true);
    setError(null);
    setProgressMessage("Deleting quest data...");
    
    try {
      console.log('Making delete request for book ID:', bookId);
      
      let response;
      try {
        // Use a simpler API endpoint structure that's known to work
        response = await fetch('/api/preprocessing/delete-quests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bookId
          }),
        });
        
        console.log('Response status:', response.status, response.statusText);
        
        // Check if the endpoint was found
        if (response.status === 404) {
          throw new Error('Delete endpoint not found (404). Check server logs for details.');
        }
      } catch (fetchError) {
        console.error('Network error during delete request:', fetchError);
        // Type-safe error handling
        throw new Error(`Network error: ${fetchError instanceof Error ? fetchError.message : 'Unknown network error'}`);
      }

      const responseText = await response.text();
      console.log('Raw delete response:', responseText);

      let responseData: DeleteResult;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing response JSON:', parseError);
        throw new Error(`Failed to parse server response: ${responseText}`);
      }

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to delete quests');
      }

      setProgressMessage(`Successfully deleted all quest data for this book! ${responseData.message || ''}`);
      setDeleteConfirm(false);
      setSuccess(false);
    } catch (err) {
      console.error('Error deleting quests:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during deletion');
      setProgressMessage("Error occurred during quest deletion.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Mental Health Quests Generator</h1>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-bold mb-4">Generate Mental Health Practice Quests</h2>
        <p className="mb-4">
          This tool will generate quests based on the custom mental health practice quests data.
          The data will be saved to the Supabase database for use in the ChatbotV11 quests page.
        </p>
        <p className="mb-4 font-medium">
          Target Book ID: <span className="text-blue-600 dark:text-blue-400">{bookId}</span>
        </p>

        <div className="mb-4">
          <div className="flex items-center mb-2">
            <input
              type="checkbox"
              id="useCustomPrompt"
              checked={useCustomPrompt}
              onChange={(e) => setUseCustomPrompt(e.target.checked)}
              className="mr-2 h-4 w-4"
            />
            <label htmlFor="useCustomPrompt" className="font-medium">
              Use Custom Prompt
            </label>
          </div>
          
          {useCustomPrompt && (
            <div className="ml-6 mt-2">
              <label htmlFor="userId" className="block mb-1 font-medium">
                User ID:
              </label>
              <input
                type="text"
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter user ID"
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md w-full max-w-md"
                disabled={!useCustomPrompt}
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4 mt-6">
          <button
            onClick={handleGenerateQuests}
            disabled={loading || deleting || (useCustomPrompt && !userId.trim())}
            className={`px-4 py-2 rounded-md ${
              loading || deleting || (useCustomPrompt && !userId.trim())
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {loading ? 'Processing...' : useCustomPrompt ? 'Generate Custom Quests' : 'Generate Mental Health Quests'}
          </button>

          <button
            onClick={handleDeleteQuests}
            disabled={loading || deleting}
            className={`px-4 py-2 rounded-md ${
              deleteConfirm 
                ? 'bg-red-700 hover:bg-red-800 text-white'
                : deleting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {deleting ? 'Deleting...' : deleteConfirm ? 'Confirm Deletion' : 'Delete All Quest Data'}
          </button>

          {success && (
            <button
              onClick={handleViewQuests}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md"
            >
              View Quests
            </button>
          )}
        </div>
      </div>

      {/* Results Section */}
      {(loading || progressMessage) && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8">
          <h3 className="text-lg font-semibold mb-2">Progress</h3>
          {loading && (
            <div className="flex items-center mb-4">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500 mr-3"></div>
              <span>Processing quests...</span>
            </div>
          )}
          <p className="text-gray-700 dark:text-gray-300">{progressMessage}</p>
          {useCustomPrompt && userId && (
            <p className="mt-2 text-blue-600 dark:text-blue-400">
              Using custom prompt for user: {userId}
            </p>
          )}
          {processCount > 0 && (
            <p className="mt-4 font-semibold text-green-600 dark:text-green-400">
              Successfully processed {processCount} quests!
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-100 dark:bg-red-900 border-l-4 border-red-500 text-red-700 dark:text-red-200 p-4 mb-8">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {results && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-2">Results</h3>
          <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-md overflow-auto max-h-96">
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}