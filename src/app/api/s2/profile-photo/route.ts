// src/app/api/s2/profile-photo/route.ts
// Server-side profile photo upload using service role key

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create Supabase client with service role key (bypasses RLS)
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    if (!file || !userId) {
      return NextResponse.json(
        { success: false, error: 'File and userId are required' },
        { status: 400 }
      );
    }

    // Generate unique filename with user ID prefix
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    console.log('[S2] [SERVER] Uploading profile photo:', fileName);

    // Upload to Supabase Storage using service role
    const { data, error } = await supabaseService.storage
      .from('profile-photos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('[S2] [SERVER] Error uploading profile photo:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to upload photo' },
        { status: 500 }
      );
    }

    // Get the public URL
    const { data: publicUrlData } = supabaseService.storage
      .from('profile-photos')
      .getPublicUrl(data.path);

    console.log('[S2] [SERVER] ✅ Profile photo uploaded successfully:', publicUrlData.publicUrl);

    return NextResponse.json({
      success: true,
      url: publicUrlData.publicUrl,
      path: data.path
    });

  } catch (error) {
    console.error('[S2] [SERVER] Error in profile photo upload:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}