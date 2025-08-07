import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/v16/community/comments/[commentId] - Get specific comment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = await params;

    const { data: comment, error } = await supabase
      .from('post_comments')
      .select('*')
      .eq('id', commentId)
      .eq('is_deleted', false)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Comment not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching comment:', error);
      return NextResponse.json(
        { error: 'Failed to fetch comment' },
        { status: 500 }
      );
    }

    return NextResponse.json(comment);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/v16/community/comments/[commentId] - Update comment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = await params;
    const body = await request.json();
    const { user_id, content } = body;

    // Verify the comment exists and belongs to the user
    const { data: existingComment, error: fetchError } = await supabase
      .from('post_comments')
      .select('user_id')
      .eq('id', commentId)
      .eq('is_deleted', false)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Comment not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch comment' },
        { status: 500 }
      );
    }

    if (existingComment.user_id !== user_id) {
      return NextResponse.json(
        { error: 'Unauthorized to edit this comment' },
        { status: 403 }
      );
    }

    // Update the comment
    const { data: updatedComment, error: updateError } = await supabase
      .from('post_comments')
      .update({
        content: content.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', commentId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating comment:', updateError);
      return NextResponse.json(
        { error: 'Failed to update comment' },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedComment);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/v16/community/comments/[commentId] - Delete comment (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const reason = searchParams.get('reason') || 'User deleted';

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    // Verify the comment exists and belongs to the user
    const { data: existingComment, error: fetchError } = await supabase
      .from('post_comments')
      .select('user_id, post_id')
      .eq('id', commentId)
      .eq('is_deleted', false)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Comment not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch comment' },
        { status: 500 }
      );
    }

    if (existingComment.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this comment' },
        { status: 403 }
      );
    }

    // Soft delete the comment
    const { error: deleteError } = await supabase
      .from('post_comments')
      .update({
        is_deleted: true,
        deleted_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', commentId);

    if (deleteError) {
      console.error('Error deleting comment:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete comment' },
        { status: 500 }
      );
    }

    // Update post comment count
    await supabase.rpc('decrement_post_comment_count', { 
      post_id_param: existingComment.post_id 
    });

    // Update user stats
    await supabase.rpc('decrement_user_comments_count', { 
      user_id_param: userId 
    });

    return NextResponse.json({ message: 'Comment deleted successfully' });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}