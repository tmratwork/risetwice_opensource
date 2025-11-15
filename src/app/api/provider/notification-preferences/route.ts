// src/app/api/provider/notification-preferences/route.ts
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

    // Get notification preferences from provider profile
    const { data: providerData, error: fetchError } = await supabase
      .from('s2_therapist_profiles')
      .select('notification_phone, phone_number, email_address, email_notifications, sms_notifications')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Supabase fetch error (s2_therapist_profiles):', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch provider profile', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!providerData) {
      return NextResponse.json(
        { error: 'Provider profile not found' },
        { status: 404 }
      );
    }

    // Return notification_phone if set, otherwise fall back to phone_number
    const phone = providerData.notification_phone || providerData.phone_number || '';

    // Default to true if email/phone exist and preferences not explicitly set
    const hasEmail = !!providerData.email_address;
    const hasPhone = !!(providerData.notification_phone || providerData.phone_number);

    const emailNotifications = providerData.email_notifications ?? (hasEmail ? true : false);
    const smsNotifications = providerData.sms_notifications ?? (hasPhone ? true : false);

    return NextResponse.json({
      phone,
      emailNotifications,
      smsNotifications,
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

    // Check if provider profile exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('s2_therapist_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (fetchError || !existingProfile) {
      console.error('Supabase fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Provider profile not found', details: fetchError?.message },
        { status: 404 }
      );
    }

    // Update notification preferences
    const { error: updateError } = await supabase
      .from('s2_therapist_profiles')
      .update({
        email_notifications: emailNotifications,
        sms_notifications: smsNotifications,
        notification_phone: phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

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
