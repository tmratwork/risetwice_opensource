import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    // Load all pending circles (is_approved = false) for admin review
    const { data: pendingCircles, error } = await supabaseAdmin
      .from('circles')
      .select('*')
      .eq('is_approved', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[circle_admin] Error loading pending circles:', error);
      return NextResponse.json(
        { 
          error: `Database error loading pending circles: ${error.message}`,
          details: error 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pendingCircles: pendingCircles || [],
      count: pendingCircles?.length || 0
    });

  } catch (error) {
    console.error('[circle_admin] Unexpected error loading pending circles:', error);
    return NextResponse.json(
      { 
        error: `Unexpected error loading pending circles: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}