import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromUserId, toUserId, promptCategory } = body;
    
    if (!fromUserId || !toUserId || !promptCategory) {
      return NextResponse.json(
        { error: 'Missing required fields: fromUserId, toUserId, promptCategory' },
        { status: 400 }
      );
    }
    
    // Find the most recent prompt version assigned to the source user
    const { data: sourceAssignment, error: fetchError } = await supabase
      .from('user_prompt_assignments')
      .select(`
        prompt_version_id,
        prompt_versions!inner(
          id,
          content,
          version_number,
          prompt_id,
          prompts!inner(category)
        )
      `)
      .eq('user_id', fromUserId)
      .eq('prompt_versions.prompts.category', promptCategory)
      .order('assigned_at', { ascending: false })
      .limit(1);
    
    if (fetchError) {
      console.error('Error fetching source prompt:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch source prompt', details: fetchError.message },
        { status: 500 }
      );
    }
    
    if (!sourceAssignment || sourceAssignment.length === 0) {
      return NextResponse.json(
        { error: `No ${promptCategory} prompt found for source user` },
        { status: 404 }
      );
    }
    
    const promptVersionId = sourceAssignment[0].prompt_version_id;
    
    // Create a new assignment for the target user
    const { data: newAssignment, error: assignError } = await supabase
      .from('user_prompt_assignments')
      .insert({
        user_id: toUserId,
        prompt_version_id: promptVersionId,
        assigned_by: fromUserId
      })
      .select('id')
      .single();
    
    if (assignError) {
      console.error('Error creating prompt assignment:', assignError);
      return NextResponse.json(
        { error: 'Failed to share prompt', details: assignError.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true, 
      message: `${promptCategory} prompt successfully shared with user ${toUserId}`,
      assignmentId: newAssignment.id
    });
  } catch (error) {
    console.error('Unexpected error in share-prompt endpoint:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}