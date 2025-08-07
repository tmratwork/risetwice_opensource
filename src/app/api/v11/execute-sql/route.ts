import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { sql } = await request.json();

    if (!sql) {
      return NextResponse.json({ error: 'SQL query is required' }, { status: 400 });
    }

    // Execute raw SQL query
    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('Error executing SQL:', error);
      return NextResponse.json({ error: 'Error executing SQL', details: error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in execute-sql API route:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}