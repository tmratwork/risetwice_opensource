// src/app/api/provider/check-license-verification/route.ts
// Checks if provider's license has been verified

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { providerUserId } = body;

    if (!providerUserId || typeof providerUserId !== 'string') {
      return NextResponse.json(
        { error: 'Provider user ID is required', isVerified: false },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query s2_therapist_profiles for license verification status
    const { data: profile, error: profileError } = await supabase
      .from('s2_therapist_profiles')
      .select('is_license_verified')
      .eq('user_id', providerUserId)
      .single();

    if (profileError || !profile) {
      console.error('Provider profile not found:', profileError);
      return NextResponse.json(
        { error: 'Provider profile not found', isVerified: false },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      isVerified: profile.is_license_verified || false
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', isVerified: false },
      { status: 500 }
    );
  }
}
