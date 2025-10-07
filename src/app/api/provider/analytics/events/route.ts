// src/app/api/provider/analytics/events/route.ts
// Track provider analytics events (contact clicks, card views, etc.)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST track an analytics event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider_user_id, anonymous_user_id, event_type, event_data, session_id } = body;

    if (!provider_user_id || !event_type) {
      return NextResponse.json(
        { error: 'Provider user ID and event type required' },
        { status: 400 }
      );
    }

    // Validate event type
    const validEventTypes = ['contact_click', 'ai_preview_start', 'card_view'];
    if (!validEventTypes.includes(event_type)) {
      return NextResponse.json(
        { error: `Invalid event type. Must be one of: ${validEventTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Insert event
    const { data: event, error: insertError } = await supabase
      .from('provider_analytics_events')
      .insert({
        provider_user_id,
        anonymous_user_id,
        event_type,
        event_data,
        session_id
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting analytics event:', insertError);
      return NextResponse.json(
        { error: 'Failed to track event' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      event
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
