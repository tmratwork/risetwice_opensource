import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { is_approved } = body;

    // Validation
    if (typeof is_approved !== 'boolean') {
      return NextResponse.json(
        { 
          error: 'is_approved must be a boolean value',
          received: { is_approved }
        },
        { status: 400 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Circle ID is required' },
        { status: 400 }
      );
    }

    // Check if circle exists
    const { error: existingError } = await supabaseAdmin
      .from('circles')
      .select('id')
      .eq('id', id)
      .single();

    if (existingError) {
      if (existingError.code === 'PGRST116') {
        return NextResponse.json(
          { error: `Circle with ID ${id} not found` },
          { status: 404 }
        );
      }
      console.error('[circle_admin] Error checking existing circle:', existingError);
      return NextResponse.json(
        { error: `Error checking circle: ${existingError.message}` },
        { status: 500 }
      );
    }

    // Update circle approval status
    const { data: updatedCircle, error: updateError } = await supabaseAdmin
      .from('circles')
      .update({ 
        is_approved,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[circle_admin] Error updating circle approval:', updateError);
      return NextResponse.json(
        { 
          error: `Failed to update circle approval: ${updateError.message}`,
          details: updateError 
        },
        { status: 500 }
      );
    }

    console.log('[circle_admin] Successfully updated circle approval:', {
      id: updatedCircle.id,
      name: updatedCircle.name,
      is_approved: updatedCircle.is_approved
    });

    return NextResponse.json({
      success: true,
      circle: updatedCircle,
      message: `Circle "${updatedCircle.display_name}" ${is_approved ? 'approved' : 'rejected'} successfully`
    });

  } catch (error) {
    console.error('[circle_admin] Unexpected error updating circle approval:', error);
    return NextResponse.json(
      { 
        error: `Unexpected error updating circle approval: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}