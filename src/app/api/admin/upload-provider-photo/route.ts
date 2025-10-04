// API route to upload provider photos to Supabase Storage
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const providerId = formData.get('providerId') as string;

    if (!file || !providerId) {
      return NextResponse.json(
        { success: false, error: 'Missing file or provider ID' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only JPG, PNG, and WebP are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const fileName = `${providerId}-${timestamp}.${fileExt}`;
    const filePath = `providers/${fileName}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('profile-photos')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('[UploadProviderPhoto] Storage upload error:', uploadError);
      return NextResponse.json(
        { success: false, error: 'Failed to upload file to storage' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('profile-photos')
      .getPublicUrl(filePath);

    const photoUrl = urlData.publicUrl;

    // Update provider record with photo URL
    const { error: updateError } = await supabaseAdmin
      .from('s2_therapist_profiles')
      .update({ profile_photo_url: photoUrl })
      .eq('id', providerId);

    if (updateError) {
      console.error('[UploadProviderPhoto] Database update error:', updateError);

      // Try to clean up uploaded file
      await supabaseAdmin.storage
        .from('profile-photos')
        .remove([filePath]);

      return NextResponse.json(
        { success: false, error: 'Failed to update provider record' },
        { status: 500 }
      );
    }

    console.log('[UploadProviderPhoto] Successfully uploaded photo for provider:', providerId);

    return NextResponse.json({
      success: true,
      photoUrl,
      message: 'Photo uploaded successfully'
    });
  } catch (error) {
    console.error('[UploadProviderPhoto] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
