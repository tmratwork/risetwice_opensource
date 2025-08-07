// src/app/api/v15/process-user-memory/route.ts

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logMemoryRefreshServer } from '@/utils/server-logger';
import { PostgrestError } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface QualityConversation {
  id: string;
  created_at: string;
  total_messages: number;
  user_messages: number;
  user_content_length: number;
}

/**
 * Exportable function for direct calling (used by cron job)
 * Processes user memory without HTTP wrapper
 */
export async function processUserMemoryDirect(userId: string): Promise<{
  success: boolean;
  message?: string;
  conversationsProcessed?: number;
  error?: string;
}> {
  try {
    console.log(`[memory-direct] Processing user: ${userId}`);

    // Log start of processing
    logMemoryRefreshServer({
      level: 'INFO',
      category: 'MEMORY_PROCESSING',
      operation: 'direct-processing-started',
      userId,
      data: { source: 'cron-job' }
    });

    // Get conversations from past 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentConversations, error: conversationsError } = await supabase
      .rpc('get_quality_conversations', {
        p_user_id: userId,
        p_since_date: sevenDaysAgo.toISOString(),
        p_min_total_messages: 6,
        p_min_user_messages: 3,
        p_min_user_content_length: 200
      }) as { data: QualityConversation[] | null; error: PostgrestError | null };

    if (conversationsError) {
      console.error('[memory-direct] Error fetching conversations:', conversationsError);
      return {
        success: false,
        error: `Failed to fetch conversations: ${conversationsError.message}`,
      };
    }

    if (!recentConversations || recentConversations.length === 0) {
      return {
        success: true,
        message: 'No recent conversations found (past 7 days)',
        conversationsProcessed: 0,
      };
    }

    // Get already analyzed conversation IDs
    const { data: analyzedConversations, error: analyzedError } = await supabase
      .from('conversation_analyses')
      .select('conversation_id')
      .eq('user_id', userId);

    if (analyzedError) {
      console.error('[memory-direct] Error fetching analyzed conversations:', analyzedError);
      return {
        success: false,
        error: `Failed to check analyzed conversations: ${analyzedError.message}`,
      };
    }

    const processedIds = new Set(analyzedConversations?.map(p => p.conversation_id) || []);
    const unprocessedConversations = recentConversations.filter((conv: QualityConversation) => !processedIds.has(conv.id));

    // Log conversation analysis with quality filtering performance
    logMemoryRefreshServer({
      level: 'INFO',
      category: 'CONVERSATION_ANALYSIS',
      operation: 'conversations-analyzed',
      userId,
      data: {
        qualityConversations: recentConversations.length,
        alreadyProcessed: processedIds.size,
        unprocessedFound: unprocessedConversations.length,
        willProcess: Math.min(unprocessedConversations.length, 50),
        timeWindow: '7-days',
        optimizationNote: 'Quality filtering applied at database level'
      }
    });

    if (unprocessedConversations.length === 0) {
      logMemoryRefreshServer({
        level: 'INFO',
        category: 'PROCESSING_COMPLETE',
        operation: 'no-conversations-to-process',
        userId,
        data: { totalConversations: recentConversations.length }
      });

      return {
        success: true,
        message: 'All recent conversations already processed',
        conversationsProcessed: 0,
      };
    }

    // Process up to 50 conversations (limit for performance)
    const conversationsToProcess = unprocessedConversations.slice(0, 50);
    let processedCount = 0;

    for (const conversation of conversationsToProcess) {
      try {
        // Call analyze-conversation API directly
        const analysisResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/v15/analyze-conversation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationId: conversation.id,
            userId,
          }),
        });

        if (!analysisResponse.ok) {
          console.error(`[memory-direct] Analysis failed for conversation ${conversation.id}`);
          continue;
        }

        const analysisResult = await analysisResponse.json();
        if (!analysisResult.success || analysisResult.emptyConversation) {
          console.log(`[memory-direct] Skipping profile update for conversation ${conversation.id}`);
          if (analysisResult.success) processedCount++;
          continue;
        }

        // Call update-user-profile API directly
        const profileResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/v15/update-user-profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            analysisData: analysisResult.extractedData,
            analysisId: analysisResult.analysisId,
            conversationId: conversation.id,
          }),
        });

        if (profileResponse.ok) {
          const profileResult = await profileResponse.json();
          if (profileResult.success) {
            processedCount++;
            console.log(`[memory-direct] Successfully processed conversation ${conversation.id}`);
          }
        }
      } catch (error) {
        console.error(`[memory-direct] Error processing conversation ${conversation.id}:`, error);
        continue;
      }
    }

    // Log completion
    logMemoryRefreshServer({
      level: 'INFO',
      category: 'PROCESSING_COMPLETE',
      operation: 'direct-processing-completed',
      userId,
      data: {
        totalConversations: recentConversations.length,
        conversationsProcessed: processedCount,
        source: 'cron-job'
      }
    });

    return {
      success: true,
      message: `Processed ${processedCount} conversations`,
      conversationsProcessed: processedCount,
    };
  } catch (error) {
    console.error('[memory-direct] Error in processUserMemoryDirect:', error);
    
    // Log error
    logMemoryRefreshServer({
      level: 'ERROR',
      category: 'PROCESSING_ERROR',
      operation: 'direct-processing-failed',
      userId,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Helper function to process a single conversation
 */
async function processSingleConversation(
  conversationId: string,
  userId: string,
  overridePrompts: {
    analysisSystemPrompt?: string;
    analysisUserPrompt?: string;
    mergeSystemPrompt?: string;
    mergeUserPrompt?: string;
  } | undefined,
  req: Request
): Promise<NextResponse<{
  success: boolean;
  skipped?: boolean;
  error?: string;
  analysisId?: string;
  profileId?: string | null;
  profileVersion?: number | null;
  processedAt?: string;
  skippedProfileUpdate?: boolean;
}>> {
  try {
    // Check if conversation has already been analyzed (single source of truth)
    const { data: analysisCheck, error: analysisError } = await supabase
      .from('conversation_analyses')
      .select('id, analyzed_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (analysisError && analysisError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('[memory] Error checking conversation analysis:', analysisError);
      return NextResponse.json({
        success: false,
        error: `Failed to check if conversation was already analyzed: ${analysisError.message}`,
      }, { status: 500 });
    }

    if (analysisCheck) {
      console.log(`[memory] Conversation ${conversationId} already analyzed at: ${analysisCheck.analyzed_at}`);
      return NextResponse.json({
        success: true,
        skipped: true,
        processedAt: analysisCheck.analyzed_at,
      });
    }

    // Step 1: Analyze conversation
    console.log(`[memory] Step 1: Analyzing conversation ${conversationId}`);

    const analysisResponse = await fetch(`${req.url.replace('/process-user-memory', '/analyze-conversation')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId,
        userId,
        overrideAnalysisPrompts: overridePrompts ? {
          systemPrompt: overridePrompts.analysisSystemPrompt,
          userPrompt: overridePrompts.analysisUserPrompt,
        } : undefined,
      }),
    });

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error('[memory] ERROR: Conversation analysis failed:', errorText);
      return NextResponse.json({
        success: false,
        error: `Conversation analysis failed: ${errorText}`,
      }, { status: 500 });
    }

    const analysisResult = await analysisResponse.json();

    if (!analysisResult.success) {
      console.error('[memory] ERROR: Conversation analysis returned failure:', analysisResult);
      return NextResponse.json({
        success: false,
        error: `Conversation analysis failed: ${JSON.stringify(analysisResult)}`,
      }, { status: 500 });
    }

    console.log(`[memory] Analysis step completed for conversation: ${conversationId}`);
    console.log('[memory] Step 1 completed - Analysis ID:', analysisResult.analysisId);

    // Skip profile update for empty conversations
    if (analysisResult.emptyConversation) {
      console.log(`[memory] Skipping profile update for empty conversation: ${conversationId}`);
      return NextResponse.json({
        success: true,
        analysisId: analysisResult.analysisId,
        profileId: null,
        profileVersion: null,
        processedAt: new Date().toISOString(),
        skippedProfileUpdate: true,
      });
    }

    // Step 2: Update user profile with analysis data
    console.log(`[memory] Step 2: Updating user profile for user_id: ${userId}`);

    const profileUpdateResponse = await fetch(`${req.url.replace('/process-user-memory', '/update-user-profile')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        analysisData: analysisResult.extractedData,
        analysisId: analysisResult.analysisId,
        conversationId: conversationId, // CRITICAL: Pass conversationId for final storage
        overrideMergePrompts: overridePrompts ? {
          systemPrompt: overridePrompts.mergeSystemPrompt,
          userPrompt: overridePrompts.mergeUserPrompt,
        } : undefined,
      }),
    });

    if (!profileUpdateResponse.ok) {
      const errorText = await profileUpdateResponse.text();
      console.error('[memory] ERROR: Profile update failed:', errorText);
      return NextResponse.json({
        success: false,
        error: `Profile update failed: ${errorText}`,
      }, { status: 500 });
    }

    const profileResult = await profileUpdateResponse.json();

    if (!profileResult.success) {
      console.error('[memory] ERROR: Profile update returned failure:', profileResult);
      return NextResponse.json({
        success: false,
        error: `Profile update failed: ${JSON.stringify(profileResult)}`,
      }, { status: 500 });
    }

    console.log(`[memory] Profile merge step completed`);
    console.log('[memory] Step 2 completed - Profile ID:', profileResult.profileId, 'Version:', profileResult.profileVersion);

    console.log(`[memory] Memory processing completed successfully for user_id: ${userId}, conversation_id: ${conversationId}`);

    return NextResponse.json({
      success: true,
      analysisId: analysisResult.analysisId,
      profileId: profileResult.profileId,
      profileVersion: profileResult.profileVersion,
      processedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error(`[memory] Error in processSingleConversation for ${conversationId}:`, error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

interface ProcessUserMemoryRequest {
  userId: string;
  conversationId?: string;
  overridePrompts?: {
    analysisSystemPrompt?: string;
    analysisUserPrompt?: string;
    mergeSystemPrompt?: string;
    mergeUserPrompt?: string;
  };
}

/**
 * V15 Process User Memory Orchestration Endpoint
 * Orchestrates the complete memory processing workflow:
 * 1. Analyze conversation for important user information
 * 2. Update user profile with analyzed data
 */
export async function POST(req: Request) {
  try {
    console.log('[memory] Starting V15 user memory processing workflow');

    const body = await req.json() as ProcessUserMemoryRequest;
    const { userId, conversationId, overridePrompts } = body;

    console.log(`[memory] Starting memory processing for user_id: ${userId}`);

    // Log start of manual refresh
    logMemoryRefreshServer({
      level: 'INFO',
      category: 'MEMORY_PROCESSING',
      operation: 'manual-refresh-started',
      userId,
      conversationId,
      data: { 
        source: 'manual-refresh',
        singleConversation: !!conversationId
      }
    });

    if (!userId) {
      console.log('[memory] ERROR: Missing required parameter userId');
      
      logMemoryRefreshServer({
        level: 'ERROR',
        category: 'VALIDATION_ERROR',
        operation: 'missing-user-id',
        error: 'userId is required'
      });
      
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Check for system-level call (from cron job)
    const isSystemCall = req.headers.get('x-system-call') === 'true';
    if (isSystemCall && !conversationId) {
      // Use direct processing for system calls
      const result = await processUserMemoryDirect(userId);
      return NextResponse.json(result);
    }

    // If conversationId provided, process single conversation
    if (conversationId) {
      console.log(`[memory] Processing single conversation: ${conversationId}`);
      return await processSingleConversation(conversationId, userId, overridePrompts, req);
    }

    // If no conversationId provided, find and process unprocessed conversations
    console.log(`[memory] Finding unprocessed conversations for user: ${userId}`);

    // Apply 7-day window for consistency with cron job
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get conversations from past 7 days that meet quality requirements
    // Use SQL query to filter conversations with sufficient message count and user content
    const { data: allConversations, error: conversationsError } = await supabase
      .rpc('get_quality_conversations', {
        p_user_id: userId,
        p_since_date: sevenDaysAgo.toISOString(),
        p_min_total_messages: 6,
        p_min_user_messages: 3,
        p_min_user_content_length: 200
      }) as { data: QualityConversation[] | null; error: PostgrestError | null };

    if (conversationsError) {
      console.error('[memory] Error fetching conversations:', conversationsError);
      return NextResponse.json(
        { error: 'Failed to fetch conversations', details: conversationsError },
        { status: 500 }
      );
    }

    if (!allConversations || allConversations.length === 0) {
      console.log(`[memory] No conversations found for user: ${userId}`);
      return NextResponse.json({
        success: true,
        message: 'No conversations found to process',
        processedCount: 0,
        skippedCount: 0,
      });
    }

    // Get already analyzed conversation IDs (single source of truth)
    const { data: analyzedConversations, error: analyzedError } = await supabase
      .from('conversation_analyses')
      .select('conversation_id')
      .eq('user_id', userId);

    if (analyzedError) {
      console.error('[memory] Error fetching analyzed conversations:', analyzedError);
      return NextResponse.json(
        { error: 'Failed to check analyzed conversations', details: analyzedError },
        { status: 500 }
      );
    }

    const processedIds = new Set(analyzedConversations?.map(p => p.conversation_id) || []);
    const unprocessedConversations = allConversations.filter((conv: QualityConversation) => !processedIds.has(conv.id));

    console.log(`[memory] Found ${unprocessedConversations.length} unprocessed conversations out of ${allConversations.length} total`);
    console.log(`[memory] Already analyzed conversation IDs:`, Array.from(processedIds));
    console.log(`[memory] All conversation IDs:`, allConversations.map((c: QualityConversation) => c.id));

    // Log conversation analysis for manual refresh with quality filtering performance
    logMemoryRefreshServer({
      level: 'INFO',
      category: 'CONVERSATION_ANALYSIS',
      operation: 'conversations-analyzed',
      userId,
      data: {
        qualityConversations: allConversations.length,
        alreadyProcessed: processedIds.size,
        unprocessedFound: unprocessedConversations.length,
        willProcess: Math.min(unprocessedConversations.length, 50),
        timeWindow: '7-days',
        source: 'manual-refresh',
        optimizationNote: 'Quality filtering applied at database level'
      }
    });

    if (unprocessedConversations.length === 0) {
      console.log(`[memory] All conversations already processed for user: ${userId}`);
      
      logMemoryRefreshServer({
        level: 'INFO',
        category: 'PROCESSING_COMPLETE',
        operation: 'no-conversations-to-process',
        userId,
        data: { 
          totalConversations: allConversations.length,
          source: 'manual-refresh'
        }
      });
      
      return NextResponse.json({
        success: true,
        message: 'All conversations already processed',
        processedCount: 0,
        skippedCount: allConversations.length,
      });
    }

    // Process up to 50 conversations (limit for performance)
    const conversationsToProcess = unprocessedConversations.slice(0, 50);
    console.log(`[memory] Processing ${conversationsToProcess.length} of ${unprocessedConversations.length} unprocessed conversations:`, conversationsToProcess.map((c: QualityConversation) => c.id));

    // Process each unprocessed conversation
    const results = [];
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const conversation of conversationsToProcess) {
      try {
        console.log(`[memory] Processing conversation ${conversation.id}`);
        const response = await processSingleConversation(conversation.id, userId, overridePrompts, req);
        const result = await response.json();

        if (result.success) {
          if (result.skipped) {
            skippedCount++;
          } else {
            processedCount++;
          }
        } else {
          errorCount++;
        }

        results.push({
          conversationId: conversation.id,
          success: result.success,
          skipped: result.skipped || false,
          error: result.error || null,
        });
      } catch (error) {
        console.error(`[memory] Error processing conversation ${conversation.id}:`, error);
        errorCount++;
        results.push({
          conversationId: conversation.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log(`[memory] Batch processing completed. Processed: ${processedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);

    // Log completion of manual refresh
    logMemoryRefreshServer({
      level: 'INFO',
      category: 'PROCESSING_COMPLETE',
      operation: 'manual-refresh-completed',
      userId,
      data: {
        totalConversations: allConversations.length,
        unprocessedFound: unprocessedConversations.length,
        conversationsProcessed: processedCount,
        testProcessedCount: processedCount,
        testSkippedCount: skippedCount,
        testErrorCount: errorCount,
        source: 'manual-refresh'
      }
    });

    return NextResponse.json({
      success: true,
      message: `Processed ${conversationsToProcess.length} conversations`,
      totalConversations: allConversations.length,
      unprocessedFound: unprocessedConversations.length,
      conversationsProcessed: processedCount, // Add this for cron job compatibility
      testProcessedCount: processedCount,
      testSkippedCount: skippedCount,
      testErrorCount: errorCount,
      results,
      processedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[memory] ERROR in process-user-memory:', error instanceof Error ? error.message : String(error));
    
    // Log error in manual refresh
    logMemoryRefreshServer({
      level: 'ERROR',
      category: 'PROCESSING_ERROR',
      operation: 'manual-refresh-failed',
      error: error instanceof Error ? error.message : String(error)
    });
    
    return NextResponse.json(
      {
        error: 'Internal server error during memory processing',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check processing status of conversations
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const conversationId = url.searchParams.get('conversationId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    console.log(`[memory] Checking analysis status for user: ${userId}`);

    let query = supabase
      .from('conversation_analyses')
      .select('conversation_id, analyzed_at')
      .eq('user_id', userId)
      .order('analyzed_at', { ascending: false });

    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }

    const { data: analyzedConversations, error } = await query;

    if (error) {
      console.error('[memory] ERROR: Error fetching analyzed conversations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch analysis status', details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      userId,
      analyzedConversations: analyzedConversations || [],
      totalAnalyzed: analyzedConversations?.length || 0,
    });

  } catch (error) {
    console.error('[memory] ERROR checking analysis status:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        error: 'Internal server error checking analysis status',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}