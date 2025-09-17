// src/app/api/s2/contact-support/route.ts
// API route for handling contact support form submissions

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SupportRequestBody {
  name: string;
  email: string;
  subject: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  userId?: string;
  userEmail?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SupportRequestBody = await request.json();

    // Validate required fields
    if (!body.name || !body.email || !body.subject || !body.message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate priority
    if (!['low', 'medium', 'high'].includes(body.priority)) {
      return NextResponse.json(
        { error: 'Invalid priority level' },
        { status: 400 }
      );
    }

    // Insert support request into Supabase
    const { data, error } = await supabase
      .from('support_requests')
      .insert({
        name: body.name.trim(),
        email: body.email.trim(),
        subject: body.subject.trim(),
        message: body.message.trim(),
        priority: body.priority,
        user_id: body.userId || null,
        user_email: body.userEmail || body.email.trim(),
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error inserting support request:', error);
      return NextResponse.json(
        { error: 'Failed to submit support request' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Support request submitted successfully',
      requestId: data.id
    });

  } catch (error) {
    console.error('Error in contact-support API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}