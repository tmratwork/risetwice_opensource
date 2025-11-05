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

    // Generate unique 5-digit access code
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

    // Step 2: Generate conversation_id for the voice session
    const conversationId = crypto.randomUUID();

    // Step 3: Create conversation record in conversations table
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

    // Step 4: Create intake_session record
    const intakeSessionData = {
      patient_details_id: patientDetailsId,
      user_id: userId,
      access_code: accessCode,
      conversation_id: conversationId,
      status: 'pending'
    };

    const { data: intakeSession, error: intakeSessionError } = await supabase
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
