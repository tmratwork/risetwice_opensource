import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Get circle info via access token
    const { data: accessLink, error: linkError } = await supabase
      .from('circle_access_links')
      .select(`
        *,
        circles:circle_id (
          id,
          name,
          display_name,
          description,
          rules,
          member_count,
          post_count,
          is_private,
          requires_approval,
          welcome_message,
          join_questions,
          created_at
        )
      `)
      .eq('access_token', token)
      .eq('is_active', true)
      .single();

    if (linkError || !accessLink) {
      return NextResponse.json({ error: 'Invalid or expired access link' }, { status: 404 });
    }

    // Check if link has expired
    if (accessLink.expires_at && new Date(accessLink.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Access link has expired' }, { status: 400 });
    }

    // Check if link has reached max uses
    if (accessLink.max_uses && accessLink.usage_count >= accessLink.max_uses) {
      return NextResponse.json({ error: 'Access link has reached maximum uses' }, { status: 400 });
    }

    return NextResponse.json({ 
      circle: accessLink.circles,
      accessToken: token,
      usageCount: accessLink.usage_count,
      maxUses: accessLink.max_uses,
      expiresAt: accessLink.expires_at,
    });
  } catch (error) {
    console.error('Error fetching circle via access token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { userId, message, notificationEmail, notificationPhone } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Verify access token and get circle info
    const { data: accessLink, error: linkError } = await supabase
      .from('circle_access_links')
      .select('circle_id, usage_count, max_uses, expires_at')
      .eq('access_token', token)
      .eq('is_active', true)
      .single();

    if (linkError || !accessLink) {
      return NextResponse.json({ error: 'Invalid access link' }, { status: 400 });
    }

    // Submit join request using the existing endpoint logic
    const joinRequestResponse = await fetch(
      `${request.nextUrl.origin}/api/v16/community/circles/${accessLink.circle_id}/join-request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          message,
          notificationEmail,
          notificationPhone,
          accessToken: token,
        }),
      }
    );

    const joinRequestData = await joinRequestResponse.json();

    if (!joinRequestResponse.ok) {
      return NextResponse.json(joinRequestData, { status: joinRequestResponse.status });
    }

    return NextResponse.json(joinRequestData);
  } catch (error) {
    console.error('Error submitting join request via token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}