// file: src/app/api/v11/transcribe/route.ts

import { NextRequest, NextResponse } from 'next/server';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '10mb',
  },
};

/**
 * Read a ReadableStream and return its contents as a Buffer
 */
// async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
//   const reader = stream.getReader();
//   const chunks: Uint8Array[] = [];

//   while (true) {
//     const { done, value } = await reader.read();
//     if (done) break;
//     if (value) chunks.push(value);
//   }

//   return Buffer.concat(chunks);
// }

/**
 * Parse a multipart/form-data request to extract the audio file
 */
async function parseFormData(req: NextRequest): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    const formData = await req.formData() as unknown as FormData;
    const audioFile = formData.get('file');

    if (!audioFile || !(audioFile instanceof Blob)) {
      throw new Error('No audio file found in request');
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = audioFile.type;

    return { buffer, mimeType };
  } catch (error) {
    console.error('Error parsing form data:', error);
    throw error;
  }
}

/**
 * Transcribe audio using OpenAI's API
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    console.log('[TRANSCRIBE] Received transcription request');

    // Parse the multipart/form-data request
    const { buffer, mimeType } = await parseFormData(req);

    // Validate we have audio data
    if (!buffer || buffer.length === 0) {
      console.error('[TRANSCRIBE] Empty audio buffer');
      return NextResponse.json({ error: 'Empty audio file' }, { status: 400 });
    }

    console.log(`[TRANSCRIBE] Audio file received: ${buffer.length} bytes, ${mimeType}`);

    // Create FormData for OpenAI API
    const form = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    form.append('file', blob, 'audio.webm');
    form.append('model', 'whisper-1');

    // Call OpenAI API
    console.log('[TRANSCRIBE] Sending request to OpenAI');
    const openaiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: form
    });

    // Handle API response
    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error(`[TRANSCRIBE] OpenAI API error: ${openaiResponse.status}`, errorText);
      return NextResponse.json({
        error: `Transcription failed: ${openaiResponse.status}`,
        details: errorText
      }, { status: openaiResponse.status });
    }

    // Parse and return the transcription
    const transcription = await openaiResponse.json();
    console.log('[TRANSCRIBE] Transcription successful', transcription);

    return NextResponse.json(transcription);
  } catch (error) {
    console.error('[TRANSCRIBE] Error:', error);
    return NextResponse.json({
      error: 'Transcription failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}