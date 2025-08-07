/**
 * Developer API endpoint for executing SQL queries
 * This is only for development use and should not be exposed to end users
 * IMPORTANT: This endpoint should be disabled or removed in production
 */
import { NextResponse } from 'next/server';

// Force dynamic responses to prevent caching
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Generate a unique request ID for tracing through logs
  const requestId = new Date().getTime().toString().slice(-6);
  const logPrefix = `[Dev-Execute-SQL][${requestId}]`;

  console.log(`${logPrefix} === STARTING SQL EXECUTION ===`);

  try {
    // Parse request body
    const body = await req.json();
    const { sql_query } = body;

    if (!sql_query) {
      return NextResponse.json({ error: 'SQL query is required' }, { status: 400 });
    }

    // Get Supabase configuration
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        error: 'Supabase configuration missing',
        details: {
          urlAvailable: !!supabaseUrl,
          serviceKeyAvailable: !!supabaseServiceKey
        }
      }, { status: 500 });
    }

    // Initialize Supabase client with service role for admin access
    console.log(`${logPrefix} Initializing Supabase client with service role`);


    // Execute the SQL query
    console.log(`${logPrefix} Executing SQL query: ${sql_query.slice(0, 100)}${sql_query.length > 100 ? '...' : ''}`);

    // For security, check if this is a SELECT query or other types
    const trimmedQuery = sql_query.trim().toLowerCase();
    const isSelect = trimmedQuery.startsWith('select');
    const isFunction = trimmedQuery.includes('create or replace function') ||
      trimmedQuery.includes('create function');

    if (!isSelect && !isFunction) {
      console.warn(`${logPrefix} Non-SELECT, non-function query detected: ${trimmedQuery.slice(0, 50)}...`);
    }

    // Use the raw REST API to execute the SQL query
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'X-Client-Info': 'living-books-dev-tools',
        'Prefer': 'params=single-object',
      },
      body: JSON.stringify({
        rpc: 'rpc',
        params: {
          sql: sql_query
        }
      })
    });

    // Process the response
    const result = await response.json();
    console.log(`${logPrefix} Query execution completed`);

    return NextResponse.json({
      success: true,
      result,
      query: {
        sql: sql_query,
        is_select: isSelect
      }
    });

  } catch (error) {
    console.error(`${logPrefix} Error executing SQL:`, error);

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}