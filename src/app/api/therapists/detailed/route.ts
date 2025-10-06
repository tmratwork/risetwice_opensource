import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use service role key for backend operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const { therapistId } = await request.json();

    if (!therapistId) {
      return NextResponse.json(
        { success: false, error: 'Therapist ID is required' },
        { status: 400 }
      );
    }

    // Fetch basic therapist profile data from s2_therapist_profiles
    const { data: basicProfile, error: basicError } = await supabase
      .from('s2_therapist_profiles')
      .select(`
        *
      `)
      .eq('id', therapistId)
      .single();

    if (basicError) {
      console.error('[DetailedAPI] Error fetching basic profile:', basicError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch therapist basic profile' },
        { status: 500 }
      );
    }

    // Fetch complete profile data from s2_complete_profiles using therapist_profile_id
    const { data: completeProfile, error: completeError } = await supabase
      .from('s2_complete_profiles')
      .select(`
        *
      `)
      .eq('therapist_profile_id', therapistId)
      .single();

    // Complete profile is optional - some therapists may not have completed S2 intake
    if (completeError && completeError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('[DetailedAPI] Error fetching complete profile:', completeError);
    }

    // Merge the data from both tables into a comprehensive therapist object
    // Use other_title if title is "Other" and other_title exists
    const displayTitle = basicProfile.title === 'Other' && basicProfile.other_title
      ? basicProfile.other_title
      : basicProfile.title;

    const detailedTherapist = {
      // From s2_therapist_profiles (basic info)
      id: basicProfile.id,
      fullName: basicProfile.full_name,
      title: displayTitle,
      degrees: basicProfile.degrees,
      primaryLocation: basicProfile.primary_location,
      offersOnline: basicProfile.offers_online,
      phoneNumber: basicProfile.phone_number,
      emailAddress: basicProfile.email_address,
      dateOfBirth: basicProfile.date_of_birth,
      clonedVoiceId: basicProfile.cloned_voice_id,
      genderIdentity: basicProfile.gender_identity,
      yearsOfExperience: basicProfile.years_of_experience,
      languagesSpoken: basicProfile.languages_spoken,
      culturalBackgrounds: basicProfile.cultural_backgrounds,
      otherDegree: basicProfile.other_degree,
      otherTitle: basicProfile.other_title,
      otherLanguage: basicProfile.other_language,
      otherCulturalBackground: basicProfile.other_cultural_background,

      // From s2_complete_profiles (detailed intake data) - only if available
      ...(completeProfile && {
        profilePhotoUrl: completeProfile.profile_photo_url,
        personalStatement: completeProfile.personal_statement,
        mentalHealthSpecialties: completeProfile.mental_health_specialties,
        treatmentApproaches: completeProfile.treatment_approaches,
        ageRangesTreated: completeProfile.age_ranges_treated,
        practiceType: completeProfile.practice_type,
        sessionLength: completeProfile.session_length,
        availabilityHours: completeProfile.availability_hours,
        emergencyProtocol: completeProfile.emergency_protocol,
        acceptsInsurance: completeProfile.accepts_insurance,
        insurancePlans: completeProfile.insurance_plans,
        outOfNetworkSupported: completeProfile.out_of_network_supported,
        clientTypesServed: completeProfile.client_types_served,
        lgbtqAffirming: completeProfile.lgbtq_affirming,
        religiousSpiritualIntegration: completeProfile.religious_spiritual_integration,
        sessionFees: completeProfile.session_fees,
        boardCertifications: completeProfile.board_certifications,
        professionalMemberships: completeProfile.professional_memberships,
        otherMentalHealthSpecialty: completeProfile.other_mental_health_specialty,
        otherTreatmentApproach: completeProfile.other_treatment_approach,
        otherReligiousSpiritualIntegration: completeProfile.other_religious_spiritual_integration,
        otherBoardCertification: completeProfile.other_board_certification,
        otherProfessionalMembership: completeProfile.other_professional_membership
      })
    };

    console.log('[DetailedAPI] ✅ Detailed therapist data loaded:', {
      name: detailedTherapist.fullName,
      hasCompleteProfile: !!completeProfile,
      specialtiesCount: detailedTherapist.mentalHealthSpecialties?.length || 0,
      approachesCount: detailedTherapist.treatmentApproaches?.length || 0
    });

    return NextResponse.json({
      success: true,
      therapist: detailedTherapist
    });

  } catch (error) {
    console.error('[DetailedAPI] ❌ Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}