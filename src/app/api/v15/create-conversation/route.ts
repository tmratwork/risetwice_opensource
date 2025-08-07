// src/app/api/v15/create-conversation/route.ts
/**
 * V15 API - Create Conversation Endpoint
 * 
 * Creates a new conversation entry in the database
 * This endpoint is called when starting a new chat session
 * Adapted from V11 implementation with V15's cleaner architecture
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface CreateConversationRequest {
  userId: string;
}

export async function POST(req: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[message_persistence]`;

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

    console.log(`${logPrefix} Successfully created conversation: ${newConversation.id}`);
    
    return NextResponse.json({
      success: true,
      conversationId: newConversation.id
    });
  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}