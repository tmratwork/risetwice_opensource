// src/app/api/patient-intake/get/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');

    if (process.env.NEXT_PUBLIC_ENABLE_PATIENT_INTAKE_LOGS === 'true') {
      console.log('[patient_intake] [SERVER] 📡 GET request received');
      console.log('[patient_intake] [SERVER] Query params:', { userId, email });
    }

    if (!userId && !email) {
      if (process.env.NEXT_PUBLIC_ENABLE_PATIENT_INTAKE_LOGS === 'true') {
        console.log('[patient_intake] [SERVER] ❌ Missing userId and email');
      }
      return NextResponse.json(
        { error: 'Either userId or email is required' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role key for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build query - search by userId first, then email as fallback
    // IMPORTANT: Filter out V17-created records that have null form data
    // Only return records that have actual intake information
    let query = supabase
      .from('patient_intake')
      .select('*')
      .not('full_legal_name', 'is', null)  // Filter out records without form data
      .order('created_at', { ascending: false })
      .limit(1);

    if (userId) {
      query = query.eq('user_id', userId);
      if (process.env.NEXT_PUBLIC_ENABLE_PATIENT_INTAKE_LOGS === 'true') {
        console.log('[patient_intake] [SERVER] 🔍 Querying by user_id:', userId);
      }
    } else if (email) {
      query = query.eq('email', email);
      if (process.env.NEXT_PUBLIC_ENABLE_PATIENT_INTAKE_LOGS === 'true') {
        console.log('[patient_intake] [SERVER] 🔍 Querying by email:', email);
      }
    }

    const { data, error } = await query;

    if (process.env.NEXT_PUBLIC_ENABLE_PATIENT_INTAKE_LOGS === 'true') {
      console.log('[patient_intake] [SERVER] 📊 Query result:', {
        dataLength: data?.length,
        hasError: !!error,
        errorMessage: error?.message
      });
    }

    if (error) {
      console.error('[patient_intake] [SERVER] ❌ Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch intake data', details: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      if (process.env.NEXT_PUBLIC_ENABLE_PATIENT_INTAKE_LOGS === 'true') {
        console.log('[patient_intake] [SERVER] ℹ️ No intake records found for user:', userId || email);
      }
      return NextResponse.json(
        { success: true, hasData: false, data: null },
        { status: 200 }
      );
    }

    // Return the most recent intake
    if (process.env.NEXT_PUBLIC_ENABLE_PATIENT_INTAKE_LOGS === 'true') {
      console.log('[patient_intake] [SERVER] ✅ Returning most recent intake:', {
        userId: userId || email,
        accessCode: data[0].access_code,
        conversationId: data[0].conversation_id,
        createdAt: data[0].created_at,
        fullLegalName: data[0].full_legal_name,
        phone: data[0].phone,
        state: data[0].state
      });
    }

    return NextResponse.json(
      {
        success: true,
        hasData: true,
        data: data[0]
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('[patient_intake] [SERVER] ❌ API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
