// src/app/api/v16/save-message/route.ts
/**
 * V16 API - Save Message Endpoint
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
    question_id?: number | string;
  };
  conversationId?: string;
}

export async function POST(req: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[v16_message_persistence]`;

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
        question_id: message.question_id,
        bookId: bookId,
        requestId: requestId,
        v16_endpoint: true, // Mark as V16 endpoint usage
        original_id: message.id // Store original string ID in metadata
      }
    };

    console.log(`${logPrefix} [CONTENT_DEBUG] About to insert - full content:`, messageData.content);
    console.log(`${logPrefix} [CONTENT_DEBUG] About to insert - content length:`, messageData.content.length);

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
      error: 'Failed to save message',
      details: errorMessage
    }, { status: 500 });
  }
}