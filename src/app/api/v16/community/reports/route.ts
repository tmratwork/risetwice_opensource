import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/v16/community/reports - Report content
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reported_by, post_id, comment_id, reason, description } = body;

    // Validate required fields
    if (!reported_by || !reason || (!post_id && !comment_id)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate reason
    const validReasons = [
      'spam',
      'harassment',
      'hate_speech',
      'misinformation',
      'inappropriate_content',
      'self_harm',
      'violence',
      'other'
    ];

    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { error: 'Invalid report reason' },
        { status: 400 }
      );
    }

    // Check if content exists
    if (post_id) {
      const { error } = await supabase
        .from('community_posts')
        .select('id')
        .eq('id', post_id)
        .eq('is_deleted', false)
        .single();

      if (error) {
        return NextResponse.json(
          { error: 'Post not found' },
          { status: 404 }
        );
      }
    }

    if (comment_id) {
      const { error } = await supabase
        .from('post_comments')
        .select('id')
        .eq('id', comment_id)
        .eq('is_deleted', false)
        .single();

      if (error) {
        return NextResponse.json(
          { error: 'Comment not found' },
          { status: 404 }
        );
      }
    }

    // Check for duplicate reports from same user
    let duplicateQuery = supabase
      .from('post_reports')
      .select('id')
      .eq('reported_by', reported_by)
      .eq('reason', reason);

    if (post_id) {
      duplicateQuery = duplicateQuery.eq('post_id', post_id);
    } else {
      duplicateQuery = duplicateQuery.eq('comment_id', comment_id);
    }

    const { data: existingReport } = await duplicateQuery.single();

    if (existingReport) {
      return NextResponse.json(
        { error: 'You have already reported this content for this reason' },
        { status: 409 }
      );
    }

    // Create the report
    const reportData: {
      reported_by: string;
      reason: string;
      description: string | null;
      status: string;
      post_id?: string;
      comment_id?: string;
    } = {
      reported_by,
      reason,
      description: description?.trim() || null,
      status: 'pending'
    };

    if (post_id) {
      reportData.post_id = post_id;
    } else {
      reportData.comment_id = comment_id;
    }

    const { data: report, error: createError } = await supabase
      .from('post_reports')
      .insert(reportData)
      .select()
      .single();

    if (createError) {
      console.error('Error creating report:', createError);
      return NextResponse.json(
        { error: 'Failed to create report' },
        { status: 500 }
      );
    }

    // Flag the content for review if it's a serious report
    const seriousReasons = ['self_harm', 'violence', 'hate_speech'];
    if (seriousReasons.includes(reason)) {
      if (post_id) {
        await supabase
          .from('community_posts')
          .update({ is_flagged: true })
          .eq('id', post_id);
      } else if (comment_id) {
        await supabase
          .from('post_comments')
          .update({ is_flagged: true })
          .eq('id', comment_id);
      }

      // TODO: Add to clinical review queue for immediate attention
      // await addToClinicalReviewQueue(content_id, content_type, 'immediate', [reason]);
    }

    return NextResponse.json({
      message: 'Report submitted successfully',
      report_id: report.id
    }, { status: 201 });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/v16/community/reports - Get reports (admin only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const reason = searchParams.get('reason');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    // TODO: Add admin authentication check here
    // const isAdmin = await checkAdminPermissions(request);
    // if (!isAdmin) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    // }

    let query = supabase
      .from('post_reports')
      .select(`
        *,
        community_posts (
          id,
          title,
          content,
          user_id
        ),
        post_comments (
          id,
          content,
          user_id
        )
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    if (reason) {
      query = query.eq('reason', reason);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: reports, error, count } = await query;

    if (error) {
      console.error('Error fetching reports:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reports' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reports: reports || [],
      total_count: count || 0,
      page,
      limit
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}