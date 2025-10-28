// src/app/api/provider/intake-summary/route.ts
// Fetches or generates AI summary for patient intake

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getClaudeModel } from '@/config/models';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const intakeId = searchParams.get('intake_id');

    if (!intakeId) {
      return NextResponse.json(
        { error: 'Intake ID is required' },
        { status: 400 }
      );
    }

    // Check if summary already exists
    const { data: existingSummary, error: summaryError } = await supabaseAdmin
      .from('patient_intake_summaries')
      .select('*')
      .eq('intake_id', intakeId)
      .single();

    if (!summaryError && existingSummary) {
      // Return existing summary
      return NextResponse.json({
        success: true,
        summary: {
          summaryText: existingSummary.summary_text,
          formDataSummary: existingSummary.form_data_summary || null,
          keyConcerns: existingSummary.key_concerns || [],
          urgencyLevel: existingSummary.urgency_level || 'low',
          recommendedSpecializations: existingSummary.recommended_specializations || [],
          voiceTranscript: existingSummary.voice_transcript
        }
      });
    }

    // No summary exists - generate one
    const { data: intake, error: intakeError } = await supabaseAdmin
      .from('patient_intake')
      .select('*')
      .eq('id', intakeId)
      .single();

    if (intakeError || !intake) {
      return NextResponse.json(
        { error: 'Intake not found' },
        { status: 404 }
      );
    }

    // Get voice transcript - REQUIRED before generating summary
    let voiceTranscript = null;
    if (intake.conversation_id) {
      const { data: transcriptData, error: transcriptError } = await supabaseAdmin
        .from('patient_intake_transcripts')
        .select('transcript_text, status')
        .eq('intake_id', intakeId)
        .single();

      if (transcriptError) {
        console.log('[intake_summary] No transcript found yet, returning pending status');
        return NextResponse.json({
          success: true,
          status: 'pending_transcript',
          message: 'Waiting for audio transcription to complete before generating summary'
        });
      }

      if (transcriptData.status === 'processing') {
        console.log('[intake_summary] Transcript still processing');
        return NextResponse.json({
          success: true,
          status: 'pending_transcript',
          message: 'Audio transcription in progress. Summary will be generated once transcription completes.'
        });
      }

      if (transcriptData.status === 'failed') {
        console.log('[intake_summary] Transcript failed, generating summary without it');
        voiceTranscript = null; // Continue without transcript
      } else if (transcriptData.status === 'completed') {
        voiceTranscript = transcriptData.transcript_text;
        console.log('[intake_summary] Using transcript for summary generation:', voiceTranscript.length, 'characters');
      }
    }

    // Generate AI summary
    let summary;
    try {
      summary = await generateIntakeSummary(intake, voiceTranscript);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to generate AI summary:', errorMessage);

      // Return visible error - NO fallback
      return NextResponse.json({
        success: false,
        error: 'Failed to generate intake summary',
        details: errorMessage
      }, { status: 500 });
    }

    // Store summary in database
    const { error: saveError } = await supabaseAdmin
      .from('patient_intake_summaries')
      .insert({
        intake_id: intakeId,
        summary_text: summary.summaryText,
        form_data_summary: summary.formDataSummary,
        key_concerns: summary.keyConcerns,
        urgency_level: summary.urgencyLevel,
        recommended_specializations: summary.recommendedSpecializations,
        voice_transcript: voiceTranscript,
        model_used: getClaudeModel()
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save summary:', saveError);
      // Return visible error - database save failures should be visible
      return NextResponse.json({
        success: false,
        error: 'Failed to save intake summary to database',
        details: saveError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      summary: summary
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('API error:', errorMessage);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch intake summary',
      details: errorMessage
    }, { status: 500 });
  }
}

async function generateIntakeSummary(intake: Record<string, unknown>, voiceTranscript: string | null) {
  const claudeModel = getClaudeModel();

  // Fetch prompt from Supabase
  const { data: promptData, error: promptError } = await supabaseAdmin
    .from('ai_prompts')
    .select('prompt_content')
    .eq('prompt_type', 'v18_intake_summary')
    .eq('is_active', true)
    .single();

  if (promptError || !promptData || !promptData.prompt_content) {
    throw new Error('V18 Intake Summary prompt not found in database. Please configure it in the admin panel at /chatbotV18/admin');
  }

  const promptTemplate = promptData.prompt_content;

  // Prepare intake data for AI analysis
  const intakeContext = `
Patient Intake Information:

Personal:
- Name: ${intake.full_legal_name}${intake.preferred_name ? ` (prefers ${intake.preferred_name})` : ''}
- Age: ${calculateAge(intake.date_of_birth as string)} years old
- Gender: ${intake.gender || 'Not specified'}
- Pronouns: ${intake.pronouns || 'Not specified'}

Location:
- ${intake.city}, ${intake.state} ${intake.zip_code}

Insurance & Payment:
- Provider: ${intake.insurance_provider}
${intake.is_self_pay ? `- Self-pay budget: ${intake.budget_per_session}` : `- Plan: ${intake.insurance_plan || 'Not specified'}`}

Session Preferences:
- Type: ${intake.session_preference}
- Availability: ${Array.isArray(intake.availability) ? (intake.availability as string[]).join(', ') : 'Not specified'}

Contact:
- Email: ${intake.email}
- Phone: ${intake.phone}

${voiceTranscript ? `\nVoice Intake Transcript:\n${voiceTranscript}` : ''}
`;

  // Replace {{INTAKE_CONTEXT}} placeholder in prompt template
  const prompt = promptTemplate.replace('{{INTAKE_CONTEXT}}', intakeContext);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: claudeModel,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.statusText}`);
  }

  const result = await response.json();
  let content = result.content[0].text;

  // Remove markdown code block wrapping if present (Claude sometimes wraps JSON in ```json)
  content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  // Parse JSON response
  const summary = JSON.parse(content);

  // Build backward-compatible summary text from new structure
  const summaryText = `
Client Profile: ${summary.clientProfile || 'Not specified'}

Presenting Concern: ${summary.presentingConcern || 'Not specified'}

Primary Goal: ${summary.primaryGoal || 'Not specified'}

Therapy History: ${summary.therapyHistory || 'Not specified'}

Clinical Background: ${summary.clinicalBackground || 'Not specified'}

Desired Therapeutic Style: ${summary.desiredStyle || 'Not specified'}

Key Preferences: ${summary.keyPreferences || 'Not specified'}
`.trim();

  return {
    summaryText,
    formDataSummary: {
      clientProfile: summary.clientProfile || null,
      presentingConcern: summary.presentingConcern || null,
      primaryGoal: summary.primaryGoal || null,
      therapyHistory: summary.therapyHistory || null,
      clinicalBackground: summary.clinicalBackground || null,
      desiredStyle: summary.desiredStyle || null,
      keyPreferences: summary.keyPreferences || null
    },
    keyConcerns: [], // No longer used in new structure
    urgencyLevel: summary.urgencyLevel || 'low',
    recommendedSpecializations: summary.recommendedSpecializations || [],
    voiceTranscript: voiceTranscript
  };
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}
