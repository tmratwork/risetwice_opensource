import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API route for fetching prompt versions for a given prompt
 * @param request The request object containing the promptId
 * @returns The prompt versions
 */
export async function GET(request: Request) {
  try {
    console.log('Prompt versions API called:', request.url);
    const url = new URL(request.url);
    const promptId = url.searchParams.get('promptId');

    console.log('Prompt ID from query params:', promptId);

    if (!promptId) {
      console.log('No promptId provided');
      return NextResponse.json({ error: 'Prompt ID is required' }, { status: 400 });
    }

    // Query the prompt versions for the given prompt
    const { data: versions, error } = await supabase
      .from('prompt_versions')
      .select('*')
      .eq('prompt_id', promptId)
      .order('version_number', { ascending: false });

    console.log('Supabase query result:', { versions, error });

    if (error) {
      console.error('Error fetching prompt versions:', error);
      return NextResponse.json({ error: 'Error fetching prompt versions' }, { status: 500 });
    }

    console.log('Returning versions:', versions);
    return NextResponse.json({ data: versions });

  } catch (error) {
    console.error('Error in prompt-versions API route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * API route for creating a new prompt version
 * @param request The request object containing the prompt version data
 * @returns The created prompt version ID
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { promptId, content, createdBy, title, notes } = body;
    
    if (!promptId || !content || !createdBy) {
      return NextResponse.json(
        { error: 'Missing required fields: promptId, content, createdBy' },
        { status: 400 }
      );
    }
    
    // Get the highest version number for this prompt
    const { data: versions, error: versionError } = await supabase
      .from('prompt_versions')
      .select('version_number')
      .eq('prompt_id', promptId)
      .order('version_number', { ascending: false })
      .limit(1);
    
    if (versionError) {
      console.error('Error fetching latest version number:', versionError);
      return NextResponse.json(
        { error: 'Error fetching latest version number', details: versionError.message },
        { status: 500 }
      );
    }
    
    // Calculate the next version number
    let nextVersion = '1';
    if (versions && versions.length > 0) {
      const latestVersion = parseInt(versions[0].version_number);
      if (!isNaN(latestVersion)) {
        nextVersion = (latestVersion + 1).toString();
      }
    }
    
    // Create the new version
    const { data: newVersion, error: createError } = await supabase
      .from('prompt_versions')
      .insert({
        prompt_id: promptId,
        content: content,
        version_number: nextVersion,
        created_by: createdBy,
        title: title || null,
        notes: notes || null
      })
      .select('id')
      .single();
    
    if (createError) {
      console.error('Error creating new prompt version:', createError);
      return NextResponse.json(
        { error: 'Error creating new prompt version', details: createError.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, data: newVersion });
  } catch (error) {
    console.error('Unexpected error in prompt-versions POST endpoint:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}