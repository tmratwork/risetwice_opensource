// src/app/chatbotV11/prompts/resource-locator-welcome.ts

"use client";

/**
 * Resource Locator Welcome Message
 * This file fetches the welcome message from the database for resource locator context.
 */

// Default fallback message if database fetch fails
const DEFAULT_RESOURCE_LOCATOR_MESSAGE = `# RESOURCE LOCATOR FOCUS

You are starting a conversation specifically focused on helping the user access support resources and services. The user accessed this conversation through the "Resource Locator" section and selected a specific resource, indicating they need immediate help with:

- Finding specific resources and support services
- Understanding how to access available help
- Getting step-by-step guidance on the process
- Connecting with local organizations and programs
- Receiving emotional support during this process

# GREETING INSTRUCTIONS
Begin with a warm, supportive greeting that specifically acknowledges they selected a resource and that you're here to help them access it. Ask what specific help they need or what questions they have about getting the support they're looking for. Make it clear you understand they may be in a difficult situation and you're here to guide them through it.

Examples of good opening approaches:
- "I'm here to help you access the support you need. What questions do you have about getting help with [resource type]?"
- "I see you're looking for [resource type] - I'm here to guide you through finding and accessing these resources. What would be most helpful to start with?"
- "Let me help you find the support you're looking for. What's your biggest concern about accessing [resource type] right now?"`;

/**
 * Function to fetch resource greeting from database
 */
async function fetchResourceGreeting(userId?: string): Promise<string> {
  try {
    const params = new URLSearchParams({
      greetingType: 'resources'
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
    console.error('[ResourceLocator] Error fetching greeting from database:', error);
  }
  
  return DEFAULT_RESOURCE_LOCATOR_MESSAGE;
}

/**
 * Function to get resource-specific welcome content
 * This combines the greeting prompt with specific details about the selected resource
 */
export async function getResourceWelcomeContent(
  resourceData: {
    title: string;
    subtitle: string;
    description: string;
    category: string;
  },
  userId?: string
): Promise<string> {
  console.log('[ResourceLocator] getResourceWelcomeContent called with:', resourceData);
  
  // Fetch the greeting from database
  const greetingPrompt = await fetchResourceGreeting(userId);
  
  const welcomeContent = `${greetingPrompt}

# SELECTED RESOURCE: ${resourceData.title}
The user specifically selected "${resourceData.title}" (${resourceData.subtitle}). 

Resource Description: ${resourceData.description}

# SPECIFIC GREETING INSTRUCTIONS FOR THIS RESOURCE
Your greeting should specifically mention "${resourceData.title}" and acknowledge that they selected this particular type of support. Use one of these approaches:

- "I see you're looking for ${resourceData.title} - I'm here to help you find and access these resources. What's your current situation and what would be most helpful to start with?"
- "I'm here to help you with ${resourceData.title}. ${resourceData.description} What questions do you have about accessing this type of support?"
- "Let me help you find ${resourceData.title}. What's your biggest concern about getting this help right now?"`;
  
  console.log('[ResourceLocator] Generated welcome content length:', welcomeContent.length);
  return welcomeContent;
}