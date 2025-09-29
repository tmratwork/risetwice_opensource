// src/app/api/voice-settings/patient/route.ts
// API endpoints for patient playback speed settings (limited to speed only)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET - Load patient's playback speed preference
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    console.log('[Patient Voice Settings] Loading playback speed for user:', userId);

    // Get the patient's playback speed preference
    const { data, error } = await supabase
      .from('user_profiles')
      .select('playback_speed')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('[Patient Voice Settings] Database error:', error);

      if (error.code === 'PGRST116') {
        // User profile doesn't exist yet, return default
        return NextResponse.json({
          success: true,
          playbackSpeed: 1.0 // Default speed
        });
      }

      return NextResponse.json(
        { error: 'Failed to load playback speed' },
        { status: 500 }
      );
    }

    const playbackSpeed = data?.playback_speed || 1.0; // Default to 1.0 if null

    return NextResponse.json({
      success: true,
      playbackSpeed
    });

  } catch (error) {
    console.error('[Patient Voice Settings] API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Save patient's playback speed preference
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, playbackSpeed } = await request.json();

    if (!userId || typeof playbackSpeed !== 'number') {
      return NextResponse.json(
        { error: 'userId and playbackSpeed (number) are required' },
        { status: 400 }
      );
    }

    // Validate playback speed range (0.5x to 2.0x seems reasonable)
    if (playbackSpeed < 0.5 || playbackSpeed > 2.0) {
      return NextResponse.json(
        { error: 'Playback speed must be between 0.5 and 2.0' },
        { status: 400 }
      );
    }

    console.log('[Patient Voice Settings] Saving playback speed for user:', userId, playbackSpeed);

    // Upsert the user's playback speed preference
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        playback_speed: playbackSpeed,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('[Patient Voice Settings] Update error:', error);
      return NextResponse.json(
        { error: 'Failed to save playback speed' },
        { status: 500 }
      );
    }

    console.log('[Patient Voice Settings] ✅ Playback speed saved successfully');

    return NextResponse.json({
      success: true,
      message: 'Playback speed saved successfully'
    });

  } catch (error) {
    console.error('[Patient Voice Settings] API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}