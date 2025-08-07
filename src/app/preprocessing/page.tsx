'use client';

/*
Here's what seems to be happening:

1. Server-side execution was successful:
  - The server logs showed the complete process working correctly
  - Claude API was called successfully
  - Quests were generated and stored in the database
2. Client-side error:
  - The browser received a progress update of 45% (sending request to Claude AI)
  - Then a network error occurred: TypeError: NetworkError when attempting to fetch resource
  - This suggests the browser lost connection to the server during the process

This pattern typically indicates one of these issues:

1. Request timeout: The quest generation process might take longer than the browser's default timeout for fetch requests
2. Connection interruption: The network connection between client and server was interrupted
3. Server restart: The server might have restarted during the processing
4. CORS issue: If the frontend and backend are on different domains, there might be CORS configuration issues

Since the server logs show the process completing successfully, this seems to be a client-side issue with maintaining the connection during a
long-running process rather than a server-side execution problem.

Potential solutions:

1. Implement a more robust client-side polling system instead of a single long request
2. Add request timeout extension configuration
3. Implement a WebSocket or server-sent events (SSE) connection for real-time progress updates
4. Add better client-side error recovery to retry the connection if it fails
*/


import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

type ProcessingType = 'embedding' | 'concepts' | 'characters' | 'openingLines' | 'characterEmbedding' | 'chapterCharacters' | 'chapterOpeningLines' | 'exportBookData' | 'quests' | 'chapterQuests' | 'insights' | 'none';

// Define TypeScript interfaces for the various result structures
interface ChunkDetail {
  id: string;
  chunk_index: number;
  chunk_size: number;
}

interface BookInfo {
  id: string;
  title: string;
  author?: string;
  content?: string; // Add content property
}

interface EmbeddingInfo {
  namespace: string;
  index: string;
  model: string;
  total_chunks: number;
  chunk_details?: ChunkDetail[];
}

interface StorageInfo {
  database: string;
  table: string;
}

interface KeyConcept {
  concept: string;
  description: string;
}

interface CharacterProfile {
  character_name: string;
  character_profile: string;
}

interface VerificationResult {
  character_name: string;
  score: number;
  id: string;
  preview: string;
}

interface Verification {
  query: string;
  results?: VerificationResult[];
  error?: string;
}

interface OpeningLine {
  character_name: string;
  type: string;
  opening_line: string;
  related_concepts?: string[];
  example_conversation?: {
    speaker: string;
    text: string;
  }[];
}

interface Quest {
  quest_title: string;
  introduction: string;
  challenge: string;
  reward: string;
  starting_question: string;
  chapter_number: number;
  chapter_title: string;
}

interface ProcessingInfo {
  total_chapters?: number;
  processed_chapters?: number;
  failed_chapters?: { chapter: string, title: string, error: string }[];
}

interface ProcessingSummary {
  total_chapters?: number;
  successful_chapters?: number;
  failed_chapters?: number;
  chapters_remaining?: number;
  current_chapter?: number;
  completed?: boolean;
  completed_at?: string;
  error_chapters?: Array<{ chapter: string; error: string }>;
}

// User insight interfaces
interface UserInsight {
  type: 'strength' | 'goal' | 'coping' | 'resource' | 'risk' | 'engagement';
  content: string;
  source: string;
  confidence: number;
}

interface GroupedInsights {
  strengths: UserInsight[];
  goals: UserInsight[];
  coping: UserInsight[];
  resources: UserInsight[];
  risks: UserInsight[];
  engagement: UserInsight[];
}

interface ProcessingResult {
  success: boolean;
  message: string;
  book?: BookInfo;
  embedding_info?: EmbeddingInfo;
  concept_count?: number;
  concepts?: KeyConcept[];
  character_count?: number;
  character_profiles?: CharacterProfile[];
  storage_info?: StorageInfo;
  profile_count?: number;
  verification?: Verification;
  line_count?: number;
  opening_lines?: OpeningLine[];
  quest_count?: number;
  quests?: Quest[];
  processing_info?: ProcessingInfo;
  processing_summary?: ProcessingSummary;
  upload_url?: string; // URL for uploaded/shared content
  upload_filename?: string; // Filename for uploaded content
  chapter_by_chapter?: boolean; // Flag for chapter-by-chapter processing
  is_mental_health_book?: boolean; // Flag for psychology textbook content
  // Additional properties for vector embeddings
  warning?: string; // For existing vectors warning
  vectorCount?: number; // Count of vectors in Pinecone
  namespace?: string; // Pinecone namespace
  show_book_data_view?: boolean; // Controls book data view UI
  // User insights properties
  insight_count?: number;
  insights?: GroupedInsights;
  conversation_count?: number;
  message_count?: number;
  insightId?: string;
}

export default function PreprocessingPage() {
  const [bookId, setBookId] = useState('');
  const [books, setBooks] = useState<Array<{ id: string, title: string, author: string, created_at: string, content?: string }>>([]);
  const [processingType, setProcessingType] = useState<ProcessingType>('none');
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [startChapter, setStartChapter] = useState('1');
  const [endChapter, setEndChapter] = useState('30');
  const [openingLinesStartChapter, setOpeningLinesStartChapter] = useState('1');
  const [openingLinesEndChapter, setOpeningLinesEndChapter] = useState('30');
  const [questsStartChapter, setQuestsStartChapter] = useState('1');
  const [questsEndChapter, setQuestsEndChapter] = useState('30');
  const [generationProgress, setGenerationProgress] = useState(0);
  const { user } = useAuth();

  const isLoading = processingType !== 'none';

  // Fetch books when component mounts
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const response = await fetch('/api/v10/books');
        if (!response.ok) {
          throw new Error(`Failed to fetch books: ${response.status}`);
        }
        const booksData = await response.json();
        setBooks(booksData);
      } catch (err) {
        console.error('Error fetching books:', err);
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    fetchBooks();
  }, []);

  const handleEmbedBook = async (e: React.FormEvent, forceEmbed = false) => {
    e.preventDefault();

    if (!bookId.trim()) {
      setError('Book ID is required');
      return;
    }

    // Only allow specific user ID to embed book content
    const authorizedUserId = "NbewAuSvZNgrb64yNDkUebjMHa23"; // Your specific user ID
    if (!user || user.uid !== authorizedUserId) {
      setError('You are not authorized to embed book content');
      return;
    }

    try {
      setProcessingType('embedding');
      setError(null);
      setResult(null);

      // Call our API endpoint
      const response = await fetch('/api/preprocessing/embed-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: bookId.trim(),
          testMode,
          chunkIndex,
          forceEmbed
        }),
      });

      const data = await response.json();

      // Special handling for existing vectors warning (status 409)
      if (response.status === 409 && data.warning === 'existing_vectors') {
        // Set a temporary result to show the warning
        setResult({
          success: false,
          message: data.message,
          book: data.book,
          warning: 'existing_vectors',
          vectorCount: data.vectorCount,
          namespace: data.namespace
        });

        // Create modal-like confirmation dialog
        if (window.confirm(
          `WARNING: This book (${data.book.title}) already has ${data.vectorCount} vectors in Pinecone namespace "${data.namespace}".\n\n` +
          `Embedding again will create duplicate vectors which may lead to incorrect results and waste resources.\n\n` +
          `Do you want to proceed with embedding anyway?`
        )) {
          // User confirmed, try again with force flag
          setProcessingType('none');
          setTimeout(() => {
            // Use setTimeout to allow the UI to update before continuing
            handleEmbedBook(e, true);
          }, 100);
        } else {
          // User canceled, exit embedding process
          console.log('Embedding process canceled by user due to existing vectors');
        }
        return;
      }

      // Normal error handling
      if (!response.ok) {
        throw new Error(data.error || `API error: ${response.status}`);
      }

      setResult(data);
    } catch (err) {
      console.error('Error embedding book:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessingType('none');
    }
  };

  const handleExtractConcepts = async () => {
    if (!bookId.trim()) {
      setError('Book ID is required');
      return;
    }

    try {
      setProcessingType('concepts');
      setError(null);
      setResult(null);
      setStartTime(new Date());

      // Log progress to browser console
      console.log(`[Client] Starting concept extraction for book ID: ${bookId}`);

      // Set a timeout to show the request might be taking a while
      const progressTimeoutId = setTimeout(() => {
        console.log('[Client] Concept extraction is still running... (this may take several minutes)');
      }, 10000);

      try {
        // Set a longer timeout for the fetch request
        const controller = new AbortController();
        const fetchTimeoutId = setTimeout(() => controller.abort(), 15 * 60 * 1000); // 15 minutes timeout

        // Call our API endpoint
        const response = await fetch('/api/preprocessing/extract-concepts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            book_id: bookId.trim(),
            debug: true // Enable extra debug logs
          }),
          signal: controller.signal
        });

        clearTimeout(fetchTimeoutId);

        // Log the response status
        console.log(`[Client] Received response with status: ${response.status}`);

        if (!response.ok) {
          const text = await response.text();
          console.error(`[Client] API error (${response.status}):`, text);
          try {
            const data = JSON.parse(text);

            // Check if this is a JSON parsing error from Claude
            if (data.details && data.details.includes('JSON Parsing Failed')) {
              // Format a detailed error message showing the JSON context
              let errorMessage = `${data.error}: ${data.details}`;
              if (data.json_context) {
                errorMessage += `\n\nJSON Context: ${data.json_context}`;
              }

              // Set error for display and throw
              setError(errorMessage);
              throw new Error(errorMessage);
            } else {
              // Handle other API errors
              throw new Error(data.error || data.details || `API error: ${response.status}`);
            }
          } catch {
            // Handle JSON parse errors or other non-structured errors
            throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}...`);
          }
        }

        const data = await response.json();

        // Log success
        console.log(`[Client] Successfully extracted ${data.concept_count} concepts`);
        data.concepts?.forEach((concept: KeyConcept) => {
          console.log(`[Client] → Extracted concept: ${concept.concept}`);
        });

        setResult(data);
      } catch (error) {
        const fetchError = error as Error;
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.error('[Client] Request timed out after 15 minutes');
          throw new Error('Request timed out after 15 minutes. The concept extraction process takes too long.');
        } else {
          throw error;
        }
      } finally {
        clearTimeout(progressTimeoutId);
      }
    } catch (err) {
      console.error('[Client] Error extracting concepts:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Add more detailed error info to the console
      if (errorMessage.includes('NetworkError')) {
        console.error('[Client] Network error occurred. This could be due to:');
        console.error('  - The server is taking too long to respond');
        console.error('  - The connection to the server was lost');
        console.error('  - The server crashed during processing');
        console.error('Try checking the server terminal for detailed logs.');
      }

      if (errorMessage.includes('Could not extract valid JSON')) {
        console.error('[Client] This appears to be a JSON parsing issue.');
        console.error('[Client] Check the server logs for the actual Claude response.');
      }

      setError(errorMessage);
    } finally {
      setProcessingType('none');
    }
  };

  const handleGenerateCharacterProfiles = async () => {
    if (!bookId.trim()) {
      setError('Book ID is required');
      return;
    }

    try {
      setProcessingType('characters');
      setError(null);
      setResult(null);
      setStartTime(new Date());

      // Log progress to browser console
      console.log(`[Client] Starting character profile generation for book ID: ${bookId}`);

      // Set a timeout to show the request might be taking a while
      const progressTimeoutId = setTimeout(() => {
        console.log('[Client] Character profile generation is still running... (this may take several minutes)');
      }, 10000);

      try {
        // Set a longer timeout for the fetch request
        const controller = new AbortController();
        const fetchTimeoutId = setTimeout(() => controller.abort(), 15 * 60 * 1000); // 15 minutes timeout

        // Call our API endpoint
        const response = await fetch('/api/preprocessing/character-profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            book_id: bookId.trim(),
            debug: true // Enable extra debug logs
          }),
          signal: controller.signal
        });

        clearTimeout(fetchTimeoutId);

        // Log the response status
        console.log(`[Client] Received response with status: ${response.status}`);

        if (!response.ok) {
          const text = await response.text();
          console.error(`[Client] API error (${response.status}):`, text);
          try {
            const data = JSON.parse(text);

            // Check if this is a JSON parsing error from Claude
            if (data.details && data.details.includes('JSON Parsing Failed')) {
              // Format a detailed error message showing the JSON context
              let errorMessage = `${data.error}: ${data.details}`;
              if (data.json_context) {
                errorMessage += `\n\nJSON Context: ${data.json_context}`;
              }

              // Set error for display and throw
              setError(errorMessage);
              throw new Error(errorMessage);
            } else {
              // Handle other API errors
              throw new Error(data.error || data.details || `API error: ${response.status}`);
            }
          } catch {
            // Handle JSON parse errors or other non-structured errors
            throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}...`);
          }
        }

        const data = await response.json();

        // Log success
        console.log(`[Client] Successfully generated profiles for ${data.character_count} characters:`);
        data.character_profiles?.forEach((profile: CharacterProfile) => {
          console.log(`[Client] → Generated profile for: ${profile.character_name}`);
        });

        setResult(data);
      } catch (error) {
        const fetchError = error as Error;
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.error('[Client] Request timed out after 15 minutes');
          throw new Error('Request timed out after 15 minutes. The character profile generation process takes too long.');
        } else {
          throw error;
        }
      } finally {
        clearTimeout(progressTimeoutId);
      }
    } catch (err) {
      console.error('[Client] Error generating character profiles:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Add more detailed error info to the console
      if (errorMessage.includes('NetworkError')) {
        console.error('[Client] Network error occurred. This could be due to:');
        console.error('  - The server is taking too long to respond');
        console.error('  - The connection to the server was lost');
        console.error('  - The server crashed during processing');
        console.error('Try checking the server terminal for detailed logs.');
      }

      if (errorMessage.includes('Could not extract valid JSON')) {
        console.error('[Client] This appears to be a JSON parsing issue.');
        console.error('[Client] Check the server logs for the actual Claude response.');
      }

      setError(errorMessage);
    } finally {
      setProcessingType('none');
    }
  };

  const handleGenerateOpeningLines = async () => {
    if (!bookId.trim()) {
      setError('Book ID is required');
      return;
    }

    try {
      setProcessingType('openingLines');
      setError(null);
      setResult(null);

      // Call our API endpoint
      const response = await fetch('/api/preprocessing/opening-lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: bookId.trim()
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API error: ${response.status}`);
      }

      setResult(data);
    } catch (err) {
      console.error('Error generating opening lines:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessingType('none');
    }
  };

  const handleGenerateQuests = async () => {
    // Variable to store the user's preference about keeping existing quests
    let preserveExisting = false;

    try {
      console.log("[DEBUG] handleGenerateQuests called");

      if (!bookId.trim()) {
        console.log("[DEBUG] No book ID provided");
        setError('Please select a book before generating quests.');
        // Scroll to the top where the book selector is
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Check if this is a very large book that might need truncation
      const selectedBook = books.find(book => book.id === bookId);
      if (selectedBook && selectedBook.content && selectedBook.content.length > 25000) {
        // Confirm with the user before proceeding
        const confirmMessage = `WARNING: The selected book "${selectedBook.title}" contains ${selectedBook.content.length.toLocaleString()} characters, which exceeds the 25,000 character limit for quest generation.\n\nOnly the first 25,000 characters will be used for generating quests. This may result in quests that only cover the beginning of the book.\n\nWould you like to:\n- Click OK to continue with truncated content\n- Click Cancel to use the chapter-by-chapter approach instead (recommended for large books)`;

        if (!window.confirm(confirmMessage)) {
          console.log("[DEBUG] User cancelled quest generation due to large book size");
          // Scroll down to the chapter-by-chapter section
          document.querySelectorAll('h3').forEach(el => {
            if (el.textContent?.includes('Quests Generator (Chapter by Chapter)')) {
              el.scrollIntoView({ behavior: 'smooth' });
            }
          });
          return;
        }

        console.log(`[DEBUG] Proceeding with quest generation for large book (${selectedBook.content.length} characters, will be truncated to 25,000)`);
      }

      // Ask if the user wants to replace existing quests or add to them
      preserveExisting = confirm(
        `Do you want to KEEP the existing quests for this book?\n\n` +
        `- Click OK to ADD new quests to the existing ones\n` +
        `- Click Cancel to REPLACE all existing quests with new ones`
      );

      console.log(`[DEBUG] User chose to ${preserveExisting ? 'preserve' : 'replace'} existing quests`);

    } catch (e) {
      console.error("[CRITICAL ERROR] Error at the start of handleGenerateQuests:", e);
      alert("Critical error in quest generator: " + (e instanceof Error ? e.message : String(e)));
      return;
    }

    try {
      console.log("[DEBUG] Setting up quest generation with book ID:", bookId);
      setProcessingType('quests');
      setError(null);
      setResult(null);
      setStartTime(new Date());

      // Log progress to browser console
      // Generate a unique request ID to help trace this specific request
      const requestId = Date.now().toString().slice(-6);
      console.log(`[Client][Quest-${requestId}] ▶️ STARTING quest generation for book ID: ${bookId}`);

      // Log if a user ID is available for custom prompt selection
      if (user?.uid) {
        console.log(`[Client][Quest-${requestId}] 👤 Including user ID: ${user.uid} for custom prompt selection`);
      } else {
        console.log(`[Client][Quest-${requestId}] ⚠️ No user ID available - using default prompt`);
      }

      // Add metadata for tracing in logs
      console.log(`[Client][Quest-${requestId}] Metadata: ${JSON.stringify({
        startTime: new Date().toISOString(),
        bookId: bookId.trim(),
        preserveExisting
      })}`);

      // Set a timeout to show the request might be taking a while
      const progressTimeoutId = setTimeout(() => {
        console.log(`[Client][Quest-${requestId}] ⏳ Generation in progress (may take several minutes)`);
      }, 15000); // Only show after 15 seconds of waiting

      let pollProgressInterval: NodeJS.Timeout | null = null;
      let lastLoggedPercentage = 0;

      try {
        // Reset progress to 0
        setGenerationProgress(0);

        // Set up progress polling with reduced logging
        pollProgressInterval = setInterval(async () => {
          try {
            // Poll the dedicated progress tracking API endpoint
            const progressResponse = await fetch(`/api/preprocessing/quest-progress/${bookId.trim()}`);

            if (progressResponse.ok) {
              const progressData = await progressResponse.json();
              if (progressData && typeof progressData.percentage === 'number') {
                setGenerationProgress(progressData.percentage);

                // Only log at significant milestones to reduce verbosity
                if (progressData.percentage === 0 ||
                  progressData.percentage === 25 ||
                  progressData.percentage === 50 ||
                  progressData.percentage === 75 ||
                  progressData.percentage === 100 ||
                  // Always log errors or if we haven't logged in a while (25% jumps)
                  progressData.status.toLowerCase().includes('error') ||
                  Math.abs(progressData.percentage - lastLoggedPercentage) >= 25) {

                  console.log(`[Client][Quest-${requestId}] ${progressData.percentage}% - ${progressData.status}`);
                  lastLoggedPercentage = progressData.percentage;
                }
              }
            }
          } catch {
            // Don't log polling errors unless this is the first one
            // Don't stop polling on error
          }
        }, 5000); // Poll every 5 seconds

        // Set a longer timeout for the fetch request
        const controller = new AbortController();
        const fetchTimeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 minutes timeout (reduced from 15)

        try {
          // Call our API endpoint with the preserve option
          const response = await fetch('/api/preprocessing/generate-quests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bookId: bookId.trim(), // Changed from book_id to bookId to match API expectation
              preserveExisting: preserveExisting, // Add this flag to control whether to preserve existing quests
              userId: user?.uid // Include user ID for custom prompt selection
            }),
            signal: controller.signal
          });

          // Clear timeout since request completed
          clearTimeout(fetchTimeoutId);

          // Process the response
          if (!response.ok) {
            const text = await response.text();
            console.error(`[Client][Quest-${requestId}] ❌ API error (${response.status}):`, text);
            try {
              const data = JSON.parse(text);

              // Check if this is a JSON parsing error from Claude
              if (data.details && data.details.includes('JSON Parsing Failed')) {
                // Format a detailed error message showing the JSON context
                let errorMessage = `${data.error}: ${data.details}`;
                if (data.json_context) {
                  errorMessage += `\n\nJSON Context: ${data.json_context}`;
                }

                // Set error for display and throw
                setError(errorMessage);
                throw new Error(errorMessage);
              } else {
                // Handle other API errors
                throw new Error(data.error || data.details || `API error: ${response.status}`);
              }
            } catch {
              // Handle JSON parse errors or other non-structured errors
              throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}...`);
            }
          }

          const data = await response.json();

          // Log success with summary (no details of individual quests)
          if (data.preservedExisting) {
            console.log(`[Client][Quest-${requestId}] ✅ COMPLETE: Added ${data.processedCount} quests to ${data.existingQuestsCount} existing. Total: ${data.totalQuestCount}`);
          } else {
            console.log(`[Client][Quest-${requestId}] ✅ COMPLETE: Generated ${data.processedCount} quests`);
          }

          // No longer log details of each individual quest to reduce verbosity

          setResult(data);
        } catch (fetchError) {
          console.error(`[Client][Quest-${requestId}] ❌ ERROR: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
          // Set the error message for display
          const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
          setError(errorMessage);

          // Clear timeout if it exists
          if (fetchTimeoutId) clearTimeout(fetchTimeoutId);

          // Don't re-throw, we'll handle the error here
        } finally {
          // Always clear the polling interval when the request completes or fails
          if (pollProgressInterval) {
            clearInterval(pollProgressInterval);
            pollProgressInterval = null;
          }
        }



      } finally {
        clearTimeout(progressTimeoutId);

        // Final cleanup of polling interval
        if (pollProgressInterval) {
          clearInterval(pollProgressInterval);
          pollProgressInterval = null;
        }
      }
    } catch (err) {
      console.error('[Client] Error generating quests:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    } finally {
      setProcessingType('none');
      setGenerationProgress(0); // Reset progress when done
    }
  };

  const handleEmbedCharacterProfiles = async () => {
    if (!bookId.trim()) {
      setError('Book ID is required');
      return;
    }

    // Only allow specific user ID to embed character profiles
    const authorizedUserId = "NbewAuSvZNgrb64yNDkUebjMHa23"; // Your specific user ID
    if (!user || user.uid !== authorizedUserId) {
      setError('You are not authorized to embed character profiles');
      return;
    }

    try {
      setProcessingType('characterEmbedding');
      setError(null);
      setResult(null);
      setStartTime(new Date());

      // Log progress to browser console
      console.log(`[Client] Starting character profile embedding for book ID: ${bookId}`);

      // Set a timeout to show the request might be taking a while
      const progressTimeoutId = setTimeout(() => {
        console.log('[Client] Character profile embedding is still running...');
      }, 10000);

      try {
        // Set a timeout for the fetch request
        const controller = new AbortController();
        const fetchTimeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 minutes timeout

        // Call our API endpoint
        const response = await fetch('/api/preprocessing/character-profiles/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            book_id: bookId.trim(),
            debug: true // Enable extra debug logs
          }),
          signal: controller.signal
        });

        clearTimeout(fetchTimeoutId);

        // Log the response status
        console.log(`[Client] Received response with status: ${response.status}`);

        if (!response.ok) {
          const text = await response.text();
          console.error(`[Client] API error (${response.status}):`, text);
          try {
            const data = JSON.parse(text);

            // Check if this is a JSON parsing error from Claude
            if (data.details && data.details.includes('JSON Parsing Failed')) {
              // Format a detailed error message showing the JSON context
              let errorMessage = `${data.error}: ${data.details}`;
              if (data.json_context) {
                errorMessage += `\n\nJSON Context: ${data.json_context}`;
              }

              // Set error for display and throw
              setError(errorMessage);
              throw new Error(errorMessage);
            } else {
              // Handle other API errors
              throw new Error(data.error || data.details || `API error: ${response.status}`);
            }
          } catch {
            // Handle JSON parse errors or other non-structured errors
            throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}...`);
          }
        }

        const data = await response.json();

        // Log success
        console.log(`[Client] Successfully embedded ${data.profile_count || 0} character profiles`);

        setResult(data);
      } catch (error) {
        const fetchError = error as Error;
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.error('[Client] Request timed out after 5 minutes');
          throw new Error('Request timed out after 5 minutes. The character profile embedding process takes too long.');
        } else {
          throw error;
        }
      } finally {
        clearTimeout(progressTimeoutId);
      }
    } catch (err) {
      console.error('[Client] Error embedding character profiles:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    } finally {
      setProcessingType('none');
    }
  };

  // Function to handle character profiles processing by chapter (used in future implementation)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleChapterByChapterCharacterProfiles = async () => {
    if (!bookId.trim()) {
      setError('Book ID is required');
      return;
    }

    // Check if this is the psychology textbook
    if (bookId.trim() !== '2b169bda-011b-4834-8454-e30fed95669d') {
      setError('This function is only for the psychology textbook (ID: 2b169bda-011b-4834-8454-e30fed95669d)');
      return;
    }

    try {
      setProcessingType('chapterCharacters');
      setError(null);
      setResult(null);
      setStartTime(new Date());

      // Log progress to browser console
      console.log(`[Client] Starting chapter-by-chapter character profile generation for book ID: ${bookId}`);
      console.log(`[Client] Processing chapters ${startChapter} to ${endChapter}`);

      // Set a timeout to show the request might be taking a while
      const progressTimeoutId = setTimeout(() => {
        console.log('[Client] Character profile processing has started in the background...');
      }, 5000);

      try {
        // Call our API endpoint
        const response = await fetch('/api/preprocessing/character-profiles/chapter-by-chapter/coordinator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            book_id: bookId.trim(),
            start_chapter: startChapter,
            end_chapter: endChapter,
            debug: true // Enable extra debug logs
          })
        });

        // Log the response status
        console.log(`[Client] Received response with status: ${response.status}`);

        if (!response.ok) {
          const text = await response.text();
          console.error(`[Client] API error (${response.status}):`, text);
          try {
            const data = JSON.parse(text);

            // Check if this is a JSON parsing error from Claude
            if (data.details && data.details.includes('JSON Parsing Failed')) {
              // Format a detailed error message showing the JSON context
              let errorMessage = `${data.error}: ${data.details}`;
              if (data.json_context) {
                errorMessage += `\n\nJSON Context: ${data.json_context}`;
              }

              // Set error for display and throw
              setError(errorMessage);
              throw new Error(errorMessage);
            } else {
              // Handle other API errors
              throw new Error(data.error || data.details || `API error: ${response.status}`);
            }
          } catch {
            // Handle JSON parse errors or other non-structured errors
            throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}...`);
          }
        }

        const data = await response.json();

        // Log success
        console.log(`[Client] Successfully initiated character profile generation for chapters ${startChapter}-${endChapter}`);

        setResult({
          ...data,
          message: `Processing initiated for chapters ${startChapter}-${endChapter}. This will continue in the background.`,
          success: true
        });
      } catch (error) {
        throw error;
      } finally {
        clearTimeout(progressTimeoutId);
      }
    } catch (err) {
      console.error('[Client] Error initiating chapter-by-chapter character profiles:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    } finally {
      setProcessingType('none');
    }
  };

  const handleGenerateInsights = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('Authentication required');
      return;
    }

    // Only allow specific user ID to process insights
    const authorizedUserId = "NbewAuSvZNgrb64yNDkUebjMHa23"; // Your specific user ID
    if (user.uid !== authorizedUserId) {
      setError('You are not authorized to process user insights');
      return;
    }

    try {
      setProcessingType('insights');
      setError(null);
      setResult(null);
      setStartTime(new Date());

      console.log(`[Client] Starting user insights processing for user ID: ${user.uid}`);

      // Set a timeout to show the request might be taking a while
      const progressTimeoutId = setTimeout(() => {
        console.log('[Client] User insights processing is still running... (this may take several minutes)');
      }, 10000);

      try {
        // Set a longer timeout for the fetch request
        const controller = new AbortController();
        const fetchTimeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 minutes timeout

        // Call our API endpoint
        const response = await fetch('/api/preprocessing/user-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            analyzeAll: true // Process all conversations regardless of opt-in status (admin only)
          }),
          signal: controller.signal
        });

        clearTimeout(fetchTimeoutId);

        // Log the response status
        console.log(`[Client] Received response with status: ${response.status}`);

        if (!response.ok) {
          const text = await response.text();
          console.error(`[Client] API error (${response.status}):`, text);
          try {
            const data = JSON.parse(text);

            // Check if this is a JSON parsing error from Claude
            if (data.details && data.details.includes('JSON Parsing Failed')) {
              // Format a detailed error message showing the JSON context
              let errorMessage = `${data.error}: ${data.details}`;
              if (data.json_context) {
                errorMessage += `\n\nJSON Context: ${data.json_context}`;
              }

              // Set error for display and throw
              setError(errorMessage);
              throw new Error(errorMessage);
            } else {
              // Handle other API errors
              throw new Error(data.error || data.details || `API error: ${response.status}`);
            }
          } catch {
            // Handle JSON parse errors or other non-structured errors
            throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}...`);
          }
        }

        const data = await response.json();

        // Log success
        console.log(`[Client] Successfully processed user insights`);

        setResult(data);
      } catch (error) {
        const fetchError = error as Error;
        if (fetchError.name === 'AbortError') {
          console.error('[Client] Request timed out after 10 minutes');
          throw new Error('Request timed out after 10 minutes. The user insights processing takes too long.');
        } else {
          throw error;
        }
      } finally {
        clearTimeout(progressTimeoutId);
      }
    } catch (err) {
      console.error('[Client] Error processing user insights:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    } finally {
      setProcessingType('none');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Book Preprocessing</h1>

      <div className="bg-gray-900 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">Book Processing</h2>

        <form onSubmit={handleEmbedBook} className="space-y-4">
          <div>
            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/40 border-l-4 border-red-500 text-red-700 dark:text-red-300">
                <p className="font-medium">Error:</p>
                <p>{error}</p>
              </div>
            )}
            <label htmlFor="bookId" className="block mb-2 font-medium">
              Select Book
            </label>
            <select
              id="bookId"
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              className="w-full p-3 bg-gray-800 rounded border border-gray-700 text-white"
              required
            >
              <option value="">-- Select a book --</option>
              {books.map((book) => {
                // Format date to a more readable form (if available)
                const createdDate = book.created_at ? new Date(book.created_at) : null;
                const formattedDate = createdDate ?
                  createdDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  }) : '';

                return (
                  <option key={book.id} value={book.id}>
                    {book.title} ({book.author}) - {formattedDate}
                  </option>
                );
              })}
            </select>
            {books.length === 0 && (
              <p className="mt-2 text-amber-400 text-sm">
                Loading books... If no books appear, there might be an issue connecting to the database.
              </p>
            )}
          </div>

          {/* Generate Educational Quests Button */}
          <div className="mt-4">
            <button
              onClick={handleGenerateQuests}
              disabled={isLoading || !bookId.trim()}
              className={`w-full flex items-center justify-center py-3 px-4 rounded-md ${isLoading || !bookId.trim() ? 'opacity-60 cursor-not-allowed bg-gray-700 text-gray-300' : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
            >
              {isLoading && processingType === 'quests' ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <div className="flex flex-col ml-2">
                    <div className="flex items-center">
                      <span className="mr-2 text-white font-medium">Generating Quests: {generationProgress}%</span>
                      {startTime && (
                        <span className="text-xs text-gray-300">
                          ({Math.floor((new Date().getTime() - startTime.getTime()) / 60000)}m {Math.floor(((new Date().getTime() - startTime.getTime()) % 60000) / 1000)}s)
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-3 bg-gray-700 rounded-full mt-1">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${generationProgress}%` }}
                      ></div>
                    </div>
                  </div>
                </>
              ) : (
                <span className={bookId.trim() ? "" : "text-gray-300"}>
                  Generate Quests
                </span>
              )}
            </button>
          </div>

          {/* View Book Data Link */}
          <a
            href={bookId.trim() ? `/bookdata?id=${encodeURIComponent(bookId.trim())}` : '/bookdata'}
            target="_blank"
            rel="noopener noreferrer"
            className={`w-full flex items-center justify-center py-3 px-4 rounded-md mt-3 text-center ${!bookId.trim() ? 'opacity-60 cursor-not-allowed bg-gray-700 text-gray-300' : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
          >
            View Book Data
          </a>

          {/* Visual Separator */}
          <hr className="my-6 border-gray-700" />

          <div className="p-4 my-4 bg-red-900/40 text-red-200 rounded-md text-sm">
            Below are random tools used during development, avoid them unless you are clear on what they do to DB tables
          </div>

          <div className="flex flex-col space-y-4">
            <div className="border-l-4 border-blue-500 pl-4 py-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">Processing Steps:</h3>
              <div className="flex items-center mb-2">
                <a
                  href="/dev-tools/pinecone-test"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center"
                >
                  <span>Verify Embeddings</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Test Embedding Button */}
            <div className="bg-gray-800 border border-gray-700 rounded-md p-4 mb-2">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Test Mode - Embed Single Chunk</h4>
              <div className="flex items-start mb-3">
                <input
                  type="checkbox"
                  id="testMode"
                  checked={testMode}
                  onChange={() => setTestMode(!testMode)}
                  className="mt-1 mr-2"
                />
                <div>
                  <label htmlFor="testMode" className="text-sm text-gray-300">
                    Enable Test Mode (embeds a single chunk only)
                  </label>
                  <p className="text-xs text-gray-400 mt-1">
                    Use this to verify embedding works before processing the entire book.
                  </p>
                </div>
              </div>
              {testMode && (
                <div className="ml-6 mt-2">
                  <label htmlFor="chunkIndex" className="block text-sm text-gray-300 mb-1">
                    Chunk Index
                  </label>
                  <input
                    id="chunkIndex"
                    type="number"
                    value={chunkIndex}
                    min="0"
                    onChange={(e) => setChunkIndex(parseInt(e.target.value) || 0)}
                    className="p-2 bg-gray-700 rounded border border-gray-600 text-white w-20"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Index of the chunk to embed (starting from 0)
                  </p>
                </div>
              )}
            </div>

            {/* Step 1: Embed Book Button */}
            <button
              type="submit"
              disabled={isLoading || !user || user.uid !== "NbewAuSvZNgrb64yNDkUebjMHa23"}
              className={`w-full flex items-center justify-center py-3 px-4 rounded-md ${isLoading || !user || user.uid !== "NbewAuSvZNgrb64yNDkUebjMHa23" ? 'opacity-60 cursor-not-allowed bg-gray-700 text-gray-300' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
            >
              {isLoading && processingType === 'embedding' ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Embedding Book...
                </>
              ) : (
                <>
                  1. Embed Book Content <span className="text-xs ml-1">(Required First)</span>
                  {(!user || user.uid !== "NbewAuSvZNgrb64yNDkUebjMHa23") && <span className="text-red-400 text-xs block mt-1">⚠️ Authorized users only</span>}
                </>
              )}
            </button>
          </div>
        </form>

        {/* Step 2: Extract Concepts Button */}
        <button
          onClick={handleExtractConcepts}
          disabled={isLoading}
          className={`w-full flex items-center justify-center py-3 px-4 rounded-md mt-3 ${isLoading ? 'opacity-60 cursor-not-allowed bg-gray-700 text-gray-300' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
        >
          {isLoading && processingType === 'concepts' ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Extracting Key Concepts...
              {startTime && (
                <span className="ml-2 text-xs">
                  ({Math.floor((new Date().getTime() - startTime.getTime()) / 60000)}m {Math.floor(((new Date().getTime() - startTime.getTime()) % 60000) / 1000)}s)
                </span>
              )}
            </>
          ) : (
            <>
              2. Extract Key Concepts
            </>
          )}
        </button>

        {/* Step 3: Generate Character Profiles Button */}
        <button
          onClick={handleGenerateCharacterProfiles}
          disabled={isLoading}
          className={`w-full flex items-center justify-center py-3 px-4 rounded-md mt-3 ${isLoading ? 'opacity-60 cursor-not-allowed bg-gray-700 text-gray-300' : 'bg-green-600 hover:bg-green-700 text-white'}`}
        >
          {isLoading && processingType === 'characters' ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating Character Profiles...
              {startTime && (
                <span className="ml-2 text-xs">
                  ({Math.floor((new Date().getTime() - startTime.getTime()) / 60000)}m {Math.floor(((new Date().getTime() - startTime.getTime()) % 60000) / 1000)}s)
                </span>
              )}
            </>
          ) : (
            <>
              3. Generate Character Profiles
            </>
          )}
        </button>

        {/* Step 3.5: Embed Character Profiles Button */}
        <button
          onClick={handleEmbedCharacterProfiles}
          disabled={isLoading || !user || user.uid !== "NbewAuSvZNgrb64yNDkUebjMHa23"}
          className={`w-full flex items-center justify-center py-3 px-4 rounded-md mt-3 ${isLoading || !user || user.uid !== "NbewAuSvZNgrb64yNDkUebjMHa23" ? 'opacity-60 cursor-not-allowed bg-gray-700 text-gray-300' : 'bg-pink-600 hover:bg-pink-700 text-white'}`}
        >
          {isLoading && processingType === 'characterEmbedding' ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Embedding Character Profiles...
              {startTime && (
                <span className="ml-2 text-xs">
                  ({Math.floor((new Date().getTime() - startTime.getTime()) / 60000)}m {Math.floor(((new Date().getTime() - startTime.getTime()) % 60000) / 1000)}s)
                </span>
              )}
            </>
          ) : (
            <>
              3.5 Embed Character Profiles
              {(!user || user.uid !== "NbewAuSvZNgrb64yNDkUebjMHa23") && <span className="text-red-400 text-xs block mt-1">⚠️ Authorized users only</span>}
            </>
          )}
        </button>

        {/* Step 4: Generate Opening Lines Button */}
        <button
          onClick={handleGenerateOpeningLines}
          disabled={isLoading}
          className={`w-full flex items-center justify-center py-3 px-4 rounded-md mt-3 ${isLoading ? 'opacity-60 cursor-not-allowed bg-gray-700 text-gray-300' : 'bg-amber-600 hover:bg-amber-700 text-white'}`}
        >
          {isLoading && processingType === 'openingLines' ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating Opening Lines...
            </>
          ) : (
            <>
              4. Generate Opening Lines
            </>
          )}
        </button>

        {/* View Book Data button removed and moved above the separator */}

        {error && (
          <div className="mt-6 bg-red-900/25 border border-red-800/50 p-4 rounded-md">
            <h3 className="font-semibold text-red-400 mb-2">Error</h3>
            <p className="text-red-200">{error}</p>
          </div>
        )}
      </div>

      {result && (
        <div className="bg-gray-900 p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold mb-4">Processing Results</h2>

          {/* Special warning for existing vectors */}
          {result.warning === 'existing_vectors' && (
            <div className="mb-6 bg-yellow-900/50 border border-yellow-600 p-4 rounded-md">
              <h3 className="font-semibold text-yellow-400 mb-2">⚠️ Warning: Existing Vectors Detected</h3>
              <p className="text-yellow-200 mb-3">{result.message}</p>
              <div className="flex flex-col space-y-2">
                <p className="text-yellow-300">Namespace: <span className="font-mono bg-yellow-900/50 px-2 py-1 rounded">{result.namespace}</span></p>
                <p className="text-yellow-300">Existing Vector Count: <span className="font-mono bg-yellow-900/50 px-2 py-1 rounded">{result.vectorCount}</span></p>
                <div className="mt-2">
                  <button
                    onClick={(e) => handleEmbedBook(e, true)}
                    className="px-4 py-2 bg-yellow-700 hover:bg-yellow-600 text-white rounded"
                  >
                    Proceed with Embedding Anyway
                  </button>
                </div>
              </div>
            </div>
          )}

          {result && result.insights && (
            <div className="bg-gray-900 p-6 rounded-lg mb-8">
              <h2 className="text-xl font-semibold mb-4">User Insights Results</h2>
              <p className="text-green-400 mb-4">✓ Successfully processed user insights</p>

              <div className="text-sm text-gray-400 mb-2">
                Analyzed {result.conversation_count} conversations and {result.message_count} messages
              </div>

              <div className="mt-4 space-y-4">
                {result.insights.strengths && result.insights.strengths.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-2">Strengths ({result.insights.strengths.length})</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      {result.insights.strengths.map((item, i) => (
                        <li key={i} className="text-gray-300">{item.content} <span className="text-xs text-gray-500">({Math.round(item.confidence * 100)}% confidence)</span></li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.insights.goals && result.insights.goals.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-2">Goals & Priorities ({result.insights.goals.length})</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      {result.insights.goals.map((item, i) => (
                        <li key={i} className="text-gray-300">{item.content} <span className="text-xs text-gray-500">({Math.round(item.confidence * 100)}% confidence)</span></li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.insights.coping && result.insights.coping.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-2">Coping Strategies ({result.insights.coping.length})</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      {result.insights.coping.map((item, i) => (
                        <li key={i} className="text-gray-300">{item.content} <span className="text-xs text-gray-500">({Math.round(item.confidence * 100)}% confidence)</span></li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.insights.resources && result.insights.resources.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-2">Resources Explored ({result.insights.resources.length})</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      {result.insights.resources.map((item, i) => (
                        <li key={i} className="text-gray-300">{item.content} <span className="text-xs text-gray-500">({Math.round(item.confidence * 100)}% confidence)</span></li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.insights.risks && result.insights.risks.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-2">Risk Indicators ({result.insights.risks.length})</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      {result.insights.risks.map((item, i) => (
                        <li key={i} className="text-gray-300">{item.content} <span className="text-xs text-gray-500">({Math.round(item.confidence * 100)}% confidence)</span></li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.insights.engagement && result.insights.engagement.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-2">Engagement Patterns ({result.insights.engagement.length})</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      {result.insights.engagement.map((item, i) => (
                        <li key={i} className="text-gray-300">{item.content} <span className="text-xs text-gray-500">({Math.round(item.confidence * 100)}% confidence)</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mb-4">
            <h3 className="font-medium mb-2">Book Information</h3>
            <div className="bg-gray-800 p-4 rounded-md">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-gray-400">Title:</span>
                <span>{result.book?.title || "N/A"}</span>

                <span className="text-gray-400">Author:</span>
                <span>{result.book?.author || "N/A"}</span>

                <span className="text-gray-400">ID:</span>
                <span>{result.book?.id || "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Book embedding specific results */}
          {result.embedding_info?.total_chunks && (
            <>
              <div className="mb-4">
                <h3 className="font-medium mb-2">Embedding Information</h3>
                <div className="bg-gray-800 p-4 rounded-md">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-gray-400">Namespace:</span>
                    <span>{result.embedding_info?.namespace || "N/A"}</span>

                    <span className="text-gray-400">Index:</span>
                    <span>{result.embedding_info?.index || "N/A"}</span>

                    <span className="text-gray-400">Model:</span>
                    <span>{result.embedding_info?.model || "text-embedding-3-large"}</span>

                    <span className="text-gray-400">Total Chunks:</span>
                    <span>{result.embedding_info?.total_chunks || 0}</span>

                    <span className="text-gray-400">Status:</span>
                    <span className="text-green-400">Success</span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-medium mb-2">Chunk Details</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Chunk ID
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Index
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Size (chars)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                      {result.embedding_info?.chunk_details?.map((chunk: ChunkDetail) => (
                        <tr key={chunk.id}>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                            {chunk.id}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                            {chunk.chunk_index}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                            {chunk.chunk_size}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Concepts-specific results */}
          {result.concepts && (
            <>
              <div className="mb-4">
                <h3 className="font-medium mb-2">Storage Information</h3>
                <div className="bg-gray-800 p-4 rounded-md">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-gray-400">Database:</span>
                    <span>{result.storage_info?.database || "Supabase"}</span>

                    <span className="text-gray-400">Table:</span>
                    <span>{result.storage_info?.table || "book_concepts"}</span>

                    <span className="text-gray-400">Total Concepts:</span>
                    <span>{result.concept_count}</span>

                    <span className="text-gray-400">Model:</span>
                    <span>claude-sonnet-4-20250514</span>
                  </div>
                </div>
              </div>

              {/* Display Chapter Processing Info for large books */}
              {result.processing_summary && (
                <div className="mb-4">
                  <h3 className="font-medium text-purple-300 mb-2">Chapter Processing Information</h3>
                  <div className="bg-gray-800 p-4 rounded-md">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <span className="text-gray-400">Total Chapters:</span>
                      <span>{result.processing_summary.total_chapters}</span>

                      <span className="text-gray-400">Successfully Processed:</span>
                      <span>{result.processing_summary.successful_chapters}</span>

                      <span className="text-gray-400">Failed Chapters:</span>
                      <span className={result.processing_summary.failed_chapters ? 'text-red-400' : 'text-green-400'}>
                        {result.processing_summary.failed_chapters || 0}
                      </span>
                    </div>

                    {/* Show failed chapter details if any */}
                    {result.processing_info?.failed_chapters && result.processing_info.failed_chapters.length > 0 && (
                      <>
                        <h4 className="text-red-400 font-medium mt-4 mb-2">Failed Chapters:</h4>
                        <div className="space-y-4 border border-red-900/50 rounded p-2 bg-red-900/20">
                          {result.processing_info.failed_chapters.map((chapter, idx) => (
                            <div key={idx} className="text-sm">
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-medium text-red-300">Chapter {chapter.chapter}: {chapter.title}</span>
                                <button
                                  onClick={async () => {
                                    try {
                                      const response = await fetch('/api/preprocessing/extract-concepts/retry-chapter', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          book_id: result.book?.id,
                                          chapter_number: chapter.chapter
                                        }),
                                      });

                                      if (!response.ok) {
                                        const errorData = await response.json();
                                        throw new Error(errorData.error || `API error: ${response.status}`);
                                      }

                                      const data = await response.json();
                                      alert(`Successfully processed Chapter ${chapter.chapter}. Extracted ${data.concepts_extracted} concepts. Refresh the page to see updated results.`);
                                    } catch (err) {
                                      console.error('Error retrying chapter:', err);
                                      alert(`Error retrying chapter: ${err instanceof Error ? err.message : String(err)}`);
                                    }
                                  }}
                                  className="px-2 py-1 bg-red-700 hover:bg-red-600 text-white text-xs rounded"
                                >
                                  Retry Chapter
                                </button>
                              </div>
                              <p className="text-red-200">{chapter.error}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <h3 className="font-medium mb-2">Key Concepts ({result.concept_count})</h3>
                <div className="space-y-4">
                  {result.concepts.map((concept: { concept: string; description: string }, index: number) => (
                    <div key={index} className="bg-gray-800 p-4 rounded-md">
                      <h4 className="font-medium text-purple-300 mb-2">{concept.concept}</h4>
                      <p className="text-gray-300 text-sm">{concept.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Character Profiles-specific results */}
          {result.character_profiles && (
            <>
              <div className="mb-4">
                <h3 className="font-medium mb-2">Storage Information</h3>
                <div className="bg-gray-800 p-4 rounded-md">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-gray-400">Database:</span>
                    <span>{result.storage_info?.database || "Supabase"}</span>

                    <span className="text-gray-400">Table:</span>
                    <span>{result.storage_info?.table || "book_character_profiles"}</span>

                    <span className="text-gray-400">Total Characters:</span>
                    <span>{result.character_count}</span>

                    <span className="text-gray-400">Model:</span>
                    <span>claude-sonnet-4-20250514</span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-medium mb-2">Character Profiles ({result.character_count})</h3>
                <div className="space-y-6">
                  {result.character_profiles.map((profile: { character_name: string; character_profile: string }, index: number) => (
                    <div key={index} className="bg-gray-800 p-4 rounded-md">
                      <h4 className="font-medium text-green-300 text-lg mb-3">{profile.character_name}</h4>
                      <div className="text-gray-300 text-sm">
                        {/* Handle both inline bold format (**SECTION:**) and older format on separate lines */}
                        {profile.character_profile.includes('**')
                          ? (
                            // New format: process markdown-style bold section headers
                            <div dangerouslySetInnerHTML={{
                              __html: profile.character_profile
                                .replace(/\*\*(IDENTITY|PSYCHOLOGY|COMMUNICATION|RELATIONSHIPS|CHARACTER ARC|THEMATIC SIGNIFICANCE|RESPONSE PATTERNS|KNOWLEDGE BOUNDARIES):\*\*/gi,
                                  '<h5 class="font-medium text-green-200 mt-4 mb-2">$1:</h5>')
                            }} />
                          ) : (
                            // Legacy format: split by double newlines
                            <div className="whitespace-pre-wrap">
                              {profile.character_profile.split(/(\n\s*\n)/).map((part, i) => {
                                // Check if this part is a section header
                                if (part.match(/^(IDENTITY|PSYCHOLOGY|COMMUNICATION|RELATIONSHIPS|CHARACTER ARC|THEMATIC SIGNIFICANCE|RESPONSE PATTERNS|KNOWLEDGE BOUNDARIES)/i)) {
                                  return <h5 key={i} className="font-medium text-green-200 mt-4 mb-2">{part}</h5>;
                                }
                                // Regular paragraph or line break
                                return part.match(/\n\s*\n/) ? <br key={i} /> : <p key={i} className="mb-3">{part}</p>;
                              })}
                            </div>
                          )
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Character Embedding Results */}
          {result.verification && (
            <div className="mb-4">
              <div className="flex items-center mb-4">
                <h3 className="font-medium text-pink-300 text-xl">Embedding Verification</h3>
                {result.verification.results && result.verification.results.length > 0 && (
                  <span className="ml-3 px-2 py-1 bg-green-700 text-green-100 text-xs rounded-full">
                    Success ✓
                  </span>
                )}
              </div>

              <div className="bg-gray-800 p-4 rounded-md mb-4">
                <div className="flex flex-col">
                  <span className="text-gray-400 mb-2">Test Query:</span>
                  <span className="text-pink-200 bg-gray-700 p-2 rounded mb-4">&ldquo;{result.verification.query || 'N/A'}&rdquo;</span>

                  {result.verification.error && (
                    <div className="bg-red-900/40 border border-red-800 p-3 rounded-md mb-4">
                      <span className="text-red-300 font-medium">Error during verification:</span>
                      <span className="text-red-200 block mt-1">{result.verification.error}</span>
                    </div>
                  )}

                  {result.verification.results && result.verification.results.length > 0 ? (
                    <>
                      <span className="text-gray-400 mb-2">Top Results:</span>
                      <div className="space-y-4">
                        {result.verification.results.map((res: VerificationResult, idx: number) => (
                          <div key={idx} className="bg-gray-700 p-3 rounded-md">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-medium text-pink-300">{res.character_name}</h5>
                              <span className="text-gray-300 text-sm">
                                Score: <span className="font-medium text-pink-200">{(res.score * 100).toFixed(2)}%</span>
                              </span>
                            </div>
                            <p className="text-sm text-gray-300 italic border-l-2 border-pink-700 pl-3">
                              {res.preview}
                            </p>
                            <div className="text-xs text-gray-400 mt-2">ID: {res.id}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-yellow-300 bg-yellow-900/30 p-3 rounded-md">
                      No matching results found. This may indicate a problem with the embedding process.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-pink-900/20 border border-pink-800 p-3 rounded-md">
                <h4 className="text-pink-300 font-medium mb-2">What This Means</h4>
                <p className="text-gray-300 text-sm mb-2">
                  The verification test creates a query embedding for <span className="text-pink-200">&ldquo;{result.verification.query || 'N/A'}&rdquo;</span> and
                  searches the Pinecone database for the most similar character profiles.
                </p>
                <ul className="list-disc list-inside text-sm text-gray-300 space-y-1 mb-3">
                  <li>A high score ({'>'}90%) with the matching character indicates a successful embedding.</li>
                  <li>The preview text lets you verify that the correct content was embedded.</li>
                  <li>Multiple characters may match if their profiles are similar.</li>
                </ul>

                <h4 className="text-pink-300 font-medium mt-4 mb-2">Pinecone Record Details</h4>
                <p className="text-gray-300 text-sm mb-2">
                  For each character profile, a record was created in Pinecone with these details:
                </p>
                <div className="bg-gray-800 p-3 rounded text-sm">
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-gray-400">Index:</span>
                    <span className="text-pink-200">{result.embedding_info?.index}</span>

                    <span className="text-gray-400">Namespace:</span>
                    <span className="text-pink-200">{result.embedding_info?.namespace}</span>

                    <span className="text-gray-400">ID Format:</span>
                    <span className="text-pink-200">{`${result.book?.id}_character_[character_name]`}</span>
                  </div>

                  <div className="mt-3 text-xs text-gray-400">
                    <p>Check server logs for the exact IDs of each record if needed for future reference or deletion.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Opening Lines-specific results */}
          {result.opening_lines && (
            <>
              <div className="mb-4">
                <h3 className="font-medium mb-2">Storage Information</h3>
                <div className="bg-gray-800 p-4 rounded-md">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-gray-400">Database:</span>
                    <span>{result.storage_info?.database || "Supabase"}</span>

                    <span className="text-gray-400">Table:</span>
                    <span>{result.storage_info?.table || "book_opening_lines"}</span>

                    <span className="text-gray-400">Total Lines:</span>
                    <span>{result.line_count}</span>

                    <span className="text-gray-400">Model:</span>
                    <span>claude-sonnet-4-20250514</span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-medium mb-2">Opening Lines ({result.line_count})</h3>
                <div className="space-y-6">
                  {result.opening_lines.map((line: OpeningLine, index: number) => (
                    <div key={index} className="bg-gray-800 p-4 rounded-md">
                      <div className="flex flex-wrap justify-between items-center mb-3">
                        <h4 className="font-medium text-amber-300 text-lg">{line.character_name}</h4>
                        <span className="text-xs text-gray-400">{line.type}</span>
                      </div>

                      <p className="text-white mb-4 italic">&ldquo;{line.opening_line}&rdquo;</p>

                      <div className="mb-3">
                        <h5 className="text-sm font-medium text-gray-300 mb-1">Related Concepts:</h5>
                        <div className="flex flex-wrap gap-2">
                          {line.related_concepts && (() => {
                            try {
                              // Check if it's an array first
                              if (Array.isArray(line.related_concepts)) {
                                return line.related_concepts.map((concept, i) => (
                                  <span key={i} className="px-2 py-1 bg-amber-900/30 text-amber-200 text-xs rounded-full">
                                    {typeof concept === 'string' ? concept : JSON.stringify(concept)}
                                  </span>
                                ));
                              }
                              // Handle string case
                              else if (typeof line.related_concepts === 'string') {
                                return (
                                  <span className="px-2 py-1 bg-amber-900/30 text-amber-200 text-xs rounded-full">
                                    {line.related_concepts}
                                  </span>
                                );
                              }
                              // Other object cases
                              else if (typeof line.related_concepts === 'object' && line.related_concepts !== null) {
                                return (
                                  <span className="px-2 py-1 bg-amber-900/30 text-amber-200 text-xs rounded-full">
                                    Related concepts (object format)
                                  </span>
                                );
                              }
                              // Fallback
                              return null;
                            } catch (error) {
                              console.error("Error displaying related concepts:", error);
                              return <span className="text-red-400">Error displaying concepts</span>;
                            }
                          })()}
                        </div>
                      </div>

                      {line.example_conversation && (
                        <div className="mt-4">
                          <h5 className="text-sm font-medium text-gray-300 mb-2">Example Conversation:</h5>
                          <div className="space-y-3 pl-3 border-l-2 border-gray-700">
                            {line.example_conversation.map((message: { speaker: string; text: string }, i: number) => (
                              <div key={i} className={`${message.speaker === 'ai' ? 'text-amber-200' : 'text-blue-200'}`}>
                                <span className="font-bold">{message.speaker === 'ai' ? line.character_name : 'User'}:</span> {message.text}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Show upload URL if available */}
          {result.upload_url && (
            <div className="mb-6 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
              <h3 className="text-blue-300 font-medium text-lg mb-2">Shareable Link Created</h3>
              <p className="text-gray-300 mb-3">Your book export is available at the following URL:</p>

              <div className="bg-blue-950/50 p-3 rounded border border-blue-800 mb-3">
                <div className="flex items-center">
                  <input
                    type="text"
                    value={result.upload_url}
                    readOnly
                    className="bg-transparent border-none w-full text-blue-200 focus:outline-none p-1"
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(result.upload_url || '');
                      alert("Link copied to clipboard!");
                    }}
                    className="ml-2 bg-blue-700 hover:bg-blue-600 text-white py-1 px-3 rounded-md text-sm flex-shrink-0"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Remove expiry info since we're not using it */}

              <p className="text-gray-400 text-xs mt-3">
                This link is obscured and not publicly listed. Only people with the exact URL can access it.
              </p>

              <div className="mt-3">
                <a
                  href={result.upload_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded-md text-sm inline-block"
                >
                  View Uploaded File
                </a>
              </div>
            </div>
          )}

          <div className="mt-6">
            <h3 className="font-medium mb-2">Full Response</h3>
            <div className="bg-gray-800 p-3 rounded-md">
              <pre className="text-xs overflow-auto max-h-96 text-gray-300">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>

          {/* Special button for retrying Chapter 16 - placed at bottom */}
          <div className="bg-red-900/20 border border-red-800/60 p-4 rounded-lg mt-8">
            <h3 className="text-lg font-medium mb-2 text-red-300">Special Retry Tool</h3>
            <p className="text-gray-300 text-sm mb-4">This button will specifically retry processing Chapter 16 (Obsessive-compulsive disorder) for the psychology handbook.</p>
            <button
              onClick={async () => {
                try {
                  // Show loading state
                  const button = document.getElementById('retry-ch16-button');
                  if (button) button.textContent = 'Processing... (This may take a minute)';

                  const response = await fetch('/api/preprocessing/extract-concepts/simple-retry', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}) // No parameters needed as it's hardcoded
                  });

                  const data = await response.json();

                  if (!response.ok) {
                    throw new Error(data.error || 'Error processing chapter');
                  }

                  // Reset button text
                  if (button) button.textContent = 'Retry Chapter 16 (Obsessive-compulsive disorder)';

                  // Show success message
                  alert(`Success! Extracted ${data.concepts_extracted} concepts for Chapter 16. Refresh the page to see updated results.`);
                } catch (err) {
                  // Reset button text
                  const button = document.getElementById('retry-ch16-button');
                  if (button) button.textContent = 'Retry Chapter 16 (Obsessive-compulsive disorder)';

                  console.error('Error:', err);
                  alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
                }
              }}
              id="retry-ch16-button"
              className="bg-red-700 hover:bg-red-600 text-white py-2 px-4 rounded text-sm font-medium text-center w-full"
            >
              Retry Chapter 16 (Obsessive-compulsive disorder)
            </button>
          </div>
        </div>
      )}
      {/* Special button for retrying Chapter 16 - always visible at bottom */}
      {/* Chapter-by-Chapter Character Profiles Tool */}
      <div className="bg-indigo-900/20 border border-indigo-800/60 p-4 rounded-lg mt-8">
        <h3 className="text-lg font-medium mb-2 text-indigo-300">Character Profiles Generator</h3>
        <p className="text-gray-300 text-sm mb-4">
          Process multiple chapters for psychology handbook (ID: 2b169bda-011b-4834-8454-e30fed95669d).
          This tool will process chapters in sequence with a delay between each to avoid rate limits.
        </p>

        <div className="flex space-x-4 mb-4">
          <div className="flex-1">
            <label htmlFor="startChapter" className="block text-sm text-gray-300 mb-1">
              Start Chapter
            </label>
            <input
              id="startChapter"
              type="number"
              min="1"
              max="30"
              value={startChapter}
              onChange={(e) => setStartChapter(e.target.value)}
              className="p-2 bg-gray-700 rounded border border-gray-600 text-white w-full"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="endChapter" className="block text-sm text-gray-300 mb-1">
              End Chapter
            </label>
            <input
              id="endChapter"
              type="number"
              min="1"
              max="30"
              value={endChapter}
              onChange={(e) => setEndChapter(e.target.value)}
              className="p-2 bg-gray-700 rounded border border-gray-600 text-white w-full"
            />
          </div>
        </div>

        <button
          onClick={async () => {
            if (!bookId.trim()) {
              setError('Book ID is required');
              return;
            }

            if (bookId.trim() !== '2b169bda-011b-4834-8454-e30fed95669d') {
              setError('This function is only for the psychology textbook (ID: 2b169bda-011b-4834-8454-e30fed95669d)');
              return;
            }

            const start = parseInt(startChapter, 10);
            const end = parseInt(endChapter, 10);

            if (isNaN(start) || start < 1 || start > 30) {
              setError('Start chapter must be between 1 and 30');
              return;
            }

            if (isNaN(end) || end < start || end > 30) {
              setError('End chapter must be between start chapter and 30');
              return;
            }

            try {
              setProcessingType('chapterCharacters');
              setError(null);
              setResult(null);

              // Process the first chapter
              const processChapter = async (chapterNum: number) => {
                console.log(`Processing chapter ${chapterNum} for book ID: ${bookId}`);

                const response = await fetch('/api/preprocessing/character-profiles/chapter-by-chapter', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    book_id: bookId.trim(),
                    chapter_number: chapterNum.toString(),
                    debug: true
                  })
                });

                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.error || `API error: ${response.status}`);
                }

                return await response.json();
              };

              // Initialize results
              const results = {
                totalChapters: end - start + 1,
                processedChapters: 0,
                totalCharacters: 0,
                chapters: [] as Array<{ number: number; title: string; characters: number }>
              };

              // Process the first chapter immediately
              const firstResult = await processChapter(start);
              results.processedChapters++;
              results.totalCharacters += firstResult.characters_processed;
              results.chapters.push({
                number: start,
                title: firstResult.chapter.title,
                characters: firstResult.characters_processed
              });

              // Update UI with initial result
              setResult({
                success: true,
                message: `Processed chapter ${start}. Processing chapters ${start + 1} to ${end} will continue in the background.`,
                book: firstResult.book,
                character_count: firstResult.characters_processed,
                processing_summary: {
                  total_chapters: end - start + 1,
                  successful_chapters: 1,
                  chapters_remaining: end - start
                }
              });

              // Continue processing remaining chapters in the background with rate limiting
              // This runs after the function returns, so the UI won't be blocked
              (async () => {
                for (let chapter = start + 1; chapter <= end; chapter++) {
                  try {
                    // Wait 20 seconds between chapters to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 20000));

                    // Update UI to show we're processing the next chapter
                    setResult(prevResult => {
                      if (!prevResult) return prevResult;
                      return {
                        ...prevResult,
                        message: `Processing chapter ${chapter} of ${end}...`,
                        processing_summary: {
                          ...prevResult.processing_summary,
                          current_chapter: chapter
                        }
                      };
                    });

                    // Process this chapter
                    const chapterResult = await processChapter(chapter);

                    // Update the results
                    results.processedChapters++;
                    results.totalCharacters += chapterResult.characters_processed;
                    results.chapters.push({
                      number: chapter,
                      title: chapterResult.chapter.title,
                      characters: chapterResult.characters_processed
                    });

                    // Update the UI with progress
                    setResult(prevResult => {
                      if (!prevResult) return prevResult;
                      return {
                        ...prevResult,
                        message: `Processed ${results.processedChapters} of ${results.totalChapters} chapters. Total characters: ${results.totalCharacters}.`,
                        character_count: results.totalCharacters,
                        processing_summary: {
                          total_chapters: results.totalChapters,
                          successful_chapters: results.processedChapters,
                          chapters_remaining: results.totalChapters - results.processedChapters
                        }
                      };
                    });
                  } catch (chapterError) {
                    console.error(`Error processing chapter ${chapter}:`, chapterError);

                    // Update UI with error but continue processing
                    setResult(prevResult => {
                      if (!prevResult) return prevResult;
                      return {
                        ...prevResult,
                        message: `Error processing chapter ${chapter}: ${chapterError instanceof Error ? chapterError.message : String(chapterError)}. Continuing with next chapter...`,
                        processing_summary: {
                          ...prevResult.processing_summary,
                          error_chapters: [...(prevResult.processing_summary?.error_chapters || []), { chapter: chapter.toString(), error: chapterError instanceof Error ? chapterError.message : String(chapterError) }]
                        }
                      };
                    });

                    // Wait a bit longer after an error
                    await new Promise(resolve => setTimeout(resolve, 10000));
                  }
                }

                // All done - update UI with final status
                setResult(prevResult => {
                  if (!prevResult) return prevResult;
                  return {
                    ...prevResult,
                    message: `Completed processing ${results.processedChapters} of ${results.totalChapters} chapters. Total characters: ${results.totalCharacters}.`,
                    processing_summary: {
                      ...prevResult.processing_summary,
                      completed: true,
                      completed_at: new Date().toISOString()
                    }
                  };
                });

                // End processing state
                setProcessingType('none');
              })();

            } catch (err) {
              console.error(`Error processing chapters:`, err);
              setError(err instanceof Error ? err.message : String(err));
              setProcessingType('none');
            }
          }}
          disabled={isLoading}
          className={`w-full flex items-center justify-center py-3 px-4 rounded-md ${isLoading ? 'opacity-60 cursor-not-allowed bg-gray-700 text-gray-300' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
        >
          {isLoading && processingType === 'chapterCharacters' ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing Chapters...
            </>
          ) : (
            <>
              Process Chapters {startChapter} to {endChapter}
            </>
          )}
        </button>

        <div className="mt-4 text-xs text-gray-400">
          <p>Important notes:</p>
          <ul className="list-disc list-inside pl-2 mt-1 space-y-1">
            <li>The process will run chapters in sequence with a 20-second delay between each</li>
            <li>You can leave this page open to see progress updates</li>
            <li>Progress continues in the background even if you navigate away</li>
            <li>Character profiles are automatically merged across chapters</li>
            <li>Expect processing to take ~10 minutes per chapter</li>
          </ul>
        </div>

        {result && result.processing_summary && (
          <div className="mt-4 p-3 bg-indigo-900/30 border border-indigo-800 rounded-md">
            <h4 className="text-sm font-medium text-indigo-300 mb-2">Processing Status</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Total Chapters:</span>
                <span>{result.processing_summary.total_chapters}</span>
              </div>
              <div className="flex justify-between">
                <span>Completed:</span>
                <span>{result.processing_summary.successful_chapters}</span>
              </div>
              {result.processing_summary.error_chapters && result.processing_summary.error_chapters.length > 0 && (
                <div className="flex justify-between text-red-300">
                  <span>Failed Chapters:</span>
                  <span>{result.processing_summary.error_chapters.join(', ')}</span>
                </div>
              )}
              {result.processing_summary.current_chapter && !result.processing_summary.completed && (
                <div className="flex justify-between text-green-300">
                  <span>Currently Processing:</span>
                  <span>Chapter {result.processing_summary.current_chapter}</span>
                </div>
              )}
              {result.processing_summary.completed && (
                <div className="flex justify-between text-green-300 font-medium">
                  <span>Status:</span>
                  <span>Complete</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Opening Lines Chapter by Chapter Tool */}
      <div className="bg-amber-900/20 border border-amber-800/60 p-4 rounded-lg mt-8">
        <h3 className="text-lg font-medium mb-2 text-amber-300">Opening Lines Generator (Chapter by Chapter)</h3>
        <p className="text-gray-300 text-sm mb-4">
          Generate one opening line per chapter for the psychology textbook (ID: 2b169bda-011b-4834-8454-e30fed95669d).
          Each chapter will get a single opening line using its specific content, ensuring no overlap between chapters.
        </p>

        <div className="flex space-x-4 mb-4">
          <div className="flex-1">
            <label htmlFor="openingLinesStartChapter" className="block text-sm text-gray-300 mb-1">
              Start Chapter
            </label>
            <input
              id="openingLinesStartChapter"
              type="number"
              min="1"
              max="30"
              value={openingLinesStartChapter}
              onChange={(e) => setOpeningLinesStartChapter(e.target.value)}
              className="p-2 bg-gray-700 rounded border border-gray-600 text-white w-full"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="openingLinesEndChapter" className="block text-sm text-gray-300 mb-1">
              End Chapter
            </label>
            <input
              id="openingLinesEndChapter"
              type="number"
              min="1"
              max="30"
              value={openingLinesEndChapter}
              onChange={(e) => setOpeningLinesEndChapter(e.target.value)}
              className="p-2 bg-gray-700 rounded border border-gray-600 text-white w-full"
            />
          </div>
        </div>

        <button
          onClick={async () => {
            if (!bookId.trim()) {
              setError('Book ID is required');
              return;
            }

            if (bookId.trim() !== '2b169bda-011b-4834-8454-e30fed95669d') {
              setError('This function is only for the psychology textbook (ID: 2b169bda-011b-4834-8454-e30fed95669d)');
              return;
            }

            try {
              setProcessingType('chapterOpeningLines');
              setError(null);
              setResult(null);
              setStartTime(new Date());

              console.log(`[Client] Starting chapter-by-chapter opening lines generation for book ID: ${bookId}`);
              console.log(`[Client] Processing chapters ${openingLinesStartChapter} to ${openingLinesEndChapter}`);

              // Call our API endpoint
              const response = await fetch('/api/preprocessing/opening-lines', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  book_id: bookId.trim(),
                  chapter_by_chapter: true,
                  start_chapter: parseInt(openingLinesStartChapter),
                  end_chapter: parseInt(openingLinesEndChapter)
                }),
              });

              const data = await response.json();

              if (!response.ok) {
                throw new Error(data.error || `API error: ${response.status}`);
              }

              console.log(`[Client] Successfully generated ${data.line_count} opening lines`);
              setResult(data);
            } catch (err) {
              console.error('Error generating chapter opening lines:', err);
              setError(err instanceof Error ? err.message : String(err));
            } finally {
              setProcessingType('none');
            }
          }}
          disabled={isLoading}
          className={`w-full flex items-center justify-center py-3 px-4 rounded-md ${isLoading ? 'opacity-60 cursor-not-allowed bg-gray-700 text-gray-300' : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
        >
          {isLoading && processingType === 'chapterOpeningLines' ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating Opening Lines...
              {startTime && (
                <span className="ml-2 text-xs">
                  ({Math.floor((new Date().getTime() - startTime.getTime()) / 60000)}m {Math.floor(((new Date().getTime() - startTime.getTime()) % 60000) / 1000)}s)
                </span>
              )}
            </>
          ) : (
            <>
              Generate Opening Lines for Chapters {openingLinesStartChapter} to {openingLinesEndChapter}
            </>
          )}
        </button>

        <div className="mt-4 text-xs text-gray-400">
          <p>Important notes:</p>
          <ul className="list-disc list-inside pl-2 mt-1 space-y-1">
            <li>Each chapter will get a unique opening line focused on that chapter&apos;s content</li>
            <li>The system uses the same Claude model and prompt format as the regular opening lines</li>
            <li>Opening lines are stored in the same database table</li>
            <li>Chapter-specific concepts are used to make opening lines more targeted</li>
            <li>This process uses the existing book structure analysis from the concepts generation</li>
          </ul>
        </div>
      </div>


      {/* Chapter-by-Chapter Quests Generator */}
      <div className="bg-green-900/20 border border-green-800/60 p-4 rounded-lg mt-8">
        <h3 className="text-lg font-medium mb-2 text-green-300">Quests Generator (Chapter by Chapter)</h3>
        <p className="text-gray-300 text-sm mb-4">
          Generate educational quests chapter by chapter for the book selected above. This approach works better for large books that exceed context limits.
          Each chapter will get a single quest using its specific content, ensuring targeted learning experiences for any book.
        </p>

        <div className="flex space-x-4 mb-4">
          <div className="flex-1">
            <label htmlFor="questsStartChapter" className="block text-sm text-gray-300 mb-1">
              Start Chapter
            </label>
            <input
              id="questsStartChapter"
              type="number"
              min="1"
              max="30"
              value={questsStartChapter}
              onChange={(e) => setQuestsStartChapter(e.target.value)}
              className="p-2 bg-gray-700 rounded border border-gray-600 text-white w-full"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="questsEndChapter" className="block text-sm text-gray-300 mb-1">
              End Chapter
            </label>
            <input
              id="questsEndChapter"
              type="number"
              min="1"
              max="30"
              value={questsEndChapter}
              onChange={(e) => setQuestsEndChapter(e.target.value)}
              className="p-2 bg-gray-700 rounded border border-gray-600 text-white w-full"
            />
          </div>
        </div>

        <button
          onClick={async () => {
            if (!bookId.trim()) {
              setError('Book ID is required');
              return;
            }

            try {
              setProcessingType('chapterQuests');
              setError(null);
              setResult(null);
              setStartTime(new Date());

              console.log(`[Client] Starting chapter-by-chapter quest generation for book ID: ${bookId}`);
              console.log(`[Client] Processing chapters ${questsStartChapter} to ${questsEndChapter}`);

              // Log if a user ID is available for custom prompt selection
              if (user?.uid) {
                console.log(`[Client] 👤 Including user ID: ${user.uid} for custom prompt selection`);
              } else {
                console.log(`[Client] ⚠️ No user ID available - using default prompt`);
              }

              // Call our API endpoint
              const response = await fetch('/api/preprocessing/generate-quests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  book_id: bookId.trim(),
                  chapter_by_chapter: true,
                  start_chapter: parseInt(questsStartChapter),
                  end_chapter: parseInt(questsEndChapter),
                  userId: user?.uid // Include user ID for custom prompt selection
                }),
              });

              const data = await response.json();

              if (!response.ok) {
                throw new Error(data.error || `API error: ${response.status}`);
              }

              console.log(`[Client] Successfully generated ${data.quest_count} quests`);
              setResult(data);
            } catch (err) {
              console.error('Error generating chapter quests:', err);
              setError(err instanceof Error ? err.message : String(err));
            } finally {
              setProcessingType('none');
            }
          }}
          disabled={isLoading}
          className={`w-full flex items-center justify-center py-3 px-4 rounded-md ${isLoading ? 'opacity-60 cursor-not-allowed bg-gray-700 text-gray-300' : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
        >
          {isLoading && processingType === 'chapterQuests' ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating Quests...
              {startTime && (
                <span className="ml-2 text-xs">
                  ({Math.floor((new Date().getTime() - startTime.getTime()) / 60000)}m {Math.floor(((new Date().getTime() - startTime.getTime()) % 60000) / 1000)}s)
                </span>
              )}
            </>
          ) : (
            <>
              Generate Quests for Chapters {questsStartChapter} to {questsEndChapter}
            </>
          )}
        </button>

        <div className="mt-4 text-xs text-gray-400">
          <p>Important notes:</p>
          <ul className="list-disc list-inside pl-2 mt-1 space-y-1">
            <li>Each chapter will get a unique quest focused on that chapter&apos;s content</li>
            <li>Uses the book selected in the dropdown at the top of this page</li>
            <li>Works with any book - more reliable for large books than the standard generator</li>
            <li>Progress is logged to the console so you can see each quest as it&apos;s generated</li>
            <li>If one chapter fails, others can still be processed</li>
            <li>Chapter-specific content is used to make quests relevant to that section</li>
          </ul>
        </div>
      </div>

      {/* Book Data Viewer Display */}
      {result && result.show_book_data_view && (
        <div id="bookDataViewer" className="bg-blue-900/30 border border-blue-800/60 p-4 rounded-lg mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-blue-300">{result.book?.title}</h2>
            <button
              onClick={() => {
                // Create a text input field to copy the book ID
                const textarea = document.createElement('textarea');
                textarea.value = result.book?.id || '';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);

                // Show temporary copy confirmation
                const button = document.getElementById('copyIdButton');
                if (button) {
                  const originalText = button.textContent;
                  button.textContent = 'Copied!';
                  setTimeout(() => {
                    button.textContent = originalText;
                  }, 2000);
                }
              }}
              id="copyIdButton"
              className="px-2 py-1 bg-blue-700 hover:bg-blue-600 text-sm rounded text-white"
            >
              Copy ID
            </button>
          </div>

          {result.book?.author && (
            <div className="mb-4">
              <span className="text-gray-400">Author:</span> <span className="text-white">{result.book.author}</span>
            </div>
          )}

          <div className="bg-blue-950/30 p-2 rounded mb-6 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[120px]">
              <div className="text-3xl font-semibold text-blue-300">{Array.isArray(result.concepts) ? result.concepts.length : 0}</div>
              <div className="text-gray-400 text-sm">Key Concepts</div>
            </div>
            <div className="flex-1 min-w-[120px]">
              <div className="text-3xl font-semibold text-green-300">{Array.isArray(result.character_profiles) ? result.character_profiles.length : 0}</div>
              <div className="text-gray-400 text-sm">Character Profiles</div>
            </div>
            <div className="flex-1 min-w-[120px]">
              <div className="text-3xl font-semibold text-amber-300">{Array.isArray(result.opening_lines) ? result.opening_lines.length : 0}</div>
              <div className="text-gray-400 text-sm">Opening Lines</div>
            </div>
          </div>

          {/* Search Input */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search in book content..."
              className="w-full p-3 bg-gray-800 rounded border border-gray-700 text-white"
              onChange={(e) => {
                const searchTerm = e.target.value.toLowerCase();

                // Simple client-side filtering
                document.querySelectorAll('.concept-item').forEach((el) => {
                  if (searchTerm === '') {
                    el.classList.remove('hidden');
                  } else {
                    const contentEl = el as HTMLElement;
                    const text = contentEl.innerText.toLowerCase();
                    if (text.includes(searchTerm)) {
                      el.classList.remove('hidden');
                    } else {
                      el.classList.add('hidden');
                    }
                  }
                });

                document.querySelectorAll('.profile-item').forEach((el) => {
                  if (searchTerm === '') {
                    el.classList.remove('hidden');
                  } else {
                    const contentEl = el as HTMLElement;
                    const text = contentEl.innerText.toLowerCase();
                    if (text.includes(searchTerm)) {
                      el.classList.remove('hidden');
                    } else {
                      el.classList.add('hidden');
                    }
                  }
                });

                document.querySelectorAll('.opening-line-item').forEach((el) => {
                  if (searchTerm === '') {
                    el.classList.remove('hidden');
                  } else {
                    const contentEl = el as HTMLElement;
                    const text = contentEl.innerText.toLowerCase();
                    if (text.includes(searchTerm)) {
                      el.classList.remove('hidden');
                    } else {
                      el.classList.add('hidden');
                    }
                  }
                });

                document.querySelectorAll('.quest-item').forEach((el) => {
                  if (searchTerm === '') {
                    el.classList.remove('hidden');
                  } else {
                    const contentEl = el as HTMLElement;
                    const text = contentEl.innerText.toLowerCase();
                    if (text.includes(searchTerm)) {
                      el.classList.remove('hidden');
                    } else {
                      el.classList.add('hidden');
                    }
                  }
                });
              }}
            />
          </div>

          {/* Tab Navigation */}
          <div className="flex mb-6 border-b border-gray-700">
            <button
              onClick={() => {
                document.getElementById('conceptsTab')?.classList.remove('hidden');
                document.getElementById('profilesTab')?.classList.add('hidden');
                document.getElementById('openingLinesTab')?.classList.add('hidden');
                document.getElementById('questsTab')?.classList.add('hidden');

                document.querySelectorAll('.tab-button').forEach((el) => el.classList.remove('border-blue-500', 'text-blue-300'));
                document.getElementById('conceptsButton')?.classList.add('border-blue-500', 'text-blue-300');
              }}
              id="conceptsButton"
              className="tab-button px-4 py-2 border-b-2 border-blue-500 text-blue-300"
            >
              Concepts
            </button>
            <button
              onClick={() => {
                document.getElementById('conceptsTab')?.classList.add('hidden');
                document.getElementById('profilesTab')?.classList.remove('hidden');
                document.getElementById('openingLinesTab')?.classList.add('hidden');
                document.getElementById('questsTab')?.classList.add('hidden');

                document.querySelectorAll('.tab-button').forEach((el) => el.classList.remove('border-blue-500', 'text-blue-300'));
                document.getElementById('profilesButton')?.classList.add('border-blue-500', 'text-blue-300');
              }}
              id="profilesButton"
              className="tab-button px-4 py-2 border-b-2 border-transparent text-gray-400 hover:text-gray-300"
            >
              Character Profiles
            </button>
            <button
              onClick={() => {
                document.getElementById('conceptsTab')?.classList.add('hidden');
                document.getElementById('profilesTab')?.classList.add('hidden');
                document.getElementById('openingLinesTab')?.classList.remove('hidden');
                document.getElementById('questsTab')?.classList.add('hidden');

                document.querySelectorAll('.tab-button').forEach((el) => el.classList.remove('border-blue-500', 'text-blue-300'));
                document.getElementById('openingLinesButton')?.classList.add('border-blue-500', 'text-blue-300');
              }}
              id="openingLinesButton"
              className="tab-button px-4 py-2 border-b-2 border-transparent text-gray-400 hover:text-gray-300"
            >
              Opening Lines
            </button>
            <button
              onClick={() => {
                document.getElementById('conceptsTab')?.classList.add('hidden');
                document.getElementById('profilesTab')?.classList.add('hidden');
                document.getElementById('openingLinesTab')?.classList.add('hidden');
                document.getElementById('questsTab')?.classList.remove('hidden');

                document.querySelectorAll('.tab-button').forEach((el) => el.classList.remove('border-blue-500', 'text-blue-300'));
                document.getElementById('questsButton')?.classList.add('border-blue-500', 'text-blue-300');
              }}
              id="questsButton"
              className="tab-button px-4 py-2 border-b-2 border-transparent text-gray-400 hover:text-gray-300"
            >
              Quests
            </button>
          </div>

          {/* Concepts Tab */}
          <div id="conceptsTab" className="mb-6">
            <div className="space-y-6">
              {Array.isArray(result.concepts) && result.concepts.length > 0 ? (
                result.concepts.map((concept, index) => (
                  <div key={index} className="concept-item bg-gray-800 p-4 rounded-md">
                    <h3 className="text-lg font-medium text-blue-300 mb-2">{concept.concept}</h3>
                    <p className="text-gray-300">{concept.description}</p>
                  </div>
                ))
              ) : (
                <div className="text-gray-400 p-4 bg-gray-800/50 rounded-md">
                  No concept data available for this book.
                </div>
              )}
            </div>
          </div>

          {/* Character Profiles Tab (Initially Hidden) */}
          <div id="profilesTab" className="mb-6 hidden">
            <div className="space-y-6">
              {Array.isArray(result.character_profiles) && result.character_profiles.length > 0 ? (
                result.character_profiles.map((profile, index) => (
                  <div key={index} className="profile-item bg-gray-800 p-4 rounded-md">
                    <h3 className="text-lg font-medium text-green-300 mb-3">{profile.character_name}</h3>
                    <div
                      className="text-gray-300 profile-content"
                      dangerouslySetInnerHTML={{
                        __html: formatCharacterProfile(profile.character_profile)
                      }}
                    />
                  </div>
                ))
              ) : (
                <div className="text-gray-400 p-4 bg-gray-800/50 rounded-md">
                  No character profile data available for this book.
                </div>
              )}
            </div>
          </div>

          {/* Opening Lines Tab (Initially Hidden) */}
          <div id="openingLinesTab" className="mb-6 hidden">
            <div className="space-y-6">
              {Array.isArray(result.opening_lines) && result.opening_lines.length > 0 ? (
                result.opening_lines.map((line, index) => (
                  <div key={index} className="opening-line-item bg-gray-800 p-4 rounded-md">
                    <div className="flex flex-wrap justify-between items-center mb-3">
                      <h3 className="font-medium text-amber-300 text-lg">{line.character_name}</h3>
                      {line.type && <span className="text-xs text-gray-400">{line.type}</span>}
                    </div>
                    <blockquote className="text-white pl-3 border-l-2 border-amber-500 italic mb-4">
                      &ldquo;{line.opening_line}&rdquo;
                    </blockquote>

                    {line.related_concepts && (
                      <div>
                        <div className="text-sm text-gray-400 mb-2">Related Concepts:</div>
                        <div className="flex flex-wrap gap-2">
                          {(() => {
                            // Display related concepts safely with robust type checking
                            try {
                              // Case 1: Array of strings (most common)
                              if (Array.isArray(line.related_concepts)) {
                                return line.related_concepts.map((concept, i) => (
                                  <span key={i} className="px-2 py-1 text-xs bg-amber-900/30 text-amber-300 rounded-full">
                                    {typeof concept === 'string' ? concept : JSON.stringify(concept)}
                                  </span>
                                ));
                              }

                              // Case 2: Single string
                              if (typeof line.related_concepts === 'string') {
                                return (
                                  <span className="px-2 py-1 text-xs bg-amber-900/30 text-amber-300 rounded-full">
                                    {line.related_concepts}
                                  </span>
                                );
                              }

                              // Case 3: Object with values (try to extract)
                              if (typeof line.related_concepts === 'object' && line.related_concepts !== null) {
                                return (
                                  <span className="px-2 py-1 text-xs bg-amber-900/30 text-amber-300 rounded-full">
                                    Related concepts available (object format)
                                  </span>
                                );
                              }

                              // Default: unknown format
                              return (
                                <span className="px-2 py-1 text-xs bg-red-900/30 text-red-300 rounded-full">
                                  Unknown format
                                </span>
                              );
                            } catch (error) {
                              // Error fallback
                              console.error("Error rendering related concepts:", error);
                              return (
                                <span className="px-2 py-1 text-xs bg-red-900/30 text-red-300 rounded-full">
                                  Error displaying concepts
                                </span>
                              );
                            }
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-gray-400 p-4 bg-gray-800/50 rounded-md">
                  No opening lines available for this book.
                </div>
              )}
            </div>
          </div>

          {/* Quests Tab (Initially Hidden) */}
          <div id="questsTab" className="mb-6 hidden">
            {/* Content truncation warning */}
            {Array.isArray(result.quests) && result.quests.length > 0 &&
              !result.chapter_by_chapter && !result.is_mental_health_book && (
                <div className="mb-4 p-4 bg-amber-900/20 border border-amber-700 rounded-md">
                  <h4 className="text-amber-300 font-medium mb-2">⚠️ Content Limitation Notice</h4>
                  <p className="text-amber-200 text-sm mb-2">
                    Due to context window limitations, only the first 25,000 characters of the book were used to generate these quests.
                    This may result in quests that primarily cover concepts from the beginning of the book.
                  </p>
                  <p className="text-amber-200 text-sm">
                    For larger books, consider using the <span className="font-medium">Chapter-by-Chapter</span> approach instead,
                    which processes each chapter separately and provides better coverage of the entire book.
                  </p>
                </div>
              )
            }
            <div className="space-y-6">
              {Array.isArray(result.quests) && result.quests.length > 0 ? (
                result.quests.map((quest, index) => (
                  <div key={index} className="quest-item bg-gray-800 p-4 rounded-md">
                    <div className="mb-3">
                      <h3 className="font-medium text-green-300 text-lg">{quest.quest_title}</h3>
                      <div className="text-xs text-gray-400 mt-1">Chapter {quest.chapter_number}: {quest.chapter_title}</div>
                    </div>

                    <div className="mb-4">
                      <div className="text-sm font-medium text-gray-300 mb-1">Introduction:</div>
                      <p className="text-white pl-3 border-l-2 border-green-500 py-1">{quest.introduction}</p>
                    </div>

                    <div className="mb-4">
                      <div className="text-sm font-medium text-gray-300 mb-1">Challenge:</div>
                      <p className="text-white pl-3 border-l-2 border-green-500 py-1">{quest.challenge}</p>
                    </div>

                    <div className="mb-4">
                      <div className="text-sm font-medium text-gray-300 mb-1">Reward:</div>
                      <p className="text-white pl-3 border-l-2 border-green-500 py-1">{quest.reward}</p>
                    </div>

                    <div>
                      <div className="text-sm font-medium text-gray-300 mb-1">Starting Question:</div>
                      <blockquote className="text-white pl-3 border-l-2 border-green-500 italic py-1">
                        &ldquo;{quest.starting_question}&rdquo;
                      </blockquote>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-400 p-4 bg-gray-800/50 rounded-md">
                  No educational quests available for this book.
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-center mt-8">
            <button
              onClick={() => {
                // Remove the book data view
                setResult(prevResult => {
                  if (!prevResult) return null;
                  // Using type assertion to handle properties not in the interface
                  const rest = { ...prevResult };
                  // Need to use unknown for proper type safety
                  delete (rest as Record<string, unknown>).show_book_data_view;
                  return { ...rest, success: true };
                });
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
            >
              Close Book View
            </button>
          </div>
        </div>
      )}

      {/* Special Retry Tool */}
      <div className="bg-red-900/20 border border-red-800/60 p-4 rounded-lg mt-8">
        <h3 className="text-lg font-medium mb-2 text-red-300">Special Retry Tool</h3>
        <p className="text-gray-300 text-sm mb-4">This button will specifically retry processing Chapter 16 (Obsessive-compulsive disorder) for the psychology handbook with ID: 2b169bda-011b-4834-8454-e30fed95669d</p>
        <button
          onClick={async () => {
            try {
              // Show loading state
              const button = document.getElementById('retry-ch16-button');
              if (button) button.textContent = 'Processing... (This may take a minute)';

              const response = await fetch('/api/preprocessing/extract-concepts/simple-retry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}) // No parameters needed as it's hardcoded
              });

              const data = await response.json();

              if (!response.ok) {
                throw new Error(data.error || 'Error processing chapter');
              }

              // Reset button text
              if (button) button.textContent = 'Retry Chapter 16 (Obsessive-compulsive disorder)';

              // Show success message
              alert(`Success! Extracted ${data.concepts_extracted} concepts for Chapter 16. If you've already run the main extraction process, refresh the page to see updated results.`);
            } catch (err) {
              // Reset button text
              const button = document.getElementById('retry-ch16-button');
              if (button) button.textContent = 'Retry Chapter 16 (Obsessive-compulsive disorder)';

              console.error('Error:', err);
              alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
            }
          }}
          id="retry-ch16-button"
          className="bg-red-700 hover:bg-red-600 text-white py-2 px-4 rounded text-sm font-medium text-center w-full"
        >
          Retry Chapter 16 (Obsessive-compulsive disorder)
        </button>
      </div>

      {/* User Insights Section */}
      <div className="bg-gray-900 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">User Insights Processing</h2>
        <p className="text-gray-400 mb-4">Process conversation data to generate user insights. This is restricted to authorized administrators only.</p>

        <button
          onClick={handleGenerateInsights}
          disabled={isLoading}
          className={`bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md w-full flex items-center justify-center`}
        >
          {isLoading && processingType === 'insights' ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing User Insights...
              {startTime && (
                <span className="ml-2 text-xs">
                  ({Math.floor((new Date().getTime() - startTime.getTime()) / 60000)}m {Math.floor(((new Date().getTime() - startTime.getTime()) % 60000) / 1000)}s)
                </span>
              )}
            </>
          ) : (
            <>
              Process User Insights
            </>
          )}
        </button>

        <div className="mt-3 text-xs text-gray-400">
          <p>Important notes:</p>
          <ul className="list-disc list-inside pl-2 mt-1 space-y-1">
            <li>This action analyzes user conversations to extract meaningful insights</li>
            <li>Analysis may take 5-10 minutes to complete</li>
            <li>Only authorized administrators can use this function</li>
            <li>All data is analyzed in a privacy-respecting manner</li>
          </ul>
        </div>
      </div>

      {/* User ID display at the bottom of the page */}
      <div className="mt-8 p-4 border-t border-gray-800 text-center">
        <p className="text-sm text-gray-500">Your user ID: <span className="font-mono bg-gray-900 px-2 py-1 rounded">{user?.uid || 'Not logged in'}</span></p>
        <p className="text-xs text-gray-600 mt-1">Only authorized users can embed book content.</p>
      </div>
    </div>
  );
}

// Helper function to generate HTML content for book data export
/* eslint-disable @typescript-eslint/no-unused-vars */
function generateBookDataHtml(data: {
  book: { title: string; id: string; author?: string };
  concepts: Array<KeyConcept> | unknown[];
  character_profiles: Array<CharacterProfile> | unknown[];
  opening_lines: Array<OpeningLine> | unknown[];
  quests?: Array<Quest> | unknown[];
}): string {
  // Extract book data
  const { book } = data;

  // Count the items
  const conceptsCount = Array.isArray(data.concepts) ? data.concepts.length : 0;
  const profilesCount = Array.isArray(data.character_profiles) ? data.character_profiles.length : 0;
  const linesCount = Array.isArray(data.opening_lines) ? data.opening_lines.length : 0;
  const questsCount = Array.isArray(data.quests) ? data.quests.length : 0;

  // Generate HTML string with proper formatting and styling
  let html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n';
  html += '  <meta charset="UTF-8">\n';
  html += '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
  html += `  <title>Book Export: ${book.title}</title>\n`;
  html += '  <style>\n';
  html += '    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; max-width: 1100px; margin: 0 auto; padding: 30px 20px; color: #333; }\n';
  html += '    .section { margin-bottom: 3rem; padding: 1.5rem; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }\n';
  html += '    h1 { font-size: 2.5rem; color: #2c3e50; margin-bottom: 1rem; }\n';
  html += '    h2 { font-size: 1.8rem; color: #3498db; margin: 0 0 1.5rem; padding-bottom: 0.5rem; border-bottom: 2px solid #eee; }\n';
  html += '    h3 { font-size: 1.3rem; color: #2c3e50; margin: 1.2rem 0 0.8rem; }\n';
  html += '    .meta { background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 2rem; }\n';
  html += '    .meta p { margin: 0.5rem 0; }\n';
  html += '    .concept, .character-profile, .opening-line { margin-bottom: 1.8rem; padding-bottom: 1.8rem; border-bottom: 1px solid #eee; }\n';
  html += '    .concept:last-child, .character-profile:last-child, .opening-line:last-child { border-bottom: none; }\n';
  html += '    .section-nav { background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 2rem; text-align: center; }\n';
  html += '    .section-nav a { color: #3498db; text-decoration: none; padding: 5px 10px; font-weight: 500; }\n';
  html += '    .section-nav a:hover { text-decoration: underline; }\n';
  html += '    blockquote { border-left: 4px solid #3498db; margin: 0; padding: 0.5rem 0 0.5rem 1rem; font-style: italic; background-color: #f8f9fa; }\n';
  html += '    .profile-section { font-weight: bold; color: #2c3e50; margin-top: 1rem; margin-bottom: 0.5rem; }\n';
  html += '    .footer { text-align: center; margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #eee; color: #7f8c8d; font-size: 0.9rem; }\n';
  html += '    @media (max-width: 768px) { body { padding: 15px 10px; } .section { padding: 1rem; } }\n';
  html += '  </style>\n';
  html += '</head>\n<body>\n';

  // Book header
  html += `  <h1>${book.title}</h1>\n`;
  html += '  <div class="meta">\n';
  html += `    <p><strong>Book ID:</strong> ${book.id}</p>\n`;
  if (book.author) {
    html += `    <p><strong>Author:</strong> ${book.author}</p>\n`;
  }
  html += `    <p><strong>Export Date:</strong> ${new Date().toLocaleString()}</p>\n`;
  html += `    <p><strong>Key Concepts:</strong> ${conceptsCount}</p>\n`;
  html += `    <p><strong>Character Profiles:</strong> ${profilesCount}</p>\n`;
  html += `    <p><strong>Opening Lines:</strong> ${linesCount}</p>\n`;
  html += `    <p><strong>Educational Quests:</strong> ${questsCount}</p>\n`;
  html += '  </div>\n\n';

  // Navigation
  html += '  <div class="section-nav">\n';
  html += `    <a href="#concepts">Key Concepts (${conceptsCount})</a> | \n`;
  html += `    <a href="#characters">Character Profiles (${profilesCount})</a> | \n`;
  html += `    <a href="#opening-lines">Opening Lines (${linesCount})</a> | \n`;
  html += `    <a href="#quests">Educational Quests (${questsCount})</a>\n`;
  html += '  </div>\n\n';

  // Concepts section
  html += '  <div id="concepts" class="section">\n';
  html += `    <h2>Key Concepts (${conceptsCount})</h2>\n`;

  if (Array.isArray(data.concepts) && data.concepts.length > 0) {
    data.concepts.forEach(conceptItem => {
      const concept = conceptItem as KeyConcept;
      html += '    <div class="concept">\n';
      html += `      <h3>${concept.concept}</h3>\n`;
      html += `      <p>${concept.description}</p>\n`;
      html += '    </div>\n';
    });
  } else {
    html += '    <p>No concepts available for this book.</p>\n';
  }
  html += '  </div>\n\n';

  // Character profiles section
  html += '  <div id="characters" class="section">\n';
  html += `    <h2>Character Profiles (${profilesCount})</h2>\n`;

  if (Array.isArray(data.character_profiles) && data.character_profiles.length > 0) {
    data.character_profiles.forEach(profileItem => {
      const profile = profileItem as CharacterProfile;
      html += '    <div class="character-profile">\n';
      html += `      <h3>${profile.character_name}</h3>\n`;
      html += `      <div>${formatCharacterProfile(profile.character_profile)}</div>\n`;
      html += '    </div>\n';
    });
  } else {
    html += '    <p>No character profiles available for this book.</p>\n';
  }
  html += '  </div>\n\n';

  // Opening lines section
  html += '  <div id="opening-lines" class="section">\n';
  html += `    <h2>Opening Lines (${linesCount})</h2>\n`;

  if (Array.isArray(data.opening_lines) && data.opening_lines.length > 0) {
    data.opening_lines.forEach(lineItem => {
      const line = lineItem as OpeningLine;
      html += '    <div class="opening-line">\n';
      html += `      <h3>${line.character_name}${line.type ? ` (${line.type})` : ''}</h3>\n`;
      html += `      <blockquote>"${line.opening_line}"</blockquote>\n`;
      html += '    </div>\n';
    });
  } else {
    html += '    <p>No opening lines available for this book.</p>\n';
  }
  html += '  </div>\n\n';

  // Educational quests section
  html += '  <div id="quests" class="section">\n';
  html += `    <h2>Educational Quests (${questsCount})</h2>\n`;

  if (Array.isArray(data.quests) && data.quests.length > 0) {
    data.quests.forEach(questItem => {
      const quest = questItem as Quest;
      html += '    <div class="quest">\n';
      html += `      <h3>${quest.quest_title}</h3>\n`;
      html += `      <div class="text-sm text-gray-500">Chapter ${quest.chapter_number}: ${quest.chapter_title}</div>\n`;
      html += '      <div class="quest-content mt-3">\n';
      html += `        <div class="mb-2"><strong>Introduction:</strong> ${quest.introduction}</div>\n`;
      html += `        <div class="mb-2"><strong>Challenge:</strong> ${quest.challenge}</div>\n`;
      html += `        <div class="mb-2"><strong>Reward:</strong> ${quest.reward}</div>\n`;
      html += `        <div><strong>Starting Question:</strong> <em>"${quest.starting_question}"</em></div>\n`;
      html += '      </div>\n';
      html += '    </div>\n';
    });
  } else {
    html += '    <p>No educational quests available for this book.</p>\n';
  }
  html += '  </div>\n\n';

  // Footer
  html += '  <div class="footer">\n';
  html += `    <p>Generated by RiseTwice Preprocessor on ${new Date().toLocaleString()}</p>\n`;
  html += '  </div>\n';
  html += '</body>\n</html>';

  return html;
}

// Helper function to format character profiles nicely
function formatCharacterProfile(profile: string): string {
  if (!profile) return '';

  // Handle both inline bold format (**SECTION:**) and older format on separate lines
  if (profile.includes('**')) {
    // New format: process markdown-style bold section headers
    return profile.replace(/\*\*(IDENTITY|PSYCHOLOGY|COMMUNICATION|RELATIONSHIPS|CHARACTER ARC|THEMATIC SIGNIFICANCE|RESPONSE PATTERNS|KNOWLEDGE BOUNDARIES):\*\*/gi,
      (match, section) => `<div class="profile-section">${section}:</div>`);
  } else {
    // Legacy format: split by double newlines and format
    let formattedProfile = '';
    const parts = profile.split(/(\n\s*\n)/);

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      // Check if this part is a section header
      if (part.match(/^(IDENTITY|PSYCHOLOGY|COMMUNICATION|RELATIONSHIPS|CHARACTER ARC|THEMATIC SIGNIFICANCE|RESPONSE PATTERNS|KNOWLEDGE BOUNDARIES)/i)) {
        formattedProfile += `<div class="profile-section">${part}</div>`;
      } else if (part.match(/\n\s*\n/)) {
        // Line break
        formattedProfile += '<br>';
      } else {
        // Regular paragraph
        formattedProfile += `<p>${part}</p>`;
      }
    }

    return formattedProfile;
  }
}

// Generate a standalone HTML file that can be viewed directly
/* eslint-disable @typescript-eslint/no-unused-vars */
function generateStandaloneHtml(data: {
  book: { title: string; id: string; author?: string };
  concepts: Array<KeyConcept> | unknown[];
  character_profiles: Array<CharacterProfile> | unknown[];
  opening_lines: Array<OpeningLine> | unknown[];
  quests?: Array<Quest> | unknown[];
}): string {
  // Extract book data
  const { book } = data;

  // Count the items
  const conceptsCount = Array.isArray(data.concepts) ? data.concepts.length : 0;
  const profilesCount = Array.isArray(data.character_profiles) ? data.character_profiles.length : 0;
  const linesCount = Array.isArray(data.opening_lines) ? data.opening_lines.length : 0;
  const questsCount = Array.isArray(data.quests) ? data.quests.length : 0;

  // Generate HTML string with inline script for interactive features
  let html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n';
  html += '  <meta charset="UTF-8">\n';
  html += '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
  html += '  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">\n';
  html += `  <title>Book Export: ${book.title}</title>\n`;
  html += '  <style>\n';
  html += '    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; max-width: 1100px; margin: 0 auto; padding: 30px 20px; color: #333; }\n';
  html += '    .section { margin-bottom: 3rem; padding: 1.5rem; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }\n';
  html += '    h1 { font-size: 2.5rem; color: #2c3e50; margin-bottom: 1rem; }\n';
  html += '    h2 { font-size: 1.8rem; color: #3498db; margin: 0 0 1.5rem; padding-bottom: 0.5rem; border-bottom: 2px solid #eee; }\n';
  html += '    h3 { font-size: 1.3rem; color: #2c3e50; margin: 1.2rem 0 0.8rem; }\n';
  html += '    .meta { background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 2rem; }\n';
  html += '    .meta p { margin: 0.5rem 0; }\n';
  html += '    .concept, .character-profile, .opening-line { margin-bottom: 1.8rem; padding-bottom: 1.8rem; border-bottom: 1px solid #eee; }\n';
  html += '    .concept:last-child, .character-profile:last-child, .opening-line:last-child { border-bottom: none; }\n';
  html += '    .section-nav { background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 2rem; text-align: center; }\n';
  html += '    .section-nav a { color: #3498db; text-decoration: none; padding: 5px 10px; font-weight: 500; }\n';
  html += '    .section-nav a:hover { text-decoration: underline; }\n';
  html += '    blockquote { border-left: 4px solid #3498db; margin: 0; padding: 0.5rem 0 0.5rem 1rem; font-style: italic; background-color: #f8f9fa; }\n';
  html += '    .profile-section { font-weight: bold; color: #2c3e50; margin-top: 1rem; margin-bottom: 0.5rem; }\n';
  html += '    .footer { text-align: center; margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #eee; color: #7f8c8d; font-size: 0.9rem; }\n';
  html += '    @media (max-width: 768px) { body { padding: 15px 10px; } .section { padding: 1rem; } }\n';
  html += '    .search-box { margin-bottom: 20px; padding: 10px; background-color: #f8f9fa; border-radius: 6px; }\n';
  html += '    .search-box input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }\n';
  html += '    .highlight { background-color: yellow; }\n';
  html += '    .item-hidden { display: none; }\n';
  html += '  </style>\n';
  html += '</head>\n<body>\n';

  // Book header
  html += `  <h1>${book.title}</h1>\n`;
  html += '  <div class="meta">\n';
  html += `    <p><strong>Book ID:</strong> ${book.id}</p>\n`;
  if (book.author) {
    html += `    <p><strong>Author:</strong> ${book.author}</p>\n`;
  }
  html += `    <p><strong>Export Date:</strong> ${new Date().toLocaleString()}</p>\n`;
  html += `    <p><strong>Key Concepts:</strong> ${conceptsCount}</p>\n`;
  html += `    <p><strong>Character Profiles:</strong> ${profilesCount}</p>\n`;
  html += `    <p><strong>Opening Lines:</strong> ${linesCount}</p>\n`;
  html += `    <p><strong>Educational Quests:</strong> ${questsCount}</p>\n`;
  html += '  </div>\n\n';

  // Add search box
  html += '  <div class="search-box">\n';
  html += '    <input type="text" id="searchInput" placeholder="Search in all content..." onkeyup="searchContent()">\n';
  html += '  </div>\n\n';

  // Navigation
  html += '  <div class="section-nav">\n';
  html += `    <a href="#concepts">Key Concepts (${conceptsCount})</a> | \n`;
  html += `    <a href="#characters">Character Profiles (${profilesCount})</a> | \n`;
  html += `    <a href="#opening-lines">Opening Lines (${linesCount})</a> | \n`;
  html += `    <a href="#quests">Educational Quests (${questsCount})</a>\n`;
  html += '  </div>\n\n';

  // Concepts section
  html += '  <div id="concepts" class="section">\n';
  html += `    <h2>Key Concepts (${conceptsCount})</h2>\n`;

  if (Array.isArray(data.concepts) && data.concepts.length > 0) {
    data.concepts.forEach((conceptItem, index) => {
      const concept = conceptItem as KeyConcept;
      html += `    <div class="concept" id="concept-${index}">\n`;
      html += `      <h3>${concept.concept}</h3>\n`;
      html += `      <p>${concept.description}</p>\n`;
      html += '    </div>\n';
    });
  } else {
    html += '    <p>No concepts available for this book.</p>\n';
  }
  html += '  </div>\n\n';

  // Character profiles section
  html += '  <div id="characters" class="section">\n';
  html += `    <h2>Character Profiles (${profilesCount})</h2>\n`;

  if (Array.isArray(data.character_profiles) && data.character_profiles.length > 0) {
    data.character_profiles.forEach((profileItem, index) => {
      const profile = profileItem as CharacterProfile;
      html += `    <div class="character-profile" id="profile-${index}">\n`;
      html += `      <h3>${profile.character_name}</h3>\n`;
      html += `      <div>${formatCharacterProfile(profile.character_profile)}</div>\n`;
      html += '    </div>\n';
    });
  } else {
    html += '    <p>No character profiles available for this book.</p>\n';
  }
  html += '  </div>\n\n';

  // Opening lines section
  html += '  <div id="opening-lines" class="section">\n';
  html += `    <h2>Opening Lines (${linesCount})</h2>\n`;

  if (Array.isArray(data.opening_lines) && data.opening_lines.length > 0) {
    data.opening_lines.forEach((lineItem, index) => {
      const line = lineItem as OpeningLine;
      html += `    <div class="opening-line" id="line-${index}">\n`;
      html += `      <h3>${line.character_name}${line.type ? ` (${line.type})` : ''}</h3>\n`;
      html += `      <blockquote>"${line.opening_line}"</blockquote>\n`;
      html += '    </div>\n';
    });
  } else {
    html += '    <p>No opening lines available for this book.</p>\n';
  }
  html += '  </div>\n\n';

  // Educational quests section
  html += '  <div id="quests" class="section">\n';
  html += `    <h2>Educational Quests (${questsCount})</h2>\n`;

  if (Array.isArray(data.quests) && data.quests.length > 0) {
    data.quests.forEach((questItem, index) => {
      const quest = questItem as Quest;
      html += `    <div class="quest" id="quest-${index}">\n`;
      html += `      <h3>${quest.quest_title}</h3>\n`;
      html += `      <div class="text-sm text-gray-500">Chapter ${quest.chapter_number}: ${quest.chapter_title}</div>\n`;
      html += '      <div class="quest-content mt-3">\n';
      html += `        <div class="mb-2"><strong>Introduction:</strong> ${quest.introduction}</div>\n`;
      html += `        <div class="mb-2"><strong>Challenge:</strong> ${quest.challenge}</div>\n`;
      html += `        <div class="mb-2"><strong>Reward:</strong> ${quest.reward}</div>\n`;
      html += `        <div><strong>Starting Question:</strong> <em>"${quest.starting_question}"</em></div>\n`;
      html += '      </div>\n';
      html += '    </div>\n';
    });
  } else {
    html += '    <p>No educational quests available for this book.</p>\n';
  }
  html += '  </div>\n\n';

  // Footer
  html += '  <div class="footer">\n';
  html += `    <p>Generated by RiseTwice Preprocessor on ${new Date().toLocaleString()}</p>\n`;
  html += '    <p>This is a standalone HTML file that can be opened directly in your browser.</p>\n';
  html += '  </div>\n';

  // Add search script
  html += '  <script>\n';
  html += '    function searchContent() {\n';
  html += '      const searchInput = document.getElementById("searchInput");\n';
  html += '      const filter = searchInput.value.toUpperCase();\n';
  html += '      const concepts = document.querySelectorAll(".concept");\n';
  html += '      const profiles = document.querySelectorAll(".character-profile");\n';
  html += '      const lines = document.querySelectorAll(".opening-line");\n';
  html += '      const quests = document.querySelectorAll(".quest");\n';
  html += '      let totalVisible = 0;\n';
  html += '\n';
  html += '      // Clear previous highlights\n';
  html += '      document.querySelectorAll(".highlight").forEach(el => {\n';
  html += '        el.outerHTML = el.innerHTML;\n';
  html += '      });\n';
  html += '\n';
  html += '      // Helper function to check and highlight text\n';
  html += '      function checkAndHighlight(element) {\n';
  html += '        const text = element.innerText.toUpperCase();\n';
  html += '        if (filter && text.includes(filter)) {\n';
  html += '          element.classList.remove("item-hidden");\n';
  html += '          totalVisible++;\n';
  html += '\n';
  html += '          // Highlight matching text\n';
  html += '          if (filter.length > 2) { // Only highlight for searches with 3+ chars\n';
  html += '            const html = element.innerHTML;\n';
  html += '            const regex = new RegExp(filter, "gi");\n';
  html += '            element.innerHTML = html.replace(regex, match => `<span class="highlight">${match}</span>`);\n';
  html += '          }\n';
  html += '          return true;\n';
  html += '        } else if (!filter) {\n';
  html += '          element.classList.remove("item-hidden");\n';
  html += '          totalVisible++;\n';
  html += '          return true;\n';
  html += '        } else {\n';
  html += '          element.classList.add("item-hidden");\n';
  html += '          return false;\n';
  html += '        }\n';
  html += '      }\n';
  html += '\n';
  html += '      // Search in concepts\n';
  html += '      concepts.forEach(concept => {\n';
  html += '        checkAndHighlight(concept);\n';
  html += '      });\n';
  html += '\n';
  html += '      // Search in profiles\n';
  html += '      profiles.forEach(profile => {\n';
  html += '        checkAndHighlight(profile);\n';
  html += '      });\n';
  html += '\n';
  html += '      // Search in opening lines\n';
  html += '      lines.forEach(line => {\n';
  html += '        checkAndHighlight(line);\n';
  html += '      });\n';
  html += '\n';
  html += '      // Search in quests\n';
  html += '      quests.forEach(quest => {\n';
  html += '        checkAndHighlight(quest);\n';
  html += '      });\n';
  html += '    }\n';
  html += '  </script>\n';
  html += '</body>\n</html>';

  return html;
}
