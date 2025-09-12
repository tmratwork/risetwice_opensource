// src/app/api/s2/patient-description/route.ts
// Save patient description to S2

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface PatientDescriptionRequest {
  userId: string; // Firebase UID
  description: string;
}

export async function POST(request: NextRequest) {
  try {
    const data: PatientDescriptionRequest = await request.json();

    // Validate required fields
    if (!data.userId || !data.description?.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('[S2] Saving patient description for user:', data.userId);

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

    // Auto-detect scenario type based on keywords
    const detectScenarioType = (description: string): string => {
      const desc = description.toLowerCase();
      if (desc.includes('depress') || desc.includes('sad') || desc.includes('empty')) return 'depression';
      if (desc.includes('trauma') || desc.includes('ptsd') || desc.includes('abuse')) return 'trauma';
      if (desc.includes('relationship') || desc.includes('marriage') || desc.includes('couple')) return 'relationships';
      if (desc.includes('anxiet') || desc.includes('worry') || desc.includes('panic')) return 'anxiety';
      return 'general';
    };

    const scenarioType = detectScenarioType(data.description);
    const characterCount = data.description.length;

    // Insert patient description
    const { data: patientDesc, error } = await supabase
      .from('s2_patient_descriptions')
      .insert({
        therapist_profile_id: profile.id,
        description: data.description.trim(),
        character_count: characterCount,
        scenario_type: scenarioType
      })
      .select()
      .single();

    if (error) {
      console.error('[S2] Error saving patient description:', error);
      return NextResponse.json(
        { error: 'Failed to save patient description', details: error.message },
        { status: 500 }
      );
    }

    console.log('[S2] ✅ Patient description saved:', patientDesc.id);

    return NextResponse.json({
      success: true,
      patientDescription: {
        id: patientDesc.id,
        therapistProfileId: patientDesc.therapist_profile_id,
        description: patientDesc.description,
        characterCount: patientDesc.character_count,
        scenarioType: patientDesc.scenario_type,
        createdAt: patientDesc.created_at
      }
    });

  } catch (error) {
    console.error('[S2] Error in patient description API:', error);
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

    // Get latest patient description for this user
    const { data, error } = await supabase
      .from('s2_patient_descriptions')
      .select(`
        id,
        description,
        character_count,
        scenario_type,
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
      console.error('[S2] Error fetching patient description:', error);
      return NextResponse.json(
        { error: 'Failed to fetch patient description' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      patientDescription: data ? {
        id: data.id,
        therapistProfileId: data.therapist_profile_id,
        description: data.description,
        characterCount: data.character_count,
        scenarioType: data.scenario_type,
        createdAt: data.created_at
      } : null
    });

  } catch (error) {
    console.error('[S2] Error in patient description GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}