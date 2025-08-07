/**
 * API Route: Start Usage Session
 * Creates a new usage session for authenticated or anonymous users
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface StartSessionRequest {
  userId: string | null;
  anonymousId: string | null;
  userAgent: string;
  referrer: string;
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
    const body: StartSessionRequest = await request.json();
    const { userId, anonymousId, userAgent, referrer, timestamp } = body;

    logUsageTracking('start-session API called', {
      userId: userId ? 'authenticated' : null,
      anonymousId: anonymousId ? 'present' : null,
      timestamp
    });

    // Validate that we have either userId or anonymousId
    if (!userId && !anonymousId) {
      return NextResponse.json(
        { error: 'Either userId or anonymousId is required' },
        { status: 400 }
      );
    }

    // Get client IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';

    // Create session record
    const { data: session, error } = await supabase
      .from('usage_sessions')
      .insert({
        user_id: userId,
        anonymous_id: anonymousId,
        session_start: timestamp,
        user_agent: userAgent,
        ip_address: ip,
        referrer: referrer || null,
        page_views: 0,
        metadata: {
          created_from: 'web_app',
          user_agent_parsed: userAgent
        }
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating session:', error);
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    logUsageTracking('Session created successfully', { sessionId: session.id });

    // Update or create user summary with FIXED upsert logic
    const summaryData = {
      user_id: userId,
      anonymous_id: anonymousId,
      first_visit: timestamp,
      last_visit: timestamp,
      total_sessions: 1,
      total_page_views: 0,
      total_time_spent_minutes: 0
    };

    logUsageTracking('Attempting user summary upsert', {
      hasUserId: !!userId,
      hasAnonymousId: !!anonymousId,
      onConflictColumn: userId ? 'user_id' : 'anonymous_id'
    });

    // FIX: Use proper column name, not conditional expression
    const conflictColumn = userId ? 'user_id' : 'anonymous_id';
    const { error: summaryError } = await supabase
      .from('user_usage_summary')
      .upsert(summaryData, {
        onConflict: conflictColumn,
        ignoreDuplicates: false
      });

    if (summaryError) {
      logUsageTracking('❌ User summary upsert FAILED', {
        error: summaryError.message,
        conflictColumn,
        summaryData
      });
      // Remove silent error handling - this should be visible
      return NextResponse.json(
        { error: 'Failed to update user summary', details: summaryError.message },
        { status: 500 }
      );
    }

    logUsageTracking('✅ User summary upserted successfully', { conflictColumn });

    return NextResponse.json({
      sessionId: session.id,
      success: true
    });

  } catch (error) {
    logUsageTracking('❌ Critical error in start-session API', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    console.error('Error in start-session:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}