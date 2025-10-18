// src/app/api/admin/s2/process-ai-preview-jobs/route.ts
// Cron worker to process AI preview generation jobs in background
// Picks up pending jobs and runs the 30-minute AI analysis

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClaudeModel } from '@/config/models';
import { S2_ANALYSIS_PROMPTS, validateTokenLimits, estimateTokenCount, type TherapistData } from '@/prompts/s2-therapist-analysis-prompts';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const CLAUDE_MODEL = getClaudeModel();

// Worker processes ONE job per invocation (called every minute by Vercel Cron)
export async function GET() {
  console.log('[s2_worker] 🔄 Checking for pending AI preview jobs...');

  try {
    // Get one pending job (FIFO - oldest first)
    const { data: pendingJobs, error: fetchError } = await supabase
      .from('s2_ai_preview_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);

    if (fetchError) {
      console.error('[s2_worker] ❌ Error fetching pending jobs:', fetchError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log('[s2_worker] ✅ No pending jobs found');
      return NextResponse.json({ message: 'No pending jobs' });
    }

    const job = pendingJobs[0];
    console.log(`[s2_worker] 📋 Found pending job: ${job.id} for therapist: ${job.therapist_profile_id}`);

    // Mark job as processing
    const { error: updateError } = await supabase
      .from('s2_ai_preview_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id);

    if (updateError) {
      console.error('[s2_worker] ❌ Failed to mark job as processing:', updateError);
      return NextResponse.json({ error: 'Failed to update job status' }, { status: 500 });
    }

    console.log(`[s2_worker] 🚀 Starting AI analysis for job: ${job.id}`);

    // Process the job (this takes ~30 minutes)
    await processJob(job.id, job.therapist_profile_id);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Job processing started'
    });

  } catch (error) {
    console.error('[s2_worker] ❌ Worker error:', error);
    return NextResponse.json(
      { error: 'Worker error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function processJob(jobId: string, therapistId: string) {
  const startTime = Date.now();

  try {
    console.log(`[s2_worker] 🚀 Starting quality-first multi-step analysis for therapist: ${therapistId}`);
    console.log(`[s2_worker] 🤖 Using Claude model: ${CLAUDE_MODEL}`);
    console.log(`[s2_worker] 📊 Processing job: ${jobId}`);

    // Step 0: Aggregate therapist data
    await updateJobProgress(jobId, 0, 'dataAggregation');
    const therapistData = await aggregateTherapistData(therapistId);

    if (!therapistData) {
      throw new Error('Therapist data not found');
    }

    console.log(`[s2_worker] 🔄 Beginning 6-step AI analysis workflow...`);

    // Step 1: Raw Data Analysis
    await updateJobProgress(jobId, 1, 'dataAnalysis');
    console.log(`[s2_worker] 📊 Step 1/6: Raw Data Analysis`);
    const profileAnalysis = await callClaudeAPI('dataAnalysis', therapistData);

    // Step 2: Conversation Pattern Analysis
    await updateJobProgress(jobId, 2, 'conversationPatterns');
    console.log(`[s2_worker] 💬 Step 2/6: Conversation Pattern Analysis`);
    const conversationAnalysis = await callClaudeAPI('conversationPatterns', therapistData.sessions || [], profileAnalysis);

    // Step 3: Therapeutic Style Assessment
    await updateJobProgress(jobId, 3, 'therapeuticStyle');
    console.log(`[s2_worker] 🎯 Step 3/6: Therapeutic Style Assessment`);
    const styleAssessment = await callClaudeAPI('therapeuticStyle', therapistData.ai_style_config, conversationAnalysis, profileAnalysis);

    // Step 4: Personality & Communication Synthesis
    await updateJobProgress(jobId, 4, 'personalitySynthesis');
    console.log(`[s2_worker] 🧠 Step 4/6: Personality & Communication Synthesis`);
    const allPreviousAnalyses = `PROFILE ANALYSIS:\n${profileAnalysis}\n\nCONVERSATION ANALYSIS:\n${conversationAnalysis}\n\nSTYLE ASSESSMENT:\n${styleAssessment}`;
    const personalitySynthesis = await callClaudeAPI('personalitySynthesis', allPreviousAnalyses);

    // Step 5: Final Prompt Generation
    await updateJobProgress(jobId, 5, 'finalPromptGeneration');
    console.log(`[s2_worker] ✨ Step 5/6: Final Prompt Generation`);
    const finalAnalyses = `${allPreviousAnalyses}\n\nPERSONALITY SYNTHESIS:\n${personalitySynthesis}`;
    const sampleConversations = (therapistData.sessions || []).slice(0, 3).map(session => ({
      sessionNumber: session.session_number,
      messages: session.messages.slice(0, 500),
      totalMessages: session.messages.length,
      truncated: session.messages.length > 500
    }));
    const fullPrompt = await callClaudeAPI('finalPromptGeneration', finalAnalyses, sampleConversations, therapistData.profile);

    // Step 6: Realtime Compression
    await updateJobProgress(jobId, 6, 'realtimeCompression');
    console.log(`[s2_worker] 🗜️ Step 6/6: Realtime Compression`);
    const compressedPrompt = await callClaudeAPI('realtimeCompression', fullPrompt);

    console.log(`[s2_worker] ✅ Multi-step analysis complete for ${therapistData.profile?.full_name || 'unknown therapist'}`);

    // Calculate quality scores
    const completenessScore = calculateCompletenessScore(therapistData);
    const confidenceScore = calculateConfidenceScore(therapistData, {
      profileAnalysis,
      conversationAnalysis,
      styleAssessment,
      personalitySynthesis
    });

    // Save prompts to database
    const savedPrompt = await savePromptToDatabase(
      therapistData.profile?.id || '',
      compressedPrompt,
      fullPrompt,
      therapistData,
      {
        profileAnalysis,
        conversationAnalysis,
        styleAssessment,
        personalitySynthesis,
        sampleConversations
      },
      completenessScore,
      confidenceScore
    );

    const endTime = Date.now();
    const durationMinutes = ((endTime - startTime) / 1000 / 60).toFixed(1);

    // Calculate message counts for final report
    const totalMessages = (therapistData.sessions || []).reduce((sum, s) => sum + s.messages.length, 0);
    const totalTherapistMessages = (therapistData.sessions || []).reduce((sum, s) =>
      sum + s.messages.filter((m: { role: string }) => m.role === 'therapist').length, 0
    );
    const totalPatientMessages = (therapistData.sessions || []).reduce((sum, s) =>
      sum + s.messages.filter((m: { role: string }) => m.role === 'ai_patient').length, 0
    );

    console.log(`[s2_worker] 🎉 Final Results:`);
    console.log(`[s2_worker] ⏱️ - Total Processing Time: ${durationMinutes} minutes`);
    console.log(`[s2_worker] 📈 - Completeness Score: ${completenessScore}`);
    console.log(`[s2_worker] 🎯 - Confidence Score: ${confidenceScore}`);
    console.log(`[s2_worker] 📝 - Generated Prompt Length: ${compressedPrompt.length} characters`);
    console.log(`[s2_worker] 💾 - Saved as: ${savedPrompt.id} (v${savedPrompt.prompt_version})`);

    // Mark job as completed
    await supabase
      .from('s2_ai_preview_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        result: {
          promptId: savedPrompt.id,
          promptVersion: savedPrompt.prompt_version,
          processingTimeMinutes: durationMinutes,
          completenessScore,
          confidenceScore,
          totalSessions: (therapistData.sessions || []).length,
          totalMessages,
          totalTherapistMessages,
          totalPatientMessages
        }
      })
      .eq('id', jobId);

    // Update therapist status
    const { error: statusError } = await supabase
      .from('s2_therapist_profiles')
      .update({
        ai_preview_status: 'completed',
        ai_preview_generated_at: new Date().toISOString()
      })
      .eq('id', therapistId);

    if (statusError) {
      console.error('[s2_worker] ⚠️ Failed to update AI Preview status:', statusError);
    } else {
      console.log('[s2_worker] ✅ AI Preview status set to "completed"');
    }

    console.log(`[s2_worker] 🎉 Job ${jobId} completed successfully for therapist: ${therapistData.profile?.full_name || 'unknown'}`);

  } catch (error) {
    console.error(`[s2_worker] ❌ Job ${jobId} failed:`, error);

    // Mark job as failed
    await supabase
      .from('s2_ai_preview_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })
      .eq('id', jobId);

    // Update therapist status to failed
    await supabase
      .from('s2_therapist_profiles')
      .update({ ai_preview_status: 'not_started' })
      .eq('id', therapistId);
  }
}

async function updateJobProgress(jobId: string, stepNumber: number, stepName: string) {
  await supabase
    .from('s2_ai_preview_jobs')
    .update({
      current_step_number: stepNumber,
      current_step: stepName,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);
}

// Copy helper functions from generate-therapist-prompt/route.ts
async function aggregateTherapistData(therapistId: string): Promise<TherapistData | null> {
  console.log(`[s2_worker] 🔍 Starting data aggregation for therapist: ${therapistId}`);

  // Get main therapist profile
  console.log(`[s2_worker] 📋 Fetching therapist profile...`);
  const { data: profile, error: profileError } = await supabase
    .from('s2_therapist_profiles')
    .select('*')
    .eq('id', therapistId)
    .single();

  if (profileError || !profile) {
    console.error('[s2_worker] ❌ Therapist profile not found:', profileError);
    return null;
  }
  console.log(`[s2_worker] ✅ Profile found: ${profile.full_name} (${profile.title})`);

  // Get complete profile
  console.log(`[s2_worker] 📄 Fetching complete profile...`);
  const { data: completeProfiles } = await supabase
    .from('s2_complete_profiles')
    .select('*')
    .eq('user_id', profile.user_id)
    .order('created_at', { ascending: false })
    .limit(1);

  const completeProfile = completeProfiles?.[0];
  if (completeProfile) {
    console.log(`[s2_worker] ✅ Complete profile found with ${completeProfile.mental_health_specialties?.length || 0} specialties`);
  }

  // Get AI style config
  console.log(`[s2_worker] 🎨 Fetching AI style config...`);
  const { data: aiStyleConfigs } = await supabase
    .from('s2_ai_style_configs')
    .select('*')
    .eq('therapist_profile_id', therapistId)
    .order('created_at', { ascending: false })
    .limit(1);

  const aiStyleConfig = aiStyleConfigs?.[0];
  if (aiStyleConfig) {
    console.log(`[s2_worker] ✅ AI style config found - CBT: ${aiStyleConfig.cognitive_behavioral}%, Person-Centered: ${aiStyleConfig.person_centered}%`);
  }

  // Get license verification
  console.log(`[s2_worker] 🏛️ Fetching license verification...`);
  const { data: licenseVerifications } = await supabase
    .from('s2_license_verifications')
    .select('*')
    .eq('user_id', profile.user_id)
    .order('created_at', { ascending: false })
    .limit(1);

  const licenseVerification = licenseVerifications?.[0];
  if (licenseVerification) {
    console.log(`[s2_worker] ✅ License found: ${licenseVerification.license_type} in ${licenseVerification.state_of_licensure}`);
  }

  // Get patient description
  console.log(`[s2_worker] 👥 Fetching patient description...`);
  const { data: patientDescriptions } = await supabase
    .from('s2_patient_descriptions')
    .select('*')
    .eq('therapist_profile_id', therapistId)
    .order('created_at', { ascending: false })
    .limit(1);

  const patientDescription = patientDescriptions?.[0];
  if (patientDescription) {
    console.log(`[s2_worker] ✅ Patient description found: ${patientDescription.description?.substring(0, 100)}...`);
  }

  // Get sessions
  console.log(`[s2_worker] 💬 Fetching sessions...`);
  const { data: sessions } = await supabase
    .from('s2_case_simulation_sessions')
    .select('*')
    .eq('therapist_profile_id', therapistId)
    .order('session_number', { ascending: true });

  console.log(`[s2_worker] ✅ Found ${sessions?.length || 0} sessions`);

  // Get messages for each session
  console.log(`[s2_worker] 💭 Fetching messages for all sessions...`);
  const sessionsWithMessages = await Promise.all(
    (sessions || []).map(async (session) => {
      const { data: messages } = await supabase
        .from('s2_session_messages')
        .select('*')
        .eq('session_id', session.id)
        .order('message_sequence', { ascending: true });

      const therapistMessages = messages?.filter(m => m.role === 'therapist') || [];
      const patientMessages = messages?.filter(m => m.role === 'ai_patient') || [];

      if (messages?.length && messages.length > 0) {
        console.log(`[s2_worker] ✅ Session ${session.session_number}: ${messages.length} total messages (${therapistMessages.length} therapist, ${patientMessages.length} patient)`);
      }

      return {
        ...session,
        messages: messages || []
      };
    })
  );

  // Filter quality sessions
  const MIN_MESSAGES_FOR_QUALITY = 10;
  const qualitySessions = sessionsWithMessages.filter(s => s.messages.length >= MIN_MESSAGES_FOR_QUALITY);
  const lowQualitySessions = sessionsWithMessages.filter(s => s.messages.length < MIN_MESSAGES_FOR_QUALITY);

  if (lowQualitySessions.length > 0) {
    console.log(`[s2_worker] 🗑️ Filtered out ${lowQualitySessions.length} low quality sessions (< ${MIN_MESSAGES_FOR_QUALITY} messages)`);
  }

  if (qualitySessions.length > 0) {
    console.log(`[s2_worker] ✅ HIGH QUALITY SESSIONS (≥ ${MIN_MESSAGES_FOR_QUALITY} messages):`);
    qualitySessions.forEach(session => {
      const therapistCount = session.messages.filter((m: { role: string }) => m.role === 'therapist').length;
      const patientCount = session.messages.filter((m: { role: string }) => m.role === 'ai_patient').length;
      console.log(`[s2_worker] ✅ - Session ${session.session_number}: ${session.messages.length} total (${therapistCount} therapist, ${patientCount} patient) - INCLUDED`);
    });
  }

  // Calculate final statistics
  const totalMessages = qualitySessions.reduce((sum, s) => sum + s.messages.length, 0);
  const totalTherapistMessages = qualitySessions.reduce((sum, s) =>
    sum + s.messages.filter((m: { role: string }) => m.role === 'therapist').length, 0
  );
  const totalPatientMessages = qualitySessions.reduce((sum, s) =>
    sum + s.messages.filter((m: { role: string }) => m.role === 'ai_patient').length, 0
  );

  console.log(`[s2_worker] 📊 FINAL DATA SUMMARY:`);
  console.log(`[s2_worker] 📊 - Total Sessions Found: ${sessionsWithMessages.length} (${lowQualitySessions.length} filtered out)`);
  console.log(`[s2_worker] 📊 - Quality Sessions Used: ${qualitySessions.length}`);
  console.log(`[s2_worker] 📊 - Total Messages: ${totalMessages}`);
  console.log(`[s2_worker] 📊 - Therapist Messages: ${totalTherapistMessages}`);
  console.log(`[s2_worker] 📊 - Patient Messages: ${totalPatientMessages}`);
  console.log(`[s2_worker] 📊 - Profile completeness: ${completeProfile ? '✅' : '❌'}`);
  console.log(`[s2_worker] 📊 - AI style config: ${aiStyleConfig ? '✅' : '❌'}`);
  console.log(`[s2_worker] 📊 - License verification: ${licenseVerification ? '✅' : '❌'}`);
  console.log(`[s2_worker] 📊 - Patient description: ${patientDescription ? '✅' : '❌'}`);

  return {
    profile,
    complete_profile: completeProfile,
    ai_style_config: aiStyleConfig,
    license_verification: licenseVerification,
    patient_description: patientDescription,
    sessions: qualitySessions
  };
}

async function callClaudeAPI(step: keyof typeof S2_ANALYSIS_PROMPTS, ...args: unknown[]): Promise<string> {
  const promptConfig = S2_ANALYSIS_PROMPTS[step];
  const userPrompt = (promptConfig.user as (...args: unknown[]) => string)(...args);

  if (!validateTokenLimits(userPrompt, promptConfig.maxTokens)) {
    throw new Error(`Token limits exceeded for step ${String(step)}`);
  }

  const inputTokens = estimateTokenCount(userPrompt + promptConfig.system);
  console.log(`[s2_worker] 🔍 Step ${String(step)}:`);
  console.log(`[s2_worker] 📊 - Estimated input tokens: ${inputTokens}`);
  console.log(`[s2_worker] 📤 - Max output tokens: ${promptConfig.maxTokens}`);
  console.log(`[s2_worker] 🌊 - Using streaming API (prevents timeout on large responses)`);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': anthropicApiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: promptConfig.maxTokens,
      system: promptConfig.system,
      messages: [{
        role: 'user',
        content: userPrompt
      }],
      stream: true
    }),
    signal: AbortSignal.timeout(1800000) // 30 minute timeout
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} ${errorText}`);
  }

  if (!response.body) throw new Error('Response body is null');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let result = '';
  let buffer = '';
  let lastLogTime = Date.now();
  let chunkCount = 0;

  console.log(`[s2_worker] 📥 Receiving streaming response...`);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

      const jsonStr = trimmedLine.slice(6);
      if (jsonStr === '[DONE]') {
        console.log(`[s2_worker] 🏁 - Stream complete (DONE marker)`);
        continue;
      }

      try {
        const data = JSON.parse(jsonStr);
        if (data.type === 'content_block_delta' && data.delta?.text) {
          result += data.delta.text;
          chunkCount++;

          // Log progress every 5 seconds
          const now = Date.now();
          if (now - lastLogTime > 5000) {
            const currentTokens = estimateTokenCount(result);
            console.log(`[s2_worker] 📊 - Streaming progress: ${currentTokens} tokens received (${chunkCount} chunks)`);
            lastLogTime = now;
          }
        } else if (data.type === 'message_stop') {
          console.log(`[s2_worker] 🏁 - Stream complete`);
        }
      } catch {
        // Ignore parse errors for incomplete SSE chunks
      }
    }
  }

  const outputTokens = estimateTokenCount(result);
  console.log(`[s2_worker] ✅ Step ${String(step)} complete:`);
  console.log(`[s2_worker] 📝 - Generated ${outputTokens} tokens`);
  console.log(`[s2_worker] 💰 - Usage: ${inputTokens} in + ${outputTokens} out`);

  return result;
}

async function savePromptToDatabase(
  therapistProfileId: string,
  compressedPromptText: string,
  fullPromptText: string,
  therapistData: TherapistData,
  conversationAnalysis: Record<string, unknown>,
  completenessScore: number,
  confidenceScore: number
) {
  const { data: existingPrompts } = await supabase
    .from('s2_ai_therapist_prompts')
    .select('prompt_version')
    .eq('therapist_profile_id', therapistProfileId)
    .order('prompt_version', { ascending: false })
    .limit(1);

  const nextVersion = (existingPrompts?.[0]?.prompt_version || 0) + 1;

  const sourceDataSummary = {
    totalSessions: (therapistData.sessions || []).length,
    totalMessages: (therapistData.sessions || []).reduce((sum, s) => sum + s.messages.length, 0),
    hasCompleteProfile: !!therapistData.complete_profile,
    hasAiStyleConfig: !!therapistData.ai_style_config,
    hasLicenseVerification: !!therapistData.license_verification,
    hasPatientDescription: !!therapistData.patient_description,
    generatedAt: new Date().toISOString()
  };

  const promptTitle = `AI Simulation - ${therapistData.profile?.full_name || 'Unknown'} (v${nextVersion})`;

  const { data: savedPrompt, error } = await supabase
    .from('s2_ai_therapist_prompts')
    .insert({
      therapist_profile_id: therapistProfileId,
      prompt_text: compressedPromptText,
      full_prompt_text: fullPromptText,
      prompt_version: nextVersion,
      prompt_title: promptTitle,
      generated_by: CLAUDE_MODEL,
      generation_method: 'comprehensive-analysis',
      prompt_length: compressedPromptText.length,
      source_data_summary: sourceDataSummary,
      conversation_analysis: conversationAnalysis,
      completeness_score: completenessScore,
      confidence_score: confidenceScore,
      status: 'active'
    })
    .select()
    .single();

  if (error) throw new Error('Failed to save prompt to database');
  return savedPrompt;
}

function calculateCompletenessScore(therapistData: TherapistData): number {
  let score = 0;
  const maxPoints = 6;

  score += 1;
  if (therapistData.complete_profile) score += 1;
  if (therapistData.ai_style_config) score += 1;
  if (therapistData.license_verification) score += 1;
  if (therapistData.patient_description) score += 1;

  if ((therapistData.sessions || []).length > 0) {
    const totalMessages = (therapistData.sessions || []).reduce((sum, s) => sum + s.messages.length, 0);
    if (totalMessages >= 10) score += 1;
  }

  return Number((score / maxPoints).toFixed(2));
}

function calculateConfidenceScore(therapistData: TherapistData, analysisResults: Record<string, unknown>): number {
  let confidence = 0.4;

  const sessionCount = (therapistData.sessions || []).length;
  if (sessionCount >= 5) confidence += 0.25;
  else if (sessionCount >= 3) confidence += 0.2;
  else if (sessionCount >= 1) confidence += 0.15;

  const therapistMessageCount = (therapistData.sessions || []).reduce((sum, s) =>
    sum + s.messages.filter(m => m.role === 'therapist').length, 0
  );

  if (therapistMessageCount >= 100) confidence += 0.2;
  else if (therapistMessageCount >= 50) confidence += 0.15;
  else if (therapistMessageCount >= 25) confidence += 0.1;
  else if (therapistMessageCount >= 10) confidence += 0.05;

  if (analysisResults.profileAnalysis) confidence += 0.05;
  if (analysisResults.conversationAnalysis) confidence += 0.05;
  if (analysisResults.styleAssessment) confidence += 0.05;
  if (analysisResults.personalitySynthesis) confidence += 0.05;

  if (therapistData.complete_profile) confidence += 0.1;
  if (therapistData.ai_style_config) confidence += 0.1;
  if (therapistData.license_verification) confidence += 0.05;
  if (therapistData.patient_description) confidence += 0.05;

  return Math.min(confidence, 1.0);
}
