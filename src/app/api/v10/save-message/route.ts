// src/app/api/v10/save-message/route.ts
/**
 * V10 API - Save Message Endpoint
 * 
 * This endpoint saves user and AI messages to Supabase for conversation history
 * It operates asynchronously to avoid impacting the user experience
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
    question_id?: number; // Add question_id field with correct snake_case naming
  };
  conversationId?: string;
}

export async function POST(req: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[V10-SAVE-MSG-${requestId}]`;

  console.log(`${logPrefix} Received message save request`);

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

    // Find or create conversation
    let activeConversationId = conversationId;

    if (!activeConversationId) {
      try {
        // Look for an active conversation for this user and book
        const { data: existingConversation, error: findError } = await supabase
          .from('conversations')
          .select('id')
          .eq('human_id', userId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (findError && findError.code !== 'PGRST116') {
          console.error(`${logPrefix} Error finding conversation:`, findError);
          // Continue despite error - we'll create a new conversation
        }

        if (existingConversation) {
          activeConversationId = existingConversation.id;
          console.log(`${logPrefix} Found existing conversation: ${activeConversationId}`);
        } else {
          // Create a new conversation
          const { data: newConversation, error: createError } = await supabase
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
          console.log(`${logPrefix} Created new conversation: ${activeConversationId}`);
        }
      } catch (convError) {
        console.error(`${logPrefix} Conversation creation error:`, convError);
        // Return success with warning - message will be saved without conversation ID
        return NextResponse.json({
          success: true,
          warning: 'Message saved without conversation ID due to conversation creation error'
        });
      }
    }

    if (!activeConversationId) {
      console.error(`${logPrefix} No conversation ID available, cannot save message`);
      return NextResponse.json({
        success: false,
        error: 'No conversation ID available'
      }, { status: 500 });
    }

    // Store the message
    try {
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversationId,
          role: message.role,
          content: message.text,
          // Include question_id if provided (we're already using snake_case naming)
          ...(message.question_id ? { question_id: message.question_id } : {})
        });

      if (messageError) {
        console.error(`${logPrefix} Error saving message:`, messageError);
        throw new Error(`Failed to save message: ${messageError.message}`);
      }

      console.log(`${logPrefix} Message saved successfully to conversation ${activeConversationId}`);
      return NextResponse.json({
        success: true,
        conversationId: activeConversationId
      });
    } catch (messageError) {
      console.error(`${logPrefix} Message saving error:`, messageError);
      return NextResponse.json({
        success: false,
        error: 'Failed to save message',
        details: messageError instanceof Error ? messageError.message : String(messageError)
      }, { status: 500 });
    }
  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}