// src/app/api/admin/s2/generate-therapist-prompt/route.ts
// Creates background job for AI preview generation
// Actual processing happens in process-ai-preview-jobs worker

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const { therapistId } = await request.json();

    if (!therapistId) {
      return NextResponse.json(
        { error: 'therapistId is required' },
        { status: 400 }
      );
    }

    console.log(`[s2_prompt_generation] 📋 Creating background job for therapist: ${therapistId}`);

    // Verify therapist exists
    const { data: therapist, error: therapistError } = await supabase
      .from('s2_therapist_profiles')
      .select('id, full_name')
      .eq('id', therapistId)
      .single();

    if (therapistError || !therapist) {
      return NextResponse.json(
        { error: 'Therapist not found' },
        { status: 404 }
      );
    }

    // Check if job already exists (pending or processing)
    const { data: existingJob } = await supabase
      .from('s2_ai_preview_jobs')
      .select('id, status')
      .eq('therapist_profile_id', therapistId)
      .in('status', ['pending', 'processing'])
      .single();

    if (existingJob) {
      console.log(`[s2_prompt_generation] ⏳ Job already exists with status: ${existingJob.status}`);
      return NextResponse.json({
        success: true,
        jobId: existingJob.id,
        status: existingJob.status,
        message: 'Job already queued or processing'
      });
    }

    // Create new job
    const { data: newJob, error: jobError } = await supabase
      .from('s2_ai_preview_jobs')
      .insert({
        therapist_profile_id: therapistId,
        status: 'pending',
        current_step_number: 0,
        total_steps: 6
      })
      .select()
      .single();

    if (jobError || !newJob) {
      console.error('[s2_prompt_generation] ❌ Failed to create job:', jobError);
      return NextResponse.json(
        { error: 'Failed to create background job' },
        { status: 500 }
      );
    }

    // Update therapist status to 'generating'
    await supabase
      .from('s2_therapist_profiles')
      .update({ ai_preview_status: 'generating' })
      .eq('id', therapistId);

    console.log(`[s2_prompt_generation] ✅ Job created successfully: ${newJob.id}`);
    console.log(`[s2_prompt_generation] 🔄 Job will be processed by cron worker`);

    return NextResponse.json({
      success: true,
      jobId: newJob.id,
      status: 'pending',
      therapistName: therapist.full_name,
      message: 'Background job created. Processing will begin shortly.'
    });

  } catch (error) {
    console.error(`[s2_prompt_generation] ❌ Error creating job:`, error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
