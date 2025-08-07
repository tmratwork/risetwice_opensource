/**
 * API endpoint for managing user privacy settings for insights
 * Supports both retrieving and updating privacy settings in a trauma-informed way
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[PRIVACY-GET-${requestId}]`;

  try {
    // Get the user from server session or auth
    // This is a simplified example - replace with your actual auth logic
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    // Get userId directly from URL parameter
    const url = new URL(req.url);
    userId = url.searchParams.get('userId');

    // If no userId in URL, log warning - auth header should not be used as userId
    if (!userId && authHeader) {
      console.log(`${logPrefix} Warning: No userId provided in URL parameters, auth header present but not parsed`);
    }

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log(`${logPrefix} Fetching privacy settings for user ${userId}`);

    // Fetch user's privacy settings
    const { data: settings, error } = await supabase
      .from('user_privacy_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If no settings found, return defaults
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          settings: {
            insights_opt_in: false,
            insights_categories: [],
            summary_sheet_opt_in: false,
            allow_staff_view: false
          },
          message: 'No privacy settings found. Using defaults.'
        }, { status: 404 });
      }

      console.error(`${logPrefix} Error fetching privacy settings:`, error);
      return NextResponse.json({
        error: 'Failed to fetch privacy settings',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({ settings });
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
  const logPrefix = `[PRIVACY-POST-${requestId}]`;

  try {
    const body = await req.json();
    const { settings } = body;

    // Basic validation
    if (!settings) {
      return NextResponse.json({ error: 'Settings object is required' }, { status: 400 });
    }

    // Get the user ID from request body
    const userId: string | null = settings.user_id || null;

    // If no userId in body, log warning - auth header should not be used as userId
    const authHeader = req.headers.get('authorization');
    if (!userId && authHeader) {
      console.log(`${logPrefix} Warning: No userId provided in request body, auth header present but not parsed`);
    }

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log(`${logPrefix} Updating privacy settings for user ${userId}`);

    // Check if settings already exist
    const { data: existingSettings, error: checkError } = await supabase
      .from('user_privacy_settings')
      .select('id')
      .eq('user_id', userId)
      .single();

    let result;

    if (checkError && checkError.code !== 'PGRST116') {
      console.error(`${logPrefix} Error checking existing settings:`, checkError);
      return NextResponse.json({
        error: 'Failed to check existing settings',
        details: checkError.message
      }, { status: 500 });
    }

    // Prepare settings object with user ID
    const updatedSettings = {
      user_id: userId,
      insights_opt_in: settings.insights_opt_in || false,
      insights_categories: settings.insights_categories || [],
      summary_sheet_opt_in: settings.summary_sheet_opt_in || false,
      allow_staff_view: settings.allow_staff_view || false,
      updated_at: new Date()
    };

    // Update or insert as needed
    if (existingSettings) {
      // Update existing settings
      const { data, error: updateError } = await supabase
        .from('user_privacy_settings')
        .update(updatedSettings)
        .eq('user_id', userId)
        .select()
        .single();

      if (updateError) {
        console.error(`${logPrefix} Error updating privacy settings:`, updateError);
        return NextResponse.json({
          error: 'Failed to update privacy settings',
          details: updateError.message
        }, { status: 500 });
      }

      result = data;
    } else {
      // Insert new settings
      const { data, error: insertError } = await supabase
        .from('user_privacy_settings')
        .insert({
          ...updatedSettings,
          created_at: new Date()
        })
        .select()
        .single();

      if (insertError) {
        console.error(`${logPrefix} Error creating privacy settings:`, insertError);
        return NextResponse.json({
          error: 'Failed to create privacy settings',
          details: insertError.message
        }, { status: 500 });
      }

      result = data;
    }

    return NextResponse.json({
      success: true,
      settings: result
    });
  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}