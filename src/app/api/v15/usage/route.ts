import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

interface ConversationUsage {
  conversation_id: string;
  user_id: string;
  first_message_date: string;
  message_count: number;
}

export async function GET() {
  try {
    // Get the date one week ago
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoISO = oneWeekAgo.toISOString();

    // Query messages directly and group by conversation_id
    const { data: messagesData, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('conversation_id, role, created_at, metadata')
      .gte('created_at', oneWeekAgoISO)
      .order('created_at', { ascending: false });

    if (messagesError) {
      console.error('Database error fetching messages:', messagesError);
      return NextResponse.json(
        { success: false, error: messagesError.message },
        { status: 500 }
      );
    }

    // Process the data to count user messages per conversation
    const conversationUsageMap = new Map<string, ConversationUsage>();

    if (messagesData) {
      messagesData.forEach((message) => {
        if (message.conversation_id && message.role === 'user') {
          const existing = conversationUsageMap.get(message.conversation_id);

          if (existing) {
            existing.message_count++;
            // Update first message date if this message is earlier
            if (new Date(message.created_at) < new Date(existing.first_message_date)) {
              existing.first_message_date = message.created_at;
            }
          } else {
            // Extract user_id from metadata if available
            const userId = message.metadata && typeof message.metadata === 'object' && 'user_id' in message.metadata
              ? (message.metadata as Record<string, unknown>).user_id as string
              : 'anonymous';

            conversationUsageMap.set(message.conversation_id, {
              conversation_id: message.conversation_id,
              user_id: userId,
              first_message_date: message.created_at,
              message_count: 1
            });
          }
        }
      });
    }

    // Get human_id from conversations table
    const conversationIds = Array.from(conversationUsageMap.keys());
    if (conversationIds.length > 0) {
      const { data: conversationsData, error: conversationsError } = await supabaseAdmin
        .from('conversations')
        .select('id, human_id')
        .in('id', conversationIds);

      if (!conversationsError && conversationsData) {
        conversationsData.forEach((conversation) => {
          const usage = conversationUsageMap.get(conversation.id);
          if (usage && conversation.human_id) {
            usage.user_id = conversation.human_id;
          }
        });
      }
    }

    // Convert map to array and sort by date (most recent first)
    const usageData = Array.from(conversationUsageMap.values())
      .sort((a, b) => new Date(b.first_message_date).getTime() - new Date(a.first_message_date).getTime());

    return NextResponse.json({
      success: true,
      data: usageData,
      summary: {
        total_conversations: usageData.length,
        total_user_messages: usageData.reduce((sum, conv) => sum + conv.message_count, 0),
        unique_users: new Set(usageData.map(conv => conv.user_id)).size
      }
    });
  } catch (error) {
    console.error('Error fetching usage data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch usage data'
      },
      { status: 500 }
    );
  }
}