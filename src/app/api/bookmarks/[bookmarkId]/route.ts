// src/app/api/bookmarks/[bookmarkId]/route.ts
/**
 * Individual Bookmark API - Delete a specific bookmark
 * 
 * DELETE: Delete a specific bookmark by ID
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface DeleteBookmarkRequest {
  userId: string;
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ bookmarkId: string }> }
) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[BOOKMARK-DELETE-${requestId}]`;

  try {
    const { bookmarkId } = await params;
    
    // Parse request body
    const body: DeleteBookmarkRequest = await req.json();
    const { userId } = body;

    // Validate request
    if (!userId || !bookmarkId) {
      console.error(`${logPrefix} Missing required parameters`);
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    console.log(`${logPrefix} Deleting bookmark ${bookmarkId} for user ${userId}`);

    // Verify the bookmark belongs to the user before deleting
    const { data: bookmark, error: fetchError } = await supabase
      .from('bookmarks')
      .select('id, user_id')
      .eq('id', bookmarkId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        // No rows returned - bookmark not found or doesn't belong to user
        console.error(`${logPrefix} Bookmark not found or access denied`);
        return NextResponse.json({ error: 'Bookmark not found or access denied' }, { status: 404 });
      }
      console.error(`${logPrefix} Error fetching bookmark:`, fetchError);
      throw new Error(`Failed to fetch bookmark: ${fetchError.message}`);
    }

    if (!bookmark) {
      console.error(`${logPrefix} Bookmark not found or doesn't belong to user`);
      return NextResponse.json({ error: 'Bookmark not found or access denied' }, { status: 404 });
    }

    // Delete the bookmark
    const { error: deleteError } = await supabase
      .from('bookmarks')
      .delete()
      .eq('id', bookmarkId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error(`${logPrefix} Error deleting bookmark:`, {
        error: deleteError,
        code: deleteError.code,
        message: deleteError.message,
        details: deleteError.details || 'No additional details'
      });

      throw new Error(`Failed to delete bookmark: ${deleteError.message}`);
    }

    console.log(`${logPrefix} Bookmark deleted successfully`);
    
    return NextResponse.json({
      success: true,
      message: 'Bookmark deleted successfully'
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