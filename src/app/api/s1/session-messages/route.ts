// src/app/api/s1/session-messages/route.ts

import { NextRequest, NextResponse } from 'next/server';
// No server imports needed for testing

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, role, content, emotional_tone } = body;

    if (!session_id || !role || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, role, content' },
        { status: 400 }
      );
    }

    console.log('[S1] Saving session message:', { session_id, role, content_length: content.length });

    // For now, mock message persistence since we're using mock sessions
    // TODO: Once authentication and real sessions are set up, save to database
    const mockMessage = {
      id: crypto.randomUUID(),
      session_id,
      role,
      content,
      emotional_tone,
      message_type: 'text',
      timestamp_in_session: '00:00:01',
      is_final: true,
      created_at: new Date().toISOString()
    };

    console.log('[S1] Mock session message created:', mockMessage.id);

    return NextResponse.json({ message: mockMessage }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/s1/session-messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}