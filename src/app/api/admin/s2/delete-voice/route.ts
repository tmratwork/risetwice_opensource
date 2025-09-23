import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { therapistProfileId } = body;

    if (!therapistProfileId) {
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
    const { data: profile, error: profileError } = await supabase
      .from('s2_therapist_profiles')
      .select('cloned_voice_id, full_name')
      .eq('id', therapistProfileId)
      .single();

    if (profileError) {
      return NextResponse.json(
        {
          success: false,
          error: 'THERAPIST_NOT_FOUND',
          message: `Failed to find therapist profile: ${profileError.message}`
        },
        { status: 404 }
      );
    }

    if (!profile.cloned_voice_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'NO_VOICE_TO_DELETE',
          message: `No cloned voice found for ${profile.full_name}. Nothing to delete.`
        },
        { status: 400 }
      );
    }

    // Delete voice from ElevenLabs
    await deleteVoiceFromElevenLabs(profile.cloned_voice_id);

    // Remove voice ID from database
    const { error: updateError } = await supabase
      .from('s2_therapist_profiles')
      .update({ cloned_voice_id: null })
      .eq('id', therapistProfileId);

    if (updateError) {
      return NextResponse.json(
        {
          success: false,
          error: 'DATABASE_UPDATE_FAILED',
          message: `Voice deleted from ElevenLabs but failed to update database: ${updateError.message}`
        },
        { status: 500 }
      );
    }

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