// src/app/api/s2/complete-profile/route.ts
// Save/update complete profile data to S2

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CompleteProfileRequest {
  userId: string; // Firebase UID
  profilePhoto?: string;
  personalStatement: string;
  mentalHealthSpecialties: string[];
  treatmentApproaches: string[];
  ageRangesTreated: string[];
  practiceDetails: {
    practiceType: string;
    sessionLength: string;
    availabilityHours: string;
    emergencyProtocol: string;
  };
  insuranceInformation: {
    acceptsInsurance: boolean;
    insurancePlans: string[];
    outOfNetworkSupported: boolean;
  };
}

export async function POST(request: NextRequest) {
  try {
    const data: CompleteProfileRequest = await request.json();

    // Validate required fields
    if (!data.userId || !data.personalStatement || !data.mentalHealthSpecialties?.length || 
        !data.treatmentApproaches?.length || !data.ageRangesTreated?.length || 
        !data.practiceDetails?.practiceType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate personal statement length
    if (data.personalStatement.length < 100) {
      return NextResponse.json(
        { error: 'Personal statement must be at least 100 characters' },
        { status: 400 }
      );
    }

    console.log('[S2] Creating/updating complete profile for user:', data.userId);

    // First, deactivate any existing active complete profile for this user
    await supabase
      .from('s2_complete_profiles')
      .update({ is_active: false })
      .eq('user_id', data.userId)
      .eq('is_active', true);

    // Insert new complete profile
    const { data: profileData, error } = await supabase
      .from('s2_complete_profiles')
      .insert({
        user_id: data.userId,
        profile_photo_url: data.profilePhoto || null,
        personal_statement: data.personalStatement,
        mental_health_specialties: data.mentalHealthSpecialties,
        treatment_approaches: data.treatmentApproaches,
        age_ranges_treated: data.ageRangesTreated,
        practice_type: data.practiceDetails.practiceType,
        session_length: data.practiceDetails.sessionLength || null,
        availability_hours: data.practiceDetails.availabilityHours || null,
        emergency_protocol: data.practiceDetails.emergencyProtocol || null,
        accepts_insurance: data.insuranceInformation.acceptsInsurance,
        insurance_plans: data.insuranceInformation.insurancePlans,
        out_of_network_supported: data.insuranceInformation.outOfNetworkSupported,
        is_active: true,
        completion_date: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('[S2] Error saving complete profile:', error);
      return NextResponse.json(
        { error: 'Failed to save complete profile', details: error.message },
        { status: 500 }
      );
    }

    console.log('[S2] ✅ Complete profile saved:', profileData.id);

    return NextResponse.json({
      success: true,
      completeProfile: {
        id: profileData.id,
        userId: profileData.user_id,
        profilePhoto: profileData.profile_photo_url,
        personalStatement: profileData.personal_statement,
        mentalHealthSpecialties: profileData.mental_health_specialties,
        treatmentApproaches: profileData.treatment_approaches,
        ageRangesTreated: profileData.age_ranges_treated,
        practiceDetails: {
          practiceType: profileData.practice_type,
          sessionLength: profileData.session_length,
          availabilityHours: profileData.availability_hours,
          emergencyProtocol: profileData.emergency_protocol
        },
        insuranceInformation: {
          acceptsInsurance: profileData.accepts_insurance,
          insurancePlans: profileData.insurance_plans,
          outOfNetworkSupported: profileData.out_of_network_supported
        },
        completionDate: profileData.completion_date,
        createdAt: profileData.created_at,
        updatedAt: profileData.updated_at
      }
    });

  } catch (error) {
    console.error('[S2] Error in complete profile API:', error);
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

    const { data: profileData, error } = await supabase
      .from('s2_complete_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found is OK
      console.error('[S2] Error fetching complete profile:', error);
      return NextResponse.json(
        { error: 'Failed to fetch complete profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      completeProfile: profileData ? {
        id: profileData.id,
        userId: profileData.user_id,
        profilePhoto: profileData.profile_photo_url,
        personalStatement: profileData.personal_statement,
        mentalHealthSpecialties: profileData.mental_health_specialties,
        treatmentApproaches: profileData.treatment_approaches,
        ageRangesTreated: profileData.age_ranges_treated,
        practiceDetails: {
          practiceType: profileData.practice_type,
          sessionLength: profileData.session_length,
          availabilityHours: profileData.availability_hours,
          emergencyProtocol: profileData.emergency_protocol
        },
        insuranceInformation: {
          acceptsInsurance: profileData.accepts_insurance,
          insurancePlans: profileData.insurance_plans,
          outOfNetworkSupported: profileData.out_of_network_supported
        },
        completionDate: profileData.completion_date,
        createdAt: profileData.created_at,
        updatedAt: profileData.updated_at
      } : null
    });

  } catch (error) {
    console.error('[S2] Error in complete profile GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}