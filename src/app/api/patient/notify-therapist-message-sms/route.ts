// src/app/api/patient/notify-therapist-message-sms/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Extract core notification logic into standalone function
export async function sendSMSNotification(
  patientUserId: string,
  therapistName: string
): Promise<{ success: boolean; textId?: string; quotaRemaining?: number; skipped?: boolean; reason?: string }> {
  try {
    console.log('[notify-sms] 📱 SMS notification request received:', {
      patientUserId,
      therapistName
    });

    if (!patientUserId) {
      console.error('[notify-sms] ❌ Missing patientUserId');
      throw new Error('Missing required field: patientUserId');
    }

    if (!process.env.TEXTBELT_API_KEY) {
      console.error('[notify-sms] ❌ TEXTBELT_API_KEY not configured');
      throw new Error('SMS service not configured');
    }

    // Check notification preferences and get phone number
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: intakeData, error: fetchError } = await supabase
      .from('patient_intake')
      .select('sms_notifications, notification_phone, phone')
      .eq('user_id', patientUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !intakeData) {
      console.log('[notify-sms] ⚠️ No intake record found or SMS notifications not set:', {
        patientUserId,
        fetchError: fetchError?.message
      });
      return {
        success: true,
        skipped: true,
        reason: 'No intake record found'
      };
    }

    console.log('[notify-sms] 📋 Intake data found:', {
      patientUserId,
      smsNotifications: intakeData.sms_notifications
    });

    // Skip if SMS notifications are disabled
    if (!intakeData.sms_notifications) {
      console.log('[notify-sms] ⚠️ SMS notifications disabled for user:', patientUserId);
      return {
        success: true,
        skipped: true,
        reason: 'SMS notifications disabled'
      };
    }

    // Get phone number (prefer notification_phone, fallback to phone)
    const phoneNumber = intakeData.notification_phone || intakeData.phone;

    console.log('[notify-sms] 📞 Phone number found:', {
      patientUserId,
      hasPhone: !!phoneNumber,
      source: intakeData.notification_phone ? 'notification_phone' : 'phone'
    });

    if (!phoneNumber) {
      console.error('[notify-sms] ❌ No phone number found for user:', patientUserId);
      throw new Error('Patient phone number not found');
    }

    // Create the SMS message content
    let message = `🎉 New voice message from ${therapistName || 'a therapist'}!`;
    message += `\n\nThey've reviewed your intake session and believe they may be a good fit to help you.`;
    message += `\n\nVisit https://www.r2ai.me/chatbotV18/p1/messages to listen to their message.`;
    message += `\n\n- RiseTwice`;

    // Send SMS via Textbelt API
    console.log('[notify-sms] 📤 Sending SMS via Textbelt...');
    const textbeltResponse = await fetch('https://textbelt.com/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        phone: phoneNumber,
        message: message,
        key: process.env.TEXTBELT_API_KEY,
      }),
    });

    const textbeltData = await textbeltResponse.json();

    if (!textbeltData.success) {
      console.error('[notify-sms] ❌ Textbelt error:', textbeltData.error);
      throw new Error(`Failed to send SMS: ${textbeltData.error}`);
    }

    console.log('[notify-sms] ✅ SMS sent successfully:', {
      phoneNumber,
      therapistName,
      textId: textbeltData.textId,
      quotaRemaining: textbeltData.quotaRemaining
    });

    return {
      success: true,
      textId: textbeltData.textId,
      quotaRemaining: textbeltData.quotaRemaining
    };

  } catch (error) {
    console.error('[notify-sms] ❌ Error in sendSMSNotification:', error);
    throw error;
  }
}

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
