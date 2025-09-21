// src/app/api/admin/s2/generate-therapist-prompt/route.ts
// Generate AI prompt to simulate specific human therapist based on S2 data
// Quality-first approach: Multiple specialized Claude API calls for comprehensive analysis

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClaudeModel } from '@/config/models';
import { S2_ANALYSIS_PROMPTS, validateTokenLimits, estimateTokenCount } from '@/prompts/s2-therapist-analysis-prompts';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get the correct Claude model from config
const CLAUDE_MODEL = getClaudeModel(); // Returns CLAUDE_SONNET_4

// Dev mode comprehensive logging
const isDevelopment = process.env.NODE_ENV === 'development';
const DEV_LOG_ENABLED = process.env.NEXT_PUBLIC_ENABLE_S2_PROMPT_DEV_LOGS === 'true';
const devLogsDir = path.join(process.cwd(), 'logs', 's2-prompt-generation');

// Global log content for single file
let globalLogContent = '';
let currentTherapistId = '';

// Dev mode logging function - builds single readable log file
function logDevMode(stage: string, type: 'DATA' | 'PROMPT' | 'RESPONSE', content: any, therapistId?: string) {
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
      if (content.profile) {
        globalLogContent += `👤 THERAPIST PROFILE:\n`;
        globalLogContent += `   Name: ${content.profile.full_name}\n`;
        globalLogContent += `   Title: ${content.profile.title}\n`;
        globalLogContent += `   Degrees: ${content.profile.degrees?.join(', ') || 'Not specified'}\n`;
        globalLogContent += `   Location: ${content.profile.primary_location || 'Not specified'}\n`;
        globalLogContent += `   Online Practice: ${content.profile.offers_online ? 'Yes' : 'No'}\n\n`;
      }

      if (content.complete_profile) {
        globalLogContent += `📋 COMPLETE PROFILE:\n`;
        globalLogContent += `   Specialties: ${content.complete_profile.mental_health_specialties?.join(', ') || 'Not specified'}\n`;
        globalLogContent += `   Approaches: ${content.complete_profile.treatment_approaches?.join(', ') || 'Not specified'}\n`;
        globalLogContent += `   Age Ranges: ${content.complete_profile.age_ranges_treated?.join(', ') || 'Not specified'}\n`;
        globalLogContent += `   Practice Type: ${content.complete_profile.practice_type || 'Not specified'}\n\n`;
      }

      if (content.ai_style_config) {
        globalLogContent += `🎨 AI STYLE CONFIG:\n`;
        globalLogContent += `   CBT: ${content.ai_style_config.cognitive_behavioral || 0}%\n`;
        globalLogContent += `   Person-Centered: ${content.ai_style_config.person_centered || 0}%\n`;
        globalLogContent += `   Psychodynamic: ${content.ai_style_config.psychodynamic || 0}%\n`;
        globalLogContent += `   Solution-Focused: ${content.ai_style_config.solution_focused || 0}%\n\n`;
      }

      if (content.patient_description) {
        globalLogContent += `👥 PATIENT DESCRIPTION:\n`;
        globalLogContent += `   ${content.patient_description.description}\n\n`;
      }

      globalLogContent += `💬 CONVERSATION SESSIONS:\n`;
      if (content.sessions && content.sessions.length > 0) {
        content.sessions.forEach((session: any, index: number) => {
          globalLogContent += `   Session ${session.session_number}: ${session.messages.length} messages (`;
          const therapistCount = session.messages.filter((m: any) => m.role === 'therapist').length;
          const patientCount = session.messages.filter((m: any) => m.role === 'ai_patient').length;
          globalLogContent += `${therapistCount} therapist, ${patientCount} patient)\n`;

          // Show first few messages as examples
          if (session.messages.length > 0) {
            globalLogContent += `      Sample messages:\n`;
            session.messages.slice(0, 3).forEach((msg: any, msgIndex: number) => {
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
function logDevStep(stepNumber: number, stepName: string, type: 'PROMPT' | 'RESPONSE', content: any) {
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
    'finalPromptGeneration': 5
  };
  return stepMap[step] || 0;
}

function getStepName(step: string): string {
  const stepNames: Record<string, string> = {
    'dataAnalysis': 'Raw Data Analysis',
    'conversationPatterns': 'Conversation Pattern Analysis',
    'therapeuticStyle': 'Therapeutic Style Assessment',
    'personalitySynthesis': 'Personality & Communication Synthesis',
    'finalPromptGeneration': 'Final Prompt Generation'
  };
  return stepNames[step] || 'Unknown Step';
}

interface TherapistData {
  profile: {
    id: string;
    user_id: string;
    full_name: string;
    title: string;
    degrees: string[];
    primary_location: string;
    offers_online: boolean;
    phone_number?: string;
    email_address?: string;
  };
  complete_profile?: {
    profile_photo_url?: string;
    personal_statement: string;
    mental_health_specialties: string[];
    treatment_approaches: string[];
    age_ranges_treated: string[];
    practice_type: string;
    session_length: string;
    availability_hours: string;
    emergency_protocol: string;
    accepts_insurance: boolean;
    insurance_plans: string[];
    out_of_network_supported: boolean;
  };
  ai_style_config?: {
    cognitive_behavioral: number;
    person_centered: number;
    psychodynamic: number;
    solution_focused: number;
    interaction_style: number;
    tone: number;
    energy_level: number;
  };
  license_verification?: {
    license_type: string;
    license_number: string;
    state_of_licensure: string;
    verification_status?: string;
  };
  patient_description?: {
    description: string;
    character_count: number;
    scenario_type?: string;
    extracted_themes?: string[];
    complexity_level?: number;
  };
  sessions: Array<{
    id: string;
    session_number: number;
    status: string;
    duration_seconds?: number;
    message_count: number;
    created_at: string;
    messages: Array<{
      id: string;
      role: 'therapist' | 'ai_patient';
      content: string;
      created_at: string;
      emotional_tone?: string;
      word_count?: number;
      sentiment_score?: number;
      clinical_relevance?: string;
    }>;
  }>;
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
    logDevMode('0-data-aggregation', 'DATA', therapistData, therapistId);

    // Multi-step Claude AI analysis for maximum quality
    console.log(`[s2_prompt_generation] 🔄 Beginning 5-step AI analysis workflow...`);

    // Step 1: Raw Data Analysis
    console.log(`[s2_prompt_generation] 📊 Step 1/5: Raw Data Analysis`);
    const profileAnalysis = await callClaudeAPI('dataAnalysis', therapistData);

    // Step 2: Conversation Pattern Analysis
    console.log(`[s2_prompt_generation] 💬 Step 2/5: Conversation Pattern Analysis`);
    const conversationAnalysis = await callClaudeAPI('conversationPatterns', therapistData.sessions, profileAnalysis);

    // Step 3: Therapeutic Style Assessment
    console.log(`[s2_prompt_generation] 🎯 Step 3/5: Therapeutic Style Assessment`);
    const styleAssessment = await callClaudeAPI('therapeuticStyle', therapistData.ai_style_config, conversationAnalysis, profileAnalysis);

    // Step 4: Personality & Communication Synthesis
    console.log(`[s2_prompt_generation] 🧠 Step 4/5: Personality & Communication Synthesis`);
    const allPreviousAnalyses = `PROFILE ANALYSIS:\n${profileAnalysis}\n\nCONVERSATION ANALYSIS:\n${conversationAnalysis}\n\nSTYLE ASSESSMENT:\n${styleAssessment}`;
    const personalitySynthesis = await callClaudeAPI('personalitySynthesis', allPreviousAnalyses);

    // Step 5: Final Prompt Generation
    console.log(`[s2_prompt_generation] ✨ Step 5/5: Final Prompt Generation`);
    const finalAnalyses = `${allPreviousAnalyses}\n\nPERSONALITY SYNTHESIS:\n${personalitySynthesis}`;
    const sampleConversations = therapistData.sessions.slice(0, 3).map(session => ({
      sessionNumber: session.session_number,
      messages: session.messages.slice(0, 500), // First 500 messages as examples
      totalMessages: session.messages.length,
      truncated: session.messages.length > 500
    }));
    const generatedPrompt = await callClaudeAPI('finalPromptGeneration', finalAnalyses, sampleConversations, therapistData.profile);

    console.log(`[s2_prompt_generation] ✅ Multi-step analysis complete for ${therapistData.profile.full_name}`);

    // Calculate comprehensive quality scores
    const completenessScore = calculateCompletenessScore(therapistData);
    const confidenceScore = calculateConfidenceScore(therapistData, {
      profileAnalysis,
      conversationAnalysis,
      styleAssessment,
      personalitySynthesis
    });

    // Save the generated prompt with full analysis metadata
    const savedPrompt = await savePromptToDatabase(
      therapistData.profile.id,
      generatedPrompt,
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
    const totalMessages = therapistData.sessions.reduce((sum, s) => sum + s.messages.length, 0);
    const totalTherapistMessages = therapistData.sessions.reduce((sum, s) =>
      sum + s.messages.filter(m => m.role === 'therapist').length, 0
    );
    const totalPatientMessages = therapistData.sessions.reduce((sum, s) =>
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
      therapistName: therapistData.profile.full_name,
      prompt: generatedPrompt,
      promptId: savedPrompt.id,
      promptVersion: savedPrompt.prompt_version,
      processingTimeMinutes: durationMinutes,
      dataAnalysis: {
        totalSessions: therapistData.sessions.length,
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
  sessions?.forEach((session, index) => {
    console.log(`[s2_prompt_generation] 📊 Session ${session.session_number}: ${session.status}, ${session.message_count} messages reported`);
  });

  // Get messages for each session
  console.log(`[s2_prompt_generation] 💭 Fetching messages for each session...`);
  const sessionsWithMessages = await Promise.all(
    (sessions || []).map(async (session, sessionIndex) => {
      console.log(`[s2_prompt_generation] 🔍 Fetching messages for session ${session.session_number} (ID: ${session.id})...`);

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

      console.log(`[s2_prompt_generation] ✅ Session ${session.session_number}: ${messages?.length || 0} total messages (${therapistMessages.length} therapist, ${patientMessages.length} patient)`);

      if (messages?.length) {
        console.log(`[s2_prompt_generation] 📝 Sample messages from session ${session.session_number}:`);
        messages.slice(0, 3).forEach((msg, msgIndex) => {
          console.log(`[s2_prompt_generation]   ${msgIndex + 1}. ${msg.role}: "${msg.content?.substring(0, 50)}..."`);
        });
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

  // Log filtered sessions clearly
  if (lowQualitySessions.length > 0) {
    console.log(`[s2_prompt_generation] 🗑️ FILTERING LOW QUALITY SESSIONS (< ${MIN_MESSAGES_FOR_QUALITY} messages):`);
    lowQualitySessions.forEach(session => {
      console.log(`[s2_prompt_generation] 🗑️ - Session ${session.session_number}: ${session.messages.length} messages (EXCLUDED from analysis)`);
    });
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
async function callClaudeAPI(step: keyof typeof S2_ANALYSIS_PROMPTS, ...args: any[]): Promise<string> {
  const promptConfig = S2_ANALYSIS_PROMPTS[step];

  // Generate the user prompt with provided arguments
  const userPrompt = (promptConfig.user as any)(...args);

  // Validate token limits
  if (!validateTokenLimits(userPrompt, promptConfig.maxTokens)) {
    throw new Error(`Token limits exceeded for step ${step}`);
  }

  const inputTokens = estimateTokenCount(userPrompt + promptConfig.system);
  console.log(`[s2_prompt_generation] 🔍 Step ${step}:`);
  console.log(`[s2_prompt_generation] 📊 - Estimated input tokens: ${inputTokens}`);
  console.log(`[s2_prompt_generation] 📤 - Max output tokens: ${promptConfig.maxTokens}`);

  // Dev logging: Log the full prompt sent to Claude
  const stepNumber = getStepNumber(step);
  const stepName = getStepName(step);
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
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error for step ${step}: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const result = data.content[0].text;

    const outputTokens = estimateTokenCount(result);
    console.log(`[s2_prompt_generation] ✅ Step ${step} complete:`);
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
    console.error(`[s2_prompt_generation] ❌ Claude API error for step ${step}:`, error);
    throw new Error(`Failed to complete analysis step: ${step}`);
  }
}

// Removed hardcoded analysis functions - now using Claude AI for all analysis

async function savePromptToDatabase(
  therapistProfileId: string,
  promptText: string,
  therapistData: TherapistData,
  conversationAnalysis: any,
  completenessScore: number,
  confidenceScore: number
) {
  console.log(`[s2_prompt_generation] 💾 Saving prompt to database...`);

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
    totalSessions: therapistData.sessions.length,
    totalMessages: therapistData.sessions.reduce((sum, s) => sum + s.messages.length, 0),
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
      sessionTranscripts: therapistData.sessions.length > 0
    },
    generatedAt: new Date().toISOString()
  };

  // Generate prompt title
  const promptTitle = `AI Simulation - ${therapistData.profile.full_name} (v${nextVersion})`;

  const { data: savedPrompt, error } = await supabase
    .from('s2_ai_therapist_prompts')
    .insert({
      therapist_profile_id: therapistProfileId,
      prompt_text: promptText,
      prompt_version: nextVersion,
      prompt_title: promptTitle,
      generated_by: 'claude-3-5-sonnet-20241022',
      generation_method: 'comprehensive-analysis',
      prompt_length: promptText.length,
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

  console.log(`[s2_prompt_generation] ✅ Prompt saved with ID: ${savedPrompt.id}, Version: ${nextVersion}`);
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
  if (therapistData.sessions.length > 0) {
    const totalMessages = therapistData.sessions.reduce((sum, s) => sum + s.messages.length, 0);
    if (totalMessages >= 10) score += 1; // Need at least 10 messages for meaningful analysis
  }

  const completenessScore = Number((score / maxPoints).toFixed(2));
  console.log(`[s2_prompt_generation] 📊 Completeness score: ${completenessScore} (${score}/${maxPoints} components available)`);

  return completenessScore;
}

function calculateConfidenceScore(therapistData: TherapistData, analysisResults: any): number {
  let confidence = 0.4; // Base confidence

  // More sessions increase confidence
  const sessionCount = therapistData.sessions.length;
  if (sessionCount >= 5) confidence += 0.25;
  else if (sessionCount >= 3) confidence += 0.2;
  else if (sessionCount >= 1) confidence += 0.15;

  // More therapist messages increase confidence
  const totalMessages = therapistData.sessions.reduce((sum, s) => sum + s.messages.length, 0);
  const therapistMessageCount = therapistData.sessions.reduce((sum, s) =>
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