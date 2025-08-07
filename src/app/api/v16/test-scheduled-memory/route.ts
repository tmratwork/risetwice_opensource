import { NextResponse } from 'next/server';

/**
 * V16 TEST SCHEDULED MEMORY PROCESSING
 * 
 * This endpoint allows manual testing of the V16 scheduled memory processing
 * without waiting for the cron job to execute.
 * 
 * USAGE:
 * 
 * 1. Development:
 *    curl -X GET "http://localhost:3000/api/v16/test-scheduled-memory"
 * 
 * 2. Production:
 *    curl -X GET "https://your-domain.com/api/v16/test-scheduled-memory"
 * 
 * This endpoint simply calls the scheduled processing endpoint with the
 * proper user-agent header to simulate a Vercel cron request.
 */

export async function GET() {
  try {
    console.log('[v16-test-scheduled] Starting manual test of V16 scheduled memory processing');

    // Determine the base URL
    const baseUrl = process.env.NODE_ENV === 'production'
      ? process.env.API_BASE_URL
      : 'http://localhost:3000';
      
    if (!baseUrl) {
      throw new Error('API_BASE_URL environment variable is required in production');
    }

    const scheduledEndpoint = `${baseUrl}/api/v16/scheduled-memory-processing`;

    console.log(`[v16-test-scheduled] Calling scheduled processing endpoint: ${scheduledEndpoint}`);

    // Call the scheduled processing endpoint with the proper headers
    const response = await fetch(scheduledEndpoint, {
      method: 'GET',
      headers: {
        'User-Agent': 'vercel-cron/1.0',
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    console.log('[v16-test-scheduled] Scheduled processing response:', {
      status: response.status,
      success: result.success,
      summary: result.summary
    });

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: 'Scheduled processing failed',
        details: result,
        status: response.status
      }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      message: 'V16 scheduled memory processing test completed successfully',
      scheduledProcessingResult: result
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[v16-test-scheduled] Test failed:', errorMessage);

    return NextResponse.json({
      success: false,
      error: 'Test scheduled processing failed',
      details: errorMessage
    }, { status: 500 });
  }
}

// Only allow GET requests
export async function POST() {
  return NextResponse.json({
    error: 'Method not allowed. This endpoint only accepts GET requests.'
  }, { status: 405 });
}