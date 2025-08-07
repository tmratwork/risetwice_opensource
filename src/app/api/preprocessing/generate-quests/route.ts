/**
 * API route for generating educational quests
 * Uses Claude to dynamically generate quests based on book content
 * and populates the book_quests table in Supabase
 * 
 * Request Parameters:
 * - bookId or book_id (required): The ID of the book to generate quests for
 * - userId (optional): User ID to fetch custom quest generation prompt
 * - preserveExisting (optional): If true, preserves existing quests
 * - chapter_by_chapter (optional): If true, generates quests by chapter
 * - start_chapter (optional): Starting chapter number for chapter-by-chapter generation
 * - end_chapter (optional): Ending chapter number for chapter-by-chapter generation
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateQuestsFromBook } from '@/services/quests';
import { updateQuestProgress, clearQuestProgress } from '@/lib/progress-tracker';

// Import the ErrorWithJsonContext interface
interface ErrorWithJsonContext extends Error {
  rawJson: string;
  jsonPreview: string;
}

// Ensure we don't use cached data
export const dynamic = 'force-dynamic';

// Define interface for the direct quest data structure
// interface Quest {
//   book_id: string;
//   chapter_number: number;
//   chapter_title: string;
//   quest_title: string;
//   introduction: string;
//   challenge: string;
//   reward: string;
//   starting_question: string;
//   ai_prompt: string;
// }

// Debug helper to inspect database tables
async function inspectPrimaryTables(requestId: string) {
  const logPrefix = `[generate_quest][${requestId}]`;
  
  if (process.env.DEBUG_PROMPT_SELECTION === 'true') {
    console.log(`${logPrefix} [DEBUG] Starting database inspection...`);
    
    try {
      // 1. Check if prompts table exists and its structure
      console.log(`${logPrefix} [DEBUG] Checking prompts table...`);
      const { error: promptsError } = await supabase
        .from('prompts')
        .select('count()')
        .limit(1);
        
      if (promptsError) {
        console.error(`${logPrefix} [DEBUG] Error accessing prompts table:`, promptsError);
      } else {
        console.log(`${logPrefix} [DEBUG] prompts table exists`);
        
        // Get column info from a sample row
        const { data: promptSample, error: sampleError } = await supabase
          .from('prompts')
          .select('*')
          .limit(1);
          
        if (!sampleError && promptSample && promptSample.length > 0) {
          console.log(`${logPrefix} [DEBUG] prompts table columns:`, Object.keys(promptSample[0]).join(', '));
        }
      }
      
      // 2. Check prompt_versions table
      console.log(`${logPrefix} [DEBUG] Checking prompt_versions table...`);
      const { error: versionsError } = await supabase
        .from('prompt_versions')
        .select('count()')
        .limit(1);
        
      if (versionsError) {
        console.error(`${logPrefix} [DEBUG] Error accessing prompt_versions table:`, versionsError);
      } else {
        console.log(`${logPrefix} [DEBUG] prompt_versions table exists`);
      }
      
      // 3. Check user_prompt_assignments table
      console.log(`${logPrefix} [DEBUG] Checking user_prompt_assignments table...`);
      const { error: assignmentsError } = await supabase
        .from('user_prompt_assignments')
        .select('count()')
        .limit(1);
        
      if (assignmentsError) {
        console.error(`${logPrefix} [DEBUG] Error accessing user_prompt_assignments table:`, assignmentsError);
      } else {
        console.log(`${logPrefix} [DEBUG] user_prompt_assignments table exists`);
      }
      
      console.log(`${logPrefix} [DEBUG] Database inspection complete`);
    } catch (error) {
      console.error(`${logPrefix} [DEBUG] Error during database inspection:`, error);
    }
  }
}

export async function POST(request: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[generate_quest][${requestId}]`;

  // Quest generation debug logging
  console.log("[generate_quest] ================================");
  console.log("[generate_quest] API endpoint /api/preprocessing/generate-quests hit");
  console.log("[generate_quest] ================================");
  
  // Run database inspection in debug mode
  await inspectPrimaryTables(requestId);
  
  console.log(`${logPrefix} Starting quest generation process`);

  // Define type for request body
  interface RequestBody {
    bookId?: string;
    book_id?: string;
    userId?: string;         // Optional user ID for custom prompts
    preserveExisting?: boolean;
    chapter_by_chapter?: boolean;
    start_chapter?: string;
    end_chapter?: string;
    [key: string]: unknown;  // Allow other properties
  }

  // Declare variables outside the try block so they're accessible in the catch block
  let body: RequestBody | undefined;
  let bookId: string | undefined;

  try {
    // Get the request body
    body = await request.json() as RequestBody;
    
    // At this point, we know body is defined since request.json() would throw if it failed
    // Support both bookId and book_id formats for backward compatibility
    bookId = body?.bookId || body?.book_id;
    
    // Get the optional userId for custom prompts
    const userId = body?.userId;
    
    // Get the preserveExisting flag (defaults to false if not provided)
    const preserveExisting = body?.preserveExisting === true;
    
    // Check if this is a chapter-by-chapter request
    const chapterByChapter = body?.chapter_by_chapter === true;
    
    // Parse chapter numbers if provided
    const startChapter = body?.start_chapter ? parseInt(body.start_chapter) : undefined;
    const endChapter = body?.end_chapter ? parseInt(body.end_chapter) : undefined;

    if (!bookId) {
      console.error(`${logPrefix} Missing book ID`);
      return NextResponse.json(
        { error: 'Book ID is required' },
        { status: 400 }
      );
    }
    
    console.log(`${logPrefix} preserveExisting flag is set to: ${preserveExisting}`);

    console.log(`${logPrefix} Processing quests for book ID: ${bookId}`);
    
    // Log if a userId is provided for custom prompt
    if (userId) {
      console.log(`${logPrefix} Using custom prompt for user ID: ${userId}`);
    } else {
      console.log(`${logPrefix} No user ID provided, using default prompt`);
    }
    
    // Debug mode detection
    const DEBUG_MODE = process.env.DEBUG_PROMPT_SELECTION === 'true';
    if (DEBUG_MODE) {
      console.log(`${logPrefix} [DEBUG] Debug mode is ENABLED (DEBUG_PROMPT_SELECTION=true)`);
      console.log(`${logPrefix} [DEBUG] Claude API calls will be skipped, and mock quests will be returned`);
      console.log(`${logPrefix} [DEBUG] Adding extra diagnostic information to logs`);
    } else {
      console.log(`${logPrefix} Debug mode is disabled. Set DEBUG_PROMPT_SELECTION=true in .env.development to enable.`);
    }

    // First, check if book exists
    const { data: bookData, error: bookError } = await supabase
      .from('books_v2')
      .select('title, author')
      .eq('id', bookId)
      .single();

    if (bookError) {
      console.error(`${logPrefix} Error fetching book:`, bookError);
      return NextResponse.json(
        { error: `Book not found or error: ${bookError.message}` },
        { status: 404 }
      );
    }

    console.log(`${logPrefix} Found book: "${bookData.title}" by ${bookData.author}`);

    let existingQuestsCount = 0;
    
    // Only delete existing quests if preserveExisting is false
    if (!preserveExisting) {
      // Clear existing quests for this book
      console.log(`${logPrefix} Clearing existing quests for book as requested`);
      const { error: deleteError } = await supabase
        .from('book_quests')
        .delete()
        .eq('book_id', bookId);

      if (deleteError) {
        console.error(`${logPrefix} Error deleting existing quests:`, deleteError);
        return NextResponse.json(
          { error: `Failed to clear existing quests: ${deleteError.message}` },
          { status: 500 }
        );
      }
    } else {
      // If we're preserving existing quests, count how many there are
      console.log(`${logPrefix} Preserving existing quests as requested`);
      const { data: existingQuests, error: countError } = await supabase
        .from('book_quests')
        .select('id')
        .eq('book_id', bookId);
        
      if (countError) {
        console.error(`${logPrefix} Error counting existing quests:`, countError);
      } else {
        existingQuestsCount = existingQuests?.length || 0;
        console.log(`${logPrefix} Found ${existingQuestsCount} existing quests that will be preserved`);
      }
    }

    // If this is a chapter-by-chapter request, we need to handle it differently
    if (chapterByChapter) {
      console.log(`${logPrefix} Chapter-by-chapter request detected for chapters ${startChapter} to ${endChapter}`);
      
      // This needs to be implemented. For now, we'll throw an error to indicate it's not working yet
      return NextResponse.json(
        { error: 'Chapter-by-chapter quest generation is currently not implemented in this version' },
        { status: 501 }
      );
    }
    
    console.log(`${logPrefix} Calling generateQuestsFromBook service to create quests with Claude`);
    
    // Use the generateQuestsFromBook service to dynamically generate quests
    // Initialize progress tracking
    updateQuestProgress(bookId, 0, 'Starting quest generation process');
    console.log(`${logPrefix} Starting generation process for book ${bookId}`);
    
    // Declare generatedQuests at this scope level so it's available throughout the function
    let generatedQuests;
    
    try {
      // Assign the result to our outer variable
      generatedQuests = await generateQuestsFromBook(bookId, userId);
      
      // Update progress to 100% when complete
      updateQuestProgress(bookId, 100, `Successfully generated ${generatedQuests.length} quests`);
      console.log(`${logPrefix} Successfully generated ${generatedQuests.length} quests with Claude`);
    } catch (error) {
      // Clear progress on error
      clearQuestProgress(bookId);
      throw error;
    }
    
    // Verify quests were generated successfully
    if (!generatedQuests || !Array.isArray(generatedQuests)) {
      clearQuestProgress(bookId);
      throw new Error("Failed to generate quests: No valid quests returned");
    }

    // Note: Quests are already stored by generateQuestsFromBook(), no need to insert again
    console.log(`${logPrefix} Quests were already stored during the generation process`);
    
    // Fetch the inserted quests to include in the response
    const { data: insertedData, error: fetchError } = await supabase
      .from('book_quests')
      .select()
      .eq('book_id', bookId);

    if (fetchError) {
      console.error(`${logPrefix} Error fetching stored quests:`, fetchError);
      return NextResponse.json(
        { error: `Failed to fetch stored quests: ${fetchError.message}` },
        { status: 500 }
      );
    }

    console.log(`${logPrefix} Successfully fetched ${insertedData.length} quests`);

    // Return success response
    const successMessage = preserveExisting
      ? `Successfully added ${insertedData.length} new quests to ${existingQuestsCount} existing quests for book: ${bookData.title}`
      : `Successfully generated ${insertedData.length} quests for book: ${bookData.title}`;
      
    return NextResponse.json({
      success: true,
      message: successMessage,
      processedCount: insertedData.length,
      totalQuestCount: insertedData.length + existingQuestsCount,
      existingQuestsCount: existingQuestsCount,
      bookTitle: bookData.title,
      quests: insertedData,
      preservedExisting: preserveExisting,
      customPromptUsed: !!userId,  // Flag to indicate if a custom prompt was used
      userId: userId || null,      // Include the userId in the response (or null if not provided)
      generated_with_claude: true  // Flag to indicate these were generated with Claude
    });

  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, error);
    
    // Store bookId in local variable to ensure it's accessible even if there was an error
    // getting it from the request body
    const errorBookId = bookId || (body?.bookId || body?.book_id) || "unknown";
    
    // Clear progress on unexpected error
    try {
      clearQuestProgress(errorBookId);
    } catch (clearError) {
      console.error(`${logPrefix} Error clearing progress:`, clearError);
      // Continue with error handling even if clearing progress fails
    }
    
    // Extract any additional JSON error context if available
    let jsonContext = '';
    if (error instanceof Error && (error as ErrorWithJsonContext).jsonPreview) {
      jsonContext = `\n\nJSON Preview: ${(error as ErrorWithJsonContext).jsonPreview}`;
    }
    
    return NextResponse.json(
      {
        error: 'Quest Generation Failed',
        details: error instanceof Error ? error.message : String(error),
        raw_error: String(error),
        json_context: jsonContext
      },
      { status: 500 }
    );
  }
}