// src/lib/s1/ai-patient-profiles.ts
// AI Patient Personality System and Psychological Profiles for S1

export interface PersonalityTraits {
  // Big Five personality traits (0-100 scale)
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  
  // Communication style traits
  verbosity: number; // How much they talk (0-100)
  directness: number; // How direct vs indirect (0-100)
  emotional_expressiveness: number; // How openly they express emotions (0-100)
  trust_willingness: number; // How quickly they trust therapists (0-100)
}

export interface BehavioralPatterns {
  // Resistance patterns
  resistance_type: 'none' | 'intellectual' | 'emotional' | 'behavioral' | 'mixed';
  resistance_intensity: number; // 0-100
  resistance_triggers: string[]; // What triggers resistance
  
  // Coping mechanisms
  primary_coping: 'avoidance' | 'problem_solving' | 'emotion_focused' | 'social_support' | 'maladaptive';
  secondary_coping: string[];
  
  // Engagement patterns
  engagement_style: 'eager' | 'cautious' | 'resistant' | 'variable';
  attention_span: number; // Minutes before losing focus
  insight_level: number; // 0-100, how much self-awareness they have
  
  // Response patterns
  response_latency: number; // Seconds delay before responding
  response_length_preference: 'brief' | 'moderate' | 'detailed';
  emotional_regulation: number; // 0-100, ability to manage emotions
}

export interface SessionConfig {
  // AI behavior instructions
  response_style: 'realistic' | 'challenging' | 'cooperative' | 'dynamic';
  emotional_range: string[]; // Emotions the AI can express
  therapeutic_goals: string[]; // What progress to show over sessions
  
  // Session-specific behaviors
  opening_behavior: 'eager' | 'hesitant' | 'defensive' | 'curious';
  middle_behavior: 'engaged' | 'resistant' | 'breakthrough' | 'plateau';
  closing_behavior: 'grateful' | 'dismissive' | 'hopeful' | 'uncertain';
  
  // Learning and adaptation
  learns_from_therapist: boolean;
  adapts_to_techniques: boolean;
  shows_progress: boolean;
  regresses_sometimes: boolean;
}

export interface PsychologicalPresentation {
  primary_concern: string;
  secondary_concerns: string[];
  severity_level: number; // 1-10
  
  // Symptoms and presentations
  symptom_clusters: Record<string, string[]>;
  presenting_behaviors: string[];
  emotional_states: string[];
  
  // History and context
  onset_timeline: string;
  precipitating_factors: string[];
  maintaining_factors: string[];
  protective_factors: string[];
  
  // Treatment history
  previous_therapy: boolean;
  medication_status: string;
  therapeutic_alliance_history: string;
}

// Predefined AI Patient Profiles
export const AI_PATIENT_TEMPLATES = {
  anxiety_beginner: {
    name: "Sarah",
    age: 28,
    gender: "female",
    difficulty_level: "beginner" as const,
    primary_concern: "anxiety",
    secondary_concerns: ["social_anxiety", "work_stress"],
    severity_level: 6,
    personality_traits: {
      openness: 65,
      conscientiousness: 80,
      extraversion: 30,
      agreeableness: 75,
      neuroticism: 85,
      verbosity: 40,
      directness: 30,
      emotional_expressiveness: 60,
      trust_willingness: 70
    },
    behavioral_patterns: {
      resistance_type: 'emotional' as const,
      resistance_intensity: 20,
      resistance_triggers: ['criticism', 'pressure'],
      primary_coping: 'avoidance' as const,
      secondary_coping: ['rumination', 'seeking_reassurance'],
      engagement_style: 'cautious' as const,
      attention_span: 15,
      insight_level: 60,
      response_latency: 3,
      response_length_preference: 'moderate' as const,
      emotional_regulation: 40
    },
    session_config: {
      response_style: 'realistic' as const,
      emotional_range: ['anxious', 'worried', 'hopeful', 'grateful'],
      therapeutic_goals: ['reduce_anxiety', 'improve_coping', 'increase_confidence'],
      opening_behavior: 'hesitant' as const,
      middle_behavior: 'engaged' as const,
      closing_behavior: 'hopeful' as const,
      learns_from_therapist: true,
      adapts_to_techniques: true,
      shows_progress: true,
      regresses_sometimes: false
    },
    background_story: "Recent graduate struggling with work anxiety and social situations. Lives alone, has supportive family but feels pressure to succeed."
  },

  depression_intermediate: {
    name: "Michael",
    age: 35,
    gender: "male",
    difficulty_level: "intermediate" as const,
    primary_concern: "depression",
    secondary_concerns: ["relationship_issues", "career_dissatisfaction"],
    severity_level: 7,
    personality_traits: {
      openness: 45,
      conscientiousness: 40,
      extraversion: 20,
      agreeableness: 60,
      neuroticism: 75,
      verbosity: 25,
      directness: 60,
      emotional_expressiveness: 30,
      trust_willingness: 40
    },
    behavioral_patterns: {
      resistance_type: 'mixed' as const,
      resistance_intensity: 50,
      resistance_triggers: ['hope', 'change_suggestions', 'energy_demands'],
      primary_coping: 'avoidance' as const,
      secondary_coping: ['isolation', 'rumination', 'self_criticism'],
      engagement_style: 'variable' as const,
      attention_span: 10,
      insight_level: 75,
      response_latency: 5,
      response_length_preference: 'brief' as const,
      emotional_regulation: 30
    },
    session_config: {
      response_style: 'challenging' as const,
      emotional_range: ['sad', 'empty', 'frustrated', 'skeptical', 'occasionally_hopeful'],
      therapeutic_goals: ['improve_mood', 'increase_activity', 'challenge_negative_thoughts'],
      opening_behavior: 'defensive' as const,
      middle_behavior: 'resistant' as const,
      closing_behavior: 'uncertain' as const,
      learns_from_therapist: true,
      adapts_to_techniques: false,
      shows_progress: true,
      regresses_sometimes: true
    },
    background_story: "Divorced, struggling with motivation and purpose. Has been to therapy before but didn't find it helpful. Intellectualizes emotions."
  },

  trauma_advanced: {
    name: "Alex",
    age: 32,
    gender: "non-binary",
    difficulty_level: "advanced" as const,
    primary_concern: "trauma",
    secondary_concerns: ["ptsd_symptoms", "trust_issues", "emotional_dysregulation"],
    severity_level: 9,
    personality_traits: {
      openness: 70,
      conscientiousness: 45,
      extraversion: 25,
      agreeableness: 35,
      neuroticism: 90,
      verbosity: 60,
      directness: 80,
      emotional_expressiveness: 85,
      trust_willingness: 15
    },
    behavioral_patterns: {
      resistance_type: 'behavioral' as const,
      resistance_intensity: 80,
      resistance_triggers: ['vulnerability', 'memory_triggers', 'trust_building'],
      primary_coping: 'maladaptive' as const,
      secondary_coping: ['hypervigilance', 'dissociation', 'control_seeking'],
      engagement_style: 'resistant' as const,
      attention_span: 8,
      insight_level: 85,
      response_latency: 7,
      response_length_preference: 'detailed' as const,
      emotional_regulation: 20
    },
    session_config: {
      response_style: 'dynamic' as const,
      emotional_range: ['angry', 'fearful', 'numb', 'hypervigilant', 'triggered', 'cautiously_hopeful'],
      therapeutic_goals: ['build_trust', 'improve_safety', 'process_trauma', 'develop_coping'],
      opening_behavior: 'defensive' as const,
      middle_behavior: 'breakthrough' as const,
      closing_behavior: 'dismissive' as const,
      learns_from_therapist: false,
      adapts_to_techniques: true,
      shows_progress: false,
      regresses_sometimes: true
    },
    background_story: "Complex trauma history, has had multiple therapists. Highly intelligent but struggles with trust and emotional regulation. Tests therapeutic boundaries."
  }
};

export class AIPatientPersonality {
  private traits: PersonalityTraits;
  private patterns: BehavioralPatterns;
  private config: SessionConfig;
  private presentation: PsychologicalPresentation;
  private sessionHistory: Array<Record<string, unknown>> = [];

  constructor(
    traits: PersonalityTraits,
    patterns: BehavioralPatterns,
    config: SessionConfig,
    presentation: PsychologicalPresentation
  ) {
    this.traits = traits;
    this.patterns = patterns;
    this.config = config;
    this.presentation = presentation;
  }

  generateResponse(
    therapistMessage: string
  ): {
    content: string;
    emotional_tone: string;
    reasoning: string;
    behavioral_notes: string[];
  } {
    // Analyze therapist message for triggers and techniques
    const analysis = this.analyzeTherapistInput(therapistMessage);
    
    // Determine emotional state based on personality and triggers
    const emotionalState = this.calculateEmotionalState(analysis);
    
    // Generate response based on behavioral patterns
    const response = this.constructResponse(
      therapistMessage,
      emotionalState,
      analysis
    );

    return {
      content: response.content,
      emotional_tone: emotionalState.primary_emotion,
      reasoning: response.reasoning,
      behavioral_notes: response.behavioral_notes
    };
  }

  private analyzeTherapistInput(message: string): {
    is_question: boolean;
    is_validation: boolean;
    is_challenge: boolean;
    is_suggestion: boolean;
    contains_triggers: boolean;
    technique_used: string;
    emotional_content: string[];
  } {
    const lowerMessage = message.toLowerCase();
    
    return {
      is_question: message.includes('?'),
      is_validation: lowerMessage.includes('understand') || lowerMessage.includes('hear you'),
      is_challenge: lowerMessage.includes('but') || lowerMessage.includes('however'),
      is_suggestion: lowerMessage.includes('try') || lowerMessage.includes('consider'),
      contains_triggers: this.patterns.resistance_triggers.some(trigger => 
        lowerMessage.includes(trigger.toLowerCase())
      ),
      technique_used: this.identifyTechnique(lowerMessage),
      emotional_content: this.detectEmotionalContent(lowerMessage)
    };
  }

  private identifyTechnique(message: string): string {
    if (message.includes('feel') || message.includes('emotion')) return 'emotion_exploration';
    if (message.includes('tell me more') || message.includes('explain')) return 'open_questioning';
    if (message.includes('sounds like') || message.includes('hear you saying')) return 'reflection';
    if (message.includes('have you tried') || message.includes('what if')) return 'suggestion';
    return 'general_inquiry';
  }

  private detectEmotionalContent(message: string): string[] {
    const emotions = ['sad', 'angry', 'afraid', 'happy', 'anxious', 'frustrated', 'hopeful'];
    return emotions.filter(emotion => message.includes(emotion));
  }

  private calculateEmotionalState(analysis: {
    is_question: boolean;
    is_validation: boolean;
    is_challenge: boolean;
    is_suggestion: boolean;
    contains_triggers: boolean;
    technique_used: string;
    emotional_content: string[];
  }): {
    primary_emotion: string;
    intensity: number;
    secondary_emotions: string[];
  } {
    let baseEmotion = this.presentation.emotional_states[0] || 'neutral';
    let intensity = this.presentation.severity_level / 10;

    // Adjust based on triggers
    if (analysis.contains_triggers && this.patterns.resistance_intensity > 50) {
      baseEmotion = 'defensive';
      intensity = Math.min(1.0, intensity + 0.3);
    }

    // Adjust based on therapeutic alliance
    if (analysis.is_validation && this.traits.trust_willingness > 60) {
      baseEmotion = 'grateful';
      intensity = Math.max(0.3, intensity - 0.2);
    }

    return {
      primary_emotion: baseEmotion,
      intensity: intensity,
      secondary_emotions: this.config.emotional_range
    };
  }

  private constructResponse(
    therapistMessage: string,
    emotionalState: {
      primary_emotion: string;
      intensity: number;
      secondary_emotions: string[];
    },
    analysis: {
      is_question: boolean;
      is_validation: boolean;
      is_challenge: boolean;
      is_suggestion: boolean;
      contains_triggers: boolean;
      technique_used: string;
      emotional_content: string[];
    }
  ): {
    content: string;
    reasoning: string;
    behavioral_notes: string[];
  } {
    const responses = this.getResponseTemplates();
    let responseTemplate = responses[emotionalState.primary_emotion] || responses.default;
    
    // Customize response based on behavioral patterns
    if (this.patterns.response_length_preference === 'brief') {
      responseTemplate = responseTemplate.slice(0, 1); // Take first response only
    }

    const content = this.personalizeResponse(responseTemplate);
    
    return {
      content: content,
      reasoning: `Responding as ${this.presentation.primary_concern} patient with ${emotionalState.primary_emotion} emotional state, intensity ${emotionalState.intensity}`,
      behavioral_notes: this.generateBehavioralNotes(analysis, emotionalState)
    };
  }

  private getResponseTemplates(): Record<string, string[]> {
    return {
      anxious: [
        "I'm feeling really worried about this...",
        "What if things get worse?",
        "I don't know if I can handle this."
      ],
      defensive: [
        "I don't think that's really the problem.",
        "You don't understand my situation.",
        "I've tried that before and it didn't work."
      ],
      grateful: [
        "Thank you for understanding.",
        "That makes me feel heard.",
        "I appreciate you taking the time to listen."
      ],
      sad: [
        "Everything just feels so heavy.",
        "I don't see the point anymore.",
        "It's hard to find any joy in things."
      ],
      default: [
        "I'm not sure how to answer that.",
        "Let me think about that for a moment.",
        "That's a good question."
      ]
    };
  }

  private personalizeResponse(templates: string[]): string {
    // Select template based on personality traits
    let selectedTemplate = templates[0];
    
    if (this.traits.verbosity < 40 && templates.length > 1) {
      selectedTemplate = templates[templates.length - 1]; // Use shorter responses
    }

    return selectedTemplate;
  }

  private generateBehavioralNotes(analysis: {
    is_question: boolean;
    is_validation: boolean;
    is_challenge: boolean;
    is_suggestion: boolean;
    contains_triggers: boolean;
    technique_used: string;
    emotional_content: string[];
  }, emotionalState: {
    primary_emotion: string;
    intensity: number;
    secondary_emotions: string[];
  }): string[] {
    const notes: string[] = [];
    
    if (analysis.contains_triggers) {
      notes.push("Triggered by therapist input");
    }
    
    if (emotionalState.intensity > 0.7) {
      notes.push("High emotional intensity observed");
    }
    
    if (this.patterns.resistance_intensity > 60 && analysis.is_suggestion) {
      notes.push("Showing resistance to suggestions");
    }

    return notes;
  }

  // Method to update personality based on session experience
  updatePersonality(sessionOutcome: {
    therapeutic_alliance_score: number;
    technique_effectiveness_score: number;
  }): void {
    if (sessionOutcome.therapeutic_alliance_score > 7 && this.config.learns_from_therapist) {
      this.traits.trust_willingness = Math.min(100, this.traits.trust_willingness + 5);
    }

    if (sessionOutcome.technique_effectiveness_score > 8 && this.config.adapts_to_techniques) {
      this.patterns.resistance_intensity = Math.max(0, this.patterns.resistance_intensity - 10);
    }
  }

  // Export current state for persistence
  exportState(): {
    traits: PersonalityTraits;
    patterns: BehavioralPatterns;
    config: SessionConfig;
    presentation: PsychologicalPresentation;
    sessionHistory: Array<Record<string, unknown>>;
  } {
    return {
      traits: this.traits,
      patterns: this.patterns,
      config: this.config,
      presentation: this.presentation,
      sessionHistory: this.sessionHistory
    };
  }
}

// Factory function to create AI patients from templates
export function createAIPatientFromTemplate(templateKey: keyof typeof AI_PATIENT_TEMPLATES): {
  name: string;
  age: number;
  gender: string;
  difficulty_level: string;
  primary_concern: string;
  secondary_concerns: string[];
  severity_level: number;
  personality_traits: PersonalityTraits;
  behavioral_patterns: BehavioralPatterns;
  session_config: SessionConfig;
  background_story: string;
  personality_instance: AIPatientPersonality;
} {
  const template = AI_PATIENT_TEMPLATES[templateKey];
  
  const personality = new AIPatientPersonality(
    template.personality_traits,
    template.behavioral_patterns,
    template.session_config,
    {
      primary_concern: template.primary_concern,
      secondary_concerns: template.secondary_concerns,
      severity_level: template.severity_level,
      symptom_clusters: {},
      presenting_behaviors: [],
      emotional_states: template.session_config.emotional_range,
      onset_timeline: "Recent months",
      precipitating_factors: ["life_stress"],
      maintaining_factors: ["avoidance"],
      protective_factors: ["therapy_seeking"],
      previous_therapy: template.name === "Michael",
      medication_status: "none",
      therapeutic_alliance_history: "variable"
    }
  );

  return {
    ...template,
    personality_instance: personality
  };
}