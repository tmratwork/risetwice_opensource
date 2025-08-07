/**
 * API endpoint for embedding character profiles into Pinecone
 */
import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { supabase } from '@/lib/supabase';

// Force dynamic responses to prevent caching
export const dynamic = 'force-dynamic';

// Uncomment if needed later
// interface CharacterProfile {
//   character_name: string;
//   character_profile: string;
//   book_id: string;
// }

export async function POST(req: Request) {
  // Generate a unique request ID for tracing through logs
  const requestId = new Date().getTime().toString().slice(-6);
  const logPrefix = `[Preprocessing-Embed-Character-Profiles][${requestId}]`;

  console.log(`${logPrefix} === STARTING CHARACTER PROFILE EMBEDDING ===`);

  // Define a variable at the outer scope to be accessible in the catch block
  let requestBody: { book_id?: string } = {};
  
  try {
    // Parse request body
    requestBody = await req.json();
    const { book_id } = requestBody;

    if (!book_id) {
      return NextResponse.json({ error: 'Book ID is required' }, { status: 400 });
    }

    console.log(`${logPrefix} Processing character profiles for book ID: ${book_id}`);

    // Step 1: Get configuration
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const pineconeIndex = process.env.PINECONE_INDEX;
    // const debug = process.env.DEBUG === 'true'; // Uncomment if needed

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

    // Step 2: Fetch book info from Supabase
    console.log(`${logPrefix} Fetching book information from Supabase: ${book_id}`);

    const { data: book, error: bookError } = await supabase
      .from('books_v2')
      .select('id, title, author, genre, published_date, pinecone_namespace')
      .eq('id', book_id)
      .single();

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

    const pinecone_namespace = book.pinecone_namespace;
    console.log(`${logPrefix} Using namespace: ${pinecone_namespace}`);

    // Step 3: Fetch character profiles from Supabase
    console.log(`${logPrefix} Fetching character profiles for book: ${book.title}`);

    const { data: profiles, error: profilesError } = await supabase
      .from('book_character_profiles')
      .select('*')
      .eq('book_id', book_id);

    if (profilesError) {
      console.error(`${logPrefix} Error fetching character profiles:`, profilesError);
      return NextResponse.json({
        error: 'Failed to fetch character profiles',
        details: profilesError
      }, { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      console.error(`${logPrefix} No character profiles found for book: ${book.title}`);
      return NextResponse.json({
        error: 'No character profiles found for this book',
        bookId: book_id
      }, { status: 404 });
    }

    console.log(`${logPrefix} Found ${profiles.length} character profiles for book: ${book.title}`);

    // Step 4: Initialize OpenAI
    console.log(`${logPrefix} Initializing OpenAI client`);
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Step 5: Initialize Pinecone
    console.log(`${logPrefix} Initializing Pinecone client`);
    const pc = new Pinecone({
      apiKey: pineconeApiKey,
    });

    const index = pc.Index(pineconeIndex);
    const namespaceRef = index.namespace(pinecone_namespace);

    // Step 6: Process character profiles and embed them
    console.log(`${logPrefix} Starting to embed ${profiles.length} character profiles`);

    const embeddingResults = [];
    const startTime = Date.now();

    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      const characterName = profile.character_name;
      const characterProfile = profile.character_profile;

      console.log(`${logPrefix} Processing profile ${i + 1}/${profiles.length}: ${characterName}`);

      try {
        // Generate embedding using OpenAI
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-large',
          input: characterProfile,
          encoding_format: 'float'
        });

        if (!embeddingResponse || !embeddingResponse.data || !embeddingResponse.data[0]) {
          console.error(`${logPrefix} Invalid embedding response for ${characterName}:`, JSON.stringify(embeddingResponse));
          continue;
        }

        const embedding = embeddingResponse.data[0].embedding;

        console.log(`${logPrefix} Generated embedding with ${embedding.length} dimensions for ${characterName}`);

        // Add to Pinecone
        const metadata = {
          book_id: book.id,
          title: book.title,
          author: book.author,
          genre: book.genre || 'Self-Improvement',
          published_date: book.published_date || 'unknown',
          character: characterName,
          character_name: characterName,
          text: characterProfile
        };

        const id = `${book.id}_character_${characterName.replace(/\s+/g, '_')}`;

        // Log the record details for potential management/deletion in Pinecone
        console.log(`${logPrefix} PINECONE RECORD - ID: "${id}"`);
        console.log(`${logPrefix} PINECONE RECORD - NAMESPACE: "${pinecone_namespace}"`);
        console.log(`${logPrefix} PINECONE RECORD - INDEX: "${pineconeIndex}"`);

        await namespaceRef.upsert([{
          id,
          values: embedding,
          metadata
        }]);

        embeddingResults.push({
          id,
          character_name: characterName,
          profile_length: characterProfile.length,
        });

        console.log(`${logPrefix} Successfully embedded character profile for ${characterName}`);
      } catch (profileError) {
        console.error(`${logPrefix} Error embedding profile for ${characterName}:`, profileError);
        // Continue processing other profiles despite errors
      }
    }

    // Final timing statistics
    const totalTime = (Date.now() - startTime) / 1000;
    const timePerProfile = totalTime / profiles.length;
    console.log(`${logPrefix} Embedding complete in ${Math.round(totalTime / 60)} minutes (${totalTime.toFixed(1)} seconds)`);
    console.log(`${logPrefix} Processed ${embeddingResults.length}/${profiles.length} character profiles successfully`);
    console.log(`${logPrefix} Average time per profile: ${timePerProfile.toFixed(2)} seconds`);

    // Step 7: Perform a test query to verify embedding
    let verificationResults = null;

    if (embeddingResults.length > 0) {
      try {
        console.log(`${logPrefix} Performing verification test query`);

        // Pick a character to test
        const testCharacter = embeddingResults[0].character_name;
        console.log(`${logPrefix} Testing search for character: ${testCharacter}`);

        // Create a simple test query using OpenAI
        const testPrompt = `Tell me about ${testCharacter}`;

        // Generate an embedding for the test query
        const queryEmbeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-large',
          input: testPrompt,
          encoding_format: 'float'
        });

        const queryEmbedding = queryEmbeddingResponse.data[0].embedding;

        // Perform a search in Pinecone
        const queryResults = await namespaceRef.query({
          vector: queryEmbedding,
          topK: Math.min(3, embeddingResults.length),
          includeMetadata: true
        });

        console.log(`${logPrefix} Verification query successful: ${queryResults.matches?.length || 0} results found`);

        // Process results to make them more readable
        verificationResults = {
          query: testPrompt,
          results: queryResults.matches?.map(match => ({
            character_name: match.metadata?.character_name,
            score: match.score,
            id: match.id,
            // Include a preview of the text for verification
            preview: (match.metadata?.text && typeof match.metadata.text === 'string') ?
              `${(match.metadata.text as string).substring(0, 200)}...` :
              'No text available'
          })) || []
        };
      } catch (verifyError) {
        console.error(`${logPrefix} Error during verification query:`, verifyError);
        verificationResults = {
          error: verifyError instanceof Error ? verifyError.message : 'Unknown error in verification'
        };
      }
    }

    // Step 8: Return success response with detailed logging
    console.log(`${logPrefix} ========== CHARACTER PROFILE EMBEDDING COMPLETE ==========`);
    console.log(`${logPrefix} Book: "${book.title}" (ID: ${book.id})`);
    console.log(`${logPrefix} Pinecone Index: ${pineconeIndex}`);
    console.log(`${logPrefix} Pinecone Namespace: "${pinecone_namespace}"`);
    console.log(`${logPrefix} Embedding Model: text-embedding-3-large`);
    console.log(`${logPrefix} Expected Profiles: ${profiles.length}`);
    console.log(`${logPrefix} Actual Profiles Processed: ${embeddingResults.length}`);

    // Log details for each embedded character profile for easy lookup
    console.log(`${logPrefix} --------- PINECONE LOOKUP DETAILS ---------`);
    console.log(`${logPrefix} Use these details to find/delete records in Pinecone if needed`);
    console.log(`${logPrefix} Index: "${pineconeIndex}" | Namespace: "${pinecone_namespace}"`);
    embeddingResults.forEach((result, index) => {
      console.log(`${logPrefix} ${index + 1}. Character: "${result.character_name}" | ID: "${result.id}"`);
    });

    console.log(`${logPrefix} Verification Completed: ${verificationResults ? 'Yes' : 'No'}`);
    console.log(`${logPrefix} =======================================`);

    return NextResponse.json({
      success: true,
      message: `Successfully embedded ${embeddingResults.length} character profiles from "${book.title}" into Pinecone`,
      book: {
        id: book.id,
        title: book.title,
        author: book.author,
      },
      profile_count: embeddingResults.length,
      characters: embeddingResults.map(r => ({
        name: r.character_name,
        profile_length: r.profile_length
      })),
      embedding_info: {
        namespace: pinecone_namespace,
        index: pineconeIndex,
        model: 'text-embedding-3-large',
        profile_details: embeddingResults
      },
      verification: verificationResults
    });

  } catch (err) {
    const error = err as Error;
    console.error(`${logPrefix} Error in character profile embedding process:`, error);

    // Create a detailed error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorDetails = {
      error: errorMessage,
      stack: errorStack,
      // Add more context to help diagnose
      context: {
        timestamp: new Date().toISOString(),
        book_id: requestBody?.book_id || 'not set',
        request_id: requestId,
        error_type: error instanceof Error ? error.constructor.name : 'UnknownError',
      }
    };

    console.error(`${logPrefix} Returning error details:`, errorDetails);

    return NextResponse.json(errorDetails, { status: 500 });
  }
}