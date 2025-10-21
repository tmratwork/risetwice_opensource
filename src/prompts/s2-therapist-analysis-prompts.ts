// src/prompts/s2-therapist-analysis-prompts.ts
// Centralized Claude AI prompts for S2 Therapist Analysis System
// Optimized for Vercel CRON 10-minute execution limits

// Type definitions for therapist data
interface TherapistProfile {
  id?: string;
  full_name?: string;
  title?: string;
  degrees?: string[];
  primary_location?: string;
  offers_online?: boolean;
}

interface CompleteProfile {
  personal_statement?: string;
  mental_health_specialties?: string[];
  treatment_approaches?: string[];
  age_ranges_treated?: string[];
  practice_type?: string;
  session_length?: string;
  availability_hours?: string;
  emergency_protocol?: string;
  accepts_insurance?: boolean;
  insurance_plans?: string[];
}

interface LicenseVerification {
  license_type?: string;
  license_number?: string;
  state_of_licensure?: string;
}

interface PatientDescription {
  description?: string;
  complexity_level?: string;
  extracted_themes?: string[];
}

interface AIStyleConfig {
  cognitive_behavioral?: number;
  person_centered?: number;
  psychodynamic?: number;
  solution_focused?: number;
  friction?: number;
  tone?: number;
  energy_level?: number;
}

interface TherapistData {
  profile?: TherapistProfile;
  complete_profile?: CompleteProfile;
  license_verification?: LicenseVerification;
  patient_description?: PatientDescription;
  ai_style_config?: AIStyleConfig;
  sessions?: SessionData[];
}

interface SessionMessage {
  role: string;
  content: string;
}

interface SessionData {
  session_number?: string;
  status?: string;
  duration_seconds?: number;
  message_count?: number;
  messages: SessionMessage[];
  id?: string;
}

interface SampleConversationSession {
  sessionNumber: string;
  totalMessages: number;
  truncated?: boolean;
  messages: SessionMessage[];
}

export const S2_ANALYSIS_PROMPTS = {
  /**
   * STEP 1: Raw Data Analysis (OPTIMIZED)
   * Reduced from 12k to 5k tokens - focuses on distinctive characteristics only
   */
  dataAnalysis: {
    system: `You are an expert clinical psychologist and therapist profiling specialist. Analyze therapist profile data and extract the MOST DISTINCTIVE professional characteristics.

Focus on what makes this therapist UNIQUE:
- Standout credentials or specializations
- Notable personal statement insights
- Primary treatment approaches
- Key practice patterns

CRITICAL: Only analyze data explicitly provided. If information is missing, state "Insufficient data for [section]" - never fabricate.

Be concise and insightful. Prioritize distinctive traits over generic observations.`,

    user: (therapistData: TherapistData) => `**TOKEN LIMIT: 5,000 tokens. Be concise and focus on what's UNIQUE.**

Analyze this therapist profile:

**PROFILE:**
Name: ${therapistData.profile?.full_name}
Title: ${therapistData.profile?.title}
Credentials: ${therapistData.profile?.degrees?.join(', ')}
Location: ${therapistData.profile?.primary_location}
Online: ${therapistData.profile?.offers_online ? 'Yes' : 'No'}

**PROFESSIONAL DETAILS:**
${therapistData.complete_profile ? `
Personal Statement: ${therapistData.complete_profile.personal_statement}
Specialties: ${therapistData.complete_profile.mental_health_specialties?.join(', ')}
Approaches: ${therapistData.complete_profile.treatment_approaches?.join(', ')}
Age Ranges: ${therapistData.complete_profile.age_ranges_treated?.join(', ')}
Practice Type: ${therapistData.complete_profile.practice_type}
Session Length: ${therapistData.complete_profile.session_length}
Availability: ${therapistData.complete_profile.availability_hours}
Emergency Protocol: ${therapistData.complete_profile.emergency_protocol}
Insurance: ${therapistData.complete_profile.accepts_insurance ? 'Accepts' : 'Cash only'} - ${therapistData.complete_profile.insurance_plans?.join(', ')}
` : 'No detailed profile available'}

**LICENSE:**
${therapistData.license_verification ? `
Type: ${therapistData.license_verification.license_type}
Number: ${therapistData.license_verification.license_number}
State: ${therapistData.license_verification.state_of_licensure}
` : 'No license data available'}

**PATIENT FOCUS:**
${therapistData.patient_description ? `
Description: ${therapistData.patient_description.description}
Complexity: ${therapistData.patient_description.complexity_level || 'Not specified'}
Themes: ${therapistData.patient_description.extracted_themes?.join(', ') || 'None'}
` : 'No patient focus described'}

Provide HIGH-LEVEL analysis (2-3 paragraphs each):

1. **Professional Identity** (500 tokens max)
   - Who they are as a clinician - their defining characteristics

2. **Core Specializations** (500 tokens max)
   - Primary areas of expertise and what makes them distinctive

3. **Practice Approach** (500 tokens max)
   - How they structure their practice and why

4. **Target Population** (400 tokens max)
   - Who they serve best and key considerations

5. **Credential Implications** (300 tokens max)
   - What their background reveals about their clinical style

If data is insufficient for any section, state "Insufficient data provided for [section]" rather than speculating.`,

    maxTokens: 5000
  },

  /**
   * STEP 2: Conversation Pattern Analysis (OPTIMIZED)
   * Reduced from 16k to 6k tokens - focuses on most distinctive patterns
   */
  conversationPatterns: {
    system: `You are an expert conversation analyst specializing in therapeutic communication. Identify the MOST DISTINCTIVE communication patterns that make this therapist unique.

Focus on:
- Signature communication style markers
- Notable intervention patterns
- Characteristic language use

CRITICAL CONTEXT: This is a LIMITED SAMPLE from a short case scenario. Only analyze patterns explicitly demonstrated in the transcripts. State "Insufficient transcript data to assess [aspect]" if data is limited.

NEVER fabricate techniques not demonstrated. Be specific and quote examples.`,

    user: (sessions: SessionData[], profileAnalysis: string) => `**TOKEN LIMIT: 6,000 tokens. Focus on MOST DISTINCTIVE patterns with 2-3 examples each.**

**PROFILE ANALYSIS:**
${profileAnalysis}

**SESSION TRANSCRIPTS:**
${sessions.map((session) => `
--- SESSION ${session.session_number} ---
Status: ${session.status} | Duration: ${session.duration_seconds ? Math.floor(session.duration_seconds / 60) + 'm' : 'Unknown'} | Messages: ${session.message_count}

${session.messages?.slice(0, 500).map((msg: SessionMessage, msgIndex: number) =>
  `${msgIndex + 1}. ${msg.role.toUpperCase()}: ${msg.content}`
).join('\n') || 'No messages available'}
${session.messages?.length > 500 ? `\n[TRUNCATED: ${session.messages.length - 500} messages not shown]` : ''}
`).join('\n\n')}

Analyze the MOST DISTINCTIVE patterns (with token budgets):

1. **Communication Signature** (1,200 tokens)
   - What makes their conversational flow unique?
   - Turn-taking rhythm and pacing preferences
   - Quote 2-3 examples showing their style

2. **Primary Intervention Pattern** (1,200 tokens)
   - Their signature therapeutic move
   - When and how they deploy it
   - 2-3 specific examples from transcripts

3. **Language Markers** (1,000 tokens)
   - Distinctive vocabulary, phrases, or expressions
   - Tone indicators (warmth, formality, energy)
   - Quote 3-5 characteristic phrases

4. **Questioning Style** (1,000 tokens)
   - Preferred question types and sequences
   - Information-gathering vs. therapeutic balance
   - 2-3 example question sequences

5. **Relationship Building** (800 tokens)
   - How they establish rapport and boundaries
   - Empathy and validation methods
   - Observable patterns across sessions

6. **Response Consistency** (800 tokens)
   - How they handle different emotions/topics
   - Adaptability patterns visible in these sessions

Remember: Only comment on patterns VISIBLE in these transcripts. If insufficient data, explicitly state it.`,

    maxTokens: 6000
  },

  /**
   * STEP 3: Therapeutic Style Assessment (OPTIMIZED)
   * Reduced from 14k to 5k tokens - prioritizes style config validation
   */
  therapeuticStyle: {
    system: `You are a senior clinical supervisor assessing therapeutic approaches and modalities. Integrate AI style configuration with observed patterns to create a focused therapeutic profile.

CRITICAL PRIORITIZATION: Communication Style slider values (Friction, Tone, Expression) MUST override any conflicting transcript observations. These are the provider's self-assessed preferences.

Only assess approaches explicitly mentioned in configuration or clearly demonstrated. State "Insufficient data to assess [area]" if needed.

Be concise and focus on integration, not repetition of previous analyses.`,

    user: (aiStyleConfig: AIStyleConfig | null, conversationAnalysis: string, profileAnalysis: string) => `**TOKEN LIMIT: 5,000 tokens. Focus on KEY assessments and validation.**

**CONFIGURED PREFERENCES:**
${aiStyleConfig ? `
Modalities:
- Cognitive Behavioral: ${aiStyleConfig.cognitive_behavioral}%
- Person-Centered: ${aiStyleConfig.person_centered}%
- Psychodynamic: ${aiStyleConfig.psychodynamic}%
- Solution-Focused: ${aiStyleConfig.solution_focused}%

Communication Style (PRIORITIZE THESE):
- Friction: ${aiStyleConfig.friction}% (0=Encouraging, 100=Adversarial)
- Tone: ${aiStyleConfig.tone}% (0=Warm & Casual, 100=Clinical & Formal)
- Expression: ${aiStyleConfig.energy_level}% (0=Calm & Grounded, 100=Energetic & Expressive)
` : 'No configuration available'}

**PREVIOUS ANALYSES:**
Profile: ${profileAnalysis}
Patterns: ${conversationAnalysis}

Provide KEY assessments (token budgets per section):

1. **Primary Theoretical Framework** (1,000 tokens)
   - Main approach and evidence of consistency
   - How secondary approaches integrate

2. **Modality Integration** (1,000 tokens)
   - How different approaches combine in practice
   - Client-specific adaptation patterns

3. **Clinical Decision Style** (800 tokens)
   - How they choose interventions
   - Session structure preferences

4. **Therapeutic Relationship Dynamics** (800 tokens)
   - Authority vs. collaboration balance
   - Emotional availability and boundary maintenance

5. **Intervention Preferences** (700 tokens)
   - Preferred intervention types and timing
   - Support vs. confrontation balance

6. **Configuration Validation** (700 tokens)
   - Alignment between stated preferences and practice
   - Key consistencies or discrepancies

CRITICAL: When Communication Style sliders conflict with observations, ALWAYS prioritize configured values.`,

    maxTokens: 5000
  },

  /**
   * STEP 4: Personality & Communication Synthesis (OPTIMIZED)
   * Reduced from 16k to 7k tokens - synthesis focus, avoid repetition
   */
  personalitySynthesis: {
    system: `You are an expert personality psychologist synthesizing analyses into a cohesive profile that captures this therapist's unique individual characteristics.

CRITICAL LIMITATIONS: Make only conservative, well-supported observations. This is a LIMITED SAMPLE. Do not draw far-reaching character assumptions.

Focus on:
- Observable personality traits in therapeutic setting
- Authentic communication signature
- Individual quirks and patterns

NEVER fabricate traits. State "Limited data to assess [dimension]" when appropriate.

Create a focused profile grounded strictly in available evidence.`,

    user: (allPreviousAnalyses: string) => `**TOKEN LIMIT: 7,000 tokens. Synthesize key insights - avoid repeating previous analyses.**

**ALL PREVIOUS ANALYSES:**
${allPreviousAnalyses}

Create focused synthesis (token budgets):

1. **Core Personality Traits** (1,500 tokens)
   - 3-4 dominant characteristics in therapeutic setting
   - Interpersonal style and emotional expression
   - Values driving their behavior

2. **Authentic Communication Signature** (1,500 tokens)
   - Unique speech patterns and verbal habits
   - Personal warmth vs. professional distance
   - What makes their communication distinctive

3. **Individual Quirks** (1,200 tokens)
   - Characteristic phrases or expressions
   - Personal touches in style
   - Observable strengths and potential blind spots

4. **Interpersonal Dynamics** (1,200 tokens)
   - How they build rapport
   - Conflict and difficult conversation approach
   - Authority and power management

5. **Professional Identity Integration** (1,000 tokens)
   - How personal traits enhance effectiveness
   - Their unique value in therapeutic relationships
   - Observable development patterns

6. **Distinctive Presence** (600 tokens)
   - Overall impression they create
   - What makes them memorable
   - How clients likely experience them

CRITICAL: Ground ALL observations in available data. Do not make far-reaching assumptions. Acknowledge data limitations explicitly.`,

    maxTokens: 7000
  },

  /**
   * STEP 5: Final Prompt Generation (OPTIMIZED - MINOR CHANGES)
   * Keeping at 6k tokens - already well-sized
   */
  finalPromptGeneration: {
    system: `You are an expert AI prompt engineer creating roleplay character simulations. Create a comprehensive prompt that allows an AI to accurately roleplay as this specific therapist.

Focus on:
- Exact speech patterns and vocabulary
- Specific therapeutic techniques and timing
- Personality quirks and individual characteristics
- Decision-making processes

CRITICAL: Base ALL instructions on provided analyses. NEVER hallucinate behaviors not supported by evidence. Instruct the simulated AI to acknowledge gaps rather than fabricate information.

Create a masterful, evidence-based roleplay prompt.`,

    user: (allAnalyses: string, sampleConversations: SampleConversationSession[], therapistProfile: TherapistProfile | null) => `**TOKEN LIMIT: 6,000 tokens. Create complete, immediately usable AI roleplay prompt.**

**THERAPIST IDENTITY:**
Name: ${therapistProfile?.full_name}
Title: ${therapistProfile?.title}
Credentials: ${therapistProfile?.degrees?.join(', ') || 'Not specified'}
Location: ${therapistProfile?.primary_location || 'Not specified'}

**COMPLETE ANALYSIS:**
${allAnalyses}

**SAMPLE CONVERSATIONS:**
${sampleConversations.map((session) => `
Session ${session.sessionNumber} (${session.totalMessages} messages${session.truncated ? ` - showing first 500` : ''}):
${session.messages.slice(0, 15).map((msg: SessionMessage) =>
  `${msg.role === 'therapist' ? 'THERAPIST' : 'PATIENT'}: ${msg.content}`
).join('\n')}
${session.messages.length > 15 ? `[... ${session.messages.length - 15} more messages]` : ''}
`).join('\n\n')}

Create a comprehensive AI roleplay prompt with this structure:

**CRITICAL: Use exact name "${therapistProfile?.full_name}" and title "${therapistProfile?.title}" - NO placeholders.**

1. **Identity & Core Traits** (800 tokens)
   - Complete professional/personal identity (use exact name and title above)
   - Core characteristics and values

2. **Communication Style** (1,000 tokens)
   - Exact speech patterns, vocabulary, and phrases
   - Tone, energy, and emotional expression guidelines

3. **Therapeutic Approach** (1,200 tokens)
   - Specific techniques and when to use them
   - Session structure and flow preferences
   - How to handle different client presentations

4. **Behavioral Patterns** (1,000 tokens)
   - Consistent personality traits to maintain
   - Interpersonal dynamics
   - Professional boundaries

5. **Conversation Flow** (1,000 tokens)
   - Session structure (opening, middle, closing)
   - Question types and sequencing
   - Handling challenging topics

6. **Individual Quirks** (500 tokens)
   - Unique verbal and behavioral patterns
   - Memorable characteristics

7. **Quality & Safety Instructions** (500 tokens)
   - Character consistency guidelines
   - Anti-hallucination rules: NEVER fabricate background, credentials, or techniques not in this profile
   - Acknowledge limitations when asked about uncovered areas

Write as a complete, professional system prompt ready for immediate use.`,

    maxTokens: 6000
  },

  /**
   * STEP 6: Realtime Compression (OPTIMIZED)
   * Reduced from 16k to 8k tokens - target 7-8k output instead of 14-15k
   */
  realtimeCompression: {
    system: `You are an expert at compressing prompts while preserving essential information.

CRITICAL TARGET: Output MUST be 7,000-8,000 tokens (not optional - this is required).

Your task: Reduce verbosity while keeping ALL core content.

KEEP (in full):
- Complete identity and credentials
- ALL communication patterns and examples
- ALL therapeutic techniques
- Safety and anti-hallucination protocols
- Specific phrases and speech patterns

REDUCE (shorten but don't eliminate):
- Keep 1-2 examples instead of 3-5 per section
- Convert paragraphs to concise bullets where appropriate
- Simplify lengthy explanations

DO NOT REMOVE:
- Any section entirely
- Critical behavioral instructions
- Safety protocols
- Character identity markers

RULES:
1. Output must be coherent and complete - no mid-sentence cuts
2. Maintain structure: Identity, Communication, Therapeutic Approach, Behavior, Anti-Hallucination
3. Preserve exact therapist name, title, and key phrases
4. Keep all safety warnings
5. Output 7,000-8,000 tokens (REQUIRED)`,

    user: (fullPrompt: string) => {
      const estimatedTokens = Math.round(fullPrompt.length / 4);
      return `Compress this prompt from ~${estimatedTokens} tokens to 7,000-8,000 tokens:

${fullPrompt}

**CRITICAL REQUIREMENTS:**
- Target: 7,000-8,000 tokens (this is REQUIRED)
- Maintain ALL sections, just more concise
- Keep richness and detail - don't over-compress
- If you're below 6,500 tokens, you've removed too much

Output a complete, detailed, immediately usable prompt within 7-8k tokens.`;
    },

    maxTokens: 8000
  }
} as const;

// Token count estimation helper
export const estimateTokenCount = (text: string): number => {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
};

// Helper to validate token limits before API calls
export const validateTokenLimits = (inputText: string, maxTokens: number): boolean => {
  const estimatedTokens = estimateTokenCount(inputText);
  const safeLimit = 150000; // Safe input limit for Claude

  return estimatedTokens < safeLimit && maxTokens <= 32000;
};

// Export types for TypeScript
export type AnalysisStep = keyof typeof S2_ANALYSIS_PROMPTS;
export type PromptConfig = {
  system: string;
  user: (...args: unknown[]) => string;
  maxTokens: number;
};

// Export interfaces for use in other files
export type {
  TherapistData,
  SessionData,
  SessionMessage,
  SampleConversationSession,
  TherapistProfile,
  AIStyleConfig
};
