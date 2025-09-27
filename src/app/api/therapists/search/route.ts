// src/app/api/therapists/search/route.ts
// API endpoint for searching and filtering therapists

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
        created_at,
        s2_complete_profiles!fk_therapist_profile(
          profile_photo_url,
          personal_statement,
          mental_health_specialties,
          treatment_approaches,
          age_ranges_treated,
          lgbtq_affirming,
          session_fees
        )
      `)
      .eq('is_active', true)
      .eq('s2_complete_profiles.is_active', true);

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
    const transformedTherapists = therapists.map((therapist: any) => {
      const completeProfile = therapist.s2_complete_profiles?.[0] || {};

      return {
        id: therapist.id,
        fullName: therapist.full_name,
        title: therapist.title,
        degrees: therapist.degrees || [],
        primaryLocation: therapist.primary_location,
        genderIdentity: therapist.gender_identity,
        yearsOfExperience: therapist.years_of_experience,
        languagesSpoken: therapist.languages_spoken || [],
        profilePhotoUrl: completeProfile.profile_photo_url,
        personalStatement: completeProfile.personal_statement,
        mentalHealthSpecialties: completeProfile.mental_health_specialties || [],
        treatmentApproaches: completeProfile.treatment_approaches || [],
        ageRangesTreated: completeProfile.age_ranges_treated || [],
        lgbtqAffirming: completeProfile.lgbtq_affirming,
        sessionFees: completeProfile.session_fees
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