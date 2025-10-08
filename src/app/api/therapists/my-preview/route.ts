// src/app/api/therapists/my-preview/route.ts
// API endpoint for fetching the current user's own AI Preview

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    console.log('[My Preview] Fetching AI Preview for user:', userId);

    // Query for the user's therapist profile and AI prompts
    const { data: therapist, error } = await supabase
      .from('s2_therapist_profiles')
      .select(`
        id,
        user_id,
        full_name,
        title,
        other_title,
        degrees,
        primary_location,
        gender_identity,
        years_of_experience,
        languages_spoken,
        cloned_voice_id,
        created_at,
        s2_complete_profiles!fk_therapist_profile(
          profile_photo_url,
          personal_statement,
          mental_health_specialties,
          treatment_approaches,
          age_ranges_treated,
          lgbtq_affirming,
          session_fees
        ),
        s2_ai_therapist_prompts!therapist_profile_id(
          id,
          prompt_text,
          prompt_title,
          status,
          is_public
        ),
        s2_ai_style_configs!s2_ai_style_configs_therapist_profile_id_fkey(
          opening_statement
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('[My Preview] Database error:', error);

      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'No AI Preview found. Please complete your provider setup first.' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to fetch AI Preview', details: error.message },
        { status: 500 }
      );
    }

    if (!therapist) {
      return NextResponse.json(
        { error: 'No AI Preview found. Please complete your provider setup first.' },
        { status: 404 }
      );
    }

    // Transform the data to match our frontend interface
    const completeProfile = therapist.s2_complete_profiles?.[0] || {};
    const aiPrompt = therapist.s2_ai_therapist_prompts?.[0] || {};
    const aiStyleConfig = therapist.s2_ai_style_configs?.[0] || {};

    // Use other_title if title is "Other" and other_title exists
    const displayTitle = therapist.title === 'Other' && therapist.other_title
      ? therapist.other_title
      : therapist.title;

    const transformedTherapist = {
      id: therapist.id,
      userId: therapist.user_id, // Firebase UID for analytics
      fullName: therapist.full_name,
      title: displayTitle,
      degrees: therapist.degrees || [],
      primaryLocation: therapist.primary_location,
      genderIdentity: therapist.gender_identity,
      yearsOfExperience: therapist.years_of_experience,
      languagesSpoken: therapist.languages_spoken || [],
      clonedVoiceId: therapist.cloned_voice_id,
      profilePhotoUrl: completeProfile.profile_photo_url,
      personalStatement: completeProfile.personal_statement,
      mentalHealthSpecialties: completeProfile.mental_health_specialties || [],
      treatmentApproaches: completeProfile.treatment_approaches || [],
      ageRangesTreated: completeProfile.age_ranges_treated || [],
      lgbtqAffirming: completeProfile.lgbtq_affirming,
      sessionFees: completeProfile.session_fees,
      openingStatement: aiStyleConfig.opening_statement,
      // AI Preview specific data
      aiPrompt: {
        id: aiPrompt.id,
        text: aiPrompt.prompt_text,
        title: aiPrompt.prompt_title,
        status: aiPrompt.status,
        isPublic: aiPrompt.is_public
      }
    };

    console.log(`[My Preview] Found AI Preview for ${therapist.full_name}`);

    return NextResponse.json({
      success: true,
      therapist: transformedTherapist
    });

  } catch (error) {
    console.error('[My Preview] API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}