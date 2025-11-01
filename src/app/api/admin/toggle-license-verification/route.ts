// src/app/api/admin/toggle-license-verification/route.ts
// Toggles therapist license verification status

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, isVerified } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'User ID is required', success: false },
        { status: 400 }
      );
    }

    if (typeof isVerified !== 'boolean') {
      return NextResponse.json(
        { error: 'isVerified must be a boolean', success: false },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update license verification status
    const { error: updateError } = await supabase
      .from('s2_therapist_profiles')
      .update({ is_license_verified: isVerified })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating license verification:', updateError);
      return NextResponse.json(
        { error: 'Failed to update license verification status', success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `License verification ${isVerified ? 'granted' : 'revoked'} successfully`
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    );
  }
}
