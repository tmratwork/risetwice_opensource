import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Logging helper following project standards
const logCircleSelector = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_SELECTOR_LOGS === 'true') {
    console.log(`[circle_selector] [SERVER] ${message}`, ...args);
  }
};

// GET /api/v16/community/memberships - Get user's circle memberships
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    logCircleSelector('Membership API called', { userId, url: request.url });

    // Server-side logging following project standards
    if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_MEMBERSHIP_LOGS === 'true') {
      console.log('[circle_membership] [SERVER] Membership request for user:', userId);
    }

    if (!userId) {
      logCircleSelector('❌ No user ID provided');
      if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_MEMBERSHIP_LOGS === 'true') {
        console.log('[circle_membership] [SERVER] ❌ No user ID provided');
      }
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    logCircleSelector('Executing Supabase query for user memberships');
    
    const { data: memberships, error } = await supabase
      .from('circle_memberships')
      .select(`
        *,
        circles:circle_id (
          id,
          name,
          display_name
        )
      `)
      .eq('user_id', userId);

    logCircleSelector('Supabase query completed', {
      hasError: !!error,
      membershipCount: memberships?.length || 0,
      error: error?.message
    });

    if (error) {
      logCircleSelector('❌ Database error:', error);
      if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_MEMBERSHIP_LOGS === 'true') {
        console.error('[circle_membership] [SERVER] ❌ Database error:', error);
      }
      return NextResponse.json(
        { error: 'Failed to fetch memberships' },
        { status: 500 }
      );
    }

    logCircleSelector('✅ Memberships retrieved successfully', {
      userId,
      count: memberships?.length || 0,
      memberships: memberships?.map(m => ({
        circleId: m.circle_id,
        role: m.role,
        circleName: m.circles?.display_name,
        circleData: m.circles
      }))
    });

    if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_MEMBERSHIP_LOGS === 'true') {
      console.log('[circle_membership] [SERVER] ✅ Memberships found:', {
        userId,
        count: memberships?.length || 0,
        memberships: memberships?.map(m => ({
          circleId: m.circle_id,
          role: m.role,
          circleName: m.circles?.display_name
        }))
      });
    }

    const response = {
      memberships: memberships || []
    };
    
    logCircleSelector('Returning API response', response);
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}