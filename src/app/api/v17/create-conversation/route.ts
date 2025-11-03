// src/app/api/v17/create-conversation/route.ts
/**
 * V17 API - Create Conversation Endpoint
 *
 * Creates a new conversation record in the database for message persistence
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface CreateConversationRequest {
  userId: string;
}

export async function POST(req: Request) {
  const logPrefix = '[v17_create_conversation]';

  try {
    const body: CreateConversationRequest = await req.json();
    const { userId } = body;

    if (!userId) {
      console.error(`${logPrefix} Missing userId`);
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    console.log(`${logPrefix} Creating conversation for user: ${userId}`);

    // Create a new conversation in the database
    const { data: newConversation, error: createError } = await supabaseAdmin
      .from('conversations')
      .insert({
        human_id: userId,
        is_active: true
      })
      .select('id')
      .single();

    if (createError) {
      console.error(`${logPrefix} Failed to create conversation:`, createError);
      return NextResponse.json({
        error: 'Failed to create conversation',
        details: createError.message
      }, { status: 500 });
    }

    const conversationId = newConversation?.id;

    console.log(`${logPrefix} ✅ Conversation created successfully:`, {
      conversationId,
      userId
    });

    return NextResponse.json({
      success: true,
      conversationId
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${logPrefix} Create conversation failed:`, errorMessage);

    return NextResponse.json({
      error: 'Internal server error',
      details: errorMessage
    }, { status: 500 });
  }
}
