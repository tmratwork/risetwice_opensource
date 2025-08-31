import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getGPT4Model } from '@/config/models';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// POST /api/v16/community/moderation/analyze - Analyze content for safety
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, content_type, content_id, user_id } = body;

    if (!content || !content_type || !content_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Basic toxicity detection using OpenAI Moderation API
    let moderationResult;
    try {
      const moderationResponse = await openai.moderations.create({
        input: content,
      });
      moderationResult = moderationResponse.results[0];
    } catch (error) {
      console.error('OpenAI moderation error:', error);
      // Continue with basic keyword detection as fallback
    }

    // Mental health crisis detection
    const mentalHealthFlags = await detectMentalHealthConcerns(content);
    
    // Calculate risk scores
    const toxicityScore = moderationResult?.flagged ? 0.8 : 0.1;
    const requiresReview = moderationResult?.flagged || mentalHealthFlags.length > 0;
    const priority = determinePriority(mentalHealthFlags, moderationResult || null);
    const decision = requiresReview ? 'flagged' : 'approved';

    // Store moderation result using RLS-compliant RPC function
    const { error } = await supabaseAdmin
      .rpc('store_content_moderation_result', {
        target_post_id: content_type === 'post' ? content_id : null,
        target_comment_id: content_type === 'comment' ? content_id : null,
        toxicity_score: toxicityScore,
        mental_health_flags: mentalHealthFlags,
        review_required: requiresReview,
        review_priority: priority,
        ai_decision: decision
      });

    if (error) {
      console.error('Error storing moderation result:', error);
    }

    // Handle crisis detection
    if (mentalHealthFlags.some(flag => ['suicide_ideation', 'self_harm', 'crisis'].includes(flag))) {
      await handleCrisisDetection(user_id, content_id, content_type, mentalHealthFlags);
    }

    // Add to clinical review queue if needed
    if (requiresReview && priority === 'immediate') {
      await addToClinicalReviewQueue(content_id, content_type, user_id, priority, mentalHealthFlags);
    }

    return NextResponse.json({
      decision,
      requires_review: requiresReview,
      priority,
      toxicity_score: toxicityScore,
      mental_health_flags: mentalHealthFlags,
      moderation_details: moderationResult ? {
        flagged: moderationResult.flagged,
        categories: moderationResult.categories
      } : null
    });

  } catch (error) {
    console.error('Moderation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Mental health concern detection
async function detectMentalHealthConcerns(content: string): Promise<string[]> {
  const flags: string[] = [];
  const lowerContent = content.toLowerCase();

  // Suicide ideation keywords
  const suicideKeywords = [
    'want to die', 'wish i was dead', 'kill myself', 'end my life',
    'suicide', 'suicidal', 'not worth living', 'better off dead'
  ];

  // Self-harm keywords
  const selfHarmKeywords = [
    'cut myself', 'hurt myself', 'self harm', 'cutting', 
    'burning myself', 'harm myself'
  ];

  // Crisis escalation keywords
  const crisisKeywords = [
    'tonight', 'today', 'right now', 'cant take it anymore',
    'final message', 'goodbye', 'last time'
  ];

  // Eating disorder keywords
  const eatingDisorderKeywords = [
    'havent eaten', 'threw up', 'purging', 'binge',
    'fat', 'ugly', 'calories', 'restrict'
  ];

  if (suicideKeywords.some(keyword => lowerContent.includes(keyword))) {
    flags.push('suicide_ideation');
  }

  if (selfHarmKeywords.some(keyword => lowerContent.includes(keyword))) {
    flags.push('self_harm');
  }

  if (crisisKeywords.some(keyword => lowerContent.includes(keyword))) {
    flags.push('crisis_escalation');
  }

  if (eatingDisorderKeywords.some(keyword => lowerContent.includes(keyword))) {
    flags.push('eating_disorder');
  }

  // Advanced AI analysis for more nuanced detection
  if (flags.length === 0) {
    try {
      const aiAnalysis = await analyzeWithAI(content);
      if (aiAnalysis.flags) {
        flags.push(...aiAnalysis.flags);
      }
    } catch (error) {
      console.error('AI analysis error:', error);
    }
  }

  return flags;
}

// Advanced AI analysis for mental health concerns
async function analyzeWithAI(content: string): Promise<{ flags: string[] }> {
  try {
    const prompt = `Analyze the following text for mental health concerns. Look for signs of:
- Suicide ideation or planning
- Self-harm behaviors
- Crisis situations
- Eating disorder behaviors
- Severe depression or hopelessness

Text: "${content}"

Respond with a JSON object containing an array of flags. Possible flags:
["suicide_ideation", "self_harm", "crisis_escalation", "eating_disorder", "severe_depression"]

If no concerning content is found, return {"flags": []}`;

    const response = await openai.chat.completions.create({
      model: getGPT4Model(),
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.1
    });

    const result = response.choices[0]?.message?.content;
    if (result) {
      try {
        return JSON.parse(result);
      } catch {
        return { flags: [] };
      }
    }

    return { flags: [] };
  } catch (error) {
    console.error('AI analysis error:', error);
    return { flags: [] };
  }
}

// Determine review priority
function determinePriority(mentalHealthFlags: string[], moderationResult: { flagged?: boolean; categories?: { violence?: boolean } } | null): 'immediate' | 'urgent' | 'standard' {
  if (mentalHealthFlags.includes('suicide_ideation') || 
      mentalHealthFlags.includes('crisis_escalation')) {
    return 'immediate';
  }

  if (mentalHealthFlags.includes('self_harm') || 
      mentalHealthFlags.includes('eating_disorder') ||
      moderationResult?.categories?.violence) {
    return 'urgent';
  }

  return 'standard';
}

// Handle crisis detection
async function handleCrisisDetection(
  userId: string, 
  contentId: string, 
  contentType: string, 
  flags: string[]
): Promise<void> {
  try {
    // Determine severity
    let severity: 'low' | 'medium' | 'high' | 'immediate' = 'medium';
    if (flags.includes('suicide_ideation') || flags.includes('crisis_escalation')) {
      severity = 'immediate';
    } else if (flags.includes('self_harm')) {
      severity = 'high';
    }

    // Store crisis detection using RLS-compliant RPC function
    await supabaseAdmin
      .rpc('store_crisis_detection', {
        target_user_id: userId,
        target_post_id: contentType === 'post' ? contentId : null,
        target_comment_id: contentType === 'comment' ? contentId : null,
        crisis_type_flags: flags.join(','),
        severity_level: severity,
        ai_confidence: 0.8,
        trigger_keywords: flags
      });

    // Update user safety tracking using RLS-compliant RPC function
    await supabaseAdmin
      .rpc('update_user_safety_tracking', {
        target_user_id: userId,
        risk_level: severity === 'immediate' ? 'crisis' : 'high',
        last_crisis_event: new Date().toISOString(),
        flag_increment: 1
      });

    // TODO: Trigger immediate intervention for crisis cases
    // if (severity === 'immediate') {
    //   await triggerCrisisIntervention(userId, contentId);
    // }

  } catch (error) {
    console.error('Crisis detection error:', error);
  }
}

// Add content to clinical review queue
async function addToClinicalReviewQueue(
  contentId: string,
  contentType: string,
  userId: string,
  priority: string,
  reasons: string[]
): Promise<void> {
  try {
    await supabaseAdmin
      .rpc('add_to_clinical_review_queue', {
        target_content_id: contentId,
        content_type: contentType,
        target_user_id: userId,
        priority_level: priority,
        review_reasons: reasons
      });
  } catch (error) {
    console.error('Clinical review queue error:', error);
  }
}