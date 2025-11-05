// src/app/api/v17/save-elevenlabs-conversation-id/route.ts
// Saves the ElevenLabs conversation ID to the database for later audio retrieval

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { internal_conversation_id, elevenlabs_conversation_id, user_id } = await request.json();

    console.log('[elevenlabs_conv_id] 📥 API called with:', {
      internal_conversation_id,
      elevenlabs_conversation_id,
      user_id
    });

    if (!internal_conversation_id || !elevenlabs_conversation_id) {
      console.error('[elevenlabs_conv_id] ❌ Missing required parameters');
      return NextResponse.json(
        { error: 'internal_conversation_id and elevenlabs_conversation_id are required' },
        { status: 400 }
      );
    }

    // Check if patient_intake record exists first
    console.log('[elevenlabs_conv_id] 🔍 Checking if patient_intake record exists...');
    const { data: existingRecord, error: checkError } = await supabaseAdmin
      .from('patient_intake')
      .select('id, access_code, conversation_id')
      .eq('conversation_id', internal_conversation_id)
      .single();

    if (checkError || !existingRecord) {
      console.error('[elevenlabs_conv_id] ❌ No patient_intake record found:', {
        internal_conversation_id,
        error: checkError?.message
      });
      return NextResponse.json(
        {
          error: 'No patient_intake record found for this conversation_id',
          details: checkError?.message,
          internal_conversation_id
        },
        { status: 404 }
      );
    }

    console.log('[elevenlabs_conv_id] ✅ Found patient_intake record:', {
      id: existingRecord.id,
      access_code: existingRecord.access_code,
      conversation_id: existingRecord.conversation_id
    });

    // Update the patient_intake table with the ElevenLabs conversation ID
    console.log('[elevenlabs_conv_id] 💾 Updating with ElevenLabs conversation ID...');
    const { data, error } = await supabaseAdmin
      .from('patient_intake')
      .update({
        elevenlabs_conversation_id: elevenlabs_conversation_id
      })
      .eq('conversation_id', internal_conversation_id)
      .select();

    if (error) {
      console.error('[elevenlabs_conv_id] ❌ Database update error:', error);
      return NextResponse.json(
        { error: 'Failed to save conversation ID', details: error.message },
        { status: 500 }
      );
    }

    console.log('[elevenlabs_conv_id] ✅ Successfully saved:', {
      internal_conversation_id,
      elevenlabs_conversation_id,
      access_code: existingRecord.access_code,
      updated_records: data?.length || 0
    });

    return NextResponse.json({
      success: true,
      message: 'ElevenLabs conversation ID saved successfully',
      access_code: existingRecord.access_code,
      data
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[elevenlabs_conv_id] ❌ API error:', errorMessage);

    return NextResponse.json({
      success: false,
      error: 'Failed to save ElevenLabs conversation ID',
      details: errorMessage
    }, { status: 500 });
  }
}
