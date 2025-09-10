// src/app/api/s1/therapy-sessions/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ai_patient_id } = body;

    if (!ai_patient_id) {
      return NextResponse.json(
        { error: 'Missing required field: ai_patient_id' },
        { status: 400 }
      );
    }

    console.log('[S1] Creating session for patient:', ai_patient_id);

    // Check if AI patient exists
    const { data: aiPatient, error: patientError } = await supabaseAdmin
      .from('s1_ai_patients')
      .select('id, name, is_active')
      .eq('id', ai_patient_id)
      .single();

    if (patientError || !aiPatient) {
      console.error('[S1] AI patient not found:', patientError);
      return NextResponse.json({ error: 'AI patient not found' }, { status: 404 });
    }

    if (!aiPatient.is_active) {
      return NextResponse.json({ error: 'AI patient is not active' }, { status: 400 });
    }

    console.log('[S1] AI patient found:', aiPatient.name);

    // For now, create a mock session since we don't have auth users
    // TODO: Once authentication is set up, create real sessions in database
    const mockSessionId = crypto.randomUUID();
    
    const mockSession = {
      id: mockSessionId,
      ai_patient_id: ai_patient_id,
      ai_patient_name: aiPatient.name,
      session_number: 1,
      session_type: 'practice',
      status: 'scheduled',
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('[S1] Mock session created with UUID:', mockSessionId);

    return NextResponse.json({ session: mockSession }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/s1/therapy-sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}