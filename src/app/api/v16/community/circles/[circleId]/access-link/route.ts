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

    // Get active access link for this circle
    const { data: accessLink, error } = await supabase
      .from('circle_access_links')
      .select('*')
      .eq('circle_id', circleId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ accessLink });
  } catch (error) {
    console.error('Error fetching access link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  try {
    const { circleId } = await params;
    const { userId, maxUses, expiresAt } = await request.json();

    // Verify user is admin of this circle
    const { data: membership } = await supabase
      .from('circle_memberships')
      .select('role')
      .eq('circle_id', circleId)
      .eq('user_id', userId)
      .single();

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Deactivate existing links
    await supabase
      .from('circle_access_links')
      .update({ is_active: false })
      .eq('circle_id', circleId);

    // Generate new access token using the database function
    const { data: tokenResult } = await supabase
      .rpc('generate_access_token');

    const accessToken = tokenResult;

    // Create new access link
    const { data: accessLink, error } = await supabase
      .from('circle_access_links')
      .insert({
        circle_id: circleId,
        access_token: accessToken,
        created_by: userId,
        max_uses: maxUses || null,
        expires_at: expiresAt || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ accessLink });
  } catch (error) {
    console.error('Error creating access link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  try {
    const { circleId } = await params;
    const { userId } = await request.json();

    // Verify user is admin of this circle
    const { data: membership } = await supabase
      .from('circle_memberships')
      .select('role')
      .eq('circle_id', circleId)
      .eq('user_id', userId)
      .single();

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Deactivate access link
    const { error } = await supabase
      .from('circle_access_links')
      .update({ is_active: false })
      .eq('circle_id', circleId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deactivating access link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}