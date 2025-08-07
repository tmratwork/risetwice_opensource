/**
 * API endpoint for retrieving and updating user profile data
 * Returns what the AI remembers about the user
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[USER-PROFILE-GET-${requestId}]`;

  try {
    // Get the user ID from query params
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log(`${logPrefix} Fetching profile for user ${userId}`);

    // Check for valid UUID format to avoid database errors
    try {
      // Parse the userId as UUID to validate it
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(userId)) {
        console.log(`${logPrefix} User ID is not in UUID format: ${userId}`);
      }
    } catch (err) {
      console.log(`${logPrefix} Error validating UUID format: ${err}`);
    }

    // Fetch user profile data from the database
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      // If no profile found, return 404
      if (profileError.code === 'PGRST116') {
        console.log(`${logPrefix} No profile found for user ${userId}`);
        
        return NextResponse.json({
          error: 'No profile found for this user',
          message: 'A profile has not been generated yet'
        }, { status: 404 });
      }
      
      console.error(`${logPrefix} Error fetching profile:`, profileError);
      console.error(`${logPrefix} Error details:`, JSON.stringify(profileError));
      return NextResponse.json({ 
        error: 'Failed to fetch profile', 
        details: profileError.message 
      }, { status: 500 });
    }
    
    console.log(`${logPrefix} Successfully retrieved profile with id=${userProfile.id}, version=${userProfile.version}`);

    return NextResponse.json({ 
      profile: userProfile.profile_data,
      version: userProfile.version,
      lastUpdated: userProfile.updated_at,
      lastAnalyzed: userProfile.last_analyzed_timestamp
    });
  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[USER-PROFILE-UPDATE-${requestId}]`;

  try {
    // Parse request body
    const requestData = await req.json();
    const { userId } = requestData;
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log(`${logPrefix} Triggering profile update for user ${userId}`);
    
    // Check if a profile already exists for this user
    const { data: existingProfile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('id, version')
      .eq('user_id', userId)
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error(`${logPrefix} Error checking existing profile:`, fetchError);
      return NextResponse.json({
        error: 'Failed to check existing profile',
        details: fetchError.message
      }, { status: 500 });
    }
    
    // Initialize variables for the response
    let profileId: string;
    let newVersion: number;
    let operation: string;
    
    // Insert or update the user profile
    if (!existingProfile) {
      // Create a new profile
      const { data: newProfile, error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          profile_data: {},
          version: 1,
          last_analyzed_timestamp: new Date().toISOString()
        })
        .select('id, version')
        .single();
      
      if (insertError) {
        console.error(`${logPrefix} Error creating new profile:`, insertError);
        return NextResponse.json({
          error: 'Failed to create user profile',
          details: insertError.message
        }, { status: 500 });
      }
      
      profileId = newProfile.id;
      newVersion = newProfile.version;
      operation = 'created';
    } else {
      // Profile exists, just update the timestamp to trigger analysis
      profileId = existingProfile.id;
      newVersion = existingProfile.version;
      operation = 'update_triggered';
      
      // Update the last_analyzed_timestamp to indicate an analysis should be performed
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          last_analyzed_timestamp: new Date().toISOString()
        })
        .eq('id', profileId);
      
      if (updateError) {
        console.error(`${logPrefix} Error updating profile timestamp:`, updateError);
        return NextResponse.json({
          error: 'Failed to update profile timestamp',
          details: updateError.message
        }, { status: 500 });
      }
    }
    
    // In a production environment, this would trigger a background job to update the profile
    // For now, we'll just return success and implement the background job later
    
    return NextResponse.json({
      success: true,
      message: `Profile ${operation} successfully`,
      profileId,
      version: newVersion
    });
  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return NextResponse.json({
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}