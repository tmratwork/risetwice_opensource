// src/app/api/s1/therapy-sessions/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Note: Following V16 pattern - use Firebase UIDs directly as text, no conversion needed

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

    // Get therapist user ID from Firebase auth token (following V16 pattern)
    // Extract the Authorization header to get the Firebase ID token
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[S1] No valid authorization header found');
      return NextResponse.json({ 
        error: 'Authentication required. Please sign in to create therapy sessions.',
        authRequired: true
      }, { status: 401 });
    }

    // Extract Firebase UID from token (following V16 pattern)
    // V16 uses Firebase UIDs directly as text - no conversion needed
    let therapistUserId: string;
    
    try {
      // Simple token processing for now - in production this should verify the Firebase JWT
      const token = authHeader.substring(7); // Remove 'Bearer '
      
      // Decode the token to get Firebase UID (same as V16)
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('Invalid token format');
      }
      
      const payload = JSON.parse(atob(tokenParts[1]));
      therapistUserId = payload.sub || payload.user_id; // Firebase UID directly
      
      if (!therapistUserId) {
        throw new Error('No user ID found in token');
      }
      
      console.log('[S1] Using Firebase UID directly:', therapistUserId);
    } catch (error) {
      console.error('[S1] Token processing failed:', error);
      return NextResponse.json({ 
        error: 'Invalid authentication token. Please sign in again.',
        authRequired: true
      }, { status: 401 });
    }

    console.log('[S1] Creating session in database for Firebase user:', therapistUserId);

    const { data: newSession, error: createError } = await supabaseAdmin
      .from('s1_therapy_sessions')
      .insert({
        therapist_id: therapistUserId,
        ai_patient_id: ai_patient_id,
        session_number: 1,
        session_type: 'therapy',
        status: 'scheduled',
        therapeutic_approach: 'cognitive_behavioral'
      })
      .select(`
        id,
        therapist_id,
        ai_patient_id,
        session_number,
        session_type,
        status,
        created_at,
        updated_at,
        s1_ai_patients!inner (
          id,
          name,
          primary_concern
        )
      `)
      .single();

    if (createError) {
      console.error('[S1] Failed to create session:', createError);
      
      // Provide helpful error message for database constraint issues
      if (createError.code === '22P02') {
        return NextResponse.json({ 
          error: 'Database schema mismatch',
          details: 'The therapist_id column needs to be changed from UUID to TEXT to support Firebase UIDs. Please run the database migration.',
          suggestion: 'ALTER TABLE s1_therapy_sessions ALTER COLUMN therapist_id TYPE text;'
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: 'Failed to create session in database',
        details: createError.message 
      }, { status: 500 });
    }

    console.log('[S1] ✅ Real session created in database:', newSession.id);

    // Return session with patient name for client
    const sessionResponse = {
      id: newSession.id,
      ai_patient_id: newSession.ai_patient_id,
      ai_patient_name: (newSession.s1_ai_patients as { id: string; name: string; primary_concern: string }[])[0]?.name,
      session_number: newSession.session_number,
      session_type: newSession.session_type,
      status: newSession.status,
      created_at: newSession.created_at,
      updated_at: newSession.updated_at
    };

    return NextResponse.json({ session: sessionResponse }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/s1/therapy-sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}