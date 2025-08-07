// file: src/app/api/v11/save-bug-report

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Ensure required fields are present
    if (!body.user_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate that at least some form of feedback is provided
    const hasMessage = body.message && body.message.trim() !== '';
    const hasFeedback = body.thumbs_up || body.thumbs_down || 
                       (body.less_of_feedback && body.less_of_feedback.trim() !== '') ||
                       (body.more_of_feedback && body.more_of_feedback.trim() !== '');
    
    if (!hasMessage && !hasFeedback) {
      return NextResponse.json(
        { error: 'Please provide some form of feedback' },
        { status: 400 }
      );
    }

    // Insert data into Supabase
    const { data, error } = await supabase
      .from('user_bug_reports')
      .insert([{
        user_id: body.user_id,
        message: body.message || '',
        contact_phone: body.contact_phone || null,
        contact_email: body.contact_email || null,
        logs: body.logs || [],
        browser_info: body.browser_info || {},
        session_id: body.session_id || `session-${Date.now()}`,
        webrtc_state: body.webrtc_state || {},
        audio_queue_state: body.audio_queue_state || {},
        conversation_id: body.conversation_id || null,
        // New feedback fields
        message_id: body.message_id || null,
        feedback_type: body.feedback_type || 'general',
        thumbs_up: body.thumbs_up || false,
        thumbs_down: body.thumbs_down || false,
        less_of_feedback: body.less_of_feedback || null,
        more_of_feedback: body.more_of_feedback || null,
        allow_conversation_access: body.allow_conversation_access !== undefined ? body.allow_conversation_access : true
      }]);

    if (error) {
      console.error('Error saving bug report:', error);
      return NextResponse.json(
        { error: 'Failed to save bug report' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Unexpected error in save-bug-report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}