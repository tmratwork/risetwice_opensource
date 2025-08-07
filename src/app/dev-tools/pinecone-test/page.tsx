'use client';

import { useState, useEffect, useCallback } from 'react';

export default function PineconeTestPage() {
  const [loading, setLoading] = useState(false);
  // Define a proper type for Pinecone results
  interface PineconeResult {
    matches?: Array<{
      id: string;
      score?: number;
      metadata?: {
        text?: string;
        book_id?: string;
        chunk_index?: number;
        title?: string;
        author?: string;
        source?: string;
        page?: string | number;
        chapter?: string | number;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    }>;
    status?: string;
    usage?: {
      readUnits: number;
    };
    embeddingInfo?: {
      model?: string;
      dimensions?: number;
    };
    [key: string]: unknown;
  }
  
  const [results, setResults] = useState<PineconeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [namespace, setNamespace] = useState('dopamine_nation');
  const [query, setQuery] = useState('What is dopamine?');
  const [singleRecordTest, setSingleRecordTest] = useState(false);
  const [bookId, setBookId] = useState('');
  const [chunkIndex, setChunkIndex] = useState('0');

  const runPineconeQuery = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setResults(null);

      // Call our test API endpoint
      const response = await fetch('/api/dev-tools/pinecone-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query,
          namespace,
          singleRecordTest,
          bookId: singleRecordTest ? bookId : undefined,
          chunkIndex: singleRecordTest ? parseInt(chunkIndex) : undefined
        }),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      console.error('Error testing Pinecone:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [query, namespace, singleRecordTest, bookId, chunkIndex]);

  // Auto-run the test when the page loads, but not in single record mode
  useEffect(() => {
    if (!singleRecordTest) {
      runPineconeQuery();
    }
  }, [singleRecordTest, runPineconeQuery]);

  return (
    <div className="p-8 max-w-4xl mx-auto bg-gray-900 text-white">
      <h1 className="text-2xl font-bold mb-6">Pinecone Test Tool</h1>
      <p className="mb-4 text-gray-400">
        Test your Pinecone vector database connection and verify embeddings.
      </p>

      <div className="mb-6 bg-gray-800 p-6 rounded">
        <h3 className="text-lg font-medium mb-4">Test Configuration</h3>
        
        <div className="mb-4">
          <label className="flex items-center space-x-2 mb-4">
            <input 
              type="checkbox" 
              checked={singleRecordTest} 
              onChange={() => setSingleRecordTest(!singleRecordTest)} 
              className="rounded"
            />
            <span>Single Record Test Mode</span>
          </label>
          
          <p className="text-sm text-gray-400 mb-3">
            {singleRecordTest 
              ? "Test mode will fetch a specific record by ID to verify it exists" 
              : "Standard mode will perform a semantic search with your query"}
          </p>
        </div>

        {singleRecordTest ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Book ID</label>
              <input 
                type="text"
                value={bookId}
                onChange={(e) => setBookId(e.target.value)}
                placeholder="Enter book ID"
                className="w-full p-2 bg-gray-700 rounded border border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Chunk Index</label>
              <input 
                type="number"
                value={chunkIndex}
                onChange={(e) => setChunkIndex(e.target.value)}
                placeholder="Enter chunk index (number)"
                className="w-full p-2 bg-gray-700 rounded border border-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">
                Usually starting from 0 for the first chunk
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Namespace</label>
              <input 
                type="text"
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
                placeholder="Enter namespace"
                className="w-full p-2 bg-gray-700 rounded border border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Query</label>
              <textarea 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your semantic search query"
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 h-20"
              />
            </div>
          </div>
        )}

        <button
          onClick={runPineconeQuery}
          disabled={loading}
          className="px-5 py-2.5 mt-6 bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 w-full font-medium"
        >
          {loading ? 'Testing...' : singleRecordTest ? 'Test Single Record' : 'Run Semantic Search'}
        </button>
      </div>

      {error && (
        <div className="p-4 mb-4 bg-red-900/50 border border-red-800 rounded">
          <h3 className="font-medium mb-2">Error</h3>
          <pre className="text-red-300 overflow-auto text-sm">{error}</pre>
        </div>
      )}

      {loading && !results && (
        <div className="p-4 bg-blue-900/20 border border-blue-800 rounded animate-pulse">
          {singleRecordTest ? 'Fetching record from Pinecone...' : 'Querying Pinecone vectors...'}
        </div>
      )}

      {results && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Results</h2>
          
          <div className="mb-4">
            <h3 className="font-medium mb-2">Embedding Info</h3>
            <div className="bg-gray-800 p-3 rounded">
              <p>Model: {results.embeddingInfo?.model}</p>
              <p>Dimensions: {results.embeddingInfo?.dimensions}</p>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="font-medium mb-2">Matches ({results.matches?.length || 0})</h3>
            {results.matches && results.matches.length > 0 ? (
              <div className="space-y-4">
                {results.matches.map((match, index: number) => (
                  <div key={index} className="bg-gray-800 p-4 rounded">
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">Match #{index + 1}</span>
                      <span className="text-blue-400">Score: {match.score?.toFixed(4) || 'N/A'}</span>
                    </div>
                    <div className="text-sm text-gray-300 mb-2">ID: {match.id}</div>
                    {match.metadata && (
                      <>
                        {match.metadata.book_id ? <div className="text-sm">Book ID: {match.metadata.book_id}</div> : null}
                        {match.metadata.title ? <div className="text-sm">Title: {match.metadata.title}</div> : null}
                        {match.metadata.author ? <div className="text-sm">Author: {match.metadata.author}</div> : null}
                        {match.metadata.chunk_index !== undefined ? <div className="text-sm">Chunk: {match.metadata.chunk_index}</div> : null}
                        {match.metadata.source ? <div className="text-sm">Source: {match.metadata.source}</div> : null}
                        {match.metadata.page ? <div className="text-sm">Page: {match.metadata.page}</div> : null}
                        {match.metadata.chapter ? <div className="text-sm">Chapter: {match.metadata.chapter}</div> : null}
                        {match.metadata.text && (
                          <div className="mt-3">
                            <div className="text-sm font-medium mb-1">Content:</div>
                            <div className="p-3 bg-gray-900 rounded text-gray-200 text-sm overflow-auto max-h-40">
                              {match.metadata.text}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-800 p-4 rounded">No matches found</div>
            )}
          </div>

          <div className="bg-gray-800 p-4 rounded mt-4">
            <h3 className="font-medium mb-2">Raw Response</h3>
            <pre className="text-xs text-gray-300 overflow-auto max-h-96">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}