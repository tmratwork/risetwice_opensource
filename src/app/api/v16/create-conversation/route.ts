// src/app/api/v16/create-conversation/route.ts
/**
 * V16 API - Create Conversation Endpoint
 * 
 * Creates a new conversation entry in the database for V16 sessions
 * Uses service role key to bypass RLS for legitimate conversation creation
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface CreateConversationRequest {
  userId: string;
}

export async function POST(req: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[v16_conversation]`;

  console.log(`${logPrefix} Received create conversation request (${requestId})`);

  try {
    // Parse request body
    const { userId }: CreateConversationRequest = await req.json();

    // Validate request
    if (!userId) {
      console.error(`${logPrefix} Missing userId parameter`);
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    console.log(`${logPrefix} Creating new conversation for user: ${userId}`);
    
    // Create a new conversation
    const { data: newConversation, error: createError } = await supabaseAdmin
      .from('conversations')
      .insert({
        human_id: userId,
        is_active: true
      })
      .select('id')
      .single();

    if (createError) {
      console.error(`${logPrefix} Error creating conversation:`, createError);
      return NextResponse.json({ 
        success: false,
        error: 'Failed to create conversation',
        details: createError.message 
      }, { status: 500 });
    }

    if (!newConversation?.id) {
      console.error(`${logPrefix} No conversation ID returned from database`);
      return NextResponse.json({ 
        success: false,
        error: 'No conversation ID returned' 
      }, { status: 500 });
    }

    console.log(`${logPrefix} ✅ Successfully created conversation: ${newConversation.id}`);

    return NextResponse.json({ 
      success: true,
      conversationId: newConversation.id,
      message: 'Conversation created successfully'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${logPrefix} Create conversation failed:`, errorMessage);
    
    return NextResponse.json({ 
      success: false,
      error: 'Failed to create conversation',
      details: errorMessage
    }, { status: 500 });
  }
}