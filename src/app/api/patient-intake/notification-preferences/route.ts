// src/app/api/patient-intake/notification-preferences/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the most recent intake record for this user
    const { data: intakeData, error: fetchError } = await supabase
      .from('patient_intake')
      .select('phone, notification_phone, email_notifications, sms_notifications')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError) {
      console.error('Supabase fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch intake record', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!intakeData) {
      return NextResponse.json(
        { error: 'No intake record found for this user' },
        { status: 404 }
      );
    }

    // Return notification_phone if available, otherwise fall back to phone
    return NextResponse.json({
      phone: intakeData.notification_phone || intakeData.phone || '',
      emailNotifications: intakeData.email_notifications ?? true,
      smsNotifications: intakeData.sms_notifications ?? true,
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { userId, emailNotifications, smsNotifications, phone } = body;

    // Validate: if SMS is enabled, phone is required
    if (smsNotifications && !phone) {
      return NextResponse.json(
        { error: 'Phone number is required for SMS notifications' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update the most recent intake record for this user
    const { data: existingIntakes, error: fetchError } = await supabase
      .from('patient_intake')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('Supabase fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch intake record', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!existingIntakes || existingIntakes.length === 0) {
      return NextResponse.json(
        { error: 'No intake record found for this user' },
        { status: 404 }
      );
    }

    const intakeId = existingIntakes[0].id;

    // Update notification preferences
    const { error: updateError } = await supabase
      .from('patient_intake')
      .update({
        email_notifications: emailNotifications,
        sms_notifications: smsNotifications,
        notification_phone: phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', intakeId);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update notification preferences', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Notification preferences saved successfully',
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
