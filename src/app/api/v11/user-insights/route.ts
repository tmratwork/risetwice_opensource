/**
 * API endpoint for retrieving user insights
 * Returns previously generated insights for a user
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[INSIGHTS-GET-${requestId}]`;

  try {
    // Get the user ID from authentication or query params
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    const url = new URL(req.url);
    const bypassOptIn = url.searchParams.get('bypassOptIn') === 'true';
    
    // Get the userId directly from the URL parameter
    userId = url.searchParams.get('userId');
    
    // If no userId in URL, log warning - auth header should not be used as userId
    if (!userId && authHeader) {
      console.log(`${logPrefix} Warning: No userId provided in URL parameters, auth header present but not parsed`);
    }

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log(`${logPrefix} Fetching insights for user ${userId}`);

    // First, check if the user has opted in to insights
    const { data: privacySettings, error: privacyError } = await supabase
      .from('user_privacy_settings')
      .select('insights_opt_in, insights_categories')
      .eq('user_id', userId)
      .single();

    if (privacyError && privacyError.code !== 'PGRST116') {
      console.error(`${logPrefix} Error fetching privacy settings:`, privacyError);
      return NextResponse.json({ 
        error: 'Failed to verify privacy settings', 
        details: privacyError.message 
      }, { status: 500 });
    }

    // If no privacy settings or user hasn't opted in, still allow retrieval of existing insights
    // but flag that the user needs to opt in for new generation
    let requiresOptIn = false;
    if (!privacySettings || !privacySettings.insights_opt_in) {
      // Check if we should bypass opt-in check to simply retrieve existing insights
      if (bypassOptIn) {
        console.log(`${logPrefix} Bypassing opt-in check to retrieve existing insights for user ${userId}`);
        // Continue to fetch insights with bypassOptIn flag
      } else {
        console.log(`${logPrefix} User has not opted in to insights analysis, but checking for existing insights`);
        requiresOptIn = true;
      }
      // We'll continue to fetch insights, but mark that opt-in is required for new generation
    }

    // Log the actual user ID we're using to query
    console.log(`${logPrefix} Attempting to fetch insights with user_id=${userId}`);

    // DEBUGGING STEP 1: Try fetching all insights without any filtering
    const { data: allInsights } = await supabase
      .from('user_insights')
      .select('id, user_id, generated_at')
      .limit(10);
    
    console.log(`${logPrefix} All insights (up to 10 records):`, allInsights);
    
    // Fetch insights for this specific user only
    const { data: userInsights, error: insightsError } = await supabase
      .from('user_insights')
      .select('*')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (insightsError) {
      // If no insights found, return 404
      if (insightsError.code === 'PGRST116') {
        console.log(`${logPrefix} No insights found with exact userId match, trying different approach`);
        
        // No fuzzy matching - we should only return insights belonging to this user
        console.log(`${logPrefix} No insights found for user ${userId}`);
        // Leave this empty to continue to the 404 response
        
        return NextResponse.json({
          error: 'No insights found for this user',
          message: 'No insights have been generated yet'
        }, { status: 404 });
      }
      
      console.error(`${logPrefix} Error fetching insights:`, insightsError);
      return NextResponse.json({ 
        error: 'Failed to fetch insights', 
        details: insightsError.message 
      }, { status: 500 });
    }

    // Filter insights based on user's privacy selections
    const allowedCategories = privacySettings?.insights_categories || [];
    const filteredInsights = { ...userInsights };

    // If insights exists, filter them based on user's consented categories
    if (filteredInsights && filteredInsights.insights) {
      Object.keys(filteredInsights.insights).forEach(key => {
        if (!allowedCategories.includes(key.replace('s', ''))) {
          filteredInsights.insights[key] = [];
        }
      });
    }

    return NextResponse.json({ 
      insights: filteredInsights,
      categories: allowedCategories,
      requiresOptIn // Include flag so frontend knows user needs to opt in for new insights
    });
  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}