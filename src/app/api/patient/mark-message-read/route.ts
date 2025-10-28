// src/app/api/patient/mark-message-read/route.ts
// API route to mark a message as read

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageId, patientUserId } = body;

    if (!messageId || !patientUserId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update read_at timestamp
    const { error } = await supabase
      .from('provider_patient_audio_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('patient_user_id', patientUserId)
      .is('read_at', null); // Only update if not already read

    if (error) {
      console.error('Error marking message as read:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to mark message as read' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in mark-message-read:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
