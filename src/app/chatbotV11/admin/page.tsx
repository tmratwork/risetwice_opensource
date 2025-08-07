// file: src/app/chatbotV11/admin/page.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { setupGreetingForUser, setupAIInstructionsForUser } from './setup-greeting-for-user';
import { setupInsightsSystemPromptForUser, setupInsightsUserPromptForUser } from './setup-insights-prompts';
import { setupWarmHandoffPromptForUser } from './setup-warm-handoff-prompt';
import { setupQuestGenerationPromptForUser } from './setup-quest-generation-prompt';
import {
  setupProfileAnalysisSystemPromptForUser,
  setupProfileAnalysisUserPromptForUser,
  setupProfileMergeSystemPromptForUser,
  setupProfileMergeUserPromptForUser
} from './setup-profile-prompts';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { generateBookInstructions } from '../prompts';
import { Copy, Check } from 'lucide-react';
import ProfileTabs from './profile-tabs';

export default function AdminPage() {
  console.log('[Debug] AdminPage component mounting/rendering');
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [activeTab, setActiveTab] = useState<
    'greeting' |
    'ai_instructions' |
    'insights_system' |
    'insights_user' |
    'warm_handoff' |
    'quest_generation' |
    'profile_analysis' |
    'profile_merge'
  >('greeting');
  
  // Sub-tab for greeting types
  const [activeGreetingTab, setActiveGreetingTab] = useState<'default' | 'resources' | 'future_pathways'>('default');

  // Books state for the quest generation tab
  const [books, setBooks] = useState<{ id: string; title: string; author: string }[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [booksLoading, setBooksLoading] = useState<boolean>(false);
  const [isBookSpecificPrompt, setIsBookSpecificPrompt] = useState<boolean>(false);

  // Default greeting prompt state
  const [greetingContent, setGreetingContent] = useState(
    `Greet the user warmly and create a supportive atmosphere. Express that you're here to listen and support them. Ask an open-ended question about how they're feeling or what's on their mind today. Keep your tone gentle and inviting, but maintain brevity. Avoid asking multiple questions or overwhelming them with too much information in this first interaction. 

Examples of good opening messages:
- 'Hello, I'm here to support you today. How are you feeling right now?'
- 'Welcome. I'm here to listen whenever you're ready to share. What's on your mind today?'
- 'I'm glad you're here. What would you like to talk about?'
- 'How are you doing today? I'm here to support you however I can.'

Your response should be similar to these examples in tone and length.`
  );
  const [greetingTitle, setGreetingTitle] = useState<string>('');
  const [greetingNotes, setGreetingNotes] = useState<string>('');
  const [currentGreetingInstructions, setCurrentGreetingInstructions] = useState<string>('Loading current instructions...');
  const [globalGreetingInstructions, setGlobalGreetingInstructions] = useState<string | null>(null);
  const [isGreetingGlobal, setIsGreetingGlobal] = useState<boolean>(false);
  
  // Resources greeting prompt state
  const [resourcesGreetingContent, setResourcesGreetingContent] = useState('');
  const [resourcesGreetingTitle, setResourcesGreetingTitle] = useState<string>('');
  const [resourcesGreetingNotes, setResourcesGreetingNotes] = useState<string>('');
  const [currentResourcesGreeting, setCurrentResourcesGreeting] = useState<string>('Loading current instructions...');
  const [globalResourcesGreeting, setGlobalResourcesGreeting] = useState<string | null>(null);
  const [isResourcesGreetingGlobal, setIsResourcesGreetingGlobal] = useState<boolean>(false);
  
  // Future pathways greeting prompt state
  const [pathwaysGreetingContent, setPathwaysGreetingContent] = useState('');
  const [pathwaysGreetingTitle, setPathwaysGreetingTitle] = useState<string>('');
  const [pathwaysGreetingNotes, setPathwaysGreetingNotes] = useState<string>('');
  const [currentPathwaysGreeting, setCurrentPathwaysGreeting] = useState<string>('Loading current instructions...');
  const [globalPathwaysGreeting, setGlobalPathwaysGreeting] = useState<string | null>(null);
  const [isPathwaysGreetingGlobal, setIsPathwaysGreetingGlobal] = useState<boolean>(false);

  // AI instructions state
  const [aiInstructionsContent, setAIInstructionsContent] = useState(
    generateBookInstructions('Example Book', 'Example Author')
  );
  const [aiInstructionsTitle, setAIInstructionsTitle] = useState<string>('');
  const [aiInstructionsNotes, setAIInstructionsNotes] = useState<string>('');
  const [currentAIInstructions, setCurrentAIInstructions] = useState<string>('Loading current AI instructions...');
  const [globalAIInstructions, setGlobalAIInstructions] = useState<string | null>(null);
  const [isAIInstructionsGlobal, setIsAIInstructionsGlobal] = useState<boolean>(false);

  // Insights system prompt state
  const [insightsSystemContent, setInsightsSystemContent] = useState('');
  const [insightsSystemTitle, setInsightsSystemTitle] = useState<string>('');
  const [insightsSystemNotes, setInsightsSystemNotes] = useState<string>('');
  const [currentInsightsSystem, setCurrentInsightsSystem] = useState<string>('Loading current insights system prompt...');
  const [globalInsightsSystem, setGlobalInsightsSystem] = useState<string | null>(null);
  const [isInsightsSystemGlobal, setIsInsightsSystemGlobal] = useState<boolean>(false);

  // Insights user prompt state
  const [insightsUserContent, setInsightsUserContent] = useState('');
  const [insightsUserTitle, setInsightsUserTitle] = useState<string>('');
  const [insightsUserNotes, setInsightsUserNotes] = useState<string>('');
  const [currentInsightsUser, setCurrentInsightsUser] = useState<string>('Loading current insights user prompt...');
  const [globalInsightsUser, setGlobalInsightsUser] = useState<string | null>(null);
  const [isInsightsUserGlobal, setIsInsightsUserGlobal] = useState<boolean>(false);

  // Warm handoff prompt state
  const [warmHandoffContent, setWarmHandoffContent] = useState('');
  const [warmHandoffTitle, setWarmHandoffTitle] = useState<string>('');
  const [warmHandoffNotes, setWarmHandoffNotes] = useState<string>('');
  const [currentWarmHandoff, setCurrentWarmHandoff] = useState<string>('Loading current warm handoff prompt...');
  const [globalWarmHandoff, setGlobalWarmHandoff] = useState<string | null>(null);
  const [isWarmHandoffGlobal, setIsWarmHandoffGlobal] = useState<boolean>(false);

  // Quest generation prompt state
  const [questGenerationContent, setQuestGenerationContent] = useState('');
  const [questGenerationTitle, setQuestGenerationTitle] = useState<string>('');
  const [questGenerationNotes, setQuestGenerationNotes] = useState<string>('');
  const [currentQuestGeneration, setCurrentQuestGeneration] = useState<string>('');
  const [globalQuestGeneration, setGlobalQuestGeneration] = useState<string | null>(null);
  const [isQuestGenerationGlobal, setIsQuestGenerationGlobal] = useState<boolean>(false);


  // Shared state
  const [status, setStatus] = useState<{ success?: boolean; message: string }>({ message: '' });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // State for insights sub-tab
  const [activeInsightsTab, setActiveInsightsTab] = useState<'system' | 'user'>('system');

  // State for profile analysis sub-tab
  const [activeProfileAnalysisTab, setActiveProfileAnalysisTab] = useState<'system' | 'user'>('system');

  // Profile analysis system state
  const [profileAnalysisSystemContent, setProfileAnalysisSystemContent] = useState<string>('');
  const [profileAnalysisSystemTitle, setProfileAnalysisSystemTitle] = useState<string>('');
  const [profileAnalysisSystemNotes, setProfileAnalysisSystemNotes] = useState<string>('');
  const [currentProfileAnalysisSystem, setCurrentProfileAnalysisSystem] = useState<string>('');
  const [globalProfileAnalysisSystem, setGlobalProfileAnalysisSystem] = useState<string | null>(null);
  const [isProfileAnalysisSystemGlobal, setIsProfileAnalysisSystemGlobal] = useState<boolean>(false);
  const [copiedProfileAnalysisSystem, setCopiedProfileAnalysisSystem] = useState<boolean>(false);
  const [copiedCurrentProfileAnalysisSystem, setCopiedCurrentProfileAnalysisSystem] = useState<boolean>(false);

  // Profile analysis user state
  const [profileAnalysisUserContent, setProfileAnalysisUserContent] = useState<string>('');
  const [profileAnalysisUserTitle, setProfileAnalysisUserTitle] = useState<string>('');
  const [profileAnalysisUserNotes, setProfileAnalysisUserNotes] = useState<string>('');
  const [currentProfileAnalysisUser, setCurrentProfileAnalysisUser] = useState<string>('');
  const [globalProfileAnalysisUser, setGlobalProfileAnalysisUser] = useState<string | null>(null);
  const [isProfileAnalysisUserGlobal, setIsProfileAnalysisUserGlobal] = useState<boolean>(false);
  const [copiedProfileAnalysisUser, setCopiedProfileAnalysisUser] = useState<boolean>(false);
  const [copiedCurrentProfileAnalysisUser, setCopiedCurrentProfileAnalysisUser] = useState<boolean>(false);

  // State for profile merge sub-tab
  const [activeProfileMergeTab, setActiveProfileMergeTab] = useState<'system' | 'user'>('system');

  // Profile merge system state
  const [profileMergeSystemContent, setProfileMergeSystemContent] = useState<string>('');
  const [profileMergeSystemTitle, setProfileMergeSystemTitle] = useState<string>('');
  const [profileMergeSystemNotes, setProfileMergeSystemNotes] = useState<string>('');
  const [currentProfileMergeSystem, setCurrentProfileMergeSystem] = useState<string>('');
  const [globalProfileMergeSystem, setGlobalProfileMergeSystem] = useState<string | null>(null);
  const [isProfileMergeSystemGlobal, setIsProfileMergeSystemGlobal] = useState<boolean>(false);
  const [copiedProfileMergeSystem, setCopiedProfileMergeSystem] = useState<boolean>(false);
  const [copiedCurrentProfileMergeSystem, setCopiedCurrentProfileMergeSystem] = useState<boolean>(false);

  // Profile merge user state
  const [profileMergeUserContent, setProfileMergeUserContent] = useState<string>('');
  const [profileMergeUserTitle, setProfileMergeUserTitle] = useState<string>('');
  const [profileMergeUserNotes, setProfileMergeUserNotes] = useState<string>('');
  const [currentProfileMergeUser, setCurrentProfileMergeUser] = useState<string>('');
  const [globalProfileMergeUser, setGlobalProfileMergeUser] = useState<string | null>(null);
  const [isProfileMergeUserGlobal, setIsProfileMergeUserGlobal] = useState<boolean>(false);
  const [copiedProfileMergeUser, setCopiedProfileMergeUser] = useState<boolean>(false);
  const [copiedCurrentProfileMergeUser, setCopiedCurrentProfileMergeUser] = useState<boolean>(false);


  // State for copy buttons
  const [copiedGreeting, setCopiedGreeting] = useState(false);
  const [copiedCurrentGreeting, setCopiedCurrentGreeting] = useState(false);
  const [copiedResourcesGreeting, setCopiedResourcesGreeting] = useState(false);
  const [copiedCurrentResourcesGreeting, setCopiedCurrentResourcesGreeting] = useState(false);
  const [copiedPathwaysGreeting, setCopiedPathwaysGreeting] = useState(false);
  const [copiedCurrentPathwaysGreeting, setCopiedCurrentPathwaysGreeting] = useState(false);
  const [copiedAIInstructions, setCopiedAIInstructions] = useState(false);
  const [copiedCurrentAIInstructions, setCopiedCurrentAIInstructions] = useState(false);
  const [copiedInsightsSystem, setCopiedInsightsSystem] = useState(false);
  const [copiedCurrentInsightsSystem, setCopiedCurrentInsightsSystem] = useState(false);
  const [copiedInsightsUser, setCopiedInsightsUser] = useState(false);
  const [copiedCurrentInsightsUser, setCopiedCurrentInsightsUser] = useState(false);
  const [copiedWarmHandoff, setCopiedWarmHandoff] = useState(false);
  const [copiedCurrentWarmHandoff, setCopiedCurrentWarmHandoff] = useState(false);
  const [copiedQuestGeneration, setCopiedQuestGeneration] = useState(false);
  const [copiedCurrentQuestGeneration, setCopiedCurrentQuestGeneration] = useState(false);


  useEffect(() => {
    // Get the current logged-in user's ID from Firebase
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        // Auto-fill the User ID field with the current user's ID
        setUserId(user.uid);
      } else {
        setCurrentUserId('');
      }
    });

    // Fetch books for the book selector
    const fetchBooks = async () => {
      setBooksLoading(true);
      try {
        const response = await fetch('/api/v11/books');
        if (response.ok) {
          const booksData = await response.json();
          setBooks(booksData);
        } else {
          console.error('Failed to fetch books');
        }
      } catch (error) {
        console.error('Error fetching books:', error);
      } finally {
        setBooksLoading(false);
      }
    };

    fetchBooks();

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Update the displayed greeting instructions when the form value changes
    setCurrentGreetingInstructions(greetingContent);
  }, [greetingContent]);

  useEffect(() => {
    // Update the displayed AI instructions when the form value changes
    setCurrentAIInstructions(aiInstructionsContent);
  }, [aiInstructionsContent]);

  useEffect(() => {
    // Update the displayed insights system prompt when the form value changes
    setCurrentInsightsSystem(insightsSystemContent);
  }, [insightsSystemContent]);

  useEffect(() => {
    // Update the displayed insights user prompt when the form value changes
    setCurrentInsightsUser(insightsUserContent);
  }, [insightsUserContent]);

  useEffect(() => {
    // Update the displayed warm handoff prompt when the form value changes
    setCurrentWarmHandoff(warmHandoffContent);
  }, [warmHandoffContent]);

  // Remove the effect that syncs quest generation content with current display
  // This allows them to be independent - edited content doesn't affect the display of current saved content

  // Initialize insights system prompt with default if empty
  useEffect(() => {
    if (!insightsSystemContent) {
      setInsightsSystemContent(`You are analyzing a conversation between a user and an AI assistant, following a trauma-informed youth mental health approach. Extract insights that can help empower the young person, focusing only on information that would benefit them directly.

Extract only the following insight types, aligning with trauma-informed principles:
1. Strengths the AI has affirmed - Look for AI affirmations and self-efficacy statements
2. Current goals/priorities - Explicit goal statements or repeated value themes
3. Coping skills that seem helpful - Skills mentioned that helped or positive feedback on coping strategies
4. Resources explored - Any resources, hotlines, supports mentioned or requested
5. Risk indicators - Look for crisis keywords, pattern changes, or distress markers
6. Engagement signals - Ratio of user/AI words, frequency of optional disclosures

IMPORTANT PRIVACY CONSIDERATIONS:
- Do NOT attempt to diagnose
- Do NOT create psychological profiles
- Do NOT extract demographic information
- Do NOT highlight vulnerabilities without matching strengths
- Focus only on explicit content (don't "read between the lines")
- Only include insights with reasonable confidence

CRITICAL: All insights must use second-person perspective with "You" instead of "User" (e.g., "You mentioned feeling stressed" NOT "User mentioned feeling stressed" or "User is exploring").

Format your response as a JSON array with these fields for each insight:
- type: One of ["strength", "goal", "coping", "resource", "risk", "engagement"]
- content: The specific insight in neutral, validating language using direct second-person ("You") address
- source: Brief reference to where this was found (e.g., "mentioned at start of conversation")
- confidence: Your confidence in this insight (0.1-1.0)`);
    }
  }, [insightsSystemContent]);

  // Initialize insights user prompt with default if empty
  useEffect(() => {
    if (!insightsUserContent) {
      setInsightsUserContent(`Here is the conversation to analyze. Focus only on the most clear and evidence-based insights that directly empower the user.

REMEMBER: Always use direct second-person address in your insights (e.g., "You expressed interest in" rather than "User is interested in").`);
    }
  }, [insightsUserContent]);

  // Initialize warm handoff prompt with default if empty
  useEffect(() => {
    if (!warmHandoffContent) {
      setWarmHandoffContent(`# Generate a Trauma-Informed Warm Hand-off Summary Sheet

Based on our conversation history, please create a warm hand-off summary sheet with the sections the user has consented to include. Present the information in a clear, supportive format that can be easily shared with human service providers if the user chooses.

## Summary Sheet Sections
For each section the user has consented to include, extract relevant information from our conversation:

1. **My Identified Strengths**: Highlight strengths the user has demonstrated or mentioned during our conversations. Focus on resilience, coping abilities, insights, and positive qualities they've shown.

2. **My Current Goals/Priorities**: Summarize specific goals or priorities the user has explicitly discussed or expressed interest in working toward.

3. **Helpful Coping Strategies**: List specific skills, techniques, or approaches the user has found beneficial or has expressed interest in developing further.

4. **Resources Explored**: Compile specific resources, services, or support options the user has engaged with or expressed interest in.

5. **Safety Plan Highlights**: If a safety plan was developed during our conversations, include the key elements the user has consented to share.

6. **My Notes for My Support Person**: Include the user's direct input for this customizable section, allowing them to add personal thoughts or questions.

## Format Guidelines
- Present the information in a simple, readable format
- Use the user's own words where appropriate
- Emphasize strengths and progress
- Keep the language warm and non-clinical
- Focus on information that would be helpful for continuity of care
- Ensure the summary reflects the user's perspective and priorities
- Keep each section concise and relevant

The final summary should validate the user's autonomy in managing their care and maintain a strengths-based perspective throughout. The document should serve as a helpful bridge between our conversations and potential human support, entirely under the user's control for sharing as they see fit.`);
    }
  }, [warmHandoffContent]);

  // No initialization for quest generation prompt - it should be blank by default

  // No hardcoded defaults - all prompts must be fetched from Supabase
  // If prompts are missing, this is a breaking error that should be visible

  // No hardcoded defaults - all prompts must be fetched from Supabase
  // If prompts are missing, this is a breaking error that should be visible

  // No hardcoded defaults - all prompts must be fetched from Supabase
  // If prompts are missing, this is a breaking error that should be visible

  // No hardcoded defaults - all prompts must be fetched from Supabase
  // If prompts are missing, this is a breaking error that should be visible

  // Function to fetch quest generation prompt
  const fetchQuestGenerationPrompt = useCallback(async (userId: string, bookId?: string) => {
    console.log('[Debug] Fetching quest generation prompt for user:', userId, bookId ? `and book: ${bookId}` : '');
    
    try {
      // Note: API expects 'createdBy' parameter, not 'userId'
      let questUrl = `/api/v11/prompts?createdBy=${encodeURIComponent(userId)}&category=quest_generation`;
      
      // Add book ID filter if provided
      if (bookId) {
        questUrl += `&bookId=${encodeURIComponent(bookId)}`;
      } else {
        // If no book ID provided, only get prompts that don't have a book ID
        questUrl += `&withoutBookId=true`;
      }
      
      console.log('[Debug] Quest API URL:', questUrl);
      const questResponse = await fetch(questUrl);
      
      if (questResponse.ok) {
        const questData = await questResponse.json();
        console.log('[Debug] Quest data response:', questData);

        if (questData.success && questData.data && questData.data.length > 0) {
          // The prompt data should be in the response
          const promptRecord = questData.data[0];
          console.log('[Debug] Found prompt record:', promptRecord);
          
          // Check if the prompt is global
          const isPromptGlobal = promptRecord.is_global === true;
          // Return the isGlobal value but don't set it directly to avoid useEffect loops

          // Now we need to fetch the latest version of this prompt
          const promptVersionsUrl = `/api/v11/prompt-versions?promptId=${promptRecord.id}`;
          console.log('[Debug] Fetching prompt versions:', promptVersionsUrl);

          const versionResponse = await fetch(promptVersionsUrl);
          if (versionResponse.ok) {
            const versionData = await versionResponse.json();
            console.log('[Debug] Version data response:', versionData);

            if (versionData.data && versionData.data.length > 0) {
              // Get the content from the latest version
              const savedContent = versionData.data[0].content;
              console.log('[Debug] Found saved quest content:', savedContent ? `${savedContent.substring(0, 50)}...` : 'empty');

              // Get title and notes if available
              const savedTitle = versionData.data[0].title || '';
              const savedNotes = versionData.data[0].notes || '';
              
              // Update the form fields
              setQuestGenerationTitle(savedTitle);
              setQuestGenerationNotes(savedNotes);
              setCurrentQuestGeneration(savedContent);
              
              // Only update the editable field if we're not on the quest_generation tab
              // This prevents overwriting user edits when they're already on the tab
              if (activeTab !== 'quest_generation') {
                setQuestGenerationContent(savedContent);
              }
              
              // Return the prompt info including isGlobal
              return {
                found: true,
                isGlobal: isPromptGlobal
              };
            }
          }
        }
        
        // Handle case where no prompt was found
        setCurrentQuestGeneration('');
        return { found: false };
      }
      
      return { found: false };
    } catch (error) {
      console.error('[Debug] Error fetching quest generation prompt:', error);
      return { found: false };
    }
  }, [activeTab]);

  // Fetch global quest generation prompt
  const fetchGlobalQuestGenerationPrompt = useCallback(async (bookId?: string) => {
    try {
      let url = `/api/v11/prompts?category=quest_generation&is_global=true`;
      
      // Add book ID filter if provided
      if (bookId) {
        url += `&bookId=${encodeURIComponent(bookId)}`;
      }
      
      const globalQuestResponse = await fetch(url);
      if (globalQuestResponse.ok) {
        const globalQuestData = await globalQuestResponse.json();
        if (globalQuestData.success && globalQuestData.data && globalQuestData.data.length > 0) {
          const globalPromptId = globalQuestData.data[0].id;
          const globalVersionResponse = await fetch(`/api/v11/prompt-versions?promptId=${globalPromptId}`);
          if (globalVersionResponse.ok) {
            const globalVersionData = await globalVersionResponse.json();
            if (globalVersionData.data && globalVersionData.data.length > 0) {
              const questContent = globalVersionData.data[0].content;
              const title = globalVersionData.data[0].title || '';
              const notes = globalVersionData.data[0].notes || '';
              
              setGlobalQuestGeneration(questContent);
              
              // If no user-specific prompt was set, use the global one
              if (!currentQuestGeneration) {
                setCurrentQuestGeneration(questContent);
                setQuestGenerationTitle(title);
                setQuestGenerationNotes(notes);
                
                // Since this is a global prompt, set the flag to true
                setIsQuestGenerationGlobal(true);
                
                if (activeTab !== 'quest_generation') {
                  setQuestGenerationContent(questContent);
                }
              }
              
              return true;
            }
          }
        }
      }
      
      setGlobalQuestGeneration(null);
      return false;
    } catch (error) {
      console.error('[Debug] Error fetching global quest generation prompt:', error);
      return false;
    }
  }, [activeTab, currentQuestGeneration]);

  // Fetch user-specific instructions when userId changes or on focus
  const fetchUserInstructions = useCallback(async () => {
    if (!userId) return;

    console.log('[ADMIN DEBUG] fetchUserInstructions called for userId:', userId);
    try {
      // Fetch default greeting instructions
      const greetingResponse = await fetch(`/api/v11/greeting-prompt?userId=${encodeURIComponent(userId)}&greetingType=default`);
      if (greetingResponse.ok) {
        const greetingData = await greetingResponse.json();
        if (greetingData.promptContent) {
          setGreetingContent(greetingData.promptContent);
          setCurrentGreetingInstructions(greetingData.promptContent);
          
          // If this is a user-specific version, also fetch the global version
          if (greetingData.source === 'user') {
            const globalGreetingResponse = await fetch(`/api/v11/greeting-prompt?anonymous=true&greetingType=default`);
            if (globalGreetingResponse.ok) {
              const globalGreetingData = await globalGreetingResponse.json();
              if (globalGreetingData.promptContent && globalGreetingData.source === 'global') {
                setGlobalGreetingInstructions(globalGreetingData.promptContent);
              } else {
                setGlobalGreetingInstructions(null);
              }
            }
          } else if (greetingData.source === 'global') {
            // If the returned data is already a global version, store it in both places
            setGlobalGreetingInstructions(greetingData.promptContent);
          } else {
            setGlobalGreetingInstructions(null);
          }
        }
      }
      
      // Fetch resources greeting instructions
      const resourcesGreetingUrl = `/api/v11/greeting-prompt?userId=${encodeURIComponent(userId)}&greetingType=resources`;
      console.log('[admin] Fetching resources greeting from URL:', resourcesGreetingUrl);
      
      const resourcesGreetingResponse = await fetch(resourcesGreetingUrl);
      console.log('[admin] Resources greeting response status:', resourcesGreetingResponse.status, resourcesGreetingResponse.ok);
      
      if (resourcesGreetingResponse.ok) {
        const resourcesData = await resourcesGreetingResponse.json();
        console.log('[admin] Resources greeting data received:', {
          promptContent: resourcesData.promptContent ? `${resourcesData.promptContent.substring(0, 100)}...` : 'null',
          source: resourcesData.source,
          fullData: resourcesData
        });
        
        if (resourcesData.promptContent) {
          console.log('[admin] Setting resourcesGreetingContent to:', resourcesData.promptContent.substring(0, 100), '...');
          setResourcesGreetingContent(resourcesData.promptContent);
          
          console.log('[admin] Setting currentResourcesGreeting to:', resourcesData.promptContent.substring(0, 100), '...');
          setCurrentResourcesGreeting(resourcesData.promptContent);
          
          console.log('[admin] Resources greeting source field is:', resourcesData.source);
          
          if (resourcesData.source === 'user') {
            console.log('[admin] Source is "user", fetching global resources greeting...');
            const globalResourcesUrl = `/api/v11/greeting-prompt?anonymous=true&greetingType=resources`;
            console.log('[admin] Fetching global resources greeting from URL:', globalResourcesUrl);
            
            const globalResourcesResponse = await fetch(globalResourcesUrl);
            console.log('[admin] Global resources response status:', globalResourcesResponse.status, globalResourcesResponse.ok);
            
            if (globalResourcesResponse.ok) {
              const globalResourcesData = await globalResourcesResponse.json();
              console.log('[admin] Global resources data received:', {
                promptContent: globalResourcesData.promptContent ? `${globalResourcesData.promptContent.substring(0, 100)}...` : 'null',
                source: globalResourcesData.source,
                fullData: globalResourcesData
              });
              
              if (globalResourcesData.promptContent && globalResourcesData.source === 'global') {
                console.log('[admin] Setting globalResourcesGreeting to:', globalResourcesData.promptContent.substring(0, 100), '...');
                setGlobalResourcesGreeting(globalResourcesData.promptContent);
              } else {
                console.log('[admin] Not setting globalResourcesGreeting - promptContent:', !!globalResourcesData.promptContent, 'source:', globalResourcesData.source);
                setGlobalResourcesGreeting(null);
              }
            } else {
              console.log('[admin] Failed to fetch global resources greeting');
            }
          } else if (resourcesData.source === 'global') {
            console.log('[admin] Source is "global", setting globalResourcesGreeting to same content');
            setGlobalResourcesGreeting(resourcesData.promptContent);
          } else {
            console.log('[admin] Source is neither "user" nor "global":', resourcesData.source, '- setting globalResourcesGreeting to null');
            setGlobalResourcesGreeting(null);
          }
        } else {
          console.log('[admin] No promptContent in resourcesData');
        }
      } else {
        console.log('[admin] Failed to fetch resources greeting');
      }
      
      // Fetch future pathways greeting instructions
      const pathwaysGreetingResponse = await fetch(`/api/v11/greeting-prompt?userId=${encodeURIComponent(userId)}&greetingType=future_pathways`);
      if (pathwaysGreetingResponse.ok) {
        const pathwaysData = await pathwaysGreetingResponse.json();
        if (pathwaysData.promptContent) {
          setPathwaysGreetingContent(pathwaysData.promptContent);
          setCurrentPathwaysGreeting(pathwaysData.promptContent);
          
          if (pathwaysData.source === 'user') {
            const globalPathwaysResponse = await fetch(`/api/v11/greeting-prompt?anonymous=true&greetingType=future_pathways`);
            if (globalPathwaysResponse.ok) {
              const globalPathwaysData = await globalPathwaysResponse.json();
              if (globalPathwaysData.promptContent && globalPathwaysData.source === 'global') {
                setGlobalPathwaysGreeting(globalPathwaysData.promptContent);
              } else {
                setGlobalPathwaysGreeting(null);
              }
            }
          } else if (pathwaysData.source === 'global') {
            setGlobalPathwaysGreeting(pathwaysData.promptContent);
          } else {
            setGlobalPathwaysGreeting(null);
          }
        }
      }


      // Fetch AI instructions
      console.log('[ADMIN DEBUG] About to fetch AI instructions for userId:', userId);
      const aiResponse = await fetch(`/api/v11/ai-instructions?userId=${encodeURIComponent(userId)}`);
      console.log('[ADMIN DEBUG] AI instructions fetch response status:', aiResponse.status, aiResponse.ok);
      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        console.log('[ADMIN DEBUG] AI instructions response data:', {
          promptContent: aiData.promptContent ? aiData.promptContent.substring(0, 100) + '...' : 'null',
          source: aiData.source
        });
        if (aiData.promptContent) {
          setAIInstructionsContent(aiData.promptContent);
          setCurrentAIInstructions(aiData.promptContent);
          
          // If this is a user-specific version, also fetch the global version
          if (aiData.source === 'custom') {
            const globalAIResponse = await fetch(`/api/v11/ai-instructions?global=true`);
            if (globalAIResponse.ok) {
              const globalAIData = await globalAIResponse.json();
              if (globalAIData.promptContent && globalAIData.source === 'global') {
                setGlobalAIInstructions(globalAIData.promptContent);
              } else {
                setGlobalAIInstructions(null);
              }
            }
          } else if (aiData.source === 'global') {
            // If the returned data is already a global version, store it in both places
            setGlobalAIInstructions(aiData.promptContent);
          } else {
            setGlobalAIInstructions(null);
          }
        }
      }
      
      // Fetch insights prompts
      const insightsResponse = await fetch(`/api/v11/insights-prompts?userId=${encodeURIComponent(userId)}`);
      if (insightsResponse.ok) {
        const insightsData = await insightsResponse.json();
        if (insightsData.success && insightsData.data) {
          // Store the system prompt
          if (insightsData.data.systemPrompt) {
            setInsightsSystemContent(insightsData.data.systemPrompt);
            setCurrentInsightsSystem(insightsData.data.systemPrompt);
            
            // Check if we should fetch a global system prompt
            if (insightsData.data.systemSource === 'user') {
              const globalInsightsSystemResponse = await fetch(`/api/v11/insights-prompts?global=true&promptType=system`);
              if (globalInsightsSystemResponse.ok) {
                const globalSystemData = await globalInsightsSystemResponse.json();
                if (globalSystemData.success && globalSystemData.data && 
                    globalSystemData.data.systemPrompt && globalSystemData.data.systemSource === 'global') {
                  setGlobalInsightsSystem(globalSystemData.data.systemPrompt);
                } else {
                  setGlobalInsightsSystem(null);
                }
              }
            } else if (insightsData.data.systemSource === 'global') {
              setGlobalInsightsSystem(insightsData.data.systemPrompt);
            } else {
              setGlobalInsightsSystem(null);
            }
          }
          
          // Store the user prompt
          if (insightsData.data.userPrompt) {
            setInsightsUserContent(insightsData.data.userPrompt);
            setCurrentInsightsUser(insightsData.data.userPrompt);
            
            // Check if we should fetch a global user prompt
            if (insightsData.data.userSource === 'user') {
              const globalInsightsUserResponse = await fetch(`/api/v11/insights-prompts?global=true&promptType=user`);
              if (globalInsightsUserResponse.ok) {
                const globalUserData = await globalInsightsUserResponse.json();
                if (globalUserData.success && globalUserData.data && 
                    globalUserData.data.userPrompt && globalUserData.data.userSource === 'global') {
                  setGlobalInsightsUser(globalUserData.data.userPrompt);
                } else {
                  setGlobalInsightsUser(null);
                }
              }
            } else if (insightsData.data.userSource === 'global') {
              setGlobalInsightsUser(insightsData.data.userPrompt);
            } else {
              setGlobalInsightsUser(null);
            }
          }
        }
      }

      // Fetch warm handoff prompt
      const warmHandoffResponse = await fetch(`/api/v11/prompts?name=${encodeURIComponent('Warm Handoff')}&category=${encodeURIComponent('warm_handoff')}&createdBy=${encodeURIComponent(userId)}`);
      if (warmHandoffResponse.ok) {
        const warmHandoffData = await warmHandoffResponse.json();
        if (warmHandoffData.success && warmHandoffData.data && warmHandoffData.data.length > 0) {
          const promptId = warmHandoffData.data[0].id;
          const versionResponse = await fetch(`/api/v11/prompt-versions?promptId=${promptId}`);
          if (versionResponse.ok) {
            const versionData = await versionResponse.json();
            if (versionData.data && versionData.data.length > 0) {
              const warmHandoffContent = versionData.data[0].content;
              setWarmHandoffContent(warmHandoffContent);
              setCurrentWarmHandoff(warmHandoffContent);
              
              // Fetch global warm handoff prompt
              const globalWarmHandoffResponse = await fetch(`/api/v11/prompts?category=warm_handoff&is_global=true`);
              if (globalWarmHandoffResponse.ok) {
                const globalWarmHandoffData = await globalWarmHandoffResponse.json();
                if (globalWarmHandoffData.success && globalWarmHandoffData.data && globalWarmHandoffData.data.length > 0) {
                  const globalPromptId = globalWarmHandoffData.data[0].id;
                  const globalVersionResponse = await fetch(`/api/v11/prompt-versions?promptId=${globalPromptId}`);
                  if (globalVersionResponse.ok) {
                    const globalVersionData = await globalVersionResponse.json();
                    if (globalVersionData.data && globalVersionData.data.length > 0) {
                      setGlobalWarmHandoff(globalVersionData.data[0].content);
                    }
                  }
                } else {
                  setGlobalWarmHandoff(null);
                }
              }
            }
          }
        } else {
          // Check if there's a global warm handoff prompt
          const globalWarmHandoffResponse = await fetch(`/api/v11/prompts?category=warm_handoff&is_global=true`);
          if (globalWarmHandoffResponse.ok) {
            const globalWarmHandoffData = await globalWarmHandoffResponse.json();
            if (globalWarmHandoffData.success && globalWarmHandoffData.data && globalWarmHandoffData.data.length > 0) {
              const globalPromptId = globalWarmHandoffData.data[0].id;
              const globalVersionResponse = await fetch(`/api/v11/prompt-versions?promptId=${globalPromptId}`);
              if (globalVersionResponse.ok) {
                const globalVersionData = await globalVersionResponse.json();
                if (globalVersionData.data && globalVersionData.data.length > 0) {
                  const warmHandoffContent = globalVersionData.data[0].content;
                  setWarmHandoffContent(warmHandoffContent);
                  setCurrentWarmHandoff(warmHandoffContent);
                  setGlobalWarmHandoff(warmHandoffContent);
                }
              }
            }
          }
        }
      }

      // Fetch profile prompts
      console.log('[prompts] Fetching profile prompts for user:', userId);
      const profilePromptsResponse = await fetch(`/api/v11/profile-prompts?userId=${encodeURIComponent(userId)}`);
      if (profilePromptsResponse.ok) {
        const profilePromptsData = await profilePromptsResponse.json();
        console.log('[prompts] RAW PROFILE PROMPTS API RESPONSE:', {
          success: profilePromptsData.success,
          dataKeys: profilePromptsData.data ? Object.keys(profilePromptsData.data) : [],
          analysisSystemLength: profilePromptsData.data?.analysisSystemPrompt?.length || 0,
          analysisSystemPreview: profilePromptsData.data?.analysisSystemPrompt?.substring(0, 100) + '...',
          analysisSystemSource: profilePromptsData.data?.analysisSystemSource,
          analysisUserLength: profilePromptsData.data?.analysisUserPrompt?.length || 0,
          analysisUserSource: profilePromptsData.data?.analysisUserSource
        });
        if (profilePromptsData.success && profilePromptsData.data) {
          // Handle profile analysis prompt
          if (profilePromptsData.data.analysisSystemPrompt || profilePromptsData.data.analysisUserPrompt) {
            // Only update content if it matches what's currently displayed (no unsaved changes)
            const dbSystemContent = profilePromptsData.data.analysisSystemPrompt || '';
            const dbUserContent = profilePromptsData.data.analysisUserPrompt || '';
            
            // Check if user has unsaved changes by comparing current content with what would be loaded
            const hasUnsavedSystemChanges = profileAnalysisSystemContent && 
              profileAnalysisSystemContent !== dbSystemContent && 
              profileAnalysisSystemContent !== currentProfileAnalysisSystem;
            
            const hasUnsavedUserChanges = profileAnalysisUserContent && 
              profileAnalysisUserContent !== dbUserContent && 
              profileAnalysisUserContent !== currentProfileAnalysisUser;

            console.log('[prompts] Profile analysis content update check:', {
              hasUnsavedSystemChanges,
              hasUnsavedUserChanges,
              currentSystemLength: profileAnalysisSystemContent?.length || 0,
              dbSystemLength: dbSystemContent.length,
              currentUserLength: profileAnalysisUserContent?.length || 0,
              dbUserLength: dbUserContent.length
            });

            if (!hasUnsavedSystemChanges) {
              setProfileAnalysisSystemContent(dbSystemContent);
              setCurrentProfileAnalysisSystem(dbSystemContent);
            } else {
              console.log('[prompts] Skipping profile analysis system content update - user has unsaved changes');
            }

            if (!hasUnsavedUserChanges) {
              setProfileAnalysisUserContent(dbUserContent);
              setCurrentProfileAnalysisUser(dbUserContent);
            } else {
              console.log('[prompts] Skipping profile analysis user content update - user has unsaved changes');
            }

            // Set global versions from the API response
            if (profilePromptsData.data.globalAnalysisSystemPrompt) {
              setGlobalProfileAnalysisSystem(profilePromptsData.data.globalAnalysisSystemPrompt);
            }

            if (profilePromptsData.data.globalAnalysisUserPrompt) {
              setGlobalProfileAnalysisUser(profilePromptsData.data.globalAnalysisUserPrompt);
            }
          }

          // Handle profile merge prompt
          if (profilePromptsData.data.mergeSystemPrompt || profilePromptsData.data.mergeUserPrompt) {
            // Only update content if it matches what's currently displayed (no unsaved changes)
            const dbMergeSystemContent = profilePromptsData.data.mergeSystemPrompt || '';
            const dbMergeUserContent = profilePromptsData.data.mergeUserPrompt || '';
            
            // Check if user has unsaved changes by comparing current content with what would be loaded
            const hasUnsavedMergeSystemChanges = profileMergeSystemContent && 
              profileMergeSystemContent !== dbMergeSystemContent && 
              profileMergeSystemContent !== currentProfileMergeSystem;
            
            const hasUnsavedMergeUserChanges = profileMergeUserContent && 
              profileMergeUserContent !== dbMergeUserContent && 
              profileMergeUserContent !== currentProfileMergeUser;

            console.log('[prompts] Profile merge content update check:', {
              hasUnsavedMergeSystemChanges,
              hasUnsavedMergeUserChanges,
              currentMergeSystemLength: profileMergeSystemContent?.length || 0,
              dbMergeSystemLength: dbMergeSystemContent.length,
              currentMergeUserLength: profileMergeUserContent?.length || 0,
              dbMergeUserLength: dbMergeUserContent.length
            });

            // Handle system prompt
            if (!hasUnsavedMergeSystemChanges) {
              setProfileMergeSystemContent(dbMergeSystemContent);
              setCurrentProfileMergeSystem(dbMergeSystemContent);
            } else {
              console.log('[prompts] Skipping profile merge system content update - user has unsaved changes');
            }

            // Set global versions from the API response
            if (profilePromptsData.data.globalMergeSystemPrompt) {
              setGlobalProfileMergeSystem(profilePromptsData.data.globalMergeSystemPrompt);
            }

            // Handle user prompt
            if (!hasUnsavedMergeUserChanges) {
              setProfileMergeUserContent(dbMergeUserContent);
              setCurrentProfileMergeUser(dbMergeUserContent);
            } else {
              console.log('[prompts] Skipping profile merge user content update - user has unsaved changes');
            }

            // Set global versions from the API response
            if (profilePromptsData.data.globalMergeUserPrompt) {
              setGlobalProfileMergeUser(profilePromptsData.data.globalMergeUserPrompt);
            }
          }
        }
      }

      // Global prompts are now fetched in the main API call above

      // Fetch quest generation prompt using our new dedicated function
      // First try to fetch the user-specific prompt
      const userQuestPromptResult = await fetchQuestGenerationPrompt(userId);
      
      // Set the global flag if a prompt was found
      if (userQuestPromptResult.found) {
        setIsQuestGenerationGlobal(userQuestPromptResult.isGlobal || false);
      }
      
      // If no user-specific prompt was found, try to fetch the global prompt
      if (!userQuestPromptResult.found) {
        await fetchGlobalQuestGenerationPrompt();
      }
    } catch (error) {
      console.error('Error fetching user instructions:', error);
    }
  }, [userId, activeTab, setGreetingContent, setAIInstructionsContent, setInsightsSystemContent, setInsightsUserContent, setWarmHandoffContent, setQuestGenerationContent, setCurrentQuestGeneration, fetchQuestGenerationPrompt, fetchGlobalQuestGenerationPrompt]);

  // Fetch when userId changes
  useEffect(() => {
    if (userId) {
      fetchUserInstructions();
    }
  }, [userId, fetchUserInstructions]);

  // Refresh data when window gets focus (like when returning from history page)
  useEffect(() => {
    const handleFocus = () => {
      if (userId) {
        console.log('Window focused, refreshing instructions data');
        fetchUserInstructions();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [userId, fetchUserInstructions]);

  const copyUserId = () => {
    if (currentUserId) {
      navigator.clipboard.writeText(currentUserId);
      setUserId(currentUserId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGreetingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ message: 'Processing...' });

    try {
      let content, title, notes, isGlobal, setCurrentFn;
      let greetingType: 'default' | 'resources' | 'future_pathways';
      
      switch (activeGreetingTab) {
        case 'resources':
          content = resourcesGreetingContent;
          title = resourcesGreetingTitle;
          notes = resourcesGreetingNotes;
          isGlobal = isResourcesGreetingGlobal;
          setCurrentFn = setCurrentResourcesGreeting;
          greetingType = 'resources';
          break;
        case 'future_pathways':
          content = pathwaysGreetingContent;
          title = pathwaysGreetingTitle;
          notes = pathwaysGreetingNotes;
          isGlobal = isPathwaysGreetingGlobal;
          setCurrentFn = setCurrentPathwaysGreeting;
          greetingType = 'future_pathways';
          break;
        default:
          content = greetingContent;
          title = greetingTitle;
          notes = greetingNotes;
          isGlobal = isGreetingGlobal;
          setCurrentFn = setCurrentGreetingInstructions;
          greetingType = 'default';
      }
      
      const result = await setupGreetingForUser(
        userId,
        content,
        title || undefined,
        notes || undefined,
        isGlobal,
        greetingType
      );
      setStatus({
        success: result.success,
        message: result.message
      });

      // Update current instructions after successful update
      if (result.success) {
        setCurrentFn(content);
      }
    } catch (error) {
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAIInstructionsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ message: 'Processing...' });

    try {
      const result = await setupAIInstructionsForUser(
        userId,
        aiInstructionsContent,
        aiInstructionsTitle || undefined,
        aiInstructionsNotes || undefined,
        isAIInstructionsGlobal // Pass the global flag
      );
      setStatus({
        success: result.success,
        message: result.message
      });

      // Update current instructions after successful update
      if (result.success) {
        setCurrentAIInstructions(aiInstructionsContent);
      }
    } catch (error) {
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInsightsSystemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ message: 'Processing...' });

    console.log('Submitting insights system prompt with global flag:', {
      isGlobal: isInsightsSystemGlobal, 
      isGlobalType: typeof isInsightsSystemGlobal
    });

    try {
      const result = await setupInsightsSystemPromptForUser(
        userId,
        insightsSystemContent,
        insightsSystemTitle || undefined,
        insightsSystemNotes || undefined,
        isInsightsSystemGlobal // Pass the global flag
      );
      setStatus({
        success: result.success,
        message: result.message
      });

      // Update current instructions after successful update
      if (result.success) {
        setCurrentInsightsSystem(insightsSystemContent);
      }
    } catch (error) {
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInsightsUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ message: 'Processing...' });

    try {
      const result = await setupInsightsUserPromptForUser(
        userId,
        insightsUserContent,
        insightsUserTitle || undefined,
        insightsUserNotes || undefined,
        isInsightsUserGlobal // Pass the global flag
      );
      setStatus({
        success: result.success,
        message: result.message
      });

      // Update current instructions after successful update
      if (result.success) {
        setCurrentInsightsUser(insightsUserContent);
      }
    } catch (error) {
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWarmHandoffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ message: 'Processing...' });

    try {
      const result = await setupWarmHandoffPromptForUser(
        userId,
        warmHandoffContent,
        warmHandoffTitle || undefined,
        warmHandoffNotes || undefined,
        isWarmHandoffGlobal // Pass the global flag
      );
      setStatus({
        success: result.success,
        message: result.message
      });

      // Update current instructions after successful update
      if (result.success) {
        setCurrentWarmHandoff(warmHandoffContent);
      }
    } catch (error) {
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuestGenerationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ message: 'Processing...' });

    try {
      // Get the current value directly from the form element for safety
      const formElement = e.target as HTMLFormElement;
      const textareaElement = formElement.querySelector('#questGenerationContent') as HTMLTextAreaElement;

      // Use the form value, fallback to state, and ensure it's at least an empty string
      const content = (textareaElement?.value !== undefined ? textareaElement.value : questGenerationContent) || '';

      console.log('Submitting quest generation content:', {
        formValue: textareaElement?.value,
        stateValue: questGenerationContent,
        finalContent: content
      });

      const result = await setupQuestGenerationPromptForUser(
        userId,
        content,
        questGenerationTitle || undefined,
        questGenerationNotes || undefined,
        isBookSpecificPrompt ? selectedBookId : undefined, // Pass book ID only if book-specific
        isQuestGenerationGlobal // Pass the global flag
      );
      setStatus({
        success: result.success,
        message: result.message
      });

      // Update current instructions after successful update
      if (result.success) {
        console.log('[Debug] Successfully saved quest generation prompt');

        // Fetch the latest version to display in the "Current" section
        if (result.promptId) {
          console.log('[Debug] Fetching latest version for promptId:', result.promptId);

          try {
            const versionResponse = await fetch(`/api/v11/prompt-versions?promptId=${result.promptId}`);
            if (versionResponse.ok) {
              const versionData = await versionResponse.json();
              console.log('[Debug] Latest version data:', versionData);

              if (versionData.data && versionData.data.length > 0) {
                const latestContent = versionData.data[0].content;
                console.log('[Debug] Setting currentQuestGeneration to latest saved version');
                setCurrentQuestGeneration(latestContent);
              }
            }
          } catch (versionError) {
            console.error('Error fetching latest version:', versionError);
          }
        } else {
          // Fallback if no promptId in result
          console.log('[Debug] No promptId in result, using submitted content as fallback');
          setCurrentQuestGeneration(content);
        }
      }
    } catch (error) {
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileAnalysisSystemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ message: 'Processing...' });

    console.log('[prompts] handleProfileAnalysisSystemSubmit - saving with global flag:', {
      isProfileAnalysisSystemGlobal,
      globalFlagType: typeof isProfileAnalysisSystemGlobal,
      userId,
      contentLength: profileAnalysisSystemContent?.length
    });

    try {
      const result = await setupProfileAnalysisSystemPromptForUser(
        userId,
        profileAnalysisSystemContent,
        profileAnalysisSystemTitle || undefined,
        profileAnalysisSystemNotes || undefined,
        isProfileAnalysisSystemGlobal // Pass the global flag
      );
      setStatus({
        success: result.success,
        message: result.message
      });

      // Update current instructions after successful update
      if (result.success) {
        setCurrentProfileAnalysisSystem(profileAnalysisSystemContent);
      }
    } catch (error) {
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileAnalysisUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ message: 'Processing...' });

    try {
      const result = await setupProfileAnalysisUserPromptForUser(
        userId,
        profileAnalysisUserContent,
        profileAnalysisUserTitle || undefined,
        profileAnalysisUserNotes || undefined,
        isProfileAnalysisUserGlobal // Pass the global flag
      );
      setStatus({
        success: result.success,
        message: result.message
      });

      // Update current instructions after successful update
      if (result.success) {
        setCurrentProfileAnalysisUser(profileAnalysisUserContent);
      }
    } catch (error) {
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileMergeSystemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ message: 'Processing...' });

    try {
      const result = await setupProfileMergeSystemPromptForUser(
        userId,
        profileMergeSystemContent,
        profileMergeSystemTitle || undefined,
        profileMergeSystemNotes || undefined,
        isProfileMergeSystemGlobal // Pass the global flag
      );
      setStatus({
        success: result.success,
        message: result.message
      });

      // Update current instructions after successful update
      if (result.success) {
        setCurrentProfileMergeSystem(profileMergeSystemContent);
      }
    } catch (error) {
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileMergeUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ message: 'Processing...' });

    try {
      const result = await setupProfileMergeUserPromptForUser(
        userId,
        profileMergeUserContent,
        profileMergeUserTitle || undefined,
        profileMergeUserNotes || undefined,
        isProfileMergeUserGlobal // Pass the global flag
      );
      setStatus({
        success: result.success,
        message: result.message
      });

      // Update current instructions after successful update
      if (result.success) {
        setCurrentProfileMergeUser(profileMergeUserContent);
      }
    } catch (error) {
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  // Create ref outside of useEffect to track initial mount
  const isInitialQuestMount = React.useRef(true);

  // Effects for loading book-specific prompt when book selection changes
  useEffect(() => {
    const loadBookSpecificPrompt = async () => {
      if (isBookSpecificPrompt && selectedBookId && userId) {
        setLoading(true);
        setStatus({ message: 'Loading book-specific prompt...' });

        try {
          // Use our new function to fetch book-specific prompt
          const userPromptResult = await fetchQuestGenerationPrompt(userId, selectedBookId);
          
          // Set the global flag based on the result
          if (userPromptResult.found) {
            setIsQuestGenerationGlobal(userPromptResult.isGlobal || false);
          }
          
          // If no user-specific book prompt was found, check for global book prompt
          if (!userPromptResult.found) {
            const globalPromptFound = await fetchGlobalQuestGenerationPrompt(selectedBookId);
            
            // If no global book prompt was found either, set defaults for creating a new one
            if (!globalPromptFound) {
              setQuestGenerationContent('');
              setQuestGenerationTitle(`Book-specific prompt for ${selectedBookId}`);
              setQuestGenerationNotes('Created for specific book');
              setIsQuestGenerationGlobal(false);
              setStatus({
                message: 'No existing book-specific prompt found. Creating a new one.'
              });
            } else {
              setStatus({
                success: true,
                message: `Loaded global book-specific prompt for book ID: ${selectedBookId}`
              });
            }
          } else {
            setStatus({
              success: true,
              message: `Loaded user-specific prompt for book ID: ${selectedBookId}`
            });
          }
        } catch (error) {
          setStatus({
            success: false,
            message: error instanceof Error ? error.message : 'An unknown error occurred'
          });
        } finally {
          setLoading(false);
        }
      } else if (!isBookSpecificPrompt && userId) {
        // If book-specific is turned off, load general quest generation prompt
        setLoading(true);
        setStatus({ message: 'Loading general quest generation prompt...' });
        
        try {
          // Use our new function to fetch general prompt
          const userPromptResult = await fetchQuestGenerationPrompt(userId);
          
          // Set the global flag based on the result
          if (userPromptResult.found) {
            setIsQuestGenerationGlobal(userPromptResult.isGlobal || false);
          }
          
          // If no user-specific prompt was found, check for global prompt
          if (!userPromptResult.found) {
            const globalPromptFound = await fetchGlobalQuestGenerationPrompt();
            
            // If no global prompt was found either, set defaults for creating a new one
            if (!globalPromptFound) {
              setQuestGenerationContent('');
              setQuestGenerationTitle('General quest generation prompt');
              setQuestGenerationNotes('Default quest generation');
              setIsQuestGenerationGlobal(false);
              setStatus({
                message: 'No existing quest generation prompt found. Creating a new one.'
              });
            } else {
              setStatus({
                success: true,
                message: 'Loaded global quest generation prompt'
              });
            }
          } else {
            setStatus({
              success: true,
              message: 'Loaded user-specific quest generation prompt'
            });
          }
        } catch (error) {
          setStatus({
            success: false,
            message: error instanceof Error ? error.message : 'An unknown error occurred'
          });
        } finally {
          setLoading(false);
        }
      }
    };

    // We only run this when on the quest_generation tab and during initial mount
    if (activeTab === 'quest_generation' && userId && isInitialQuestMount.current) {
      isInitialQuestMount.current = false;
      loadBookSpecificPrompt();
    }
  }, [isBookSpecificPrompt, selectedBookId, userId, activeTab, fetchQuestGenerationPrompt, fetchGlobalQuestGenerationPrompt]);

  const openHistoryInNewTab = () => {
    if (userId) {
      let historyType = '';
      let bookParam = '';

      if (activeTab === 'ai_instructions') {
        historyType = '&type=ai_instructions';
      } else if (activeTab === 'insights_system') {
        historyType = '&type=insights_system';
      } else if (activeTab === 'insights_user') {
        historyType = '&type=insights_user';
      } else if (activeTab === 'warm_handoff') {
        historyType = '&type=warm_handoff';
      } else if (activeTab === 'quest_generation') {
        historyType = '&type=quest_generation';
        // Add book ID parameter if it's a book-specific prompt
        if (isBookSpecificPrompt && selectedBookId) {
          bookParam = `&bookId=${encodeURIComponent(selectedBookId)}`;
        }
      }

      window.open(`/chatbotV11/admin/history?userId=${encodeURIComponent(userId)}${historyType}${bookParam}`, '_blank');
    } else {
      setStatus({
        success: false,
        message: 'Please enter a User ID first'
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 mb-8">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('greeting')}
              className={`py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm ${activeTab === 'greeting'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
              Custom Greeting
            </button>
            <button
              onClick={() => setActiveTab('ai_instructions')}
              className={`py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm ${activeTab === 'ai_instructions'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
              AI Instructions
            </button>
            <button
              onClick={() => setActiveTab('insights_system')}
              className={`py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm ${activeTab === 'insights_system'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
              Insights Prompts
            </button>
            <button
              onClick={() => setActiveTab('warm_handoff')}
              className={`py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm ${activeTab === 'warm_handoff'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
              Warm Handoff
            </button>
            <button
              onClick={() => {
                console.log('[Debug] Switching to quest_generation tab');
                const prevTab = activeTab;
                setActiveTab('quest_generation');
                console.log('[Debug] Current quest content display value:', currentQuestGeneration ? `${currentQuestGeneration.substring(0, 50)}...` : 'empty');
                console.log('[Debug] Previous active tab:', prevTab);
              }}
              className={`py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm ${activeTab === 'quest_generation'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
              Quest Generator
            </button>
            <button
              onClick={() => setActiveTab('profile_analysis')}
              className={`py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm ${activeTab === 'profile_analysis'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
              Profile Analysis
            </button>
            <button
              onClick={() => setActiveTab('profile_merge')}
              className={`py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm ${activeTab === 'profile_merge'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
              Profile Merge
            </button>
            <button
              onClick={() => {
                if (userId) {
                  // Pass the userId to edit-quests page
                  router.push(`/chatbotV11/admin/edit-quests?userId=${encodeURIComponent(userId)}`);
                } else {
                  setStatus({
                    success: false,
                    message: 'Please enter a User ID first'
                  });
                }
              }}
              className="py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Edit Quests
            </button>
          </nav>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">
            {activeTab === 'greeting'
              ? 'Save Custom Greeting System Prompt'
              : activeTab === 'ai_instructions'
                ? 'Save AI Instructions'
                : activeTab === 'insights_system'
                  ? activeInsightsTab === 'system'
                    ? 'Save Insights System Prompt'
                    : 'Save Insights User Prompt'
                  : activeTab === 'warm_handoff'
                    ? 'Save Warm Handoff Prompt'
                    : activeTab === 'quest_generation'
                      ? 'Save Quest Generation Prompt'
                      : activeTab === 'profile_analysis'
                        ? activeProfileAnalysisTab === 'system'
                          ? 'Save Profile Analysis System Prompt'
                          : 'Save Profile Analysis User Prompt'
                        : activeProfileMergeTab === 'system'
                          ? 'Save Profile Merge System Prompt'
                          : 'Save Profile Merge User Prompt'
            }
          </h2>
          <button
            onClick={openHistoryInNewTab}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            View History
          </button>
        </div>

        {status.message && (
          <div
            className={`p-4 mb-6 rounded-md ${status.success === undefined
              ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              : status.success
                ? 'bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-400'
              }`}
          >
            {status.message}
          </div>
        )}

        {/* Greeting Tab Content */}
        {activeTab === 'greeting' && (
          <div>
            {/* Sub-tabs for greeting types */}
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
              <nav className="flex space-x-4" aria-label="Greeting type tabs">
                <button
                  type="button"
                  onClick={() => setActiveGreetingTab('default')}
                  className={`py-2 px-1 inline-flex items-center border-b-2 font-medium text-sm ${
                    activeGreetingTab === 'default'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Default Greeting System Prompt
                </button>
                <button
                  type="button"
                  onClick={() => setActiveGreetingTab('resources')}
                  className={`py-2 px-1 inline-flex items-center border-b-2 font-medium text-sm ${
                    activeGreetingTab === 'resources'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Resources Greeting System Prompt
                </button>
                <button
                  type="button"
                  onClick={() => setActiveGreetingTab('future_pathways')}
                  className={`py-2 px-1 inline-flex items-center border-b-2 font-medium text-sm ${
                    activeGreetingTab === 'future_pathways'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Future Pathways Greeting System Prompt
                </button>
              </nav>
            </div>
            
            <form onSubmit={handleGreetingSubmit} className="space-y-6">
              <div>
                <label htmlFor="userId" className="block text-sm font-medium mb-1">
                  User ID
                </label>
                <input
                  type="text"
                  id="userId"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>

              <div>
                <label htmlFor="greetingTitle" className="block text-sm font-medium mb-1">
                  Version Title
                </label>
                <input
                  type="text"
                  id="greetingTitle"
                  value={
                    activeGreetingTab === 'resources' ? resourcesGreetingTitle :
                    activeGreetingTab === 'future_pathways' ? pathwaysGreetingTitle :
                    greetingTitle
                  }
                  onChange={(e) => {
                    if (activeGreetingTab === 'resources') setResourcesGreetingTitle(e.target.value);
                    else if (activeGreetingTab === 'future_pathways') setPathwaysGreetingTitle(e.target.value);
                    else setGreetingTitle(e.target.value);
                  }}
                  placeholder={
                    activeGreetingTab === 'resources' ? "E.g., Resource-focused greeting" :
                    activeGreetingTab === 'future_pathways' ? "E.g., Future pathways greeting" :
                    "E.g., Warm greeting with open-ended question"
                  }
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  A short descriptive title for this prompt version
                </p>
              </div>

              <div>
                <label htmlFor="greetingNotes" className="block text-sm font-medium mb-1">
                  Notes
                </label>
                <textarea
                  id="greetingNotes"
                  value={
                    activeGreetingTab === 'resources' ? resourcesGreetingNotes :
                    activeGreetingTab === 'future_pathways' ? pathwaysGreetingNotes :
                    greetingNotes
                  }
                  onChange={(e) => {
                    if (activeGreetingTab === 'resources') setResourcesGreetingNotes(e.target.value);
                    else if (activeGreetingTab === 'future_pathways') setPathwaysGreetingNotes(e.target.value);
                    else setGreetingNotes(e.target.value);
                  }}
                  rows={2}
                  placeholder="Optional comments about this version"
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Global flag checkbox */}
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="isGreetingGlobal"
                  checked={
                    activeGreetingTab === 'resources' ? isResourcesGreetingGlobal :
                    activeGreetingTab === 'future_pathways' ? isPathwaysGreetingGlobal :
                    isGreetingGlobal
                  }
                  onChange={(e) => {
                    if (activeGreetingTab === 'resources') setIsResourcesGreetingGlobal(e.target.checked);
                    else if (activeGreetingTab === 'future_pathways') setIsPathwaysGreetingGlobal(e.target.checked);
                    else setIsGreetingGlobal(e.target.checked);
                  }}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="isGreetingGlobal" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                  Set as global for all users who do not have custom greetings
                </label>
                <p className="ml-4 text-sm text-gray-500 dark:text-gray-400">
                  This will make this greeting system prompt the default for any user without a personal greeting system prompt
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <label htmlFor="greetingContent" className="block text-sm font-medium mb-1">
                    {activeGreetingTab === 'resources' ? 'Resources Greeting System Prompt' :
                     activeGreetingTab === 'future_pathways' ? 'Future Pathways Greeting System Prompt' :
                     'Default Greeting System Prompt'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const content = activeGreetingTab === 'resources' ? resourcesGreetingContent :
                                    activeGreetingTab === 'future_pathways' ? pathwaysGreetingContent :
                                    greetingContent;
                      navigator.clipboard.writeText(content);
                      if (activeGreetingTab === 'resources') {
                        setCopiedResourcesGreeting(true);
                        setTimeout(() => setCopiedResourcesGreeting(false), 2000);
                      } else if (activeGreetingTab === 'future_pathways') {
                        setCopiedPathwaysGreeting(true);
                        setTimeout(() => setCopiedPathwaysGreeting(false), 2000);
                      } else {
                        setCopiedGreeting(true);
                        setTimeout(() => setCopiedGreeting(false), 2000);
                      }
                    }}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                    title="Copy to clipboard"
                  >
                    {(activeGreetingTab === 'resources' ? copiedResourcesGreeting :
                      activeGreetingTab === 'future_pathways' ? copiedPathwaysGreeting :
                      copiedGreeting) ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
                  </button>
                </div>
                <textarea
                  id="greetingContent"
                  value={
                    activeGreetingTab === 'resources' ? resourcesGreetingContent :
                    activeGreetingTab === 'future_pathways' ? pathwaysGreetingContent :
                    greetingContent
                  }
                  onChange={(e) => {
                    if (activeGreetingTab === 'resources') setResourcesGreetingContent(e.target.value);
                    else if (activeGreetingTab === 'future_pathways') setPathwaysGreetingContent(e.target.value);
                    else setGreetingContent(e.target.value);
                  }}
                  rows={12}
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  required
                />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {activeGreetingTab === 'resources' ? 'This system prompt will be sent to the AI when users access chat through the Resources section.' :
                   activeGreetingTab === 'future_pathways' ? 'This system prompt will be sent to the AI when users access chat through the Future Pathways section.' :
                   'This system prompt will be sent to the AI for the initial greeting when the user starts a regular chat session.'}
                </p>
              </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Processing...' : `Save ${activeGreetingTab === 'resources' ? 'Resources' : activeGreetingTab === 'future_pathways' ? 'Future Pathways' : 'Default'} Greeting System Prompt`}
              </button>
            </div>

              <div className="mt-8">
                {/* Display current prompt */}
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-medium">
                    {activeGreetingTab === 'resources' ? 
                      (globalResourcesGreeting ? 'User-Specific Resources Greeting System Prompt' : 'Global Default Resources Greeting System Prompt') :
                     activeGreetingTab === 'future_pathways' ?
                      (globalPathwaysGreeting ? 'User-Specific Future Pathways Greeting System Prompt' : 'Global Default Future Pathways Greeting System Prompt') :
                      (globalGreetingInstructions ? 'User-Specific Greeting System Prompt' : 'Global Default Greeting System Prompt')
                    }
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      const currentContent = activeGreetingTab === 'resources' ? currentResourcesGreeting :
                                           activeGreetingTab === 'future_pathways' ? currentPathwaysGreeting :
                                           currentGreetingInstructions;
                      navigator.clipboard.writeText(currentContent);
                      if (activeGreetingTab === 'resources') {
                        setCopiedCurrentResourcesGreeting(true);
                        setTimeout(() => setCopiedCurrentResourcesGreeting(false), 2000);
                      } else if (activeGreetingTab === 'future_pathways') {
                        setCopiedCurrentPathwaysGreeting(true);
                        setTimeout(() => setCopiedCurrentPathwaysGreeting(false), 2000);
                      } else {
                        setCopiedCurrentGreeting(true);
                        setTimeout(() => setCopiedCurrentGreeting(false), 2000);
                      }
                    }}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                    title="Copy to clipboard"
                  >
                    {(activeGreetingTab === 'resources' ? copiedCurrentResourcesGreeting :
                      activeGreetingTab === 'future_pathways' ? copiedCurrentPathwaysGreeting :
                      copiedCurrentGreeting) ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
                  </button>
                </div>
              
              {/* Side-by-side layout when both user and global versions exist */}
                {/* Side-by-side layout when both user and global versions exist */}
                {(activeGreetingTab === 'resources' ? globalResourcesGreeting :
                  activeGreetingTab === 'future_pathways' ? globalPathwaysGreeting :
                  globalGreetingInstructions) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-2 text-sm font-medium text-blue-800 dark:text-blue-200 rounded-t-md border border-blue-200 dark:border-blue-800 border-b-0">
                        User-Specific Version
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap h-[300px] overflow-y-auto">
                        {activeGreetingTab === 'resources' ? currentResourcesGreeting :
                         activeGreetingTab === 'future_pathways' ? currentPathwaysGreeting :
                         currentGreetingInstructions}
                      </div>
                    </div>
                    <div>
                      <div className="bg-green-50 dark:bg-green-900/20 p-2 text-sm font-medium text-green-800 dark:text-green-200 rounded-t-md border border-green-200 dark:border-green-800 border-b-0">
                        Global Default Version
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap h-[300px] overflow-y-auto">
                        {activeGreetingTab === 'resources' ? globalResourcesGreeting :
                         activeGreetingTab === 'future_pathways' ? globalPathwaysGreeting :
                         globalGreetingInstructions}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Single version display when only one version exists
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap">
                    {activeGreetingTab === 'resources' ? currentResourcesGreeting :
                     activeGreetingTab === 'future_pathways' ? currentPathwaysGreeting :
                     currentGreetingInstructions}
                  </div>
                )}
              </div>
            </form>
          </div>
        )}

        {/* AI Instructions Tab Content */}
        {activeTab === 'ai_instructions' && (
          <form onSubmit={handleAIInstructionsSubmit} className="space-y-6">
            <div>
              <label htmlFor="userId" className="block text-sm font-medium mb-1">
                User ID
              </label>
              <input
                type="text"
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                required
              />
            </div>

            <div>
              <label htmlFor="aiInstructionsTitle" className="block text-sm font-medium mb-1">
                Version Title
              </label>
              <input
                type="text"
                id="aiInstructionsTitle"
                value={aiInstructionsTitle}
                onChange={(e) => setAIInstructionsTitle(e.target.value)}
                placeholder="E.g., Book discussion with detailed character analysis"
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                A short descriptive title for this AI instructions version
              </p>
            </div>

            <div>
              <label htmlFor="aiInstructionsNotes" className="block text-sm font-medium mb-1">
                Notes
              </label>
              <textarea
                id="aiInstructionsNotes"
                value={aiInstructionsNotes}
                onChange={(e) => setAIInstructionsNotes(e.target.value)}
                rows={2}
                placeholder="Optional comments about this version"
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Global flag checkbox */}
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="isAIInstructionsGlobal"
                checked={isAIInstructionsGlobal}
                onChange={(e) => setIsAIInstructionsGlobal(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <label htmlFor="isAIInstructionsGlobal" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                Set as global for all users who do not have custom instructions
              </label>
              <p className="ml-4 text-sm text-gray-500 dark:text-gray-400">
                This will make these instructions the default for any user without personal instructions
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center">
                <label htmlFor="aiInstructionsContent" className="block text-sm font-medium mb-1">
                  AI Instructions
                </label>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(aiInstructionsContent);
                    setCopiedAIInstructions(true);
                    setTimeout(() => setCopiedAIInstructions(false), 2000);
                  }}
                  className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                  title="Copy to clipboard"
                >
                  {copiedAIInstructions ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
                </button>
              </div>
              <textarea
                id="aiInstructionsContent"
                value={aiInstructionsContent}
                onChange={(e) => setAIInstructionsContent(e.target.value)}
                rows={20}
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                required
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                These core instructions will control how the AI behaves when discussing books with users.
              </p>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Set AI Instructions'}
              </button>
            </div>

            <div className="mt-8">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium">
                  {globalAIInstructions ? 'User-Specific AI Instructions' : 'Global Default AI Instructions'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(currentAIInstructions);
                    setCopiedCurrentAIInstructions(true);
                    setTimeout(() => setCopiedCurrentAIInstructions(false), 2000);
                  }}
                  className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                  title="Copy to clipboard"
                >
                  {copiedCurrentAIInstructions ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
                </button>
              </div>
              
              {/* Side-by-side layout when both user and global versions exist */}
              {globalAIInstructions ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-2 text-sm font-medium text-blue-800 dark:text-blue-200 rounded-t-md border border-blue-200 dark:border-blue-800 border-b-0">
                      User-Specific Version
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm h-[300px] overflow-y-auto">
                      {currentAIInstructions}
                    </div>
                  </div>
                  <div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-2 text-sm font-medium text-green-800 dark:text-green-200 rounded-t-md border border-green-200 dark:border-green-800 border-b-0">
                      Global Default Version
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm h-[300px] overflow-y-auto">
                      {globalAIInstructions}
                    </div>
                  </div>
                </div>
              ) : (
                // Single version display when only one version exists
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm">
                  {currentAIInstructions}
                </div>
              )}
            </div>
          </form>
        )}

        {/* Insights Prompts Tab Content (Combined System and User) */}
        {activeTab === 'insights_system' && (
          <div className="space-y-6">
            <div>
              <label htmlFor="userId" className="block text-sm font-medium mb-1">
                User ID
              </label>
              <input
                type="text"
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                required
              />
            </div>

            {/* Tabs for System vs User prompt */}
            <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
              <div className="flex">
                <button
                  type="button"
                  onClick={() => setActiveInsightsTab('system')}
                  className={`py-2 px-4 border-b-2 font-medium text-sm ${
                    activeInsightsTab === 'system'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  System Prompt
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInsightsTab('user')}
                  className={`py-2 px-4 border-b-2 font-medium text-sm ${
                    activeInsightsTab === 'user'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  User Prompt
                </button>
              </div>
            </div>

            {/* System Prompt Content */}
            {activeInsightsTab === 'system' && (
              <form onSubmit={handleInsightsSystemSubmit} className="space-y-6">
                <div>
                  <label htmlFor="insightsSystemTitle" className="block text-sm font-medium mb-1">
                    System Prompt Version Title
                  </label>
                  <input
                    type="text"
                    id="insightsSystemTitle"
                    value={insightsSystemTitle}
                    onChange={(e) => setInsightsSystemTitle(e.target.value)}
                    placeholder="E.g., Trauma-informed insights system prompt with enhanced privacy"
                    className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    A short descriptive title for this prompt version
                  </p>
                </div>

                <div>
                  <label htmlFor="insightsSystemNotes" className="block text-sm font-medium mb-1">
                    Notes
                  </label>
                  <textarea
                    id="insightsSystemNotes"
                    value={insightsSystemNotes}
                    onChange={(e) => setInsightsSystemNotes(e.target.value)}
                    rows={2}
                    placeholder="Optional comments about this version"
                    className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center">
                    <label htmlFor="insightsSystemContent" className="block text-sm font-medium mb-1">
                      Insights System Prompt
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(insightsSystemContent);
                        setCopiedInsightsSystem(true);
                        setTimeout(() => setCopiedInsightsSystem(false), 2000);
                      }}
                      className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                      title="Copy to clipboard"
                    >
                      {copiedInsightsSystem ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
                    </button>
                  </div>
                  <textarea
                    id="insightsSystemContent"
                    value={insightsSystemContent}
                    onChange={(e) => setInsightsSystemContent(e.target.value)}
                    rows={20}
                    className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    required
                  />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    This system prompt provides detailed instructions and is sent to Claude before the conversation content.
                  </p>
                </div>

                {/* Global flag checkbox */}
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="isInsightsSystemGlobal"
                    checked={isInsightsSystemGlobal}
                    onChange={(e) => setIsInsightsSystemGlobal(e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <label htmlFor="isInsightsSystemGlobal" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                    Set as global for all users who do not have custom system prompts
                  </label>
                  <p className="ml-4 text-sm text-gray-500 dark:text-gray-400">
                    This will make this system prompt the default for any user without a personal system prompt
                  </p>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Save Insights System Prompt'}
                  </button>
                </div>

                <div className="mt-8">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-medium">
                      {globalInsightsSystem ? 'User-Specific Insights System Prompt' : 'Global Default Insights System Prompt'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(currentInsightsSystem);
                        setCopiedCurrentInsightsSystem(true);
                        setTimeout(() => setCopiedCurrentInsightsSystem(false), 2000);
                      }}
                      className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                      title="Copy to clipboard"
                    >
                      {copiedCurrentInsightsSystem ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
                    </button>
                  </div>
                  
                  {/* Side-by-side layout when both user and global versions exist */}
                  {globalInsightsSystem ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-2 text-sm font-medium text-blue-800 dark:text-blue-200 rounded-t-md border border-blue-200 dark:border-blue-800 border-b-0">
                          User-Specific Version
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm h-[300px] overflow-y-auto">
                          {currentInsightsSystem}
                        </div>
                      </div>
                      <div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-2 text-sm font-medium text-green-800 dark:text-green-200 rounded-t-md border border-green-200 dark:border-green-800 border-b-0">
                          Global Default Version
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm h-[300px] overflow-y-auto">
                          {globalInsightsSystem}
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Single version display when only one version exists
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm">
                      {currentInsightsSystem}
                    </div>
                  )}
                </div>
              </form>
            )}

            {/* User Prompt Content */}
            {activeInsightsTab === 'user' && (
              <form onSubmit={handleInsightsUserSubmit} className="space-y-6">
                <div>
                  <label htmlFor="insightsUserTitle" className="block text-sm font-medium mb-1">
                    User Prompt Version Title
                  </label>
                  <input
                    type="text"
                    id="insightsUserTitle"
                    value={insightsUserTitle}
                    onChange={(e) => setInsightsUserTitle(e.target.value)}
                    placeholder="E.g., Standard insights user prompt"
                    className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    A short descriptive title for this prompt version
                  </p>
                </div>

                <div>
                  <label htmlFor="insightsUserNotes" className="block text-sm font-medium mb-1">
                    Notes
                  </label>
                  <textarea
                    id="insightsUserNotes"
                    value={insightsUserNotes}
                    onChange={(e) => setInsightsUserNotes(e.target.value)}
                    rows={2}
                    placeholder="Optional comments about this version"
                    className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center">
                    <label htmlFor="insightsUserContent" className="block text-sm font-medium mb-1">
                      Insights User Prompt
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(insightsUserContent);
                        setCopiedInsightsUser(true);
                        setTimeout(() => setCopiedInsightsUser(false), 2000);
                      }}
                      className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                      title="Copy to clipboard"
                    >
                      {copiedInsightsUser ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
                    </button>
                  </div>
                  <textarea
                    id="insightsUserContent"
                    value={insightsUserContent}
                    onChange={(e) => setInsightsUserContent(e.target.value)}
                    rows={8}
                    className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    required
                  />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    This user prompt is sent to Claude along with each conversation being analyzed.
                  </p>
                </div>

                {/* Global flag checkbox */}
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="isInsightsUserGlobal"
                    checked={isInsightsUserGlobal}
                    onChange={(e) => setIsInsightsUserGlobal(e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <label htmlFor="isInsightsUserGlobal" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                    Set as global for all users who do not have custom user prompts
                  </label>
                  <p className="ml-4 text-sm text-gray-500 dark:text-gray-400">
                    This will make this user prompt the default for any user without a personal user prompt
                  </p>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Save Insights User Prompt'}
                  </button>
                </div>

                <div className="mt-8">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-medium">
                      {globalInsightsUser ? 'User-Specific Insights User Prompt' : 'Global Default Insights User Prompt'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(currentInsightsUser);
                        setCopiedCurrentInsightsUser(true);
                        setTimeout(() => setCopiedCurrentInsightsUser(false), 2000);
                      }}
                      className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                      title="Copy to clipboard"
                    >
                      {copiedCurrentInsightsUser ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
                    </button>
                  </div>
                  
                  {/* Side-by-side layout when both user and global versions exist */}
                  {globalInsightsUser ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-2 text-sm font-medium text-blue-800 dark:text-blue-200 rounded-t-md border border-blue-200 dark:border-blue-800 border-b-0">
                          User-Specific Version
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm h-[300px] overflow-y-auto">
                          {currentInsightsUser}
                        </div>
                      </div>
                      <div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-2 text-sm font-medium text-green-800 dark:text-green-200 rounded-t-md border border-green-200 dark:border-green-800 border-b-0">
                          Global Default Version
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm h-[300px] overflow-y-auto">
                          {globalInsightsUser}
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Single version display when only one version exists
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm">
                      {currentInsightsUser}
                    </div>
                  )}
                </div>
              </form>
            )}
            
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
              <h3 className="text-lg font-medium text-blue-800 dark:text-blue-300 mb-2">How Insights Generation Works</h3>
              <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">
                Insights are generated using <strong>both</strong> the system and user prompts together:
              </p>
              <ol className="list-decimal pl-5 text-sm text-blue-700 dark:text-blue-400 space-y-1">
                <li>The <strong>System Prompt</strong> provides detailed formatting and criteria instructions</li>
                <li>The <strong>User Prompt</strong> is sent with each conversation for analysis</li>
                <li>Both prompts work together to generate the structured insights</li>
              </ol>
            </div>
          </div>
        )}

        {/* Warm Handoff Tab Content */}
        {activeTab === 'warm_handoff' && (
          <form onSubmit={handleWarmHandoffSubmit} className="space-y-6">
            <div>
              <label htmlFor="userId" className="block text-sm font-medium mb-1">
                User ID
              </label>
              <input
                type="text"
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                required
              />
            </div>

            <div>
              <label htmlFor="warmHandoffTitle" className="block text-sm font-medium mb-1">
                Version Title
              </label>
              <input
                type="text"
                id="warmHandoffTitle"
                value={warmHandoffTitle}
                onChange={(e) => setWarmHandoffTitle(e.target.value)}
                placeholder="E.g., Clinical warm handoff summary prompt"
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                A short descriptive title for this prompt version
              </p>
            </div>

            <div>
              <label htmlFor="warmHandoffNotes" className="block text-sm font-medium mb-1">
                Notes
              </label>
              <textarea
                id="warmHandoffNotes"
                value={warmHandoffNotes}
                onChange={(e) => setWarmHandoffNotes(e.target.value)}
                rows={2}
                placeholder="Optional comments about this version"
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <div className="flex justify-between items-center">
                <label htmlFor="warmHandoffContent" className="block text-sm font-medium mb-1">
                  Warm Handoff Prompt
                </label>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(warmHandoffContent);
                    setCopiedWarmHandoff(true);
                    setTimeout(() => setCopiedWarmHandoff(false), 2000);
                  }}
                  className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                  title="Copy to clipboard"
                >
                  {copiedWarmHandoff ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
                </button>
              </div>
              <textarea
                id="warmHandoffContent"
                value={warmHandoffContent}
                onChange={(e) => setWarmHandoffContent(e.target.value)}
                rows={16}
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                required
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                This prompt will be used when generating summary sheets for warm handoffs to healthcare providers.
              </p>
            </div>
            
            {/* Global flag checkbox */}
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="isWarmHandoffGlobal"
                checked={isWarmHandoffGlobal}
                onChange={(e) => setIsWarmHandoffGlobal(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <label htmlFor="isWarmHandoffGlobal" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                Set as global for all users who do not have custom warm handoff prompts
              </label>
              <p className="ml-4 text-sm text-gray-500 dark:text-gray-400">
                This will make this warm handoff prompt the default for any user without a personal warm handoff prompt
              </p>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Save Warm Handoff Prompt'}
              </button>
            </div>

            <div className="mt-8">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium">
                  {globalWarmHandoff ? 'User-Specific Warm Handoff Prompt' : 'Global Default Warm Handoff Prompt'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(currentWarmHandoff);
                    setCopiedCurrentWarmHandoff(true);
                    setTimeout(() => setCopiedCurrentWarmHandoff(false), 2000);
                  }}
                  className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                  title="Copy to clipboard"
                >
                  {copiedCurrentWarmHandoff ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
                </button>
              </div>
              
              {/* Side-by-side layout when both user and global versions exist */}
              {globalWarmHandoff ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-2 text-sm font-medium text-blue-800 dark:text-blue-200 rounded-t-md border border-blue-200 dark:border-blue-800 border-b-0">
                      User-Specific Version
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm h-[300px] overflow-y-auto">
                      {currentWarmHandoff}
                    </div>
                  </div>
                  <div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-2 text-sm font-medium text-green-800 dark:text-green-200 rounded-t-md border border-green-200 dark:border-green-800 border-b-0">
                      Global Default Version
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm h-[300px] overflow-y-auto">
                      {globalWarmHandoff}
                    </div>
                  </div>
                </div>
              ) : (
                // Single version display when only one version exists
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm">
                  {currentWarmHandoff}
                </div>
              )}
            </div>
          </form>
        )}

        {/* Quest Generation Tab Content */}
        {activeTab === 'quest_generation' && (
          <form onSubmit={handleQuestGenerationSubmit} className="space-y-6">
            <div>
              <label htmlFor="userId" className="block text-sm font-medium mb-1">
                User ID
              </label>
              <input
                type="text"
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                required
              />
            </div>

            {/* Book-specific toggle */}
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="isBookSpecificPrompt"
                checked={isBookSpecificPrompt}
                onChange={(e) => setIsBookSpecificPrompt(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <label htmlFor="isBookSpecificPrompt" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                Book-specific prompt
              </label>
              <p className="ml-4 text-sm text-gray-500 dark:text-gray-400">
                Create a prompt specifically for a single book
              </p>
            </div>
            
            {/* Global toggle */}
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="isQuestGenerationGlobal"
                checked={isQuestGenerationGlobal}
                onChange={(e) => setIsQuestGenerationGlobal(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <label htmlFor="isQuestGenerationGlobal" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                {isBookSpecificPrompt 
                  ? "Set as global for all users with this book" 
                  : "Set as global for all users"}
              </label>
              <p className="ml-4 text-sm text-gray-500 dark:text-gray-400">
                {isBookSpecificPrompt 
                  ? "This will make this prompt the default for this book for any user without a personal prompt" 
                  : "This will make this prompt the default for users without a personal prompt"}
              </p>
            </div>

            {/* Book selector - only shown when book-specific is enabled */}
            {isBookSpecificPrompt && (
              <div>
                <label htmlFor="selectedBookId" className="block text-sm font-medium mb-1">
                  Select Book
                </label>
                <select
                  id="selectedBookId"
                  value={selectedBookId}
                  onChange={(e) => setSelectedBookId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  required={isBookSpecificPrompt}
                  disabled={booksLoading}
                >
                  <option value="">Select a book</option>
                  {books.map(book => (
                    <option key={book.id} value={book.id}>
                      {book.title} by {book.author}
                    </option>
                  ))}
                </select>
                {booksLoading && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Loading books...
                  </p>
                )}
                {isBookSpecificPrompt && !selectedBookId && (
                  <p className="mt-1 text-sm text-red-500 dark:text-red-400">
                    Please select a book for this book-specific prompt
                  </p>
                )}
                {isBookSpecificPrompt && selectedBookId && (
                  <p className="mt-1 text-sm text-green-500 dark:text-green-400">
                    This prompt will be specifically for the selected book
                  </p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="questGenerationTitle" className="block text-sm font-medium mb-1">
                Version Title
              </label>
              <input
                type="text"
                id="questGenerationTitle"
                value={questGenerationTitle}
                onChange={(e) => setQuestGenerationTitle(e.target.value)}
                placeholder={isBookSpecificPrompt ? "E.g., Book-specific quest instructions" : "E.g., Standard quest generation prompt"}
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                A short descriptive title for this prompt version
              </p>
            </div>

            <div>
              <label htmlFor="questGenerationNotes" className="block text-sm font-medium mb-1">
                Notes
              </label>
              <textarea
                id="questGenerationNotes"
                value={questGenerationNotes}
                onChange={(e) => setQuestGenerationNotes(e.target.value)}
                rows={2}
                placeholder={isBookSpecificPrompt ? "Notes about this book-specific prompt" : "Optional comments about this version"}
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <div className="flex justify-between items-center">
                <label htmlFor="questGenerationContent" className="block text-sm font-medium mb-1">
                  Quest Generation Prompt
                </label>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(questGenerationContent);
                    setCopiedQuestGeneration(true);
                    setTimeout(() => setCopiedQuestGeneration(false), 2000);
                  }}
                  className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                  title="Copy to clipboard"
                >
                  {copiedQuestGeneration ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
                </button>
              </div>
              <textarea
                id="questGenerationContent"
                value={questGenerationContent}
                onChange={(e) => setQuestGenerationContent(e.target.value)}
                rows={16}
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                required
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                This prompt will be used when generating book-related quests for readers.
              </p>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || (isBookSpecificPrompt && !selectedBookId)}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Processing...' : isBookSpecificPrompt ? 'Save Book-Specific Quest Prompt' : 'Save Quest Generation Prompt'}
              </button>
            </div>

            <div className="mt-8">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium">
                  {globalQuestGeneration && currentQuestGeneration !== globalQuestGeneration ? 
                    'User-Specific Quest Generation Prompt' : 
                    'Global Default Quest Generation Prompt'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(currentQuestGeneration);
                    setCopiedCurrentQuestGeneration(true);
                    setTimeout(() => setCopiedCurrentQuestGeneration(false), 2000);
                  }}
                  className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                  title="Copy to clipboard"
                >
                  {copiedCurrentQuestGeneration ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
                </button>
              </div>
              
              {/* Side-by-side layout when both user and global versions exist */}
              {globalQuestGeneration && currentQuestGeneration !== globalQuestGeneration ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-2 text-sm font-medium text-blue-800 dark:text-blue-200 rounded-t-md border border-blue-200 dark:border-blue-800 border-b-0">
                      User-Specific Version
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm h-[300px] overflow-y-auto">
                      {currentQuestGeneration || '(No user-specific content)'}
                    </div>
                  </div>
                  <div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-2 text-sm font-medium text-green-800 dark:text-green-200 rounded-t-md border border-green-200 dark:border-green-800 border-b-0">
                      Global Default Version
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm h-[300px] overflow-y-auto">
                      {globalQuestGeneration}
                    </div>
                  </div>
                </div>
              ) : (
                // Single version display when only one version exists
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm">
                  {currentQuestGeneration ? currentQuestGeneration : '(No saved content to display)'}
                </div>
              )}
            </div>
          </form>
        )}

        {/* Profile Tabs (Analysis & Merge) */}
        {(activeTab === 'profile_analysis' || activeTab === 'profile_merge') && (
          <>
            <div className="mb-6">
              <label htmlFor="profileUserId" className="block text-sm font-medium mb-1">
                User ID
              </label>
              <input
                type="text"
                id="profileUserId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                required
              />
            </div>
            <ProfileTabs
              userId={userId}
              loading={loading}
              status={status}

            // Profile analysis system state
            profileAnalysisSystemContent={profileAnalysisSystemContent}
            setProfileAnalysisSystemContent={setProfileAnalysisSystemContent}
            profileAnalysisSystemTitle={profileAnalysisSystemTitle}
            setProfileAnalysisSystemTitle={setProfileAnalysisSystemTitle}
            profileAnalysisSystemNotes={profileAnalysisSystemNotes}
            setProfileAnalysisSystemNotes={setProfileAnalysisSystemNotes}
            currentProfileAnalysisSystem={currentProfileAnalysisSystem}
            setCurrentProfileAnalysisSystem={setCurrentProfileAnalysisSystem}
            globalProfileAnalysisSystem={globalProfileAnalysisSystem}
            setGlobalProfileAnalysisSystem={setGlobalProfileAnalysisSystem}
            isProfileAnalysisSystemGlobal={isProfileAnalysisSystemGlobal}
            setIsProfileAnalysisSystemGlobal={setIsProfileAnalysisSystemGlobal}
            copiedProfileAnalysisSystem={copiedProfileAnalysisSystem}
            setCopiedProfileAnalysisSystem={setCopiedProfileAnalysisSystem}
            copiedCurrentProfileAnalysisSystem={copiedCurrentProfileAnalysisSystem}
            setCopiedCurrentProfileAnalysisSystem={setCopiedCurrentProfileAnalysisSystem}

            // Profile analysis user state
            profileAnalysisUserContent={profileAnalysisUserContent}
            setProfileAnalysisUserContent={setProfileAnalysisUserContent}
            profileAnalysisUserTitle={profileAnalysisUserTitle}
            setProfileAnalysisUserTitle={setProfileAnalysisUserTitle}
            profileAnalysisUserNotes={profileAnalysisUserNotes}
            setProfileAnalysisUserNotes={setProfileAnalysisUserNotes}
            currentProfileAnalysisUser={currentProfileAnalysisUser}
            setCurrentProfileAnalysisUser={setCurrentProfileAnalysisUser}
            globalProfileAnalysisUser={globalProfileAnalysisUser}
            setGlobalProfileAnalysisUser={setGlobalProfileAnalysisUser}
            isProfileAnalysisUserGlobal={isProfileAnalysisUserGlobal}
            setIsProfileAnalysisUserGlobal={setIsProfileAnalysisUserGlobal}
            copiedProfileAnalysisUser={copiedProfileAnalysisUser}
            setCopiedProfileAnalysisUser={setCopiedProfileAnalysisUser}
            copiedCurrentProfileAnalysisUser={copiedCurrentProfileAnalysisUser}
            setCopiedCurrentProfileAnalysisUser={setCopiedCurrentProfileAnalysisUser}

            // Profile merge system state
            profileMergeSystemContent={profileMergeSystemContent}
            setProfileMergeSystemContent={setProfileMergeSystemContent}
            profileMergeSystemTitle={profileMergeSystemTitle}
            setProfileMergeSystemTitle={setProfileMergeSystemTitle}
            profileMergeSystemNotes={profileMergeSystemNotes}
            setProfileMergeSystemNotes={setProfileMergeSystemNotes}
            currentProfileMergeSystem={currentProfileMergeSystem}
            setCurrentProfileMergeSystem={setCurrentProfileMergeSystem}
            globalProfileMergeSystem={globalProfileMergeSystem}
            setGlobalProfileMergeSystem={setGlobalProfileMergeSystem}
            isProfileMergeSystemGlobal={isProfileMergeSystemGlobal}
            setIsProfileMergeSystemGlobal={setIsProfileMergeSystemGlobal}
            copiedProfileMergeSystem={copiedProfileMergeSystem}
            setCopiedProfileMergeSystem={setCopiedProfileMergeSystem}
            copiedCurrentProfileMergeSystem={copiedCurrentProfileMergeSystem}
            setCopiedCurrentProfileMergeSystem={setCopiedCurrentProfileMergeSystem}

            // Profile merge user state
            profileMergeUserContent={profileMergeUserContent}
            setProfileMergeUserContent={setProfileMergeUserContent}
            profileMergeUserTitle={profileMergeUserTitle}
            setProfileMergeUserTitle={setProfileMergeUserTitle}
            profileMergeUserNotes={profileMergeUserNotes}
            setProfileMergeUserNotes={setProfileMergeUserNotes}
            currentProfileMergeUser={currentProfileMergeUser}
            setCurrentProfileMergeUser={setCurrentProfileMergeUser}
            globalProfileMergeUser={globalProfileMergeUser}
            setGlobalProfileMergeUser={setGlobalProfileMergeUser}
            isProfileMergeUserGlobal={isProfileMergeUserGlobal}
            setIsProfileMergeUserGlobal={setIsProfileMergeUserGlobal}
            copiedProfileMergeUser={copiedProfileMergeUser}
            setCopiedProfileMergeUser={setCopiedProfileMergeUser}
            copiedCurrentProfileMergeUser={copiedCurrentProfileMergeUser}
            setCopiedCurrentProfileMergeUser={setCopiedCurrentProfileMergeUser}

            // Subtab states
            activeProfileAnalysisTab={activeProfileAnalysisTab}
            setActiveProfileAnalysisTab={setActiveProfileAnalysisTab}
            activeProfileMergeTab={activeProfileMergeTab}
            setActiveProfileMergeTab={setActiveProfileMergeTab}

            // Handler functions
            handleProfileAnalysisSystemSubmit={handleProfileAnalysisSystemSubmit}
            handleProfileAnalysisUserSubmit={handleProfileAnalysisUserSubmit}
            handleProfileMergeSystemSubmit={handleProfileMergeSystemSubmit}
            handleProfileMergeUserSubmit={handleProfileMergeUserSubmit}

            // Active tab
            activeTab={activeTab === 'profile_analysis' ? 'profile_analysis' : 'profile_merge'}
            setActiveTab={setActiveTab}
          />
          </>
        )}

        {currentUserId && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium mb-1">Your User ID</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Click the copy button to use your ID in the form above
                </p>
              </div>
              <button
                type="button"
                onClick={copyUserId}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded flex items-center text-sm"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                  />
                </svg>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="mt-2 font-mono text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600">
              {currentUserId}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}