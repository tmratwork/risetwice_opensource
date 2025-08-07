/**
 * API Route: Track Usage Event
 * Records individual events within a usage session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TrackEventRequest {
  sessionId: string;
  eventType: string;
  eventData?: Record<string, string | number | boolean | null>;
  pagePath?: string;
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
    const body: TrackEventRequest = await request.json();
    const { sessionId, eventType, eventData, pagePath, timestamp } = body;

    logUsageTracking('track-event API called', {
      sessionId,
      eventType,
      pagePath: pagePath || 'none',
      hasEventData: !!eventData
    });

    // Validate required fields
    if (!sessionId || !eventType) {
      return NextResponse.json(
        { error: 'sessionId and eventType are required' },
        { status: 400 }
      );
    }

    // Insert event record
    const { error } = await supabase
      .from('usage_events')
      .insert({
        session_id: sessionId,
        event_type: eventType,
        event_data: eventData || null,
        page_path: pagePath || null,
        timestamp: timestamp
      });

    if (error) {
      logUsageTracking('❌ Failed to create event', {
        sessionId,
        eventType,
        error: error.message
      });
      console.error('Error creating event:', error);
      return NextResponse.json(
        { error: 'Failed to create event', details: error.message },
        { status: 500 }
      );
    }

    logUsageTracking('✅ Event created successfully', {
      sessionId,
      eventType,
      pagePath
    });

    // If it's a page view, increment page_views counter on session
    if (eventType === 'page_view') {
      logUsageTracking('Updating session page view counter', {
        sessionId,
        pagePath
      });

      const { data: currentSession } = await supabase
        .from('usage_sessions')
        .select('page_views')
        .eq('id', sessionId)
        .single();

      if (currentSession) {
        const newPageViewCount = (currentSession.page_views || 0) + 1;
        const { error: updateError } = await supabase
          .from('usage_sessions')
          .update({ 
            page_views: newPageViewCount
          })
          .eq('id', sessionId);

        if (updateError) {
          logUsageTracking('❌ Failed to update session page views', {
            sessionId,
            error: updateError.message,
            currentCount: currentSession.page_views,
            newCount: newPageViewCount
          });
          console.error('Error updating session page views:', updateError);
          // Remove silent error handling
          return NextResponse.json(
            { error: 'Failed to update session page views', details: updateError.message },
            { status: 500 }
          );
        }

        logUsageTracking('✅ Session page view counter updated', {
          sessionId,
          pagePath,
          previousCount: currentSession.page_views,
          newCount: newPageViewCount
        });
      } else {
        logUsageTracking('⚠️ Session not found for page view update', {
          sessionId,
          pagePath
        });
      }
    }

    return NextResponse.json({
      success: true
    });

  } catch (error) {
    logUsageTracking('❌ Critical error in track-event API', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    console.error('Error in track-event:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}