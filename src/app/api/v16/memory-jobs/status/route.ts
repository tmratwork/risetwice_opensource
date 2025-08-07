import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logV16MemoryServer } from '@/utils/server-logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function for console logging
const logV16Memory = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_V16_MEMORY_LOGS === 'true') {
    console.log(`[v16_memory] ${message}`, ...args);
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      logV16MemoryServer({
        level: 'ERROR',
        category: 'VALIDATION',
        operation: 'status-check-missing-job-id',
        data: {}
      });
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    logV16Memory(`Checking status for job: ${jobId}`);
    logV16MemoryServer({
      level: 'INFO',
      category: 'JOB_STATUS',
      operation: 'job-status-check-initiated',
      data: { jobId, source: 'api-request' }
    });

    // Get job status and details
    const { data: job, error: jobError } = await supabase
      .from('v16_memory_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError) {
      logV16MemoryServer({
        level: 'ERROR',
        category: 'JOB_STATUS',
        operation: 'fetch-job-status-failed',
        data: { jobId, error: jobError.message }
      });
      return NextResponse.json({ error: 'Failed to fetch job status' }, { status: 500 });
    }

    if (!job) {
      logV16MemoryServer({
        level: 'ERROR',
        category: 'JOB_STATUS',
        operation: 'job-not-found',
        data: { jobId }
      });
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    logV16Memory(`Job status retrieved: ${job.status}`, {
      jobId,
      status: job.status,
      progress: job.progress_percentage,
      totalConversations: job.total_conversations,
      processedConversations: job.processed_conversations
    });

    logV16MemoryServer({
      level: 'INFO',
      category: 'JOB_STATUS',
      operation: 'job-status-retrieved',
      data: {
        jobId,
        status: job.status,
        progressPercentage: job.progress_percentage,
        totalConversations: job.total_conversations,
        processedConversations: job.processed_conversations,
        createdAt: job.created_at,
        updatedAt: job.updated_at
      }
    });

    // If job is completed or failed, also return the most recent memory data
    let memoryData = null;
    if (job.status === 'completed') {
      const { data: memory } = await supabase
        .from('v16_memory')
        .select('*')
        .eq('user_id', job.user_id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();

      if (memory) {
        memoryData = memory;
        logV16Memory(`Including completed memory data in status response`, {
          jobId,
          memoryId: memory.id,
          memoryGeneratedAt: memory.generated_at
        });
      }
    }

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        userId: job.user_id,
        status: job.status,
        jobType: job.job_type,
        totalConversations: job.total_conversations,
        processedConversations: job.processed_conversations,
        progressPercentage: job.progress_percentage,
        batchOffset: job.batch_offset,
        batchSize: job.batch_size,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        errorMessage: job.error_message,
        processingDetails: job.processing_details
      },
      ...(memoryData && { memory: memoryData })
    });

  } catch (error) {
    logV16Memory('❌ Critical error in job status API:', error);
    logV16MemoryServer({
      level: 'ERROR',
      category: 'JOB_STATUS_ERROR',
      operation: 'job-status-critical-failure',
      data: { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}