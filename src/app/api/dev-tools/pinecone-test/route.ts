/**
 * Developer API endpoint for testing Pinecone functionality
 * This is only for development use and should not be exposed to end users
 */
import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
// Import the official Pinecone SDK
import { Pinecone } from '@pinecone-database/pinecone';

// Force dynamic responses to prevent caching
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Generate a unique request ID for tracing through logs
  const requestId = new Date().getTime().toString().slice(-6);
  const logPrefix = `[Dev-Pinecone-Test][${requestId}]`;
  
  console.log(`${logPrefix} === STARTING PINECONE TEST ===`);
  
  try {
    // Parse request body
    const body = await req.json();
    const { 
      query = 'What is dopamine?', 
      namespace = 'dopamine_nation',
      singleRecordTest = false,
      bookId = '',
      chunkIndex
    } = body;
    
    // Step 1: Get configuration
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const pineconeIndex = process.env.PINECONE_INDEX;
    
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }
    
    if (!pineconeApiKey || !pineconeIndex) {
      return NextResponse.json(
        { 
          error: 'Pinecone configuration missing', 
          details: {
            apiKeyAvailable: !!pineconeApiKey,
            indexAvailable: !!pineconeIndex,
          }
        }, 
        { status: 500 }
      );
    }
    
    // Initialize the Pinecone client
    console.log(`${logPrefix} Initializing Pinecone client`);
    const pc = new Pinecone({
      apiKey: pineconeApiKey,
    });
    
    console.log(`${logPrefix} Pinecone client initialized, accessing index: ${pineconeIndex}`);
    const index = pc.Index(pineconeIndex);
    
    console.log(`${logPrefix} Creating namespace reference for: ${namespace}`);
    const namespaceRef = index.namespace(namespace);
    
    // Check test mode
    if (singleRecordTest) {
      // Single record test - fetch a specific record by ID
      if (!bookId) {
        return NextResponse.json({ error: 'Book ID is required for single record test' }, { status: 400 });
      }
      
      const recordId = chunkIndex !== undefined ? `${bookId}_chunk_${chunkIndex}` : bookId;
      console.log(`${logPrefix} Single record test mode: fetching record with ID: ${recordId}`);
      
      try {
        // Fetch the specific record
        const fetchResponse = await namespaceRef.fetch([recordId]);
        
        console.log(`${logPrefix} Fetch response:`, fetchResponse);
        
        // Format the record as a match for consistent UI rendering
        const matches = [];
        if (fetchResponse.records && fetchResponse.records[recordId]) {
          const record = fetchResponse.records[recordId];
          matches.push({
            id: recordId,
            score: 1.0, // Perfect match since we're fetching by ID
            metadata: record.metadata
          });
          console.log(`${logPrefix} Successfully fetched record with ID: ${recordId}`);
        } else {
          console.log(`${logPrefix} No record found with ID: ${recordId}`);
        }
        
        return NextResponse.json({
          embeddingInfo: {
            dimensions: fetchResponse.records?.[recordId]?.values?.length || 0,
          },
          matches,
          testParams: {
            singleRecordTest: true,
            recordId,
            namespace
          }
        });
      } catch (fetchError) {
        console.error(`${logPrefix} Error fetching record:`, fetchError);
        return NextResponse.json({
          error: 'Error fetching specific record',
          message: fetchError instanceof Error ? fetchError.message : String(fetchError),
          recordId
        }, { status: 500 });
      }
    } else {
      // Standard semantic search mode
      console.log(`${logPrefix} Standard search mode with query: "${query}"`);
      
      // Generate embedding with OpenAI
      console.log(`${logPrefix} Generating embedding with OpenAI`);
      const openai = new OpenAI({ apiKey: openaiApiKey });
      
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: query,
        encoding_format: 'float'
      });
      
      const embedding = embeddingResponse.data[0].embedding;
      console.log(`${logPrefix} Generated embedding with ${embedding.length} dimensions`);
      
      // Query Pinecone with the embedding
      console.log(`${logPrefix} Querying Pinecone with namespace reference`);
      const queryResponse = await namespaceRef.query({
        vector: embedding,
        topK: 5,
        includeMetadata: true
      });
      
      const matches = queryResponse.matches || [];
      console.log(`${logPrefix} Received ${matches.length} matches from Pinecone`);
      
      // Return the results
      return NextResponse.json({
        embeddingInfo: {
          model: embeddingResponse.model,
          dimensions: embedding.length,
          object: embeddingResponse.object,
        },
        matches,
        testParams: {
          query,
          namespace,
          singleRecordTest: false
        }
      });
    }
  } catch (error) {
    console.error(`${logPrefix} Error testing Pinecone:`, error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}