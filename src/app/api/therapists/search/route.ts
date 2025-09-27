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

    // Build base query for therapist profiles first
    let therapistQuery = supabase
      .from('s2_therapist_profiles')
      .select('*')
      .eq('is_active', true);

    // Apply filters to therapist table
    if (query) {
      therapistQuery = therapistQuery.or(
        `full_name.ilike.%${query}%,primary_location.ilike.%${query}%`
      );
    }

    if (location) {
      therapistQuery = therapistQuery.ilike('primary_location', `%${location}%`);
    }

    if (title) {
      therapistQuery = therapistQuery.eq('title', title);
    }

    if (gender) {
      therapistQuery = therapistQuery.eq('gender_identity', gender);
    }

    if (experience) {
      therapistQuery = therapistQuery.eq('years_of_experience', experience);
    }

    if (language) {
      therapistQuery = therapistQuery.contains('languages_spoken', [language]);
    }

    // If no search query or filters, show recent therapists (browse mode)
    const hasBrowseMode = !query && !specialty && !title && !gender && !experience && !language && !location;
    if (hasBrowseMode) {
      console.log('[Therapist Search] Browse mode: showing recent therapists');
      therapistQuery = therapistQuery
        .order('created_at', { ascending: false })
        .limit(20);
    }

    const { data: therapistProfiles, error: therapistError } = await therapistQuery;

    if (therapistError) {
      console.error('[Therapist Search] Therapist query error:', therapistError);
      return NextResponse.json(
        { error: 'Failed to fetch therapists', details: therapistError.message },
        { status: 500 }
      );
    }

    if (!therapistProfiles || therapistProfiles.length === 0) {
      return NextResponse.json({
        success: true,
        therapists: [],
        total: 0
      });
    }

    // Get user IDs from therapist profiles
    const userIds = therapistProfiles.map(profile => profile.user_id);

    // Fetch complete profiles for these users
    const { data: completeProfiles, error: completeError } = await supabase
      .from('s2_complete_profiles')
      .select('*')
      .in('user_id', userIds)
      .eq('is_active', true);

    if (completeError) {
      console.error('[Therapist Search] Complete profiles error:', completeError);
      return NextResponse.json(
        { error: 'Failed to fetch complete profiles', details: completeError.message },
        { status: 500 }
      );
    }

    // Create a map for easy lookup
    const completeProfileMap = new Map();
    (completeProfiles || []).forEach(profile => {
      completeProfileMap.set(profile.user_id, profile);
    });

    // Combine the data
    const therapists = therapistProfiles
      .map(therapist => {
        const completeProfile = completeProfileMap.get(therapist.user_id);
        if (!completeProfile) {
          console.warn(`[Therapist Search] No complete profile found for user_id: ${therapist.user_id}`);
          return null;
        }
        return { ...therapist, s2_complete_profiles: [completeProfile] };
      })
      .filter(Boolean); // Remove null entries

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