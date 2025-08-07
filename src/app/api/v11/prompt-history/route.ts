import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    const promptType = request.nextUrl.searchParams.get('type') || 'greeting'; // Default to greeting
    const bookId = request.nextUrl.searchParams.get('bookId'); // Get book ID for filtering if provided

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get all prompt versions assigned to this user with details about the prompts
    // Filter by prompt type (category)
    // DO NOT filter by updating existing assignments - we want ALL history
    let query = supabase
      .from('user_prompt_assignments')
      .select(`
        id,
        user_id,
        assigned_at,
        prompt_versions!inner (
          id,
          content,
          version_number,
          created_at,
          title,
          notes,
          prompts!inner (
            id,
            name,
            description,
            category,
            created_at,
            book_id
          )
        )
      `)
      .eq('user_id', userId)
      .eq('prompt_versions.prompts.category', promptType);
    
    // Add book_id filter if provided
    if (bookId) {
      query = query.eq('prompt_versions.prompts.book_id', bookId);
    }
    
    // Order by assigned_at
    query = query.order('assigned_at', { ascending: false });
    
    // Execute the query
    const { data, error } = await query;

    if (error) {
      console.error('Error fetching prompt history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch prompt history', details: error.message },
        { status: 500 }
      );
    }

    console.log(`Found ${data?.length || 0} ${promptType} prompt history entries for user ${userId}`);
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Unexpected error in prompt history endpoint:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}