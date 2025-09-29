// src/app/api/user-role/route.ts
// API routes for user role management

import { NextRequest, NextResponse } from 'next/server';

/**
 * GET user role by userId
 * POST body: { userId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Import Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Query user profile with role
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_role, profile_data')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user role:', error);
      // If user doesn't exist in user_profiles, default to patient
      return NextResponse.json({ role: 'patient' });
    }

    return NextResponse.json({
      role: data?.user_role || 'patient',
      profile_data: data?.profile_data
    });

  } catch (error) {
    console.error('Error in user-role API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update user role
 * PUT body: { userId: string, role: 'patient' | 'provider' | 'admin' }
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId, role } = await request.json();

    if (!userId || !role) {
      return NextResponse.json(
        { error: 'userId and role are required' },
        { status: 400 }
      );
    }

    // Validate role
    if (!['patient', 'provider', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be patient, provider, or admin' },
        { status: 400 }
      );
    }

    // Import Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Update user role
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        user_role: role,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Error updating user role:', error);
      return NextResponse.json(
        { error: 'Failed to update user role' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, role });

  } catch (error) {
    console.error('Error in user-role PUT API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}