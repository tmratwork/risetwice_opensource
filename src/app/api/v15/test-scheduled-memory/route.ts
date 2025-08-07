import { NextResponse } from 'next/server';

/**
 * Test endpoint for the scheduled memory processing
 * This allows manual testing of the scheduled job without waiting for cron
 */
export async function POST() {
  try {
    console.log('[test-scheduled-memory] Manual test trigger initiated');

    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/v15/scheduled-memory-processing`, {
      method: 'GET',
      headers: {
        'User-Agent': 'vercel-cron/1.0 (test)',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[test-scheduled-memory] Scheduled processing failed:', result);
      return NextResponse.json({
        success: false,
        error: 'Scheduled processing failed',
        details: result,
        status: response.status,
      }, { status: response.status });
    }

    console.log('[test-scheduled-memory] Scheduled processing completed successfully:', result);

    return NextResponse.json({
      success: true,
      message: 'Scheduled memory processing test completed',
      result,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[test-scheduled-memory] Test failed:', errorMessage);

    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: errorMessage,
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Test endpoint for scheduled memory processing',
    usage: 'Send a POST request to trigger the scheduled memory processing job manually',
    note: 'This is useful for testing without waiting for the daily cron job',
  });
}