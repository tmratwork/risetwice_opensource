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

    // Validate availability is an array with at least one item
    if (!Array.isArray(body.availability) || body.availability.length === 0) {
      return NextResponse.json(
        { error: 'At least one availability slot must be selected' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role key for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Prepare data for insertion
    const intakeData = {
      user_id: body.userId || null,
      full_legal_name: body.fullLegalName,
      preferred_name: body.preferredName || null,
      pronouns: body.pronouns || null,
      date_of_birth: body.dateOfBirth,
      gender: body.gender || null,
      email: body.email,
      phone: body.phone,
      state: body.state,
      city: body.city,
      zip_code: body.zipCode,
      insurance_provider: body.insuranceProvider,
      insurance_plan: body.insurancePlan || null,
      insurance_id: body.insuranceId || null,
      is_self_pay: body.insuranceProvider === 'Self-Pay',
      budget_per_session: body.budgetPerSession || null,
      session_preference: body.sessionPreference,
      availability: body.availability,
      status: 'pending'
    };

    // Insert into database
    const { data, error } = await supabase
      .from('patient_intake')
      .insert(intakeData)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to save intake form', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Intake form submitted successfully',
        intakeId: data.id
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
