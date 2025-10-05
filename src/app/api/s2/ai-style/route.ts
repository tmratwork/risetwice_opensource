// src/app/api/s2/ai-style/route.ts
// Save AI style configuration to S2

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface AIStyleRequest {
  userId: string; // Firebase UID
  therapeuticModalities: {
    cognitive_behavioral: number;
    person_centered: number;
    psychodynamic: number;
    solution_focused: number;
  };
  communicationStyle: {
    friction: number;
    tone: number;
    energyLevel: number;
  };
  openingStatement?: string;
}

export async function POST(request: NextRequest) {
  try {
    const data: AIStyleRequest = await request.json();

    // Validate required fields
    if (!data.userId || !data.therapeuticModalities || !data.communicationStyle) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('[S2] Saving AI style config for user:', data.userId);

    // Get therapist profile first
    const { data: profile, error: profileError } = await supabase
      .from('s2_therapist_profiles')
      .select('id')
      .eq('user_id', data.userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Therapist profile not found. Please complete Step 1 first.' },
        { status: 400 }
      );
    }

    // Validate therapeutic modalities total
    const total = Object.values(data.therapeuticModalities).reduce((sum, val) => sum + val, 0);
    if (total <= 0 || total > 100) {
      return NextResponse.json(
        { error: 'Therapeutic modalities must total between 1-100%' },
        { status: 400 }
      );
    }

    // Validate communication style ranges
    const { friction, tone, energyLevel } = data.communicationStyle;
    if ([friction, tone, energyLevel].some(val => val < 0 || val > 100)) {
      return NextResponse.json(
        { error: 'Communication style values must be between 0-100' },
        { status: 400 }
      );
    }

    // Insert AI style config
    const { data: aiStyle, error } = await supabase
      .from('s2_ai_style_configs')
      .insert({
        therapist_profile_id: profile.id,
        cognitive_behavioral: data.therapeuticModalities.cognitive_behavioral,
        person_centered: data.therapeuticModalities.person_centered,
        psychodynamic: data.therapeuticModalities.psychodynamic,
        solution_focused: data.therapeuticModalities.solution_focused,
        friction: friction,
        tone: tone,
        energy_level: energyLevel,
        opening_statement: data.openingStatement || null
      })
      .select()
      .single();

    if (error) {
      console.error('[S2] Error saving AI style config:', error);
      return NextResponse.json(
        { error: 'Failed to save AI style configuration', details: error.message },
        { status: 500 }
      );
    }

    console.log('[S2] ✅ AI style config saved:', aiStyle.id);

    return NextResponse.json({
      success: true,
      aiStyleConfig: {
        id: aiStyle.id,
        therapistProfileId: aiStyle.therapist_profile_id,
        therapeuticModalities: {
          cognitive_behavioral: aiStyle.cognitive_behavioral,
          person_centered: aiStyle.person_centered,
          psychodynamic: aiStyle.psychodynamic,
          solution_focused: aiStyle.solution_focused
        },
        communicationStyle: {
          friction: aiStyle.friction,
          tone: aiStyle.tone,
          energyLevel: aiStyle.energy_level
        },
        openingStatement: aiStyle.opening_statement,
        isValid: aiStyle.is_valid,
        createdAt: aiStyle.created_at
      }
    });

  } catch (error) {
    console.error('[S2] Error in AI style API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter required' },
        { status: 400 }
      );
    }

    // Get latest AI style config for this user
    const { data, error } = await supabase
      .from('s2_ai_style_configs')
      .select(`
        id,
        cognitive_behavioral,
        person_centered,
        psychodynamic,
        solution_focused,
        friction,
        tone,
        energy_level,
        opening_statement,
        is_valid,
        created_at,
        therapist_profile_id,
        s2_therapist_profiles!inner(user_id)
      `)
      .eq('s2_therapist_profiles.user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found is OK
      console.error('[S2] Error fetching AI style config:', error);
      return NextResponse.json(
        { error: 'Failed to fetch AI style configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      aiStyleConfig: data ? {
        id: data.id,
        therapistProfileId: data.therapist_profile_id,
        therapeuticModalities: {
          cognitive_behavioral: data.cognitive_behavioral,
          person_centered: data.person_centered,
          psychodynamic: data.psychodynamic,
          solution_focused: data.solution_focused
        },
        communicationStyle: {
          friction: data.friction,
          tone: data.tone,
          energyLevel: data.energy_level
        },
        openingStatement: data.opening_statement,
        isValid: data.is_valid,
        createdAt: data.created_at
      } : null
    });

  } catch (error) {
    console.error('[S2] Error in AI style GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}