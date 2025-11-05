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

    // Find intake_session by access code (use actual code without 'a' prefix)
    const { data: intakeSession, error: sessionError } = await supabase
      .from('intake_sessions')
      .select('*')
      .eq('access_code', actualAccessCode)
      .single();

    if (sessionError || !intakeSession) {
      console.error('Access code not found:', sessionError);
      return NextResponse.json(
        { error: 'Invalid access code', valid: false },
        { status: 404 }
      );
    }

    // Fetch patient_details if patient_details_id exists
    let patientDetails = null;
    if (intakeSession.patient_details_id) {
      const { data, error } = await supabase
        .from('patient_details')
        .select('*')
        .eq('id', intakeSession.patient_details_id)
        .single();

      if (!error && data) {
        patientDetails = data;
      }
    }

    // Log provider access for audit trail
    if (providerUserId) {
      const { error: logError } = await supabase
        .from('provider_intake_views')
        .insert({
          provider_user_id: providerUserId,
          intake_id: intakeSession.id,
          access_code: accessCode,
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        });

      if (logError) {
        console.error('Failed to log provider access:', logError);
        // Don't fail the request if logging fails
      }
    }

    // Combine intake_session + patient_details into response
    return NextResponse.json({
      success: true,
      valid: true,
      intakeId: intakeSession.id,
      intake: {
        id: intakeSession.id,
        fullLegalName: patientDetails?.full_legal_name || null,
        preferredName: patientDetails?.preferred_name || null,
        pronouns: patientDetails?.preferred_pronouns || null,
        dateOfBirth: patientDetails?.dob || null,
        gender: null,
        email: patientDetails?.email || null,
        phone: patientDetails?.phone || null,
        state: patientDetails?.address_state || null,
        city: patientDetails?.address_city || null,
        zipCode: patientDetails?.address_zip || null,
        insuranceProvider: patientDetails?.insurance_company || null,
        insurancePlan: patientDetails?.group_id || null,
        insuranceId: patientDetails?.subscriber_id || null,
        isSelfPay: patientDetails?.insurance_company === 'Self-Pay',
        budgetPerSession: null,
        sessionPreference: null,
        availability: [],
        status: intakeSession.status,
        createdAt: intakeSession.created_at,
        updatedAt: patientDetails?.updated_at || null,
        conversationId: intakeSession.conversation_id,
        elevenLabsConversationId: intakeSession.elevenlabs_conversation_id,
        userId: intakeSession.user_id
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
