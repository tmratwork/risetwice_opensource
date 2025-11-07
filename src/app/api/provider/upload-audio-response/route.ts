// src/app/api/provider/upload-audio-response/route.ts
// API route to handle provider audio response uploads

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const accessCode = formData.get('accessCode') as string;
    const providerUserId = formData.get('providerUserId') as string;
    const patientUserId = formData.get('patientUserId') as string;
    const intakeId = formData.get('intakeId') as string;
    const fileName = formData.get('fileName') as string;
    const durationSeconds = parseInt(formData.get('durationSeconds') as string);
    const mimeType = formData.get('mimeType') as string;

    // Validate required fields
    if (!accessCode || !providerUserId || !intakeId || !fileName || !durationSeconds || !mimeType || !audioFile) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If patient_user_id is missing, fetch it from the intake
    let finalPatientUserId = patientUserId;
    if (!finalPatientUserId || finalPatientUserId === '') {
      const { data: intakeData } = await supabase
        .from('intake_sessions')
        .select('user_id')
        .eq('id', intakeId)
        .single();

      if (intakeData?.user_id) {
        finalPatientUserId = intakeData.user_id;
      }
    }

    // Convert File to ArrayBuffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload file to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('provider-patient-messages')
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading audio file:', uploadError);
      return NextResponse.json(
        { success: false, error: 'Failed to upload audio file' },
        { status: 500 }
      );
    }

    // Get public URL for the file
    const { data: publicUrlData } = supabase.storage
      .from('provider-patient-messages')
      .getPublicUrl(fileName);

    // Insert metadata into database
    const { data: dbData, error: dbError } = await supabase
      .from('provider_patient_audio_messages')
      .insert({
        access_code: accessCode,
        provider_user_id: providerUserId,
        patient_user_id: finalPatientUserId,
        intake_id: intakeId,
        audio_url: publicUrlData.publicUrl,
        duration_seconds: durationSeconds,
        file_size_bytes: buffer.length,
        mime_type: mimeType
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error inserting audio metadata:', dbError);
      return NextResponse.json(
        { success: false, error: 'Failed to save audio metadata' },
        { status: 500 }
      );
    }

    // Send notifications to patient (email and SMS)
    // Note: We send these asynchronously and don't block the response
    // Failures in notification sending won't affect the upload success
    if (finalPatientUserId) {
      // Use generic therapist name (provider name not available without firebase-admin)
      const therapistName = 'A therapist';

      // Send email notification (non-blocking, but with proper logging)
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/patient/notify-therapist-message-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientUserId: finalPatientUserId,
          therapistName,
        }),
      })
        .then(async (response) => {
          const result = await response.json();
          if (response.ok) {
            console.log('✅ Email notification sent successfully:', result);
          } else {
            console.error('❌ Email notification failed:', result);
          }
        })
        .catch(error => {
          console.error('❌ Failed to send email notification (network error):', error);
        });

      // Send SMS notification (non-blocking, but with proper logging)
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/patient/notify-therapist-message-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientUserId: finalPatientUserId,
          therapistName,
        }),
      })
        .then(async (response) => {
          const result = await response.json();
          if (response.ok) {
            console.log('✅ SMS notification sent successfully:', result);
          } else {
            console.error('❌ SMS notification failed:', result);
          }
        })
        .catch(error => {
          console.error('❌ Failed to send SMS notification (network error):', error);
        });
    }

    return NextResponse.json({
      success: true,
      recording: {
        id: dbData.id,
        audioUrl: publicUrlData.publicUrl,
        createdAt: dbData.created_at,
        durationSeconds: dbData.duration_seconds
      }
    });
  } catch (error) {
    console.error('Error in upload-audio-response:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
