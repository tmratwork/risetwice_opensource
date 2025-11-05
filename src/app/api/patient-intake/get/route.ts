// src/app/api/patient-intake/get/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');

    if (process.env.NEXT_PUBLIC_ENABLE_PATIENT_INTAKE_LOGS === 'true') {
      console.log('[patient_intake] [SERVER] 📡 GET request received');
      console.log('[patient_intake] [SERVER] Query params:', { userId, email });
    }

    if (!userId && !email) {
      if (process.env.NEXT_PUBLIC_ENABLE_PATIENT_INTAKE_LOGS === 'true') {
        console.log('[patient_intake] [SERVER] ❌ Missing userId and email');
      }
      return NextResponse.json(
        { error: 'Either userId or email is required' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role key for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build query - join patient_details with most recent intake_session
    // Search by userId or email (from patient_details)
    let patientDetailsQuery = supabase
      .from('patient_details')
      .select('*');

    if (userId) {
      patientDetailsQuery = patientDetailsQuery.eq('user_id', userId);
      if (process.env.NEXT_PUBLIC_ENABLE_PATIENT_INTAKE_LOGS === 'true') {
        console.log('[patient_intake] [SERVER] 🔍 Querying by user_id:', userId);
      }
    } else if (email) {
      patientDetailsQuery = patientDetailsQuery.eq('email', email);
      if (process.env.NEXT_PUBLIC_ENABLE_PATIENT_INTAKE_LOGS === 'true') {
        console.log('[patient_intake] [SERVER] 🔍 Querying by email:', email);
      }
    }

    const { data: patientDetails, error: patientDetailsError } = await patientDetailsQuery.single();

    if (patientDetailsError) {
      if (patientDetailsError.code === 'PGRST116') {
        // No patient_details found - user hasn't filled out form yet
        if (process.env.NEXT_PUBLIC_ENABLE_PATIENT_INTAKE_LOGS === 'true') {
          console.log('[patient_intake] [SERVER] ℹ️ No patient details found for user:', userId || email);
        }
        return NextResponse.json(
          { success: true, hasData: false, data: null },
          { status: 200 }
        );
      }

      console.error('[patient_intake] [SERVER] ❌ Supabase error:', patientDetailsError);
      return NextResponse.json(
        { error: 'Failed to fetch patient details', details: patientDetailsError.message },
        { status: 500 }
      );
    }

    // Fetch most recent intake_session for this patient
    const { data: intakeSessions, error: sessionsError } = await supabase
      .from('intake_sessions')
      .select('*')
      .eq('patient_details_id', patientDetails.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (sessionsError) {
      console.error('[patient_intake] [SERVER] ❌ Failed to fetch intake sessions:', sessionsError);
      return NextResponse.json(
        { error: 'Failed to fetch intake sessions', details: sessionsError.message },
        { status: 500 }
      );
    }

    if (!intakeSessions || intakeSessions.length === 0) {
      if (process.env.NEXT_PUBLIC_ENABLE_PATIENT_INTAKE_LOGS === 'true') {
        console.log('[patient_intake] [SERVER] ℹ️ No intake sessions found for patient');
      }
      return NextResponse.json(
        { success: true, hasData: false, data: null },
        { status: 200 }
      );
    }

    const mostRecentSession = intakeSessions[0];

    // Combine patient_details + intake_session into response format
    const responseData = {
      id: mostRecentSession.id,
      user_id: patientDetails.user_id,
      access_code: mostRecentSession.access_code,
      conversation_id: mostRecentSession.conversation_id,
      elevenlabs_conversation_id: mostRecentSession.elevenlabs_conversation_id,
      status: mostRecentSession.status,
      created_at: mostRecentSession.created_at,
      updated_at: patientDetails.updated_at,
      // Patient details
      full_legal_name: patientDetails.full_legal_name,
      preferred_name: patientDetails.preferred_name,
      pronouns: patientDetails.preferred_pronouns,
      date_of_birth: patientDetails.dob,
      gender: patientDetails.gender,
      email: patientDetails.email,
      phone: patientDetails.phone,
      city: patientDetails.address_city,
      state: patientDetails.address_state,
      zip_code: patientDetails.address_zip,
      insurance_provider: patientDetails.insurance_company,
      insurance_plan: patientDetails.group_id,
      insurance_id: patientDetails.subscriber_id,
      budget_per_session: patientDetails.budget_per_session,
      price_individual: patientDetails.price_individual,
      price_couples: patientDetails.price_couples,
      sliding_scale: patientDetails.sliding_scale,
      unsure_payment: patientDetails.unsure_payment,
      payment_other: patientDetails.payment_other,
      session_preference: patientDetails.session_preference,
      availability: patientDetails.availability,
      availability_other: patientDetails.availability_other,
      availability_other_text: patientDetails.availability_other_text
    };

    if (process.env.NEXT_PUBLIC_ENABLE_PATIENT_INTAKE_LOGS === 'true') {
      console.log('[patient_intake] [SERVER] ✅ Returning patient details + most recent session:', {
        userId: userId || email,
        accessCode: responseData.access_code,
        conversationId: responseData.conversation_id,
        createdAt: responseData.created_at,
        fullLegalName: responseData.full_legal_name,
        phone: responseData.phone,
        state: responseData.state
      });
    }

    return NextResponse.json(
      {
        success: true,
        hasData: true,
        data: responseData
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('[patient_intake] [SERVER] ❌ API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
