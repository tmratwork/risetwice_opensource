// src/lib/prompts-v15.ts

import { supabase } from '@/lib/supabase';
import { fetchUserAIInstructions } from '@/lib/prompts';

/**
 * V15 Enhanced AI Instructions with User Profile Memory
 * Fetches AI instructions and enriches them with pre-generated user profile summaries for personalized conversations
 */

/**
 * Fetch user AI instructions summary from the database
 * @param userId The user ID to fetch AI summary for
 * @returns AI instructions summary string or null if not found
 */
async function fetchUserAISummary(userId: string): Promise<string | null> {
  try {
    console.log(`[memory] Loading AI instructions summary for user_id: ${userId}`);

    // Validate userId before making database call
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      console.log('[memory] Invalid userId provided:', { userId, type: typeof userId });
      return null;
    }

    const trimmedUserId = userId.trim();
    console.log('[memory] Making Supabase query for AI summary with userId:', trimmedUserId);

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('ai_instructions_summary, version, last_analyzed_timestamp, updated_at')
      .eq('user_id', trimmedUserId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        console.log('[memory] No user profile found for userId:', trimmedUserId);
        return null;
      }
      console.error('[memory] Supabase error fetching AI summary:', {
        error,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
        userId: trimmedUserId
      });
      return null;
    }

    if (!profile) {
      console.log('[memory] Profile query succeeded but returned null data for userId:', trimmedUserId);
      return null;
    }

    const aiSummary = profile.ai_instructions_summary;
    
    if (!aiSummary || typeof aiSummary !== 'string' || !aiSummary.trim()) {
      console.log('[memory] No AI instructions summary found for user:', trimmedUserId);
      return null;
    }

    console.log(`[memory] AI summary loaded: ${aiSummary}`);
    console.log('[memory] Successfully loaded AI instructions summary:', {
      userId: trimmedUserId,
      profileVersion: profile.version,
      lastUpdated: profile.updated_at,
      summaryLength: aiSummary.length
    });

    return aiSummary.trim();
  } catch (error) {
    console.error('[memory] Unexpected error in fetchUserAISummary:', {
      error,
      errorType: typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      userId
    });
    return null;
  }
}


/**
 * V15 Enhanced AI Instructions Fetcher
 * Combines standard AI instructions with user profile memory context
 * @param userId The user ID to fetch instructions for
 * @param isAnonymous Whether this is an anonymous user
 * @param bookId Optional book ID for book-specific instructions
 * @returns Enhanced AI instructions with user profile context
 */
export async function fetchV15AIInstructionsWithMemory(
  userId?: string,
  isAnonymous: boolean = false,
  bookId?: string
): Promise<{ instructions: string; source: string; hasMemory: boolean }> {
  console.log('[memory] Fetching V15 AI instructions with memory for:', { userId, isAnonymous, bookId });

  try {
    // First, get the base AI instructions using existing logic
    let baseInstructions: string;
    let instructionSource: string;

    if (userId && !isAnonymous) {
      console.log('[memory] Fetching user-specific base instructions');
      baseInstructions = await fetchUserAIInstructions(userId) || '';
      instructionSource = baseInstructions ? 'user_specific' : 'global';
    } else {
      instructionSource = 'global';
      baseInstructions = '';
    }

    // If no user-specific instructions found, get global instructions
    if (!baseInstructions) {
      console.log('[memory] Fetching global base instructions');
      
      const { data: globalPrompts, error } = await supabase
        .from('prompt_versions')
        .select(`
          content,
          prompts!inner(category, is_global)
        `)
        .eq('prompts.category', 'ai_instructions')
        .eq('prompts.is_global', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('[memory] Error fetching global instructions:', error);
        baseInstructions = getDefaultAIInstructions();
        instructionSource = 'default';
      } else if (globalPrompts && globalPrompts.length > 0) {
        baseInstructions = globalPrompts[0].content as string || getDefaultAIInstructions();
        instructionSource = 'global';
      } else {
        baseInstructions = getDefaultAIInstructions();
        instructionSource = 'default';
      }
    }

    console.log('[memory] Base instructions source:', instructionSource);
    console.log('[memory] Base instructions length:', baseInstructions.length);

    // For anonymous users, return base instructions without memory
    if (isAnonymous || !userId) {
      console.log('[memory] Anonymous user - returning base instructions without memory');
      return {
        instructions: baseInstructions,
        source: instructionSource,
        hasMemory: false,
      };
    }

    // Fetch user AI summary for memory context
    console.log('[memory] Attempting to fetch AI instructions summary for userId:', userId);
    const aiSummary = await fetchUserAISummary(userId);
    
    if (!aiSummary) {
      console.log('[memory] No AI instructions summary found - returning base instructions without memory context');
      return {
        instructions: baseInstructions,
        source: instructionSource,
        hasMemory: false,
      };
    }

    // Combine base instructions with AI summary
    const enhancedInstructions = `${baseInstructions}

IMPORTANT USER MEMORY CONTEXT:
The following information has been learned about this user from previous conversations. Use this context to provide more personalized and relevant support, but do not explicitly mention that you "remember" things unless directly relevant to the conversation.

${aiSummary}

Please use this context to:
1. Provide more personalized responses and suggestions
2. Avoid topics or approaches that have been problematic in the past
3. Build on previous progress and insights
4. Adapt your communication style to what works best for this user
5. Be sensitive to known triggers and emotional patterns

Remember: This context should inform your responses naturally without making the user feel like they're being monitored or analyzed.`;

    console.log('[memory] Enhanced instructions created with AI summary');
    console.log('[memory] Enhanced instructions length:', enhancedInstructions.length);
    console.log('[memory] AI summary length:', aiSummary.length);

    return {
      instructions: enhancedInstructions,
      source: `${instructionSource}_with_memory`,
      hasMemory: true,
    };

  } catch (error) {
    console.error('[memory] Error in fetchV15AIInstructionsWithMemory:', error);
    
    // Fallback to base instructions without memory
    const fallbackInstructions = getDefaultAIInstructions();
    return {
      instructions: fallbackInstructions,
      source: 'fallback',
      hasMemory: false,
    };
  }
}

function getDefaultAIInstructions(): string {
  return `You are a helpful AI companion for mental health support and educational assistance. 

You provide compassionate, evidence-based support while maintaining professional boundaries. You are not a replacement for professional mental health care, but you can offer:

1. Active listening and validation
2. Coping strategies and techniques
3. Educational information about mental health
4. Crisis resources when needed
5. Encouragement for seeking professional help when appropriate

Always prioritize user safety and well-being in your responses.`;
}