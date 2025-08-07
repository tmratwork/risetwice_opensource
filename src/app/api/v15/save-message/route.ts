// src/app/api/v15/save-message/route.ts
/**
 * V15 API - Save Message Endpoint
 * 
 * This endpoint saves user and AI messages to Supabase for conversation history
 * It operates asynchronously to avoid impacting the user experience
 * Adapted from V11 implementation with V15's cleaner architecture
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface SaveMessageRequest {
  userId: string;
  bookId: string;
  message: {
    id: string;
    role: string;
    text: string;
    timestamp: string;
    isFinal: boolean;
    question_id?: number | string;
  };
  conversationId?: string;
}

export async function POST(req: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[message_persistence]`;

  console.log(`${logPrefix} Received message save request (${requestId})`);

  try {
    // Parse request body
    const body: SaveMessageRequest = await req.json();
    const { userId, bookId, message, conversationId } = body;

    // Validate request
    if (!userId || !bookId || !message) {
      console.error(`${logPrefix} Missing required parameters`);
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    console.log(`${logPrefix} Saving message from ${message.role} with content length: ${message.text.length}`);
    console.log(`${logPrefix} [CONTENT_DEBUG] Message content preview:`, message.text.substring(0, 100) + (message.text.length > 100 ? '...' : ''));
    console.log(`${logPrefix} [CONTENT_DEBUG] Full message text:`, message.text);
    console.log(`${logPrefix} [CONTENT_DEBUG] Message text type:`, typeof message.text);
    console.log(`${logPrefix} [CONTENT_DEBUG] Message text character count:`, message.text.length);

    // Use provided conversation ID or create a new one
    let activeConversationId = conversationId;

    if (!activeConversationId) {
      try {
        console.log(`${logPrefix} No conversation ID provided, creating a new one for user: ${userId}`);
        
        // Create a new conversation - this is a fallback mechanism
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
          throw new Error(`Failed to create conversation: ${createError.message}`);
        }

        activeConversationId = newConversation.id;
        console.log(`${logPrefix} Created new conversation as fallback: ${activeConversationId}`);
      } catch (convError) {
        console.error(`${logPrefix} Conversation creation error:`, convError);
        return NextResponse.json({
          success: false,
          error: 'Failed to create conversation'
        }, { status: 500 });
      }
    }

    if (!activeConversationId) {
      console.error(`${logPrefix} No conversation ID available, cannot save message`);
      return NextResponse.json({
        success: false,
        error: 'No conversation ID available'
      }, { status: 400 });
    }

    // Prepare message data for insertion - use minimal schema like V11
    const messageData = {
      conversation_id: activeConversationId,
      role: message.role,
      content: message.text // V11 uses 'content' not 'text'
      // Let database handle timestamp automatically like V11
      // Skip question_id for now to avoid schema issues
    };

    console.log(`${logPrefix} Inserting message data:`, {
      conversation_id: messageData.conversation_id,
      role: messageData.role,
      content_length: message.text.length,
      hasQuestionId: !!message.question_id
    });
    console.log(`${logPrefix} [CONTENT_DEBUG] About to insert - content preview:`, messageData.content.substring(0, 100) + (messageData.content.length > 100 ? '...' : ''));
    console.log(`${logPrefix} [CONTENT_DEBUG] About to insert - full content:`, messageData.content);
    console.log(`${logPrefix} [CONTENT_DEBUG] About to insert - content length:`, messageData.content.length);

    // Insert message into database - match V11 pattern
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('messages')
      .insert(messageData)
      .select();

    if (insertError) {
      console.error(`${logPrefix} Error inserting message:`, insertError);
      return NextResponse.json({
        success: false,
        error: 'Failed to save message',
        details: insertError.message
      }, { status: 500 });
    }

    console.log(`${logPrefix} [CONTENT_DEBUG] Successfully inserted - checking returned data:`, insertData);
    if (insertData && insertData.length > 0) {
      const savedMessage = insertData[0];
      console.log(`${logPrefix} [CONTENT_DEBUG] Saved content preview:`, savedMessage.content?.substring(0, 100) + (savedMessage.content?.length > 100 ? '...' : ''));
      console.log(`${logPrefix} [CONTENT_DEBUG] Saved content length:`, savedMessage.content?.length || 0);
      console.log(`${logPrefix} [CONTENT_DEBUG] Original vs Saved length comparison:`, {
        original: message.text.length,
        saved: savedMessage.content?.length || 0,
        match: message.text.length === (savedMessage.content?.length || 0)
      });
    }

    console.log(`${logPrefix} Successfully saved message to conversation: ${activeConversationId}`);

    return NextResponse.json({
      success: true,
      conversationId: activeConversationId
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