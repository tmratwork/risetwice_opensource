// src/app/api/patient/provider-messages/route.ts
// API route to fetch all provider audio messages for a patient

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientUserId = searchParams.get('patient_user_id');

    if (!patientUserId) {
      return NextResponse.json(
        { success: false, error: 'Missing patient_user_id parameter' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all messages for this patient (both provider messages and patient replies)
    const { data: messages, error } = await supabase
      .from('provider_patient_audio_messages')
      .select('id, access_code, provider_user_id, sender_type, audio_url, duration_seconds, read_at, created_at, intake_id')
      .eq('patient_user_id', patientUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching provider messages:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // Get unread count
    const unreadCount = messages?.filter(m => m.sender_type === 'provider' && !m.read_at).length || 0;

    // Group messages by intake_id for conversation threading
    const conversations = messages?.reduce((acc, msg) => {
      const key = msg.intake_id;
      if (!acc[key]) {
        acc[key] = {
          intakeId: msg.intake_id,
          accessCode: msg.access_code,
          providerUserId: msg.provider_user_id,
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
    }, {} as Record<string, any>);

    const conversationList = Object.values(conversations || {});

    return NextResponse.json({
      success: true,
      conversations: conversationList,
      unreadCount
    });
  } catch (error) {
    console.error('Error in provider-messages:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
