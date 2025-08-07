import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/v16/community/posts/[postId] - Get specific post with comments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    console.log('Fetching post with ID:', postId);

    // Fetch the post with circle information using admin client
    const { data: post, error: postError } = await supabaseAdmin
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
      console.error('Post ID that failed:', postId);
      if (postError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Post not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch post' },
        { status: 500 }
      );
    }

    console.log('Found post:', post ? 'YES' : 'NO');
    if (post) {
      console.log('Post title:', post.title);
    }

    // Fetch comments for the post
    const { data: comments, error: commentsError } = await supabase
      .from('post_comments')
      .select('*')
      .eq('post_id', postId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (commentsError) {
      console.error('Error fetching comments:', commentsError);
      // Don't fail the request if comments fail, just return empty array
    }

    // Comments already have display_name in the table, no transformation needed
    const transformedComments = comments || [];

    // Add comment count to post
    const postWithComments = {
      ...post,
      comment_count: transformedComments.length,
      comments: transformedComments
    };

    // Increment view count
    await supabase
      .from('community_posts')
      .update({ view_count: (post.view_count || 0) + 1 })
      .eq('id', postId);

    return NextResponse.json(postWithComments);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/v16/community/posts/[postId] - Update post
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    console.log('PUT request - postId:', postId);
    
    const body = await request.json();
    console.log('PUT request body:', JSON.stringify(body, null, 2));
    console.log('PUT request body.tags:', body.tags);
    console.log('PUT request body.tags type:', typeof body.tags);
    console.log('PUT request body.tags isArray:', Array.isArray(body.tags));
    
    const { user_id, title, content, tags } = body;
    
    console.log('Extracted values:');
    console.log('  user_id:', user_id);
    console.log('  title:', title);
    console.log('  content:', content);
    console.log('  tags:', tags);

    // Verify the post exists and belongs to the user
    const { data: existingPost, error: fetchError } = await supabase
      .from('community_posts')
      .select('user_id')
      .eq('id', postId)
      .eq('is_deleted', false)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Post not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch post' },
        { status: 500 }
      );
    }

    if (existingPost.user_id !== user_id) {
      return NextResponse.json(
        { error: 'Unauthorized to edit this post' },
        { status: 403 }
      );
    }

    // Update the post
    const updateData: { title?: string; content?: string; tags?: string[] } = {};
    
    // Don't manually set updated_at - let the database handle it with DEFAULT NOW()

    if (title !== undefined) updateData.title = title.trim();
    if (content !== undefined) updateData.content = content.trim();
    if (tags !== undefined) {
      // Ensure tags is a proper array
      if (Array.isArray(tags)) {
        updateData.tags = tags;
      } else {
        console.error('Tags is not an array:', tags, typeof tags);
        return NextResponse.json(
          { error: 'Tags must be an array' },
          { status: 400 }
        );
      }
    }

    console.log('Final updateData:', JSON.stringify(updateData, null, 2));
    console.log('About to update post with ID:', postId);

    // Use the Supabase JavaScript client with service role
    const { data: updatedPost, error: updateError } = await supabase
      .from('community_posts')
      .update(updateData)
      .eq('id', postId)
      .select('*')
      .single();

    console.log('Supabase update result:');
    console.log('  data:', updatedPost);
    console.log('  error:', updateError);

    if (updateError) {
      console.error('Error updating post:', updateError);
      console.error('Update data was:', JSON.stringify(updateData, null, 2));
      return NextResponse.json(
        { error: 'Failed to update post' },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedPost);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/v16/community/posts/[postId] - Delete post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const reason = searchParams.get('reason') || 'User deleted';

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    // Verify the post exists and belongs to the user
    const { data: existingPost, error: fetchError } = await supabase
      .from('community_posts')
      .select('user_id')
      .eq('id', postId)
      .eq('is_deleted', false)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Post not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch post' },
        { status: 500 }
      );
    }

    if (existingPost.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this post' },
        { status: 403 }
      );
    }

    // Soft delete the post
    const { error: deleteError } = await supabase
      .from('community_posts')
      .update({
        is_deleted: true,
        deleted_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', postId);

    if (deleteError) {
      console.error('Error deleting post:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete post' },
        { status: 500 }
      );
    }

    // Update user stats
    await supabase.rpc('decrement_user_posts_count', { 
      user_id_param: userId 
    });

    return NextResponse.json({ message: 'Post deleted successfully' });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}