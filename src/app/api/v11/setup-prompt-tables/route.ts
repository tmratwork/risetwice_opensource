import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Create a helper function to execute SQL directly
async function executeSql(sql: string): Promise<{ success: boolean; error?: unknown }> {
  try {
    // Try using the exec_sql RPC function if it exists
    const { error: rpcError } = await supabase.rpc('exec_sql', { sql });
    
    if (rpcError) {
      console.log('RPC method failed, trying direct SQL through REST API');
      
      // If that fails, try using the execute-sql API endpoint
      const response = await fetch('/api/v11/execute-sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql }),
      });
      
      if (!response.ok) {
        console.error('Error executing SQL through API:', await response.text());
        return { success: false, error: 'API execution failed' };
      }
      
      return { success: true };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error executing SQL:', error);
    return { success: false, error };
  }
}

// Create the exec_sql function if it doesn't exist
async function ensureExecSqlFunction(): Promise<boolean> {
  try {
    const createExecSqlFn = `
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS void AS $$
      BEGIN
        EXECUTE sql;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
    
    // Try to execute directly through Supabase
    const { data, error } = await supabase.from('_dummy_query_for_error_check').select('*').limit(1);
    
    if (error && error.message.includes('relation "_dummy_query_for_error_check" does not exist')) {
      // We got the expected error, which means we have SQL execution permission
      
      // Create the function 
      const { error } = await supabase.rpc('exec_sql', { sql: createExecSqlFn });
      
      if (error && error.message.includes('function exec_sql(text) does not exist')) {
        // The function doesn't exist yet, so we need to create it
        // But we can't create it using itself, since it doesn't exist
        // Let's try a raw SQL approach using a special endpoint
        
        try {
          const response = await fetch('/api/v11/create-function', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sql: createExecSqlFn }),
          });
          
          if (!response.ok) {
            console.error('Failed to create exec_sql function:', await response.text());
            return false;
          }
          
          return true;
        } catch (fetchError) {
          console.error('Fetch error creating exec_sql function:', fetchError);
          return false;
        }
      } else if (error) {
        console.error('Unknown error calling exec_sql (may not exist yet):', error);
        return false;
      }
      
      return true;
    } else {
      console.error('Unexpected response when checking SQL execution permission:', error || data);
      return false;
    }
  } catch (error) {
    console.error('Error ensuring exec_sql function exists:', error);
    return false;
  }
}

/**
 * API route for checking and setting up prompt-related tables in Supabase
 * This ensures all tables exist with the correct field types
 */
export async function GET() {
  try {
    // Ensure the exec_sql function exists
    await ensureExecSqlFunction();
    
    // Create tables directly using SQL
    const createTablesSql = `
      -- Create prompts table
      CREATE TABLE IF NOT EXISTS prompts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        created_by TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT false,
        is_global BOOLEAN NOT NULL DEFAULT false,
        category TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
      
      -- Create prompt_versions table
      CREATE TABLE IF NOT EXISTS prompt_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        version_number TEXT NOT NULL,
        created_by TEXT NOT NULL,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
      
      -- Create user_prompt_assignments table
      CREATE TABLE IF NOT EXISTS user_prompt_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        prompt_version_id UUID NOT NULL REFERENCES prompt_versions(id) ON DELETE CASCADE,
        assigned_by TEXT NOT NULL,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
      
      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category);
      CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_id ON prompt_versions(prompt_id);
      CREATE INDEX IF NOT EXISTS idx_user_prompt_assignments_user_id ON user_prompt_assignments(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_prompt_assignments_prompt_version_id ON user_prompt_assignments(prompt_version_id);
    `;
    
    // Execute the table creation SQL
    const { success, error } = await executeSql(createTablesSql);
    
    if (!success) {
      return NextResponse.json({ 
        error: 'Error creating tables', 
        details: error 
      }, { status: 500 });
    }
    
    // Now check if we need to update any column types
    // Directly modify the user_id field if it's the wrong type
    const alterUserIdSql = `
      DO $$
      BEGIN
        -- Check and modify user_id in user_prompt_assignments
        IF EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'user_prompt_assignments' 
            AND column_name = 'user_id' 
            AND data_type = 'uuid'
        ) THEN
          ALTER TABLE user_prompt_assignments ALTER COLUMN user_id TYPE TEXT;
        END IF;
        
        -- Check and modify created_by in prompts
        IF EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'prompts' 
            AND column_name = 'created_by' 
            AND data_type = 'uuid'
        ) THEN
          ALTER TABLE prompts ALTER COLUMN created_by TYPE TEXT;
        END IF;
        
        -- Check and modify created_by in prompt_versions
        IF EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'prompt_versions' 
            AND column_name = 'created_by' 
            AND data_type = 'uuid'
        ) THEN
          ALTER TABLE prompt_versions ALTER COLUMN created_by TYPE TEXT;
        END IF;
        
        -- Check and modify assigned_by in user_prompt_assignments
        IF EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'user_prompt_assignments' 
            AND column_name = 'assigned_by' 
            AND data_type = 'uuid'
        ) THEN
          ALTER TABLE user_prompt_assignments ALTER COLUMN assigned_by TYPE TEXT;
        END IF;
      END
      $$;
    `;
    
    // Execute the column type alteration SQL
    const { success: alterSuccess, error: alterError } = await executeSql(alterUserIdSql);
    
    if (!alterSuccess) {
      return NextResponse.json({ 
        error: 'Error altering column types', 
        details: alterError 
      }, { status: 500 });
    }
    
    // Check if tables exist now
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['prompts', 'prompt_versions', 'user_prompt_assignments']);

    if (tablesError) {
      return NextResponse.json({ error: 'Error checking tables', details: tablesError }, { status: 500 });
    }

    const existingTables = tables.map(t => t.table_name);
    
    // Check column types to verify they're TEXT not UUID
    const columnChecks = [];
    
    for (const tableCol of [
      { table: 'user_prompt_assignments', column: 'user_id' },
      { table: 'user_prompt_assignments', column: 'assigned_by' },
      { table: 'prompts', column: 'created_by' },
      { table: 'prompt_versions', column: 'created_by' }
    ]) {
      if (existingTables.includes(tableCol.table)) {
        const { data, error } = await supabase
          .from('information_schema.columns')
          .select('data_type')
          .eq('table_name', tableCol.table)
          .eq('column_name', tableCol.column)
          .single();
          
        if (!error && data) {
          columnChecks.push({
            table: tableCol.table,
            column: tableCol.column,
            type: data.data_type,
            isText: data.data_type.toLowerCase() === 'text'
          });
        }
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Prompt tables setup completed',
      existingTables,
      columnChecks
    });

  } catch (error) {
    console.error('Error in setup-prompt-tables API route:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}