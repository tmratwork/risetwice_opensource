// src/app/api/s1/ai-patients/[patientId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ patientId: string }> }
) {
  try {
    const { patientId } = await context.params;

    if (!patientId) {
      return NextResponse.json(
        { error: 'Patient ID is required' },
        { status: 400 }
      );
    }

    console.log('[S1] Fetching patient data for ID:', patientId);

    // Fetch patient from s1_ai_patients table
    const { data: patient, error: patientError } = await supabaseAdmin
      .from('s1_ai_patients')
      .select('*')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      console.error('[S1] Patient not found:', patientError);
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    console.log('[S1] Patient data found:', { id: patient.id, name: patient.name, primary_concern: patient.primary_concern });

    return NextResponse.json({ patient }, { status: 200 });

  } catch (error) {
    console.error('Error in GET /api/s1/ai-patients/[patientId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}