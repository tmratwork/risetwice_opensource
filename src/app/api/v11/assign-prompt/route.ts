import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const requestId = Date.now().toString().slice(-6);
  try {
    const body = await request.json();
    console.log(`[ASSIGN-PROMPT:${requestId}] Request body:`, JSON.stringify(body));
    console.log(`[ASSIGN-PROMPT:${requestId}] Full request details:`, {
      body,
      timestamp: new Date().toISOString(),
      endpoint: '/api/v11/assign-prompt'
    });
    
    const { userId, promptVersionId, assignedBy } = body;
    
    console.log(`[ASSIGN-PROMPT:${requestId}] Extracted parameters:`, {
      userId: typeof userId === 'string' ? `${userId.substring(0, 10)}... (${typeof userId})` : typeof userId,
      promptVersionId: typeof promptVersionId === 'string' ? `${promptVersionId.substring(0, 10)}... (${typeof promptVersionId})` : typeof promptVersionId,
      assignedBy: typeof assignedBy === 'string' ? `${assignedBy.substring(0, 10)}... (${typeof assignedBy})` : typeof assignedBy
    });

    if (!userId || !promptVersionId || !assignedBy) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Ensure promptVersionId is a string and valid UUID format (it should be)
    const promptVersionIdString = typeof promptVersionId === 'string' 
      ? promptVersionId 
      : String(promptVersionId);
      
    console.log(`[ASSIGN-PROMPT:${requestId}] Direct database insertion with Firebase ID:`, { 
      userId,
      promptVersionId: promptVersionIdString,
      assignedBy 
    });

    // Direct database insertion using Supabase
    // This bypasses the assignPromptToUser function which requires UUID format
    const { data: newAssignment, error } = await supabase
      .from('user_prompt_assignments')
      .insert({
        user_id: userId,
        prompt_version_id: promptVersionIdString,
        assigned_by: assignedBy
      })
      .select('id')
      .single();
      
    if (error) {
      console.error(`[ASSIGN-PROMPT:${requestId}] Error creating prompt assignment:`, error);
      
      if (error.message.includes('invalid input syntax for type uuid')) {
        console.error(`[ASSIGN-PROMPT:${requestId}] UUID FORMAT ERROR in database insertion:`, {
          promptVersionId: typeof promptVersionId === 'string' ? `${promptVersionId.substring(0, 10)}...` : promptVersionId,
          errorDetails: error.message,
          guidance: "The user_prompt_assignments table likely requires UUID format for user_id column"
        });
        
        return NextResponse.json({
          success: false,
          error: 'Database schema mismatch',
          details: 'The user_prompt_assignments table requires UUID format but received Firebase ID format',
          debug_id: requestId
        }, { status: 400 });
      }
      
      return NextResponse.json({
        success: false,
        error: 'Failed to assign prompt',
        details: error.message
      }, { status: 500 });
    }
    
    console.log(`[ASSIGN-PROMPT:${requestId}] Successfully created assignment with ID:`, newAssignment?.id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[ASSIGN-PROMPT:${requestId}] Unexpected error:`, {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 300) // Limit stack trace size
      } : String(error),
      timestamp: new Date().toISOString()
    });

    // Handle reference error when userId is accessed in catch block
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to assign prompt',
      details: errorMessage,
      debug_id: requestId
    }, { status: 500 });
  }
}