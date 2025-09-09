// src/app/api/s1/therapy-sessions/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth/server-auth';

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const aiPatientId = searchParams.get('ai_patient_id');

    let query = supabase
      .from('s1_therapy_sessions')
      .select(`
        id,
        ai_patient_id,
        session_number,
        session_type,
        started_at,
        ended_at,
        duration_minutes,
        status,
        session_goals,
        therapeutic_approach,
        therapist_notes,
        session_summary,
        therapeutic_alliance_score,
        technique_effectiveness_score,
        created_at,
        s1_ai_patients!inner (
          name,
          primary_concern,
          severity_level,
          difficulty_level
        )
      `)
      .eq('therapist_id', user.id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (aiPatientId) {
      query = query.eq('ai_patient_id', aiPatientId);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Error fetching therapy sessions:', error);
      return NextResponse.json({ error: 'Failed to fetch therapy sessions' }, { status: 500 });
    }

    return NextResponse.json({ sessions });

  } catch (error) {
    console.error('Error in GET /api/s1/therapy-sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      ai_patient_id,
      session_type,
      session_goals,
      therapeutic_approach
    } = body;

    // Validate required fields
    if (!ai_patient_id) {
      return NextResponse.json(
        { error: 'Missing required field: ai_patient_id' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Check if AI patient exists and is active
    const { data: aiPatient, error: patientError } = await supabase
      .from('s1_ai_patients')
      .select('id, name, is_active')
      .eq('id', ai_patient_id)
      .single();

    if (patientError || !aiPatient) {
      return NextResponse.json({ error: 'AI patient not found' }, { status: 404 });
    }

    if (!aiPatient.is_active) {
      return NextResponse.json({ error: 'AI patient is not active' }, { status: 400 });
    }

    // Get the next session number for this patient-therapist combination
    const { data: existingSessions } = await supabase
      .from('s1_therapy_sessions')
      .select('session_number')
      .eq('therapist_id', user.id)
      .eq('ai_patient_id', ai_patient_id)
      .order('session_number', { ascending: false })
      .limit(1);

    const nextSessionNumber = existingSessions?.length 
      ? existingSessions[0].session_number + 1 
      : 1;

    const { data: newSession, error } = await supabase
      .from('s1_therapy_sessions')
      .insert([{
        therapist_id: user.id,
        ai_patient_id,
        session_number: nextSessionNumber,
        session_type: session_type || 'therapy',
        session_goals: session_goals || [],
        therapeutic_approach,
        status: 'scheduled'
      }])
      .select(`
        id,
        ai_patient_id,
        session_number,
        session_type,
        status,
        session_goals,
        therapeutic_approach,
        created_at,
        s1_ai_patients!inner (
          name,
          primary_concern,
          severity_level,
          difficulty_level
        )
      `)
      .single();

    if (error) {
      console.error('Error creating therapy session:', error);
      return NextResponse.json({ error: 'Failed to create therapy session' }, { status: 500 });
    }

    return NextResponse.json({ session: newSession }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/s1/therapy-sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}