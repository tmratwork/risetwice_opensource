/**
 * API endpoint to retrieve the latest summary sheet for a user
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    // Get query parameters
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log(`[GET_SUMMARY_SHEET] Retrieving latest summary sheet for user ${userId}`);

    // Fetch the latest summary sheet for this user
    const { data: summarySheet, error } = await supabase
      .from('user_summary_sheets')
      .select('*')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // If it's a not found error, return a 404
      if (error.code === 'PGRST116') {
        console.log(`[GET_SUMMARY_SHEET] No summary sheet found for user ${userId}`);
        return NextResponse.json({ summarySheet: null }, { status: 200 });
      }
      
      console.error(`[GET_SUMMARY_SHEET] Error retrieving summary sheet:`, error);
      return NextResponse.json({ 
        error: 'Failed to retrieve summary sheet',
        details: error.message 
      }, { status: 500 });
    }

    // Check if the summary sheet has expired
    const expiresAt = new Date(summarySheet.expires_at);
    const now = new Date();
    
    if (now > expiresAt) {
      console.log(`[GET_SUMMARY_SHEET] Summary sheet has expired, token: ${summarySheet.sharing_token}`);
      return NextResponse.json({ 
        expired: true,
        expiresAt: summarySheet.expires_at,
        summarySheet: null
      }, { status: 200 });
    }

    console.log(`[GET_SUMMARY_SHEET] Successfully retrieved summary sheet with token: ${summarySheet.sharing_token}`);
    
    // Return the summary sheet
    return NextResponse.json({
      summarySheet
    });
  } catch (error) {
    console.error(`[GET_SUMMARY_SHEET] Unexpected error:`, error);
    return NextResponse.json({
      error: 'Failed to retrieve summary sheet',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}