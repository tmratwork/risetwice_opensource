// src/app/api/s1/case-studies/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

interface AIPatient {
  name: string;
  age: number;
  gender: string;
  primary_concern: string;
  secondary_concerns: string[];
  severity_level: number;
  personality_traits: Record<string, unknown>;
  background_story: string;
  therapeutic_goals: string[];
  difficulty_level: string;
}

interface Session {
  id: string;
  therapist_id: string;
  status: string;
  session_number: number;
  session_type: string;
  therapeutic_approach: string;
  session_goals: string[];
  therapist_notes: string;
  session_summary: string;
  therapeutic_alliance_score: number;
  technique_effectiveness_score: number;
  ai_patient_feedback: string;
  duration_minutes: number;
  s1_ai_patients: AIPatient[];
}

interface SessionMessage {
  role: string;
  content: string;
  timestamp_in_session: string;
  emotional_tone?: string;
  therapeutic_techniques?: Record<string, boolean>;
}

interface CaseStudyContent {
  title: string;
  anonymized_patient_profile: Record<string, unknown>;
  presenting_concerns: string[];
  techniques_employed: Record<string, boolean>;
  session_progression: string;
  therapeutic_outcomes: Record<string, unknown>;
  key_learning_points: string[];
  therapeutic_challenges: string[];
  successful_interventions: string[];
  therapist_performance_analysis: string;
  alternative_approaches_suggested: string[];
  session_transcript: string;
  case_conceptualization: string;
  treatment_recommendations: string;
  publication_tags: string[];
}

export async function GET(request: NextRequest) {
  try {
    // For testing - skip auth validation
    const supabase = supabaseAdmin;
    const searchParams = request.nextUrl.searchParams;
    const isPublished = searchParams.get('published') === 'true';
    const caseStudyType = searchParams.get('type');
    const educationalLevel = searchParams.get('educational_level');

    let query = supabase
      .from('s1_case_studies')
      .select(`
        id,
        title,
        case_study_type,
        presenting_concerns,
        therapeutic_approach_used,
        key_learning_points,
        educational_level,
        publication_tags,
        is_published,
        review_status,
        created_at,
        created_by
      `)
      .order('created_at', { ascending: false });

    if (isPublished) {
      query = query.eq('is_published', true);
    } else {
      // For testing - show all case studies
      query = query.eq('is_published', true);
    }

    if (caseStudyType) {
      query = query.eq('case_study_type', caseStudyType);
    }

    if (educationalLevel) {
      query = query.eq('educational_level', educationalLevel);
    }

    const { data: caseStudies, error } = await query;

    if (error) {
      console.error('Error fetching case studies:', error);
      return NextResponse.json({ error: 'Failed to fetch case studies' }, { status: 500 });
    }

    return NextResponse.json({ caseStudies });

  } catch (error) {
    console.error('Error in GET /api/s1/case-studies:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // For testing - skip auth validation

    const body = await request.json();
    const { session_id } = body;

    if (!session_id) {
      return NextResponse.json(
        { error: 'Missing required field: session_id' },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;

    // Verify session exists and is completed - skip user check for testing
    const { data: session, error: sessionError } = await supabase
      .from('s1_therapy_sessions')
      .select(`
        id,
        therapist_id,
        status,
        session_number,
        session_type,
        therapeutic_approach,
        session_goals,
        therapist_notes,
        session_summary,
        therapeutic_alliance_score,
        technique_effectiveness_score,
        ai_patient_feedback,
        duration_minutes,
        s1_ai_patients!inner (
          name,
          age,
          gender,
          primary_concern,
          secondary_concerns,
          severity_level,
          personality_traits,
          background_story,
          therapeutic_goals,
          difficulty_level
        )
      `)
      .eq('id', session_id)
      .eq('status', 'completed')
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found or not completed' },
        { status: 404 }
      );
    }

    // Check if case study already exists for this session
    const { data: existingCaseStudy } = await supabase
      .from('s1_case_studies')
      .select('id')
      .eq('primary_session_id', session_id)
      .single();

    if (existingCaseStudy) {
      return NextResponse.json(
        { error: 'Case study already exists for this session' },
        { status: 400 }
      );
    }

    // Get session messages for transcript
    const { data: messages } = await supabase
      .from('s1_session_messages')
      .select(`
        role,
        content,
        timestamp_in_session,
        emotional_tone,
        therapeutic_techniques
      `)
      .eq('session_id', session_id)
      .order('created_at', { ascending: true });

    // Generate case study content
    const caseStudy = await generateCaseStudyContent(session, messages || []);

    const { data: newCaseStudy, error } = await supabase
      .from('s1_case_studies')
      .insert([{
        primary_session_id: session_id,
        title: caseStudy.title,
        case_study_type: session.session_type || 'therapy_session',
        anonymized_patient_profile: caseStudy.anonymized_patient_profile,
        presenting_concerns: caseStudy.presenting_concerns,
        therapeutic_approach_used: session.therapeutic_approach,
        techniques_employed: caseStudy.techniques_employed,
        session_progression: caseStudy.session_progression,
        therapeutic_outcomes: caseStudy.therapeutic_outcomes,
        key_learning_points: caseStudy.key_learning_points,
        therapeutic_challenges: caseStudy.therapeutic_challenges,
        successful_interventions: caseStudy.successful_interventions,
        therapist_performance_analysis: caseStudy.therapist_performance_analysis,
        alternative_approaches_suggested: caseStudy.alternative_approaches_suggested,
        session_transcript: caseStudy.session_transcript,
        clinical_notes: session.therapist_notes,
        case_conceptualization: caseStudy.case_conceptualization,
        treatment_recommendations: caseStudy.treatment_recommendations,
        educational_level: determineEducationalLevel(session),
        publication_tags: caseStudy.publication_tags,
        created_by: 'test-user',
        review_status: 'draft'
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating case study:', error);
      return NextResponse.json({ error: 'Failed to create case study' }, { status: 500 });
    }

    // Update therapist stats
    await updateTherapistCaseStudyStats('test-user', supabase);

    return NextResponse.json({ caseStudy: newCaseStudy }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/s1/case-studies:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function generateCaseStudyContent(session: Session, messages: SessionMessage[]): Promise<CaseStudyContent> {
  const aiPatient = session.s1_ai_patients[0];
  
  // Anonymize patient profile
  const anonymized_patient_profile = {
    age_range: `${Math.floor(aiPatient.age / 10) * 10}s`,
    gender: aiPatient.gender,
    primary_concern: aiPatient.primary_concern,
    secondary_concerns: aiPatient.secondary_concerns,
    severity_level: aiPatient.severity_level,
    difficulty_level: aiPatient.difficulty_level,
    general_background: "Background details anonymized for privacy"
  };

  // Extract techniques used
  const techniques_employed = {};
  messages.forEach(msg => {
    if (msg.role === 'therapist' && msg.therapeutic_techniques) {
      Object.assign(techniques_employed, msg.therapeutic_techniques);
    }
  });

  // Generate session transcript
  const session_transcript = messages
    .map(msg => {
      const speaker = msg.role === 'therapist' ? 'Therapist' : 'Client';
      return `[${msg.timestamp_in_session}] ${speaker}: ${msg.content}`;
    })
    .join('\n\n');

  // Generate title
  const title = `${aiPatient.primary_concern.charAt(0).toUpperCase() + aiPatient.primary_concern.slice(1)} Case Study - Session ${session.session_number}`;

  return {
    title,
    anonymized_patient_profile,
    presenting_concerns: [aiPatient.primary_concern, ...aiPatient.secondary_concerns],
    techniques_employed,
    session_progression: generateSessionProgression(messages),
    therapeutic_outcomes: generateTherapeuticOutcomes(session),
    key_learning_points: generateLearningPoints(session, messages),
    therapeutic_challenges: generateChallenges(session),
    successful_interventions: generateSuccessfulInterventions(messages),
    therapist_performance_analysis: generatePerformanceAnalysis(session),
    alternative_approaches_suggested: generateAlternativeApproaches(aiPatient),
    session_transcript,
    case_conceptualization: generateCaseConceptualization(aiPatient),
    treatment_recommendations: generateTreatmentRecommendations(aiPatient),
    publication_tags: generatePublicationTags(aiPatient, session)
  };
}

function generateSessionProgression(messages: SessionMessage[]): string {
  const phases = [];
  
  if (messages.length > 0) phases.push("Opening: Initial rapport building and presenting concern exploration");
  if (messages.length > 5) phases.push("Middle: Active therapeutic work and technique application");
  if (messages.length > 10) phases.push("Closing: Session wrap-up and future planning");
  
  return phases.join(' → ');
}

function generateTherapeuticOutcomes(session: Session): Record<string, unknown> {
  return {
    therapeutic_alliance_score: session.therapeutic_alliance_score,
    technique_effectiveness_score: session.technique_effectiveness_score,
    session_duration_minutes: session.duration_minutes,
    ai_patient_feedback_summary: session.ai_patient_feedback
  };
}

function generateLearningPoints(session: Session, messages: SessionMessage[]): string[] {
  const points = [];
  
  if (session.therapeutic_alliance_score >= 8) {
    points.push("Strong therapeutic alliance established through empathetic responding");
  }
  
  if (messages.some(m => m.therapeutic_techniques?.reflection)) {
    points.push("Effective use of reflection techniques to validate client experience");
  }
  
  if (messages.some(m => m.therapeutic_techniques?.open_ended_questioning)) {
    points.push("Good use of open-ended questions to explore client concerns");
  }
  
  return points.length > 0 ? points : ["Session demonstrated basic therapeutic skills"];
}

function generateChallenges(session: Session): string[] {
  const challenges = [];
  
  if (session.therapeutic_alliance_score < 6) {
    challenges.push("Difficulty establishing therapeutic rapport");
  }
  
  if (session.technique_effectiveness_score < 6) {
    challenges.push("Limited effectiveness of therapeutic interventions");
  }
  
  return challenges;
}

function generateSuccessfulInterventions(messages: SessionMessage[]): string[] {
  const interventions = [];
  
  if (messages.some(m => m.therapeutic_techniques?.empathy_validation)) {
    interventions.push("Empathy and validation responses");
  }
  
  if (messages.some(m => m.therapeutic_techniques?.emotion_exploration)) {
    interventions.push("Emotion-focused exploration");
  }
  
  return interventions;
}

function generatePerformanceAnalysis(session: Session): string {
  let analysis = "Therapist Performance Analysis:\n\n";
  
  if (session.therapeutic_alliance_score >= 8) {
    analysis += "• Strong therapeutic alliance demonstrated\n";
  } else if (session.therapeutic_alliance_score >= 6) {
    analysis += "• Adequate therapeutic alliance with room for improvement\n";
  } else {
    analysis += "• Therapeutic alliance needs development\n";
  }
  
  if (session.technique_effectiveness_score >= 8) {
    analysis += "• Therapeutic techniques applied effectively\n";
  } else {
    analysis += "• Therapeutic technique application could be enhanced\n";
  }
  
  return analysis;
}

function generateAlternativeApproaches(aiPatient: AIPatient): string[] {
  const approaches = [];
  
  if (aiPatient.primary_concern === 'anxiety') {
    approaches.push("Consider CBT techniques for anxiety management");
    approaches.push("Explore mindfulness-based interventions");
  } else if (aiPatient.primary_concern === 'depression') {
    approaches.push("Consider behavioral activation techniques");
    approaches.push("Explore cognitive restructuring methods");
  }
  
  return approaches;
}

function generateCaseConceptualization(aiPatient: AIPatient): string {
  return `Case conceptualization based on presenting concerns of ${aiPatient.primary_concern} with severity level ${aiPatient.severity_level}/10. Additional considerations include secondary concerns and patient background factors.`;
}

function generateTreatmentRecommendations(aiPatient: AIPatient): string {
  return `Treatment recommendations should focus on ${aiPatient.primary_concern} using evidence-based approaches. Consider patient's severity level and therapeutic goals when planning interventions.`;
}

function generatePublicationTags(aiPatient: AIPatient, session: Session): string[] {
  const tags = [
    aiPatient.primary_concern,
    aiPatient.difficulty_level,
    session.therapeutic_approach || 'general'
  ];
  
  if (aiPatient.secondary_concerns) {
    tags.push(...aiPatient.secondary_concerns);
  }
  
  return tags;
}

function determineEducationalLevel(session: Session): string {
  if (session.therapeutic_alliance_score >= 8 && session.technique_effectiveness_score >= 8) {
    return 'experienced';
  } else if (session.therapeutic_alliance_score >= 6) {
    return 'novice';
  } else {
    return 'student';
  }
}

async function updateTherapistCaseStudyStats(userId: string, supabase: typeof supabaseAdmin) {
  try {
    // Get current count first
    const { data: profile } = await supabase
      .from('s1_therapist_profiles')
      .select('total_case_studies_generated')
      .eq('user_id', userId)
      .single();

    const currentCount = profile?.total_case_studies_generated || 0;
    
    await supabase
      .from('s1_therapist_profiles')
      .update({
        total_case_studies_generated: currentCount + 1
      })
      .eq('user_id', userId);
  } catch (error) {
    console.error('Error updating therapist case study stats:', error);
  }
}