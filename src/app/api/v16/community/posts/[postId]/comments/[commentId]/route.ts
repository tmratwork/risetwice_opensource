import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string; commentId: string }> }
) {
  try {
    const { postId, commentId } = await params;

    if (!postId || !commentId) {
      return NextResponse.json({ error: 'Post ID and Comment ID are required' }, { status: 400 });
    }

    // Fetch the post with circle information
    const { data: post, error: postError } = await supabase
      .from('community_posts')
      .select(`
        *,
        circles (
          id,
          name,
          display_name,
          description
        )
      `)
      .eq('id', postId)
      .single();

    if (postError) {
      console.error('Error fetching post:', postError);
      if (postError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 });
    }

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Fetch the specific comment
    const { data: comment, error: commentError } = await supabase
      .from('post_comments')
      .select('*')
      .eq('id', commentId)
      .eq('post_id', postId)
      .eq('is_deleted', false)
      .single();

    if (commentError) {
      console.error('Error fetching comment:', commentError);
      if (commentError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to fetch comment' }, { status: 500 });
    }

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Fetch all comments for the post (for "View all comments" feature)
    const { data: allComments, error: allCommentsError } = await supabase
      .from('post_comments')
      .select('*')
      .eq('post_id', postId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (allCommentsError) {
      console.error('Error fetching all comments:', allCommentsError);
      // Don't fail the request if all comments fail, just return empty array
    }

    // Comments already have display_name in the table, no transformation needed
    const transformedComment = comment;
    const transformedAllComments = allComments || [];

    // Add comment count to post
    const postWithCommentCount = {
      ...post,
      comment_count: transformedAllComments.length
    };

    return NextResponse.json({
      post: postWithCommentCount,
      comment: transformedComment,
      allComments: transformedAllComments
    });

  } catch (error) {
    console.error('Error in GET /api/v16/community/posts/[postId]/comments/[commentId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}