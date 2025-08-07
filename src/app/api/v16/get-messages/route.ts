// src/app/api/v16/get-messages/route.ts
/**
 * V16 API - Get Messages Endpoint
 * 
 * Retrieves messages for a specific conversation using RLS-compliant RPC function
 * Updated to use get_conversation_messages_for_memory RPC function for security
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const logPrefix = `[v16_get_messages]`;
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const conversationId = searchParams.get('conversationId');
    
    if (!conversationId) {
      console.error(`${logPrefix} Missing conversationId parameter`);
      return NextResponse.json({ error: 'Missing conversationId parameter' }, { status: 400 });
    }

    console.log(`${logPrefix} Fetching messages for conversation: ${conversationId}`);

    // Use RPC function to get messages (bypasses RLS with SECURITY DEFINER)
    const { data: messages, error: messagesError } = await supabaseAdmin
      .rpc('get_conversation_messages_for_memory', {
        target_conversation_id: conversationId
      });

    if (messagesError) {
      console.error(`${logPrefix} Error fetching messages via RPC:`, messagesError);
      return NextResponse.json({ 
        success: false,
        error: 'Failed to fetch messages',
        details: messagesError.message 
      }, { status: 500 });
    }

    console.log(`${logPrefix} ✅ Successfully fetched ${messages?.length || 0} messages via RPC`);

    return NextResponse.json({ 
      success: true,
      messages: messages || [],
      count: messages?.length || 0
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${logPrefix} Get messages failed:`, errorMessage);
    
    return NextResponse.json({ 
      success: false,
      error: 'Failed to get messages',
      details: errorMessage
    }, { status: 500 });
  }
}