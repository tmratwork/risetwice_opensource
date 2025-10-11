/**
 * API endpoint for generating opening lines from a book, its key concepts, and character profiles
 * 
 * IMPORTANT NOTE: This endpoint only passes the book ID to the service.
 * The actual book content, key concepts, and character profiles are fetched
 * server-side to avoid sending large amounts of data over the network.
 */
import { NextResponse } from 'next/server';
import { generateOpeningLinesFromBook } from '@/services/openingLines';
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
  const logPrefix = `[Preprocessing-Opening-Lines][${requestId}]`;

  console.log(`${logPrefix} === STARTING OPENING LINES GENERATION ===`);

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

    // Parse request body
    const body = await req.json();
    const {
      book_id,
      chapter_by_chapter = false,
      start_chapter,
      end_chapter
    } = body;

    if (!book_id) {
      return NextResponse.json({ error: 'Book ID is required' }, { status: 400 });
    }

    // Check chapter by chapter parameters if needed
    if (chapter_by_chapter) {
      console.log(`${logPrefix} Chapter-by-chapter mode requested for chapters ${start_chapter} to ${end_chapter}`);

      if (book_id !== '2b169bda-011b-4834-8454-e30fed95669d') {
        return NextResponse.json({
          error: 'Chapter-by-chapter mode is only available for the psychology textbook (ID: 2b169bda-011b-4834-8454-e30fed95669d)'
        }, { status: 400 });
      }

      if (!start_chapter || !end_chapter) {
        return NextResponse.json({
          error: 'Start and end chapter numbers are required for chapter-by-chapter mode'
        }, { status: 400 });
      }

      if (start_chapter < 1 || start_chapter > 30 || end_chapter < start_chapter || end_chapter > 30) {
        return NextResponse.json({
          error: 'Invalid chapter range. Start chapter must be between 1 and 30, and end chapter must be between start chapter and 30.'
        }, { status: 400 });
      }
    }

    console.log(`${logPrefix} Generating opening lines for book ID: ${book_id}`);

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

    // Step 2: Check if key concepts exist
    const { data: conceptsData, error: conceptsError } = await supabase
      .from('book_concepts')
      .select('id')
      .eq('book_id', book_id)
      .maybeSingle();

    if (conceptsError || !conceptsData) {
      console.error(`${logPrefix} Key concepts not found for book:`, conceptsError);
      return NextResponse.json({
        error: 'Key concepts not found for this book. Please generate key concepts first.',
        details: conceptsError
      }, { status: 400 });
    }

    // Step 3: Check if character profiles exist
    const { data: charactersData, error: charactersError } = await supabase
      .from('book_character_profiles')
      .select('id')
      .eq('book_id', book_id);

    if (charactersError) {
      console.error(`${logPrefix} Error checking character profiles:`, charactersError);
      return NextResponse.json({
        error: 'Error checking character profiles',
        details: charactersError
      }, { status: 500 });
    }

    if (!charactersData || charactersData.length === 0) {
      console.error(`${logPrefix} Character profiles not found for book ID: ${book_id}`);
      return NextResponse.json({
        error: 'Character profiles not found for this book. Please generate character profiles first.'
      }, { status: 400 });
    }

    console.log(`${logPrefix} Found ${charactersData.length} character profiles for book ID: ${book_id}`);

    // Step 4: Generate opening lines
    // This service will fetch the book content, key concepts, and character profiles
    // server-side, and send them to Claude in batches to manage token limits
    console.log(`${logPrefix} Starting opening lines generation process...`);

    // The openingLines.ts service now detects large books automatically,
    // but we can use the chapter_by_chapter flag to indicate we want to run specific chapters
    const openingLines = await generateOpeningLinesFromBook(book_id);

    // Process the book

    console.log(`${logPrefix} Successfully generated ${openingLines.length} opening lines`);

    // Step 5: Return success response with detailed logging
    console.log(`${logPrefix} ========== OPENING LINES GENERATION COMPLETE ==========`);
    console.log(`${logPrefix} Book: "${book.title}" (ID: ${book.id})`);
    console.log(`${logPrefix} Database: Supabase`);
    console.log(`${logPrefix} Table: opening_lines_v1`);
    console.log(`${logPrefix} Total Lines: ${openingLines.length}`);
    console.log(`${logPrefix} AI Model: ${getClaudeModel()}`);
    console.log(`${logPrefix} =======================================`);

    const response = {
      success: true,
      message: `Successfully generated ${openingLines.length} opening lines from "${book.title}"`,
      book: {
        id: book.id,
        title: book.title,
      },
      line_count: openingLines.length,
      opening_lines: openingLines,
      storage_info: {
        database: "Supabase",
        table: "opening_lines_v1"
      }
    };

    // Add chapter processing info if in chapter-by-chapter mode
    if (chapter_by_chapter) {
      Object.assign(response, {
        generation_mode: 'chapter_by_chapter',
        chapter_range: {
          start_chapter,
          end_chapter
        }
      });
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error(`${logPrefix} Error in opening lines generation process:`, error);

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}