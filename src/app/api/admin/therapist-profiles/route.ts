// src/app/api/admin/therapist-profiles/route.ts
// Fetches all therapist profiles with license verification status

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all therapist profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('s2_therapist_profiles')
      .select('id, user_id, full_name, email_address, phone_number, is_license_verified, title, primary_location')
      .order('full_name', { ascending: true });

    if (profilesError) {
      console.error('Error fetching therapist profiles:', profilesError);
      return NextResponse.json(
        { error: 'Failed to fetch therapist profiles', success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profiles: profiles || []
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    );
  }
}
