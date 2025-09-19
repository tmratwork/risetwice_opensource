// src/app/api/admin/s2/therapists/route.ts
// API endpoint to fetch comprehensive therapist data for admin panel

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    console.log('[S2 Admin] Fetching comprehensive therapist data');

    // Fetch all therapist profiles
    const { data: therapistProfiles, error: profilesError } = await supabase
      .from('s2_therapist_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('[S2 Admin] Error fetching therapist profiles:', profilesError);
      return NextResponse.json(
        { error: 'Failed to fetch therapist profiles', details: profilesError.message },
        { status: 500 }
      );
    }

    console.log(`[S2 Admin] Found ${therapistProfiles?.length || 0} therapist profiles`);

    // For each therapist, fetch their complete data from all related tables
    const therapistsWithCompleteData = await Promise.all(
      (therapistProfiles || []).map(async (profile) => {
        const therapistData: Record<string, unknown> = { ...profile };

        // Fetch complete profile data
        const { data: completeProfile } = await supabase
          .from('s2_complete_profiles')
          .select('*')
          .eq('user_id', profile.user_id)
          .single();

        if (completeProfile) {
          therapistData.complete_profile = completeProfile;
        }

        // Fetch AI style configuration
        const { data: aiStyleConfig } = await supabase
          .from('s2_ai_style_configs')
          .select('*')
          .eq('therapist_profile_id', profile.id)
          .eq('is_active', true)
          .single();

        if (aiStyleConfig) {
          therapistData.ai_style_config = aiStyleConfig;
        }

        // Fetch license verification
        const { data: licenseVerification } = await supabase
          .from('s2_license_verifications')
          .select('*')
          .eq('user_id', profile.user_id)
          .eq('is_active', true)
          .single();

        if (licenseVerification) {
          therapistData.license_verification = licenseVerification;
        }

        // Fetch patient description
        const { data: patientDescription } = await supabase
          .from('s2_patient_descriptions')
          .select('*')
          .eq('therapist_profile_id', profile.id)
          .eq('is_active', true)
          .single();

        if (patientDescription) {
          therapistData.patient_description = patientDescription;
        }

        // Fetch session summary statistics
        const { data: sessions } = await supabase
          .from('s2_case_simulation_sessions')
          .select('id, created_at')
          .eq('therapist_profile_id', profile.id);

        // Count total messages for this therapist
        let totalMessages = 0;
        if (sessions && sessions.length > 0) {
          const sessionIds = sessions.map(s => s.id);
          const { count: messageCount } = await supabase
            .from('s2_session_messages')
            .select('*', { count: 'exact', head: true })
            .in('session_id', sessionIds);

          totalMessages = messageCount || 0;
        }

        therapistData.session_summary = {
          total_sessions: sessions?.length || 0,
          total_messages: totalMessages,
          last_session_date: sessions && sessions.length > 0
            ? sessions[sessions.length - 1].created_at
            : null
        };

        return therapistData;
      })
    );

    console.log(`[S2 Admin] ✅ Successfully compiled data for ${therapistsWithCompleteData.length} therapists`);

    return NextResponse.json({
      success: true,
      therapists: therapistsWithCompleteData,
      total: therapistsWithCompleteData.length
    });

  } catch (error) {
    console.error('[S2 Admin] Error in therapist data API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}