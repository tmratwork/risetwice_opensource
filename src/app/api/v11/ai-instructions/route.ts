import { fetchUserAIInstructions, fetchBookAIInstructions } from '@/lib/prompts';
import { NextResponse } from 'next/server';
import { generateBookInstructions } from '@/app/chatbotV11/prompts';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Define the type for the debug storage object to match the one in lib/prompts.ts
interface PromptDebugStorage {
  promptType: string;
  [key: string]: string | number | boolean | object | null | undefined;
}

/**
 * Helper function to check if a book ID is one of the special sleep books
 * @param bookId The book ID to check
 * @returns True if it's a sleep book, false otherwise
 */
function isSleepBook(bookId: string): boolean {
  const sleepBooks = ['325f8e1a-c9f9-4fbd-a6e4-5b04fb3c9a0a', '486fbb7e-19ec-474e-8296-60ff1d82580d'];
  return sleepBooks.includes(bookId);
}

/**
 * API endpoint to fetch custom AI instructions for a user
 * Returns default instructions if no custom ones are found
 */
export async function GET(req: Request) {
  try {
    // Get parameters from the request
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const isAnonymous = url.searchParams.get('anonymous') === 'true';
    const isGlobal = url.searchParams.get('global') === 'true';
    const bookId = url.searchParams.get('bookId');

    // If requesting global prompt specifically, skip user-specific logic
    if (isGlobal) {
      console.log('[API] Fetching global AI instructions');
    } else {
      // Require either a user ID or anonymous flag for non-global requests
      if (!userId && !isAnonymous) {
        return NextResponse.json(
          { error: 'Either userId or anonymous flag is required' },
          { status: 400 }
        );
      }
    }

    // NEW HIERARCHY: Check for sleep book-specific instructions first if bookId is a sleep book
    if (bookId && isSleepBook(bookId) && !isGlobal) {
      console.log(`[sleep-book] 🛌 Detected sleep book: ${bookId}`);
      console.log(`[sleep-book] 🔍 Fetching book-specific AI instructions (skipping user-specific)`);
      
      const bookInstructions = await fetchBookAIInstructions(bookId);
      if (bookInstructions) {
        console.log(`[sleep-book] ✅ Successfully retrieved book-specific AI instructions`);
        
        return NextResponse.json({
          success: true,
          promptContent: bookInstructions,
          source: 'book_specific'
        });
      } else {
        console.log(`[sleep-book] ❌ No book-specific AI instructions found, falling back to global`);
      }
    }
    // ORIGINAL HIERARCHY: For non-sleep books, check user-specific instructions first
    else if (userId && !isGlobal) {
      console.log(`[API DEBUG] Checking for user-specific AI instructions for userId: ${userId}`);
      
      // Get the custom AI instructions for this user
      const customInstructions = await fetchUserAIInstructions(userId);

      console.log(`[API DEBUG] fetchUserAIInstructions result:`, {
        found: !!customInstructions,
        content_length: customInstructions?.length || 0,
        content_preview: customInstructions ? customInstructions.substring(0, 100) + '...' : 'null'
      });

      // If we have custom instructions, return them with source information
      if (customInstructions) {
        // Get the source information from the global debug storage if available
        const debugStorage = typeof window !== 'undefined' ? 
          ((window as unknown) as Record<string, PromptDebugStorage>).__selectedPrompt : 
          ((typeof global !== 'undefined' ? (global as unknown) as Record<string, PromptDebugStorage> : {}).__selectedPrompt);
        
        const source = debugStorage?.promptType || 'custom';
        
        console.log(`[API] Using ${source} AI instructions for user ${userId}`);
        
        return NextResponse.json({
          success: true,
          promptContent: customInstructions,
          source: source
        });
      } else {
        console.log(`[API DEBUG] No user-specific AI instructions found for userId: ${userId}`);
      }
    }

    // For anonymous users, users with no custom instructions, or explicit global requests, check for global prompts
    if (isGlobal) {
      console.log('[API] Explicit global AI instructions request');
    } else {
      console.log(`[API] ${isAnonymous ? 'Anonymous user' : `No custom AI instructions found for user ${userId}`}, checking for global prompts`);
    }
    
    // Query for the most recent global AI instruction prompt version
    const { data: globalPrompts, error: globalError } = await supabase
      .from('prompt_versions')
      .select(`
        id,
        content,
        created_at,
        prompts!inner(
          id,
          category,
          is_global
        )
      `)
      .eq('prompts.category', 'ai_instructions')
      .eq('prompts.is_global', true)
      .order('created_at', { ascending: false })
      .limit(1);

    console.log('[API DEBUG] Global AI instructions query result:', {
      data: globalPrompts,
      error: globalError,
      count: globalPrompts?.length || 0
    });

    if (globalError) {
      console.error('[API] Error fetching global AI instructions:', globalError);
      return NextResponse.json({
        success: true,
        promptContent: generateBookInstructions('Default Book', 'Default Author'),
        source: 'default',
        error: 'Error fetching global prompts'
      });
    }

    // If we found a global prompt, return its content
    if (globalPrompts && globalPrompts.length > 0 && globalPrompts[0].content) {
      console.log('[API] Found global AI instructions');
      console.log('[API DEBUG] Returning global AI instructions:', {
        id: globalPrompts[0].id,
        created_at: globalPrompts[0].created_at,
        content_length: globalPrompts[0].content?.length || 0,
        content_preview: globalPrompts[0].content?.substring(0, 100) + '...'
      });
      return NextResponse.json({
        success: true,
        promptContent: globalPrompts[0].content as string,
        source: 'global'
      });
    }

    // Fallback to default instructions if no global prompts found
    console.log('[API] No global AI instructions found, using default');
    return NextResponse.json({
      success: true,
      promptContent: generateBookInstructions('Default Book', 'Default Author'),
      source: 'default'
    });

  } catch (error) {
    console.error('Error fetching AI instructions:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch AI instructions',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}