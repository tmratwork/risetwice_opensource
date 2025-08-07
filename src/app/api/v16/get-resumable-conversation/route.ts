import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // console.log(`[V16] 📡 API: get-resumable-conversation request`, {
    //   userId,
    //   timestamp: new Date().toISOString()
    // });

    // Get user's most recent conversation (regardless of active/inactive status) with messages
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select(`
        id, 
        created_at, 
        last_activity_at, 
        current_specialist, 
        specialist_history,
        is_active,
        messages (
          id,
          role,
          content,
          created_at,
          metadata,
          routing_metadata
        )
      `)
      .eq('human_id', userId)
      .order('last_activity_at', { ascending: false })
      .limit(1)
      .single();

    if (conversationError && conversationError.code !== 'PGRST116') {
    // console.error('[V16] ❌ API: Error fetching resumable conversation', {
    //     userId,
    //     error: conversationError.message,
    //     code: conversationError.code
    //   });
      return NextResponse.json(
        { error: `Failed to fetch conversation: ${conversationError.message}` },
        { status: 500 }
      );
    }

    // No resumable conversation found
    if (!conversation) {
    // console.log(`[V16] 📭 API: No resumable conversation found for user`, { userId });
      return NextResponse.json({
        success: true,
        hasResumableConversation: false,
        conversation: null
      });
    }

    // console.log(`[V16] ✅ API: Found most recent conversation`, {
    //   conversationId: conversation.id,
    //   lastActivity: conversation.last_activity_at,
    //   currentSpecialist: conversation.current_specialist,
    //   isActive: conversation.is_active,
    //   messageCount: conversation.messages?.length || 0,
    //   userId
    // });

    // console.log(`[V16] 🔍 API: Conversation messages check`, {
    //   hasMessages: !!conversation.messages,
    //   messageCount: conversation.messages?.length || 0,
    //   messagesType: typeof conversation.messages
    // });

    return NextResponse.json({
      success: true,
      hasResumableConversation: true,
      conversation: {
        id: conversation.id,
        createdAt: conversation.created_at,
        lastActivityAt: conversation.last_activity_at,
        currentSpecialist: conversation.current_specialist,
        specialistHistory: conversation.specialist_history,
        isActive: conversation.is_active,
        messages: conversation.messages || []
      }
    });

  } catch (error) {
    // console.error('[V16] ❌ API: Unexpected error in get-resumable-conversation', {
    //   error: (error as Error).message,
    //   stack: (error as Error).stack
    // });
    
    void error;
    return NextResponse.json(
      { error: 'Internal server error fetching resumable conversation' },
      { status: 500 }
    );
  }
}