/**
 * Corrected Supabase schema extraction tool with proper TypeScript types
 * Version: 1.2
 */
import { NextResponse } from 'next/server';

// Force dynamic responses to prevent caching
export const dynamic = 'force-dynamic';

// Define interfaces for our schema types
interface Column {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

interface Table {
  table_name: string;
  columns: Column[];
}

interface DatabaseSchema {
  tables: Table[];
}

export async function GET() {
  try {
    // Get Supabase configuration
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('v1.2: Starting schema extraction');

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        error: 'Supabase configuration missing',
        version: '1.2'
      }, { status: 500 });
    }

    // Get the OpenAPI specification directly - this contains all table information
    const response = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`);

    if (!response.ok) {
      return NextResponse.json({
        error: `Failed to fetch schema: ${response.status} ${response.statusText}`,
        version: '1.2'
      }, { status: 500 });
    }

    const openApiSpec = await response.json();
    console.log('v1.2: OpenAPI spec fetched successfully');

    // Extract table and column information from the OpenAPI spec
    const schema = extractSchemaFromOpenApi(openApiSpec);

    return NextResponse.json({
      method: 'openapi_spec',
      schema: schema,
      tableCount: schema.tables.length,
      version: '1.2'
    });

  } catch (error) {
    console.error('v1.2: Schema extraction error:', error);

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      version: '1.2'
    }, { status: 500 });
  }
}

/**
 * Extract schema information from OpenAPI specification
 */
interface OpenAPIParameter {
  type?: string;
  required?: boolean;
  [key: string]: unknown;
}

interface OpenAPISpec {
  paths?: Record<string, unknown>;
  parameters?: Record<string, OpenAPIParameter>;
  [key: string]: unknown;
}

function extractSchemaFromOpenApi(openApiSpec: OpenAPISpec): DatabaseSchema {
  const schema: DatabaseSchema = { tables: [] };
  const tableMap = new Map<string, Table>();

  // First pass: identify tables from paths
  if (openApiSpec && openApiSpec.paths) {
    Object.keys(openApiSpec.paths).forEach(path => {
      // Table paths typically look like "/tablename"
      const tableName = path.replace(/^\//, '').split('?')[0];

      if (tableName && !tableName.includes('{') && !tableName.includes('rpc')) {
        // Skip special routes like rpc
        if (!tableMap.has(tableName)) {
          tableMap.set(tableName, {
            table_name: tableName,
            columns: []
          });
        }
      }
    });
  }

  // Second pass: extract columns from parameters
  if (openApiSpec && openApiSpec.parameters) {
    const parameters = openApiSpec.parameters;

    // Look for rowFilter parameters which indicate table columns
    Object.keys(parameters).forEach(paramKey => {
      if (paramKey.startsWith('rowFilter.')) {
        const parts = paramKey.split('.');

        if (parts.length === 3) {
          const tableName = parts[1];
          const columnName = parts[2];
          const paramInfo = parameters[paramKey];

          if (tableMap.has(tableName)) {
            const tableInfo = tableMap.get(tableName)!;

            // Check if we already have this column (avoid duplicates)
            const existingColumn = tableInfo.columns.find(
              (col) => col.column_name === columnName
            );

            if (!existingColumn) {
              tableInfo.columns.push({
                column_name: columnName,
                data_type: paramInfo.type || 'unknown',
                is_nullable: paramInfo.required === false ? 'YES' : 'NO'
              });
            }
          }
        }
      }
    });
  }

  // Convert map to array for the final schema
  tableMap.forEach(tableInfo => {
    // Sort columns alphabetically for easier reading
    tableInfo.columns.sort((a, b) =>
      a.column_name.localeCompare(b.column_name)
    );

    schema.tables.push(tableInfo);
  });

  // Sort tables alphabetically for easier reading
  schema.tables.sort((a, b) =>
    a.table_name.localeCompare(b.table_name)
  );

  return schema;
}