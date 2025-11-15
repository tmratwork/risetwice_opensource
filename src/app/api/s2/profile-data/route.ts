// src/app/api/s2/profile-data/route.ts
// API endpoint to fetch all S2 profile data for a user

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  validateProfileStep,
  validateLicenseStep,
  validateCompleteProfileStep
} from '@/utils/s2-validation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Fetch all S2 data for the user in parallel
    const [
      therapistProfileResult,
      patientDescriptionResult,
      aiStyleConfigResult,
      licenseVerificationResult,
      completeProfileResult,
      generatedScenarioResult,
      sessionResult
    ] = await Promise.all([
      // Therapist Profile
      supabase
        .from('s2_therapist_profiles')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),

      // Patient Description (linked to therapist profile)
      supabase
        .from('s2_patient_descriptions')
        .select('*, s2_therapist_profiles!inner(user_id)')
        .eq('s2_therapist_profiles.user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),

      // AI Style Config (linked to therapist profile)
      supabase
        .from('s2_ai_style_configs')
        .select('*, s2_therapist_profiles!inner(user_id)')
        .eq('s2_therapist_profiles.user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),

      // License Verification
      supabase
        .from('s2_license_verifications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),

      // Complete Profile
      supabase
        .from('s2_complete_profiles')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),

      // Generated Scenario (linked to therapist profile)
      supabase
        .from('s2_generated_scenarios')
        .select('*, s2_therapist_profiles!inner(user_id)')
        .eq('s2_therapist_profiles.user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),

      // Session (linked to therapist profile)
      supabase
        .from('s2_case_simulation_sessions')
        .select('*, s2_therapist_profiles!inner(user_id)')
        .eq('s2_therapist_profiles.user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
    ]);

    // Extract data, handling potential errors (missing data is not an error)
    const therapistProfile = therapistProfileResult.error ? null : therapistProfileResult.data;
    const patientDescription = patientDescriptionResult.error ? null : patientDescriptionResult.data;
    const aiStyleConfig = aiStyleConfigResult.error ? null : aiStyleConfigResult.data;
    const licenseVerification = licenseVerificationResult.error ? null : licenseVerificationResult.data;
    const completeProfile = completeProfileResult.error ? null : completeProfileResult.data;
    const generatedScenario = generatedScenarioResult.error ? null : generatedScenarioResult.data;
    const session = sessionResult.error ? null : sessionResult.data;

    // Calculate step completion status
    const stepCompletionStatus = {
      profile: validateProfileStep(therapistProfile),
      licenseVerification: validateLicenseStep(licenseVerification),
      completeProfile: validateCompleteProfileStep(completeProfile),
      notificationPreferences: !!(therapistProfile && (
        therapistProfile.email_notifications !== null ||
        therapistProfile.sms_notifications !== null
      ))
    };

    return NextResponse.json({
      data: {
        therapistProfile,
        patientDescription,
        aiStyleConfig,
        licenseVerification,
        completeProfile,
        generatedScenario,
        session
      },
      stepCompletionStatus,
      success: true
    });

  } catch (error) {
    console.error('Error fetching S2 profile data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile data' },
      { status: 500 }
    );
  }
}

