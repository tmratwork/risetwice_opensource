import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET /api/v16/community/circles/[circleId] - Get circle details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  try {
    const { circleId } = await params;

    // Get requesting user for access control
    // For now, allow unauthenticated access with limited visibility
    const { searchParams } = new URL(request.url);
    const requestingUserId = searchParams.get('requesting_user_id') || 'anonymous_user';

    // Use RLS-compliant function to get circle with access context
    const { data: circleArray, error } = await supabaseAdmin
      .rpc('get_circle_with_access', {
        target_circle_id: circleId,
        requesting_user_id: requestingUserId
      });

    const circle = circleArray?.[0] || null;

    if (error || !circle) {
      return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
    }

    return NextResponse.json(circle);
  } catch (error) {
    console.error('Unexpected error in GET circle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}