// src/app/api/v18/voice-recordings/route.ts
// API endpoint to fetch V18 voice recordings for admin review

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const logPrefix = '[v18_voice_recordings_api]';

  try {
    const searchParams = request.nextUrl.searchParams;
    const conversationId = searchParams.get('conversation_id');

    console.log(`${logPrefix} Fetching voice recordings`, { conversationId });

    if (conversationId) {
      // Fetch chunks for specific conversation
      const { data: chunks, error: chunksError } = await supabaseAdmin
        .from('v18_audio_chunks')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('chunk_index', { ascending: true });

      if (chunksError) {
        console.error(`${logPrefix} Error fetching chunks:`, chunksError);
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch audio chunks',
          details: chunksError.message
        }, { status: 500 });
      }

      // Generate signed URLs for each chunk
      const chunksWithUrls = await Promise.all(
        (chunks || []).map(async (chunk) => {
          const { data: urlData, error: urlError } = await supabaseAdmin.storage
            .from('audio-recordings')
            .createSignedUrl(chunk.storage_path, 3600); // 1 hour expiry

          if (urlError) {
            console.error(`${logPrefix} Failed to generate signed URL for ${chunk.storage_path}:`, urlError);
          }

          // Also generate public URL as fallback
          const { data: publicUrlData } = supabaseAdmin.storage
            .from('audio-recordings')
            .getPublicUrl(chunk.storage_path);

          console.log(`${logPrefix} URLs generated for chunk ${chunk.chunk_index}:`, {
            signedUrl: urlData?.signedUrl?.substring(0, 100),
            publicUrl: publicUrlData?.publicUrl?.substring(0, 100),
            hasSignedUrl: !!urlData?.signedUrl,
            hasPublicUrl: !!publicUrlData?.publicUrl
          });

          return {
            ...chunk,
            signed_url: urlData?.signedUrl || null,
            public_url: publicUrlData?.publicUrl || null
          };
        })
      );

      return NextResponse.json({
        success: true,
        conversation_id: conversationId,
        chunks: chunksWithUrls,
        total_chunks: chunksWithUrls.length
      });
    } else {
      // Fetch all conversations with voice recordings (grouped view)
      const { data: recordings, error: recordingsError } = await supabaseAdmin
        .from('v18_audio_chunks')
        .select('conversation_id, created_at')
        .order('created_at', { ascending: false });

      if (recordingsError) {
        console.error(`${logPrefix} Error fetching recordings:`, recordingsError);
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch voice recordings',
          details: recordingsError.message
        }, { status: 500 });
      }

      // Group by conversation_id and count chunks
      const conversationMap = new Map<string, { conversation_id: string; created_at: string; chunk_count: number }>();

      recordings?.forEach(record => {
        const existing = conversationMap.get(record.conversation_id);
        if (existing) {
          existing.chunk_count++;
        } else {
          conversationMap.set(record.conversation_id, {
            conversation_id: record.conversation_id,
            created_at: record.created_at,
            chunk_count: 1
          });
        }
      });

      const conversations = Array.from(conversationMap.values());

      // Check for already-combined audio files for each conversation
      const conversationsWithCombinedUrl = await Promise.all(
        conversations.map(async (conv) => {
          try {
            // List all files in the conversation's combined folder
            const { data: files, error: listError } = await supabaseAdmin.storage
              .from('audio-recordings')
              .list(`v18-voice-recordings/${conv.conversation_id}`, {
                limit: 100,
                sortBy: { column: 'created_at', order: 'desc' }
              });

            if (listError) {
              console.error(`${logPrefix} Failed to list combined files for ${conv.conversation_id}:`, listError);
              return conv;
            }

            // Find the most recent combined file
            const combinedFile = files?.find(file => file.name.startsWith('combined-'));

            if (combinedFile) {
              const combinedPath = `v18-voice-recordings/${conv.conversation_id}/${combinedFile.name}`;
              const { data: publicUrlData } = supabaseAdmin.storage
                .from('audio-recordings')
                .getPublicUrl(combinedPath);

              console.log(`${logPrefix} Found combined audio for ${conv.conversation_id}: ${combinedPath}`);

              return {
                ...conv,
                combined_audio_url: publicUrlData.publicUrl
              };
            }

            return conv;
          } catch (error) {
            console.error(`${logPrefix} Error checking combined audio for ${conv.conversation_id}:`, error);
            return conv;
          }
        })
      );

      return NextResponse.json({
        success: true,
        conversations: conversationsWithCombinedUrl,
        total_conversations: conversationsWithCombinedUrl.length
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${logPrefix} API error:`, errorMessage);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch voice recordings',
      details: errorMessage
    }, { status: 500 });
  }
}
