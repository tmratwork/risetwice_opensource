import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logV16MemoryServer } from '@/utils/server-logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);


// Helper function for debug logging
const logV16Memory = (message: string, ...args: unknown[]) => {
  const timestamp = new Date().toISOString();
  
  // Console log for server terminal
  console.log(`[v16_memory] ${timestamp} ${message}`, ...args);
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      logV16MemoryServer({
        level: 'ERROR',
        category: 'VALIDATION',
        operation: 'create-job-missing-user-id',
        data: {}
      });
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // PRIVACY: Handle anonymous users gracefully - mark their conversations as skipped
    if (userId.startsWith('anonymous-')) {
      logV16Memory(`Handling anonymous user: ${userId} - will mark conversations as skipped for privacy`);
      logV16MemoryServer({
        level: 'INFO',
        category: 'PRIVACY',
        operation: 'anonymous-user-handled-gracefully',
        userId,
        data: { reason: 'Anonymous users opted out of memory storage' }
      });
      
      // Get all conversations for this anonymous user
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('human_id', userId);
      
      if (conversations && conversations.length > 0) {
        // Mark all anonymous user conversations as skipped in v16_conversation_analyses
        const skippedRecords = conversations.map(conv => ({
          user_id: userId,
          conversation_id: conv.id,
          analysis_result: { skipped: true, reason: 'anonymous_user' },
          extracted_at: new Date().toISOString(),
          processing_status: 'skipped',
          skip_reason: 'anonymous_user'
        }));
        
        // Insert or update to mark as processed (but skipped)
        await supabase
          .from('v16_conversation_analyses')
          .upsert(skippedRecords, {
            onConflict: 'conversation_id',
            ignoreDuplicates: false
          });
        
        logV16Memory(`Marked ${conversations.length} conversations as skipped for anonymous user: ${userId}`);
      }
      
      // Return success with no job created (similar to when no unprocessed conversations exist)
      return NextResponse.json({
        success: true,
        job: {
          id: null,
          status: 'skipped',
          totalConversations: 0,
          processedConversations: 0,
          progressPercentage: 100,
          message: 'Anonymous user - conversations marked as skipped for privacy'
        }
      });
    }

    logV16Memory(`Creating memory processing job for user: ${userId}`);
    logV16MemoryServer({
      level: 'INFO',
      category: 'JOB_CREATION',
      operation: 'memory-job-creation-initiated',
      userId,
      data: { source: 'api-request' }
    });

    // Get conversation statistics for progress tracking
    const { data: allConversations, error: allConversationsError } = await supabase
      .from('conversations')
      .select('id, created_at')
      .eq('human_id', userId)
      .order('created_at', { ascending: false });

    if (allConversationsError) {
      logV16MemoryServer({
        level: 'ERROR',
        category: 'JOB_CREATION',
        operation: 'fetch-conversations-failed',
        userId,
        data: { error: allConversationsError.message }
      });
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
    }

    const totalConversations = allConversations?.length || 0;

    // Add small delay to ensure database consistency after recent job completions
    // This prevents race conditions where recently completed jobs haven't fully committed their analysis records
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get already processed conversation IDs from v16_conversation_analyses table
    logV16Memory(`[v16_memory] 🔍 STEP 1: FETCHING processed conversations from v16_conversation_analyses for user: ${userId}`);
    
    const { data: analysisRecords, error: analysisError } = await supabase
      .from('v16_conversation_analyses')
      .select('conversation_id')
      .eq('user_id', userId);

    if (analysisError) {
      logV16Memory(`[v16_memory] ❌ ERROR fetching conversation analyses:`, analysisError);
      return NextResponse.json({ error: 'Failed to fetch processed conversations' }, { status: 500 });
    }

    // Build set of processed conversation IDs
    const processedConversationIds = new Set();
    if (analysisRecords) {
      analysisRecords.forEach(record => {
        processedConversationIds.add(record.conversation_id);
      });
    }

    logV16Memory(`[v16_memory] 🔍 STEP 2: PROCESSED CONVERSATION ANALYSIS:`, {
      userId: userId,
      analysisRecordsFound: analysisRecords?.length || 0,
      totalProcessedConversationIds: processedConversationIds.size,
      allProcessedIds: Array.from(processedConversationIds)
    });

    // Filter out already processed conversations  
    logV16Memory(`[v16_memory] 🔍 STEP 3: FILTERING unprocessed conversations...`);
    
    const unprocessedConversations = allConversations.filter(conv => !processedConversationIds.has(conv.id));
    const unprocessedConversationIds = unprocessedConversations.map(conv => conv.id);
    const unprocessedCount = unprocessedConversationIds.length;

    logV16Memory(`[v16_memory] 🔍 STEP 4: UNPROCESSED COUNT CALCULATION BREAKDOWN:`, {
      userId: userId,
      totalConversationsFromDB: totalConversations,
      processedConversationIdsFound: processedConversationIds.size,
      calculatedUnprocessedCount: unprocessedCount,
      mathCheck: `${totalConversations} - ${processedConversationIds.size} = ${unprocessedCount}`,
      firstFew_AllConversations: allConversations.slice(0, 5).map(c => ({ id: c.id, created_at: c.created_at })),
      firstFew_ProcessedIds: Array.from(processedConversationIds).slice(0, 5),
      firstFew_UnprocessedIds: unprocessedConversationIds.slice(0, 5),
      lastFew_UnprocessedIds: unprocessedConversationIds.slice(-5),
      detailedBreakdown: {
        allConversationIds: allConversations.map(c => c.id).slice(0, 10),
        processedSet: Array.from(processedConversationIds),
        intersection: allConversations.slice(0, 10).map(c => ({
          id: c.id,
          isProcessed: processedConversationIds.has(c.id)
        }))
      }
    });

    // Create the job record
    const { data: job, error: jobError } = await supabase
      .from('v16_memory_jobs')
      .insert({
        user_id: userId,
        status: 'pending',
        job_type: 'memory_processing',
        batch_offset: 0, // Not used, but kept for database compatibility  
        batch_size: 10,
        total_conversations: unprocessedCount,
        processed_conversations: 0,
        progress_percentage: 0
      })
      .select()
      .single();

    if (jobError) {
      logV16MemoryServer({
        level: 'ERROR',
        category: 'JOB_CREATION',
        operation: 'create-job-failed',
        userId,
        data: { error: jobError.message }
      });
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
    }

    logV16Memory(`Successfully created job: ${job.id}`);
    logV16MemoryServer({
      level: 'INFO',
      category: 'JOB_CREATION',
      operation: 'memory-job-created',
      userId,
      data: { 
        jobId: job.id,
        totalConversations,
        unprocessedCount
      }
    });

    // Trigger background processing (fire-and-forget)
    // We don't await this to avoid blocking the response
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.API_BASE_URL
      : 'http://localhost:3000';
      
    if (!baseUrl) {
      throw new Error('API_BASE_URL environment variable is required in production');
    }
    
    const processUrl = `${baseUrl}/api/v16/memory-jobs/process`;
    
    logV16Memory(`Triggering background processing at: ${processUrl}`);
    
    fetch(processUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.id })
    }).catch(error => {
      logV16Memory(`❌ Failed to trigger background processing: ${error.message}`);
      logV16MemoryServer({
        level: 'ERROR',
        category: 'JOB_CREATION',
        operation: 'trigger-background-processing-failed',
        userId,
        data: { jobId: job.id, error: error.message, processUrl }
      });
    });

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        totalConversations: unprocessedCount,
        processedConversations: 0,
        progressPercentage: 0,
        createdAt: job.created_at
      }
    });

  } catch (error) {
    logV16Memory('❌ Critical error in create-job API:', error);
    logV16MemoryServer({
      level: 'ERROR',
      category: 'JOB_CREATION_ERROR',
      operation: 'create-job-critical-failure',
      userId: 'unknown',
      data: { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}