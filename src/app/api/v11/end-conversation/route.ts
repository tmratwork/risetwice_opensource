// src/app/api/v11/end-conversation/route.ts
/**
 * V11 API - End Conversation Endpoint
 * 
 * This endpoint marks an active conversation as inactive
 * Called when a chat session ends to create separation between different chat interactions
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface EndConversationRequest {
  userId: string;
  conversationId?: string;
}

export async function POST(req: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[V11-END-CONV-${requestId}]`;

  console.log(`${logPrefix} Received end conversation request`);

  try {
    // Parse request body
    const body: EndConversationRequest = await req.json();
    const { userId, conversationId } = body;

    // Validate request
    if (!userId) {
      console.error(`${logPrefix} Missing userId parameter`);
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    console.log(`${logPrefix} Processing end conversation for user: ${userId}`);

    // First, verify the conversation exists and is active
    let verifyQuery = supabase
      .from('conversations')
      .select('id, is_active')
      .eq('human_id', userId);

    // If a specific conversationId is provided, use it for verification
    if (conversationId) {
      console.log(`${logPrefix} Targeting specific conversation: ${conversationId}`);
      verifyQuery = verifyQuery.eq('id', conversationId);
    } else {
      console.log(`${logPrefix} Targeting all active conversations for user`);
      verifyQuery = verifyQuery.eq('is_active', true);
    }

    // Execute verification query
    const { data: verifyData, error: verifyError } = await verifyQuery;

    if (verifyError) {
      console.error(`${logPrefix} Error verifying conversation(s):`, verifyError);
      return NextResponse.json({
        success: false,
        error: 'Failed to verify conversation(s)',
        details: verifyError.message
      }, { status: 500 });
    }

    console.log(`${logPrefix} Verification found ${verifyData?.length || 0} conversation(s)`);

    // Log details of each conversation
    if (verifyData && verifyData.length > 0) {
      verifyData.forEach(conv => {
        console.log(`${logPrefix} Found conversation: id=${conv.id}, is_active=${conv.is_active}`);
      });

      // Filter only active conversations
      const activeConversations = verifyData.filter(conv => conv.is_active);
      console.log(`${logPrefix} Found ${activeConversations.length} active conversation(s)`);

      if (activeConversations.length === 0) {
        console.log(`${logPrefix} No active conversations to update`);
        return NextResponse.json({
          success: true,
          conversationsEnded: 0,
          message: 'No active conversations found to update'
        });
      }
    } else {
      console.log(`${logPrefix} No conversations found matching criteria`);
      return NextResponse.json({
        success: true,
        conversationsEnded: 0,
        message: 'No conversations found matching criteria'
      });
    }

    // Define which conversation(s) to mark as inactive
    let query = supabase
      .from('conversations')
      .update({ is_active: false })
      .eq('human_id', userId)
      .eq('is_active', true);

    // If a specific conversationId is provided, use it
    if (conversationId) {
      query = query.eq('id', conversationId);
    }

    // Add debug logging for the query
    const queryDescription = conversationId
      ? `UPDATE conversations SET is_active = false WHERE human_id = '${userId}' AND is_active = true AND id = '${conversationId}'`
      : `UPDATE conversations SET is_active = false WHERE human_id = '${userId}' AND is_active = true`;

    console.log(`${logPrefix} Executing query: ${queryDescription}`);

    // Execute the update
    const { error, count } = await query;

    if (error) {
      console.error(`${logPrefix} Error ending conversation:`, error);
      return NextResponse.json({
        success: false,
        error: 'Failed to end conversation',
        details: error.message
      }, { status: 500 });
    }

    console.log(`${logPrefix} Successfully marked ${count || 0} conversation(s) as inactive`);

    return NextResponse.json({
      success: true,
      conversationsEnded: count || 0
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