// src/app/api/provider/patient-messages/route.ts
// API route for provider to fetch patient audio replies and conversations

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
        { success: false, error: 'Missing provider_user_id parameter' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all messages for this provider (both directions)
    const { data: messages, error } = await supabase
      .from('provider_patient_audio_messages')
      .select('id, access_code, patient_user_id, sender_type, audio_url, duration_seconds, read_at, created_at, intake_id')
      .eq('provider_user_id', providerUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching patient messages:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // Get unread count (patient messages only)
    const unreadCount = messages?.filter(m => m.sender_type === 'patient' && !m.read_at).length || 0;

    // Group messages by patient/intake for conversation threading
    const conversations = messages?.reduce((acc, msg) => {
      const key = `${msg.patient_user_id}-${msg.intake_id}`;
      if (!acc[key]) {
        acc[key] = {
          patientUserId: msg.patient_user_id,
          intakeId: msg.intake_id,
          accessCode: msg.access_code,
          messages: []
        };
      }
      acc[key].messages.push({
        id: msg.id,
        senderType: msg.sender_type,
        audioUrl: msg.audio_url,
        durationSeconds: msg.duration_seconds,
        readAt: msg.read_at,
        createdAt: msg.created_at
      });
      return acc;
    }, {} as Record<string, { patientUserId: string; intakeId: string; accessCode: string; messages: Array<{ id: string; senderType: string; audioUrl: string; durationSeconds: number; readAt: string | null; createdAt: string }> }>);

    const conversationList = Object.values(conversations || {});

    return NextResponse.json({
      success: true,
      conversations: conversationList,
      unreadCount
    });
  } catch (error) {
    console.error('Error in patient-messages:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
