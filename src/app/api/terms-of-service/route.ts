// src/app/api/terms-of-service/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Fetch the active Terms of Service
    const { data, error } = await supabase
      .from('terms_of_service')
      .select('*')
      .eq('is_active', true)
      .order('effective_date', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching Terms of Service:', error);
      return NextResponse.json(
        { error: 'Failed to fetch Terms of Service' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'No active Terms of Service found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: data.id,
      version: data.version,
      title: data.title,
      content: data.content,
      effective_date: data.effective_date,
      last_updated: data.last_updated
    });

  } catch (error) {
    console.error('Error in Terms of Service API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}