// src/app/api/patient/notify-therapist-message-sms/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendSMSNotification } from '@/lib/notifications';

// Keep route handler for external API access
export async function POST(request: NextRequest) {
  try {
    const {
      patientUserId,
      therapistName,
    } = await request.json();

    const result = await sendSMSNotification(patientUserId, therapistName);
    return NextResponse.json(result);

  } catch (error) {
    console.error('[notify-sms] ❌ POST handler error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
