import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const conversationId = searchParams.get('conversationId');

  if (!userId || !conversationId) {
    return NextResponse.json(
      { success: false, error: 'User ID and Conversation ID are required' },
      { status: 400 }
    );
  }

  try {
    // console.log('[CONVERSATION-DETAIL] Fetching conversation:', {
    //   userId,
    //   conversationId
    // });

    // First verify that this conversation belongs to the user
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select(`
        id,
        created_at,
        last_activity_at,
        current_specialist,
        human_id
      `)
      .eq('id', conversationId)
      .eq('human_id', userId)
      .single();

    if (conversationError) {
    // console.error('[CONVERSATION-DETAIL] Error fetching conversation:', conversationError);
      throw conversationError;
    }

    if (!conversation) {
    // console.log('[CONVERSATION-DETAIL] Conversation not found or access denied:', {
    //     conversationId,
    //     userId
    //   });
      return NextResponse.json(
        { success: false, error: 'Conversation not found or access denied' },
        { status: 404 }
      );
    }

    // Fetch all messages for this conversation using RLS-compliant RPC function
    const { data: messages, error: messagesError } = await supabaseAdmin
      .rpc('get_conversation_messages_for_memory', {
        target_conversation_id: conversationId
      });

    if (messagesError) {
    // console.error('[CONVERSATION-DETAIL] Error fetching messages:', messagesError);
      throw messagesError;
    }

    const conversationDetail = {
      id: conversation.id,
      created_at: conversation.created_at,
      last_activity_at: conversation.last_activity_at,
      current_specialist: conversation.current_specialist || 'triage',
      messages: messages || []
    };

    // console.log('[CONVERSATION-DETAIL] Successfully fetched conversation with', messages?.length || 0, 'messages');

    return NextResponse.json({
      success: true,
      conversation: conversationDetail
    });

  } catch (error) {
    // console.error('[CONVERSATION-DETAIL] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch conversation details',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}