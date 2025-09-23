// src/app/api/admin/s2/prompt/[promptId]/route.ts
// Retrieve specific AI therapist prompt by ID for admin preview

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ promptId: string }> }
) {
  try {
    const { promptId } = await params;

    if (!promptId) {
      return NextResponse.json(
        { error: 'promptId parameter is required' },
        { status: 400 }
      );
    }

    console.log(`[s2_preview] Fetching prompt data for ID: ${promptId}`);

    // Get the prompt with basic therapist profile data
    const { data: promptData, error: promptError } = await supabase
      .from('s2_ai_therapist_prompts')
      .select(`
        *,
        s2_therapist_profiles (*)
      `)
      .eq('id', promptId)
      .eq('status', 'active')
      .single();

    if (promptError || !promptData) {
      console.error('[s2_preview] Prompt not found:', promptError);
      return NextResponse.json(
        { error: 'Prompt not found or access denied' },
        { status: 404 }
      );
    }

    console.log(`[s2_preview] ✅ Prompt found: ${promptData.prompt_title}`);

    // Get additional profile data if therapist profile exists
    let completeProfile = null;
    let aiStyleConfig = null;
    let licenseVerification = null;
    let patientDescription = null;

    if (promptData.s2_therapist_profiles?.user_id) {
      const userId = promptData.s2_therapist_profiles.user_id;

      // Get complete profile
      const { data: completeProfileData } = await supabase
        .from('s2_complete_profiles')
        .select('*')
        .eq('user_id', userId)
        .limit(1)
        .single();

      // Get AI style config
      const { data: aiStyleData } = await supabase
        .from('s2_ai_style_configs')
        .select('*')
        .eq('therapist_profile_id', promptData.s2_therapist_profiles.id)
        .limit(1)
        .single();

      // Get license verification
      const { data: licenseData } = await supabase
        .from('s2_license_verifications')
        .select('*')
        .eq('user_id', userId)
        .limit(1)
        .single();

      // Get patient description
      const { data: patientData } = await supabase
        .from('s2_patient_descriptions')
        .select('*')
        .eq('therapist_profile_id', promptData.s2_therapist_profiles.id)
        .limit(1)
        .single();

      completeProfile = completeProfileData;
      aiStyleConfig = aiStyleData;
      licenseVerification = licenseData;
      patientDescription = patientData;
    }

    // Structure the response data
    const responseData = {
      prompt: {
        id: promptData.id,
        title: promptData.prompt_title,
        text: promptData.prompt_text,
        version: promptData.prompt_version,
        generatedBy: promptData.generated_by,
        generationMethod: promptData.generation_method,
        createdAt: promptData.created_at,
        completenessScore: promptData.completeness_score,
        confidenceScore: promptData.confidence_score,
        sourceDataSummary: promptData.source_data_summary
      },
      therapistProfile: promptData.s2_therapist_profiles,
      completeProfile: completeProfile,
      aiStyleConfig: aiStyleConfig,
      licenseVerification: licenseVerification,
      patientDescription: patientDescription
    };

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('[s2_preview] Error fetching prompt:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}