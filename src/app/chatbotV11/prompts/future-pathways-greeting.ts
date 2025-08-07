/**
 * Future Pathways Greeting Instructions
 * 
 * This file fetches the greeting prompt from the database for future pathways context.
 */

"use client";

// Default fallback message if database fetch fails
const DEFAULT_FUTURE_PATHWAYS_GREETING = `# FUTURE PATHWAYS FOCUS

You are starting a conversation specifically focused on future pathways, career exploration, and life planning. The user accessed this conversation through the "Future Pathways" section, indicating they want guidance on:

- Career exploration and planning
- Educational pathway options
- Skill development and job readiness
- Goal setting and action planning
- Resource connections and networking opportunities

# GREETING INSTRUCTIONS
Begin with a warm, encouraging greeting that specifically acknowledges their interest in exploring future pathways. Ask an open-ended question that invites them to share what aspect of their future they'd like to explore or what goals they're working toward. Make it clear you're here to help them navigate their next steps.

Examples of good opening approaches:
- "I'm excited to help you explore your future pathways! What's been on your mind about your career or life direction?"
- "Let's talk about your future - what goals or dreams are you thinking about pursuing?"
- "I'm here to help you plan your next steps. What area of your future would you like to explore together?"`;

/**
 * Function to fetch future pathways greeting from database
 */
export async function fetchFuturePathwaysGreeting(userId?: string): Promise<string> {
  try {
    const params = new URLSearchParams({
      greetingType: 'future_pathways'
    });
    
    if (userId) {
      params.append('userId', userId);
    } else {
      params.append('anonymous', 'true');
    }
    
    const response = await fetch(`/api/v11/greeting-prompt?${params.toString()}`);
    
    if (response.ok) {
      const data = await response.json();
      if (data.promptContent) {
        console.log('[FuturePathways] Successfully fetched greeting from database');
        return data.promptContent;
      }
    }
  } catch (error) {
    console.error('[FuturePathways] Error fetching greeting from database:', error);
  }
  
  console.log('[FuturePathways] Using default greeting');
  return DEFAULT_FUTURE_PATHWAYS_GREETING;
}

// For backward compatibility, export the constant that will be used
export const FUTURE_PATHWAYS_GREETING = DEFAULT_FUTURE_PATHWAYS_GREETING;