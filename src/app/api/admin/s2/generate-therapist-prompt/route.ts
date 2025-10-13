// src/app/api/admin/s2/generate-therapist-prompt/route.ts
// Generate AI prompt to simulate specific human therapist based on S2 data
// Quality-first approach: Multiple specialized Claude API calls for comprehensive analysis

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClaudeModel } from '@/config/models';
import { S2_ANALYSIS_PROMPTS, validateTokenLimits, estimateTokenCount, type TherapistData, type SessionData } from '@/prompts/s2-therapist-analysis-prompts';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get the correct Claude model from config
const CLAUDE_MODEL = getClaudeModel(); // Returns CLAUDE_SONNET_4_5

// Dev mode comprehensive logging
const isDevelopment = process.env.NODE_ENV === 'development';
const DEV_LOG_ENABLED = process.env.NEXT_PUBLIC_ENABLE_S2_PROMPT_DEV_LOGS === 'true';
const devLogsDir = path.join(process.cwd(), 'logs', 's2-prompt-generation');

// Global log content for single file
let globalLogContent = '';
let currentTherapistId = '';

// Dev mode logging function - builds single readable log file
function logDevMode(stage: string, type: 'DATA' | 'PROMPT' | 'RESPONSE', content: Record<string, unknown>, therapistId?: string) {
  if (!isDevelopment || !DEV_LOG_ENABLED) return;

  try {
    if (therapistId) currentTherapistId = therapistId;

    if (type === 'DATA') {
      globalLogContent += `\n${'='.repeat(60)}\n`;
      globalLogContent += `STEP 0: DATA EXTRACTION\n`;
      globalLogContent += `${'='.repeat(60)}\n`;
      globalLogContent += `Timestamp: ${new Date().toLocaleString()}\n`;
      globalLogContent += `Therapist ID: ${currentTherapistId}\n\n`;

      globalLogContent += `EXTRACTED DATA FROM SUPABASE:\n`;
      globalLogContent += `${'-'.repeat(40)}\n`;

      // Format the therapist data in a readable way
      const therapistData = content as TherapistData;
      if (therapistData.profile) {
        globalLogContent += `👤 THERAPIST PROFILE:\n`;
        globalLogContent += `   Name: ${therapistData.profile.full_name}\n`;
        globalLogContent += `   Title: ${therapistData.profile.title}\n`;
        globalLogContent += `   Degrees: ${therapistData.profile.degrees?.join(', ') || 'Not specified'}\n`;
        globalLogContent += `   Location: ${therapistData.profile.primary_location || 'Not specified'}\n`;
        globalLogContent += `   Online Practice: ${therapistData.profile.offers_online ? 'Yes' : 'No'}\n\n`;
      }

      if (therapistData.complete_profile) {
        globalLogContent += `📋 COMPLETE PROFILE:\n`;
        globalLogContent += `   Specialties: ${therapistData.complete_profile.mental_health_specialties?.join(', ') || 'Not specified'}\n`;
        globalLogContent += `   Approaches: ${therapistData.complete_profile.treatment_approaches?.join(', ') || 'Not specified'}\n`;
        globalLogContent += `   Age Ranges: ${therapistData.complete_profile.age_ranges_treated?.join(', ') || 'Not specified'}\n`;
        globalLogContent += `   Practice Type: ${therapistData.complete_profile.practice_type || 'Not specified'}\n\n`;
      }

      if (therapistData.ai_style_config) {
        globalLogContent += `🎨 AI STYLE CONFIG:\n`;
        globalLogContent += `   CBT: ${therapistData.ai_style_config.cognitive_behavioral || 0}%\n`;
        globalLogContent += `   Person-Centered: ${therapistData.ai_style_config.person_centered || 0}%\n`;
        globalLogContent += `   Psychodynamic: ${therapistData.ai_style_config.psychodynamic || 0}%\n`;
        globalLogContent += `   Solution-Focused: ${therapistData.ai_style_config.solution_focused || 0}%\n\n`;
      }

      if (therapistData.patient_description) {
        globalLogContent += `👥 PATIENT DESCRIPTION:\n`;
        globalLogContent += `   ${therapistData.patient_description.description}\n\n`;
      }

      globalLogContent += `💬 CONVERSATION SESSIONS:\n`;
      if (therapistData.sessions && therapistData.sessions.length > 0) {
        therapistData.sessions.forEach((session: SessionData) => {
          globalLogContent += `   Session ${session.session_number}: ${session.messages.length} messages (`;
          const therapistCount = session.messages.filter((m) => m.role === 'therapist').length;
          const patientCount = session.messages.filter((m) => m.role === 'ai_patient').length;
          globalLogContent += `${therapistCount} therapist, ${patientCount} patient)\n`;

          // Show first few messages as examples
          if (session.messages.length > 0) {
            globalLogContent += `      Sample messages:\n`;
            session.messages.slice(0, 3).forEach((msg, msgIndex: number) => {
              const role = msg.role === 'therapist' ? 'THERAPIST' : 'PATIENT';
              const preview = msg.content.length > 60 ? msg.content.substring(0, 60) + '...' : msg.content;
              globalLogContent += `      ${msgIndex + 1}. ${role}: "${preview}"\n`;
            });
            if (session.messages.length > 3) {
              globalLogContent += `      ... and ${session.messages.length - 3} more messages\n`;
            }
            globalLogContent += `\n`;
          }
        });
      } else {
        globalLogContent += `   No conversation sessions available\n\n`;
      }
    }
  } catch (error) {
    console.error(`[s2_prompt_generation] ❌ Dev logging error:`, error);
  }
}

// Add step logging for prompts and responses
function logDevStep(stepNumber: number, stepName: string, type: 'PROMPT' | 'RESPONSE', content: Record<string, unknown>) {
  if (!isDevelopment || !DEV_LOG_ENABLED) return;

  try {
    if (type === 'PROMPT') {
      globalLogContent += `\n${'='.repeat(60)}\n`;
      globalLogContent += `STEP ${stepNumber}: ${stepName.toUpperCase()}\n`;
      globalLogContent += `${'='.repeat(60)}\n\n`;

      globalLogContent += `📤 PROMPT SENT TO CLAUDE AI:\n`;
      globalLogContent += `${'-'.repeat(40)}\n`;
      globalLogContent += `Model: ${content.model}\n`;
      globalLogContent += `Max Output Tokens: ${content.maxTokens}\n\n`;

      globalLogContent += `🤖 SYSTEM MESSAGE:\n`;
      globalLogContent += `${content.system}\n\n`;

      globalLogContent += `👤 USER MESSAGE:\n`;
      globalLogContent += `${content.user}\n\n`;
    }

    else if (type === 'RESPONSE') {
      globalLogContent += `📥 CLAUDE AI RESPONSE:\n`;
      globalLogContent += `${'-'.repeat(40)}\n`;
      globalLogContent += `Input Tokens: ${content.inputTokens}\n`;
      globalLogContent += `Output Tokens: ${content.outputTokens}\n`;
      globalLogContent += `Timestamp: ${content.timestamp}\n\n`;

      globalLogContent += `🧠 AI ANALYSIS:\n`;
      globalLogContent += `${content.response}\n\n`;
    }
  } catch (error) {
    console.error(`[s2_prompt_generation] ❌ Dev step logging error:`, error);
  }
}

// Save the complete log file at the end
function saveDevLogFile() {
  if (!isDevelopment || !DEV_LOG_ENABLED || !globalLogContent) return;

  try {
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(devLogsDir)) {
      fs.mkdirSync(devLogsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}_${currentTherapistId}_COMPLETE_ANALYSIS.log`;
    const filepath = path.join(devLogsDir, filename);

    // Add final header
    let finalContent = `S2 AI THERAPIST PROMPT GENERATION - COMPLETE ANALYSIS\n`;
    finalContent += `${'='.repeat(60)}\n`;
    finalContent += `Therapist ID: ${currentTherapistId}\n`;
    finalContent += `Analysis Start: ${new Date().toLocaleString()}\n`;
    finalContent += `${'='.repeat(60)}\n`;
    finalContent += globalLogContent;

    fs.writeFileSync(filepath, finalContent);
    console.log(`[s2_prompt_generation] 📝 DEV LOG: Complete analysis saved to ${filename}`);

    // Reset for next analysis
    globalLogContent = '';
    currentTherapistId = '';
  } catch (error) {
    console.error(`[s2_prompt_generation] ❌ Dev log save error:`, error);
  }
}

// Helper functions for step mapping
function getStepNumber(step: string): number {
  const stepMap: Record<string, number> = {
    'dataAnalysis': 1,
    'conversationPatterns': 2,
    'therapeuticStyle': 3,
    'personalitySynthesis': 4,
    'finalPromptGeneration': 5,
    'realtimeCompression': 6
  };
  return stepMap[step] || 0;
}

function getStepName(step: string): string {
  const stepNames: Record<string, string> = {
    'dataAnalysis': 'Raw Data Analysis',
    'conversationPatterns': 'Conversation Pattern Analysis',
    'therapeuticStyle': 'Therapeutic Style Assessment',
    'personalitySynthesis': 'Personality & Communication Synthesis',
    'finalPromptGeneration': 'Final Prompt Generation',
    'realtimeCompression': 'Realtime Compression'
  };
  return stepNames[step] || 'Unknown Step';
}


export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { therapistId } = await request.json();

    if (!therapistId) {
      return NextResponse.json(
        { error: 'therapistId is required' },
        { status: 400 }
      );
    }
    console.log(`[s2_prompt_generation] 🚀 Starting quality-first multi-step analysis for therapist: ${therapistId}`);
    console.log(`[s2_prompt_generation] 🤖 Using Claude model: ${CLAUDE_MODEL}`);

    // Step 0: Aggregate all therapist data
    const therapistData = await aggregateTherapistData(therapistId);

    if (!therapistData) {
      return NextResponse.json(
        { error: 'Therapist data not found' },
        { status: 404 }
      );
    }

    // Dev logging: Log all extracted data
    logDevMode('0-data-aggregation', 'DATA', therapistData as unknown as Record<string, unknown>, therapistId);

    // Multi-step Claude AI analysis for maximum quality
    console.log(`[s2_prompt_generation] 🔄 Beginning 6-step AI analysis workflow...`);

    // Step 1: Raw Data Analysis
    console.log(`[s2_prompt_generation] 📊 Step 1/6: Raw Data Analysis`);
    const profileAnalysis = await callClaudeAPI('dataAnalysis', therapistData);

    // Step 2: Conversation Pattern Analysis
    console.log(`[s2_prompt_generation] 💬 Step 2/6: Conversation Pattern Analysis`);
    const conversationAnalysis = await callClaudeAPI('conversationPatterns', therapistData.sessions || [], profileAnalysis);

    // Step 3: Therapeutic Style Assessment
    console.log(`[s2_prompt_generation] 🎯 Step 3/6: Therapeutic Style Assessment`);
    const styleAssessment = await callClaudeAPI('therapeuticStyle', therapistData.ai_style_config, conversationAnalysis, profileAnalysis);

    // Step 4: Personality & Communication Synthesis
    console.log(`[s2_prompt_generation] 🧠 Step 4/6: Personality & Communication Synthesis`);
    const allPreviousAnalyses = `PROFILE ANALYSIS:\n${profileAnalysis}\n\nCONVERSATION ANALYSIS:\n${conversationAnalysis}\n\nSTYLE ASSESSMENT:\n${styleAssessment}`;
    const personalitySynthesis = await callClaudeAPI('personalitySynthesis', allPreviousAnalyses);

    // Step 5: Final Prompt Generation (comprehensive, ~30k tokens)
    console.log(`[s2_prompt_generation] ✨ Step 5/6: Final Prompt Generation`);
    const finalAnalyses = `${allPreviousAnalyses}\n\nPERSONALITY SYNTHESIS:\n${personalitySynthesis}`;
    const sampleConversations = (therapistData.sessions || []).slice(0, 3).map(session => ({
      sessionNumber: session.session_number,
      messages: session.messages.slice(0, 500), // First 500 messages as examples
      totalMessages: session.messages.length,
      truncated: session.messages.length > 500
    }));
    const fullPrompt = await callClaudeAPI('finalPromptGeneration', finalAnalyses, sampleConversations, therapistData.profile);

    // Step 6: Realtime Compression (compress to ~15k tokens)
    console.log(`[s2_prompt_generation] 🗜️ Step 6/6: Realtime Compression`);
    const compressedPrompt = await callClaudeAPI('realtimeCompression', fullPrompt);

    console.log(`[s2_prompt_generation] ✅ Multi-step analysis complete for ${therapistData.profile?.full_name || 'unknown therapist'}`);

    // Calculate comprehensive quality scores
    const completenessScore = calculateCompletenessScore(therapistData);
    const confidenceScore = calculateConfidenceScore(therapistData, {
      profileAnalysis,
      conversationAnalysis,
      styleAssessment,
      personalitySynthesis
    });

    // Save both full and compressed prompts with analysis metadata
    const savedPrompt = await savePromptToDatabase(
      therapistData.profile?.id || '',
      compressedPrompt,  // Compressed version for Realtime API
      fullPrompt,        // Full version for Chat Completions API
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

    // Calculate accurate message counts
    const totalMessages = (therapistData.sessions || []).reduce((sum, s) => sum + s.messages.length, 0);
    const totalTherapistMessages = (therapistData.sessions || []).reduce((sum, s) =>
      sum + s.messages.filter(m => m.role === 'therapist').length, 0
    );
    const totalPatientMessages = (therapistData.sessions || []).reduce((sum, s) =>
      sum + s.messages.filter(m => m.role === 'ai_patient').length, 0
    );

    const endTime = Date.now();
    const durationMinutes = ((endTime - startTime) / 1000 / 60).toFixed(1);

    console.log(`[s2_prompt_generation] 🎉 Final Results:`);
    console.log(`[s2_prompt_generation] ⏱️ - Total Processing Time: ${durationMinutes} minutes`);
    console.log(`[s2_prompt_generation] 📈 - Completeness Score: ${completenessScore}`);
    console.log(`[s2_prompt_generation] 🎯 - Confidence Score: ${confidenceScore}`);
    console.log(`[s2_prompt_generation] 📝 - Generated Prompt Length: ${generatedPrompt.length} characters`);
    console.log(`[s2_prompt_generation] 💾 - Saved as: ${savedPrompt.id} (v${savedPrompt.prompt_version})`);

    // Save the complete dev log file
    saveDevLogFile();

    return NextResponse.json({
      success: true,
      therapistName: therapistData.profile?.full_name || 'Unknown',
      prompt: generatedPrompt,
      promptId: savedPrompt.id,
      promptVersion: savedPrompt.prompt_version,
      processingTimeMinutes: durationMinutes,
      dataAnalysis: {
        totalSessions: (therapistData.sessions || []).length,
        totalMessages: totalMessages,
        totalTherapistMessages: totalTherapistMessages,
        totalPatientMessages: totalPatientMessages,
        completenessScore: completenessScore,
        confidenceScore: confidenceScore,
        analysisSteps: {
          profileAnalysis: profileAnalysis.substring(0, 200) + '...',
          conversationAnalysis: conversationAnalysis.substring(0, 200) + '...',
          styleAssessment: styleAssessment.substring(0, 200) + '...',
          personalitySynthesis: personalitySynthesis.substring(0, 200) + '...'
        }
      }
    });

  } catch (error) {
    const endTime = Date.now();
    const durationMinutes = ((endTime - startTime) / 1000 / 60).toFixed(1);
    console.error(`[s2_prompt_generation] ❌ Error in multi-step analysis after ${durationMinutes} minutes:`, error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function aggregateTherapistData(therapistId: string): Promise<TherapistData | null> {
  console.log(`[s2_prompt_generation] 🔍 Starting data aggregation for therapist: ${therapistId}`);

  // Get main therapist profile
  console.log(`[s2_prompt_generation] 📋 Fetching therapist profile...`);
  const { data: profile, error: profileError } = await supabase
    .from('s2_therapist_profiles')
    .select('*')
    .eq('id', therapistId)
    .single();

  if (profileError || !profile) {
    console.error('[s2_prompt_generation] ❌ Therapist profile not found:', profileError);
    return null;
  }
  console.log(`[s2_prompt_generation] ✅ Profile found: ${profile.full_name} (${profile.title})`);

  // Get complete profile (uses user_id, get most recent if multiple)
  console.log(`[s2_prompt_generation] 📄 Fetching complete profile...`);
  const { data: completeProfiles, error: completeProfileError } = await supabase
    .from('s2_complete_profiles')
    .select('*')
    .eq('user_id', profile.user_id)
    .order('created_at', { ascending: false })
    .limit(1);

  const completeProfile = completeProfiles?.[0];

  if (completeProfileError) {
    console.log(`[s2_prompt_generation] ⚠️ No complete profile found:`, completeProfileError.message);
  } else if (completeProfile) {
    console.log(`[s2_prompt_generation] ✅ Complete profile found with ${completeProfile.mental_health_specialties?.length || 0} specialties`);
  } else {
    console.log(`[s2_prompt_generation] ⚠️ No complete profile data available for this user`);
  }

  // Get AI style configuration (get most recent if multiple)
  console.log(`[s2_prompt_generation] 🎨 Fetching AI style config...`);
  const { data: aiStyleConfigs, error: aiStyleError } = await supabase
    .from('s2_ai_style_configs')
    .select('*')
    .eq('therapist_profile_id', therapistId)
    .order('created_at', { ascending: false })
    .limit(1);

  const aiStyleConfig = aiStyleConfigs?.[0];

  if (aiStyleError) {
    console.log(`[s2_prompt_generation] ⚠️ No AI style config found:`, aiStyleError.message);
  } else if (aiStyleConfig) {
    console.log(`[s2_prompt_generation] ✅ AI style config found - CBT: ${aiStyleConfig.cognitive_behavioral}%, Person-Centered: ${aiStyleConfig.person_centered}%`);
  } else {
    console.log(`[s2_prompt_generation] ⚠️ No AI style config data available for this user`);
  }

  // Get license verification (uses user_id, get most recent if multiple)
  console.log(`[s2_prompt_generation] 🏛️ Fetching license verification...`);
  const { data: licenseVerifications, error: licenseError } = await supabase
    .from('s2_license_verifications')
    .select('*')
    .eq('user_id', profile.user_id)
    .order('created_at', { ascending: false })
    .limit(1);

  const licenseVerification = licenseVerifications?.[0];

  if (licenseError) {
    console.log(`[s2_prompt_generation] ⚠️ No license verification found:`, licenseError.message);
  } else if (licenseVerification) {
    console.log(`[s2_prompt_generation] ✅ License found: ${licenseVerification.license_type} in ${licenseVerification.state_of_licensure}`);
  } else {
    console.log(`[s2_prompt_generation] ⚠️ No license verification data available for this user`);
  }

  // Get patient description (get most recent if multiple)
  console.log(`[s2_prompt_generation] 👥 Fetching patient description...`);
  const { data: patientDescriptions, error: patientError } = await supabase
    .from('s2_patient_descriptions')
    .select('*')
    .eq('therapist_profile_id', therapistId)
    .order('created_at', { ascending: false })
    .limit(1);

  const patientDescription = patientDescriptions?.[0];

  if (patientError) {
    console.log(`[s2_prompt_generation] ⚠️ No patient description found:`, patientError.message);
  } else if (patientDescription) {
    console.log(`[s2_prompt_generation] ✅ Patient description found: ${patientDescription.description?.substring(0, 100)}...`);
  } else {
    console.log(`[s2_prompt_generation] ⚠️ No patient description data available for this user`);
  }

  // Get all sessions with messages
  console.log(`[s2_prompt_generation] 💬 Fetching sessions...`);
  const { data: sessions, error: sessionsError } = await supabase
    .from('s2_case_simulation_sessions')
    .select(`
      id,
      session_number,
      status,
      duration_seconds,
      message_count,
      created_at
    `)
    .eq('therapist_profile_id', therapistId)
    .order('session_number', { ascending: true });

  if (sessionsError) {
    console.error(`[s2_prompt_generation] ❌ Error fetching sessions:`, sessionsError);
    return null;
  }

  console.log(`[s2_prompt_generation] ✅ Found ${sessions?.length || 0} sessions`);

  // Get messages for each session
  console.log(`[s2_prompt_generation] 💭 Fetching messages for all sessions...`);
  const sessionsWithMessages = await Promise.all(
    (sessions || []).map(async (session) => {
      const { data: messages, error: messagesError } = await supabase
        .from('s2_session_messages')
        .select(`
          id,
          role,
          content,
          created_at,
          emotional_tone,
          word_count,
          sentiment_score,
          clinical_relevance,
          message_sequence,
          timestamp_in_session
        `)
        .eq('session_id', session.id)
        .order('message_sequence', { ascending: true });

      if (messagesError) {
        console.error(`[s2_prompt_generation] ❌ Error fetching messages for session ${session.session_number}:`, messagesError);
        return {
          ...session,
          messages: []
        };
      }

      const therapistMessages = messages?.filter(m => m.role === 'therapist') || [];
      const patientMessages = messages?.filter(m => m.role === 'ai_patient') || [];

      // Only log sessions with messages
      if (messages?.length && messages.length > 0) {
        console.log(`[s2_prompt_generation] ✅ Session ${session.session_number}: ${messages.length} total messages (${therapistMessages.length} therapist, ${patientMessages.length} patient)`);

        if (messages.length >= 3) {
          console.log(`[s2_prompt_generation] 📝 Sample messages from session ${session.session_number}:`);
          messages.slice(0, 3).forEach((msg, msgIndex) => {
            console.log(`[s2_prompt_generation]   ${msgIndex + 1}. ${msg.role}: "${msg.content?.substring(0, 50)}..."`);
          });
        }
      }

      return {
        ...session,
        messages: messages || []
      };
    })
  );

  // Filter out low quality conversations (less than 10 messages)
  const MIN_MESSAGES_FOR_QUALITY = 10;
  const lowQualitySessions = sessionsWithMessages.filter(session => session.messages.length < MIN_MESSAGES_FOR_QUALITY);
  const qualitySessions = sessionsWithMessages.filter(session => session.messages.length >= MIN_MESSAGES_FOR_QUALITY);

  // Log filtered sessions summary
  if (lowQualitySessions.length > 0) {
    console.log(`[s2_prompt_generation] 🗑️ Filtered out ${lowQualitySessions.length} low quality sessions (< ${MIN_MESSAGES_FOR_QUALITY} messages)`);
  }

  if (qualitySessions.length > 0) {
    console.log(`[s2_prompt_generation] ✅ HIGH QUALITY SESSIONS (≥ ${MIN_MESSAGES_FOR_QUALITY} messages):`);
    qualitySessions.forEach(session => {
      const therapistCount = session.messages.filter(m => m.role === 'therapist').length;
      const patientCount = session.messages.filter(m => m.role === 'ai_patient').length;
      console.log(`[s2_prompt_generation] ✅ - Session ${session.session_number}: ${session.messages.length} total (${therapistCount} therapist, ${patientCount} patient) - INCLUDED`);
    });
  }

  // Use only quality sessions for analysis
  const filteredSessions = qualitySessions;

  // Calculate final statistics from quality sessions only
  const totalMessages = filteredSessions.reduce((sum, s) => sum + s.messages.length, 0);
  const totalTherapistMessages = filteredSessions.reduce((sum, s) =>
    sum + s.messages.filter(m => m.role === 'therapist').length, 0
  );
  const totalPatientMessages = filteredSessions.reduce((sum, s) =>
    sum + s.messages.filter(m => m.role === 'ai_patient').length, 0
  );

  console.log(`[s2_prompt_generation] 📊 FINAL DATA SUMMARY:`);
  console.log(`[s2_prompt_generation] 📊 - Total Sessions Found: ${sessionsWithMessages.length} (${lowQualitySessions.length} filtered out)`);
  console.log(`[s2_prompt_generation] 📊 - Quality Sessions Used: ${filteredSessions.length}`);
  console.log(`[s2_prompt_generation] 📊 - Total Messages: ${totalMessages}`);
  console.log(`[s2_prompt_generation] 📊 - Therapist Messages: ${totalTherapistMessages}`);
  console.log(`[s2_prompt_generation] 📊 - Patient Messages: ${totalPatientMessages}`);
  console.log(`[s2_prompt_generation] 📊 - Profile completeness: ${completeProfile ? '✅' : '❌'}`);
  console.log(`[s2_prompt_generation] 📊 - AI style config: ${aiStyleConfig ? '✅' : '❌'}`);
  console.log(`[s2_prompt_generation] 📊 - License verification: ${licenseVerification ? '✅' : '❌'}`);
  console.log(`[s2_prompt_generation] 📊 - Patient description: ${patientDescription ? '✅' : '❌'}`);

  return {
    profile,
    complete_profile: completeProfile || undefined,
    ai_style_config: aiStyleConfig || undefined,
    license_verification: licenseVerification || undefined,
    patient_description: patientDescription || undefined,
    sessions: filteredSessions  // Use only quality sessions
  };
}

// Core Claude API calling function for multi-step analysis
// CODE VERSION: 2025-01-13 - Streaming API to prevent timeouts on large responses
async function callClaudeAPI(step: keyof typeof S2_ANALYSIS_PROMPTS, ...args: unknown[]): Promise<string> {
  const promptConfig = S2_ANALYSIS_PROMPTS[step];

  // Generate the user prompt with provided arguments
  const userPrompt = (promptConfig.user as (...args: unknown[]) => string)(...args);

  // Validate token limits
  if (!validateTokenLimits(userPrompt, promptConfig.maxTokens)) {
    throw new Error(`Token limits exceeded for step ${String(step)}`);
  }

  const inputTokens = estimateTokenCount(userPrompt + promptConfig.system);
  console.log(`[s2_prompt_generation] 🔍 Step ${String(step)}:`);
  console.log(`[s2_prompt_generation] 📊 - Estimated input tokens: ${inputTokens}`);
  console.log(`[s2_prompt_generation] 📤 - Max output tokens: ${promptConfig.maxTokens}`);
  console.log(`[s2_prompt_generation] 🌊 - Using streaming API (prevents timeout on large responses)`);

  // Dev logging: Log the full prompt sent to Claude
  const stepNumber = getStepNumber(String(step));
  const stepName = getStepName(String(step));
  const fullPrompt = {
    system: promptConfig.system,
    user: userPrompt,
    model: CLAUDE_MODEL,
    maxTokens: promptConfig.maxTokens
  };
  logDevStep(stepNumber, stepName, 'PROMPT', fullPrompt);

  try {
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
        stream: true  // Enable streaming to prevent timeout
      }),
      signal: AbortSignal.timeout(1800000) // 30 minute absolute timeout as safety net
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error for step ${String(step)}: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Handle streaming response
    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = '';
    let lastLogTime = Date.now();
    let chunkCount = 0;
    let buffer = ''; // Buffer to handle incomplete lines across chunks

    console.log(`[s2_prompt_generation] 📥 Receiving streaming response...`);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Split by newlines, keeping incomplete last line in buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        if (trimmedLine.startsWith('data: ')) {
          const jsonStr = trimmedLine.slice(6);

          // Skip special SSE markers
          if (jsonStr === '[DONE]') {
            console.log(`[s2_prompt_generation] 🏁 - Stream complete (DONE marker)`);
            continue;
          }

          try {
            const data = JSON.parse(jsonStr);

            // Handle different event types
            if (data.type === 'content_block_delta') {
              // Accumulate text chunks
              if (data.delta?.text) {
                result += data.delta.text;
                chunkCount++;

                // Log progress every 5 seconds
                const now = Date.now();
                if (now - lastLogTime > 5000) {
                  const currentTokens = estimateTokenCount(result);
                  console.log(`[s2_prompt_generation] 📊 - Streaming progress: ${currentTokens} tokens received (${chunkCount} chunks)`);
                  lastLogTime = now;
                }
              }
            } else if (data.type === 'message_stop') {
              console.log(`[s2_prompt_generation] 🏁 - Stream complete`);
            } else if (data.type === 'error') {
              throw new Error(`Stream error: ${data.error?.message || 'Unknown error'}`);
            }
          } catch (parseError) {
            // Log but don't fail on parse errors - might be incomplete chunk
            console.warn(`[s2_prompt_generation] ⚠️ Failed to parse SSE line: ${jsonStr.substring(0, 100)}...`);
          }
        }
      }
    }

    const outputTokens = estimateTokenCount(result);
    console.log(`[s2_prompt_generation] ✅ Step ${String(step)} complete:`);
    console.log(`[s2_prompt_generation] 📝 - Generated ${outputTokens} tokens`);
    console.log(`[s2_prompt_generation] 💰 - Usage: ${inputTokens} in + ${outputTokens} out`);

    // Dev logging: Log the Claude AI response
    const responseData = {
      step,
      inputTokens,
      outputTokens,
      response: result,
      model: CLAUDE_MODEL,
      timestamp: new Date().toISOString()
    };
    logDevStep(stepNumber, stepName, 'RESPONSE', responseData);

    return result;

  } catch (error) {
    console.error(`[s2_prompt_generation] ❌ Claude API error for step ${String(step)}:`, error);
    throw new Error(`Failed to complete analysis step: ${String(step)}`);
  }
}

// Removed hardcoded analysis functions - now using Claude AI for all analysis

async function savePromptToDatabase(
  therapistProfileId: string,
  compressedPromptText: string,
  fullPromptText: string,
  therapistData: TherapistData,
  conversationAnalysis: Record<string, unknown>,
  completenessScore: number,
  confidenceScore: number
) {
  console.log(`[s2_prompt_generation] 💾 Saving prompts to database...`);

  // Calculate next version number
  const { data: existingPrompts } = await supabase
    .from('s2_ai_therapist_prompts')
    .select('prompt_version')
    .eq('therapist_profile_id', therapistProfileId)
    .order('prompt_version', { ascending: false })
    .limit(1);

  const nextVersion = (existingPrompts?.[0]?.prompt_version || 0) + 1;

  // Prepare source data summary
  const sourceDataSummary = {
    totalSessions: (therapistData.sessions || []).length,
    totalMessages: (therapistData.sessions || []).reduce((sum, s) => sum + s.messages.length, 0),
    hasCompleteProfile: !!therapistData.complete_profile,
    hasAiStyleConfig: !!therapistData.ai_style_config,
    hasLicenseVerification: !!therapistData.license_verification,
    hasPatientDescription: !!therapistData.patient_description,
    dataSourcesAvailable: {
      profile: true, // Always have this
      completeProfile: !!therapistData.complete_profile,
      aiStyleConfig: !!therapistData.ai_style_config,
      licenseVerification: !!therapistData.license_verification,
      patientDescription: !!therapistData.patient_description,
      sessionTranscripts: (therapistData.sessions || []).length > 0
    },
    generatedAt: new Date().toISOString()
  };

  // Generate prompt title
  const promptTitle = `AI Simulation - ${therapistData.profile?.full_name || 'Unknown'} (v${nextVersion})`;

  // Calculate token counts for logging
  const compressedTokens = estimateTokenCount(compressedPromptText);
  const fullTokens = estimateTokenCount(fullPromptText);

  console.log(`[s2_prompt_generation] 📊 Prompt sizes:`);
  console.log(`[s2_prompt_generation]    - Full prompt: ${fullTokens} tokens (for Chat Completions API)`);
  console.log(`[s2_prompt_generation]    - Compressed prompt: ${compressedTokens} tokens (for Realtime API)`);

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

  if (error) {
    console.error('[s2_prompt_generation] Error saving prompt to database:', error);
    throw new Error('Failed to save prompt to database');
  }

  console.log(`[s2_prompt_generation] ✅ Both prompts saved with ID: ${savedPrompt.id}, Version: ${nextVersion}`);
  return savedPrompt;
}

function calculateCompletenessScore(therapistData: TherapistData): number {
  let score = 0;
  const maxPoints = 6;

  // Core profile (always available) - 1 point
  score += 1;

  // Complete profile - 1 point
  if (therapistData.complete_profile) score += 1;

  // AI style configuration - 1 point
  if (therapistData.ai_style_config) score += 1;

  // License verification - 1 point
  if (therapistData.license_verification) score += 1;

  // Patient description - 1 point
  if (therapistData.patient_description) score += 1;

  // Session transcripts - 1 point
  if ((therapistData.sessions || []).length > 0) {
    const totalMessages = (therapistData.sessions || []).reduce((sum, s) => sum + s.messages.length, 0);
    if (totalMessages >= 10) score += 1; // Need at least 10 messages for meaningful analysis
  }

  const completenessScore = Number((score / maxPoints).toFixed(2));
  console.log(`[s2_prompt_generation] 📊 Completeness score: ${completenessScore} (${score}/${maxPoints} components available)`);

  return completenessScore;
}

function calculateConfidenceScore(therapistData: TherapistData, analysisResults: Record<string, unknown>): number {
  let confidence = 0.4; // Base confidence

  // More sessions increase confidence
  const sessionCount = (therapistData.sessions || []).length;
  if (sessionCount >= 5) confidence += 0.25;
  else if (sessionCount >= 3) confidence += 0.2;
  else if (sessionCount >= 1) confidence += 0.15;

  // More therapist messages increase confidence
  const totalMessages = (therapistData.sessions || []).reduce((sum, s) => sum + s.messages.length, 0);
  const therapistMessageCount = (therapistData.sessions || []).reduce((sum, s) =>
    sum + s.messages.filter(m => m.role === 'therapist').length, 0
  );

  if (therapistMessageCount >= 100) confidence += 0.2;
  else if (therapistMessageCount >= 50) confidence += 0.15;
  else if (therapistMessageCount >= 25) confidence += 0.1;
  else if (therapistMessageCount >= 10) confidence += 0.05;

  // Having multiple AI analyses increases confidence significantly
  if (analysisResults.profileAnalysis) confidence += 0.05;
  if (analysisResults.conversationAnalysis) confidence += 0.05;
  if (analysisResults.styleAssessment) confidence += 0.05;
  if (analysisResults.personalitySynthesis) confidence += 0.05;

  // Having complete profile data increases confidence
  if (therapistData.complete_profile) confidence += 0.1;
  if (therapistData.ai_style_config) confidence += 0.1;
  if (therapistData.license_verification) confidence += 0.05;
  if (therapistData.patient_description) confidence += 0.05;

  // Cap at 1.0
  const confidenceScore = Math.min(confidence, 1.0);
  console.log(`[s2_prompt_generation] 📊 Enhanced confidence score: ${confidenceScore.toFixed(2)}`);
  console.log(`[s2_prompt_generation] 📊 - Sessions: ${sessionCount}, Messages: ${totalMessages}, Therapist messages: ${therapistMessageCount}`);
  console.log(`[s2_prompt_generation] 📊 - AI analyses completed: ${Object.keys(analysisResults).length}`);

  return Number(confidenceScore.toFixed(2));
}