// src/app/api/patient/notify-therapist-message-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const {
      patientUserId,
      therapistName,
    } = await request.json();

    console.log('[notify-email] 📧 Email notification request received:', {
      patientUserId,
      therapistName
    });

    if (!patientUserId) {
      console.error('[notify-email] ❌ Missing patientUserId');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    // Check notification preferences
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: intakeData, error: fetchError } = await supabase
      .from('patient_intake')
      .select('email_notifications')
      .eq('user_id', patientUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !intakeData) {
      console.log('[notify-email] ⚠️ No intake record found or email notifications not set:', {
        patientUserId,
        fetchError: fetchError?.message
      });
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'No intake record found'
      });
    }

    console.log('[notify-email] 📋 Intake data found:', {
      patientUserId,
      emailNotifications: intakeData.email_notifications
    });

    // Skip if email notifications are disabled
    if (!intakeData.email_notifications) {
      console.log('[notify-email] ⚠️ Email notifications disabled for user:', patientUserId);
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'Email notifications disabled'
      });
    }

    // Get patient email from patient_details (single source of truth)
    console.log('[notify-email] 🔍 Fetching patient email from patient_details...');
    const { data: patientDetails, error: detailsError } = await supabase
      .from('patient_details')
      .select('email')
      .eq('user_id', patientUserId)
      .single();

    const patientEmail = patientDetails?.email;

    console.log('[notify-email] 📧 Patient email retrieved:', {
      patientUserId,
      hasEmail: !!patientEmail,
      email: patientEmail ? `${patientEmail.substring(0, 3)}***` : 'null',
      detailsError: detailsError?.message
    });

    if (!patientEmail) {
      console.error('[notify-email] ❌ No email found for user:', patientUserId);
      return NextResponse.json({ error: 'Patient email not found' }, { status: 404 });
    }

    // Create the email HTML content
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">New Message from a Therapist!</h1>
          <h2 style="color: #374151; margin: 10px 0;">You have a new voice message</h2>
        </div>

        <div style="background-color: #f8fafc; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
          ${therapistName ? `<p style="color: #6b7280; margin: 10px 0;"><strong>From: ${therapistName}</strong></p>` : ''}
          <p style="color: #374151; line-height: 1.6;">
            ${therapistName || 'A therapist'} has sent you a voice message in response to your intake session. They believe they may be a good fit to help you on your journey.
          </p>
        </div>

        <div style="text-align: center; margin-bottom: 25px;">
          <a href="https://www.r2ai.me/chatbotV18/p1/messages"
             style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Listen to Message
          </a>
        </div>

        <div style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p>This email was sent because you opted in to receive notifications when therapists send you messages.</p>
          <p>You can manage your notification preferences in your account settings.</p>
          <p style="margin-top: 15px;">
            RiseTwice.com
          </p>
        </div>
      </div>
    `;

    // Send the email
    console.log('[notify-email] 📤 Sending email via Resend...', {
      to: patientEmail,
      therapistName
    });

    const { data, error } = await resend.emails.send({
      from: 'noreply@contactus.risetwice.com',
      to: [patientEmail],
      subject: `${therapistName ? `${therapistName} sent` : 'New'} you a voice message on RiseTwice`,
      html: htmlContent,
    });

    if (error) {
      console.error('[notify-email] ❌ Resend error:', error);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    console.log('[notify-email] ✅ Email sent successfully:', {
      patientEmail,
      therapistName,
      emailId: data?.id
    });

    return NextResponse.json({
      success: true,
      emailId: data?.id
    });

  } catch (error) {
    console.error('Error in notify-therapist-message-email:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
