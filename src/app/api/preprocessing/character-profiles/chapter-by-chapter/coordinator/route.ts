/**
 * Coordinator endpoint for chapter-by-chapter character profile extraction
 * 
 * This endpoint processes the specific book chapter by chapter, handling one
 * chapter at a time and carefully managing rate limits. It's designed for the 
 * psychology textbook with ID 2b169bda-011b-4834-8454-e30fed95669d.
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

// Force dynamic responses to prevent caching
export const dynamic = 'force-dynamic';

// Interfaces for data structures
interface ChapterInfo {
  chapterNumber: string;
  title: string;
  lineNumber: number;
  nextLineNumber?: number;
  section: string;
}

interface BookStructure {
  bookPath: string;
  totalLines: number;
  chapters: ChapterInfo[];
  [key: string]: unknown;
}

interface ProcessingStatus {
  book_id: string;
  status: 'in_progress' | 'completed' | 'error';
  processed_chapters: string[];
  current_chapter?: string;
  total_chapters: number;
  error_chapters: Array<{chapter: string; error: string}>;
  started_at: string;
  updated_at: string;
}

// Delay between chapter processing to respect rate limits
const CHAPTER_PROCESSING_DELAY_MS = 15000; // 15 seconds

// Sleep function for rate limiting
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(req: Request) {
  // Generate a unique request ID for tracing through logs
  const requestId = new Date().getTime().toString().slice(-6);
  const logPrefix = `[Character-Coordinator][${requestId}]`;
  
  console.log(`${logPrefix} === STARTING CHARACTER PROFILE COORDINATOR ===`);
  
  try {
    // Parse request body
    const body = await req.json();
    const { book_id, start_chapter, end_chapter, debug = false } = body;
    
    // This endpoint is specifically for the psychology textbook
    const targetBookId = '2b169bda-011b-4834-8454-e30fed95669d';
    
    if (book_id !== targetBookId) {
      return NextResponse.json({ 
        error: 'This endpoint is only for book ID: 2b169bda-011b-4834-8454-e30fed95669d'
      }, { status: 400 });
    }
    
    console.log(`${logPrefix} Starting chapter-by-chapter processing for book ID: ${book_id}`);
    
    // Step 1: Get book metadata from Supabase
    const { data: book, error: bookError } = await supabase
      .from('books_v2')
      .select('id, title')
      .eq('id', book_id)
      .single();

    if (bookError || !book) {
      throw new Error(`Failed to fetch book: ${bookError?.message || 'Book not found'}`);
    }

    const bookTitle = book.title;
    console.log(`${logPrefix} Found book "${bookTitle}" (ID: ${book.id})`);

    // Step 2: Load book structure analysis
    const structureFilePath = path.join(process.cwd(), 'src', 'tools', 'book_structure_analysis.json');
    if (!fs.existsSync(structureFilePath)) {
      throw new Error(`Book structure analysis file not found: ${structureFilePath}`);
    }

    const bookStructure: BookStructure = JSON.parse(fs.readFileSync(structureFilePath, 'utf8'));
    console.log(`${logPrefix} Loaded book structure with ${bookStructure.chapters.length} chapters`);
    
    // Step 3: Determine which chapters to process
    const startChapterNum = start_chapter ? parseInt(start_chapter, 10) : 1;
    const endChapterNum = end_chapter ? parseInt(end_chapter, 10) : bookStructure.chapters.length;
    
    // Validate chapter range
    if (startChapterNum < 1 || startChapterNum > bookStructure.chapters.length) {
      return NextResponse.json({ 
        error: `Invalid start chapter: ${startChapterNum}. Valid range is 1-${bookStructure.chapters.length}.`
      }, { status: 400 });
    }
    
    if (endChapterNum < startChapterNum || endChapterNum > bookStructure.chapters.length) {
      return NextResponse.json({ 
        error: `Invalid end chapter: ${endChapterNum}. Valid range is ${startChapterNum}-${bookStructure.chapters.length}.`
      }, { status: 400 });
    }
    
    // Step 4: Set up processing status - handle case where table might not exist yet
    console.log(`${logPrefix} Initializing processing status...`);
    
    // First, check if the table exists
    const tableCheckResult = await supabase.rpc('get_schema_definition', {
      p_schema: 'public',
      p_table: 'character_profile_processing'
    });
    
    const tableExists = tableCheckResult.data && tableCheckResult.data.length > 0;
    
    if (!tableExists) {
      console.log(`${logPrefix} Character profile processing table does not exist, creating...`);
      
      // Create the tracking table directly
      const createTableResult = await supabase.rpc('create_tracking_table');
      console.log(`${logPrefix} Table creation result:`, createTableResult);
      
      // If there's no rpc function, let the user know they need to run the SQL script
      if (createTableResult.error) {
        console.error(`${logPrefix} Error creating table:`, createTableResult.error);
        return NextResponse.json({
          error: 'The character_profile_processing table does not exist',
          message: 'Please run the SQL script in src/tools/character_profile_tracking_table.sql first',
          details: `Error: ${createTableResult.error.message || 'Unknown error'}`
        }, { status: 400 });
      }
    }
    
    // Check if there's an existing status
    const { data: existingStatus } = await supabase
      .from('character_profile_processing')
      .select('*')
      .eq('book_id', book_id)
      .single();
    
    const now = new Date().toISOString();
    
    let processingStatus: ProcessingStatus;
    
    if (existingStatus) {
      console.log(`${logPrefix} Found existing processing status, updating...`);
      
      // Update the existing status
      processingStatus = {
        ...existingStatus,
        status: 'in_progress',
        updated_at: now
      };
      
      const { error: updateError } = await supabase
        .from('character_profile_processing')
        .update({
          status: 'in_progress',
          updated_at: now
        })
        .eq('id', existingStatus.id);
      
      if (updateError) {
        console.error(`${logPrefix} Error updating processing status:`, updateError);
        return NextResponse.json({
          error: `Failed to update processing status: ${updateError.message}`,
          message: 'There was an error updating the processing status'
        }, { status: 500 });
      }
    } else {
      console.log(`${logPrefix} Creating new processing status...`);
      
      // Create a new status
      processingStatus = {
        book_id,
        status: 'in_progress',
        processed_chapters: [],
        total_chapters: bookStructure.chapters.length,
        error_chapters: [],
        started_at: now,
        updated_at: now
      };
      
      // Try to insert the record
      const { error: insertError } = await supabase
        .from('character_profile_processing')
        .insert(processingStatus);
      
      if (insertError) {
        console.error(`${logPrefix} Error creating processing status:`, insertError);
        return NextResponse.json({
          error: `Failed to create processing status: ${insertError.message}`,
          message: 'Please make sure the character_profile_processing table exists and has the correct schema'
        }, { status: 500 });
      }
    }
    
    // Step 5: Process chapters in sequence with rate limiting
    console.log(`${logPrefix} Will process chapters ${startChapterNum} to ${endChapterNum}`);
    
    // This endpoint only initializes processing and returns immediately
    // The actual processing will continue in the background
    
    // Start the background processing
    processChaptersSequentially(
      book_id, 
      bookTitle,
      bookStructure, 
      startChapterNum, 
      endChapterNum, 
      debug
    ).catch(error => {
      console.error(`${logPrefix} Background processing error:`, error);
    });
    
    // Return immediate response
    return NextResponse.json({
      success: true,
      message: `Started chapter-by-chapter processing for "${bookTitle}" (chapters ${startChapterNum}-${endChapterNum})`,
      book: {
        id: book.id,
        title: book.title,
      },
      processing: {
        status: 'initialized',
        start_chapter: startChapterNum,
        end_chapter: endChapterNum,
        total_chapters: endChapterNum - startChapterNum + 1
      },
      note: "Processing will continue in the background. Check the 'character_profile_processing' table for status updates."
    });
    
  } catch (error) {
    console.error(`${logPrefix} Error in character profile coordinator:`, error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

/**
 * Process chapters sequentially in the background
 */
async function processChaptersSequentially(
  bookId: string,
  bookTitle: string,
  bookStructure: BookStructure,
  startChapter: number,
  endChapter: number,
  debug: boolean
): Promise<void> {
  const logPrefix = `[Character-Coordinator-BG]`;
  console.log(`${logPrefix} Starting background processing of chapters ${startChapter} to ${endChapter}`);
  
  // Get existing processing status
  const { data: statusData, error: statusError } = await supabase
    .from('character_profile_processing')
    .select('*')
    .eq('book_id', bookId)
    .single();
  
  if (statusError || !statusData) {
    console.error(`${logPrefix} Error fetching processing status:`, statusError);
    return;
  }
  
  // Get already processed chapters to avoid reprocessing
  const processedChapters = new Set(statusData.processed_chapters || []);
  const errorChapters = statusData.error_chapters || [];
  
  // Process each chapter
  for (let chapterNum = startChapter; chapterNum <= endChapter; chapterNum++) {
    const chapterNumber = chapterNum.toString();
    
    // Skip already processed chapters unless we're in debug mode
    if (processedChapters.has(chapterNumber) && !debug) {
      console.log(`${logPrefix} Skipping already processed Chapter ${chapterNumber}`);
      continue;
    }
    
    console.log(`${logPrefix} Processing Chapter ${chapterNumber}...`);
    
    // Update status to indicate current chapter
    await supabase
      .from('character_profile_processing')
      .update({
        status: 'in_progress',
        current_chapter: chapterNumber,
        updated_at: new Date().toISOString()
      })
      .eq('book_id', bookId);
    
    try {
      // Call the chapter-by-chapter endpoint for this chapter
      const response = await fetch('/api/preprocessing/character-profiles/chapter-by-chapter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          book_id: bookId,
          chapter_number: chapterNumber,
          debug
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Chapter processing failed: ${errorData.error || response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`${logPrefix} Chapter ${chapterNumber} processed successfully with ${result.characters_processed} characters`);
      
      // Update processing status
      processedChapters.add(chapterNumber);
      
      await supabase
        .from('character_profile_processing')
        .update({
          processed_chapters: Array.from(processedChapters),
          updated_at: new Date().toISOString()
        })
        .eq('book_id', bookId);
      
    } catch (error) {
      console.error(`${logPrefix} Error processing Chapter ${chapterNumber}:`, error);
      
      // Add to error chapters
      errorChapters.push({
        chapter: chapterNumber,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Update error status
      await supabase
        .from('character_profile_processing')
        .update({
          error_chapters: errorChapters,
          updated_at: new Date().toISOString()
        })
        .eq('book_id', bookId);
    }
    
    // Wait before processing the next chapter (rate limiting)
    console.log(`${logPrefix} Waiting ${CHAPTER_PROCESSING_DELAY_MS}ms before processing next chapter...`);
    await sleep(CHAPTER_PROCESSING_DELAY_MS);
  }
  
  // Mark processing as completed
  console.log(`${logPrefix} Completed processing all requested chapters (${startChapter}-${endChapter})`);
  
  await supabase
    .from('character_profile_processing')
    .update({
      status: 'completed',
      current_chapter: null,
      updated_at: new Date().toISOString()
    })
    .eq('book_id', bookId);
  
  console.log(`${logPrefix} Final status update complete. Processing finished.`);
}