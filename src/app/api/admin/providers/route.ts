// API route to fetch all providers for admin photo management
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    // Fetch all providers from s2_therapist_profiles
    const { data: providers, error } = await supabaseAdmin
      .from('s2_therapist_profiles')
      .select('id, full_name, title, profile_photo_url')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('[AdminProviders] Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch providers' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      providers: providers || []
    });
  } catch (error) {
    console.error('[AdminProviders] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
