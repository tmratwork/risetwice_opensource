import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    // Get session ID and user ID from request body
    const { sessionId, userId } = await request.json();

    if (!sessionId || !userId) {
      return NextResponse.json({ error: 'Session ID and User ID are required' }, { status: 400 });
    }

    // Skip user verification - we'll trust the client
    // This is a temporary solution for simplicity
    // In a production app, you would verify the user exists and is authorized

    // Verify the session belongs to this user
    const { data: session, error: sessionError } = await supabase
      .from('tutoring_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      console.error('Session not found or not owned by user:', sessionError);
      return NextResponse.json({ error: 'Session not found or not authorized' }, { status: 404 });
    }

    // First, get the current metadata
    const { data: currentSession, error: fetchError } = await supabase
      .from('tutoring_sessions')
      .select('metadata')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching current session metadata:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Merge the current metadata with new values
    const updatedMetadata = {
      ...(currentSession?.metadata || {}),
      isComplete: true,
      completedAt: new Date().toISOString()
    };

    // Update the session metadata to mark it as complete
    const { error } = await supabase
      .from('tutoring_sessions')
      .update({
        metadata: updatedMetadata
      })
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating session:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in complete-tutoring-session:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error completing tutoring session'
      },
      { status: 500 }
    );
  }
}