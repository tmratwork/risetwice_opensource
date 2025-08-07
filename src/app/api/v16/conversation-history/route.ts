import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'User ID is required' },
      { status: 400 }
    );
  }

  try {
    // console.log('[CONVERSATION-HISTORY] Fetching conversation history for user:', userId);

    // Fetch recent 20 conversations with message count and first message
    const { data: conversations, error: conversationsError } = await supabase
      .from('conversations')
      .select(`
        id,
        created_at,
        last_activity_at,
        current_specialist,
        messages!inner (
          id,
          content,
          created_at,
          role,
          routing_metadata
        )
      `)
      .eq('human_id', userId)
      .order('last_activity_at', { ascending: false })
      .limit(20);

    if (conversationsError) {
    // console.error('[CONVERSATION-HISTORY] Database error:', conversationsError);
      throw conversationsError;
    }

    if (!conversations) {
    // console.log('[CONVERSATION-HISTORY] No conversations found for user:', userId);
      return NextResponse.json({
        success: true,
        conversations: []
      });
    }

    // Filter out conversations with only 1 message, then process to create summaries
    const conversationSummaries = conversations
      .filter(conv => (conv.messages || []).length > 1)
      .map(conv => {
        const messages = conv.messages || [];
        const sortedMessages = messages.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        // Find first user message for preview
        const firstUserMessage = sortedMessages.find(msg => msg.role === 'user');
        const firstMessagePreview = firstUserMessage 
          ? firstUserMessage.content.substring(0, 100) + (firstUserMessage.content.length > 100 ? '...' : '')
          : 'No messages';

        // Calculate conversation duration
        const createdAt = new Date(conv.created_at);
        const lastActivity = new Date(conv.last_activity_at);
        const durationMs = lastActivity.getTime() - createdAt.getTime();
        const durationMinutes = Math.max(1, Math.floor(durationMs / (1000 * 60)));

        return {
          id: conv.id,
          created_at: conv.created_at,
          last_activity_at: conv.last_activity_at,
          current_specialist: conv.current_specialist || 'triage',
          message_count: messages.length,
          first_message_preview: firstMessagePreview,
          duration_minutes: durationMinutes
        };
      });

    // console.log('[CONVERSATION-HISTORY] Successfully fetched', conversationSummaries.length, 'conversations');

    return NextResponse.json({
      success: true,
      conversations: conversationSummaries
    });

  } catch (error) {
    // console.error('[CONVERSATION-HISTORY] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch conversation history',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}