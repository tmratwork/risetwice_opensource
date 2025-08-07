import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API endpoint to update the global status of a prompt
 * This fixes an issue where the is_global flag wasn't being properly updated in the database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { promptId, isGlobal } = body;

    if (!promptId) {
      return NextResponse.json(
        { error: 'Missing required promptId field' },
        { status: 400 }
      );
    }

    if (typeof isGlobal !== 'boolean') {
      return NextResponse.json(
        { error: 'isGlobal must be a boolean value' },
        { status: 400 }
      );
    }

    // Log details about the update operation
    console.log(`Updating prompt ${promptId} isGlobal to ${isGlobal} (type: ${typeof isGlobal})`);

    // Update the prompt record - pass the boolean value directly
    const { data, error } = await supabase
      .from('prompts')
      .update({ 
        is_global: isGlobal, // Use boolean value directly since column is boolean type
        updated_at: new Date().toISOString()
      })
      .eq('id', promptId)
      .select('id, name, is_global')
      .single();

    if (error) {
      console.error('Error updating prompt global status:', error);
      return NextResponse.json(
        { error: 'Failed to update prompt global status', details: error.message },
        { status: 500 }
      );
    }

    // Log the updated record to verify the is_global value
    console.log('Updated prompt:', data);

    return NextResponse.json({ 
      success: true, 
      message: `Prompt global status updated successfully to ${isGlobal}`,
      data 
    });
  } catch (error) {
    console.error('Unexpected error in update-prompt-global endpoint:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}