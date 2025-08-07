/**
 * API endpoint for submitting feedback on user insights
 * This enables users to rate the quality, accuracy and helpfulness of insights
 * which helps improve the system and validates the trauma-informed approach
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface FeedbackRequest {
  insightId: string;
  accuracy?: number;
  helpfulness?: number;
  respectfulness?: number;
  feedbackText?: string;
}

export async function POST(req: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[INSIGHT-FEEDBACK-${requestId}]`;

  try {
    const body: FeedbackRequest = await req.json();
    const { insightId, accuracy, helpfulness, respectfulness, feedbackText } = body;

    // Basic validation
    if (!insightId) {
      return NextResponse.json({ error: 'Insight ID is required' }, { status: 400 });
    }

    // Get the user ID from authentication or headers
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      // Extract token and verify
      const token = authHeader.replace('Bearer ', '');
      // In a real implementation, you would verify the token
      userId = token; // Simplified for example
    } else {
      // Try to get from URL parameters
      const url = new URL(req.url);
      const userIdParam = url.searchParams.get('userId');
      userId = userIdParam;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log(`${logPrefix} Recording feedback for insight ${insightId} from user ${userId}`);

    // Verify the insight exists and belongs to this user
    const { data: insight, error: insightError } = await supabase
      .from('user_insights')
      .select('id, user_id')
      .eq('id', insightId)
      .single();

    if (insightError) {
      console.error(`${logPrefix} Error verifying insight:`, insightError);
      return NextResponse.json({ 
        error: 'Failed to verify insight', 
        details: insightError.message 
      }, { status: 500 });
    }

    // Security check - ensure the insight belongs to the user
    if (insight.user_id !== userId) {
      console.error(`${logPrefix} User ${userId} attempted to feedback on insight belonging to ${insight.user_id}`);
      return NextResponse.json({ 
        error: 'You can only provide feedback on your own insights' 
      }, { status: 403 });
    }

    // Check if feedback already exists
    const { data: existingFeedback, error: checkError } = await supabase
      .from('insight_feedback')
      .select('id')
      .eq('insight_id', insightId)
      .eq('user_id', userId)
      .single();

    let result;
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error(`${logPrefix} Error checking existing feedback:`, checkError);
      return NextResponse.json({ 
        error: 'Failed to check existing feedback', 
        details: checkError.message 
      }, { status: 500 });
    }

    // Prepare feedback object
    const feedbackData = {
      insight_id: insightId,
      user_id: userId,
      accuracy_rating: accuracy,
      helpfulness_rating: helpfulness,
      respectfulness_rating: respectfulness,
      feedback_text: feedbackText,
      updated_at: new Date()
    };

    // Update or insert as needed
    if (existingFeedback) {
      // Update existing feedback
      const { data, error: updateError } = await supabase
        .from('insight_feedback')
        .update(feedbackData)
        .eq('id', existingFeedback.id)
        .select()
        .single();

      if (updateError) {
        console.error(`${logPrefix} Error updating feedback:`, updateError);
        return NextResponse.json({ 
          error: 'Failed to update feedback', 
          details: updateError.message 
        }, { status: 500 });
      }

      result = data;
    } else {
      // Insert new feedback
      const { data, error: insertError } = await supabase
        .from('insight_feedback')
        .insert({
          ...feedbackData,
          created_at: new Date()
        })
        .select()
        .single();

      if (insertError) {
        console.error(`${logPrefix} Error creating feedback:`, insertError);
        return NextResponse.json({ 
          error: 'Failed to save feedback', 
          details: insertError.message 
        }, { status: 500 });
      }

      result = data;
    }

    // Also update the insights table to mark as reviewed
    await supabase
      .from('user_insights')
      .update({
        has_feedback: true,
        updated_at: new Date()
      })
      .eq('id', insightId);

    return NextResponse.json({ 
      success: true,
      feedback: result
    });
  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}