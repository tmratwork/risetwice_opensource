// src/app/api/bookmarks/route.ts
/**
 * Bookmarks API - Save and retrieve user bookmarks
 * 
 * POST: Save a new bookmark with user note and AI message content
 * GET: Retrieve user's bookmarks
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface SaveBookmarkRequest {
  userId: string;
  conversationId: string | null;
  aiMessageContent: string;
  userNote: string;
}

export async function POST(req: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[BOOKMARK-SAVE-${requestId}]`;

  console.log(`${logPrefix} Received bookmark save request`);

  try {
    // Parse request body
    const body: SaveBookmarkRequest = await req.json();
    const { userId, conversationId, aiMessageContent, userNote } = body;

    // Validate request
    if (!userId || !aiMessageContent || !userNote.trim()) {
      console.error(`${logPrefix} Missing required parameters`);
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    console.log(`${logPrefix} Saving bookmark for user ${userId} with note length: ${userNote.length}`);

    // Save the bookmark
    const { error: bookmarkError } = await supabase
      .from('bookmarks')
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        ai_message_content: aiMessageContent,
        user_note: userNote.trim()
      });

    if (bookmarkError) {
      console.error(`${logPrefix} Error saving bookmark:`, {
        error: bookmarkError,
        code: bookmarkError.code,
        message: bookmarkError.message,
        details: bookmarkError.details || 'No additional details'
      });

      throw new Error(`Failed to save bookmark: ${bookmarkError.message}`);
    }

    console.log(`${logPrefix} Bookmark saved successfully`);
    
    return NextResponse.json({
      success: true,
      message: 'Bookmark saved successfully'
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

export async function GET(req: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[BOOKMARK-GET-${requestId}]`;

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      console.error(`${logPrefix} Missing userId parameter`);
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    console.log(`${logPrefix} Fetching bookmarks for user ${userId}`);

    // Get user's bookmarks ordered by most recent first
    const { data: bookmarks, error: fetchError } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error(`${logPrefix} Error fetching bookmarks:`, fetchError);
      throw new Error(`Failed to fetch bookmarks: ${fetchError.message}`);
    }

    console.log(`${logPrefix} Retrieved ${bookmarks?.length || 0} bookmarks`);

    return NextResponse.json({
      success: true,
      bookmarks: bookmarks || []
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