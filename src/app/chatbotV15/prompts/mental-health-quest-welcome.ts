// src/app/chatbotV15/prompts/mental-health-quest-welcome.ts

"use client";

/**
 * V15 Mental Health Quest Welcome Message
 * This file fetches the welcome message from the database for mental health quest context.
 * Reuses V11's proven API endpoint for consistency.
 */

// Default fallback message if database fetch fails
const DEFAULT_MENTAL_HEALTH_QUEST_MESSAGE = `# MENTAL HEALTH QUEST FOCUS

You are starting a conversation specifically focused on a therapeutic skill module or mental health quest. The user accessed this conversation through the "Mental Health" section and selected a specific therapeutic module, indicating they want guided practice with:

- Therapeutic skill development and practice
- Mental health coping strategies
- Emotional regulation techniques
- Cognitive behavioral therapy exercises
- Mindfulness and self-care practices
- Personal growth and resilience building

# GREETING INSTRUCTIONS
Begin with a warm, supportive greeting that specifically acknowledges they selected a therapeutic module and that you're here to guide them through it. Reference the specific quest they've chosen and ask how they're feeling about starting this work. Make it clear you understand they're working on personal growth and you're here to support them through the process.

Examples of good opening approaches:
- "I'm excited to work on [quest title] with you today! How are you feeling about diving into this therapeutic work?"
- "Let's explore [quest title] together. I'm here to guide you through this at your own pace. What brings you to this particular module today?"
- "I see you've chosen to work on [quest title] - that takes courage. I'm here to support you through this process. How would you like to begin?"`;

/**
 * Function to fetch mental health quest greeting from database (reuses V11 API)
 */
async function fetchMentalHealthQuestGreeting(userId?: string): Promise<string> {
  try {
    const params = new URLSearchParams({
      greetingType: 'mental_health_quest'
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
    console.error('[V15-MentalHealthQuest] Error fetching greeting from database:', error);
  }
  
  return DEFAULT_MENTAL_HEALTH_QUEST_MESSAGE;
}

/**
 * Function to get quest-specific welcome content
 * This combines the greeting prompt with specific details about the selected quest/module
 */
export async function getMentalHealthQuestWelcomeContent(
  questData: {
    quest_title: string;
    introduction: string;
    challenge: string;
    starting_question?: string;
    ai_prompt?: string;
  },
  userId?: string
): Promise<string> {
  console.log('[V15-MentalHealthQuest] getMentalHealthQuestWelcomeContent called with:', questData);
  
  // Fetch the greeting from database
  const greetingPrompt = await fetchMentalHealthQuestGreeting(userId);
  
  const welcomeContent = `${greetingPrompt}

# SELECTED THERAPEUTIC MODULE: ${questData.quest_title}
The user specifically selected "${questData.quest_title}" as their therapeutic skill module.

Module Introduction: ${questData.introduction}

Module Challenge: ${questData.challenge}

${questData.starting_question ? `Starting Question: ${questData.starting_question}` : ''}

${questData.ai_prompt ? `

# SPECIFIC AI INSTRUCTIONS FOR THIS MODULE
${questData.ai_prompt}` : ''}

# SPECIFIC GREETING INSTRUCTIONS FOR THIS MODULE
Your greeting should specifically mention "${questData.quest_title}" and acknowledge that they selected this therapeutic module. Use one of these approaches:

- "I'm excited to work on ${questData.quest_title} with you today! ${questData.introduction} How are you feeling about starting this therapeutic work?"
- "Let's explore ${questData.quest_title} together. ${questData.challenge} I'm here to guide you through this at your own pace. What brings you to this module today?"
- "I see you've chosen to work on ${questData.quest_title} - that shows real commitment to your wellbeing. How would you like to begin?"`;
  
  console.log('[V15-MentalHealthQuest] Generated welcome content length:', welcomeContent.length);
  return welcomeContent;
}