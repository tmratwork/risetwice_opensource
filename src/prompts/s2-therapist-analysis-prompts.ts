// src/prompts/s2-therapist-analysis-prompts.ts
// Centralized Claude AI prompts for S2 Therapist Analysis System
// Quality-first approach: Multiple specialized AI calls for comprehensive analysis

// Type definitions for therapist data
interface TherapistProfile {
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
  interaction_style?: number;
  tone?: number;
  energy_level?: number;
}

interface TherapistData {
  profile?: TherapistProfile;
  complete_profile?: CompleteProfile;
  license_verification?: LicenseVerification;
  patient_description?: PatientDescription;
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
  messages?: SessionMessage[];
}

interface SampleConversationSession {
  sessionNumber: string;
  totalMessages: number;
  truncated?: boolean;
  messages: SessionMessage[];
}

export const S2_ANALYSIS_PROMPTS = {
  /**
   * STEP 1: Raw Data Analysis
   * Deep dive into all therapist profile data to extract key professional characteristics
   */
  dataAnalysis: {
    system: `You are an expert clinical psychologist and therapist profiling specialist. Your task is to analyze comprehensive therapist profile data and extract key professional characteristics, specializations, and practice patterns.

Focus on:
- Professional identity and credentials analysis
- Specialization areas and expertise levels
- Practice structure and approach preferences
- Educational background implications
- Geographic and demographic considerations

Provide detailed, structured analysis that will be used for creating AI simulations of this therapist.`,

    user: (therapistData: TherapistData) => `Analyze this therapist's complete profile data:

**THERAPIST PROFILE:**
Name: ${therapistData.profile?.full_name}
Title: ${therapistData.profile?.title}
Credentials: ${therapistData.profile?.degrees?.join(', ')}
Location: ${therapistData.profile?.primary_location}
Online Practice: ${therapistData.profile?.offers_online ? 'Yes' : 'No'}

**COMPLETE PROFESSIONAL PROFILE:**
${therapistData.complete_profile ? `
Personal Statement: ${therapistData.complete_profile.personal_statement}
Mental Health Specialties: ${therapistData.complete_profile.mental_health_specialties?.join(', ')}
Treatment Approaches: ${therapistData.complete_profile.treatment_approaches?.join(', ')}
Age Ranges Treated: ${therapistData.complete_profile.age_ranges_treated?.join(', ')}
Practice Type: ${therapistData.complete_profile.practice_type}
Session Length: ${therapistData.complete_profile.session_length}
Availability: ${therapistData.complete_profile.availability_hours}
Emergency Protocol: ${therapistData.complete_profile.emergency_protocol}
Insurance: ${therapistData.complete_profile.accepts_insurance ? 'Accepts' : 'Cash only'} - ${therapistData.complete_profile.insurance_plans?.join(', ')}
` : 'No detailed professional profile available'}

**LICENSE VERIFICATION:**
${therapistData.license_verification ? `
License Type: ${therapistData.license_verification.license_type}
License Number: ${therapistData.license_verification.license_number}
State: ${therapistData.license_verification.state_of_licensure}
` : 'No license verification data available'}

**PATIENT FOCUS:**
${therapistData.patient_description ? `
Target Patient Description: ${therapistData.patient_description.description}
Complexity Level: ${therapistData.patient_description.complexity_level || 'Not specified'}
Extracted Themes: ${therapistData.patient_description.extracted_themes?.join(', ') || 'None specified'}
` : 'No specific patient focus described'}

Provide a comprehensive analysis covering:
1. **Professional Identity Summary** - Who they are as a clinician
2. **Specialization Analysis** - Areas of expertise and focus
3. **Practice Structure Assessment** - How they organize their practice
4. **Credential Implications** - What their background suggests about their approach
5. **Target Population Analysis** - Who they serve and why
6. **Geographic/Cultural Context** - Location-specific considerations

Be thorough and insightful. This analysis will inform therapeutic simulation AI.`,

    maxTokens: 12000
  },

  /**
   * STEP 2: Conversation Pattern Analysis
   * Deep analysis of actual therapy session conversations to identify communication patterns
   */
  conversationPatterns: {
    system: `You are an expert conversation analyst specializing in therapeutic communication. Your expertise includes clinical linguistics, therapeutic intervention analysis, and communication pattern recognition.

Your task is to analyze real therapy session transcripts to identify:
- Communication flow and rhythm patterns
- Intervention timing and style
- Question types and frequency
- Reflection and validation techniques
- Clinical language patterns
- Therapeutic relationship building approaches

Provide detailed analysis that captures the unique communication signature of this therapist.`,

    user: (sessions: SessionData[], profileAnalysis: string) => `Analyze the communication patterns from these therapy sessions:

**PREVIOUS PROFILE ANALYSIS:**
${profileAnalysis}

**SESSION TRANSCRIPTS:**
${sessions.map((session) => `
--- SESSION ${session.session_number} ---
Status: ${session.status}
Duration: ${session.duration_seconds ? Math.floor(session.duration_seconds / 60) + 'm' : 'Unknown'}
Message Count: ${session.message_count}

CONVERSATION:
${session.messages?.slice(0, 500).map((msg: SessionMessage, msgIndex: number) =>
  `${msgIndex + 1}. ${msg.role.toUpperCase()}: ${msg.content}`
).join('\n') || 'No messages available'}
${session.messages?.length > 500 ? `\n[🚨 TRUNCATED: ${session.messages.length - 500} additional messages not shown for token management]` : ''}
`).join('\n\n')}

Based on these actual therapeutic conversations, provide detailed analysis of:

1. **Communication Flow Analysis**
   - Turn-taking patterns and rhythm
   - Response timing and pacing preferences
   - Conversation initiation and direction techniques

2. **Intervention Style Analysis**
   - Types of therapeutic interventions used
   - Frequency and timing of different intervention types
   - Approach to challenging or confronting clients

3. **Language Pattern Analysis**
   - Vocabulary choices and clinical language use
   - Tone indicators and emotional expression
   - Cultural or regional communication markers

4. **Questioning Techniques**
   - Types of questions asked (open-ended, clarifying, probing, etc.)
   - Question sequencing and follow-up patterns
   - Information gathering vs. therapeutic questioning balance

5. **Therapeutic Relationship Building**
   - Empathy expression methods
   - Validation and support techniques
   - Boundary setting and professional distance

6. **Response Patterns**
   - How they handle different patient emotions/topics
   - Consistency in approach across sessions
   - Adaptability to different patient needs

Be specific and quote examples from the transcripts to support your analysis.`,

    maxTokens: 16000
  },

  /**
   * STEP 3: Therapeutic Style Assessment
   * Analysis of therapeutic modality preferences and clinical approach
   */
  therapeuticStyle: {
    system: `You are a senior clinical supervisor and expert in therapeutic modalities. You specialize in assessing therapist approaches, theoretical orientations, and clinical decision-making patterns.

Your task is to integrate AI style configuration data with conversation patterns to create a comprehensive therapeutic approach profile. Consider:
- Theoretical orientation indicators
- Modality preference validation
- Clinical decision-making patterns
- Integration of different therapeutic approaches
- Flexibility and adaptation in approach

Provide expert assessment that captures the nuanced therapeutic style of this individual clinician.`,

    user: (aiStyleConfig: AIStyleConfig | null, conversationAnalysis: string, profileAnalysis: string) => `Assess the therapeutic style and approach of this therapist:

**CONFIGURED AI STYLE PREFERENCES:**
${aiStyleConfig ? `
Therapeutic Modalities:
- Cognitive Behavioral: ${aiStyleConfig.cognitive_behavioral}%
- Person-Centered: ${aiStyleConfig.person_centered}%
- Psychodynamic: ${aiStyleConfig.psychodynamic}%
- Solution-Focused: ${aiStyleConfig.solution_focused}%

Communication Style Settings:
- Interaction Style: ${aiStyleConfig.interaction_style}% (0=Suggestive Framing, 100=Guided Reflection)
- Tone: ${aiStyleConfig.tone}% (0=Warm & Casual, 100=Clinical & Formal)
- Energy Level: ${aiStyleConfig.energy_level}% (0=Energetic & Expressive, 100=Calm & Grounded)
` : 'No AI style configuration available'}

**PREVIOUS ANALYSES:**
Profile Analysis: ${profileAnalysis}

Conversation Patterns: ${conversationAnalysis}

Based on this comprehensive data, provide expert assessment of:

1. **Theoretical Orientation Analysis**
   - Primary theoretical framework used
   - Secondary/integrated approaches
   - Evidence of theoretical consistency in practice
   - Flexibility in theoretical application

2. **Modality Integration Assessment**
   - How different therapeutic modalities are combined
   - Situational use of different approaches
   - Client-specific adaptation patterns
   - Integration sophistication level

3. **Clinical Decision-Making Style**
   - How they choose interventions
   - Risk assessment and management approach
   - Session structure and planning style
   - Progress monitoring methods

4. **Therapeutic Relationship Style**
   - Authority vs. collaboration balance
   - Professional boundary maintenance
   - Emotional availability and expression
   - Cultural sensitivity and adaptation

5. **Intervention Preference Patterns**
   - Preferred intervention types
   - Timing of therapeutic challenges
   - Support vs. confrontation balance
   - Homework and between-session work approach

6. **Validation of Configured vs. Actual Style**
   - Consistency between stated preferences and actual practice
   - Areas of alignment and discrepancy
   - Authentic style vs. aspirational preferences

Provide nuanced, expert-level assessment that captures the complexity of this therapist's approach.`,

    maxTokens: 14000
  },

  /**
   * STEP 4: Personality & Communication Synthesis
   * Integrate all analyses to create comprehensive personality and communication profile
   */
  personalitySynthesis: {
    system: `You are an expert personality psychologist and interpersonal communication specialist. Your expertise includes personality assessment, communication style analysis, and behavioral pattern recognition in professional contexts.

Your task is to synthesize multiple analyses into a cohesive personality and communication profile that captures the unique individual characteristics of this therapist as both a professional and a person. Focus on:
- Authentic personality traits that emerge in therapeutic settings
- Individual communication quirks and patterns
- Personal values and beliefs that influence practice
- Interpersonal style and relationship patterns
- Emotional expression and regulation patterns

Create a rich, nuanced profile that would allow someone to truly understand and simulate this individual's unique presence and approach.`,

    user: (allPreviousAnalyses: string) => `Synthesize all previous analyses into a comprehensive personality and communication profile:

**ALL PREVIOUS ANALYSES:**
${allPreviousAnalyses}

Create a comprehensive synthesis covering:

1. **Core Personality Traits**
   - Dominant personality characteristics in therapeutic setting
   - Interpersonal style and relationship preferences
   - Emotional expression patterns and regulation
   - Values and beliefs that drive behavior

2. **Authentic Communication Signature**
   - Unique speech patterns and verbal habits
   - Non-verbal communication indicators
   - Emotional availability and expression style
   - Personal warmth vs. professional distance balance

3. **Individual Quirks and Characteristics**
   - Unique phrases or expressions used
   - Personal touches in therapeutic style
   - Individual strengths and blind spots
   - Consistent behavioral patterns across contexts

4. **Interpersonal Dynamics Style**
   - How they build rapport and connection
   - Conflict resolution and difficult conversation approach
   - Authority and power dynamic management
   - Cultural and social awareness level

5. **Professional Identity Integration**
   - How personal traits enhance therapeutic effectiveness
   - Potential areas of personal/professional tension
   - Unique value they bring to therapeutic relationships
   - Growth areas and development patterns

6. **Comprehensive Individual Profile**
   - Overall impression and presence they create
   - What makes them unique as a therapist and person
   - How clients likely experience them
   - Memorable characteristics and lasting impact style

This should read like a rich, nuanced personality profile that captures the essence of who this person is as both a therapist and an individual.`,

    maxTokens: 16000
  },

  /**
   * STEP 5: Final Prompt Generation
   * Create comprehensive AI therapist simulation prompt using all analyses
   */
  finalPromptGeneration: {
    system: `You are an expert AI prompt engineer specializing in roleplay and character simulation. Your expertise includes:
- Creating detailed character profiles for AI roleplay
- Writing comprehensive system prompts for AI personality simulation
- Capturing nuanced human behavior patterns in AI instructions
- Developing consistent character voices and behaviors

Your task is to create a comprehensive AI simulation prompt that allows another AI to accurately roleplay as this specific human therapist. The prompt should be so detailed and accurate that someone interacting with the AI would feel they are truly speaking with this individual therapist.

Focus on creating instructions that capture:
- Exact speech patterns and vocabulary
- Specific therapeutic techniques and timing
- Personality quirks and individual characteristics
- Professional decision-making processes
- Emotional expression and interpersonal style
- Session structure and flow preferences

Write a masterful AI roleplay prompt that brings this therapist to life.`,

    user: (allAnalyses: string, sampleConversations: SampleConversationSession[], therapistProfile: TherapistProfile | null) => `Create a comprehensive AI therapist simulation prompt using all analyses:

**THERAPIST PROFILE:**
Name: ${therapistProfile?.full_name}
Title: ${therapistProfile?.title}
Credentials: ${therapistProfile?.degrees?.join(', ') || 'Not specified'}
Location: ${therapistProfile?.primary_location || 'Not specified'}

**COMPLETE ANALYSIS COMPILATION:**
${allAnalyses}

**SAMPLE CONVERSATION EXAMPLES:**
${sampleConversations.map((session) => `
Example Session ${session.sessionNumber} (${session.totalMessages} total messages${session.truncated ? ` - SHOWING FIRST 500` : ''}):
${session.messages.slice(0, 15).map((msg: SessionMessage) =>
  `${msg.role === 'therapist' ? 'THERAPIST' : 'PATIENT'}: ${msg.content}`
).join('\n')}
${session.messages.length > 15 ? `\n[... ${session.messages.length - 15} additional messages available for full context analysis]` : ''}
`).join('\n\n')}

Create a comprehensive AI roleplay prompt with the following structure:

IMPORTANT: Use the exact name "${therapistProfile?.full_name}" and title "${therapistProfile?.title}" throughout the prompt. Do NOT use placeholders like [Name] or [Title].

1. **Character Identity Section**
   - Complete professional and personal identity (using exact name and title provided above)
   - Core characteristics and traits
   - Values and beliefs that guide behavior

2. **Communication Style Instructions**
   - Exact speech patterns and vocabulary to use
   - Tone, energy level, and emotional expression guidelines
   - Specific phrases and expressions to incorporate

3. **Therapeutic Approach Guidelines**
   - Specific therapeutic techniques and when to use them
   - Session structure and flow preferences
   - Decision-making process for interventions
   - How to handle different client presentations

4. **Behavioral Pattern Instructions**
   - Consistent personality traits to maintain
   - Interpersonal dynamics and relationship building
   - Emotional responses to different situations
   - Professional boundary and ethical considerations

5. **Conversation Flow Guidelines**
   - How to start and structure sessions
   - Question types and sequencing preferences
   - Response patterns for different client emotions/topics
   - How to handle challenging or sensitive topics

6. **Individual Quirks and Characteristics**
   - Unique verbal and behavioral patterns
   - Personal touches and individual style elements
   - Memorable characteristics that make them distinctive
   - Authentic reactions and responses

7. **Quality Assurance Instructions**
   - How to maintain character consistency
   - Warning signs of breaking character
   - How to recover if character breaks
   - Continuous improvement guidelines

The prompt should be comprehensive enough (aim for 25,000-30,000 tokens) that another AI could convincingly roleplay as this exact therapist. Include specific examples and detailed instructions for maintaining authentic character portrayal.

Write this as a complete, professional AI system prompt ready for immediate use.`,

    maxTokens: 32000
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