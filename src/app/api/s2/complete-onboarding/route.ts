// src/app/api/s2/complete-onboarding/route.ts
// API endpoint to complete S2 onboarding and set provider role

import { NextRequest, NextResponse } from 'next/server';

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

    // Set user as provider
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        is_provider: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Error setting provider role:', error);
      return NextResponse.json(
        { error: 'Failed to complete onboarding' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully',
      role: 'provider'
    });

  } catch (error) {
    console.error('Error in complete-onboarding API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}