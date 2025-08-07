import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { greeting_type, language_code, greeting_content, is_active = true } = body;

    // Validation
    if (!greeting_type || !language_code || !greeting_content) {
      return NextResponse.json(
        { 
          error: 'Missing required fields: greeting_type, language_code, and greeting_content are required',
          received: { greeting_type, language_code, greeting_content: greeting_content ? 'provided' : 'missing' }
        },
        { status: 400 }
      );
    }

    if (typeof greeting_content !== 'string' || greeting_content.trim().length === 0) {
      return NextResponse.json(
        { error: 'greeting_content must be a non-empty string' },
        { status: 400 }
      );
    }

    // Check if greeting exists
    const { data: existingGreeting, error: existingError } = await supabaseAdmin
      .from('greeting_resources')
      .select('*')
      .eq('id', id)
      .single();

    if (existingError) {
      if (existingError.code === 'PGRST116') {
        return NextResponse.json(
          { error: `Greeting with ID '${id}' not found` },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: `Error finding greeting: ${existingError.message}` },
        { status: 500 }
      );
    }

    // Check for conflicts if type/language changed
    if (existingGreeting.greeting_type !== greeting_type || existingGreeting.language_code !== language_code) {
      const { data: conflictGreeting, error: conflictError } = await supabaseAdmin
        .from('greeting_resources')
        .select('id')
        .eq('greeting_type', greeting_type)
        .eq('language_code', language_code)
        .eq('is_active', true)
        .neq('id', id)
        .single();

      if (conflictError && conflictError.code !== 'PGRST116') {
        return NextResponse.json(
          { error: `Error checking for conflicts: ${conflictError.message}` },
          { status: 500 }
        );
      }

      if (conflictGreeting) {
        return NextResponse.json(
          { 
            error: `Another active greeting already exists for type '${greeting_type}' in language '${language_code}'. Please deactivate it first.`,
            conflictId: conflictGreeting.id
          },
          { status: 409 }
        );
      }
    }

    // Update greeting
    const { data: updatedGreeting, error: updateError } = await supabaseAdmin
      .from('greeting_resources')
      .update({
        greeting_type: greeting_type.trim(),
        language_code: language_code.trim(),
        greeting_content: greeting_content.trim(),
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[greeting_admin] Error updating greeting:', updateError);
      return NextResponse.json(
        { 
          error: `Failed to update greeting: ${updateError.message}`,
          details: updateError 
        },
        { status: 500 }
      );
    }

    console.log('[greeting_admin] Successfully updated greeting:', {
      id: updatedGreeting.id,
      type: updatedGreeting.greeting_type,
      language: updatedGreeting.language_code,
      contentLength: updatedGreeting.greeting_content.length
    });

    return NextResponse.json({
      success: true,
      greeting: updatedGreeting,
      message: `Successfully updated greeting for ${greeting_type} in ${language_code}`
    });

  } catch (error) {
    console.error('[greeting_admin] Unexpected error updating greeting:', error);
    return NextResponse.json(
      { 
        error: `Unexpected error updating greeting: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if greeting exists before deleting
    const { data: existingGreeting, error: existingError } = await supabaseAdmin
      .from('greeting_resources')
      .select('greeting_type, language_code')
      .eq('id', id)
      .single();

    if (existingError) {
      if (existingError.code === 'PGRST116') {
        return NextResponse.json(
          { error: `Greeting with ID '${id}' not found` },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: `Error finding greeting: ${existingError.message}` },
        { status: 500 }
      );
    }

    // Delete greeting (hard delete)
    const { error: deleteError } = await supabaseAdmin
      .from('greeting_resources')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[greeting_admin] Error deleting greeting:', deleteError);
      return NextResponse.json(
        { 
          error: `Failed to delete greeting: ${deleteError.message}`,
          details: deleteError 
        },
        { status: 500 }
      );
    }

    console.log('[greeting_admin] Successfully deleted greeting:', {
      id,
      type: existingGreeting.greeting_type,
      language: existingGreeting.language_code
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deleted greeting for ${existingGreeting.greeting_type} in ${existingGreeting.language_code}`,
      deletedId: id
    });

  } catch (error) {
    console.error('[greeting_admin] Unexpected error deleting greeting:', error);
    return NextResponse.json(
      { 
        error: `Unexpected error deleting greeting: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}