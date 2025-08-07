// src/app/api/v15/query-book-content/route.ts
/**
 * V15 API - Query Book Content Endpoint
 * 
 * This endpoint queries Pinecone for relevant book content based on user input.
 * Adapted from V11 book-content implementation for V15/V16 compatibility.
 */
import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
// import { supabase } from '@/lib/supabase'; // Not used in this implementation

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Set max duration for the request (2 minutes)

interface QueryBookContentRequestBody {
  query: string;
  namespace?: string;
  filter_metadata?: Record<string, unknown>;
  top_k?: number;
}

// Initialize OpenAI client for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: Request) {
  // Generate a unique request ID for tracing through logs
  const requestId = new Date().getTime().toString().slice(-6);
  const logPrefix = `[V15-API-QueryBookContent][${requestId}]`;

  console.log('===============================================')
  console.log(`${logPrefix} === STARTING QUERY BOOK CONTENT ===`);
  console.log('===============================================')
  
  try {
    // Parse request body
    let body: QueryBookContentRequestBody;
    try {
      body = await req.json();
      console.log(`${logPrefix} INCOMING REQUEST BODY:`, JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error(`${logPrefix} Error parsing request JSON:`, parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { query, namespace = 'trauma_informed_youth_mental_health_companion_v250420', filter_metadata = {}, top_k = 5 } = body;

    if (!query) {
      console.warn(`${logPrefix} Request missing query`);
      return NextResponse.json(
        { error: 'Query is required' },
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

    // Generate embedding for the query
    let embedding;
    try {
      const embeddingModel = "text-embedding-3-large";

      const embeddingResponse = await openai.embeddings.create({
        model: embeddingModel,
        input: query,
      });

      embedding = embeddingResponse.data[0].embedding;

      // Check if embedding has expected dimension
      const expectedDimension = 3072; // text-embedding-3-large = 3072 dimensions
      if (embedding.length !== expectedDimension) {
        console.warn(`${logPrefix} DIMENSION MISMATCH WARNING: Expected embedding dimension ${expectedDimension}, but got ${embedding.length}`);
      }
    } catch (embeddingError) {
      console.error(`${logPrefix} Error generating embedding:`, {
        error: embeddingError instanceof Error ? embeddingError.message : String(embeddingError),
        errorType: embeddingError instanceof Error ? embeddingError.constructor.name : typeof embeddingError,
      });

      return NextResponse.json({
        error: 'Embedding generation failed',
        details: embeddingError instanceof Error ? embeddingError.message : String(embeddingError)
      }, { status: 500 });
    }

    console.log(`${logPrefix} Query params: ${JSON.stringify({
      namespace: namespace,
      topK: top_k,
      embeddingLength: embedding.length,
      embeddingModelUsed: "text-embedding-3-large",
      filterMetadata: filter_metadata
    })}`);

    // Query Pinecone for similar vectors
    try {
      console.log(`[pinecone ${logPrefix}] Initializing Pinecone client for query: "${query}"`);
      
      const pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!
      });

      console.log(`[pinecone ${logPrefix}] Getting index: ${process.env.PINECONE_INDEX}`);
      const index = pinecone.index(process.env.PINECONE_INDEX!);

      console.log(`[pinecone ${logPrefix}] Creating namespace-specific client for namespace: "${namespace}"`);
      const namespaceIndex = index.namespace(namespace);

      console.log(`[pinecone ${logPrefix}] Executing vector similarity query with topK=${top_k}, includeMetadata=true`);
      
      // Build filter from filter_metadata if provided
      const filter = Object.keys(filter_metadata).length > 0 ? filter_metadata : undefined;
      
      const queryResponse = await namespaceIndex.query({
        vector: embedding,
        topK: top_k,
        includeMetadata: true,
        filter: filter
      });

      console.log(`[pinecone ${logPrefix}] Query completed, analyzing results`);
      if (!queryResponse.matches || queryResponse.matches.length === 0) {
        console.error(`[pinecone ${logPrefix}] No matches found in Pinecone`);

        return NextResponse.json({
          error: 'No content found',
          details: `No relevant content found for query: "${query}"`,
          errorContext: {
            namespace,
            embeddingLength: embedding.length,
            filter: filter_metadata
          }
        }, { status: 404 });
      }

      console.log(`[pinecone ${logPrefix}] Found ${queryResponse.matches?.length || 0} raw matches from Pinecone`);
      
      // Filter matches with score below threshold
      const filteredMatches = queryResponse.matches.filter(match =>
        (match.score ?? 0) >= 0.2
      );

      console.log(`[pinecone ${logPrefix}] Relevance filtering: ${filteredMatches.length}/${queryResponse.matches.length} matches passed threshold (>=0.2)`);

      if (filteredMatches.length === 0) {
        console.error(`[pinecone ${logPrefix}] All matches filtered out due to low similarity scores`);
        return NextResponse.json({
          error: 'No relevant content found',
          details: 'All matches filtered out due to low similarity scores'
        }, { status: 404 });
      }

      // Format the response with content from matches
      console.log(`${logPrefix} Starting to format content from ${filteredMatches.length} matches`);
      
      const formattedData = filteredMatches.map((match, index) => {
        const metadata = match.metadata as {
          text?: string;
          source?: string;
          page?: string | number;
          chapter?: string | number;
          [key: string]: unknown;
        };
        
        console.log(`${logPrefix} Processing match ${index+1}/${filteredMatches.length}:`, {
          id: match.id,
          score: match.score, 
          textStart: metadata.text ? metadata.text.substring(0, 50) + "..." : "NO TEXT",
          source: metadata.source,
          chapter: metadata.chapter,
          page: metadata.page
        });
        
        return {
          id: match.id,
          score: match.score,
          text: metadata.text || '',
          source: metadata.source || `Source ${index + 1}`,
          page: metadata.page,
          chapter: metadata.chapter,
          metadata: metadata
        };
      }).filter(item => item.text.length > 0);

      console.log(`${logPrefix} Final data array length: ${formattedData.length} items`);
      console.log(`${logPrefix} === QUERY SUCCESSFUL ===`);

      return NextResponse.json({
        success: true,
        data: formattedData,
        namespace,
        matches: filteredMatches.length,
        query: query
      });

    } catch (pineconeError) {
      console.error(`${logPrefix} Error querying Pinecone:`, {
        error: pineconeError instanceof Error ? pineconeError.message : String(pineconeError),
        errorType: pineconeError instanceof Error ? pineconeError.constructor.name : typeof pineconeError,
      });

      return NextResponse.json({
        error: 'Vector database query failed',
        details: pineconeError instanceof Error ? pineconeError.message : String(pineconeError),
        errorContext: {
          namespace,
          embeddingLength: embedding?.length,
          query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        }
      }, { status: 500 });
    }

  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    });

    console.log(`${logPrefix} === FAILED TO COMPLETE QUERY BOOK CONTENT ===`);

    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}