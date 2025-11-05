// src/app/api/provider/validate-intake-code/route.ts
// Validates patient intake access code and returns intake data

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessCode, providerUserId } = body;

    if (!accessCode || typeof accessCode !== 'string') {
      return NextResponse.json(
        { error: 'Access code is required' },
        { status: 400 }
      );
    }

    // Validate access code format (5 digits, or 'a' + 5 digits for unverified providers)
    const isUnverifiedCode = accessCode.toLowerCase().startsWith('a');
    let actualAccessCode = accessCode;

    if (isUnverifiedCode) {
      // Remove 'a' prefix to get actual access code
      actualAccessCode = accessCode.substring(1);
      if (!/^\d{5}$/.test(actualAccessCode)) {
        return NextResponse.json(
          { error: 'Invalid access code format' },
          { status: 400 }
        );
      }
    } else if (!/^\d{5}$/.test(accessCode)) {
      return NextResponse.json(
        { error: 'Invalid access code format' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find patient intake by access code (use actual code without 'a' prefix)
    const { data: intake, error: intakeError } = await supabase
      .from('patient_intake')
      .select('*')
      .eq('access_code', actualAccessCode)
      .single();

    if (intakeError || !intake) {
      console.error('Access code not found:', intakeError);
      return NextResponse.json(
        { error: 'Invalid access code', valid: false },
        { status: 404 }
      );
    }

    // Log provider access for audit trail
    if (providerUserId) {
      const { error: logError } = await supabase
        .from('provider_intake_views')
        .insert({
          provider_user_id: providerUserId,
          intake_id: intake.id,
          access_code: accessCode,
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        });

      if (logError) {
        console.error('Failed to log provider access:', logError);
        // Don't fail the request if logging fails
      }
    }

    return NextResponse.json({
      success: true,
      valid: true,
      intakeId: intake.id,
      intake: {
        id: intake.id,
        fullLegalName: intake.full_legal_name,
        preferredName: intake.preferred_name,
        pronouns: intake.pronouns,
        dateOfBirth: intake.date_of_birth,
        gender: intake.gender,
        email: intake.email,
        phone: intake.phone,
        state: intake.state,
        city: intake.city,
        zipCode: intake.zip_code,
        insuranceProvider: intake.insurance_provider,
        insurancePlan: intake.insurance_plan,
        insuranceId: intake.insurance_id,
        isSelfPay: intake.is_self_pay,
        budgetPerSession: intake.budget_per_session,
        sessionPreference: intake.session_preference,
        availability: intake.availability,
        status: intake.status,
        createdAt: intake.created_at,
        updatedAt: intake.updated_at,
        conversationId: intake.conversation_id,
        elevenLabsConversationId: intake.elevenlabs_conversation_id,
        userId: intake.user_id
      }
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
