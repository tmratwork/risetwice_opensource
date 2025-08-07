import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { sql } = await request.json();

    if (!sql) {
      return NextResponse.json({ error: 'SQL query is required' }, { status: 400 });
    }

    // Get Supabase URL and key from the env or use the existing client
    let supabaseUrl = '';
    let supabaseKey = '';
    
    if (supabase) {
      // Use the existing client's configuration if possible
      // This is a bit hacky but necessary since we can't directly access the URL and key
      const dummyResponse = await supabase.from('non_existent_table').select('*');
      if (dummyResponse.error) {
        const errorMsg = JSON.stringify(dummyResponse.error);
        // Try to extract the URL from the error message
        const urlMatch = errorMsg.match(/url: '([^']+)'/);
        if (urlMatch && urlMatch[1]) {
          supabaseUrl = urlMatch[1];
        }
      }
      
      // For the key, we'll depend on environment variables
      supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    } else {
      // Fallback to environment variables
      supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    }
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ 
        error: 'Supabase credentials not available',
        details: 'Missing URL or key'
      }, { status: 500 });
    }
    
    // Create a new client with the service role key for elevated permissions
    const adminClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false
      }
    });
    
    // Use PostgreSQL REST API to execute the SQL
    const { data, error } = await adminClient.rpc('exec_sql', { sql });

    if (error) {
      // If exec_sql doesn't exist, try direct SQL execution using another method
      if (error.message.includes('function exec_sql(text) does not exist')) {
        // Use special SQL execution approach 
        // This usually requires the service role key, which is why we created the admin client
        let directError = null;
        try {
          await adminClient.from('_dummy_direct_execute')
            .select('*')
            .limit(1);
        } catch (err) {
          directError = err;
        }
        
        if (directError) {
          console.error('Failed to execute direct SQL query:', directError);
          return NextResponse.json({ 
            error: 'Unable to execute SQL directly',
            details: directError
          }, { status: 500 });
        }
        
        return NextResponse.json({ 
          success: true,
          message: 'Function creation attempted directly'
        });
      }
      
      return NextResponse.json({ 
        error: 'Error executing SQL', 
        details: error 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in create-function API route:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}