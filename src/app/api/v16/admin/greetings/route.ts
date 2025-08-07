import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    // Load all greetings for admin interface
    const { data: greetings, error } = await supabaseAdmin
      .from('greeting_resources')
      .select('*')
      .order('greeting_type', { ascending: true })
      .order('language_code', { ascending: true })
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[greeting_admin] Error loading greetings:', error);
      return NextResponse.json(
        { 
          error: `Database error loading greetings: ${error.message}`,
          details: error 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      greetings: greetings || [],
      count: greetings?.length || 0
    });

  } catch (error) {
    console.error('[greeting_admin] Unexpected error loading greetings:', error);
    return NextResponse.json(
      { 
        error: `Unexpected error loading greetings: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

    // Check if greeting already exists for this type/language combination
    const { data: existingGreeting, error: existingError } = await supabaseAdmin
      .from('greeting_resources')
      .select('id, is_active')
      .eq('greeting_type', greeting_type)
      .eq('language_code', language_code)
      .eq('is_active', true)
      .single();

    if (existingError && existingError.code !== 'PGRST116') {
      // Error other than "no rows found"
      return NextResponse.json(
        { error: `Error checking existing greeting: ${existingError.message}` },
        { status: 500 }
      );
    }

    if (existingGreeting) {
      return NextResponse.json(
        { 
          error: `Active greeting already exists for type '${greeting_type}' in language '${language_code}'. Please edit the existing greeting or deactivate it first.`,
          existingId: existingGreeting.id
        },
        { status: 409 }
      );
    }

    // Create new greeting
    const { data: newGreeting, error: insertError } = await supabaseAdmin
      .from('greeting_resources')
      .insert({
        greeting_type: greeting_type.trim(),
        language_code: language_code.trim(),
        greeting_content: greeting_content.trim(),
        is_active,
        metadata: {}
      })
      .select()
      .single();

    if (insertError) {
      console.error('[greeting_admin] Error creating greeting:', insertError);
      return NextResponse.json(
        { 
          error: `Failed to create greeting: ${insertError.message}`,
          details: insertError 
        },
        { status: 500 }
      );
    }

    console.log('[greeting_admin] Successfully created greeting:', {
      id: newGreeting.id,
      type: newGreeting.greeting_type,
      language: newGreeting.language_code,
      contentLength: newGreeting.greeting_content.length
    });

    return NextResponse.json({
      success: true,
      greeting: newGreeting,
      message: `Successfully created greeting for ${greeting_type} in ${language_code}`
    });

  } catch (error) {
    console.error('[greeting_admin] Unexpected error creating greeting:', error);
    return NextResponse.json(
      { 
        error: `Unexpected error creating greeting: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}