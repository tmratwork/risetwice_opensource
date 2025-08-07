// file: src/config/greetingInstructions.ts

/**
 * TODO: make these fetchable from supabase and remove the hard coded versions
 * 
 * Unified persona expertise shift messages injected as user messages after triage analysis.
 * Each message frames the transition as the same AI accessing specialized knowledge areas
 * rather than being transferred to different AIs. Messages reference context and prompt
 * the AI to respond with their specialized expertise.
 * 
 * These are written as natural user speech since they're injected as user messages
 * to trigger immediate specialist responses with unified persona framing.
 */

export const SPECIALIST_GREETINGS: Record<string, string> = {
  anxiety_specialist: `We have discussed: {{contextSummary}}, please draw on your 
  anxiety-specific techniques and help me with practical approaches for my situation. Focus on techniques
   that might help me feel more grounded right now.`,

  depression_specialist: `Think about what we&apos;ve covered: {{contextSummary}}, please access 
  your depression-focused strategies and suggest a good first step for someone in my situation. Help me 
  work toward feeling a bit better.`,

  substance_use_specialist: `Consider my situation: {{contextSummary}}, please approach this from an
   addiction recovery perspective. Help me focus on the most 
  important next step forward.`,

  trauma_specialist: `Based on my situation: {{contextSummary}}, please draw on trauma-informed 
  approaches. Since I&apos;m ready to talk about some difficult experiences, help me understand how we 
  can approach this safely.`,

  crisis_specialist: `Given my crisis situation: {{contextSummary}}, please access your immediate 
  crisis support knowledge and help me understand what steps I should take to stay safe and get through 
  this difficult moment.`,

  practical_support_specialist: `Consider my situation: {{contextSummary}}, please think about this 
  from a practical resources perspective and help me understand what resources or steps would be most 
  helpful for my specific situation.`,

  cbt_specialist: `Based on what we&apos;ve discussed: {{contextSummary}}, please draw on cognitive 
  behavioral techniques and help me understand how my thinking patterns might be affecting my situation. 
  Show me techniques that could help me work with my thoughts differently.`,

  dbt_specialist: `Given my situation: {{contextSummary}}, please think about this from a DBT skills 
  perspective. Since I&apos;m struggling with intense emotions, help me understand what DBT skills might 
  be most helpful for my situation right now.`,

  general: `Consider my situation: {{contextSummary}}, please access your general mental health 
  approaches and help me understand what would be most helpful to focus on to improve my mental 
  wellbeing.`
};

/**
 * Replaces the contextSummary placeholder in greeting messages
 */
export function getSpecialistGreeting(specialistType: string, contextSummary: string): string {
  const greeting = SPECIALIST_GREETINGS[specialistType] || SPECIALIST_GREETINGS.general;
  return greeting.replace('{{contextSummary}}', contextSummary);
}