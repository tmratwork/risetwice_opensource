import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const validReactionTypes = ['care', 'hugs', 'helpful', 'strength', 'relatable', 'thoughtful', 'growth', 'grateful'];

// POST /api/v16/community/reactions - Add or update a reaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, post_id, comment_id, reaction_type } = body;

    // Validate required fields
    if (!user_id || (!post_id && !comment_id)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // If reaction_type is null, remove the reaction
    if (reaction_type === null) {
      return await removeReaction(user_id, post_id, comment_id);
    }

    // Validate reaction type
    if (!validReactionTypes.includes(reaction_type)) {
      return NextResponse.json(
        { error: 'Invalid reaction type' },
        { status: 400 }
      );
    }

    // Check for existing reaction
    let existingReactionQuery = supabase
      .from('post_reactions')
      .select('*')
      .eq('user_id', user_id);

    if (post_id) {
      existingReactionQuery = existingReactionQuery.eq('post_id', post_id);
    } else {
      existingReactionQuery = existingReactionQuery.eq('comment_id', comment_id);
    }

    const { data: existingReaction } = await existingReactionQuery.single();

    // If same reaction exists, remove it (toggle off)
    if (existingReaction && existingReaction.reaction_type === reaction_type) {
      const { error: deleteError } = await supabase
        .from('post_reactions')
        .delete()
        .eq('id', existingReaction.id);

      if (deleteError) {
        console.error('Error removing reaction:', deleteError);
        return NextResponse.json(
          { error: 'Failed to remove reaction' },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        message: 'Reaction removed',
        action: 'removed',
        reaction_type 
      });
    }

    // If different reaction exists, update it
    if (existingReaction && existingReaction.reaction_type !== reaction_type) {
      const { error: updateError } = await supabase
        .from('post_reactions')
        .update({ reaction_type })
        .eq('id', existingReaction.id);

      if (updateError) {
        console.error('Error updating reaction:', updateError);
        return NextResponse.json(
          { error: 'Failed to update reaction' },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        message: 'Reaction updated',
        action: 'updated',
        reaction_type,
        previous_reaction: existingReaction.reaction_type
      });
    }

    // Create new reaction
    const reactionData: {
      user_id: string;
      reaction_type: string;
      post_id?: string;
      comment_id?: string;
    } = {
      user_id,
      reaction_type
    };

    if (post_id) {
      reactionData.post_id = post_id;
    } else {
      reactionData.comment_id = comment_id;
    }

    const { data: newReaction, error: createError } = await supabase
      .from('post_reactions')
      .insert(reactionData)
      .select()
      .single();

    if (createError) {
      console.error('Error creating reaction:', createError);
      return NextResponse.json(
        { error: 'Failed to create reaction' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: 'Reaction created',
      action: 'created',
      reaction_type,
      reaction: newReaction
    }, { status: 201 });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/v16/community/reactions - Remove a reaction
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

    return await removeReaction(userId, postId, commentId);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/v16/community/reactions - Get user's reactions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const postId = searchParams.get('post_id');
    const commentId = searchParams.get('comment_id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing user_id parameter' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('post_reactions')
      .select('*')
      .eq('user_id', userId);

    if (postId) {
      query = query.eq('post_id', postId);
    } else if (commentId) {
      query = query.eq('comment_id', commentId);
    }

    const { data: reactions, error } = await query;

    if (error) {
      console.error('Error fetching reactions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reactions' },
        { status: 500 }
      );
    }

    return NextResponse.json({ reactions });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to remove a reaction
async function removeReaction(userId: string, postId: string | null, commentId: string | null) {
  let deleteQuery = supabase
    .from('post_reactions')
    .delete()
    .eq('user_id', userId);

  if (postId) {
    deleteQuery = deleteQuery.eq('post_id', postId);
  } else if (commentId) {
    deleteQuery = deleteQuery.eq('comment_id', commentId);
  }

  const { data: deletedReaction, error } = await deleteQuery.select().single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Reaction not found' },
        { status: 404 }
      );
    }
    console.error('Error deleting reaction:', error);
    return NextResponse.json(
      { error: 'Failed to delete reaction' },
      { status: 500 }
    );
  }

  return NextResponse.json({ 
    message: 'Reaction removed',
    reaction_type: deletedReaction.reaction_type
  });
}