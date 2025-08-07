'use client';

import { useState } from 'react';

// Define interface for database schema
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

export default function DatabaseStructurePage() {
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const extractSchema = async () => {
    setLoading(true);
    setError(null);
    setSchema(null);
    setSaveStatus(null);

    try {
      const response = await fetch('/api/dev-tools/schema-extraction');
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setSchema(data.schema);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const saveSchemaToFile = () => {
    if (!schema) return;

    try {
      // Create a timestamp for the filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `supabase-schema-${timestamp}.json`;

      // Convert schema to JSON string with pretty formatting
      const schemaJson = JSON.stringify(schema, null, 2);

      // Create a Blob with the JSON content
      const blob = new Blob([schemaJson], { type: 'application/json' });

      // Create a temporary URL for the Blob
      const url = URL.createObjectURL(blob);

      // Create a link element
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = filename;

      // Append the link to the body, click it, and remove it
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // Release the URL object
      URL.revokeObjectURL(url);

      // Show success message
      setSaveStatus({
        success: true,
        message: `Schema saved as ${filename}`
      });
    } catch (err) {
      setSaveStatus({
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error occurred while saving'
      });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">Supabase Schema Explorer</h1>

      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Database Structure</h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          Click the button below to get a complete list of all tables and fields in your Supabase database.
        </p>

        <button
          onClick={extractSchema}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Extracting Schema...' : 'Get Database Schema'}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-md">
            <p className="font-semibold">Error:</p>
            <p className="font-mono text-sm">{error}</p>
          </div>
        )}

        {schema && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold">Schema Retrieved:</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(schema, null, 2))
                      .then(() => alert('Schema copied to clipboard!'))
                      .catch(err => console.error('Failed to copy:', err));
                  }}
                  className="text-sm px-3 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md text-gray-700 dark:text-gray-300"
                >
                  Copy to Clipboard
                </button>

                <button
                  onClick={saveSchemaToFile}
                  className="text-sm px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md"
                >
                  Save to File
                </button>
              </div>
            </div>

            {saveStatus && (
              <div className={`mt-2 p-2 ${saveStatus.success ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'} rounded-md text-sm`}>
                {saveStatus.message}
              </div>
            )}

            <div className="overflow-x-auto mt-2">
              <pre className="p-4 bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded-md text-sm max-h-[500px] overflow-y-auto">
                {JSON.stringify(schema, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}