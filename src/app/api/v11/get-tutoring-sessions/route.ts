import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    // Get user ID from request body
    const { userId, limit = 5, includeCompleted = false } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Skip user verification - we'll trust the client
    // This is a temporary solution for simplicity
    // In a production app, you would verify the user exists and is authorized

    // Query for the user's tutoring sessions, most recent first
    let query = supabase
      .from('tutoring_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // If includeCompleted is false, filter for incomplete sessions
    if (!includeCompleted) {
      query = query.eq('metadata->isComplete', false);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Error fetching tutoring sessions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, sessions });
  } catch (error) {
    console.error('Error in get-tutoring-sessions:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error retrieving tutoring sessions'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    // Get parameters from URL
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const sessionId = url.searchParams.get('sessionId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Skip user verification - we'll trust the client
    // This is a temporary solution for simplicity
    // In a production app, you would verify the user exists and is authorized

    // If sessionId is provided, get a specific session
    if (sessionId) {
      const { data: session, error } = await supabase
        .from('tutoring_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching specific tutoring session:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, session });
    }

    // Otherwise, get a list of sessions (most recent first, limit 10)
    const { data: sessions, error } = await supabase
      .from('tutoring_sessions')
      .select('id, created_at, session_type, content_type, metadata')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching tutoring sessions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, sessions });
  } catch (error) {
    console.error('Error in get-tutoring-sessions GET:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error retrieving tutoring sessions'
      },
      { status: 500 }
    );
  }
}