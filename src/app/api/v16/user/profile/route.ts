import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/v16/user/profile - Get user profile including display name
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('user_id, profile_data')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user profile:', error);
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      );
    }

    // If no profile exists, return empty profile state
    if (!profile) {
      console.log(`No profile found for user ${userId}, returning empty profile state`);
      return NextResponse.json({
        user_id: userId,
        display_name: null,
        has_display_name: false
      });
    }

    const displayName = profile?.profile_data?.display_name || null;

    return NextResponse.json({
      user_id: userId,
      display_name: displayName,
      has_display_name: !!displayName
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/v16/user/profile - Update user display name
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, display_name } = body;

    if (!user_id || !display_name?.trim()) {
      return NextResponse.json(
        { error: 'User ID and display name required' },
        { status: 400 }
      );
    }

    const trimmedDisplayName = display_name.trim();

    // Validate display name (basic validation)
    if (trimmedDisplayName.length < 2 || trimmedDisplayName.length > 50) {
      return NextResponse.json(
        { error: 'Display name must be between 2 and 50 characters' },
        { status: 400 }
      );
    }

    // Check if display name is already taken
    const { data: existingUsers, error: checkError } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('profile_data->>display_name', trimmedDisplayName)
      .neq('user_id', user_id);

    if (checkError) {
      console.error('Error checking display name availability:', checkError);
      return NextResponse.json(
        { error: 'Failed to check display name availability' },
        { status: 500 }
      );
    }

    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json(
        { error: 'Display name is already taken' },
        { status: 409 }
      );
    }

    // First, get existing profile data to preserve it
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('profile_data')
      .eq('user_id', user_id)
      .maybeSingle();

    // Merge display name with existing profile data
    const updatedProfileData = {
      ...(existingProfile?.profile_data || {}),
      display_name: trimmedDisplayName
    };

    // Update or create user profile with display name
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id,
        profile_data: updatedProfileData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      return NextResponse.json(
        { error: 'Failed to update display name' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user_id,
      display_name: trimmedDisplayName,
      has_display_name: true
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}