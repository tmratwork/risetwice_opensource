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

    // Get voice transcript if available
    let voiceTranscript = null;
    if (intake.conversation_id) {
      // TODO: Fetch actual transcript from conversation messages
      // For now, we'll generate summary without transcript
    }

    // Generate AI summary
    const summary = await generateIntakeSummary(intake, voiceTranscript);

    // Store summary in database
    const { data: savedSummary, error: saveError } = await supabaseAdmin
      .from('patient_intake_summaries')
      .insert({
        intake_id: intakeId,
        summary_text: summary.summaryText,
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
      // Don't fail the request - return generated summary anyway
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

  const prompt = `You are an experienced mental health intake coordinator analyzing patient intake information for a therapist.

Based on the following patient intake information, provide a comprehensive summary to help a therapist determine if they can help this patient.

${intakeContext}

Please provide your analysis in the following JSON format:
{
  "summaryText": "A 2-3 paragraph summary highlighting key information about the patient, their situation, and what they're seeking in therapy",
  "keyConcerns": ["Array of 3-5 key concerns or issues that should be addressed"],
  "urgencyLevel": "low|medium|high|crisis",
  "recommendedSpecializations": ["Array of 2-4 therapy specializations that would be most relevant for this patient"]
}

Consider factors like:
- Patient demographics and life situation
- Insurance and financial considerations
- Scheduling and session preferences
- Any concerns expressed in voice intake (if available)
- Potential red flags or urgent needs

Respond ONLY with valid JSON, no additional text.`;

  try {
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

    return {
      summaryText: summary.summaryText,
      keyConcerns: summary.keyConcerns || [],
      urgencyLevel: summary.urgencyLevel || 'low',
      recommendedSpecializations: summary.recommendedSpecializations || [],
      voiceTranscript: voiceTranscript
    };

  } catch (error) {
    console.error('Failed to generate AI summary:', error);

    // Return fallback summary
    return {
      summaryText: `Patient intake for ${intake.full_legal_name}. Looking for ${intake.session_preference} therapy sessions. Insurance: ${intake.insurance_provider}. Available: ${Array.isArray(intake.availability) ? (intake.availability as string[]).join(', ') : 'Not specified'}.`,
      keyConcerns: ['Initial consultation needed'],
      urgencyLevel: 'medium',
      recommendedSpecializations: ['General therapy'],
      voiceTranscript: voiceTranscript
    };
  }
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
