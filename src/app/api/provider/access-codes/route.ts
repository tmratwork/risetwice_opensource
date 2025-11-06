// src/app/api/provider/access-codes/route.ts
// Fetches list of provider's entered access codes with patient details

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerUserId = searchParams.get('provider_user_id');

    if (!providerUserId) {
      return NextResponse.json(
        { error: 'Provider user ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch provider access codes ordered by most recent first
    const { data: accessCodes, error: codesError } = await supabase
      .from('provider_access_codes')
      .select('*')
      .eq('provider_user_id', providerUserId)
      .order('last_entered_at', { ascending: false });

    if (codesError) {
      console.error('Error fetching access codes:', codesError);
      return NextResponse.json(
        { error: 'Failed to fetch access codes' },
        { status: 500 }
      );
    }

    if (!accessCodes || accessCodes.length === 0) {
      return NextResponse.json({
        success: true,
        codes: []
      });
    }

    // Fetch intake session and patient details for each access code
    const codesWithDetails = await Promise.all(
      accessCodes.map(async (code) => {
        // Fetch intake session
        const { data: intakeSession, error: sessionError } = await supabase
          .from('intake_sessions')
          .select('*')
          .eq('id', code.intake_id)
          .single();

        if (sessionError || !intakeSession) {
          console.error('Error fetching intake session:', sessionError);
          return null;
        }

        // Fetch patient details if available
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

        return {
          accessCode: code.access_code,
          intakeId: code.intake_id,
          firstEnteredAt: code.first_entered_at,
          lastEnteredAt: code.last_entered_at,
          patientName: patientDetails?.full_legal_name || 'Unknown',
          preferredName: patientDetails?.preferred_name || null,
          submittedAt: intakeSession.created_at,
          status: intakeSession.status
        };
      })
    );

    // Filter out any null results (failed fetches)
    const validCodes = codesWithDetails.filter(code => code !== null);

    return NextResponse.json({
      success: true,
      codes: validCodes
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
