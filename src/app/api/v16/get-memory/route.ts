import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Query the unified user profile (single record per user)  
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        // No user profile found
        return NextResponse.json({ error: 'No memory data found' }, { status: 404 });
      }
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json({ error: 'Failed to fetch memory data' }, { status: 500 });
    }

    if (!userProfile) {
      return NextResponse.json({ error: 'No memory data found' }, { status: 404 });
    }

    console.log(`[v16_memory] Found user profile for user ${userId}: ${userProfile.conversation_count} conversations, ${userProfile.message_count} messages, version ${userProfile.version}`);

    // Format response to match expected structure
    return NextResponse.json({
      success: true,
      memory: {
        id: userProfile.id,
        user_id: userProfile.user_id,
        memory_content: userProfile.profile_data,
        conversation_count: userProfile.conversation_count,
        message_count: userProfile.message_count,
        generated_at: userProfile.updated_at,
        created_at: userProfile.created_at
      }
    });

  } catch (error) {
    console.error('Error in get-memory API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}