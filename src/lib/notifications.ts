// src/lib/notifications.ts
// Standalone notification functions for email and SMS

import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function sendEmailNotification(
  patientUserId: string,
  therapistName: string
): Promise<{ success: boolean; emailId?: string; skipped?: boolean; reason?: string; error?: string }> {
  try {
    console.log('[notify-email] 📧 Email notification request received:', {
      patientUserId,
      therapistName
    });

    if (!patientUserId) {
      console.error('[notify-email] ❌ Missing patientUserId');
      throw new Error('Missing required field: patientUserId');
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('[notify-email] ❌ RESEND_API_KEY not configured');
      throw new Error('Email service not configured');
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
      return {
        success: true,
        skipped: true,
        reason: 'No intake record found'
      };
    }

    console.log('[notify-email] 📋 Intake data found:', {
      patientUserId,
      emailNotifications: intakeData.email_notifications
    });

    // Skip if email notifications are disabled
    if (!intakeData.email_notifications) {
      console.log('[notify-email] ⚠️ Email notifications disabled for user:', patientUserId);
      return {
        success: true,
        skipped: true,
        reason: 'Email notifications disabled'
      };
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
      throw new Error('Patient email not found');
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
      throw new Error(`Failed to send email: ${error.message}`);
    }

    console.log('[notify-email] ✅ Email sent successfully:', {
      patientEmail,
      therapistName,
      emailId: data?.id
    });

    return {
      success: true,
      emailId: data?.id
    };

  } catch (error) {
    console.error('[notify-email] ❌ Error in sendEmailNotification:', error);
    throw error;
  }
}

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

// Provider notification functions

export async function sendProviderEmailNotification(
  providerUserId: string,
  patientName: string,
  notificationType: 'ai_preview_used' | 'patient_replied',
  accessCode?: string
): Promise<{ success: boolean; emailId?: string; skipped?: boolean; reason?: string; error?: string }> {
  try {
    console.log('[notify-provider-email] 📧 Provider email notification request received:', {
      providerUserId,
      patientName,
      notificationType,
      accessCode
    });

    if (!providerUserId) {
      console.error('[notify-provider-email] ❌ Missing providerUserId');
      throw new Error('Missing required field: providerUserId');
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('[notify-provider-email] ❌ RESEND_API_KEY not configured');
      throw new Error('Email service not configured');
    }

    // Check provider notification preferences
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: providerData, error: fetchError } = await supabase
      .from('s2_therapist_profiles')
      .select('email_notifications, email_address, full_name')
      .eq('user_id', providerUserId)
      .single();

    if (fetchError || !providerData) {
      console.log('[notify-provider-email] ⚠️ No provider profile found:', {
        providerUserId,
        fetchError: fetchError?.message
      });
      return {
        success: true,
        skipped: true,
        reason: 'No provider profile found'
      };
    }

    console.log('[notify-provider-email] 📋 Provider data found:', {
      providerUserId,
      emailNotifications: providerData.email_notifications
    });

    // Skip if email notifications are disabled
    if (providerData.email_notifications === false) {
      console.log('[notify-provider-email] ⚠️ Email notifications disabled for provider:', providerUserId);
      return {
        success: true,
        skipped: true,
        reason: 'Email notifications disabled'
      };
    }

    const providerEmail = providerData.email_address;

    if (!providerEmail) {
      console.error('[notify-provider-email] ❌ No email found for provider:', providerUserId);
      throw new Error('Provider email not found');
    }

    // Create email content based on notification type
    let subject: string;
    let htmlContent: string;

    if (notificationType === 'ai_preview_used') {
      subject = `${patientName || 'A patient'} tried your AI Preview on RiseTwice`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">AI Preview Used!</h1>
            <h2 style="color: #374151; margin: 10px 0;">A patient experienced your AI Preview</h2>
          </div>

          <div style="background-color: #f8fafc; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <p style="color: #374151; line-height: 1.6;">
              ${patientName || 'A patient'} has completed an AI Preview session with your digital twin. This means they're interested in learning more about your therapy approach.
            </p>
            ${accessCode ? `
            <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin-top: 20px; border: 2px solid #2563eb;">
              <p style="color: #374151; margin: 0 0 10px 0; font-weight: bold;">Access Code:</p>
              <p style="color: #2563eb; font-size: 28px; font-weight: bold; margin: 0; letter-spacing: 3px;">${accessCode}</p>
              <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 14px;">Enter this code in your dashboard to view their intake information</p>
            </div>
            ` : ''}
          </div>

          <div style="text-align: center; margin-bottom: 25px;">
            <a href="https://www.r2ai.me/dashboard/provider"
               style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Dashboard
            </a>
          </div>

          <div style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p>You can manage your notification preferences in your account settings.</p>
            <p style="margin-top: 15px;">RiseTwice.com</p>
          </div>
        </div>
      `;
    } else {
      subject = `${patientName || 'A patient'} replied to your message on RiseTwice`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">New Patient Reply!</h1>
            <h2 style="color: #374151; margin: 10px 0;">You have a new voice message</h2>
          </div>

          <div style="background-color: #f8fafc; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <p style="color: #374151; line-height: 1.6;">
              ${patientName || 'A patient'} has sent you a voice message in response to your introduction. They're interested in connecting with you.
            </p>
          </div>

          <div style="text-align: center; margin-bottom: 25px;">
            <a href="https://www.r2ai.me/dashboard/provider"
               style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Listen to Message
            </a>
          </div>

          <div style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p>You can manage your notification preferences in your account settings.</p>
            <p style="margin-top: 15px;">RiseTwice.com</p>
          </div>
        </div>
      `;
    }

    // Send the email
    console.log('[notify-provider-email] 📤 Sending email via Resend...', {
      to: providerEmail,
      notificationType
    });

    const { data, error } = await resend.emails.send({
      from: 'noreply@contactus.risetwice.com',
      to: [providerEmail],
      subject,
      html: htmlContent,
    });

    if (error) {
      console.error('[notify-provider-email] ❌ Resend error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    console.log('[notify-provider-email] ✅ Email sent successfully:', {
      providerEmail,
      notificationType,
      emailId: data?.id
    });

    return {
      success: true,
      emailId: data?.id
    };

  } catch (error) {
    console.error('[notify-provider-email] ❌ Error in sendProviderEmailNotification:', error);
    throw error;
  }
}

export async function sendProviderSMSNotification(
  providerUserId: string,
  patientName: string,
  notificationType: 'ai_preview_used' | 'patient_replied',
  accessCode?: string
): Promise<{ success: boolean; textId?: string; quotaRemaining?: number; skipped?: boolean; reason?: string }> {
  try {
    console.log('[notify-provider-sms] 📱 Provider SMS notification request received:', {
      providerUserId,
      patientName,
      notificationType,
      accessCode
    });

    if (!providerUserId) {
      console.error('[notify-provider-sms] ❌ Missing providerUserId');
      throw new Error('Missing required field: providerUserId');
    }

    if (!process.env.TEXTBELT_API_KEY) {
      console.error('[notify-provider-sms] ❌ TEXTBELT_API_KEY not configured');
      throw new Error('SMS service not configured');
    }

    // Check provider notification preferences and get phone number
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: providerData, error: fetchError } = await supabase
      .from('s2_therapist_profiles')
      .select('sms_notifications, notification_phone, phone_number')
      .eq('user_id', providerUserId)
      .single();

    if (fetchError || !providerData) {
      console.log('[notify-provider-sms] ⚠️ No provider profile found:', {
        providerUserId,
        fetchError: fetchError?.message
      });
      return {
        success: true,
        skipped: true,
        reason: 'No provider profile found'
      };
    }

    console.log('[notify-provider-sms] 📋 Provider data found:', {
      providerUserId,
      smsNotifications: providerData.sms_notifications
    });

    // Skip if SMS notifications are disabled
    if (providerData.sms_notifications === false) {
      console.log('[notify-provider-sms] ⚠️ SMS notifications disabled for provider:', providerUserId);
      return {
        success: true,
        skipped: true,
        reason: 'SMS notifications disabled'
      };
    }

    // Get phone number (prefer notification_phone, fallback to phone_number)
    const phoneNumber = providerData.notification_phone || providerData.phone_number;

    console.log('[notify-provider-sms] 📞 Phone number found:', {
      providerUserId,
      hasPhone: !!phoneNumber,
      source: providerData.notification_phone ? 'notification_phone' : 'phone'
    });

    if (!phoneNumber) {
      console.error('[notify-provider-sms] ❌ No phone number found for provider:', providerUserId);
      throw new Error('Provider phone number not found');
    }

    // Create the SMS message content based on notification type
    let message: string;

    if (notificationType === 'ai_preview_used') {
      message = `🎉 ${patientName || 'A patient'} tried your AI Preview on RiseTwice!\n\n`;
      message += `They're interested in learning about your therapy approach.\n\n`;
      if (accessCode) {
        message += `Access Code: ${accessCode}\n\n`;
        message += `Enter this code in your dashboard to view their intake.\n\n`;
      }
      message += `Visit https://www.r2ai.me/dashboard/provider\n\n`;
      message += `- RiseTwice`;
    } else {
      message = `🎉 New voice message from ${patientName || 'a patient'}!\n\n`;
      message += `They've replied to your introduction message.\n\n`;
      message += `Visit https://www.r2ai.me/dashboard/provider to listen.\n\n`;
      message += `- RiseTwice`;
    }

    // Send SMS via Textbelt API
    console.log('[notify-provider-sms] 📤 Sending SMS via Textbelt...');
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
      console.error('[notify-provider-sms] ❌ Textbelt error:', textbeltData.error);
      throw new Error(`Failed to send SMS: ${textbeltData.error}`);
    }

    console.log('[notify-provider-sms] ✅ SMS sent successfully:', {
      phoneNumber,
      notificationType,
      textId: textbeltData.textId,
      quotaRemaining: textbeltData.quotaRemaining
    });

    return {
      success: true,
      textId: textbeltData.textId,
      quotaRemaining: textbeltData.quotaRemaining
    };

  } catch (error) {
    console.error('[notify-provider-sms] ❌ Error in sendProviderSMSNotification:', error);
    throw error;
  }
}
