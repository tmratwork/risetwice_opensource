// src/app/api/patient/send-audio-reply/route.ts
// API route for patient to upload audio replies to provider

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
    if (!accessCode || !providerUserId || !patientUserId || !intakeId || !fileName || !durationSeconds || !mimeType || !audioFile) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Convert File to ArrayBuffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload file to Supabase storage (same bucket as provider messages)
    const { error: uploadError } = await supabase.storage
      .from('provider-patient-messages')
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading patient audio reply:', uploadError);
      return NextResponse.json(
        { success: false, error: 'Failed to upload audio file' },
        { status: 500 }
      );
    }

    // Get public URL for the file
    const { data: publicUrlData } = supabase.storage
      .from('provider-patient-messages')
      .getPublicUrl(fileName);

    // Insert metadata into database with sender_type='patient'
    const { data: dbData, error: dbError } = await supabase
      .from('provider_patient_audio_messages')
      .insert({
        access_code: accessCode,
        provider_user_id: providerUserId,
        patient_user_id: patientUserId,
        intake_id: intakeId,
        audio_url: publicUrlData.publicUrl,
        duration_seconds: durationSeconds,
        file_size_bytes: buffer.length,
        mime_type: mimeType,
        sender_type: 'patient' // Mark as patient message
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error inserting patient audio metadata:', dbError);
      return NextResponse.json(
        { success: false, error: 'Failed to save audio metadata' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: {
        id: dbData.id,
        audioUrl: publicUrlData.publicUrl,
        createdAt: dbData.created_at,
        durationSeconds: dbData.duration_seconds
      }
    });
  } catch (error) {
    console.error('Error in send-audio-reply:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
