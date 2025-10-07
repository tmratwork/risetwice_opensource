// src/app/api/provider/opt-in/route.ts
// User opt-in/opt-out for provider messaging

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - User opts in or out of provider messaging
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, provider_user_id, opted_in, user_display_name, user_email } = body;

    if (!user_id || !provider_user_id || opted_in === undefined) {
      return NextResponse.json(
        { error: 'User ID, provider user ID, and opt-in status required' },
        { status: 400 }
      );
    }

    // If opting in, require name and email
    if (opted_in && (!user_display_name?.trim() || !user_email?.trim())) {
      return NextResponse.json(
        { error: 'Display name and email required when opting in' },
        { status: 400 }
      );
    }

    // Upsert opt-in preference
    const { error: upsertError } = await supabase
      .from('provider_messaging_opt_ins')
      .upsert({
        user_id,
        provider_user_id,
        opted_in,
        user_display_name: opted_in ? user_display_name.trim() : null,
        user_email: opted_in ? user_email.trim() : null,
        opted_in_at: opted_in ? new Date().toISOString() : null
      }, {
        onConflict: 'user_id,provider_user_id'
      });

    if (upsertError) {
      console.error('Error upserting opt-in preference:', upsertError);
      return NextResponse.json(
        { error: 'Failed to save opt-in preference' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      opted_in
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Check user's opt-in status for a provider
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const providerUserId = searchParams.get('provider_user_id');

    if (!userId || !providerUserId) {
      return NextResponse.json(
        { error: 'User ID and provider user ID required' },
        { status: 400 }
      );
    }

    const { data: optIn, error } = await supabase
      .from('provider_messaging_opt_ins')
      .select('opted_in, opted_in_at')
      .eq('user_id', userId)
      .eq('provider_user_id', providerUserId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching opt-in status:', error);
      return NextResponse.json(
        { error: 'Failed to fetch opt-in status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      opted_in: optIn?.opted_in || false,
      opted_in_at: optIn?.opted_in_at || null
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
