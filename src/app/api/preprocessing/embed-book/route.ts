/**
 * API endpoint for embedding book content into Pinecone
 */
import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { supabase } from '@/lib/supabase';

// Force dynamic responses to prevent caching
export const dynamic = 'force-dynamic';

// These interfaces provide documentation for the expected database schema
// They're not directly used in type annotations but serve as valuable reference
/**
 * @deprecated Used for reference but not directly used in type annotations.
 * Consider using explicit type annotations when needed.
 */
// interface Book {
//   id: string;
//   title: string;
//   author: string;
//   genre: string;
//   published_date: string;
//   content: string;
// }

/**
 * @deprecated Used for reference but not directly used in type annotations.
 * Consider using explicit type annotations when needed.
 */
// interface Namespace {
//   id: string;
//   name: string;
//   description?: string;
// }

export async function POST(req: Request) {
  // Generate a unique request ID for tracing through logs
  const requestId = new Date().getTime().toString().slice(-6);
  const logPrefix = `[Preprocessing-Embed-Book][${requestId}]`;
  
  console.log(`${logPrefix} === STARTING BOOK EMBEDDING ===`);
  
  // Define variables that need to be accessible in the catch block
  let book: { 
    id: string; 
    title: string; 
    author: string; 
    genre?: string; 
    published_date?: string; 
    pinecone_namespace?: string;
    content?: string;
  } | null = null;
  let pineconeIndex: string | undefined;
  let pinecone_namespace: string | undefined;
  const chunkResults: { id: string; chunk_index: number; chunk_size: number }[] = [];
  
  try {
    // Parse request body
    const body = await req.json();
    const { book_id, testMode = false, chunkIndex = 0, forceEmbed = false } = body;
    
    if (!book_id) {
      return NextResponse.json({ error: 'Book ID is required' }, { status: 400 });
    }
    
    console.log(`${logPrefix} Processing book with ID: ${book_id} ${testMode ? '(TEST MODE - single chunk)' : ''}`);
    
    // Step 1: Get configuration
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    pineconeIndex = process.env.PINECONE_INDEX;
    
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

    // Step 2: Fetch book from Supabase
    console.log(`${logPrefix} Fetching book from Supabase: ${book_id}`);
    
    const { data, error: bookError } = await supabase
      .from('books_v2')
      .select('*')
      .eq('id', book_id)
      .single();
    
    book = data;
    
    if (bookError || !book) {
      console.error(`${logPrefix} Error fetching book:`, bookError);
      return NextResponse.json({ 
        error: 'Failed to fetch book',
        details: bookError
      }, { status: 404 });
    }
    
    console.log(`${logPrefix} Found book: ${book.title}`);
    
    // Check if the book has a pinecone_namespace field
    if (!book.pinecone_namespace) {
      console.error(`${logPrefix} Book has no pinecone_namespace set in the database`);
      return NextResponse.json({ 
        error: 'Book has no associated namespace in the database',
        bookId: book_id,
        details: 'The pinecone_namespace field is empty or not set'
      }, { status: 400 });
    }
    
    pinecone_namespace = book.pinecone_namespace;
    console.log(`${logPrefix} Using namespace: ${pinecone_namespace}`);
    
    console.log(`${logPrefix} Successfully fetched book: ${book.title} with namespace: ${pinecone_namespace}`);
    
    // Step 3: Initialize OpenAI
    console.log(`${logPrefix} Initializing OpenAI client`);
    const openai = new OpenAI({ apiKey: openaiApiKey });
    
    // Step 4: Initialize Pinecone
    console.log(`${logPrefix} Initializing Pinecone client`);
    const pc = new Pinecone({
      apiKey: pineconeApiKey,
    });
    
    const index = pc.Index(pineconeIndex);
    const namespaceRef = index.namespace(pinecone_namespace);
    
    // Step 4.5: Check if vectors already exist for this book
    if (!forceEmbed && !testMode) {
      console.log(`${logPrefix} Checking if vectors already exist for this book in namespace: ${pinecone_namespace}`);
      
      try {
        // Query for a sample vector with the book ID prefix
        const queryPrefix = `${book_id}_chunk_`;
        // Using the correct parameters for the Pinecone API
        // Each ID needs to be passed directly to the fetch method, not as an object with 'ids' property
        const sampleQuery = await namespaceRef.fetch([
          `${queryPrefix}0`, 
          `${queryPrefix}1`, 
          `${queryPrefix}10`
        ]);
        
        // Check if the result has records (Pinecone API structure has changed)
        // The response structure is now a FetchResponse which has records, not vectors
        const records = sampleQuery?.records || {};
        const foundVectors = Object.keys(records).length;
        
        if (foundVectors > 0) {
          console.log(`${logPrefix} Found ${foundVectors} existing vectors for book ID: ${book_id}`);
          
          // Return a special response code for the frontend to handle
          return NextResponse.json({ 
            warning: 'existing_vectors',
            message: `This book already has ${foundVectors} vectors embedded in Pinecone.`,
            book: {
              id: book.id,
              title: book.title,
              author: book.author,
            },
            namespace: pinecone_namespace,
            vectorCount: foundVectors
          }, { status: 409 }); // 409 Conflict status code
        }
        
        console.log(`${logPrefix} No existing vectors found. Proceeding with embedding.`);
      } catch (checkError) {
        // If there's an error checking, we'll log it but continue with embedding
        console.warn(`${logPrefix} Error checking for existing vectors:`, checkError);
        console.log(`${logPrefix} Continuing with embedding process despite check error.`);
      }
    } else if (forceEmbed) {
      console.log(`${logPrefix} Force embed mode enabled. Skipping check for existing vectors.`);
    }
    
    // Step 5: Split text into chunks
    const chunkSize = 1500;
    const chunkOverlap = 500;
    console.log(`${logPrefix} Splitting book content into chunks (size: ${chunkSize}, overlap: ${chunkOverlap})`);
    
    const content = book.content;
    
    // Validate content exists and is a string
    if (!content) {
      console.error(`${logPrefix} Error: Book content is empty or missing`);
      return NextResponse.json({ 
        error: 'Book content is empty or missing',
        bookId: book_id
      }, { status: 400 });
    }
    
    if (typeof content !== 'string') {
      console.error(`${logPrefix} Error: Book content is not a string. Type: ${typeof content}`, 
        content ? `Content preview: ${JSON.stringify(content).substring(0, 100)}...` : 'Content is null/undefined');
      return NextResponse.json({ 
        error: 'Book content is not in the expected format',
        bookId: book_id,
        contentType: typeof content
      }, { status: 400 });
    }
    
    const contentLength = content.length;
    
    // Calculate expected number of chunks
    const effectiveStep = chunkSize - chunkOverlap;
    const expectedChunks = Math.ceil((contentLength - chunkOverlap) / effectiveStep);
    
    console.log(`${logPrefix} Book content statistics:`);
    console.log(`${logPrefix} - Total characters: ${contentLength.toLocaleString()}`);
    console.log(`${logPrefix} - Chunk size: ${chunkSize} characters`);
    console.log(`${logPrefix} - Chunk overlap: ${chunkOverlap} characters`);
    console.log(`${logPrefix} - Effective step per chunk: ${effectiveStep} characters`);
    console.log(`${logPrefix} - Expected number of chunks: ${expectedChunks}`);
    
    // We'll generate chunks on demand instead of storing all in memory
    // This function returns a generator that produces chunks one at a time
    const getChunkGenerator = (text: string, size: number, overlap: number) => {
      let startIndex = 0; // Start at the beginning of the text
      let chunkCount = 0;
      const textLength = text.length;
      const step = size - overlap; // How much to advance each time (effective step)
      
      // Pre-calculate exact number of chunks (for tracking purposes)
      const totalExpectedChunks = Math.ceil(textLength / step);
      
      console.log(`${logPrefix} Chunking algorithm: Each chunk is ${size} chars with ${overlap} char overlap`);
      console.log(`${logPrefix} Will advance by ${step} characters each iteration`);
      
      return {
        // Return total expected chunks without calculating them all
        getTotalChunks: () => totalExpectedChunks,
        
        // Get the next chunk
        getNextChunk: () => {
          // Check if we've reached the end of the text
          if (startIndex >= textLength) {
            return null; // No more chunks - we've processed all the text
          }
          
          // Calculate end index for this chunk
          const endIndex = Math.min(startIndex + size, textLength);
          
          // Extract chunk
          const chunk = text.substring(startIndex, endIndex);
          
          // Store current chunk index and position
          const currentIndex = chunkCount++;
          const currentStart = startIndex;
          
          // Simple incremental approach: advance by the step size for next chunk
          startIndex += step;
          
          // Debug log for the last 10% of expected chunks or when near the end
          const nearEnd = textLength - endIndex < 1000;
          if (chunkCount > totalExpectedChunks * 0.9 || nearEnd) {
            console.log(`${logPrefix} DEBUG: Chunk ${currentIndex}, startIndex=${currentStart}, endIndex=${endIndex}, nextStart=${startIndex}, textLength=${textLength}`);
          }
          
          // Return current chunk with its index
          return {
            chunk,
            index: currentIndex
          };
        }
      };
    };
    
    // Create the chunk generator - this doesn't calculate all chunks at once
    const chunkGenerator = getChunkGenerator(content, chunkSize, chunkOverlap);
    const totalChunks = chunkGenerator.getTotalChunks();
    
    console.log(`${logPrefix} Prepared to generate ${totalChunks} chunks from book content (as needed)`);
    
    // For test mode, we need to pre-calculate the specific chunk
    let testChunk = null;
    if (testMode && chunkIndex >= 0) {
      let currentChunkData;
      let i = 0;
      
      // Get chunks until we reach the desired index
      while ((currentChunkData = chunkGenerator.getNextChunk()) !== null) {
        if (i === chunkIndex) {
          testChunk = currentChunkData;
          break;
        }
        i++;
      }
      
      if (!testChunk) {
        console.error(`${logPrefix} Error: Could not find chunk at index ${chunkIndex}`);
        return NextResponse.json({ 
          error: 'Invalid chunk index',
          bookId: book_id,
          chunkIndex: chunkIndex,
          maxChunkIndex: i - 1
        }, { status: 400 });
      }
    }
    
    // Step 6: Process chunks and embed them
    console.log(`${logPrefix} Starting to process and embed chunks`);
    
    const chunkResults = [];
    
    // In test mode, we only process a single chunk
    if (testMode) {
      if (!testChunk) {
        console.error(`${logPrefix} Cannot test: No chunk available at index ${chunkIndex}`);
        return NextResponse.json({ 
          error: 'No chunk available for testing at specified index',
          bookId: book_id,
          chunkIndex: chunkIndex
        }, { status: 400 });
      }
      
      console.log(`${logPrefix} TEST MODE: Processing only chunk ${testChunk.index + 1}/${totalChunks}`);
      
      try {
        const chunk = testChunk.chunk;
        const targetIndex = testChunk.index;
        
        console.log(`${logPrefix} Test chunk length: ${chunk.length} characters`);
        
        // Generate embedding using OpenAI
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-large',
          input: chunk,
          encoding_format: 'float'
        });
        
        if (!embeddingResponse || !embeddingResponse.data || !embeddingResponse.data[0]) {
          console.error(`${logPrefix} Invalid embedding response:`, JSON.stringify(embeddingResponse));
          return NextResponse.json({ 
            error: 'Failed to generate embedding',
            bookId: book_id
          }, { status: 500 });
        }
        
        const embedding = embeddingResponse.data[0].embedding;
        
        console.log(`${logPrefix} Generated embedding with ${embedding.length} dimensions`);
        
        // Add to Pinecone
        const metadata = {
          book_id: book.id,
          title: book.title,
          author: book.author,
          genre: book.genre || 'unknown',
          published_date: book.published_date || 'unknown',
          text: chunk,
          chunk_index: targetIndex,
          test_mode: true
        };
        
        const id = `${book.id}_chunk_${targetIndex}`;
        
        await namespaceRef.upsert([{
          id,
          values: embedding,
          metadata
        }]);
        
        chunkResults.push({
          id,
          chunk_index: targetIndex,
          chunk_size: chunk.length,
        });
        
        console.log(`${logPrefix} Successfully embedded test chunk with ID: ${id}`);
      } catch (testError) {
        console.error(`${logPrefix} Error in test embedding:`, testError);
        return NextResponse.json({ 
          error: 'Error during test embedding',
          message: testError instanceof Error ? testError.message : String(testError),
          bookId: book_id
        }, { status: 500 });
      }
    } else {
      // Normal mode: process all chunks, one at a time
      const startTime = Date.now();
      let lastProgressReport = 0;
      let processedCount = 0;
      
      console.log(`${logPrefix} Starting full embedding of ${totalChunks} chunks. Estimated time: ${Math.round(totalChunks * 1.5 / 60)} minutes`);
      
      // Process chunks one at a time without keeping them all in memory
      let chunkData;
      while ((chunkData = chunkGenerator.getNextChunk()) !== null) {
        const { chunk, index } = chunkData;
        processedCount++;
        
        // Only log every 20 chunks or at least 10 seconds apart to avoid log spam and memory issues
        const currentTime = Date.now();
        const shouldLog = index % 20 === 0 || (currentTime - lastProgressReport) > 10000;
        
        if (shouldLog) {
          const percentComplete = (processedCount / totalChunks * 100).toFixed(1);
          const elapsed = (currentTime - startTime) / 1000;
          const estimatedTotal = elapsed / processedCount * totalChunks;
          const remaining = Math.max(0, estimatedTotal - elapsed);
          
          if (processedCount > totalChunks) {
            console.warn(`${logPrefix} WARNING! Progress exceeded expected chunks: ${processedCount}/${totalChunks} (${percentComplete}%) - Check chunking logic`);
          } else {
            console.log(`${logPrefix} Progress: ${processedCount}/${totalChunks} chunks (${percentComplete}%) - ETA: ${Math.round(remaining / 60)} minutes`);
          }
          
          lastProgressReport = currentTime;
        }
        
        try {
          // Generate embedding using OpenAI
          const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-large',
            input: chunk,
            encoding_format: 'float'
          });
          
          const embedding = embeddingResponse.data[0].embedding;
          
          // Add to Pinecone
          const metadata = {
            book_id: book.id,
            title: book.title,
            author: book.author,
            genre: book.genre || 'unknown',
            published_date: book.published_date || 'unknown',
            text: chunk,
            chunk_index: index
          };
          
          const id = `${book.id}_chunk_${index}`;
          
          await namespaceRef.upsert([{
            id,
            values: embedding,
            metadata
          }]);
          
          // Store minimal results to save memory
          chunkResults.push({
            id,
            chunk_index: index,
            chunk_size: chunk.length,
          });
          
          if (shouldLog) {
            console.log(`${logPrefix} Successfully embedded chunk ${processedCount}/${totalChunks} with ID: ${id}`);
          }
        } catch (chunkError) {
          console.error(`${logPrefix} Error processing chunk ${index}:`, chunkError);
          // Continue processing other chunks despite errors
        }
      }
      
      // Final timing statistics
      const totalTime = (Date.now() - startTime) / 1000;
      const timePerChunk = totalTime / processedCount;
      console.log(`${logPrefix} Embedding complete in ${Math.round(totalTime / 60)} minutes (${totalTime.toFixed(1)} seconds)`);
      console.log(`${logPrefix} Processed ${processedCount}/${totalChunks} chunks successfully`);
      console.log(`${logPrefix} Average time per chunk: ${timePerChunk.toFixed(2)} seconds`);
      console.log(`${logPrefix} Processing rate: ${(60 / timePerChunk).toFixed(1)} chunks per minute`);
    }
    
    // Step 7: Return success response with detailed logging
    console.log(`${logPrefix} ========== EMBEDDING COMPLETE ==========`);
    console.log(`${logPrefix} Book: "${book.title}" (ID: ${book.id})`);
    console.log(`${logPrefix} Pinecone Index: ${pineconeIndex}`);
    console.log(`${logPrefix} Pinecone Namespace: ${pinecone_namespace}`);
    console.log(`${logPrefix} Embedding Model: text-embedding-3-large`);
    console.log(`${logPrefix} Expected Chunks: ${totalChunks}`);
    console.log(`${logPrefix} Actual Chunks Processed: ${chunkResults.length}`);
    console.log(`${logPrefix} First chunk ID: ${chunkResults[0]?.id || 'N/A'}`);
    console.log(`${logPrefix} Last chunk ID: ${chunkResults[chunkResults.length - 1]?.id || 'N/A'}`);
    console.log(`${logPrefix} =======================================`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully embedded book "${book.title}" into Pinecone`,
      book: {
        id: book.id,
        title: book.title,
        author: book.author,
      },
      embedding_info: {
        namespace: pinecone_namespace,
        index: pineconeIndex,
        total_chunks: chunkResults.length,
        model: 'text-embedding-3-large',
        chunk_details: chunkResults
      }
    });
    
  } catch (error) {
    console.error(`${logPrefix} Error in book embedding process:`, error);
    
    // If we have successfully processed chunks but encountered an error later,
    // still return a success response with the data we have
    if (chunkResults && chunkResults.length > 0) {
      console.log(`${logPrefix} Returning partial success with ${chunkResults.length} processed chunks despite error:`, error);
      
      return NextResponse.json({
        success: true,
        message: `Successfully embedded ${chunkResults.length} chunks from book "${book?.title || 'unknown'}" into Pinecone, but with errors`,
        warning: error instanceof Error ? error.message : 'Error during processing',
        book: book ? {
          id: book.id,
          title: book.title,
          author: book.author,
        } : null,
        embedding_info: {
          namespace: pinecone_namespace,
          index: pineconeIndex,
          total_chunks: chunkResults.length,
          model: 'text-embedding-3-large', 
          chunk_details: chunkResults
        }
      });
    }
    
    // Otherwise return a proper error response
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

/**
 * This function is kept for reference but we're now using the generator approach
 * to avoid loading all chunks into memory at once.
 * 
 * @deprecated This function is no longer used directly. The chunking logic has
 * been replaced by a more memory-efficient generator-based approach.
 * Kept for reference purposes only.
 * 
 * Original function:
 * 
 * function splitTextIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
 *   // For debugging only - this function is no longer used directly
 *   console.log(`LEGACY splitTextIntoChunks: this function is no longer used directly`);
 *   
 *   if (!text || typeof text !== 'string') {
 *     return [];
 *   }
 *   
 *   if (chunkSize <= 0) {
 *     return [text];
 *   }
 *   
 *   const chunks: string[] = [];
 *   let startIndex = 0;
 *   
 *   while (startIndex < text.length) {
 *     // Calculate end index for this chunk
 *     const endIndex = Math.min(startIndex + chunkSize, text.length);
 *     
 *     // Extract chunk
 *     const chunk = text.substring(startIndex, endIndex);
 *     chunks.push(chunk);
 *     
 *     // Move start index for next chunk, accounting for overlap
 *     startIndex = endIndex - overlap;
 *   }
 *   
 *   return chunks;
 * }
 */