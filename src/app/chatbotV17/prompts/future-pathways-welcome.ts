// src/app/chatbotV15/prompts/future-pathways-welcome.ts

"use client";

/**
 * V15 Future Pathways Welcome Message
 * This file fetches the welcome message from the database for future pathways context.
 * Reuses V11's proven API endpoint for consistency.
 */

// Default fallback message if database fetch fails
const DEFAULT_FUTURE_PATHWAYS_MESSAGE = `# FUTURE PATHWAYS FOCUS

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
 * Function to fetch future pathways greeting from database (reuses V11 API)
 */
async function fetchFuturePathwaysGreeting(userId?: string): Promise<string> {
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
        return data.promptContent;
      }
    }
  } catch (error) {
    // console.error('[V15-FuturePathways] Error fetching greeting from database:', error);
    void error; // Avoid unused variable error
  }
  
  return DEFAULT_FUTURE_PATHWAYS_MESSAGE;
}

/**
 * Function to get pathway-specific welcome content
 * This combines the greeting prompt with specific details about the selected pathway
 */
export async function getFuturePathwaysWelcomeContent(
  pathwayData: {
    title: string;
    subtitle: string;
    description: string;
    category: string;
  },
  userId?: string
): Promise<string> {
    // console.log('[V15-FuturePathways] getFuturePathwaysWelcomeContent called with:', pathwayData);
  
  // Fetch the greeting from database
  const greetingPrompt = await fetchFuturePathwaysGreeting(userId);
  
  const welcomeContent = `${greetingPrompt}

# SELECTED PATHWAY: ${pathwayData.title}
The user specifically selected "${pathwayData.title}" (${pathwayData.subtitle}). 

Pathway Description: ${pathwayData.description}

# SPECIFIC GREETING INSTRUCTIONS FOR THIS PATHWAY
Your greeting should specifically mention "${pathwayData.title}" and acknowledge that they selected this particular pathway. Use one of these approaches:

- "I see you're interested in ${pathwayData.title} - I'm excited to help you with this! What's been on your mind about ${pathwayData.subtitle.toLowerCase()}?"
- "Let's work on ${pathwayData.title} together. ${pathwayData.description} What would you like to explore first?"
- "I'm here to help you with ${pathwayData.title}. What questions do you have about getting started with this pathway?"`;
  
    // console.log('[V15-FuturePathways] Generated welcome content length:', welcomeContent.length);
  return welcomeContent;
}