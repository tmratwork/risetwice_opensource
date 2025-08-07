import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/v16/community/posts - Get posts with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const sortBy = searchParams.get('sort_by') || 'hot';
    const filter = searchParams.get('filter') || 'all';
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    const userId = searchParams.get('user_id');
    const circleId = searchParams.get('circle_id');
    const requestingUserId = searchParams.get('requesting_user_id');

    let query = supabase
      .from('community_posts')
      .select(`
        *,
        circles:circle_id (
          id,
          name,
          display_name
        )
      `)
      .eq('is_deleted', false);

    // Apply circle filter - THREE FEED TYPES:
    if (circleId) {
      // CIRCLE-SPECIFIC FEED: Show only posts from this specific circle
      query = query.eq('circle_id', circleId);
    } else if (requestingUserId) {
      // AUTHENTICATED HOME FEED: Show general posts + posts from user's circles
      // This creates a personalized feed similar to Reddit's home page
      const { data: userCircles, error: membershipError } = await supabase
        .from('circle_memberships')
        .select('circle_id')
        .eq('user_id', requestingUserId);

      if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_FILTERING_LOGS === 'true') {
        console.log('[circle_filtering] [SERVER] User circle memberships query:', {
          requestingUserId,
          userCircles,
          membershipError,
          count: userCircles?.length || 0
        });
      }

      const userCircleIds = userCircles?.map(m => m.circle_id) || [];
      
      if (userCircleIds.length > 0) {
        // Include posts from user's circles OR general posts (no circle)
        const orCondition = `circle_id.is.null,circle_id.in.(${userCircleIds.join(',')})`;
        if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_FILTERING_LOGS === 'true') {
          console.log('[circle_filtering] [SERVER] Using OR condition for home feed:', orCondition);
        }
        query = query.or(orCondition);
      } else {
        if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_FILTERING_LOGS === 'true') {
          console.log('[circle_filtering] [SERVER] User has no circles, showing only general posts');
        }
        // User not in any circles, only show general posts
        query = query.is('circle_id', null);
      }
    } else {
      // ANONYMOUS/PUBLIC FEED: Only show general posts (not circle-specific posts)
      // This ensures private circle content is not visible to non-members
      query = query.is('circle_id', null);
    }

    // Apply filters
    if (filter !== 'all') {
      query = query.eq('post_type', filter);
    }

    if (tags.length > 0) {
      query = query.overlaps('tags', tags);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    // Apply sorting
    switch (sortBy) {
      case 'new':
        query = query.order('created_at', { ascending: false });
        break;
      case 'top':
        query = query.order('upvotes', { ascending: false });
        break;
      case 'controversial':
        // Order by posts with high engagement but close vote ratios
        query = query.order('comment_count', { ascending: false });
        break;
      case 'hot':
      default:
        // Hot algorithm: combine upvotes, comment_count, and recency
        query = query.order('created_at', { ascending: false });
        break;
    }

    // Get count first - need to create a separate query for count
    let countQuery = supabase
      .from('community_posts')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false);

    // Apply same circle filter logic to count query
    if (circleId) {
      countQuery = countQuery.eq('circle_id', circleId);
    } else if (requestingUserId) {
      const { data: userCircles } = await supabase
        .from('circle_memberships')
        .select('circle_id')
        .eq('user_id', requestingUserId);

      const userCircleIds = userCircles?.map(m => m.circle_id) || [];
      
      if (userCircleIds.length > 0) {
        countQuery = countQuery.or(`circle_id.is.null,circle_id.in.(${userCircleIds.join(',')})`);
      } else {
        countQuery = countQuery.is('circle_id', null);
      }
    } else {
      countQuery = countQuery.is('circle_id', null);
    }
    
    // Apply same filters as main query
    if (filter) {
      switch (filter) {
        case 'recent':
          // No additional filter needed
          break;
        case 'trending':
          countQuery = countQuery.gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
          break;
        case 'popular':
          countQuery = countQuery.gte('upvotes', 5);
          break;
      }
    }
    
    const { count } = await countQuery;
    
    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: posts, error } = await query;

    if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_FILTERING_LOGS === 'true') {
      console.log('[circle_filtering] [SERVER] Posts query result:', {
        postsCount: posts?.length || 0,
        error: error?.message,
        circleId,
        requestingUserId,
        posts: posts?.map(p => ({ 
          id: p.id, 
          title: p.title.substring(0, 30) + '...', 
          circle_id: p.circle_id,
          circles: p.circles 
        }))
      });
    }

    if (error) {
      console.error('Error fetching posts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch posts' },
        { status: 500 }
      );
    }

    const totalCount = count || 0;
    const hasNextPage = from + limit < totalCount;

    return NextResponse.json({
      posts: posts || [],
      total_count: totalCount,
      page,
      limit,
      has_next_page: hasNextPage
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/v16/community/posts - Create a new post
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, title, content, post_type, audio_url, audio_duration, tags, circle_id } = body;
    
    // Debug logging to understand what's being received (temporary for tag debugging)
    console.log('POST /api/v16/community/posts - Raw body:', JSON.stringify(body, null, 2));
    console.log('POST /api/v16/community/posts - Extracted tags:', tags);
    console.log('POST /api/v16/community/posts - Tags type:', typeof tags);
    console.log('POST /api/v16/community/posts - Tags is Array:', Array.isArray(tags));

    // Validate required fields
    if (!user_id || !title?.trim() || !content?.trim() || !post_type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate post_type
    if (!['text', 'audio', 'question'].includes(post_type)) {
      return NextResponse.json(
        { error: 'Invalid post type' },
        { status: 400 }
      );
    }

    // If posting to a circle, verify membership
    if (circle_id) {
      console.log('[POST_DEBUG] Checking membership for user_id:', user_id, 'circle_id:', circle_id);
      const { data: membership, error: membershipError } = await supabase
        .from('circle_memberships')
        .select('id')
        .eq('circle_id', circle_id)
        .eq('user_id', user_id)
        .single();

      console.log('[POST_DEBUG] Membership check result:', { membership, membershipError });

      if (!membership) {
        console.log('[POST_DEBUG] Membership check failed - returning 403 error');
        return NextResponse.json(
          { error: 'You must be a member of this circle to post' },
          { status: 403 }
        );
      }
      console.log('[POST_DEBUG] Membership check passed');
    }

    // TODO: Add content moderation here
    // const moderationResult = await moderateContent(content, post_type);
    // if (moderationResult.requires_review) {
    //   // Handle content that needs review
    // }

    // Get user's display name first
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('profile_data')
      .eq('user_id', user_id)
      .single();

    if (profileError || !userProfile?.profile_data?.display_name) {
      return NextResponse.json(
        { error: 'User must have a display name set before posting' },
        { status: 400 }
      );
    }

    const displayName = userProfile.profile_data.display_name;

    // Create the post
    const insertData = {
      user_id,
      display_name: displayName,
      title: title.trim(),
      content: content.trim(),
      post_type,
      audio_url,
      audio_duration,
      tags: tags || [],
      circle_id: circle_id || null
    };
    
    // Debug logging for the insert data
    console.log('POST /api/v16/community/posts - insertData:', JSON.stringify(insertData, null, 2));
    console.log('POST /api/v16/community/posts - insertData.tags:', insertData.tags);
    console.log('POST /api/v16/community/posts - insertData.tags type:', typeof insertData.tags);
    console.log('POST /api/v16/community/posts - insertData.tags is Array:', Array.isArray(insertData.tags));
    
    const { data: post, error } = await supabaseAdmin
      .from('community_posts')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating post:', error);
      return NextResponse.json(
        { error: 'Failed to create post' },
        { status: 500 }
      );
    }
    
    // Debug logging for the returned post data
    console.log('POST /api/v16/community/posts - returned post:', JSON.stringify(post, null, 2));
    console.log('POST /api/v16/community/posts - returned post.tags:', post?.tags);

    // Update user stats
    await supabase.rpc('increment_user_posts_count', { 
      user_id_param: user_id 
    });

    // Update circle post count if posted to a circle
    if (circle_id) {
      // Get current count and increment
      const { data: circleData } = await supabase
        .from('circles')
        .select('post_count')
        .eq('id', circle_id)
        .single();
      
      if (circleData) {
        await supabase
          .from('circles')
          .update({ 
            post_count: (circleData.post_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', circle_id);
      }
    }

    return NextResponse.json(post, { status: 201 });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}