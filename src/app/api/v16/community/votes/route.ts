import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/v16/community/votes - Cast or update a vote
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, post_id, comment_id, vote_type } = body;

    // Validate required fields
    if (!user_id || !vote_type || (!post_id && !comment_id)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['upvote', 'downvote'].includes(vote_type)) {
      return NextResponse.json(
        { error: 'Invalid vote type' },
        { status: 400 }
      );
    }

    // Check for existing vote
    let existingVoteQuery = supabase
      .from('post_votes')
      .select('*')
      .eq('user_id', user_id);

    if (post_id) {
      existingVoteQuery = existingVoteQuery.eq('post_id', post_id);
    } else {
      existingVoteQuery = existingVoteQuery.eq('comment_id', comment_id);
    }

    const { data: existingVote } = await existingVoteQuery.single();

    // If same vote exists, remove it (toggle off)
    if (existingVote && existingVote.vote_type === vote_type) {
      const { error: deleteError } = await supabase
        .from('post_votes')
        .delete()
        .eq('id', existingVote.id);

      if (deleteError) {
        console.error('Error removing vote:', deleteError);
        return NextResponse.json(
          { error: 'Failed to remove vote' },
          { status: 500 }
        );
      }

      // Update vote counts
      if (post_id) {
        await updatePostVoteCounts(post_id, vote_type, -1);
      } else if (comment_id) {
        await updateCommentVoteCounts(comment_id, vote_type, -1);
      }

      return NextResponse.json({ 
        message: 'Vote removed',
        action: 'removed',
        vote_type 
      });
    }

    // If different vote exists, update it
    if (existingVote && existingVote.vote_type !== vote_type) {
      const { error: updateError } = await supabase
        .from('post_votes')
        .update({ vote_type })
        .eq('id', existingVote.id);

      if (updateError) {
        console.error('Error updating vote:', updateError);
        return NextResponse.json(
          { error: 'Failed to update vote' },
          { status: 500 }
        );
      }

      // Update vote counts (remove old, add new)
      if (post_id) {
        await updatePostVoteCounts(post_id, existingVote.vote_type, -1);
        await updatePostVoteCounts(post_id, vote_type, 1);
      } else if (comment_id) {
        await updateCommentVoteCounts(comment_id, existingVote.vote_type, -1);
        await updateCommentVoteCounts(comment_id, vote_type, 1);
      }

      return NextResponse.json({ 
        message: 'Vote updated',
        action: 'updated',
        vote_type,
        previous_vote: existingVote.vote_type
      });
    }

    // Create new vote
    const voteData: {
      user_id: string;
      vote_type: string;
      post_id?: string;
      comment_id?: string;
    } = {
      user_id,
      vote_type
    };

    if (post_id) {
      voteData.post_id = post_id;
    } else {
      voteData.comment_id = comment_id;
    }

    const { data: newVote, error: createError } = await supabase
      .from('post_votes')
      .insert(voteData)
      .select()
      .single();

    if (createError) {
      console.error('Error creating vote:', createError);
      return NextResponse.json(
        { error: 'Failed to create vote' },
        { status: 500 }
      );
    }

    // Update vote counts
    if (post_id) {
      await updatePostVoteCounts(post_id, vote_type, 1);
    } else if (comment_id) {
      await updateCommentVoteCounts(comment_id, vote_type, 1);
    }

    return NextResponse.json({ 
      message: 'Vote created',
      action: 'created',
      vote_type,
      vote: newVote
    }, { status: 201 });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/v16/community/votes - Remove a vote
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const postId = searchParams.get('post_id');
    const commentId = searchParams.get('comment_id');

    if (!userId || (!postId && !commentId)) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Find and delete the vote
    let deleteQuery = supabase
      .from('post_votes')
      .delete()
      .eq('user_id', userId);

    if (postId) {
      deleteQuery = deleteQuery.eq('post_id', postId);
    } else {
      deleteQuery = deleteQuery.eq('comment_id', commentId);
    }

    const { data: deletedVote, error } = await deleteQuery.select().single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Vote not found' },
          { status: 404 }
        );
      }
      console.error('Error deleting vote:', error);
      return NextResponse.json(
        { error: 'Failed to delete vote' },
        { status: 500 }
      );
    }

    // Update vote counts
    if (postId) {
      await updatePostVoteCounts(postId, deletedVote.vote_type, -1);
    } else if (commentId) {
      await updateCommentVoteCounts(commentId, deletedVote.vote_type, -1);
    }

    return NextResponse.json({ 
      message: 'Vote removed',
      vote_type: deletedVote.vote_type
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to update post vote counts
async function updatePostVoteCounts(postId: string, voteType: string, delta: number) {
  const column = voteType === 'upvote' ? 'upvotes' : 'downvotes';
  
  const { data: post } = await supabase
    .from('community_posts')
    .select(column)
    .eq('id', postId)
    .single();

  if (post) {
    const newCount = Math.max(0, ((post as Record<string, number>)[column] || 0) + delta);
    await supabase
      .from('community_posts')
      .update({ [column]: newCount })
      .eq('id', postId);
  }
}

// Helper function to update comment vote counts
async function updateCommentVoteCounts(commentId: string, voteType: string, delta: number) {
  const column = voteType === 'upvote' ? 'upvotes' : 'downvotes';
  
  const { data: comment } = await supabase
    .from('post_comments')
    .select(column)
    .eq('id', commentId)
    .single();

  if (comment) {
    const newCount = Math.max(0, ((comment as Record<string, number>)[column] || 0) + delta);
    await supabase
      .from('post_comments')
      .update({ [column]: newCount })
      .eq('id', commentId);
  }
}