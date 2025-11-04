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

    if (!userId && !email) {
      return NextResponse.json(
        { error: 'Either userId or email is required' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role key for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build query - search by userId first, then email as fallback
    let query = supabase
      .from('patient_intake')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (email) {
      query = query.eq('email', email);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch intake data', details: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      console.log('[patient-intake/get] No intake records found for user:', userId || email);
      return NextResponse.json(
        { success: true, hasData: false, data: null },
        { status: 200 }
      );
    }

    // Return the most recent intake
    console.log('[patient-intake/get] ✅ Returning most recent intake:', {
      userId: userId || email,
      accessCode: data[0].access_code,
      conversationId: data[0].conversation_id,
      createdAt: data[0].created_at
    });

    return NextResponse.json(
      {
        success: true,
        hasData: true,
        data: data[0]
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
