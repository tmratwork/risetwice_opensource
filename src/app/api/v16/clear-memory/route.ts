import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log(`[v16_memory] Clearing all memory data for user: ${userId}`);

    // Delete all memory entries for this user
    const { error: memoryError } = await supabase
      .from('v16_memory')
      .delete()
      .eq('user_id', userId);

    if (memoryError) {
      console.error('[v16_memory] Error deleting memory data:', memoryError);
      return NextResponse.json({ error: 'Failed to clear memory data' }, { status: 500 });
    }

    // Also delete any warm handoffs for this user
    const { error: handoffError } = await supabase
      .from('v16_warm_handoffs')
      .delete()
      .eq('user_id', userId);

    if (handoffError) {
      console.error('[v16_memory] Error deleting warm handoff data:', handoffError);
      // Don't fail the request if handoff deletion fails, memory is more important
    }

    console.log(`[v16_memory] Successfully cleared all memory data for user: ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'All memory data cleared successfully'
    });

  } catch (error) {
    console.error('Error in clear-memory API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}