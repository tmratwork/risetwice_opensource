// src/app/api/s2/therapist-profile/route.ts
// Save/update therapist profile data to S2

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TherapistProfileRequest {
  userId: string; // Firebase UID
  fullName: string;
  title: string;
  degrees: string[];
  primaryLocation: string;
  offersOnline: boolean;
  phoneNumber?: string;
  emailAddress?: string;
  dateOfBirth?: string;
}

export async function POST(request: NextRequest) {
  try {
    const data: TherapistProfileRequest = await request.json();

    // Validate required fields
    if (!data.userId || !data.fullName || !data.title || !data.degrees?.length || !data.primaryLocation) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('[S2] Creating/updating therapist profile for user:', data.userId);

    // Upsert therapist profile (create or update)
    const { data: profile, error } = await supabase
      .from('s2_therapist_profiles')
      .upsert({
        user_id: data.userId,
        full_name: data.fullName,
        title: data.title,
        degrees: data.degrees,
        primary_location: data.primaryLocation,
        offers_online: data.offersOnline,
        phone_number: data.phoneNumber || null,
        email_address: data.emailAddress || null,
        date_of_birth: data.dateOfBirth || null,
        profile_completion_status: 'profile_complete'
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('[S2] Error saving therapist profile:', error);
      return NextResponse.json(
        { error: 'Failed to save therapist profile', details: error.message },
        { status: 500 }
      );
    }

    console.log('[S2] ✅ Therapist profile saved:', profile.id);

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        userId: profile.user_id,
        fullName: profile.full_name,
        title: profile.title,
        degrees: profile.degrees,
        primaryLocation: profile.primary_location,
        offersOnline: profile.offers_online,
        phoneNumber: profile.phone_number,
        emailAddress: profile.email_address,
        dateOfBirth: profile.date_of_birth,
        completionStatus: profile.profile_completion_status,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      }
    });

  } catch (error) {
    console.error('[S2] Error in therapist profile API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter required' },
        { status: 400 }
      );
    }

    const { data: profile, error } = await supabase
      .from('s2_therapist_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found is OK
      console.error('[S2] Error fetching therapist profile:', error);
      return NextResponse.json(
        { error: 'Failed to fetch therapist profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: profile ? {
        id: profile.id,
        userId: profile.user_id,
        fullName: profile.full_name,
        title: profile.title,
        degrees: profile.degrees,
        primaryLocation: profile.primary_location,
        offersOnline: profile.offers_online,
        phoneNumber: profile.phone_number,
        emailAddress: profile.email_address,
        dateOfBirth: profile.date_of_birth,
        completionStatus: profile.profile_completion_status,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      } : null
    });

  } catch (error) {
    console.error('[S2] Error in therapist profile GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}