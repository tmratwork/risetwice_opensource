'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface PromptVersion {
  id: string;
  content: string;
  version_number: string;
  created_at: string;
  title: string | null;
  notes: string | null;
  prompts: {
    id: string;
    name: string;
    description: string;
    category: string;
    created_at: string;
    book_id?: string; // Optional book ID for book-specific prompts
  };
}

interface PromptAssignment {
  id: string;
  user_id: string;
  assigned_at: string;
  prompt_versions: PromptVersion;
}

// Interface for book details
interface Book {
  id: string;
  title: string;
  author: string;
}

export default function PromptHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PromptAssignment[]>([]);
  const [books, setBooks] = useState<{[key: string]: Book}>({}); 
  // loadingBooks state removed as it's not being used
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');
  const promptType = searchParams.get('type') || 'greeting'; // Default to greeting if no type specified
  const bookId = searchParams.get('bookId'); // Get book ID if provided

  // Add a function to fetch book details
  const fetchBookDetails = async (bookIds: string[]) => {
    if (bookIds.length === 0) return;
    
    try {
      const bookDetailsMap: {[key: string]: Book} = {};
      
      // Fetch book details for each book ID
      for (const id of bookIds) {
        try {
          const response = await fetch(`/api/v11/books?id=${encodeURIComponent(id)}`);
          if (response.ok) {
            const bookData = await response.json();
            if (bookData && bookData.length > 0) {
              bookDetailsMap[id] = {
                id: bookData[0].id,
                title: bookData[0].title,
                author: bookData[0].author
              };
            }
          }
        } catch (error) {
          console.error(`Error fetching book details for ID ${id}:`, error);
        }
      }
      
      setBooks(bookDetailsMap);
    } catch (error) {
      console.error('Error fetching book details:', error);
    }
  };

  useEffect(() => {
    if (!userId) {
      setError('User ID is required');
      setLoading(false);
      return;
    }

    const fetchHistory = async () => {
      try {
        // Build the URL with all parameters
        let url = `/api/v11/prompt-history?userId=${encodeURIComponent(userId)}&type=${encodeURIComponent(promptType)}`;
        
        // Add book ID filter if provided
        if (bookId) {
          url += `&bookId=${encodeURIComponent(bookId)}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
          setHistory(result.data);
          
          // Extract book IDs from the history data for book-specific prompts
          if (promptType === 'quest_generation') {
            const bookIds = result.data
              .filter((item: PromptAssignment) => 
                item.prompt_versions && 
                item.prompt_versions.prompts && 
                item.prompt_versions.prompts.book_id
              )
              .map((item: PromptAssignment) => item.prompt_versions.prompts.book_id as string);
            
            // Fetch book details if any book IDs found
            if (bookIds.length > 0) {
              // Use type assertion to ensure the Set elements are treated as strings
              const uniqueBookIds = Array.from(new Set(bookIds)) as string[];
              fetchBookDetails(uniqueBookIds);
            }
          }
        } else {
          setError(result.error || 'Failed to load prompt history');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [userId, promptType, bookId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const setAsCurrentPrompt = async (promptVersionId: string, promptCategory: string) => {
    if (!userId) return;
    
    try {
      const response = await fetch('/api/v11/assign-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          promptVersionId,
          assignedBy: userId,
          // Include prompt category for better logs
          category: promptCategory 
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Get appropriate message based on prompt category
        let messageType;
        switch(promptCategory) {
          case 'ai_instructions': 
            messageType = 'AI Instructions';
            break;
          case 'quest_generation':
            messageType = 'Quest Generation Instructions';
            break;
          case 'insights_system':
            messageType = 'Insights System Prompt';
            break;
          case 'insights_user':
            messageType = 'Insights User Prompt';
            break;
          case 'warm_handoff':
            messageType = 'Warm Handoff Prompt';
            break;
          default:
            messageType = 'Greeting';
        }
        alert(`${messageType} set as current successfully!`);
      } else {
        alert(`Failed to set prompt: ${result.error}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'An unknown error occurred'}`);
    }
  };

  const getPageTitle = () => {
    switch(promptType) {
      case 'ai_instructions': return 'AI Instructions History';
      case 'quest_generation': return 'Quest Generation History';
      case 'insights_system': return 'Insights System History';
      case 'insights_user': return 'Insights User History';
      case 'warm_handoff': return 'Warm Handoff History';
      default: return 'Greeting Prompt History';
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">
            {getPageTitle()}
          </h1>
        </div>
        <div className="text-center py-12">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">
            {getPageTitle()}
          </h1>
        </div>
        <div className="bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-400 p-4 rounded-md mb-6">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">
          {getPageTitle()}
        </h1>
        
        <div className="flex items-center space-x-2">
          <a 
            href="/chatbotV11/admin"
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Back to Admin
          </a>
        </div>
      </div>
      
      {history.length === 0 ? (
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md">
          No prompt history found for this user.
        </div>
      ) : (
        <div className="space-y-8">
          {history.map((item) => {
            // Skip rendering if we have missing data - this can happen with corrupted data in the database
            if (!item.prompt_versions || !item.prompt_versions.prompts) {
              return null;
            }
            
            return (
              <div 
                key={item.id} 
                className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-semibold">
                    {item.prompt_versions.prompts.name || 'Unnamed Prompt'} 
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                      (v{item.prompt_versions.version_number || '1'})
                    </span>
                  </h2>
                  <div className="space-x-2">
                    <button
                      onClick={() => setAsCurrentPrompt(
                        item.prompt_versions.id, 
                        item.prompt_versions.prompts.category
                      )}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                    >
                      Set as Current
                    </button>
                  </div>
                </div>
                
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  <div>Category: {item.prompt_versions.prompts.category || promptType}</div>
                  <div>Assigned: {formatDate(item.assigned_at)}</div>
                  <div>Created: {formatDate(item.prompt_versions.created_at)}</div>
                  
                  {/* Show book information for book-specific prompts */}
                  {promptType === 'quest_generation' && item.prompt_versions.prompts.book_id && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded">
                      <div className="font-medium">Book-specific prompt</div>
                      {books[item.prompt_versions.prompts.book_id] ? (
                        <div>
                          Book: {books[item.prompt_versions.prompts.book_id].title} by {books[item.prompt_versions.prompts.book_id].author}
                        </div>
                      ) : (
                        <div>Book ID: {item.prompt_versions.prompts.book_id}</div>
                      )}
                    </div>
                  )}
                </div>
                
                {item.prompt_versions.title && (
                  <div className="mb-4 text-gray-800 dark:text-gray-200 font-medium">
                    Title: {item.prompt_versions.title}
                  </div>
                )}
                
                {item.prompt_versions.notes && (
                  <div className="mb-4 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-750 p-3 rounded-md">
                    <div className="text-sm font-medium mb-1">Notes:</div>
                    {item.prompt_versions.notes}
                  </div>
                )}
                
                {item.prompt_versions.prompts.description && (
                  <div className="mb-4 text-gray-600 dark:text-gray-300 italic">
                    {item.prompt_versions.prompts.description}
                  </div>
                )}
                
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap">
                  {item.prompt_versions.content}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}