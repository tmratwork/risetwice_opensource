/**
 * API endpoint for generating character profiles from a book
 * 
 * IMPORTANT NOTE: This endpoint only passes the book ID to the service.
 * The actual book content is fetched and processed server-side in the characterProfiles service
 * to avoid sending large book texts over the network.
 */
import { NextResponse } from 'next/server';
import { generateCharacterProfilesFromBook } from '@/services/characterProfiles';
import { supabase } from '@/lib/supabase';

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
  const logPrefix = `[Preprocessing-Character-Profiles][${requestId}]`;

  console.log(`${logPrefix} === STARTING CHARACTER PROFILE GENERATION ===`);

  // Initialize variables used in error handling
  let requestedBookId = '';

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

    // Update our variable for error handling
    requestedBookId = book_id;

    // Set debug level if requested
    if (debug) {
      console.log(`${logPrefix} DEBUG MODE ENABLED - More verbose logging will be shown`);
    }

    if (!book_id) {
      return NextResponse.json({ error: 'Book ID is required' }, { status: 400 });
    }

    console.log(`${logPrefix} Generating character profiles for book ID: ${book_id}`);

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

    // Step 2: Generate character profiles
    // This service will fetch the full book content server-side, process it,
    // and send it to Claude - all on the server side
    console.log(`${logPrefix} Starting character profile generation process...`);

    // Pass the debug flag to enable more verbose logging
    const profiles = await generateCharacterProfilesFromBook(book_id, debug);

    console.log(`${logPrefix} Successfully generated profiles for ${profiles.length} characters`);

    // Step 3: Return success response with detailed logging
    console.log(`${logPrefix} ========== CHARACTER PROFILE GENERATION COMPLETE ==========`);
    console.log(`${logPrefix} Book: "${book.title}" (ID: ${book.id})`);
    console.log(`${logPrefix} Database: Supabase`);
    console.log(`${logPrefix} Table: book_character_profiles`);
    console.log(`${logPrefix} Total Characters: ${profiles.length}`);
    console.log(`${logPrefix} AI Model: claude-sonnet-4-20250514`);
    console.log(`${logPrefix} Characters: ${profiles.map(p => p.character_name).join(', ')}`);
    console.log(`${logPrefix} =======================================`);

    return NextResponse.json({
      success: true,
      message: `Successfully generated character profiles from "${book.title}"`,
      book: {
        id: book.id,
        title: book.title,
      },
      character_count: profiles.length,
      characters: profiles.map(p => ({
        name: p.character_name,
        profile_length: p.character_profile.length
      })),
      character_profiles: profiles,
      storage_info: {
        database: "Supabase",
        table: "book_character_profiles",
        storage_type: "individual_rows" // Indicate the storage format has changed
      }
    });

  } catch (error) {
    console.error(`${logPrefix} Error in character profile generation process:`, error);

    // Create a detailed error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';

    const errorDetails = {
      error: errorMessage,
      stack: errorStack,
      // Add more context to help diagnose
      context: {
        timestamp: new Date().toISOString(),
        book_id: requestedBookId || 'not set',
        request_id: requestId,
        error_type: errorType,
      }
    };

    console.error(`${logPrefix} Returning error details:`, errorDetails);

    return NextResponse.json(errorDetails, { status: 500 });
  }
}