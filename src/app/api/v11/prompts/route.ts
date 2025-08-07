import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const name = request.nextUrl.searchParams.get('name');
    const category = request.nextUrl.searchParams.get('category');
    const createdBy = request.nextUrl.searchParams.get('createdBy');
    const bookId = request.nextUrl.searchParams.get('bookId'); // New parameter for book filtering
    const includeGlobal = request.nextUrl.searchParams.get('includeGlobal') !== 'false'; // Default to true
    const greetingType = request.nextUrl.searchParams.get('greetingType'); // New parameter for greeting type
    const isGlobal = request.nextUrl.searchParams.get('is_global'); // Filter by global status
    
    // Start building the query
    let query = supabase.from('prompts')
      .select('*')
      .eq('is_active', true); // Only get active prompts by default
    
    // Apply filters if provided
    if (name) {
      query = query.eq('name', name);
    }
    
    if (category) {
      query = query.eq('category', category);
    }
    
    // Filter by book_id if provided
    if (bookId) {
      query = query.eq('book_id', bookId);
    }
    
    // Filter by greeting_type if provided
    if (greetingType) {
      query = query.eq('greeting_type', greetingType);
    }
    
    // Filter by is_global if provided
    if (isGlobal === 'true') {
      query = query.eq('is_global', true);
    } else if (isGlobal === 'false') {
      query = query.eq('is_global', false);
    }
    
    // Handle user-specific vs global prompts
    if (createdBy) {
      if (includeGlobal) {
        // Get both user-specific and global prompts
        query = query.or(`created_by.eq.${createdBy},is_global.eq.true`);
      } else {
        // Get only user-specific prompts
        query = query.eq('created_by', createdBy);
      }
    } else if (!includeGlobal) {
      // If no user specified and global excluded, return nothing
      return NextResponse.json({ success: true, data: [] });
    }
    
    // Get results
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching prompts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch prompts', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Unexpected error in prompts endpoint:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * Create a new prompt
 */
interface PromptRequestData {
  name?: string;
  description?: string;
  category?: string;
  created_by?: string;
  is_active?: boolean | string;
  is_global?: boolean | string;
  book_id?: string | null;
  greeting_type?: string | null;
  [key: string]: unknown; // To handle any other properties that might be in the request
}

export async function POST(request: NextRequest) {
  // Declare requestData outside try block so it's accessible in the catch block
  let requestData: PromptRequestData = {};

  try {
    // Parse request body
    requestData = await request.json();

    // Validate required fields
    if (!requestData.name || !requestData.category || !requestData.created_by) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'name, category, and created_by are required' },
        { status: 400 }
      );
    }

    // Ensure is_global is a boolean
    if (requestData.is_global !== undefined && typeof requestData.is_global !== 'boolean') {
      requestData.is_global = String(requestData.is_global).toLowerCase() === 'true';
    }

    // Ensure is_active is a boolean
    if (requestData.is_active !== undefined && typeof requestData.is_active !== 'boolean') {
      requestData.is_active = String(requestData.is_active).toLowerCase() === 'true';
    }

    // The allowed category values should match what's defined in the database constraint
    const allowedCategories = ['greeting', 'ai_instructions', 'insights_system', 'insights_user', 'warm_handoff', 'quest_generation', 'profile_analysis_system', 'profile_analysis_user', 'profile_merge_system', 'profile_merge_user'];

    console.log(`[API] Creating prompt with data:`, {
      name: requestData.name,
      category: requestData.category,
      is_global: requestData.is_global,
      is_global_type: typeof requestData.is_global,
      isValidCategory: allowedCategories.includes(requestData.category),
      timestamp: new Date().toISOString()
    });

    if (!allowedCategories.includes(requestData.category)) {
      console.error('[API] Invalid prompt category error:', {
        receivedCategory: requestData.category,
        allowedCategories,
        request: {
          name: requestData.name,
          description: requestData.description,
          created_by: requestData.created_by
        },
        timestamp: new Date().toISOString()
      });

      return NextResponse.json(
        { error: `Invalid prompt category. Allowed values are: ${allowedCategories.join(', ')}` },
        { status: 400 }
      );
    }

    // Insert into database
    const { data, error } = await supabase
      .from('prompts')
      .insert({
        name: requestData.name,
        description: requestData.description,
        category: requestData.category,
        created_by: requestData.created_by,
        is_active: requestData.is_active !== undefined ? requestData.is_active : true,
        is_global: requestData.is_global || false,
        book_id: requestData.book_id || null,
        greeting_type: requestData.greeting_type || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating prompt:', {
        error,
        category: requestData.category,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        timestamp: new Date().toISOString()
      });

      // Check for database constraint violations with detailed logging
      if (error.code === 'P0001' || error.message.includes('violates check constraint')) {
        console.error('[API] DATABASE CONSTRAINT VIOLATION:', {
          errorMessage: error.message,
          constraintDetails: error.details,
          violatedCategory: requestData.category,
          allowedCategories,
          isAllowed: allowedCategories.includes(requestData.category),
          requestData: {
            name: requestData.name,
            category: requestData.category,
            is_global: requestData.is_global,
            is_global_type: typeof requestData.is_global,
            created_by_type: typeof requestData.created_by
          },
          debugNote: "Check if category matches exactly one of the allowed values, including case sensitivity",
          timestamp: new Date().toISOString()
        });

        return NextResponse.json(
          {
            error: 'Database constraint violation',
            details: error.message,
            allowedCategories: allowedCategories,
            receivedCategory: requestData.category,
            helpMessage: "The category must be one of the allowed values. Check for exact match including case."
          },
          { status: 400 }
        );
      }

      // Handle foreign key constraint violations
      if (error.code === '23503' || error.message.includes('violates foreign key constraint')) {
        console.error('[API] FOREIGN KEY CONSTRAINT VIOLATION:', {
          errorMessage: error.message,
          constraintDetails: error.details,
          foreignKeyId: error.message.includes('foreign key') ?
                       error.message.substring(error.message.indexOf('(') + 1, error.message.indexOf(')')) : 'unknown',
          timestamp: new Date().toISOString()
        });

        return NextResponse.json(
          {
            error: 'Foreign key constraint violation',
            details: error.message,
            helpMessage: "One of the referenced IDs does not exist in the database."
          },
          { status: 400 }
        );
      }

      // Handle unique constraint violations
      if (error.code === '23505' || error.message.includes('violates unique constraint')) {
        console.error('[API] UNIQUE CONSTRAINT VIOLATION:', {
          errorMessage: error.message,
          constraintDetails: error.details,
          duplicateValue: error.message.includes('already exists') ?
                        error.message.substring(error.message.indexOf('(') + 1, error.message.indexOf(')')) : 'unknown',
          timestamp: new Date().toISOString()
        });

        return NextResponse.json(
          {
            error: 'Unique constraint violation',
            details: error.message,
            helpMessage: "A record with this key already exists in the database."
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to create prompt', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Prompt created successfully',
      data
    });
  } catch (error) {
    const debugId = Date.now().toString().slice(-6);
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[API:${debugId}] Unexpected error in prompts POST endpoint:`, {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 500)
      } : String(error),
      timestamp: new Date().toISOString()
    });

    // Try to detect specific error patterns
    if (errorMessage.includes('invalid input syntax for type uuid')) {
      console.error(`[API:${debugId}] UUID FORMAT ERROR detected:`, {
        errorMessage,
        requestData: {
          name: requestData?.name,
          created_by: typeof requestData?.created_by === 'string' ?
                     `${requestData.created_by.substring(0, 10)}... (${typeof requestData.created_by})` :
                     typeof requestData?.created_by,
          book_id: requestData?.book_id ?
                  `${String(requestData.book_id).substring(0, 10)}... (${typeof requestData.book_id})` :
                  'null'
        },
        timestamp: new Date().toISOString(),
        guidance: "This is likely a UUID format issue with created_by or book_id fields. Check format and ensure they are properly quoted UUIDs."
      });

      return NextResponse.json(
        {
          error: 'UUID format error',
          details: errorMessage,
          debugId,
          guidance: "One of the UUID fields (created_by, book_id) has an invalid format."
        },
        { status: 400 }
      );
    }

    if (errorMessage.includes('violates check constraint')) {
      console.error(`[API:${debugId}] CHECK CONSTRAINT ERROR detected:`, {
        errorMessage,
        requestData: {
          category: requestData?.category,
          allowedCategories: ['greeting', 'ai_instructions', 'insights_system', 'insights_user', 'warm_handoff', 'quest_generation']
        },
        timestamp: new Date().toISOString(),
        guidance: "Check that category matches exactly one of the allowed values, including case sensitivity"
      });

      return NextResponse.json(
        {
          error: 'Database constraint violation',
          details: errorMessage,
          debugId,
          guidance: "One of the fields violates a database constraint. Most likely the category field."
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        details: errorMessage,
        debugId
      },
      { status: 500 }
    );
  }
}