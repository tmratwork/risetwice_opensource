import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, conversationId } = body;

    if (process.env.ENABLE_RESUME_CONVERSATION_LOGS === 'true') {
      console.log(`[resume_conversation] 📡 API: resume-conversation request`, {
        userId,
        conversationId,
        timestamp: new Date().toISOString()
      });
    }

    if (!userId || !conversationId) {
      return NextResponse.json(
        { error: 'User ID and conversation ID are required' },
        { status: 400 }
      );
    }

    // Verify conversation belongs to user and get conversation details
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id, current_specialist, specialist_history, created_at, last_activity_at, is_active')
      .eq('id', conversationId)
      .eq('human_id', userId)
      .single();

    if (conversationError || !conversation) {
      if (process.env.ENABLE_RESUME_CONVERSATION_LOGS === 'true') {
        console.error('[resume_conversation] ❌ API: Conversation not found or access denied', {
          conversationId,
          userId,
          error: conversationError?.message
        });
      }
      return NextResponse.json(
        { error: 'Conversation not found or access denied' },
        { status: 404 }
      );
    }

    // Get conversation messages using RLS-compliant RPC function
    const { data: messages, error: messagesError } = await supabaseAdmin
      .rpc('get_conversation_messages_for_memory', {
        target_conversation_id: conversationId
      });

    if (process.env.NEXT_PUBLIC_ENABLE_SPECIALIST_TRACKING_LOGS === 'true') {
      console.log('[specialist_tracking] [SERVER] Messages retrieved', {
        messageCount: messages?.length || 0,
        sampleMessage: messages && messages[0] ? {
          id: messages[0].id,
          role: messages[0].role,
          routing_metadata: messages[0].routing_metadata
        } : null
      });
    }

    if (messagesError) {
      if (process.env.ENABLE_RESUME_CONVERSATION_LOGS === 'true') {
        console.error('[resume_conversation] ❌ API: Error fetching conversation messages', {
          conversationId,
          error: messagesError.message
        });
      }
      return NextResponse.json(
        { error: `Failed to fetch messages: ${messagesError.message}` },
        { status: 500 }
      );
    }

    // Determine which specialist to resume with (default to triage if none set)
    const resumeSpecialist = conversation.current_specialist || 'triage';

    // Update activity timestamp (ignore is_active since it's not maintained properly)
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        last_activity_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    if (updateError) {
      if (process.env.ENABLE_RESUME_CONVERSATION_LOGS === 'true') {
        console.error('[resume_conversation] ❌ API: Error updating conversation activity', {
          conversationId,
          error: updateError.message
        });
      }
      return NextResponse.json(
        { error: `Failed to update conversation: ${updateError.message}` },
        { status: 500 }
      );
    }

    if (process.env.ENABLE_RESUME_CONVERSATION_LOGS === 'true') {
      console.log(`[resume_conversation] ✅ API: Successfully prepared conversation resume`, {
        conversationId,
        resumeSpecialist,
        messageCount: messages?.length || 0,
        lastActivity: conversation.last_activity_at
      });
    }

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        currentSpecialist: resumeSpecialist,
        specialistHistory: conversation.specialist_history,
        createdAt: conversation.created_at,
        lastActivityAt: conversation.last_activity_at,
        messages: messages || []
      }
    });

  } catch (error) {
    if (process.env.ENABLE_RESUME_CONVERSATION_LOGS === 'true') {
      console.error('[resume_conversation] ❌ API: Unexpected error in resume-conversation', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });
    }
    void error;
    return NextResponse.json(
      { error: 'Internal server error resuming conversation' },
      { status: 500 }
    );
  }
}