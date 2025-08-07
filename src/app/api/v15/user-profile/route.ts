// src/app/api/v15/user-profile/route.ts

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * V15 User Profile GET Endpoint
 * Fetches user profile data for V15 architecture (Firebase UID compatible)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    console.log(`[memory] Fetching V15 user profile for user: ${userId}`);

    // Get user profile from V15 user_profiles table
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('profile_data, ai_instructions_summary, version, updated_at')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        // No profile found
        console.log(`[memory] No user profile found for user: ${userId}`);
        return NextResponse.json(
          { error: 'User profile not found' },
          { status: 404 }
        );
      }
      
      console.error('[memory] Error fetching user profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch user profile', details: profileError },
        { status: 500 }
      );
    }

    // Format response to match V11 structure for compatibility
    const response = {
      profile: userProfile.profile_data || {},
      lastUpdated: userProfile.updated_at,
      version: userProfile.version,
      aiInstructionsSummary: userProfile.ai_instructions_summary
    };

    console.log(`[memory] Successfully fetched user profile for user: ${userId}, version: ${userProfile.version}`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('[memory] ERROR in V15 user-profile GET:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        error: 'Internal server error fetching user profile',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}