/**
 * Mathpix API Integration for OCR of mathematical content
 * This endpoint handles image uploads and processes them with Mathpix API
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    console.log("Mathpix API route: Processing request");
    
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.error("Mathpix API route: No file provided");
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(`Mathpix API route: File received - size: ${file.size} bytes, type: ${file.type}`);
    
    if (file.size === 0) {
      console.error("Mathpix API route: File has zero size");
      return NextResponse.json({ error: 'Empty file provided' }, { status: 400 });
    }

    // Get Mathpix credentials from environment variables
    const appId = process.env.MATHPIX_APP_ID;
    const appKey = process.env.MATHPIX_APP_KEY;

    if (!appId || !appKey) {
      console.error("Mathpix API route: Credentials not configured");
      return NextResponse.json(
        { error: 'OCR service configuration error' }, 
        { status: 500 }
      );
    }

    // Ensure proper credentials are provided - no test mode
    if (!appId || !appKey || appId === 'test' || appKey === 'test') {
      console.error("Mathpix API route: Missing or invalid credentials");
      return NextResponse.json(
        { error: 'Mathpix API credentials not properly configured. Please set valid MATHPIX_APP_ID and MATHPIX_APP_KEY environment variables.' }, 
        { status: 500 }
      );
    }

    // Convert file to binary
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Form-based approach recommended by Mathpix for better performance
    console.log(`Mathpix API route: File size: ${buffer.length} bytes`);
    
    // Use FormData for multipart/form-data request (recommended by Mathpix)
    const mathpixFormData = new FormData();
    
    // Create a Blob from the buffer
    const blob = new Blob([buffer], { type: file.type });
    
    // Add file to form data (preferred over base64 encoding)
    mathpixFormData.append('file', blob, file.name);
    
    // Add options JSON according to current Mathpix docs
    mathpixFormData.append('options_json', JSON.stringify({
      formats: ["text", "latex", "html"],
      data_options: {
        include_asciimath: true,
        include_latex: true
        // Removed all other data_options that might cause errors
      },
      math_inline_delimiters: ["$", "$"],
      math_display_delimiters: ["$", "$"], // Using consistent delimiters
      enable_spell_check: true
    }));
    
    // Call Mathpix OCR API with increased timeout
    console.log("Mathpix API route: Calling external Mathpix API using FormData approach");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch('https://api.mathpix.com/v3/text', {
      method: 'POST',
      headers: {
        'app_id': appId,
        'app_key': appKey,
        // Don't set Content-Type header for FormData, browser will add with boundary
      },
      body: mathpixFormData,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    // Enhanced error handling to capture detailed Mathpix API errors
    if (!response.ok) {
      let errorMessage = 'Failed to process image with OCR service';
      let errorDetails = {};
      let responseText = '';
      
      try {
        // First try to get the raw response text for logging
        responseText = await response.text();
        console.error("Mathpix API raw error response:", responseText);
        
        // Then try to parse it as JSON if possible
        try {
          const errorData = JSON.parse(responseText);
          console.error("Mathpix API error (parsed):", errorData);
          errorDetails = errorData;
          
          // Extract the most useful error information
          if (errorData.error) {
            errorMessage = `Mathpix API error: ${errorData.error}`;
          }
          
          // Check for specific error types
          if (errorData.error_info?.detail) {
            console.error("Mathpix detailed error:", errorData.error_info.detail);
            errorMessage += ` - ${errorData.error_info.detail}`;
          }
          
          // Check if this is an image processing error
          if (errorData.error && errorData.error.startsWith('image_')) {
            console.error("Mathpix image processing error:", errorData.error);
            errorMessage = `Image processing error: ${errorData.error}`;
          }
        } catch (parseError) {
          console.error("Could not parse error response as JSON:", parseError);
        }
      } catch (textError) {
        console.error("Could not get error response text:", textError);
        errorMessage = `Mathpix API returned status ${response.status} with no parsable response`;
      }
      
      return NextResponse.json({ 
        error: errorMessage,
        details: errorDetails,
        raw_response: responseText,
        status_code: response.status
      }, { status: response.status });
    }

    // Parse the successful response
    const result = await response.json();
    
    // Enhanced logging for successful responses to help with debugging
    console.log("Mathpix API route: Received result from Mathpix API", {
      hasText: !!result.text,
      textLength: result.text?.length || 0,
      hasLatex: !!result.latex,
      hasHtml: !!result.html,
      hasMathML: !!result.mathml,
      hasLineData: Array.isArray(result.line_data),
      lineDataCount: Array.isArray(result.line_data) ? result.line_data.length : 0,
      confidence: result.confidence,
      request_id: result.request_id
    });
    
    // Log a sample of the text to diagnose content issues
    if (result.text) {
      const textSample = result.text.length > 100 ? 
        `${result.text.substring(0, 100)}...` : result.text;
      console.log(`Mathpix text sample: "${textSample}"`);
    } else {
      console.log("Mathpix text is empty or undefined");
    }
    
    // Validate the OCR result
    if (!result.text || result.text.trim().length === 0) {
      console.error("Mathpix API route: No text detected in the image");
      
      // Log detailed error information for debugging even if status is 200
      console.error("Mathpix empty text details:", JSON.stringify(result, null, 2));
      
      return NextResponse.json({ 
        error: 'No text detected in the image',
        text: 'No text was detected in the image. Please try a clearer image with visible text or math expressions.',
        mathpix_response: result,  // Include full response for client-side debugging
      }, { status: 200 }); // Still 200 to allow client to handle in a user-friendly way
    }
    
    // Format the OCR result for our application
    const formattedResult = {
      latex: result.latex,
      latex_styled: result.latex_styled,
      text: result.text,
      html: result.html,
      mathml: result.mathml,
      line_data: result.line_data,
      confidence: result.confidence,
      request_id: result.request_id,
      // Include any other fields you need from the Mathpix response
    };

    console.log("Mathpix API route: Returning successful OCR result");
    return NextResponse.json(formattedResult);
  } catch (error) {
    console.error('Mathpix API route error:', error);
    return NextResponse.json({ 
      error: 'Failed to process image',
      details: error instanceof Error ? error.message : 'Unknown error',
      text: 'An error occurred while processing your image. Please try again with a different image.'
    }, { status: 500 });
  }
}