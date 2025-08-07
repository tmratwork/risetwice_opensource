import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processUserMemoryDirect } from '../process-user-memory/route';

/**
 * TESTING INSTRUCTIONS:
 * 
 * To test this cron job manually via HTTP endpoint:
 * 
 * 1. Development (localhost):
 *    curl -X GET "http://localhost:3000/api/v15/scheduled-memory-processing" \
 *         -H "User-Agent: vercel-cron/1.0"
 * 
 * 2. Production:
 *    curl -X GET "https://your-domain.com/api/v15/scheduled-memory-processing" \
 *         -H "User-Agent: vercel-cron/1.0"
 * 
 * 3. Check logs for processing results
 * 
 * NOTE: This endpoint only processes users with conversations from the past 7 days
 * and uses direct function calls instead of HTTP requests for better reliability.
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
  conversationsProcessed: number;
  error?: string;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('[scheduled-memory] Starting daily memory processing job at', new Date().toISOString());

    // Verify this is a Vercel cron request
    const isVercelCron = request.headers.get('user-agent')?.includes('vercel-cron');
    
    if (!isVercelCron) {
      console.log('[scheduled-memory] Unauthorized request - not from Vercel cron');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseClient();

    // Get users with conversations from past 7 days (much simpler query)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: activeUsers, error: queryError } = await supabase
      .from('conversations')
      .select('human_id')
      .gte('created_at', sevenDaysAgo.toISOString())
      .not('human_id', 'is', null);

    if (queryError) {
      console.error('[scheduled-memory] Error querying active users:', queryError);
      return NextResponse.json({ 
        error: 'Database query failed',
        details: queryError.message 
      }, { status: 500 });
    }

    if (!activeUsers || activeUsers.length === 0) {
      console.log('[scheduled-memory] No active users found in past 7 days');
      return NextResponse.json({ 
        success: true,
        message: 'No active users found in past 7 days',
        usersProcessed: 0,
        totalConversationsProcessed: 0,
        processingTime: Date.now() - startTime
      });
    }

    // Get unique user IDs
    const uniqueUserIds = [...new Set(activeUsers.map(u => u.human_id))];
    console.log(`[scheduled-memory] Found ${uniqueUserIds.length} unique active users in past 7 days`);

    const results: ProcessingResult[] = [];
    let totalProcessed = 0;

    // Process each user directly (no HTTP requests)
    for (const userId of uniqueUserIds) {
      try {
        console.log(`[scheduled-memory] Processing user: ${userId}`);

        // Call the direct processing function (no HTTP, no auth issues)
        const result = await processUserMemoryDirect(userId);
        
        if (result.success) {
          results.push({
            userId,
            success: true,
            conversationsProcessed: result.conversationsProcessed || 0,
          });
          totalProcessed += result.conversationsProcessed || 0;
          console.log(`[scheduled-memory] Successfully processed ${result.conversationsProcessed || 0} conversations for user: ${userId}`);
        } else {
          results.push({
            userId,
            success: false,
            conversationsProcessed: 0,
            error: result.error || 'Unknown processing error',
          });
          console.error(`[scheduled-memory] Failed to process user ${userId}:`, result.error);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          userId,
          success: false,
          conversationsProcessed: 0,
          error: errorMessage,
        });
        console.error(`[scheduled-memory] Error processing user ${userId}:`, errorMessage);
      }

      // Small delay between users
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const processingTime = Date.now() - startTime;

    console.log(`[scheduled-memory] Daily processing complete: ${successCount} users successful, ${failureCount} users failed, ${totalProcessed} total conversations processed in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      summary: {
        activeUsersFound: uniqueUserIds.length,
        usersProcessed: successCount,
        usersFailed: failureCount,
        totalConversationsProcessed: totalProcessed,
        processingTime,
        timeWindow: 'past 7 days',
      },
      results,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const processingTime = Date.now() - startTime;
    
    console.error('[scheduled-memory] Daily processing job failed:', errorMessage);
    
    return NextResponse.json({ 
      error: 'Scheduled memory processing failed',
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