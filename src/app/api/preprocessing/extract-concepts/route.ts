/**
 * API endpoint for extracting key concepts from a book
 * 
 * IMPORTANT NOTE: This endpoint only passes the book ID to the service, not the book content.
 * The actual book content is fetched and processed server-side in the bookConcepts service
 * to avoid sending large book texts over the network.
 */
import { NextResponse } from 'next/server';
import { extractKeyConceptsFromBook } from '@/services/bookConcepts';
import { supabase } from '@/lib/supabase';
import { getClaudeModel } from '@/config/models';

// Force dynamic responses to prevent caching
export const dynamic = 'force-dynamic';

// Ensure required environment variables are set
const requiredEnvVars = [
  { name: 'ANTHROPIC_API_KEY', prefixCheck: 'sk-ant-' }
];

function validateEnvironmentVariables() {
  const missing = [];
  const invalid = [];

  for (const { name, prefixCheck } of requiredEnvVars) {
    const value = process.env[name];
    if (!value) {
      missing.push(name);
    } else if (prefixCheck && !value.startsWith(prefixCheck)) {
      invalid.push(`${name} (should start with "${prefixCheck}")`);
    }
  }

  return { missing, invalid };
}

export async function POST(req: Request) {
  // Generate a unique request ID for tracing through logs
  const requestId = new Date().getTime().toString().slice(-6);
  const logPrefix = `[Preprocessing-Extract-Concepts][${requestId}]`;

  console.log(`${logPrefix} === STARTING CONCEPT EXTRACTION ===`);

  try {
    // Validate environment variables first
    const { missing, invalid } = validateEnvironmentVariables();

    if (missing.length > 0 || invalid.length > 0) {
      console.error(`${logPrefix} Environment variable issues:`);

      if (missing.length > 0) {
        console.error(`${logPrefix} Missing required environment variables: ${missing.join(', ')}`);
      }

      if (invalid.length > 0) {
        console.error(`${logPrefix} Invalid environment variables: ${invalid.join(', ')}`);
      }

      return NextResponse.json({
        error: 'Configuration error',
        details: {
          message: 'Missing or invalid environment variables',
          missing: missing.length > 0 ? missing : undefined,
          invalid: invalid.length > 0 ? invalid : undefined,
        }
      }, { status: 500 });
    }

    // Parse request body - we only need the book_id
    // The actual book content is fetched on the server side
    const body = await req.json();
    const { book_id, debug = false } = body;

    // Set debug level if requested
    if (debug) {
      console.log(`${logPrefix} DEBUG MODE ENABLED - More verbose logging will be shown`);
    }

    if (!book_id) {
      return NextResponse.json({ error: 'Book ID is required' }, { status: 400 });
    }

    console.log(`${logPrefix} Extracting concepts for book ID: ${book_id}`);

    // Step 1: Check if book exists in Supabase
    const { data: book, error: bookError } = await supabase
      .from('books_v2')
      .select('id, title')
      .eq('id', book_id)
      .single();

    if (bookError || !book) {
      console.error(`${logPrefix} Error fetching book:`, bookError);
      return NextResponse.json({
        error: 'Failed to fetch book',
        details: bookError
      }, { status: 404 });
    }

    console.log(`${logPrefix} Found book: ${book.title}`);

    // Step 2: Extract key concepts
    // This service will fetch the full book content server-side, process it,
    // and send it to Claude - all on the server side
    console.log(`${logPrefix} Starting extraction process...`);

    // Note: debug flag support was removed for simplicity
    const concepts = await extractKeyConceptsFromBook(book_id);

    console.log(`${logPrefix} Successfully extracted ${concepts.key_concepts.length} key concepts`);

    // Step 3: Return success response with detailed logging
    console.log(`${logPrefix} ========== CONCEPT EXTRACTION COMPLETE ==========`);
    console.log(`${logPrefix} Book: "${book.title}" (ID: ${book.id})`);
    console.log(`${logPrefix} Database: Supabase`);
    console.log(`${logPrefix} Table: book_concepts`);
    console.log(`${logPrefix} Total Concepts: ${concepts.key_concepts.length}`);

    // Log chapter processing info if available (for large books)
    if (concepts.processing_info) {
      console.log(`${logPrefix} Chapter Processing Information:`);
      console.log(`${logPrefix} - Total Chapters: ${concepts.processing_info.total_chapters}`);
      console.log(`${logPrefix} - Processed Successfully: ${concepts.processing_info.processed_chapters}`);
      console.log(`${logPrefix} - Failed Chapters: ${concepts.processing_info.failed_chapters?.length || 0}`);
    }

    console.log(`${logPrefix} AI Model: ${getClaudeModel()}`);
    console.log(`${logPrefix} =======================================`);

    // Create response object
    const responseObject = {
      success: true,
      message: `Successfully extracted key concepts from "${book.title}"`,
      book: {
        id: book.id,
        title: book.title,
      },
      concept_count: concepts.key_concepts.length,
      concepts: concepts.key_concepts,
      storage_info: {
        database: "Supabase",
        table: "book_concepts"
      }
    };

    // Add processing info if available (for large books)
    if (concepts.processing_info) {
      Object.assign(responseObject, {
        processing_info: concepts.processing_info,
        processing_summary: {
          total_chapters: concepts.processing_info.total_chapters,
          successful_chapters: concepts.processing_info.processed_chapters,
          failed_chapters: concepts.processing_info.failed_chapters?.length || 0
        }
      });
    }

    return NextResponse.json(responseObject);

  } catch (error) {
    console.error(`${logPrefix} Error in concept extraction process:`, error);

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}