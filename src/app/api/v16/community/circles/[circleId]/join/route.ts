import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/v16/community/circles/[circleId]/join - Join a circle
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  try {
    const body = await request.json();
    const userId = body.user_id;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const { circleId } = await params;

    // Check if circle exists
    const { data: circle, error: circleError } = await supabase
      .from('circles')
      .select('id, is_private, member_count')
      .eq('id', circleId)
      .single();

    if (circleError || !circle) {
      return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
    }

    // Check if user is already a member
    const { data: existingMembership } = await supabase
      .from('circle_memberships')
      .select('id')
      .eq('circle_id', circleId)
      .eq('user_id', userId)
      .single();

    if (existingMembership) {
      return NextResponse.json({ error: 'You are already a member of this circle' }, { status: 409 });
    }

    // Check if user is the circle creator
    const { data: circleDetails } = await supabase
      .from('circles')
      .select('created_by')
      .eq('id', circleId)
      .single();

    const isCreator = circleDetails?.created_by === userId;

    // Note: Private circle restrictions are now handled in the frontend
    // This endpoint only handles direct joining for public circles or circle creators

    // Create membership (creators get admin role)
    const { error: membershipError } = await supabase
      .from('circle_memberships')
      .insert({
        circle_id: circleId,
        user_id: userId,
        role: isCreator ? 'admin' : 'member',
      });

    if (membershipError) {
      console.error('Error creating circle membership:', membershipError);
      return NextResponse.json({ error: 'Failed to join circle' }, { status: 500 });
    }

    // Update circle member count
    const { error: updateError } = await supabase
      .from('circles')
      .update({ 
        member_count: circle.member_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', circleId);

    if (updateError) {
      console.error('Error updating circle member count:', updateError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({ message: 'Successfully joined circle' });
  } catch (error) {
    console.error('Unexpected error in POST join circle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/v16/community/circles/[circleId]/join - Leave a circle
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const { circleId } = await params;

    // Check if user is a member
    const { data: membership, error: membershipError } = await supabase
      .from('circle_memberships')
      .select('role')
      .eq('circle_id', circleId)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'You are not a member of this circle' }, { status: 404 });
    }

    // Prevent admin from leaving if they're the only admin
    if (membership.role === 'admin') {
      const { data: otherAdmins, error: adminError } = await supabase
        .from('circle_memberships')
        .select('id')
        .eq('circle_id', circleId)
        .eq('role', 'admin')
        .neq('user_id', userId);

      if (adminError) {
        console.error('Error checking other admins:', adminError);
        return NextResponse.json({ error: 'Failed to check admin status' }, { status: 500 });
      }

      if (!otherAdmins || otherAdmins.length === 0) {
        return NextResponse.json({ 
          error: 'You cannot leave this circle as you are the only admin. Please promote another member to admin first or delete the circle.' 
        }, { status: 400 });
      }
    }

    // Remove membership
    const { error: deleteError } = await supabase
      .from('circle_memberships')
      .delete()
      .eq('circle_id', circleId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error removing circle membership:', deleteError);
      return NextResponse.json({ error: 'Failed to leave circle' }, { status: 500 });
    }

    // Update circle member count
    const { data: circle } = await supabase
      .from('circles')
      .select('member_count')
      .eq('id', circleId)
      .single();

    if (circle) {
      const { error: updateError } = await supabase
        .from('circles')
        .update({ 
          member_count: Math.max(0, circle.member_count - 1),
          updated_at: new Date().toISOString(),
        })
        .eq('id', circleId);

      if (updateError) {
        console.error('Error updating circle member count:', updateError);
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json({ message: 'Successfully left circle' });
  } catch (error) {
    console.error('Unexpected error in DELETE leave circle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}