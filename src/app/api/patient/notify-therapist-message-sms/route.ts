// src/app/api/patient/notify-therapist-message-sms/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const {
      patientUserId,
      therapistName,
    } = await request.json();

    if (!patientUserId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!process.env.TEXTBELT_API_KEY) {
      console.error('TEXTBELT_API_KEY not configured');
      return NextResponse.json({ error: 'SMS service not configured' }, { status: 500 });
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
      console.log('No intake record found or SMS notifications not set:', patientUserId);
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'No intake record found'
      });
    }

    // Skip if SMS notifications are disabled
    if (!intakeData.sms_notifications) {
      console.log('SMS notifications disabled for user:', patientUserId);
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'SMS notifications disabled'
      });
    }

    // Get phone number (prefer notification_phone, fallback to phone)
    const phoneNumber = intakeData.notification_phone || intakeData.phone;

    if (!phoneNumber) {
      console.error('No phone number found for user:', patientUserId);
      return NextResponse.json({ error: 'Patient phone number not found' }, { status: 404 });
    }

    // Create the SMS message content
    let message = `🎉 New voice message from ${therapistName || 'a therapist'}!`;
    message += `\n\nThey've reviewed your intake session and believe they may be a good fit to help you.`;
    message += `\n\nVisit https://www.r2ai.me/chatbotV18/p1/messages to listen to their message.`;
    message += `\n\n- RiseTwice`;

    // Send SMS via Textbelt API
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
      console.error('Textbelt error:', textbeltData.error);
      return NextResponse.json({
        error: `Failed to send SMS: ${textbeltData.error}`
      }, { status: 500 });
    }

    console.log('Therapist message notification SMS sent:', {
      phoneNumber,
      therapistName,
      textId: textbeltData.textId,
      quotaRemaining: textbeltData.quotaRemaining
    });

    return NextResponse.json({
      success: true,
      textId: textbeltData.textId,
      quotaRemaining: textbeltData.quotaRemaining
    });

  } catch (error) {
    console.error('Error in notify-therapist-message-sms:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
