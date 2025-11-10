// src/app/api/patient/notify-therapist-message-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendEmailNotification } from '@/lib/notifications';

// Keep route handler for external API access
export async function POST(request: NextRequest) {
  try {
    const {
      patientUserId,
      therapistName,
    } = await request.json();

    const result = await sendEmailNotification(patientUserId, therapistName);
    return NextResponse.json(result);

  } catch (error) {
    console.error('[notify-email] ❌ POST handler error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
