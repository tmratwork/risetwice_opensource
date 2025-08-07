import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/v16/community/comments - Get comments for a post
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('post_id');
    const parentId = searchParams.get('parent_id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    if (!postId) {
      return NextResponse.json(
        { error: 'Post ID required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('post_comments')
      .select('*')
      .eq('post_id', postId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(limit);

    // Filter by parent comment if specified
    if (parentId) {
      query = query.eq('parent_comment_id', parentId);
    } else {
      // Get top-level comments only
      query = query.is('parent_comment_id', null);
    }

    const { data: comments, error } = await query;

    if (error) {
      console.error('Error fetching comments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch comments' },
        { status: 500 }
      );
    }

    // For top-level comments, also fetch their immediate replies
    if (!parentId && comments) {
      const commentsWithReplies = await Promise.all(
        comments.map(async (comment) => {
          const { data: replies } = await supabase
            .from('post_comments')
            .select('*')
            .eq('post_id', postId)
            .eq('parent_comment_id', comment.id)
            .eq('is_deleted', false)
            .order('created_at', { ascending: true })
            .limit(5); // Limit initial replies shown

          return {
            ...comment,
            replies: replies || []
          };
        })
      );

      return NextResponse.json({
        comments: commentsWithReplies,
        total_count: commentsWithReplies.length
      });
    }

    return NextResponse.json({
      comments: comments || [],
      total_count: comments?.length || 0
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/v16/community/comments - Create a new comment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, post_id, parent_comment_id, content } = body;

    // Validate required fields
    if (!user_id || !post_id || !content?.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify the post exists
    const { error: postError } = await supabase
      .from('community_posts')
      .select('id')
      .eq('id', post_id)
      .eq('is_deleted', false)
      .single();

    if (postError) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // If this is a reply, verify the parent comment exists
    if (parent_comment_id) {
      const { data: parentComment, error: parentError } = await supabase
        .from('post_comments')
        .select('id, post_id')
        .eq('id', parent_comment_id)
        .eq('is_deleted', false)
        .single();

      if (parentError || parentComment.post_id !== post_id) {
        return NextResponse.json(
          { error: 'Parent comment not found' },
          { status: 404 }
        );
      }
    }

    // Get user's display name first
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('profile_data')
      .eq('user_id', user_id)
      .single();

    if (profileError || !userProfile?.profile_data?.display_name) {
      return NextResponse.json(
        { error: 'User must have a display name set before commenting' },
        { status: 400 }
      );
    }

    const displayName = userProfile.profile_data.display_name;

    // TODO: Add content moderation here
    // const moderationResult = await moderateContent(content, 'comment');

    // Create the comment
    const { data: comment, error } = await supabase
      .from('post_comments')
      .insert({
        user_id,
        post_id,
        parent_comment_id,
        display_name: displayName,
        content: content.trim()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating comment:', error);
      return NextResponse.json(
        { error: 'Failed to create comment' },
        { status: 500 }
      );
    }

    // Update post comment count
    await supabase.rpc('increment_post_comment_count', { 
      post_id_param: post_id 
    });

    // Update user stats
    await supabase.rpc('increment_user_comments_count', { 
      user_id_param: user_id 
    });

    return NextResponse.json(comment, { status: 201 });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}