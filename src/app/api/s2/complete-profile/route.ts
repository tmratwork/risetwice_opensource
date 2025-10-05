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
  otherMentalHealthSpecialty?: string;
  treatmentApproaches: string[];
  otherTreatmentApproach?: string;
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
  clientTypesServed?: string[];
  lgbtqAffirming?: boolean;
  religiousSpiritualIntegration?: string;
  otherReligiousSpiritualIntegration?: string;
  sessionFees?: string;
  boardCertifications?: string[];
  otherBoardCertification?: string;
  professionalMemberships?: string[];
  otherProfessionalMembership?: string;
}

export async function POST(request: NextRequest) {
  try {
    const data: CompleteProfileRequest = await request.json();
    console.log('[S2] Complete profile request data:', JSON.stringify(data, null, 2));

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

    // Get the therapist profile ID for this user
    const { data: therapistProfile, error: therapistError } = await supabase
      .from('s2_therapist_profiles')
      .select('id')
      .eq('user_id', data.userId)
      .single();

    if (therapistError || !therapistProfile) {
      console.error('[S2] No therapist profile found for user:', data.userId, therapistError);
      return NextResponse.json(
        { error: 'Therapist profile must be created before complete profile' },
        { status: 400 }
      );
    }

    // Check if a complete profile already exists for this therapist
    const { data: existingProfile } = await supabase
      .from('s2_complete_profiles')
      .select('id')
      .eq('therapist_profile_id', therapistProfile.id)
      .eq('is_active', true)
      .single();

    const profilePayload = {
      user_id: data.userId,
      therapist_profile_id: therapistProfile.id,
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
      client_types_served: data.clientTypesServed || null,
      lgbtq_affirming: data.lgbtqAffirming || false,
      religious_spiritual_integration: data.religiousSpiritualIntegration || null,
      session_fees: data.sessionFees || null,
      board_certifications: data.boardCertifications || null,
      professional_memberships: data.professionalMemberships || null,
      other_mental_health_specialty: data.otherMentalHealthSpecialty || null,
      other_treatment_approach: data.otherTreatmentApproach || null,
      other_religious_spiritual_integration: data.otherReligiousSpiritualIntegration || null,
      other_board_certification: data.otherBoardCertification || null,
      other_professional_membership: data.otherProfessionalMembership || null,
      is_active: true,
      completion_date: new Date().toISOString()
    };

    let profileData, error;

    if (existingProfile) {
      // Update existing profile
      const result = await supabase
        .from('s2_complete_profiles')
        .update(profilePayload)
        .eq('id', existingProfile.id)
        .select()
        .single();
      profileData = result.data;
      error = result.error;
    } else {
      // Insert new profile
      const result = await supabase
        .from('s2_complete_profiles')
        .insert(profilePayload)
        .select()
        .single();
      profileData = result.data;
      error = result.error;
    }

    if (error) {
      console.error('[S2] Error saving complete profile:', error);
      console.error('[S2] Error details:', JSON.stringify(error, null, 2));
      return NextResponse.json(
        { error: 'Failed to save complete profile', details: error.message },
        { status: 500 }
      );
    }

    console.log('[S2] ✅ Complete profile saved:', profileData.id);
    console.log('[S2] 📤 Returning therapistProfileId for AI generation:', therapistProfile.id);

    return NextResponse.json({
      success: true,
      therapistProfileId: therapistProfile.id, // Added for AI prompt generation
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
        clientTypesServed: profileData.client_types_served,
        lgbtqAffirming: profileData.lgbtq_affirming,
        religiousSpiritualIntegration: profileData.religious_spiritual_integration,
        sessionFees: profileData.session_fees,
        boardCertifications: profileData.board_certifications,
        professionalMemberships: profileData.professional_memberships,
        otherMentalHealthSpecialty: profileData.other_mental_health_specialty,
        otherTreatmentApproach: profileData.other_treatment_approach,
        otherReligiousSpiritualIntegration: profileData.other_religious_spiritual_integration,
        otherBoardCertification: profileData.other_board_certification,
        otherProfessionalMembership: profileData.other_professional_membership,
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