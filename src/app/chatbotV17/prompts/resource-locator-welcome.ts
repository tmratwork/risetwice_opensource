// src/app/chatbotV16/prompts/resource-locator-welcome.ts

"use client";

import { getResourceSpecificGreeting } from './resource-specific-greetings';
import { getStoredLanguagePreference } from '@/lib/language-utils';

/**
 * V16 Resource Locator Welcome Message
 * This file fetches the welcome message from the V16 greeting database for resource locator context.
 * Uses V16 API with language support and proper error handling.
 * Now includes resource-specific greeting content based on selected resource.
 */

/**
 * Function to fetch resource greeting from V16 database with language support
 */
async function fetchResourceGreeting(userId?: string): Promise<string> {
  // Add comprehensive multilingual support logging
  const logMultilingualSupport = (message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_MULTILINGUAL_SUPPORT_LOGS === 'true') {
      console.log(`[multilingual_support] ${message}`, ...args);
    }
  };

  try {
    const isAuthenticated = !!(userId && userId !== 'anonymous');
    const languagePreference = getStoredLanguagePreference(isAuthenticated);
    const params = new URLSearchParams({
      type: 'resources',
      language: languagePreference
    });
    
    if (userId && userId !== 'anonymous') {
      params.append('userId', userId);
    }

    const apiUrl = `/api/v16/greeting-prompt?${params.toString()}`;
    
    logMultilingualSupport('🌐 API CALL: Requesting resource greeting from V16 API', {
      languagePreference,
      greetingType: 'resources',
      userId: userId || 'anonymous',
      apiUrl,
      params: Object.fromEntries(params.entries()),
      timestamp: new Date().toISOString(),
      source: 'fetch-resource-greeting',
      impact: 'This call determines what language greeting AI will receive'
    });
    
    const response = await fetch(apiUrl);
    
    logMultilingualSupport('📡 API RESPONSE: Received response from greeting API', {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      languagePreference,
      greetingType: 'resources',
      userId: userId || 'anonymous',
      source: 'greeting-api-response',
      impact: response.ok ? 'API call successful' : 'API call failed - may cause EN fallback'
    });

    if (!response.ok) {
      const errorData = await response.json();
      
      logMultilingualSupport('❌ API ERROR: Greeting API returned error', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        languagePreference,
        greetingType: 'resources',
        userId: userId || 'anonymous',
        source: 'greeting-api-error',
        impact: 'Will show breaking error - no fallback to English allowed'
      });
      
      throw new Error(`V16 Greeting API Error: ${errorData.error || `HTTP ${response.status}`}\n\nDetails: ${errorData.suggestion || 'Check server logs'}\n\nAdmin: ${errorData.adminUrl || '/chatbotV16/admin/greetings'}`);
    }

    const data = await response.json();
    
    logMultilingualSupport('📄 API DATA: Parsing greeting API response', {
      hasSuccess: !!data.success,
      hasGreeting: !!data.greeting,
      hasContent: !!data.greeting?.content,
      greetingId: data.greeting?.id,
      greetingType: data.greeting?.type,
      greetingLanguage: data.greeting?.language,
      contentLength: data.greeting?.content?.length || 0,
      contentPreview: data.greeting?.content?.substring(0, 200) + '...' || 'EMPTY',
      languagePreference,
      source: 'greeting-api-data-parse',
      impact: 'This content will be sent to AI as greeting instructions'
    });
    
    if (!data.success || !data.greeting?.content) {
      logMultilingualSupport('❌ DATA VALIDATION: Invalid API response format', {
        success: data.success,
        hasGreeting: !!data.greeting,
        hasContent: !!data.greeting?.content,
        fullResponse: data,
        languagePreference,
        source: 'greeting-api-validation-error',
        impact: 'Will show breaking error - invalid data structure'
      });
      
      throw new Error(`V16 Greeting API returned invalid data format. Expected greeting.content but received: ${JSON.stringify(data)}`);
    }

    logMultilingualSupport('✅ GREETING SUCCESS: Resource greeting fetched successfully', {
      greetingId: data.greeting.id,
      greetingType: data.greeting.type,
      greetingLanguage: data.greeting.language,
      contentLength: data.greeting.content.length,
      contentPreview: data.greeting.content.substring(0, 200) + '...',
      languagePreference,
      userId: userId || 'anonymous',
      source: 'greeting-fetch-success',
      impact: 'AI will receive greeting in requested language'
    });

    return data.greeting.content;
  } catch (error) {
    // Log detailed error for debugging
    console.error('[V16-ResourceLocator] CRITICAL ERROR: Failed to fetch resource greeting from V16 API:', error);
    
    logMultilingualSupport('❌ CRITICAL ERROR: Resource greeting fetch completely failed', {
      error: (error as Error).message,
      languagePreference: getStoredLanguagePreference(!!(userId && userId !== 'anonymous')),
      userId: userId || 'anonymous',
      source: 'greeting-fetch-critical-error',
      impact: 'Complete multilingual support failure - showing breaking error'
    });
    
    // Throw verbose error for UI display - no fallbacks allowed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`RESOURCE GREETING FETCH FAILED

${errorMessage}

This is a breaking error in the V16 system. The application requires a 'resources' greeting in the selected language to function properly.

To fix this issue:
1. Go to the admin interface: /chatbotV16/admin/greetings
2. Create a greeting for type 'resources' in the user's selected language
3. Ensure the greeting is marked as active

Language selected: ${getStoredLanguagePreference(!!(userId && userId !== 'anonymous'))}
User ID: ${userId || 'anonymous'}
Timestamp: ${new Date().toISOString()}`);
  }
}

// Helper function for resource greeting debugging - using single consistent prefix
const logResourceGreeting = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_GREETING_LOGS === 'true') {
    console.log(`[resource_greeting] ${message}`, ...args);
  }
};

/**
 * Function to get resource-specific welcome content
 * This combines the greeting prompt with specific details about the selected resource
 * Now uses resource-specific greeting content when available
 */
export async function getResourceWelcomeContent(
  resourceData: {
    id?: string;
    title: string;
    subtitle: string;
    description: string;
    category: string;
  },
  userId?: string
): Promise<string> {
  logResourceGreeting('🚀 STEP 1: getResourceWelcomeContent called', {
    resourceId: resourceData.id,
    resourceTitle: resourceData.title,
    resourceSubtitle: resourceData.subtitle,
    resourceCategory: resourceData.category,
    userId: userId || 'anonymous',
    descriptionLength: resourceData.description.length,
    hasId: !!resourceData.id,
    timestamp: Date.now()
  });
  
  // First try to get resource-specific greeting
  let resourceSpecificGreeting = null;
  if (resourceData.id) {
    logResourceGreeting('🔍 STEP 2: Looking up resource-specific greeting', {
      resourceId: resourceData.id,
      searchingFor: resourceData.id
    });
    
    resourceSpecificGreeting = getResourceSpecificGreeting(resourceData.id);
    
    logResourceGreeting('🔍 STEP 3: Resource-specific greeting lookup result', {
      resourceId: resourceData.id,
      found: !!resourceSpecificGreeting,
      greetingTitle: resourceSpecificGreeting?.title,
      greetingId: resourceSpecificGreeting?.id,
      greetingExists: resourceSpecificGreeting !== null,
      searchResult: resourceSpecificGreeting ? 'FOUND' : 'NOT_FOUND'
    });
  } else {
    logResourceGreeting('⚠️ STEP 2: No resource ID provided - skipping specific greeting lookup', {
      resourceData: {
        title: resourceData.title,
        hasId: !!resourceData.id,
        idValue: resourceData.id || 'undefined'
      }
    });
  }
  
  // If we have a resource-specific greeting, use it
  if (resourceSpecificGreeting) {
    logResourceGreeting('✅ STEP 4A: Using resource-specific greeting', {
      resourceId: resourceData.id,
      greetingTitle: resourceSpecificGreeting.title,
      greetingLength: resourceSpecificGreeting.greetingContent.length,
      greetingPreview: resourceSpecificGreeting.greetingContent.substring(0, 100) + '...',
      path: 'RESOURCE_SPECIFIC'
    });
    
    const welcomeContent = `${resourceSpecificGreeting.greetingContent}

# SELECTED RESOURCE DETAILS
The user specifically selected "${resourceData.title}" (${resourceData.subtitle}).

Resource Description: ${resourceData.description}

Category: ${resourceData.category}`;
    
    logResourceGreeting('✅ STEP 5A: Resource-specific welcome content generated', {
      finalLength: welcomeContent.length,
      resourceTitle: resourceData.title,
      finalPreview: welcomeContent.substring(0, 300) + '...',
      contentType: 'RESOURCE_SPECIFIC_GREETING',
      greetingUsed: resourceSpecificGreeting.title
    });
    
    return welcomeContent;
  }
  
  // Fallback to generic database greeting for unknown resources
  logResourceGreeting('⚠️ STEP 4B: No resource-specific greeting found, using generic database greeting', {
    resourceId: resourceData.id,
    resourceTitle: resourceData.title,
    path: 'GENERIC_FALLBACK',
    reason: resourceData.id ? 'GREETING_NOT_FOUND' : 'NO_RESOURCE_ID'
  });
  
  // Fetch the greeting from V16 database - this will throw errors if it fails
  logResourceGreeting('📥 STEP 5B: Fetching generic greeting from V16 database...', {
    userId: userId || 'anonymous',
    greetingType: 'resources'
  });
  
  let greetingPrompt: string;
  try {
    greetingPrompt = await fetchResourceGreeting(userId);
    
    logResourceGreeting('📥 STEP 6B: V16 Database greeting fetched successfully', {
      greetingLength: greetingPrompt.length,
      greetingPreview: greetingPrompt.substring(0, 100) + '...',
      source: 'V16_DATABASE'
    });
  } catch (error) {
    // Re-throw with additional context about resource selection
    throw new Error(`Failed to load greeting for resource selection: ${resourceData.title}

Original error:
${(error as Error).message}

Context: User selected a specific resource but the system cannot provide a greeting in their selected language.`);
  }
  
  const welcomeContent = `${greetingPrompt}

# SELECTED RESOURCE: ${resourceData.title}
The user specifically selected "${resourceData.title}" (${resourceData.subtitle}). 

Resource Description: ${resourceData.description}

# SPECIFIC GREETING INSTRUCTIONS FOR THIS RESOURCE
Your greeting should specifically mention "${resourceData.title}" and acknowledge that they selected this particular type of support. Use one of these approaches:

- "I see you're looking for ${resourceData.title} - I'm here to help you find and access these resources. What's your current situation and what would be most helpful to start with?"
- "I'm here to help you with ${resourceData.title}. ${resourceData.description} What questions do you have about accessing this type of support?"
- "Let me help you find ${resourceData.title}. What's your biggest concern about getting this help right now?"`;
  
  logResourceGreeting('✅ STEP 7B: Generic welcome content generated', {
    finalLength: welcomeContent.length,
    resourceTitle: resourceData.title,
    finalPreview: welcomeContent.substring(0, 300) + '...',
    contentType: 'GENERIC_WITH_RESOURCE_CONTEXT',
    path: 'GENERIC_FALLBACK'
  });
  
  return welcomeContent;
}