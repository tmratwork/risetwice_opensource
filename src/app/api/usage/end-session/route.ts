/**
 * API Route: End Usage Session
 * Finalizes a usage session and updates summary statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface EndSessionRequest {
  sessionId: string;
  pageViews: number;
  sessionDuration: number; // milliseconds
  timestamp: string;
}

export async function POST(request: NextRequest) {
  // Helper function for logging
  const logUsageTracking = (message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_USAGE_TRACKING_LOGS === 'true') {
      console.log(`[usage_tracking] ${message}`, ...args);
    }
  };

  try {
    const body: EndSessionRequest = await request.json();
    const { sessionId, pageViews, sessionDuration, timestamp } = body;

    logUsageTracking('end-session API called', {
      sessionId,
      pageViews,
      sessionDuration: `${Math.round(sessionDuration / 1000)}s`,
      timestamp
    });

    // Validate required fields
    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const sessionDurationMinutes = Math.round(sessionDuration / 60000);

    logUsageTracking('Updating session end time', {
      sessionId,
      sessionDurationMinutes,
      pageViews
    });

    // Update session record
    const { data: session, error } = await supabase
      .from('usage_sessions')
      .update({
        session_end: timestamp,
        page_views: pageViews
      })
      .eq('id', sessionId)
      .select('user_id, anonymous_id')
      .single();

    if (error) {
      logUsageTracking('❌ Failed to update session end time', {
        sessionId,
        error: error.message
      });
      console.error('Error updating session:', error);
      return NextResponse.json(
        { error: 'Failed to update session', details: error.message },
        { status: 500 }
      );
    }

    logUsageTracking('✅ Session end time updated successfully', {
      sessionId,
      userId: session.user_id ? 'authenticated' : null,
      anonymousId: session.anonymous_id ? 'present' : null
    });

    // Update user summary statistics
    const { user_id, anonymous_id } = session;
    const whereClause = user_id ? { user_id } : { anonymous_id };
    const userType = user_id ? 'authenticated' : 'anonymous';

    logUsageTracking('Fetching current user summary for update', {
      userType,
      whereClause
    });

    // Get current summary to update totals
    const { data: currentSummary, error: summaryError } = await supabase
      .from('user_usage_summary')
      .select('total_sessions, total_page_views, total_time_spent_minutes')
      .match(whereClause)
      .single();

    if (summaryError) {
      logUsageTracking('❌ Failed to fetch user summary', {
        userType,
        error: summaryError.message,
        whereClause
      });
      console.error('Error fetching current summary:', summaryError);
      // Remove silent error handling - this should be visible
      return NextResponse.json(
        { error: 'Failed to fetch user summary', details: summaryError.message },
        { status: 500 }
      );
    }

    logUsageTracking('Current summary fetched, updating totals', {
      userType,
      currentTotals: {
        sessions: currentSummary.total_sessions,
        pageViews: currentSummary.total_page_views,
        timeMinutes: currentSummary.total_time_spent_minutes
      },
      incrementing: {
        sessions: 0, // Sessions already counted in start-session
        pageViews,
        timeMinutes: sessionDurationMinutes
      }
    });

    // Update summary with new totals (DON'T double-count sessions - already counted in start-session)
    const { error: updateError } = await supabase
      .from('user_usage_summary')
      .update({
        last_visit: timestamp,
        // DON'T increment total_sessions here - it's already counted in start-session API
        total_page_views: (currentSummary.total_page_views || 0) + pageViews,
        total_time_spent_minutes: (currentSummary.total_time_spent_minutes || 0) + sessionDurationMinutes,
        updated_at: timestamp
      })
      .match(whereClause);

    if (updateError) {
      logUsageTracking('❌ Failed to update user summary', {
        userType,
        error: updateError.message,
        whereClause
      });
      console.error('Error updating summary:', updateError);
      // Remove silent error handling - this should be visible
      return NextResponse.json(
        { error: 'Failed to update user summary', details: updateError.message },
        { status: 500 }
      );
    }

    logUsageTracking('✅ User summary updated successfully', {
      userType,
      newTotals: {
        sessions: currentSummary.total_sessions || 0, // Sessions unchanged - counted in start-session
        pageViews: (currentSummary.total_page_views || 0) + pageViews,
        timeMinutes: (currentSummary.total_time_spent_minutes || 0) + sessionDurationMinutes
      }
    });

    return NextResponse.json({
      success: true
    });

  } catch (error) {
    logUsageTracking('❌ Critical error in end-session API', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    console.error('Error in end-session:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}