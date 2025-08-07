export default function DevToolsHomePage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6 text-white">Developer Tools</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pinecone Test Card */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-3 text-white">Pinecone Test</h2>
          <p className="text-gray-300 mb-4">
            Test Pinecone vector search functionality with customizable queries and namespace selection.
          </p>
          <a
            href="/dev-tools/pinecone-test"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            Open Pinecone Test
          </a>
        </div>
        
        {/* Schema Extraction Card */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-3 text-white">Database Structure Tool</h2>
          <p className="text-gray-300 mb-4">
            Get a complete list of all tables and fields in your database in a simple, two-step process.
          </p>
          <a
            href="/dev-tools/schema-extraction"
            className="inline-block px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md"
          >
            Open Database Structure Tool
          </a>
        </div>
      </div>
      
      <div className="mt-8 bg-gray-800 rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-3 text-white">Developer Notes</h2>
        <div className="text-gray-300 space-y-2">
          <p>
            These tools are designed for development and debugging purposes only and should not be
            exposed in production environments.
          </p>
          <p>
            Use these tools to inspect and test database connections, check vector embeddings, and
            troubleshoot integration issues.
          </p>
        </div>
      </div>
    </div>
  );
}