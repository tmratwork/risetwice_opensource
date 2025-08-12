import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logV16MemoryServer } from '@/utils/server-logger';

/**
 * V16 SCHEDULED MEMORY PROCESSING CRON JOB
 * 
 * TESTING INSTRUCTIONS:
 * 
 * To test this cron job manually via HTTP endpoint:
 * 
 * 1. Development (localhost):
 *    curl -X GET "http://localhost:3000/api/v16/scheduled-memory-processing" \
 *         -H "User-Agent: vercel-cron/1.0"
 * 
 * 2. Production:
 *    curl -X GET "https://your-domain.com/api/v16/scheduled-memory-processing" \
 *         -H "User-Agent: vercel-cron/1.0"
 * 
 * 3. Check logs for processing results
 * 
 * NOTE: This endpoint uses the V16 memory job system for asynchronous processing
 * It creates memory jobs for users with unprocessed conversations
 */

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

interface ProcessingResult {
  userId: string;
  success: boolean;
  jobId?: string;
  jobCreated: boolean;
  error?: string;
}

/**
 * Creates a V16 memory processing job for a user
 * This is a direct function call equivalent to the /api/v16/memory-jobs/create endpoint
 */
async function createMemoryJobDirect(userId: string, supabase: SupabaseClient): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    // PRIVACY: Skip anonymous users - they chose not to be remembered
    if (userId.startsWith('anonymous-')) {
      console.log(`[v16-scheduled-memory] Skipping anonymous user: ${userId} (privacy protection)`);
      return { success: true, jobId: undefined }; // Return success but no job created
    }

    console.log(`[v16-scheduled-memory] Creating job for user: ${userId}`);

    // Get conversation statistics for progress tracking (past 7 days only)
    // Using RPC function to bypass RLS for scheduled system operations
    const { data: allConversations, error: allConversationsError } = await supabase
      .rpc('get_user_conversations_for_memory', { 
        target_user_id: userId, 
        days_limit: 7 
      });

    if (allConversationsError) {
      console.error(`[v16-scheduled-memory] Failed to fetch conversations for user ${userId}:`, allConversationsError.message);
      return { success: false, error: `Failed to fetch conversations: ${allConversationsError.message}` };
    }

    const totalConversations = allConversations?.length || 0;

    // Get already processed conversation IDs from v16_conversation_analyses table
    const { data: analysisRecords, error: analysisError } = await supabase
      .from('v16_conversation_analyses')
      .select('conversation_id')
      .eq('user_id', userId);

    if (analysisError) {
      console.error(`[v16-scheduled-memory] Failed to fetch processed conversations for user ${userId}:`, analysisError.message);
      return { success: false, error: `Failed to fetch processed conversations: ${analysisError.message}` };
    }

    // Build set of processed conversation IDs
    const processedConversationIds = new Set();
    if (analysisRecords) {
      analysisRecords.forEach(record => {
        processedConversationIds.add(record.conversation_id);
      });
    }

    // Filter out already processed conversations  
    const unprocessedConversations = allConversations.filter((conv: { id: string }) => !processedConversationIds.has(conv.id));
    const unprocessedCount = unprocessedConversations.length;

    console.log(`[v16-scheduled-memory] User ${userId}: ${totalConversations} conversations (past 7 days), ${processedConversationIds.size} processed, ${unprocessedCount} unprocessed`);

    // Skip users with no unprocessed conversations
    if (unprocessedCount === 0) {
      console.log(`[v16-scheduled-memory] User ${userId}: No unprocessed conversations, skipping job creation`);
      return { success: true, jobId: undefined };
    }

    // Create the job record
    const { data: job, error: jobError } = await supabase
      .from('v16_memory_jobs')
      .insert({
        user_id: userId,
        status: 'pending',
        job_type: 'memory_processing',
        batch_offset: 0,
        batch_size: 10,
        total_conversations: unprocessedCount,
        processed_conversations: 0,
        progress_percentage: 0
      })
      .select()
      .single();

    if (jobError) {
      console.error(`[v16-scheduled-memory] Failed to create job for user ${userId}:`, jobError.message);
      return { success: false, error: `Failed to create job: ${jobError.message}` };
    }

    console.log(`[v16-scheduled-memory] Successfully created job ${job.id} for user ${userId} with ${unprocessedCount} conversations to process`);

    // Trigger background processing (fire-and-forget)
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.API_BASE_URL
      : 'http://localhost:3000';
      
    if (!baseUrl) {
      throw new Error('API_BASE_URL environment variable is required in production');
    }
    
    const processUrl = `${baseUrl}/api/v16/memory-jobs/process`;
    
    console.log(`[v16-scheduled-memory] Triggering background processing for job ${job.id}`);
    
    fetch(processUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.id })
    }).catch(error => {
      console.error(`[v16-scheduled-memory] Failed to trigger background processing for job ${job.id}:`, error.message);
    });

    return { success: true, jobId: job.id as string };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[v16-scheduled-memory] Critical error creating job for user ${userId}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('[v16-scheduled-memory] Starting V16 daily memory processing job at', new Date().toISOString());

    logV16MemoryServer({
      level: 'INFO',
      category: 'SCHEDULED_PROCESSING',
      operation: 'cron-job-started',
      data: { timestamp: new Date().toISOString() }
    });

    // Verify this is a Vercel cron request
    const isVercelCron = request.headers.get('user-agent')?.includes('vercel-cron');
    
    if (!isVercelCron) {
      console.log('[v16-scheduled-memory] Unauthorized request - not from Vercel cron');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseClient();

    // Get users with conversations from past 7 days only (safety limit)
    // This prevents processing massive amounts of old conversations if cron fails for days
    // Using RPC function to bypass RLS for scheduled system operations
    const { data: activeUsers, error: queryError } = await supabase
      .rpc('get_active_users_for_memory_processing', { days_limit: 7 }) as { data: { human_id: string; conversation_count: number }[] | null, error: Error | null };

    if (queryError) {
      console.error('[v16-scheduled-memory] Error querying active users:', queryError);
      logV16MemoryServer({
        level: 'ERROR',
        category: 'SCHEDULED_PROCESSING',
        operation: 'fetch-users-failed',
        data: { error: queryError.message }
      });
      return NextResponse.json({ 
        error: 'Database query failed',
        details: queryError.message 
      }, { status: 500 });
    }

    if (!activeUsers || activeUsers.length === 0) {
      console.log('[v16-scheduled-memory] No users with conversations found in past 7 days');
      return NextResponse.json({ 
        success: true,
        message: 'No users with conversations found in past 7 days',
        usersProcessed: 0,
        jobsCreated: 0,
        processingTime: Date.now() - startTime,
        timeWindow: 'past 7 days'
      });
    }

    // Get unique user IDs and filter out anonymous users
    const humanIds = activeUsers.map((u: { human_id: string }) => u.human_id);
    const allUserIds: string[] = [...new Set(humanIds)];
    
    // PRIVACY: Filter out anonymous users (they chose not to be remembered)
    const uniqueUserIds = allUserIds.filter(userId => !userId.startsWith('anonymous-'));
    const anonymousCount = allUserIds.length - uniqueUserIds.length;
    
    console.log(`[v16-scheduled-memory] Found ${allUserIds.length} total users (${uniqueUserIds.length} registered, ${anonymousCount} anonymous) in past 7 days`);
    console.log(`[v16-scheduled-memory] Processing only registered users - anonymous users excluded for privacy`);

    const results: ProcessingResult[] = [];
    let jobsCreated = 0;

    // Process each user directly (create memory jobs)
    for (const userId of uniqueUserIds) {
      try {
        console.log(`[v16-scheduled-memory] Processing user: ${userId}`);

        // Create memory job for this user
        const result = await createMemoryJobDirect(userId, supabase);
        
        if (result.success) {
          const jobCreated = result.jobId !== undefined;
          results.push({
            userId,
            success: true,
            jobId: result.jobId,
            jobCreated,
          });
          
          if (jobCreated) {
            jobsCreated++;
            console.log(`[v16-scheduled-memory] Successfully created job ${result.jobId} for user: ${userId}`);
          } else {
            console.log(`[v16-scheduled-memory] User ${userId} has no unprocessed conversations, skipped job creation`);
          }
        } else {
          results.push({
            userId,
            success: false,
            jobId: undefined,
            jobCreated: false,
            error: result.error || 'Unknown job creation error',
          });
          console.error(`[v16-scheduled-memory] Failed to create job for user ${userId}:`, result.error);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          userId,
          success: false,
          jobId: undefined,
          jobCreated: false,
          error: errorMessage,
        });
        console.error(`[v16-scheduled-memory] Error processing user ${userId}:`, errorMessage);
      }

      // Small delay between users to prevent overload
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const processingTime = Date.now() - startTime;

    console.log(`[v16-scheduled-memory] V16 daily processing complete: ${successCount} users successful, ${failureCount} users failed, ${jobsCreated} jobs created in ${processingTime}ms`);

    logV16MemoryServer({
      level: 'INFO',
      category: 'SCHEDULED_PROCESSING',
      operation: 'cron-job-completed',
      data: {
        uniqueUsersFound: uniqueUserIds.length,
        usersProcessed: successCount,
        usersFailed: failureCount,
        jobsCreated,
        processingTime,
        results: results.slice(0, 10) // Log first 10 results
      }
    });

    return NextResponse.json({
      success: true,
      summary: {
        uniqueUsersFound: uniqueUserIds.length,
        usersProcessed: successCount,
        usersFailed: failureCount,
        jobsCreated,
        processingTime,
        timeWindow: 'past 7 days',
        system: 'V16 asynchronous job system',
      },
      results,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const processingTime = Date.now() - startTime;
    
    console.error('[v16-scheduled-memory] V16 daily processing job failed:', errorMessage);
    
    logV16MemoryServer({
      level: 'ERROR',
      category: 'SCHEDULED_PROCESSING',
      operation: 'cron-job-failed',
      data: { 
        error: errorMessage,
        processingTime
      }
    });
    
    return NextResponse.json({ 
      error: 'V16 scheduled memory processing failed',
      details: errorMessage,
      processingTime,
    }, { status: 500 });
  }
}

// Only allow GET requests for this endpoint
export async function POST() {
  return NextResponse.json({ 
    error: 'Method not allowed. This endpoint only accepts GET requests from cron jobs.' 
  }, { status: 405 });
}