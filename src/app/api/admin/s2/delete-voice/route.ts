import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { therapistProfileId } = body;

    console.log(`[voice_deletion] 🗑️ Starting voice deletion for therapist: ${therapistProfileId}`);

    if (!therapistProfileId) {
      console.log(`[voice_deletion] ❌ Missing therapist profile ID`);
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_THERAPIST_ID',
          message: 'Therapist profile ID is required'
        },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current voice ID
    console.log(`[voice_deletion] 🔍 Looking up therapist profile and voice ID...`);
    const { data: profile, error: profileError } = await supabase
      .from('s2_therapist_profiles')
      .select('cloned_voice_id, full_name')
      .eq('id', therapistProfileId)
      .single();

    if (profileError) {
      console.log(`[voice_deletion] ❌ Therapist profile not found: ${profileError.message}`);
      return NextResponse.json(
        {
          success: false,
          error: 'THERAPIST_NOT_FOUND',
          message: `Failed to find therapist profile: ${profileError.message}`
        },
        { status: 404 }
      );
    }

    console.log(`[voice_deletion] 👩‍⚕️ Found therapist: ${profile.full_name}`);

    if (!profile.cloned_voice_id) {
      console.log(`[voice_deletion] ⚠️ No voice to delete for ${profile.full_name}`);
      return NextResponse.json(
        {
          success: false,
          error: 'NO_VOICE_TO_DELETE',
          message: `No cloned voice found for ${profile.full_name}. Nothing to delete.`
        },
        { status: 400 }
      );
    }

    console.log(`[voice_deletion] 🎤 Found voice to delete: ${profile.cloned_voice_id}`);

    // Delete voice from ElevenLabs
    console.log(`[voice_deletion] 🌐 Deleting voice from ElevenLabs...`);
    await deleteVoiceFromElevenLabs(profile.cloned_voice_id);
    console.log(`[voice_deletion] ✅ Voice deleted from ElevenLabs successfully`);

    // Remove voice ID from database
    console.log(`[voice_deletion] 💾 Updating database to remove voice ID...`);
    const { error: updateError } = await supabase
      .from('s2_therapist_profiles')
      .update({ cloned_voice_id: null })
      .eq('id', therapistProfileId);

    if (updateError) {
      console.log(`[voice_deletion] ❌ Database update failed: ${updateError.message}`);
      return NextResponse.json(
        {
          success: false,
          error: 'DATABASE_UPDATE_FAILED',
          message: `Voice deleted from ElevenLabs but failed to update database: ${updateError.message}`
        },
        { status: 500 }
      );
    }

    console.log(`[voice_deletion] 🎉 Voice deletion completed successfully for ${profile.full_name}`);

    return NextResponse.json({
      success: true,
      message: `Cloned voice deleted successfully for ${profile.full_name}`,
      deleted_voice_id: profile.cloned_voice_id
    });

  } catch (error) {
    console.error('Voice deletion error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'VOICE_DELETION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error occurred during voice deletion'
      },
      { status: 500 }
    );
  }
}

async function deleteVoiceFromElevenLabs(voiceId: string): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required');
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
    method: 'DELETE',
    headers: {
      'xi-api-key': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    // If voice doesn't exist (404), consider it already deleted
    if (response.status === 404) {
      console.warn(`Voice ${voiceId} not found in ElevenLabs, considering it already deleted`);
      return;
    }

    throw new Error(`Failed to delete voice from ElevenLabs (${response.status}): ${errorText}`);
  }
}