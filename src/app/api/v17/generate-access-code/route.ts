// src/app/api/v17/generate-access-code/route.ts
/**
 * V17 API - Generate Access Code for Conversation
 *
 * Generates a unique 5-digit access code and creates NEW patient_intake record
 * Each conversation gets its own patient_intake record with unique access code
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface GenerateAccessCodeRequest {
  conversationId: string;
  userId: string;
}

export async function POST(req: Request) {
  const logPrefix = '[v17_generate_access_code]';

  try {
    const body: GenerateAccessCodeRequest = await req.json();
    const { conversationId, userId } = body;

    if (!conversationId || !userId) {
      console.error(`${logPrefix} Missing required fields`, { conversationId, userId });
      return NextResponse.json({ error: 'Missing conversationId or userId' }, { status: 400 });
    }

    console.log(`${logPrefix} Creating NEW intake_session for conversation: ${conversationId}, user: ${userId}`);

    // Generate unique 5-digit access code
    const { data: accessCodeData, error: accessCodeError } = await supabaseAdmin
      .rpc('generate_unique_access_code');

    if (accessCodeError) {
      console.error(`${logPrefix} Failed to generate access code:`, accessCodeError);
      return NextResponse.json({
        error: 'Failed to generate access code',
        details: accessCodeError.message
      }, { status: 500 });
    }

    const accessCode = accessCodeData as string;

    // Check if patient_details exists for this user (returning user)
    let patientDetailsId = null;
    const { data: patientDetails, error: patientDetailsError } = await supabaseAdmin
      .from('patient_details')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (patientDetailsError) {
      if (patientDetailsError.code === 'PGRST116') {
        // No patient_details found - first-time user, will link later when they fill intake form
        console.log(`${logPrefix} No patient_details found - first-time user`);
      } else {
        // Unexpected error querying patient_details
        console.error(`${logPrefix} Error checking patient_details:`, patientDetailsError);
        // Continue without patient_details_id (non-critical)
      }
    } else {
      // Returning user - link to existing patient_details
      patientDetailsId = patientDetails.id;
      console.log(`${logPrefix} Found existing patient_details - returning user, id: ${patientDetailsId}`);
    }

    // Fetch phone/email from patient_details (single source of truth)
    let phoneNumber = null;
    let emailAddress = null;

    if (patientDetailsId) {
      // For returning users, fetch from patient_details
      const { data: patientDetailsData } = await supabaseAdmin
        .from('patient_details')
        .select('phone, email')
        .eq('id', patientDetailsId)
        .single();

      if (patientDetailsData) {
        phoneNumber = patientDetailsData.phone;
        emailAddress = patientDetailsData.email;
        console.log(`${logPrefix} 📞 Copied phone/email from patient_details:`, {
          phone: phoneNumber,
          email: emailAddress
        });
      }
    }

    // ALWAYS create NEW intake_session record - never update existing ones
    // Each conversation gets its own record with unique access code
    const { error: insertError } = await supabaseAdmin
      .from('intake_sessions')
      .insert({
        patient_details_id: patientDetailsId, // NULL for first-time users, set for returning users
        user_id: userId,
        access_code: accessCode,
        conversation_id: conversationId,
        status: 'pending',
        phone: phoneNumber,
        email: emailAddress
      });

    if (insertError) {
      console.error(`${logPrefix} Failed to create intake_session:`, insertError);
      return NextResponse.json({
        error: 'Failed to create intake session',
        details: insertError.message
      }, { status: 500 });
    }

    console.log(`${logPrefix} ✅ Created NEW intake_session record:`, {
      conversationId,
      accessCode,
      userId,
      patientDetailsId: patientDetailsId || 'NULL (first-time user)',
      isReturningUser: !!patientDetailsId
    });

    return NextResponse.json({
      success: true,
      accessCode
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${logPrefix} Generate access code failed:`, errorMessage);

    return NextResponse.json({
      error: 'Internal server error',
      details: errorMessage
    }, { status: 500 });
  }
}
