// src/app/api/s1/therapist-profile/route.ts

import { NextRequest, NextResponse } from 'next/server';
// No server imports needed for testing

export async function GET() {
  try {
    // For testing - return a mock profile
    return NextResponse.json({ 
      profile: {
        id: 'test-profile',
        competency_level: 'student',
        total_sessions_completed: 0,
        total_case_studies_generated: 0,
        is_active: true
      }
    });

  } catch (error) {
    console.error('Error in GET /api/s1/therapist-profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      competency_level
    } = body;

    if (!competency_level) {
      return NextResponse.json(
        { error: 'Missing required field: competency_level' },
        { status: 400 }
      );
    }

    // For testing - return mock successful creation
    return NextResponse.json({ 
      profile: {
        id: 'test-profile',
        ...body,
        is_active: true,
        total_sessions_completed: 0,
        total_case_studies_generated: 0
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/s1/therapist-profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}