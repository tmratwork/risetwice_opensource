// src/app/api/ping/route.ts
// This is a minimal API endpoint for testing connectivity

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({ 
      status: 'ok',
      message: 'Server is up and running',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in ping endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}