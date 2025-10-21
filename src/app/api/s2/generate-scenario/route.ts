// src/app/api/s2/generate-scenario/route.ts
// Generate patient scenario using Anthropic Claude

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TherapistProfile {
  fullName: string;
  title: string;
  degrees: string[];
  primaryLocation: string;
  offersOnline: boolean;
  phoneNumber?: string;
  emailAddress?: string;
}

interface GenerateScenarioRequest {
  userId: string; // Firebase UID
  therapistProfile: TherapistProfile;
  patientDescription: string;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, therapistProfile, patientDescription }: GenerateScenarioRequest = await request.json();

    // Validate required fields
    if (!userId || !patientDescription?.trim()) {
      return NextResponse.json(
        { error: 'userId and patient description are required' },
        { status: 400 }
      );
    }

    console.log('[S2] Generating scenario for user:', userId);

    // Get required database records
    const { data: profile, error: profileError } = await supabase
      .from('s2_therapist_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Therapist profile not found' },
        { status: 400 }
      );
    }

    // Get latest patient description
    const { data: patientDesc, error: patientError } = await supabase
      .from('s2_patient_descriptions')
      .select('id')
      .eq('therapist_profile_id', profile.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (patientError || !patientDesc) {
      return NextResponse.json(
        { error: 'Patient description required. Please complete the patient description step first.' },
        { status: 400 }
      );
    }

    console.log('[S2] Generating scenario based on patient description only');

    // Generate mock scenario based on patient description
    const scenario = await generateMockScenario(patientDescription);

    // Save generated scenario to database (ai_style_config_id and ai_personality_prompt are no longer required)
    const { data: generatedScenario, error: saveError } = await supabase
      .from('s2_generated_scenarios')
      .insert({
        therapist_profile_id: profile.id,
        patient_description_id: patientDesc.id,
        scenario_text: scenario,
        generation_model: 'mock-anthropic-claude',
        generation_metadata: {
          therapistName: therapistProfile.fullName,
          generatedAt: new Date().toISOString(),
          basedOn: 'patient_description_only',
          characterCount: patientDescription.length
        }
      })
      .select()
      .single();

    if (saveError) {
      console.error('[S2] Error saving generated scenario:', saveError);
      return NextResponse.json(
        { error: 'Failed to save generated scenario' },
        { status: 500 }
      );
    }

    console.log('[S2] ✅ Scenario generated and saved:', generatedScenario.id);

    return NextResponse.json({
      success: true,
      scenario,
      scenarioId: generatedScenario.id,
      metadata: {
        therapistName: therapistProfile.fullName,
        generatedAt: generatedScenario.created_at,
        basedOn: 'patient_description_only'
      }
    });

  } catch (error) {
    console.error('[S2] Error generating scenario:', error);
    return NextResponse.json(
      { error: 'Failed to generate scenario' },
      { status: 500 }
    );
  }
}


async function generateMockScenario(patientDescription: string): Promise<string> {
  // Extract key themes from patient description for mock scenario
  const description = patientDescription.toLowerCase();
  
  // Define scenario templates based on common themes
  const scenarios = {
    anxiety: [
      "Your client, Sarah, a 28-year-old graduate student, reports feeling overwhelmed by academic pressures and social anxiety. She mentions difficulty sleeping and avoiding social situations that were once enjoyable. How would you initiate the session?",
      "Meet Alex, a 32-year-old marketing professional experiencing panic attacks at work. They describe feeling constantly 'on edge' and worry about having another attack in public. What would be your opening approach?",
      "Your client, Maria, a 24-year-old teacher, presents with generalized anxiety about job performance and relationship concerns. She reports racing thoughts and physical tension. How do you begin?"
    ],
    depression: [
      "Your client, James, a 35-year-old father of two, reports feeling 'empty' and disconnected from activities he used to enjoy. He mentions low energy and difficulty motivating himself for daily tasks. What's your initial intervention?",
      "Meet Lisa, a 29-year-old artist experiencing persistent sadness and self-doubt about her career path. She describes feeling stuck and questions her worth. How would you open the session?",
      "Your client, David, a 42-year-old business manager, presents with mood changes following a recent divorce. He reports sleep disturbances and difficulty concentrating at work. What's your approach?"
    ],
    trauma: [
      "Your client, Emma, a 26-year-old nurse, seeks help processing a recent traumatic workplace incident. She reports intrusive thoughts and avoidance behaviors affecting her ability to work. How do you begin?",
      "Meet Jordan, a 31-year-old veteran transitioning to civilian life, experiencing hypervigilance and emotional numbing. They describe feeling disconnected from family and friends. What's your opening strategy?",
      "Your client, Ana, a 38-year-old mother, is working through childhood trauma that's affecting her parenting. She reports triggered responses and difficulty trusting others. How would you start?"
    ],
    relationships: [
      "Your client, Michael, a 30-year-old software engineer, struggles with communication in his marriage of 3 years. He reports feeling misunderstood and describes increasing conflicts with his partner. What's your initial approach?",
      "Meet Taylor, a 27-year-old graphic designer with a pattern of short-term relationships. They report fear of commitment and difficulty with emotional intimacy. How do you open the session?",
      "Your client, Rachel, a 34-year-old consultant, seeks help with family dynamics after her parents' recent divorce. She feels caught in the middle and reports increased stress. What's your beginning strategy?"
    ]
  };

  // Determine scenario type based on description content
  let scenarioType: keyof typeof scenarios = 'anxiety'; // default
  
  if (description.includes('depress') || description.includes('sad') || description.includes('empty')) {
    scenarioType = 'depression';
  } else if (description.includes('trauma') || description.includes('ptsd') || description.includes('abuse')) {
    scenarioType = 'trauma';
  } else if (description.includes('relationship') || description.includes('marriage') || description.includes('couple')) {
    scenarioType = 'relationships';
  } else if (description.includes('anxiet') || description.includes('worry') || description.includes('panic')) {
    scenarioType = 'anxiety';
  }

  // Select random scenario from the appropriate category
  const categoryScenarios = scenarios[scenarioType];
  const randomIndex = Math.floor(Math.random() * categoryScenarios.length);
  
  return categoryScenarios[randomIndex];
}


// GET endpoint for testing
export async function GET() {
  return NextResponse.json({
    message: 'S2 Scenario Generation API',
    endpoints: {
      'POST /api/s2/generate-scenario': 'Generate patient scenario based on therapist preferences'
    }
  });
}