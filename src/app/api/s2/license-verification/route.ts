// src/app/api/s2/license-verification/route.ts
// Save/update license verification data to S2

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface LicenseVerificationRequest {
  userId: string; // Firebase UID
  licenseType: string;
  licenseNumber: string;
  stateOfLicensure: string;
  otherLicenseType?: string;
}

export async function POST(request: NextRequest) {
  try {
    const data: LicenseVerificationRequest = await request.json();

    // Validate required fields
    if (!data.userId || !data.licenseType || !data.licenseNumber || !data.stateOfLicensure) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('[S2] Creating/updating license verification for user:', data.userId);

    // First, deactivate any existing active license verification for this user
    await supabase
      .from('s2_license_verifications')
      .update({ is_active: false })
      .eq('user_id', data.userId)
      .eq('is_active', true);

    // Insert new license verification
    const { data: licenseData, error } = await supabase
      .from('s2_license_verifications')
      .insert({
        user_id: data.userId,
        license_type: data.licenseType,
        license_number: data.licenseNumber,
        state_of_licensure: data.stateOfLicensure,
        other_license_type: data.otherLicenseType || null,
        verification_status: 'pending',
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('[S2] Error saving license verification:', error);
      return NextResponse.json(
        { error: 'Failed to save license verification', details: error.message },
        { status: 500 }
      );
    }

    console.log('[S2] ✅ License verification saved:', licenseData.id);

    return NextResponse.json({
      success: true,
      licenseData: {
        id: licenseData.id,
        userId: licenseData.user_id,
        licenseType: licenseData.license_type,
        licenseNumber: licenseData.license_number,
        stateOfLicensure: licenseData.state_of_licensure,
        otherLicenseType: licenseData.other_license_type,
        verificationStatus: licenseData.verification_status,
        verificationDate: licenseData.verification_date,
        createdAt: licenseData.created_at,
        updatedAt: licenseData.updated_at
      }
    });

  } catch (error) {
    console.error('[S2] Error in license verification API:', error);
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

    const { data: licenseData, error } = await supabase
      .from('s2_license_verifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found is OK
      console.error('[S2] Error fetching license verification:', error);
      return NextResponse.json(
        { error: 'Failed to fetch license verification' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      licenseData: licenseData ? {
        id: licenseData.id,
        userId: licenseData.user_id,
        licenseType: licenseData.license_type,
        licenseNumber: licenseData.license_number,
        stateOfLicensure: licenseData.state_of_licensure,
        otherLicenseType: licenseData.other_license_type,
        verificationStatus: licenseData.verification_status,
        verificationDate: licenseData.verification_date,
        createdAt: licenseData.created_at,
        updatedAt: licenseData.updated_at
      } : null
    });

  } catch (error) {
    console.error('[S2] Error in license verification GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}