// src/app/api/v10/book-content/route.ts
/**
 * V10 API - Book Content Query Endpoint
 * 
 * This endpoint queries Pinecone for relevant book content based on user input.
 * Adapted from V9 implementation to work with the V10 WebRTC approach.
 */
import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Set max duration for the request (2 minutes)

interface BookContentRequestBody {
  query: string;
  book: string;
  namespace?: string;
  userId?: string;
}

// Initialize OpenAI client for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Debug endpoint that always returns a valid response
export async function GET() {
  return NextResponse.json({
    success: true,
    bookTitle: "Test Book",
    bookAuthor: "Test Author",
    content: "This is sample book content for testing. The main character faces many challenges and grows throughout the story. The themes explore identity, courage, and perseverance.",
    namespace: "test-namespace"
  });
}

export async function POST(req: Request) {
  // Generate a unique request ID for tracing through logs
  const requestId = new Date().getTime().toString().slice(-6);
  const logPrefix = `[V10-API-BookContent][${requestId}]`;

  console.log('===============================================')
  console.log(`${logPrefix} === STARTING BOOK CONTENT QUERY ===`);
  console.log('===============================================')

  try {
    // Parse request body
    let body: BookContentRequestBody;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error(`${logPrefix} Error parsing request JSON:`, parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { query, book, namespace: providedNamespace, userId } = body;

    if (!query) {
      console.warn(`${logPrefix} Request missing query`);
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    if (!book) {
      console.warn(`${logPrefix} Request missing book ID`);
      return NextResponse.json(
        { error: 'Book ID is required' },
        { status: 400 }
      );
    }

    // Check if we have all required environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error(`${logPrefix} Supabase configuration missing, this is a critical error`);
      return NextResponse.json({
        error: 'Supabase configuration missing',
        details: 'Database credentials not properly configured'
      }, { status: 500 });
    }

    // Verify Supabase connection before proceeding
    try {
      const testQuery = await supabase.from('books').select('count', { count: 'exact', head: true });

      if (testQuery.error) {
        console.error(`${logPrefix} Supabase connection failed:`, testQuery.error);
        return NextResponse.json({
          error: 'Database connection failed',
          details: testQuery.error.message
        }, { status: 500 });
      }

      console.log(`${logPrefix} Supabase connection verified successfully`);
    } catch (connectionError) {
      console.error(`${logPrefix} Supabase connection test failed:`, connectionError);
      return NextResponse.json({
        error: 'Database connection test failed',
        details: connectionError instanceof Error ? connectionError.message : String(connectionError)
      }, { status: 500 });
    }

    // Step 1: Get book information from Supabase using books_v2 table
    const { data: bookData, error: bookError } = await supabase
      .from('books_v2')
      .select('title, author, pinecone_namespace')
      .eq('id', book)
      .single();

    if (bookError) {
      console.error(`${logPrefix} Error fetching book info:`, bookError);
      // Continue with default values
    }

    const bookTitle = bookData?.title || "Unknown Book";
    const bookAuthor = bookData?.author || "Unknown Author";

    // Step 2: Determine namespace to use - prefer the one from the database if available
    const namespace = bookData?.pinecone_namespace || providedNamespace || `book-${book}`;

    // Check if we have Pinecone configuration
    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
      console.error(`${logPrefix} Pinecone configuration missing, this is a critical error`);
      return NextResponse.json({
        error: 'Pinecone configuration missing',
        details: 'Vector database credentials not properly configured'
      }, { status: 500 });
    }

    // Check if we have OpenAI API key for embeddings
    if (!process.env.OPENAI_API_KEY) {
      console.error(`${logPrefix} OpenAI API key missing, this is a critical error`);
      return NextResponse.json({
        error: 'OpenAI API key missing',
        details: 'API key not properly configured for embeddings'
      }, { status: 500 });
    }

    // Step 3: Generate embedding for the query
    let embedding;
    try {
      // Set embedding model
      const embeddingModel = "text-embedding-3-large";

      const embeddingResponse = await openai.embeddings.create({
        model: embeddingModel,
        input: query,
      });

      embedding = embeddingResponse.data[0].embedding;

      // Check if embedding has expected dimension (Pinecone indices have specific dimension requirements)
      // text-embedding-3-large = 3072, text-embedding-3-small = 1536, text-embedding-ada-002 = 1536
      const expectedDimension = 3072; // Using text-embedding-3-large which has 3072 dimensions
      if (embedding.length !== expectedDimension) {
        console.warn(`${logPrefix} DIMENSION MISMATCH WARNING: Expected embedding dimension ${expectedDimension}, but got ${embedding.length}`);
      }
    } catch (embeddingError) {
      console.error(`${logPrefix} Error generating embedding:`, {
        error: embeddingError instanceof Error ? embeddingError.message : String(embeddingError),
        errorType: embeddingError instanceof Error ? embeddingError.constructor.name : typeof embeddingError,
        stack: embeddingError instanceof Error ? embeddingError.stack : undefined
      });

      // Check if this is an authentication error
      if (embeddingError instanceof Error &&
        (embeddingError.message.includes('authentication') ||
          embeddingError.message.includes('API key'))) {
        console.error(`${logPrefix} This appears to be an authentication error with OpenAI. Check that the API key is correct and has permission to use embeddings.`);
      }

      // Return a detailed error response
      return NextResponse.json({
        error: 'Embedding generation failed',
        details: embeddingError instanceof Error ? embeddingError.message : String(embeddingError),
        // Always include a fallback content to avoid breaking the UI
        success: false,
        bookTitle,
        bookAuthor,
        content: `I'm having trouble analyzing your question right now. Let's continue our discussion based on what we've covered so far, or feel free to ask about another aspect of the story.`
      }, { status: 500 });
    }

    console.log(`${logPrefix} Query params: ${JSON.stringify({
      namespace: namespace,
      topK: 20,
      embeddingLength: embedding.length,
      embeddingModelUsed: "text-embedding-3-large"
    })}`);

    // Add this to confirm the index name being used
    console.log(`${logPrefix} Using Pinecone index: ${process.env.PINECONE_INDEX}`);



    // Step 4: Query Pinecone for similar vectors
    try {
      const pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!
      });

      // Add this to inspect index properties
      const indexDetails = await pinecone.describeIndex(process.env.PINECONE_INDEX!);
      console.log(`${logPrefix} Index details:`, indexDetails);

      // Verify Pinecone connection before proceeding
      try {
        const indexes = await pinecone.listIndexes();

        // Check if our target index exists
        const indexExists = indexes.indexes?.some(index => index.name === process.env.PINECONE_INDEX);
        if (!indexExists) {
          console.error(`${logPrefix} The specified Pinecone index '${process.env.PINECONE_INDEX}' does not exist!`);
        }
      } catch (connectionError) {
        console.error(`${logPrefix} Failed to connect to Pinecone:`, connectionError);
        throw new Error(`Pinecone connection failed: ${connectionError instanceof Error ? connectionError.message : String(connectionError)}`);
      }

      const index = pinecone.index(process.env.PINECONE_INDEX!);

      // Add this to check all namespaces and vector counts
      const stats = await index.describeIndexStats();
      console.log(`${logPrefix} Index stats:`, stats);

      // Then create a namespace-specific client
      const namespaceIndex = index.namespace(namespace);

      // Then query this namespace-specific client
      const queryResponse = await namespaceIndex.query({
        vector: embedding,
        topK: 20,
        includeMetadata: true
        // No filter needed for namespace
      });

      if (!queryResponse.matches || queryResponse.matches.length === 0) {
        console.error(`${logPrefix} *** tmr240 No matches found in Pinecone, this is a critical error`);

        // Log the user query to help improve content coverage
        if (userId) {
          try {
            await supabase
              .from('query_misses')
              .insert({
                user_id: userId,
                book_id: book,
                query,
                namespace,
                embedding_length: embedding.length,
                timestamp: new Date().toISOString()
              });
            console.log(`${logPrefix} Logged query miss to help improve content coverage`);
          } catch (logError) {
            console.error(`${logPrefix} Error logging query miss:`, logError);
          }
        }

        // Return an error response with detailed information
        return NextResponse.json({
          error: 'No content found',
          details: `No relevant content found for query: "${query}"`,
          errorContext: {
            namespace,
            bookId: book,
            embeddingLength: embedding.length
          },
          success: false,
          bookTitle,
          bookAuthor
        }, { status: 500 });
      }

      // After receiving queryResponse
      if (queryResponse.matches && queryResponse.matches.length > 0) {
        console.log(`${logPrefix} Number of matches before filtering:`, queryResponse.matches.length);

        // Filter matches with score below threshold (e.g., 0.6)
        const filteredMatches = queryResponse.matches.filter(match =>
          (match.score ?? 0) >= 0.2 //0.6
        );

        if (filteredMatches.length === 0) {
          // Handle case where all matches were filtered out
          console.error(`${logPrefix} All matches filtered out due to low similarity scores`);
          // Continue with your existing no-matches error handling
        } else {
          // Use filteredMatches instead of queryResponse.matches
          queryResponse.matches = filteredMatches;
        }
      }

      // Step 5: Format the response with content from matches      
      const formattedContent = queryResponse.matches
        .filter(match => match.metadata?.text)
        .map((match, index) => {
          // Define a proper type for the metadata structure
          const metadata = match.metadata as {
            text?: string;
            source?: string;
            page?: string | number;
            chapter?: string | number;
            [key: string]: unknown;
          };
          const source = metadata.source || `Source ${index + 1}`;
          const pageInfo = metadata.page ? `, Page ${metadata.page}` : '';
          const chapterInfo = metadata.chapter ? `Chapter ${metadata.chapter}${pageInfo}` : `${source}${pageInfo}`;

          return `[${chapterInfo}]\n${metadata.text}`;
        })
        .join('\n\n');

      console.log(`${logPrefix} === QUERY SUCCESSFUL ===`);

      // Log this successful query if we have a user ID
      if (userId) {
        try {
          await supabase
            .from('query_logs')
            .insert({
              user_id: userId,
              book_id: book,
              query,
              matches_count: queryResponse.matches.length,
              timestamp: new Date().toISOString()
            });
        } catch (logError) {
          console.error(`${logPrefix} Error logging query:`, logError);
          // Non-critical - continue despite error
        }
      }

      return NextResponse.json({
        success: true,
        bookTitle,
        bookAuthor,
        content: formattedContent,
        namespace,
        matches: queryResponse.matches.length
      });
    } catch (pineconeError) {
      console.error(`${logPrefix} Error querying Pinecone:`, {
        error: pineconeError instanceof Error ? pineconeError.message : String(pineconeError),
        errorType: pineconeError instanceof Error ? pineconeError.constructor.name : typeof pineconeError,
        stack: pineconeError instanceof Error ? pineconeError.stack : undefined
      });

      // Diagnostic logging for Pinecone errors
      if (pineconeError instanceof Error) {
        if (pineconeError.message.includes('authentication')) {
          console.error(`${logPrefix} This appears to be an authentication error. Check that the Pinecone API key is correct and has permission to access this index.`);
        } else if (pineconeError.message.includes('not found')) {
          console.error(`${logPrefix} This appears to be a resource not found error. Check that the index name is correct and exists.`);
        } else if (pineconeError.message.includes('dimension')) {
          console.error(`${logPrefix} This appears to be a dimension mismatch error. Ensure the embedding dimension matches what's expected by the index.`);
        }
      }

      // Check environment variables
      if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
        console.error(`${logPrefix} Environment variables for Pinecone may be missing or incorrect:`, {
          PINECONE_API_KEY_present: !!process.env.PINECONE_API_KEY,
          PINECONE_INDEX_present: !!process.env.PINECONE_INDEX,
          PINECONE_INDEX_value: process.env.PINECONE_INDEX || 'not set'
        });
      }

      // Return an error response with detailed information for debugging
      return NextResponse.json({
        error: 'Vector database query failed',
        details: pineconeError instanceof Error ? pineconeError.message : String(pineconeError),
        errorContext: {
          namespace,
          bookId: book,
          embeddingLength: embedding?.length,
          query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        },
        // Always include a fallback content to avoid breaking the UI
        success: false,
        bookTitle,
        bookAuthor,
        content: `I'm having trouble retrieving specific content from the book right now. Let's continue our discussion based on what we've covered so far, or feel free to ask about another aspect of the story.`
      }, { status: 500 });
    }

  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined
    });

    console.log(`${logPrefix} === FAILED TO COMPLETE BOOK CONTENT QUERY ===`);

    // Provide a fallback response that's helpful even in case of errors
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
      // Return some content so the UI doesn't get stuck
      success: false,
      bookTitle: "Book Content",
      content: `I'm having trouble retrieving specific content from the book right now. Let's continue our discussion based on what we've covered so far, or feel free to ask about another aspect of the story.`,
    }, { status: 500 });
  }
}