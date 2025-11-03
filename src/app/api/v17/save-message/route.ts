// src/app/api/v17/save-message/route.ts
/**
 * V17 API - Save Message Endpoint
 *
 * This endpoint saves user and AI messages to Supabase for conversation history
 * Uses service role key to bypass RLS for legitimate message operations
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
    specialist?: string;
  };
  conversationId?: string;
  specialist?: string;
}

export async function POST(req: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[v17_message_persistence]`;

  console.log(`${logPrefix} Received message save request (${requestId})`);

  try {
    // Parse request body
    const body: SaveMessageRequest = await req.json();
    const { userId, bookId, message, conversationId, specialist } = body;

    // Validate request
    if (!userId || !bookId || !message) {
      console.error(`${logPrefix} Missing required parameters`);
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    console.log(`${logPrefix} Saving message from ${message.role} with content length: ${message.text.length}`);
    console.log(`${logPrefix} Specialist: ${specialist || 'none'}`);

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
          console.error(`${logPrefix} Error creating fallback conversation:`, createError);
          return NextResponse.json({
            success: false,
            error: 'Failed to create conversation for message',
            details: createError.message
          }, { status: 500 });
        }

        activeConversationId = newConversation?.id;
        console.log(`${logPrefix} ✅ Created fallback conversation: ${activeConversationId}`);

      } catch (conversationError) {
        console.error(`${logPrefix} Failed to create fallback conversation:`, conversationError);
        return NextResponse.json({
          success: false,
          error: 'Failed to create conversation for message'
        }, { status: 500 });
      }
    }

    if (!activeConversationId) {
      console.error(`${logPrefix} No valid conversation ID available`);
      return NextResponse.json({
        success: false,
        error: 'No valid conversation ID'
      }, { status: 500 });
    }

    // Prepare message data for database insertion
    // Let database auto-generate UUID for id, store original ID in metadata
    const messageData = {
      conversation_id: activeConversationId,
      role: message.role,
      content: message.text,
      created_at: new Date(message.timestamp).toISOString(),
      metadata: {
        isFinal: message.isFinal,
        bookId: bookId,
        requestId: requestId,
        v17_endpoint: true, // Mark as V17 endpoint usage
        original_id: message.id, // Store original string ID in metadata
        specialist: specialist || message.specialist || 'ai_preview' // V17 specialist tracking
      }
    };

    console.log(`${logPrefix} About to insert message - content length: ${messageData.content.length}`);

    // Insert message into database
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('messages')
      .insert(messageData)
      .select();

    if (insertError) {
      console.error(`${logPrefix} Database insertion failed:`, insertError);
      return NextResponse.json({
        success: false,
        error: 'Failed to save message to database',
        details: insertError.message
      }, { status: 500 });
    }

    const savedMessage = insertData?.[0];
    const databaseMessageId = savedMessage?.id;

    console.log(`${logPrefix} ✅ Successfully saved message:`, {
      originalMessageId: message.id,
      databaseMessageId: databaseMessageId,
      conversationId: activeConversationId,
      role: message.role,
      contentLength: message.text.length,
      specialist: specialist || message.specialist,
      insertedRecords: insertData?.length || 0
    });

    return NextResponse.json({
      success: true,
      message: 'Message saved successfully',
      conversationId: activeConversationId,
      messageId: databaseMessageId,
      originalMessageId: message.id
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${logPrefix} Save message failed:`, errorMessage);

    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: errorMessage
    }, { status: 500 });
  }
}
