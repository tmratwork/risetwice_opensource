import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PostsResponse } from '@/app/chatbotV16/community/types/community';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/v16/community/circles/[circleId]/posts - Get posts for a specific circle
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sort_by') || 'hot';
    const filter = searchParams.get('filter') || 'all';
    const timeRange = searchParams.get('time_range') || 'all';
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    
    // const userId = 'placeholder-user-id';

    const { circleId } = await params;

    // Check if circle exists and if user has access
    const { data: circle, error: circleError } = await supabase
      .from('circles')
      .select('id, is_private')
      .eq('id', circleId)
      .single();

    if (circleError || !circle) {
      return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
    }

    // For development, we'll skip privacy checks
    // TODO: Re-enable when auth is integrated
    // if (circle.is_private) {
    //   const { data: membership } = await supabase
    //     .from('circle_memberships')
    //     .select('id')
    //     .eq('circle_id', circleId)
    //     .eq('user_id', userId)
    //     .single();

    //   if (!membership) {
    //     return NextResponse.json({ 
    //       error: 'This is a private circle. You must be a member to view posts.' 
    //     }, { status: 403 });
    //   }
    // }

    // Build query
    let query = supabase
      .from('community_posts')
      .select('*', { count: 'exact' })
      .eq('circle_id', circleId)
      .eq('is_deleted', false);

    // Apply post type filter
    if (filter !== 'all') {
      const filterMap = {
        questions: 'question',
        discussions: ['text', 'question'],
        audio: 'audio'
      };
      
      const postTypes = filterMap[filter as keyof typeof filterMap];
      if (Array.isArray(postTypes)) {
        query = query.in('post_type', postTypes);
      } else {
        query = query.eq('post_type', postTypes);
      }
    }

    // Apply tag filter
    if (tags.length > 0) {
      query = query.overlaps('tags', tags);
    }

    // Apply time range filter
    if (timeRange !== 'all') {
      const timeMap = {
        hour: 1,
        day: 24,
        week: 24 * 7,
        month: 24 * 30,
        year: 24 * 365
      };
      
      const hoursAgo = timeMap[timeRange as keyof typeof timeMap];
      if (hoursAgo) {
        const timeThreshold = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', timeThreshold);
      }
    }

    // Apply sorting
    switch (sortBy) {
      case 'hot':
        // Hot algorithm: upvotes - downvotes + comment_count, with time decay
        query = query.order('upvotes', { ascending: false });
        break;
      case 'new':
        query = query.order('created_at', { ascending: false });
        break;
      case 'top':
        query = query.order('upvotes', { ascending: false });
        break;
      case 'controversial':
        // Controversial: posts with similar upvotes and downvotes
        query = query.order('downvotes', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: posts, error, count } = await query;

    if (error) {
      console.error('Error fetching circle posts:', error);
      return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
    }

    const response: PostsResponse = {
      posts: posts || [],
      total_count: count || 0,
      page,
      limit,
      has_next_page: count ? count > page * limit : false,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Unexpected error in GET circle posts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}