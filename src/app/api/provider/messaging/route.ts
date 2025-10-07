// src/app/api/provider/messaging/route.ts
// Provider messaging API - send and receive messages with opted-in users

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET messages for a specific conversation thread
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerUserId = searchParams.get('provider_user_id');
    const userId = searchParams.get('user_id');

    if (!providerUserId || !userId) {
      return NextResponse.json(
        { error: 'Provider user ID and user ID required' },
        { status: 400 }
      );
    }

    // Check opt-in status
    const { data: optIn, error: optInError } = await supabase
      .from('provider_messaging_opt_ins')
      .select('opted_in')
      .eq('provider_user_id', providerUserId)
      .eq('user_id', userId)
      .maybeSingle();

    if (optInError) {
      console.error('Error checking opt-in status:', optInError);
      return NextResponse.json(
        { error: 'Failed to verify opt-in status' },
        { status: 500 }
      );
    }

    if (!optIn || !optIn.opted_in) {
      return NextResponse.json(
        { error: 'User has not opted in to messaging' },
        { status: 403 }
      );
    }

    // Get messages for this conversation thread
    const { data: messages, error: messagesError } = await supabase
      .from('provider_user_messages')
      .select('id, message_content, sent_by, read_at, created_at')
      .eq('provider_user_id', providerUserId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      messages: messages || []
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST send a message from provider to user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider_user_id, user_id, message_content } = body;

    if (!provider_user_id || !user_id || !message_content?.trim()) {
      return NextResponse.json(
        { error: 'Provider user ID, user ID, and message content required' },
        { status: 400 }
      );
    }

    // Check opt-in status
    const { data: optIn, error: optInError } = await supabase
      .from('provider_messaging_opt_ins')
      .select('opted_in')
      .eq('provider_user_id', provider_user_id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (optInError) {
      console.error('Error checking opt-in status:', optInError);
      return NextResponse.json(
        { error: 'Failed to verify opt-in status' },
        { status: 500 }
      );
    }

    if (!optIn || !optIn.opted_in) {
      return NextResponse.json(
        { error: 'User has not opted in to messaging' },
        { status: 403 }
      );
    }

    // Insert message
    const { data: message, error: insertError } = await supabase
      .from('provider_user_messages')
      .insert({
        provider_user_id,
        user_id,
        message_content: message_content.trim(),
        sent_by: 'provider'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting message:', insertError);
      return NextResponse.json(
        { error: 'Failed to send message' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: message
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
