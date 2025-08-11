import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/v16/community/audio/upload - Upload audio file to Supabase storage
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData() as unknown as FormData;
    const file = formData.get('audio') as File;
    const userId = formData.get('userId') as string;

    console.log('Upload request received:', {
      fileExists: !!file,
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size,
      userIdExists: !!userId,
      userId: userId
    });

    if (!file) {
      console.error('No audio file provided in FormData');
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    if (!userId) {
      console.error('No userId provided in FormData');
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedMimeTypes = [
      'audio/webm', 
      'audio/webm;codecs=opus',
      'audio/mp4', 
      'audio/mpeg', 
      'audio/wav'
    ];
    if (!allowedMimeTypes.includes(file.type)) {
      console.error('Invalid file type:', file.type, 'Allowed types:', allowedMimeTypes);
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a valid audio file.' },
        { status: 400 }
      );
    }

    // Validate file size (50MB limit based on bucket config)
    const maxSize = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB.' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || 'webm';
    const fileName = `community_posts/${userId}/${timestamp}.${fileExtension}`;

    // Convert File to ArrayBuffer
    const fileBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(fileBuffer);

    // Upload to Supabase storage
    const { error } = await supabase.storage
      .from('audio-recordings')
      .upload(fileName, uint8Array, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error uploading file:', error);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('audio-recordings')
      .getPublicUrl(fileName);

    if (!publicUrlData.publicUrl) {
      return NextResponse.json(
        { error: 'Failed to get public URL' },
        { status: 500 }
      );
    }

    // Calculate duration (approximate from file size for now)
    // Note: For more accurate duration, you'd need to use a media processing library
    const estimatedDuration = Math.round(file.size / 32000); // Rough estimation

    return NextResponse.json({
      success: true,
      audio_url: publicUrlData.publicUrl,
      audio_duration: estimatedDuration,
      file_size: file.size,
      file_name: fileName
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}