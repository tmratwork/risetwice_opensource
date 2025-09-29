// src/app/api/voice-settings/provider/route.ts
// API endpoints for provider voice settings (full advanced settings)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface ProviderVoiceSettings {
  speed: number;
  stability: number;
  similarity: number;
  style: number;
  speaker_boost: boolean;
  model_family: string;
  language: string;
}

/**
 * GET - Load provider's voice settings for their AI Preview
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

    console.log('[Provider Voice Settings] Loading settings for user:', userId);

    // Get the provider's AI therapist prompt and voice settings
    const { data, error } = await supabase
      .from('s2_therapist_profiles')
      .select(`
        s2_ai_therapist_prompts!therapist_profile_id(
          voice_settings
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('[Provider Voice Settings] Database error:', error);

      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'No AI Preview found for this provider' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to load voice settings' },
        { status: 500 }
      );
    }

    const voiceSettings = data?.s2_ai_therapist_prompts?.[0]?.voice_settings;

    // Return default settings if none saved
    const defaultSettings: ProviderVoiceSettings = {
      speed: 1.0,
      stability: 0.8,
      similarity: 0.75,
      style: 0.5,
      speaker_boost: false,
      model_family: 'eleven_turbo_v2_5',
      language: 'en'
    };

    return NextResponse.json({
      success: true,
      settings: voiceSettings || defaultSettings
    });

  } catch (error) {
    console.error('[Provider Voice Settings] API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Save provider's voice settings for their AI Preview
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, settings } = await request.json();

    if (!userId || !settings) {
      return NextResponse.json(
        { error: 'userId and settings are required' },
        { status: 400 }
      );
    }

    console.log('[Provider Voice Settings] Saving settings for user:', userId, settings);

    // First, get the provider's therapist profile ID
    const { data: profileData, error: profileError } = await supabase
      .from('s2_therapist_profiles')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (profileError || !profileData) {
      console.error('[Provider Voice Settings] No therapist profile found:', profileError);
      return NextResponse.json(
        { error: 'No AI Preview found for this provider' },
        { status: 404 }
      );
    }

    // Update the voice settings in the AI therapist prompts table
    const { error: updateError } = await supabase
      .from('s2_ai_therapist_prompts')
      .update({
        voice_settings: settings,
        updated_at: new Date().toISOString()
      })
      .eq('therapist_profile_id', profileData.id);

    if (updateError) {
      console.error('[Provider Voice Settings] Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to save voice settings' },
        { status: 500 }
      );
    }

    console.log('[Provider Voice Settings] ✅ Settings saved successfully');

    return NextResponse.json({
      success: true,
      message: 'Voice settings saved successfully'
    });

  } catch (error) {
    console.error('[Provider Voice Settings] API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}