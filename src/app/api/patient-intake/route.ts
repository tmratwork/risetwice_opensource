// src/app/api/patient-intake/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = [
      'fullLegalName',
      'dateOfBirth',
      'email',
      'phone',
      'state',
      'city',
      'zipCode',
      'insuranceProvider',
      'sessionPreference',
      'availability'
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate availability: either array with items OR availabilityOther is true
    if (!Array.isArray(body.availability) || (body.availability.length === 0 && !body.availabilityOther)) {
      return NextResponse.json(
        { error: 'At least one availability slot must be selected or provide other availability details' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role key for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const userId = body.userId || null;

    // Step 1: Upsert patient_details (create or update if authenticated user)
    let patientDetailsId = null;

    if (userId) {
      const patientDetailsData = {
        user_id: userId,
        full_legal_name: body.fullLegalName,
        preferred_name: body.preferredName || null,
        preferred_pronouns: body.pronouns || null,
        dob: body.dateOfBirth,
        gender: body.gender || null,
        email: body.email,
        phone: body.phone,
        address_city: body.city,
        address_state: body.state,
        address_zip: body.zipCode,
        insurance_company: body.insuranceProvider,
        group_id: body.insurancePlan || null,
        subscriber_id: body.insuranceId || null,
        budget_per_session: body.budgetPerSession || null,
        price_individual: body.priceIndividual || [],
        price_couples: body.priceCouples || [],
        sliding_scale: body.slidingScale || false,
        unsure_payment: body.unsurePayment || false,
        payment_other: body.paymentOther || null,
        session_preference: body.sessionPreference,
        availability: body.availability,
        availability_other: body.availabilityOther || false,
        availability_other_text: body.availabilityOtherText || null,
        updated_at: new Date().toISOString()
      };

      const { data: patientDetails, error: patientDetailsError } = await supabase
        .from('patient_details')
        .upsert(patientDetailsData, { onConflict: 'user_id' })
        .select()
        .single();

      if (patientDetailsError) {
        console.error('Failed to save patient details:', patientDetailsError);
        return NextResponse.json(
          { error: 'Failed to save patient details', details: patientDetailsError.message },
          { status: 500 }
        );
      }

      patientDetailsId = patientDetails.id;
    }

    // Step 2: Check if user has existing intake_session without patient_details_id
    // (This happens for V17 first-time users who got access code before filling form)
    const { data: existingSession, error: existingSessionError } = await supabase
      .from('intake_sessions')
      .select('*')
      .eq('user_id', userId)
      .is('patient_details_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let intakeSession;
    let conversationId;

    if (existingSession && !existingSessionError) {
      // V17 first-time user - update existing session to link patient_details
      console.log('[patient_intake] Found existing session without patient_details - linking now:', existingSession.id);

      const { data: updatedSession, error: updateError } = await supabase
        .from('intake_sessions')
        .update({
          patient_details_id: patientDetailsId,
          status: 'pending'
        })
        .eq('id', existingSession.id)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update existing intake session:', updateError);
        return NextResponse.json(
          { error: 'Failed to update intake session', details: updateError.message },
          { status: 500 }
        );
      }

      intakeSession = updatedSession;
      conversationId = existingSession.conversation_id;

      console.log('[patient_intake] ✅ Linked existing session to patient_details:', {
        sessionId: intakeSession.id,
        accessCode: intakeSession.access_code,
        conversationId
      });
    } else {
      // No existing session OR returning user - create new session with new access code
      console.log('[patient_intake] Creating new intake_session (no unlinked session found)');

      // Generate conversation_id for the voice session
      conversationId = crypto.randomUUID();

      // Create conversation record in conversations table
      const { error: conversationError } = await supabase
        .from('conversations')
        .insert({
          id: conversationId,
          human_id: userId,
          is_active: true
        });

      if (conversationError) {
        console.error('Failed to create conversation:', conversationError);
        // Don't fail the entire request - continue without conversation
      }

      // Generate unique access code for new session
      const { data: accessCodeData, error: accessCodeError } = await supabase
        .rpc('generate_unique_access_code');

      if (accessCodeError) {
        console.error('Failed to generate access code:', accessCodeError);
        return NextResponse.json(
          { error: 'Failed to generate access code', details: accessCodeError.message },
          { status: 500 }
        );
      }

      const accessCode = accessCodeData as string;

      // Create new intake_session record
      const intakeSessionData = {
        patient_details_id: patientDetailsId,
        user_id: userId,
        access_code: accessCode,
        conversation_id: conversationId,
        status: 'pending'
      };

      const { data: newSession, error: intakeSessionError } = await supabase
        .from('intake_sessions')
        .insert(intakeSessionData)
        .select()
        .single();

      if (intakeSessionError) {
        console.error('Failed to create intake session:', intakeSessionError);
        return NextResponse.json(
          { error: 'Failed to create intake session', details: intakeSessionError.message },
          { status: 500 }
        );
      }

      intakeSession = newSession;
      console.log('[patient_intake] ✅ Created new intake_session:', {
        sessionId: intakeSession.id,
        accessCode: intakeSession.access_code,
        conversationId
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Intake form submitted successfully',
        intakeId: intakeSession.id,
        accessCode: intakeSession.access_code,
        conversationId: conversationId
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
