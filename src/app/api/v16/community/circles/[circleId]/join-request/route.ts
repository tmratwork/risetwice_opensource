import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  try {
    const { circleId } = await params;
    const { searchParams } = new URL(request.url);
    const userId: string | null = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Get user's current request status for this circle
    const { data: joinRequest, error } = await supabase
      .from('circle_join_requests')
      .select('*')
      .eq('circle_id', circleId)
      .eq('requester_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ request: joinRequest });
  } catch (error) {
    console.error('Error fetching join request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  try {
    const { circleId } = await params;
    const { 
      userId, 
      message, 
      notificationEmail, 
      notificationPhone,
      accessToken 
    } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // If using access token, verify it and increment usage
    if (accessToken) {
      const { data: accessLink, error: linkError } = await supabase
        .from('circle_access_links')
        .select('*')
        .eq('access_token', accessToken)
        .eq('is_active', true)
        .single();

      if (linkError || !accessLink) {
        return NextResponse.json({ error: 'Invalid access link' }, { status: 400 });
      }

      // Check if link has expired
      if (accessLink.expires_at && new Date(accessLink.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Access link has expired' }, { status: 400 });
      }

      // Check if link has reached max uses
      if (accessLink.max_uses && accessLink.usage_count >= accessLink.max_uses) {
        return NextResponse.json({ error: 'Access link has reached maximum uses' }, { status: 400 });
      }

      // Increment usage count
      await supabase
        .from('circle_access_links')
        .update({ usage_count: accessLink.usage_count + 1 })
        .eq('id', accessLink.id);
    }

    // Check if user already has a pending or approved request
    const { data: existingRequest } = await supabase
      .from('circle_join_requests')
      .select('status')
      .eq('circle_id', circleId)
      .eq('requester_id', userId)
      .single();

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return NextResponse.json({ error: 'You already have a pending request for this circle' }, { status: 400 });
      }
      if (existingRequest.status === 'approved') {
        return NextResponse.json({ error: 'You are already a member of this circle' }, { status: 400 });
      }
    }

    // Create or update join request
    const { data: joinRequest, error } = await supabase
      .from('circle_join_requests')
      .upsert({
        circle_id: circleId,
        requester_id: userId,
        message: message || null,
        notification_email: notificationEmail || null,
        notification_phone: notificationPhone || null,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ joinRequest });
  } catch (error) {
    console.error('Error creating join request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}