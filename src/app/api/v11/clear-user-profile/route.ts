/**
 * API endpoint for clearing a user's profile data (what the AI remembers)
 * Supports two modes:
 * 1. Clear only the profile content (soft reset)
 * 2. Clear profile and processed conversations tracking (full reset)
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[CLEAR-PROFILE-${requestId}]`;

  try {
    // Parse request body
    const { userId, resetTracker = false } = await req.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log(`${logPrefix} Starting profile clear for user ${userId}, resetTracker=${resetTracker}`);
    
    // First, fetch the current profile to verify it exists
    const { data: currentProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, version')
      .eq('user_id', userId)
      .single();
    
    if (profileError) {
      // If no profile found, return 404
      if (profileError.code === 'PGRST116') {
        return NextResponse.json({
          error: 'No profile found for this user',
          message: 'There is no profile to clear'
        }, { status: 404 });
      }
      
      console.error(`${logPrefix} Error fetching profile:`, profileError);
      return NextResponse.json({ 
        error: 'Failed to fetch profile', 
        details: profileError.message 
      }, { status: 500 });
    }
    
    // Perform a soft reset - keep the profile record but clear the content
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        profile_data: {}, // Empty object - AI remembers nothing
        version: currentProfile.version + 1, // Increment version
        last_analyzed_timestamp: new Date().toISOString()
      })
      .eq('user_id', userId);
    
    if (updateError) {
      console.error(`${logPrefix} Error clearing profile data:`, updateError);
      return NextResponse.json({ 
        error: 'Failed to clear profile data', 
        details: updateError.message 
      }, { status: 500 });
    }
    
    // If resetTracker is true, also clear the processed conversations tracking
    if (resetTracker) {
      console.log(`${logPrefix} Clearing processed conversations tracking for user ${userId}`);
      
      const { error: deleteError } = await supabase
        .from('processed_conversations')
        .delete()
        .eq('user_id', userId);
      
      if (deleteError) {
        console.error(`${logPrefix} Error clearing conversation tracking:`, deleteError);
        // Continue anyway - we've cleared the profile which is the primary goal
        // Just note the error in the response
        return NextResponse.json({
          success: true,
          message: 'Profile cleared but conversation tracking reset failed',
          details: deleteError.message,
          version: currentProfile.version + 1
        });
      }
      
      // Also clear any conversation analyses
      const { error: analysesError } = await supabase
        .from('conversation_analyses')
        .delete()
        .eq('user_id', userId);
      
      if (analysesError) {
        console.error(`${logPrefix} Error clearing conversation analyses:`, analysesError);
        // Continue anyway - this is a secondary goal
      }
      
      console.log(`${logPrefix} Successfully cleared profile and reset conversation tracking for user ${userId}`);
      
      return NextResponse.json({
        success: true,
        message: 'Profile and conversation tracking fully reset',
        version: currentProfile.version + 1,
        fullReset: true
      });
    }
    
    console.log(`${logPrefix} Successfully cleared profile data for user ${userId}`);
    
    return NextResponse.json({
      success: true,
      message: 'Profile data cleared successfully',
      version: currentProfile.version + 1,
      fullReset: false
    });
  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}