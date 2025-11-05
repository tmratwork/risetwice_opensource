// src/app/api/provider/intake-messages/route.ts
// Fetch conversation messages from database for provider intake view

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const intakeId = searchParams.get('intake_id');

    if (!intakeId) {
      return NextResponse.json(
        { success: false, error: 'Missing intake_id parameter' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get conversation_id from intake_sessions table
    const { data: intake, error: intakeError } = await supabase
      .from('intake_sessions')
      .select('conversation_id')
      .eq('id', intakeId)
      .single();

    if (intakeError || !intake || !intake.conversation_id) {
      return NextResponse.json({
        success: false,
        error: 'Intake not found or no conversation linked',
        status: 'not_found'
      });
    }

    const conversationId = intake.conversation_id;

    // 2. Fetch all messages for this conversation
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, role, content, created_at, metadata')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('[intake-messages] Error fetching messages:', messagesError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch messages',
        status: 'error'
      });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No messages found for this conversation',
        status: 'not_found'
      });
    }

    // 3. Format messages into a readable transcript
    const transcript = messages
      .map((msg) => {
        const speaker = msg.role === 'user' ? 'Patient' : 'AI';
        const timestamp = new Date(msg.created_at).toLocaleTimeString();
        return `[${timestamp}] ${speaker}: ${msg.content}`;
      })
      .join('\n\n');

    return NextResponse.json({
      success: true,
      transcript,
      messageCount: messages.length,
      conversationId,
      status: 'ready'
    });

  } catch (error) {
    console.error('[intake-messages] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        status: 'error'
      },
      { status: 500 }
    );
  }
}
