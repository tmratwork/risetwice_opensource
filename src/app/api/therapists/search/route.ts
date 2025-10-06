// src/app/api/therapists/search/route.ts
// API endpoint for searching and filtering therapists

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Database result interface
interface DatabaseTherapist {
  id: string;
  full_name: string;
  title: string;
  degrees: string[] | null;
  primary_location: string;
  gender_identity: string;
  years_of_experience: string;
  languages_spoken: string[] | null;
  cloned_voice_id?: string | null;
  s2_complete_profiles?: Array<{
    profile_photo_url?: string;
    personal_statement?: string;
    mental_health_specialties?: string[];
    treatment_approaches?: string[];
    age_ranges_treated?: string[];
    lgbtq_affirming?: boolean;
    session_fees?: string;
  }>;
  s2_ai_style_configs?: Array<{
    opening_statement?: string;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Extract search parameters
    const query = searchParams.get('q') || '';
    const specialty = searchParams.get('specialty');
    const title = searchParams.get('title');
    const gender = searchParams.get('gender');
    const experience = searchParams.get('experience');
    const language = searchParams.get('language');
    const location = searchParams.get('location');

    console.log('[Therapist Search] Query params:', {
      query, specialty, title, gender, experience, language, location
    });

    // Build the query using proper foreign key relationship
    let supabaseQuery = supabase
      .from('s2_therapist_profiles')
      .select(`
        id,
        user_id,
        full_name,
        title,
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
        s2_ai_style_configs!s2_ai_style_configs_therapist_profile_id_fkey(
          opening_statement
        )
      `)
      .eq('is_active', true)
      .eq('s2_complete_profiles.is_active', true)
      .eq('s2_ai_style_configs.is_active', true);

    // Apply filters
    if (query) {
      // Search in name, location, or specialties
      supabaseQuery = supabaseQuery.or(
        `full_name.ilike.%${query}%,primary_location.ilike.%${query}%`
      );
    }

    if (location) {
      supabaseQuery = supabaseQuery.ilike('primary_location', `%${location}%`);
    }

    if (title) {
      supabaseQuery = supabaseQuery.eq('title', title);
    }

    if (gender) {
      supabaseQuery = supabaseQuery.eq('gender_identity', gender);
    }

    if (experience) {
      supabaseQuery = supabaseQuery.eq('years_of_experience', experience);
    }

    if (language) {
      supabaseQuery = supabaseQuery.contains('languages_spoken', [language]);
    }

    // If no search query or filters, show recent therapists (browse mode)
    const hasBrowseMode = !query && !specialty && !title && !gender && !experience && !language && !location;
    if (hasBrowseMode) {
      console.log('[Therapist Search] Browse mode: showing recent therapists');
      supabaseQuery = supabaseQuery
        .order('created_at', { ascending: false })
        .limit(20);
    }

    const { data: therapists, error } = await supabaseQuery;

    if (error) {
      console.error('[Therapist Search] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch therapists', details: error.message },
        { status: 500 }
      );
    }

    // Transform the data to match our frontend interface
    const transformedTherapists = therapists.map((therapist: DatabaseTherapist) => {
      const completeProfile = therapist.s2_complete_profiles?.[0] || {};
      const aiStyleConfig = therapist.s2_ai_style_configs?.[0] || {};

      return {
        id: therapist.id,
        fullName: therapist.full_name,
        title: therapist.title,
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
        openingStatement: aiStyleConfig.opening_statement
      };
    });

    // Apply specialty filter on the transformed data (since it's in the joined table)
    let filteredTherapists = transformedTherapists;
    if (specialty) {
      filteredTherapists = transformedTherapists.filter(therapist =>
        therapist.mentalHealthSpecialties.includes(specialty)
      );
    }

    console.log(`[Therapist Search] Found ${filteredTherapists.length} therapists`);

    return NextResponse.json({
      success: true,
      therapists: filteredTherapists,
      total: filteredTherapists.length
    });

  } catch (error) {
    console.error('[Therapist Search] API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}