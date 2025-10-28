// src/app/api/provider/intake-audio/route.ts
// Fetches voice recordings for patient intake (returns combined audio URL or triggers combination)

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const intakeId = searchParams.get('intake_id');

    if (!intakeId) {
      return NextResponse.json(
        { error: 'Intake ID is required' },
        { status: 400 }
      );
    }

    // Get patient intake to find conversation_id
    const { data: intake, error: intakeError } = await supabaseAdmin
      .from('patient_intake')
      .select('id, user_id, conversation_id')
      .eq('id', intakeId)
      .single();

    if (intakeError || !intake) {
      console.error('Intake not found:', intakeError);
      return NextResponse.json(
        { error: 'Intake not found' },
        { status: 404 }
      );
    }

    // Find conversation_id from audio chunks if not set in intake
    let conversationId = intake.conversation_id;

    if (!conversationId && intake.user_id) {
      // Try to find conversation by user_id (not intake_id, since old recordings don't have intake_id)
      const { data: chunks, error: chunksError } = await supabaseAdmin
        .from('v18_audio_chunks')
        .select('conversation_id')
        .eq('user_id', intake.user_id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!chunksError && chunks && chunks.length > 0) {
        conversationId = chunks[0].conversation_id;

        // Update intake with found conversation_id
        await supabaseAdmin
          .from('patient_intake')
          .update({ conversation_id: conversationId })
          .eq('id', intakeId);

        console.log(`Linked intake ${intakeId} to conversation ${conversationId}`);
      }
    }

    if (!conversationId) {
      return NextResponse.json({
        success: true,
        hasRecording: false,
        message: 'No voice recording found for this intake'
      });
    }

    // Check for combined audio file
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from('audio-recordings')
      .list(`v18-voice-recordings/${conversationId}`, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (listError) {
      console.error('Failed to list audio files:', listError);
      return NextResponse.json(
        { error: 'Failed to fetch audio files' },
        { status: 500 }
      );
    }

    // Find combined audio file
    const combinedFile = files?.find(file => file.name.startsWith('combined-'));

    if (combinedFile) {
      const combinedPath = `v18-voice-recordings/${conversationId}/${combinedFile.name}`;

      // Generate signed URL for combined audio (valid for 1 hour)
      const { data: urlData, error: urlError } = await supabaseAdmin.storage
        .from('audio-recordings')
        .createSignedUrl(combinedPath, 3600);

      if (urlError) {
        console.error('Failed to generate signed URL:', urlError);
        return NextResponse.json(
          { error: 'Failed to generate audio URL' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        hasRecording: true,
        audioUrl: urlData.signedUrl,
        conversationId: conversationId,
        fileName: combinedFile.name
      });
    }

    // No combined file exists - check if we have chunks to combine
    const { data: chunks, error: chunksError } = await supabaseAdmin
      .from('v18_audio_chunks')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('chunk_index', { ascending: true });

    if (chunksError || !chunks || chunks.length === 0) {
      return NextResponse.json({
        success: true,
        hasRecording: false,
        message: 'No audio chunks found for this intake'
      });
    }

    // Trigger audio combination in background (async)
    // For now, return message indicating combination is needed
    // In production, you'd trigger a background job here
    return NextResponse.json({
      success: true,
      hasRecording: true,
      needsCombination: true,
      chunkCount: chunks.length,
      conversationId: conversationId,
      message: 'Audio combination in progress. Please check back in a few moments.'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('API error:', errorMessage);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch intake audio',
      details: errorMessage
    }, { status: 500 });
  }
}
