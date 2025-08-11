"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import UserProfileDisplay from '@/components/UserProfileDisplay';

interface UserInsight {
  type: 'strength' | 'goal' | 'coping' | 'resource' | 'risk' | 'engagement';
  content: string;
  source: string;
  timestamp?: string;
  confidence: number;
}

interface GroupedInsights {
  strengths: UserInsight[];
  goals: UserInsight[];
  coping: UserInsight[];
  resources: UserInsight[];
  risks: UserInsight[];
  engagement: UserInsight[];
}

interface UserInsightData {
  id: string;
  user_id: string;
  generated_at: string;
  insights: GroupedInsights;
  conversation_count: number;
  message_count: number;
  approved: boolean;
  approved_at?: string;
}

// Feedback form interface kept for reference but commented out since not currently used
/*
interface FeedbackForm {
  accuracy: number;
  helpfulness: number;
  respectfulness: number;
  feedbackText: string;
}
*/

// Define interface for summary sheet content
interface SummarySheetContent {
  title: string;
  generatedAt: string;
  userId: string;
  content: string;
  categories: string[];
  stats: {
    conversationCount: number;
    messageCount: number;
  };
  footer: string;
  customNotes: string;
}

// Define interfaces for user profile items
interface ProfileItem {
  trigger?: string;
  topic?: string;
  detail?: string;
  strategy?: string;
  pattern?: string;
  symptom?: string;
  condition?: string;
  treatment?: string;
  response?: string;
  preference?: string;
  openness?: string;
  engagement?: string;
  resistance?: string;
  intensity?: number;
  confidence?: number;
  messageReferences?: string[];
  [key: string]: string | number | string[] | number[] | Record<string, unknown> | undefined; // Allow for other properties
}

// Define interface for profile category structure
interface ProfileCategory {
  triggers?: ProfileItem[];
  engagingTopics?: ProfileItem[];
  overallEmotions?: ProfileItem[];
  conversationDynamics?: {
    openness?: string | number | ProfileItem[];
    engagement?: string | number | ProfileItem[];
    resistance?: string | number | ProfileItem[];
    [key: string]: string | number | boolean | ProfileItem[] | Record<string, unknown> | undefined;
  };
  interventionReactions?: ProfileItem[];
  [key: string]: string | number | boolean | ProfileItem[] | Record<string, unknown> | {
    [key: string]: string | number | boolean | ProfileItem[] | undefined | Record<string, unknown>;
  } | undefined; // Allow for other properties
}

// Define interface for user profile
interface UserProfile {
  profile: {
    [category: string]: ProfileCategory;
  };
  lastUpdated: string | number; // Timestamp for when the profile was last updated
  // Add other known properties as needed
}

// Utility function to convert camelCase to spaced words with capitalization
// Commented out due to not being used currently
/*
const formatCamelCase = (text: string): string => {
  // Add a space before each capital letter and then capitalize the first letter
  return text
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};
*/

export default function InsightsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<UserInsightData | null>(null);
  const [optedIn, setOptedIn] = useState(false);
  const [privacyPanelExpanded, setPrivacyPanelExpanded] = useState(true);
  const [insightsPanelExpanded, setInsightsPanelExpanded] = useState(true);
  const [warmHandoffPanelExpanded, setWarmHandoffPanelExpanded] = useState(true);
  const [aiRemembersPanelExpanded, setAiRemembersPanelExpanded] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [privacySettings, setPrivacySettings] = useState<{
    insights_opt_in: boolean;
    insights_categories: string[];
    summary_sheet_opt_in: boolean;
    allow_staff_view: boolean;
  }>({
    insights_opt_in: false,
    insights_categories: [],
    summary_sheet_opt_in: false,
    allow_staff_view: false
  });
  const [analyzing, setAnalyzing] = useState(false);
  // Feedback-related state (commented out since not currently used)
  /*
  const [feedback, setFeedback] = useState<FeedbackForm>({
    accuracy: 0,
    helpfulness: 0,
    respectfulness: 0,
    feedbackText: ''
  });
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  */


  // Job polling state for insights
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobStatus, setJobStatus] = useState<'pending' | 'processing' | 'completed' | 'failed' | null>(null);
  const [processedConversations, setProcessedConversations] = useState(0);
  const [totalConversations, setTotalConversations] = useState(0);

  // Job polling state for user profile
  const [profileJobId, setProfileJobId] = useState<string | null>(null);
  const [profileJobProgress, setProfileJobProgress] = useState(0);
  const [profileJobStatus, setProfileJobStatus] = useState<'pending' | 'processing' | 'completed' | 'failed' | null>(null);
  const [profileProcessedConversations, setProfileProcessedConversations] = useState(0);
  const [profileTotalConversations, setProfileTotalConversations] = useState(0);

  // State for managing summary sheet
  const [summarySheetData, setSummarySheetData] = useState<{
    url: string;
    content: SummarySheetContent;
    sharingToken: string;
  } | null>(null);

  // Clear profile states
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearInProgress, setClearInProgress] = useState(false);
  const [clearTrackerOption, setClearTrackerOption] = useState(false);

  // Warm handoff processing state (follows memory system pattern)
  const [warmHandoffStats, setWarmHandoffStats] = useState<{
    totalConversations: number;
    alreadyProcessed: number;
    remainingConversations: number;
    hasMore: boolean;
  } | null>(null);

  // User insights processing state (follows memory system pattern)
  const [insightsStats, setInsightsStats] = useState<{
    totalConversations: number;
    alreadyProcessed: number;
    remainingConversations: number;
    hasMore: boolean;
  } | null>(null);

  // Categories for consent checkboxes
  const insightCategories = [
    { id: 'strength', label: 'Strengths I\'ve shown', description: 'Times when the AI noted your strength, courage, or skills.' },
    { id: 'goal', label: 'My goals and priorities', description: 'Goals or important values you\'ve mentioned.' },
    { id: 'coping', label: 'Helpful coping strategies', description: 'Coping skills that have worked well for you.' },
    { id: 'resource', label: 'Resources I\'ve explored', description: 'Support resources you\'ve learned about or tried.' },
    { id: 'risk', label: 'Signs of distress', description: 'Times when you may have been struggling or in distress.' },
    { id: 'engagement', label: 'Conversation patterns', description: 'How you engage in conversations (like preferred topics).' }
  ];

  // Profile job polling function
  const pollProfileJobStatus = async (id: string) => {
    try {
      // Get the current user's ID token for authentication
      let idToken = '';
      if (user) {
        try {
          idToken = await user?.getIdToken() || '';
        } catch (tokenErr) {
          console.error('Error getting user ID token for profile polling:', tokenErr);
          // Continue without token
        }
      }

      const response = await fetch(`/api/v15/process-user-memory?jobId=${id}`, {
        headers: {
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        }
      });

      if (response.ok) {
        const data = await response.json();

        // Add logging to track job progress
        if (process.env.NEXT_PUBLIC_ENABLE_MEMORY_REFRESH_LOGS === 'true') {
          console.log(`[memory_refresh] Job ${id} status: ${data.status}, progress: ${data.progress}%, processed: ${data.processedConversations}/${data.totalConversations}`);
        }

        setProfileJobProgress(data.progress || 0);
        setProfileJobStatus(data.status);
        setProfileProcessedConversations(data.processedConversations || 0);
        setProfileTotalConversations(data.totalConversations || 0);

        if (data.status === 'completed') {
          // Job completed, stop polling and fetch the updated profile
          if (process.env.NEXT_PUBLIC_ENABLE_MEMORY_REFRESH_LOGS === 'true') {
            console.log(`[memory_refresh] Job ${id} completed successfully, fetching updated profile`);
          }
          setProfileLoading(false);
          fetchUserProfile();
        } else if (data.status === 'failed') {
          // Job failed, stop polling
          if (process.env.NEXT_PUBLIC_ENABLE_MEMORY_REFRESH_LOGS === 'true') {
            console.log(`[memory_refresh] Job ${id} failed:`, data.error);
          }
          setProfileLoading(false);
          setProfileError(data.error || 'Profile processing failed');
        }
      } else {
        // Error response, stop polling
        setProfileLoading(false);
        const errorData = await response.json();
        if (process.env.NEXT_PUBLIC_ENABLE_MEMORY_REFRESH_LOGS === 'true') {
          console.log(`[memory_refresh] Error polling job ${id}:`, errorData.error);
        }
        setProfileError(errorData.error || 'Failed to check profile job status');
      }
    } catch (err) {
      console.error('Error polling profile job status:', err);
      if (process.env.NEXT_PUBLIC_ENABLE_MEMORY_REFRESH_LOGS === 'true') {
        console.log(`[memory_refresh] Network error polling job ${id}:`, err instanceof Error ? err.message : String(err));
      }
      // Don't stop analyzing on network errors, it might be temporary
    }
  };

  // Setup profile polling effect
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    // Only setup polling if we have a profileJobId and are loading
    if (profileJobId && profileLoading) {
      // Poll every 2 seconds
      intervalId = setInterval(() => {
        pollProfileJobStatus(profileJobId);
      }, 2000);
    }

    // Clean up interval when component unmounts or jobId/analyzing changes
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileJobId, profileLoading]);

  // Refresh user profile (trigger analysis)
  const refreshUserProfile = async () => {
    if (!user) return;

    // Add comprehensive logging to track what's being processed
    const logMemoryRefresh = (message: string, ...args: unknown[]) => {
      if (process.env.NEXT_PUBLIC_ENABLE_MEMORY_REFRESH_LOGS === 'true') {
        console.log(`[memory_refresh] ${message}`, ...args);
      }
    };

    try {
      setProfileLoading(true);
      setProfileError(null);
      setProfileJobId(null);
      setProfileJobProgress(0);
      setProfileJobStatus(null);
      setProfileProcessedConversations(0);
      setProfileTotalConversations(0);

      logMemoryRefresh('Starting manual memory refresh for user:', user.uid);
      logMemoryRefresh('Using V15 API for consistent behavior with cron job');

      // Scroll to the profile section after a short delay
      window.setTimeout(() => {
        document.getElementById('ai-remembers-section')?.scrollIntoView({
          behavior: 'smooth'
        });
      }, 100);

      // Get the current user's ID token for authentication
      let idToken = '';
      try {
        idToken = await user?.getIdToken() || '';
        logMemoryRefresh('Successfully obtained user ID token');
      } catch (tokenErr) {
        console.error('Error getting user ID token for profile refresh:', tokenErr);
        logMemoryRefresh('Failed to get ID token, continuing without authentication');
        // Continue without token, will use userId param as fallback
      }

      // Call the process-user-memory endpoint to analyze conversations and update profile
      const apiEndpoint = '/api/v15/process-user-memory';
      const requestBody = {
        userId: user?.uid || ''
      };

      logMemoryRefresh('Making API call to:', apiEndpoint);
      logMemoryRefresh('Request body:', requestBody);
      logMemoryRefresh('Expected behavior: This will process conversations from past 7 days that have NOT already been processed');

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      logMemoryRefresh('Memory processing result:', data);
      console.log('Memory processing result:', data);

      if (response.ok) {
        // V15 API returns results synchronously (no job-based system)
        if (data.success) {
          logMemoryRefresh('Processing completed successfully');
          logMemoryRefresh('Total conversations found:', data.totalConversations || 0);
          logMemoryRefresh('Unprocessed conversations found:', data.unprocessedFound || 0);
          logMemoryRefresh('Conversations processed:', data.conversationsProcessed || 0);
          logMemoryRefresh('Test processed count:', data.testProcessedCount || 0);
          logMemoryRefresh('Test skipped count:', data.testSkippedCount || 0);
          logMemoryRefresh('Test error count:', data.testErrorCount || 0);

          // Update UI to show completion
          setProfileTotalConversations(data.totalConversations || 0);
          setProfileProcessedConversations(data.conversationsProcessed || 0);
          setProfileJobStatus('completed');
          setProfileJobProgress(100);

          // Fetch the updated profile
          fetchUserProfile();
        } else {
          // Processing failed
          logMemoryRefresh('Processing failed:', data.error || 'Unknown error');
          setProfileError(data.error || 'Memory processing failed');
        }

        // Turn off loading since processing is complete (V15 is synchronous)
        setProfileLoading(false);
      } else {
        // Handle errors - show details to the user
        let errorMessage = data.error || 'Failed to process user memory';

        // Include detailed error if available
        if (data.details && data.details.error) {
          errorMessage += `: ${data.details.error}`;
        }

        // Include raw response if available (for debug purposes)
        if (data.details && data.details.rawResponse) {
          const truncatedResponse = data.details.rawResponse.substring(0, 100) + '...';
          errorMessage += ` (Claude response: "${truncatedResponse}")`;
        }

        console.error('Error details from API:', data);
        logMemoryRefresh('Error processing memory:', errorMessage);
        setProfileError(errorMessage);
        setProfileLoading(false);
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error('Error refreshing user profile:', err);
      // Don't set profileError here if it was already set from the response error
      if (!profileError) {
        setProfileError(err instanceof Error ? err.message : String(err));
      }

      // Show a user-visible error message
      alert('Error refreshing profile: ' + (err instanceof Error ? err.message : String(err)));
      setProfileLoading(false);
    }
  };

  // Fetch user profile data
  const fetchUserProfile = async () => {
    if (!user) return;

    try {
      setProfileLoading(true);
      setProfileError(null);

      // Get the current user's ID token for authentication
      let idToken = '';
      try {
        idToken = await user?.getIdToken() || '';
      } catch (tokenErr) {
        console.error('Error getting user ID token for profile fetch:', tokenErr);
        // Continue without token, will use userId param as fallback
      }

      const response = await fetch(`/api/v11/user-profile?userId=${user?.uid || ''}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserProfile(data);
      } else if (response.status === 404) {
        // No profile yet, this is expected for new users
        console.log('No user profile found - need to create one');
        setUserProfile(null);
      } else {
        // Handle other errors
        let errorMessage = 'Failed to fetch user profile';
        try {
          const errorData = await response.json();
          console.error('Profile fetch error details:', errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (parseErr) {
          console.error('Error parsing error response:', parseErr);
        }
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setProfileError(err instanceof Error ? err.message : String(err));
    } finally {
      setProfileLoading(false);
    }
  };

  // Clear user profile (erase what AI remembers)
  const clearUserProfile = async () => {
    if (!user) return;

    try {
      setClearInProgress(true);
      setProfileError(null);

      // Get the current user's ID token for authentication
      let idToken = '';
      try {
        idToken = await user?.getIdToken() || '';
      } catch (tokenErr) {
        console.error('Error getting user ID token for profile clear:', tokenErr);
        // Continue without token, will use userId param as fallback
      }

      // Call the clear-user-profile endpoint
      const response = await fetch('/api/v11/clear-user-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          userId: user?.uid || '',
          resetTracker: clearTrackerOption
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Profile clearing result:', data);

        // Refresh the profile to show it's been cleared
        fetchUserProfile();

        // Hide the confirmation dialog
        setShowClearConfirm(false);
        setClearTrackerOption(false);
      } else {
        // Handle errors
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear user profile');
      }
    } catch (err) {
      console.error('Error clearing user profile:', err);
      setProfileError(err instanceof Error ? err.message : String(err));
    } finally {
      setClearInProgress(false);
    }
  };

  // Fetch initial data
  useEffect(() => {
    if (!user) return;

    // Immediately try to load cached insights from localStorage
    try {
      const cachedInsights = localStorage.getItem(`user_insights_${user?.uid || ''}`);
      if (cachedInsights) {
        console.log('Found cached insights in localStorage on initial load');
        setInsights(JSON.parse(cachedInsights));
      }
    } catch (storageErr) {
      console.error('Error reading cached insights:', storageErr);
    }

    // Fetch user profile
    fetchUserProfile();

    // Immediately try to directly load insights from server, bypassing opt-in checks
    const loadDirectInsights = async () => {
      try {
        let idToken = '';
        try {
          idToken = await user?.getIdToken() || '';
        } catch (tokenErr) {
          console.error('Error getting user ID token for initial direct load:', tokenErr);
        }

        console.log('Making direct request for insights on initial load');
        const directResponse = await fetch(`/api/v11/user-insights?userId=${user?.uid || ''}&bypassOptIn=true`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
          }
        });

        if (directResponse.ok) {
          const directData = await directResponse.json();
          if (directData.insights) {
            console.log('Successfully retrieved insights with direct initial load:', directData.insights.id);
            setInsights(directData.insights);

            // Save to localStorage
            try {
              localStorage.setItem(`user_insights_${user?.uid || ''}`, JSON.stringify(directData.insights));
            } catch (storageErr) {
              console.error('Error saving insights to localStorage:', storageErr);
            }
          }
        } else {
          console.log('Direct request failed, status:', directResponse.status);
          // No fallback to other users' insights - security first
        }
      } catch (err) {
        console.error('Error in direct insights load:', err);
      }
    };

    // Load latest summary sheet
    const loadLatestSummarySheet = async () => {
      try {
        console.log('Loading latest summary sheet...');
        let idToken = '';
        try {
          idToken = await user?.getIdToken() || '';
        } catch (tokenErr) {
          console.error('Error getting user ID token for summary sheet load:', tokenErr);
        }

        // Query Supabase directly via a fetch request
        const response = await fetch(`/api/v11/user-insights/summary-sheet?userId=${user?.uid}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
          }
        });

        if (response.ok) {
          const data = await response.json();

          // Check if there's an error in the response
          if (data.error) {
            console.error('Error in summary sheet response:', data.error);
            return;
          }

          // Check if sheet is expired
          if (data.expired) {
            console.log('Summary sheet has expired, expires at:', data.expiresAt);
            // We could show an expired message, but for now we'll just not show anything
            return;
          }

          if (data.summarySheet) {
            console.log('Found existing summary sheet with token:', data.summarySheet.sharing_token);

            // Set the summary data
            setSummarySheetData({
              url: `/share/summary/${data.summarySheet.sharing_token}`,
              content: data.summarySheet.summary_content,
              sharingToken: data.summarySheet.sharing_token
            });

            // Scroll to the summary section if it's present
            window.setTimeout(() => {
              const summarySection = document.getElementById('summary-sheet-section');
              if (summarySection) {
                // Only scroll if it's significantly below the viewport
                const rect = summarySection.getBoundingClientRect();
                if (rect.top > window.innerHeight * 0.7) {
                  summarySection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                  });
                }
              }
            }, 500); // Slight delay to ensure the DOM is updated
          } else {
            console.log('No summary sheet found');
          }
        } else {
          // Handle HTTP error
          console.log('Failed to load summary sheet, status:', response.status);
          try {
            const errorData = await response.json();
            console.error('Error details:', errorData);
          } catch (e) {
            console.error('Could not parse error response', e);
          }
        }
      } catch (err) {
        console.error('Error loading summary sheet:', err);
      }
    };

    // Execute the direct load
    loadDirectInsights();

    // Also load latest summary sheet
    loadLatestSummarySheet();

    async function loadData() {
      try {
        setLoading(true);

        // Get the current user's ID token for authentication
        let idToken = '';
        try {
          idToken = await user?.getIdToken() || '';
        } catch (tokenErr) {
          console.error('Error getting user ID token:', tokenErr);
          // Continue without token, will use userId param as fallback
        }

        // Try to load privacy settings from localStorage first
        try {
          const cachedSettings = localStorage.getItem(`privacy_settings_${user?.uid || ''}`);
          if (cachedSettings) {
            console.log('Found cached privacy settings in localStorage');
            const parsedSettings = JSON.parse(cachedSettings);
            setPrivacySettings(parsedSettings);
            setOptedIn(parsedSettings.insights_opt_in);
          }
        } catch (storageErr) {
          console.error('Error reading cached privacy settings:', storageErr);
        }

        // Then fetch latest privacy settings from API
        const privacyResponse = await fetch(`/api/v11/user-privacy-settings?userId=${user?.uid || ''}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            // Include the auth token if available
            ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
          }
        });

        if (privacyResponse.ok) {
          const privacyData = await privacyResponse.json();

          // Save privacy settings to localStorage
          try {
            localStorage.setItem(`privacy_settings_${user?.uid || ''}`, JSON.stringify(privacyData.settings));
          } catch (storageErr) {
            console.error('Error saving privacy settings to localStorage:', storageErr);
          }

          setPrivacySettings(privacyData.settings);
          setOptedIn(privacyData.settings.insights_opt_in);
        } else if (privacyResponse.status === 404) {
          console.log('No privacy settings found on server, will create when user opts in');
          // Keep using localStorage settings if available, otherwise defaults remain
        } else {
          console.error('Error fetching privacy settings from API:', privacyResponse.status);
          // Keep using localStorage settings if available
        }

        // Always try to fetch insights if the user is logged in - this ensures
        // insights persist even if user signs out and signs back in
        await fetchInsights();
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Fetch insights (called after opt-in or on initial load if already opted in)
  const fetchInsights = async () => {
    try {
      if (!user) {
        console.error('User is not authenticated');
        return;
      }

      // Get the current user's ID token for authentication
      let idToken = '';
      try {
        idToken = await user?.getIdToken() || '';
      } catch (tokenErr) {
        console.error('Error getting user ID token:', tokenErr);
        // Continue without token, will use userId param as fallback
      }

      console.log(`Fetching insights for user: ${user?.uid || ''}`);
      const insightsResponse = await fetch(`/api/v11/user-insights?userId=${user?.uid || ''}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Include the auth token if available
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        }
      });

      if (insightsResponse.ok) {
        const insightsData = await insightsResponse.json();
        if (insightsData.insights) {
          console.log('Successfully retrieved insights:', insightsData.insights.id);
          // Save insights to localStorage as backup
          try {
            localStorage.setItem(`user_insights_${user?.uid || ''}`, JSON.stringify(insightsData.insights));
          } catch (storageErr) {
            console.error('Error saving insights to localStorage:', storageErr);
          }
          setInsights(insightsData.insights);
          // Insights successfully fetched and stored in state
        }
      } else if (insightsResponse.status === 404) {
        // No insights exist yet for this user - this is expected for new users
        console.log('No insights found for user - need to generate first');
        // Try to load from localStorage as fallback
        try {
          const cachedInsights = localStorage.getItem(`user_insights_${user?.uid || ''}`);
          if (cachedInsights) {
            console.log('Found cached insights in localStorage');
            setInsights(JSON.parse(cachedInsights));
          }
        } catch (storageErr) {
          console.error('Error reading cached insights:', storageErr);
        }
      } else if (insightsResponse.status === 403) {
        // The API returned a 403 error, but we've updated the API to return insights anyway
        // Try a direct query to get insights even if the user hasn't opted in
        console.log('User has not opted in to insights - trying direct query');

        // Make a direct request to the Supabase insights table
        try {
          // Get the ID token for auth
          let idToken = '';
          try {
            idToken = await user?.getIdToken() || '';
          } catch (tokenErr) {
            console.error('Error getting user ID token for direct query:', tokenErr);
          }

          // Direct query to bypass opt-in check
          const directResponse = await fetch(`/api/v11/user-insights?userId=${user?.uid || ''}&bypassOptIn=true`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
            }
          });

          if (directResponse.ok) {
            const directData = await directResponse.json();
            if (directData.insights) {
              console.log('Successfully retrieved insights with direct query:', directData.insights.id);
              setInsights(directData.insights);

              // Save to localStorage
              try {
                localStorage.setItem(`user_insights_${user?.uid || ''}`, JSON.stringify(directData.insights));
              } catch (storageErr) {
                console.error('Error saving insights to localStorage:', storageErr);
              }
            }
          } else {
            // If direct query fails, try localStorage as last resort
            try {
              const cachedInsights = localStorage.getItem(`user_insights_${user?.uid || ''}`);
              if (cachedInsights) {
                console.log('Found cached insights in localStorage');
                setInsights(JSON.parse(cachedInsights));
              }
            } catch (storageErr) {
              console.error('Error reading cached insights:', storageErr);
            }
          }
        } catch (directErr) {
          console.error('Error making direct query:', directErr);
          // Try localStorage as fallback
          try {
            const cachedInsights = localStorage.getItem(`user_insights_${user?.uid || ''}`);
            if (cachedInsights) {
              console.log('Found cached insights in localStorage after direct query error');
              setInsights(JSON.parse(cachedInsights));
            }
          } catch (storageErr) {
            console.error('Error reading cached insights:', storageErr);
          }
        }
      } else {
        // True error case - something went wrong with the API
        const errorData = await insightsResponse.json();
        // Try to load from localStorage as fallback
        try {
          const cachedInsights = localStorage.getItem(`user_insights_${user?.uid || ''}`);
          if (cachedInsights) {
            console.log('API error, using cached insights from localStorage');
            setInsights(JSON.parse(cachedInsights));
          }
        } catch (storageErr) {
          console.error('Error reading cached insights:', storageErr);
        }
        throw new Error(errorData.error || 'Failed to fetch insights');
      }
    } catch (err) {
      console.error('Error fetching insights:', err);
      setError(err instanceof Error ? err.message : String(err));

      // As a last resort, try to load from localStorage
      if (user) {
        try {
          const cachedInsights = localStorage.getItem(`user_insights_${user?.uid || ''}`);
          if (cachedInsights) {
            console.log('Error occurred, using cached insights from localStorage');
            setInsights(JSON.parse(cachedInsights));
            // Clear the error if we successfully loaded from cache
            setError(null);
          }
        } catch (storageErr) {
          console.error('Error reading cached insights:', storageErr);
        }
      }
    }
  };

  // Handle privacy settings updates
  const handlePrivacySettingsChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;

    const updatedSettings = { ...privacySettings };

    if (name === 'insights_opt_in') {
      updatedSettings.insights_opt_in = checked;
      setOptedIn(checked);
    } else if (name === 'summary_sheet_opt_in') {
      updatedSettings.summary_sheet_opt_in = checked;
    } else if (name === 'allow_staff_view') {
      updatedSettings.allow_staff_view = checked;
    } else if (name.startsWith('category_')) {
      const category = name.replace('category_', '');
      if (checked) {
        updatedSettings.insights_categories = [...updatedSettings.insights_categories, category];
      } else {
        updatedSettings.insights_categories = updatedSettings.insights_categories.filter(c => c !== category);
      }
    }

    // Update state immediately to make UI responsive
    setPrivacySettings(updatedSettings);
    if (name === 'insights_opt_in') {
      setOptedIn(checked);
    }

    // Save to localStorage first for offline persistence
    try {
      localStorage.setItem(`privacy_settings_${user?.uid || ''}`, JSON.stringify(updatedSettings));
    } catch (storageErr) {
      console.error('Error saving privacy settings to localStorage:', storageErr);
    }

    try {
      // Get the current user's ID token for authentication
      let idToken = '';
      if (user) {
        try {
          idToken = await user?.getIdToken() || '';
        } catch (tokenErr) {
          console.error('Error getting user ID token:', tokenErr);
          // Continue without token
        }
      }

      const response = await fetch('/api/v11/user-privacy-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          settings: {
            ...updatedSettings,
            user_id: user?.uid || ''
          }
        })
      });

      if (response.ok) {
        // Settings successfully saved to server
        console.log('Privacy settings successfully updated on server');

        // If user just opted in, check if we should fetch or generate insights
        if (name === 'insights_opt_in' && checked) {
          await fetchInsights();
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update privacy settings');
      }
    } catch (err) {
      console.error('Error updating privacy settings on server:', err);
      setError(err instanceof Error ? err.message : String(err));
      // Note: We don't revert the UI change since we saved to localStorage, 
      // so the user's choice is preserved locally even if the server update fails.
    }
  };

  // Generate insights using V15 API (following warm handoff pattern)
  const generateInsights = async () => {
    if (!user) return;

    try {
      setAnalyzing(true);
      setError(null);
      setJobId(null);
      setJobProgress(0);
      setJobStatus('processing');
      setProcessedConversations(0);
      setTotalConversations(10); // We process up to 10 per batch

      // Get the current user's ID token for authentication
      let idToken = '';
      try {
        idToken = await user?.getIdToken() || '';
      } catch (tokenErr) {
        console.error('Error getting user ID token:', tokenErr);
        // Continue without token, will use userId param as fallback
      }

      // Scroll to the analysis section after a short delay
      window.setTimeout(() => {
        document.getElementById('analysis-section')?.scrollIntoView({
          behavior: 'smooth'
        });
      }, 100);

      const response = await fetch('/api/v15/generate-user-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Include the auth token if available
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          userId: user?.uid || '',
          insightTypes: privacySettings.insights_categories
        })
      });

      if (response.ok) {
        const data = await response.json();

        if (data.success) {
          // V15 API returns results immediately, no job polling needed
          setJobProgress(100);
          setJobStatus('completed');
          setProcessedConversations(data.stats?.processedThisBatch || 0);
          setTotalConversations(data.stats?.processedThisBatch || 10);

          // Update insights stats with real data from memory-pattern API
          if (data.stats) {
            const stats = data.stats;
            setInsightsStats({
              totalConversations: stats.totalConversationsFound || 0,
              alreadyProcessed: stats.alreadyProcessed || 0,
              remainingConversations: stats.remainingConversations || 0,
              hasMore: stats.hasMore || false
            });

            const statisticsMessage = `Processing ${stats.processedThisBatch || 0} conversations this batch`;
            console.log('[user_insights] Processing statistics:', statisticsMessage);

            if (stats.remainingConversations > 0) {
              console.log('[user_insights]', `${stats.remainingConversations} conversations remaining for processing`);
            } else {
              console.log('[user_insights] All conversations have been processed');
            }
          }

          if (data.insights) {
            // Save insights to localStorage and state
            try {
              localStorage.setItem(`user_insights_${user?.uid || ''}`, JSON.stringify(data.insights));
              console.log('Saved insights to localStorage');
            } catch (storageErr) {
              console.error('Error saving insights to localStorage:', storageErr);
            }

            setInsights(data.insights);
          }

          // Set analyzing to false after a brief delay to show completion
          setTimeout(() => {
            setAnalyzing(false);
          }, 1000);
        } else {
          throw new Error(data.error || 'Failed to generate insights');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate insights');
      }
    } catch (err) {
      console.error('Error generating insights:', err);
      setError(err instanceof Error ? err.message : String(err));
      setAnalyzing(false);
    }
  };

  // Poll job status
  // const startPollingJobStatus = (id: string) => {
  //   // Start polling immediately
  //   pollJobStatus(id);
  // };

  // Setup polling effect
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    // Only setup polling if we have a jobId and are analyzing
    if (jobId && analyzing) {
      // Poll every 2 seconds
      intervalId = setInterval(() => {
        pollJobStatus(jobId);
      }, 2000);
    }

    // Clean up interval when component unmounts or jobId/analyzing changes
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, analyzing]);

  // Function to poll job status
  const pollJobStatus = async (id: string) => {
    try {
      // Get the current user's ID token for authentication
      let idToken = '';
      if (user) {
        try {
          idToken = await user?.getIdToken() || '';
        } catch (tokenErr) {
          console.error('Error getting user ID token for polling:', tokenErr);
          // Continue without token
        }
      }

      // Check if the id is for a summary sheet job
      const isSummaryJob = id.startsWith('summary-');

      // Choose the appropriate endpoint based on job type
      const endpoint = isSummaryJob
        ? `/api/v15/generate-summary-sheet?jobId=${id}`
        : `/api/preprocessing/user-insights?jobId=${id}`;

      const response = await fetch(endpoint, {
        headers: {
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        }
      });

      if (response.ok) {
        const data = await response.json();
        setJobProgress(data.progress || 0);
        setJobStatus(data.status);
        setProcessedConversations(data.processedConversations || 0);

        if (data.status === 'completed') {
          // Job completed, stop polling
          setAnalyzing(false);

          if (isSummaryJob) {
            // Handle summary sheet completion
            if (data.url && data.summaryContent) {
              // Save summary sheet data to state instead of opening in new tab
              setSummarySheetData({
                url: data.url,
                content: data.summaryContent,
                sharingToken: data.sharingToken
              });

              // Scroll to the summary section after a short delay
              window.setTimeout(() => {
                document.getElementById('summary-sheet-section')?.scrollIntoView({
                  behavior: 'smooth'
                });
              }, 300);
            }
          } else if (data.insights) {
            // Handle insights completion
            // Save the insights to localStorage immediately
            if (user) {
              try {
                localStorage.setItem(`user_insights_${user?.uid || ''}`, JSON.stringify(data.insights));
                console.log('Saved completed insights to localStorage');

                // Set insights directly from the job result
                setInsights(data.insights);
              } catch (storageErr) {
                console.error('Error saving insights to localStorage:', storageErr);
              }
            }

            // Also fetch from API to ensure we have the latest data
            await fetchInsights();
          }
        } else if (data.status === 'failed') {
          // Job failed, stop polling
          setAnalyzing(false);
          setError(data.error || (isSummaryJob ? 'Summary sheet generation failed' : 'Insights processing failed'));
        }
      } else {
        // Error response, stop polling
        setAnalyzing(false);
        const errorData = await response.json();
        setError(errorData.error || 'Failed to check job status');
      }
    } catch (err) {
      console.error('Error polling job status:', err);
      // Don't stop analyzing on network errors, it might be temporary
    }
  };

  // Submit feedback on insights
  // Commented out due to not being used currently
  /*
  const submitFeedback = async () => {
    if (!insights || !user) return;

    try {
      setFeedbackSubmitting(true);

      const response = await fetch('/api/v11/insight-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insightId: insights.id,
          accuracy: feedback.accuracy,
          helpfulness: feedback.helpfulness,
          respectfulness: feedback.respectfulness,
          feedbackText: feedback.feedbackText
        })
      });

      if (response.ok) {
        setShowFeedbackForm(false);
        // Reset form
        setFeedback({
          accuracy: 0,
          helpfulness: 0,
          respectfulness: 0,
          feedbackText: ''
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit feedback');
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFeedbackSubmitting(false);
    }
  };
  */

  // Handle feedback form input changes
  // Commented out due to not being used currently
  /*
  const handleFeedbackChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFeedback(prev => ({
      ...prev,
      [name]: name === 'feedbackText' ? value : Number(value)
    }));
  };
  */

  // Rating component for feedback form
  // Commented out due to not being used currently
  /*
  const RatingInput = ({ name, value, onChange, label }: {
    name: string;
    value: number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    label: string;
  }) => (
    <div className="mb-4">
      <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => {
              // Instead of trying to create a ChangeEvent, just pass the values directly
              onChange({ target: { name, value: rating } } as unknown as React.ChangeEvent<HTMLInputElement>);
            }}
            className={`w-8 h-8 rounded-full ${value >= rating
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
          >
            {rating}
          </button>
        ))}
      </div>
    </div>
  );
  */

  // Render function for insight items
  const renderInsightItems = (insights: UserInsight[], title: string, icon: string) => {
    if (!insights || insights.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3 flex items-center">
          <span className="mr-2">{icon}</span>
          {title}
        </h3>
        <ul className="ml-6 space-y-2">
          {insights.map((insight, i) => (
            <li key={i} className="text-gray-700 dark:text-gray-300">
              {insight.content}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // Function to format summary sheet content properly with sections and bullet points
  // Commented out due to not being used currently
  /*
  const formatSummaryContent = (content: string) => {
    if (!content) return <p className="text-gray-700 dark:text-gray-300">No content available</p>;

    // Split by headings (using ## or starting with uppercase followed by colon)
    const sections = content.split(/(?:^|\n)(?:#{1,3} |[A-Z][^:\n]+:)/g).filter(Boolean);
    const headings = content.match(/(?:^|\n)(?:#{1,3} |[A-Z][^:\n]+:)/g) || [];

    return (
      <div>
        {headings.map((heading, index) => {
          // Clean up the heading
          const cleanHeading = heading.replace(/^[\n#\s]+/, '').trim();
          const sectionContent = sections[index] || '';

          // Process section content to find bullet points
          const contentLines = sectionContent.split('\n').filter(line => line.trim());

          return (
            <div key={index} className="mb-6">
              <h3 className="text-lg font-medium mb-3">{cleanHeading}</h3>
              <div className="ml-6">
                {contentLines.map((line, i) => {
                  // Check if line starts with a bullet point
                  const isBullet = line.trim().startsWith('-') || line.trim().startsWith('•');
                  const cleanLine = line.replace(/^[\s•-]+/, '').trim();

                  return (
                    <div key={i} className={`${isBullet ? 'flex' : ''} mb-2`}>
                      {isBullet && <span className="mr-2">•</span>}
                      <p className="text-gray-700 dark:text-gray-300">{cleanLine}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  */

  // Main render
  if (!user) {
    return (
      <div className="container mx-auto px-4 pt-20 pb-8">
        <h1 className="text-2xl font-bold mb-6">Insights</h1>
        <div className="bg-red-100 dark:bg-red-900 p-6 rounded-lg shadow-md">
          <p className="text-red-700 dark:text-red-300">
            Authentication required. Please sign in to view insights.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 pt-20 pb-8">
        <h1 className="text-2xl font-bold mb-6">Insights</h1>
        <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <p className="text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-20 pb-8">
      <h1 className="text-2xl font-bold mb-6">Your Insights</h1>

      {error && (
        <div className="bg-red-100 dark:bg-red-900 p-4 rounded-lg mb-6">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Privacy Settings Panel */}
      <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6 print-hide">
        <div className="flex justify-between items-center cursor-pointer" onClick={() => setPrivacyPanelExpanded(!privacyPanelExpanded)}>
          <h2 className="text-xl font-semibold">Privacy Settings</h2>
          <span className="text-gray-700 dark:text-gray-300">{privacyPanelExpanded ? '▲' : '▼'}</span>
        </div>

        {privacyPanelExpanded && (
          <>
            <p className="mb-4 mt-4 text-gray-700 dark:text-gray-300">
              Control how your conversation data is used to generate insights that can help you.
              You can opt in or out at any time, and only see insights in categories you approve.
            </p>

            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="insights_opt_in"
                  checked={privacySettings.insights_opt_in}
                  onChange={handlePrivacySettingsChange}
                  className="mr-2 h-5 w-5"
                />
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  Generate insights from my conversations
                </span>
              </label>
              <p className="text-gray-600 dark:text-gray-400 text-sm ml-7 mt-1">
                Allow the system to analyze my conversations to identify helpful patterns
              </p>
            </div>

            {optedIn && (
              <>
                <div className="mb-4">
                  <h3 className="font-medium mb-2 text-gray-700 dark:text-gray-300">
                    I want to see insights about:
                  </h3>
                  <div className="ml-2 space-y-2">
                    <label className="flex items-start">
                      <input
                        type="checkbox"
                        name="select_all_categories"
                        checked={insightCategories.every(cat => privacySettings.insights_categories.includes(cat.id))}
                        onChange={(e) => {
                          const allCategoryIds = insightCategories.map(cat => cat.id);
                          const updatedSettings = { ...privacySettings };

                          if (e.target.checked) {
                            // Select all categories
                            updatedSettings.insights_categories = allCategoryIds;
                          } else {
                            // Unselect all categories
                            updatedSettings.insights_categories = [];
                          }

                          // Update state immediately for responsive UI
                          setPrivacySettings(updatedSettings);

                          // Save to localStorage first for persistence
                          try {
                            localStorage.setItem(`privacy_settings_${user?.uid || ''}`, JSON.stringify(updatedSettings));
                          } catch (storageErr) {
                            console.error('Error saving privacy settings to localStorage:', storageErr);
                          }

                          // Get the current user's ID token for authentication
                          const getTokenAndSendToServer = async () => {
                            let idToken = '';
                            if (user) {
                              try {
                                idToken = await user?.getIdToken() || '';
                              } catch (tokenErr) {
                                console.error('Error getting user ID token for select all:', tokenErr);
                                // Continue without token
                              }
                            }

                            // Then send to API
                            fetch('/api/v11/user-privacy-settings', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
                              },
                              body: JSON.stringify({
                                settings: {
                                  ...updatedSettings,
                                  user_id: user?.uid || ''
                                }
                              })
                            })
                              .then(response => {
                                if (response.ok) {
                                  console.log('All categories update saved successfully');
                                } else {
                                  throw new Error('Failed to update all categories');
                                }
                              })
                              .catch(err => {
                                console.error('Error updating privacy settings:', err);
                                setError(err instanceof Error ? err.message : String(err));
                              });
                          };

                          getTokenAndSendToServer();
                        }}
                        className="mr-2 h-5 w-5 mt-0.5"
                      />
                      <div>
                        <span className="text-gray-700 dark:text-gray-300 font-medium">Select All</span>
                      </div>
                    </label>
                    {insightCategories.map(category => (
                      <label key={category.id} className="flex items-start">
                        <input
                          type="checkbox"
                          name={`category_${category.id}`}
                          checked={privacySettings.insights_categories.includes(category.id)}
                          onChange={handlePrivacySettingsChange}
                          className="mr-2 h-5 w-5 mt-0.5"
                        />
                        <div>
                          <span className="text-gray-700 dark:text-gray-300">{category.label}</span>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">{category.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Summary sheet opt-in is now managed via the dedicated summary sheet section */}

                <div className="mb-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="allow_staff_view"
                      checked={privacySettings.allow_staff_view}
                      onChange={handlePrivacySettingsChange}
                      className="mr-2 h-5 w-5"
                    />
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                      Allow staff to view my insights
                    </span>
                  </label>
                  <p className="text-gray-600 dark:text-gray-400 text-sm ml-7 mt-1">
                    Staff can see insights (but never your full conversations) to improve the system
                  </p>
                </div>

                {/* Processing progress info */}
                {insightsStats && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Insights Processing Progress</h4>
                    <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                      <p><strong>Total quality conversations:</strong> {insightsStats.totalConversations}</p>
                      <p><strong>Already processed:</strong> {insightsStats.alreadyProcessed}</p>
                      <p><strong>Remaining:</strong> {insightsStats.remainingConversations}</p>
                    </div>
                  </div>
                )}

                {/* Generate button */}
                <div className="mt-6">
                  <button
                    onClick={generateInsights}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                    disabled={analyzing}
                  >
                    {analyzing ? "Generating..." : insightsStats?.hasMore ? "Process next conversations" : "Generate Insights"}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Analysis Progress */}
      {analyzing && (
        <div id="analysis-section" className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6 print-hide">
          <h2 className="text-xl font-semibold mb-4">
            {jobId?.startsWith('summary-') ? 'Generating Summary Sheet' : analyzing ? 'Generating Warm Handoff Summary' : 'Generating Insights'}
          </h2>

          <div>
            <p className="mb-4 text-gray-700 dark:text-gray-300">
              {jobStatus === 'pending' && 'Preparing to analyze your conversations...'}
              {jobStatus === 'processing' && `Processing batch: ${processedConversations}/${Math.min(totalConversations, 10)} conversations...`}
              {jobStatus === 'completed' && (
                jobId?.startsWith('summary-')
                  ? 'Summary sheet generation complete!'
                  : 'Analysis complete! Loading your insights...'
              )}
              {jobStatus === 'failed' && (
                jobId?.startsWith('summary-')
                  ? 'Summary sheet generation failed. Please try again.'
                  : 'Analysis failed. Please try again.'
              )}
            </p>

            {/* Progress bar */}
            <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-2.5 mb-4">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                style={{ width: `${jobProgress}%` }}
              ></div>
            </div>

            {/* Detailed progress */}
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-4">
              <span>
                {analyzing && !jobId ?
                  `Processing batch: ${processedConversations} of ${Math.min(totalConversations, 10)} conversations` :
                  `${processedConversations} of ${Math.min(totalConversations, 10)} conversations processed this batch`
                }
              </span>
              <span>{jobProgress}% complete</span>
            </div>

            {jobStatus !== 'completed' && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                This may take several minutes for large conversation histories.
                You can leave this page and come back later - processing will continue in the background.
              </p>
            )}

            {jobStatus === 'completed' && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Processing completed successfully!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Generated Insights Display - Always show if we have insights, regardless of opt-in status */}
      {insights && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-lg shadow-md mb-6 print-hide">
          <div className="flex justify-between items-center cursor-pointer" onClick={() => setInsightsPanelExpanded(!insightsPanelExpanded)}>
            <h2 className="text-xl font-semibold">Your Insights</h2>
            <div className="flex space-x-2 items-center">
              {optedIn && (
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent triggering the parent's onClick
                    generateInsights();
                  }}
                  className="text-blue-500 hover:text-blue-700 text-sm mr-2"
                >
                  Refresh
                </button>
              )}
              {/* Feedback button commented out since its functionality is not in use */}
              {/* <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFeedbackForm(true);
                }}
                className="text-blue-500 hover:text-blue-700 text-sm mr-2"
              >
                Give Feedback
              </button> */}
              <span className="text-gray-700 dark:text-gray-300">{insightsPanelExpanded ? '▲' : '▼'}</span>
            </div>
          </div>

          {insightsPanelExpanded && (
            <>
              <div className="mb-4 text-gray-700 dark:text-gray-300">
                <p>See your patterns, strengths, and coping strategies in your language. This section organized around personally meaningful areas (strengths, goals, coping) vs. the clinical/AI optimization data in other sections. &apos;Your Insights&apos; is for personal development and self-understanding, while &apos;AI Remembers&apos; improves AI&apos;s ability to help you, and &apos;Warm Handoff&apos; creates professional summaries for healthcare providers.</p>
              </div>
              <div className="border-l-2 border-blue-500 dark:border-blue-600 pl-3 py-2 mt-4 mb-6">
                <p className="text-blue-700 dark:text-blue-300 font-medium flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  Generated on: {new Date(insights.generated_at).toLocaleDateString()} at {new Date(insights.generated_at).toLocaleTimeString()}
                </p>
              </div>

              {!optedIn && (
                <div className="border-l-2 border-yellow-400 dark:border-yellow-600 pl-3 py-2 mb-6">
                  <p className="text-yellow-700 dark:text-yellow-300 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                      <line x1="12" y1="9" x2="12" y2="13"></line>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    You&apos;re viewing previously generated insights. To refresh or generate new insights, enable insights in Privacy Settings above.
                  </p>
                </div>
              )}

              <div className="prose prose-blue dark:prose-invert max-w-none">
                {renderInsightItems(insights.insights.strengths, "Strengths You've Shown", "💪")}
                {renderInsightItems(insights.insights.goals, "Your Goals & Priorities", "🎯")}
                {renderInsightItems(insights.insights.coping, "Helpful Coping Strategies", "🧠")}
                {renderInsightItems(insights.insights.resources, "Resources You've Explored", "📚")}

                {(!optedIn || privacySettings.insights_categories.includes('risk')) &&
                  renderInsightItems(insights.insights.risks, "Signs of Distress", "⚠️")}

                {(!optedIn || privacySettings.insights_categories.includes('engagement')) &&
                  renderInsightItems(insights.insights.engagement, "How You Communicate", "💬")}
              </div>

              {insights.conversation_count > 0 && (
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-6">
                  Based on {insights.conversation_count} conversations and {insights.message_count} messages.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Summary Sheet for Warm Handoff section */}
      {insights && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-lg shadow-md mb-6 print-hide">
          <div className="flex justify-between items-center cursor-pointer" onClick={() => setWarmHandoffPanelExpanded(!warmHandoffPanelExpanded)}>
            <h2 className="text-xl font-semibold">Summary Sheet for Warm Handoff</h2>
            <span className="text-gray-700 dark:text-gray-300">{warmHandoffPanelExpanded ? '▲' : '▼'}</span>
          </div>

          {warmHandoffPanelExpanded && (
            <div className="mt-4">
              <p className="mb-4 text-gray-700 dark:text-gray-300">
                Generate a concise summary sheet that can be shared with healthcare providers or support professionals to facilitate a warm handoff.
              </p>
              <div className="space-y-4">
                {/* Processing progress info */}
                {warmHandoffStats && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Warm Handoff Processing Progress</h4>
                    <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                      <p><strong>Total quality conversations:</strong> {warmHandoffStats.totalConversations}</p>
                      <p><strong>Already processed:</strong> {warmHandoffStats.alreadyProcessed}</p>
                      <p><strong>Remaining:</strong> {warmHandoffStats.remainingConversations}</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={async (e) => {
                    e.stopPropagation(); // Prevent triggering the parent's onClick
                    setError(null);

                    // Clear any previous data and start processing
                    setAnalyzing(true);
                    setSummarySheetData(null);

                    // Auto-collapse other panels to keep progress visible
                    setPrivacyPanelExpanded(false);
                    setInsightsPanelExpanded(false);
                    setAiRemembersPanelExpanded(false);
                    // Keep warm handoff panel expanded
                    setWarmHandoffPanelExpanded(true);

                    // Set processing status and show expected batch size
                    setJobStatus('processing');
                    setProcessedConversations(0);
                    setTotalConversations(10); // We know we're processing up to 10 this batch
                    setJobProgress(10);

                    // Scroll to progress section after panels collapse
                    setTimeout(() => {
                      document.getElementById('analysis-section')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                      });
                    }, 100);

                    try {
                      // Get the current user's ID token for authentication
                      let idToken = '';
                      try {
                        idToken = await user?.getIdToken() || '';
                      } catch (tokenErr) {
                        console.error('Error getting user ID token:', tokenErr);
                        // Continue without token, will use userId param as fallback
                      }

                      // Show progress as we start
                      setJobProgress(25);
                      setProcessedConversations(2);

                      // Call the V15 API - no offset needed, API handles processed conversations tracking
                      const response = await fetch('/api/v15/generate-summary-sheet', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
                        },
                        body: JSON.stringify({
                          userId: user?.uid || '',
                          formatOptions: {
                            includeCategories: privacySettings.insights_categories,
                            title: 'Warm Hand-off Summary',
                            footer: 'This summary was generated to help facilitate a warm hand-off to a support provider.'
                          }
                        })
                      });

                      if (response.ok) {
                        const data = await response.json();

                        if (data.success) {
                          // V15 endpoint returns data immediately, no job polling needed
                          // Keep progress visible for 2 seconds so user can see results
                          setTimeout(() => {
                            setAnalyzing(false);
                            // Optional: Re-expand panels after processing completes
                            // setPrivacyPanelExpanded(true);
                            // setInsightsPanelExpanded(true);
                            // setAiRemembersPanelExpanded(true);
                          }, 2000);

                          // Save summary sheet data to state
                          setSummarySheetData({
                            url: data.url,
                            content: data.summaryContent,
                            sharingToken: data.sharingToken
                          });

                          // Update warm handoff stats with real data from memory-pattern API
                          if (data.stats) {
                            const stats = data.stats;

                            // Update progress display with actual API data
                            setProcessedConversations(stats.processedThisBatch || 0);
                            setTotalConversations(stats.processedThisBatch || 10);
                            setJobProgress(100);
                            setJobStatus('completed');

                            // Update warm handoff stats (following memory system pattern)
                            setWarmHandoffStats({
                              totalConversations: stats.totalConversationsFound || 0,
                              alreadyProcessed: stats.alreadyProcessed || 0,
                              remainingConversations: stats.remainingConversations || 0,
                              hasMore: stats.hasMore || false
                            });

                            const statisticsMessage = `Processing ${stats.processedThisBatch || 0} conversations this batch`;
                            console.log('[warm_handoff] Processing statistics:', statisticsMessage);

                            if (stats.remainingConversations > 0) {
                              console.log('[warm_handoff]', `${stats.remainingConversations} conversations remaining for processing`);
                            } else {
                              console.log('[warm_handoff] All conversations have been processed');
                            }
                          }

                          // Scroll to the summary section
                          window.setTimeout(() => {
                            document.getElementById('summary-sheet-section')?.scrollIntoView({
                              behavior: 'smooth'
                            });
                          }, 300);
                        } else {
                          throw new Error(data.error || 'Summary sheet generation failed');
                        }
                      } else {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Failed to generate summary sheet');
                      }
                    } catch (err) {
                      console.error('Error generating summary sheet:', err);
                      setError(err instanceof Error ? err.message : String(err));
                      setAnalyzing(false);
                      // Optional: Re-expand panels after error
                      // setPrivacyPanelExpanded(true);
                      // setInsightsPanelExpanded(true);
                      // setAiRemembersPanelExpanded(true);
                    }
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                  disabled={analyzing}
                >
                  {analyzing ? "Generating..." : warmHandoffStats?.hasMore ? "Process next conversations" : "Generate warm handoff summary"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary Sheet Results Display */}
      {summarySheetData && (
        <div id="summary-sheet-section" className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">Generated Summary Sheet</h2>

          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium text-green-800 dark:text-green-200">Summary Generated Successfully!</span>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                Your warm handoff summary has been generated and is ready to share with your healthcare provider.
              </p>
              <div className="flex space-x-3">
                <a
                  href={summarySheetData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
                >
                  View Summary Sheet
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.origin + summarySheetData.url);
                    // Could add a toast notification here
                  }}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm"
                >
                  Copy Link
                </button>
              </div>
            </div>

            {/* Preview of summary content */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="font-medium mb-2">Summary Preview:</h3>
              <div className="text-sm text-gray-700 dark:text-gray-300 max-h-40 overflow-y-auto">
                {summarySheetData.content.content.split('\n').slice(0, 5).map((line, index) => (
                  <p key={index} className="mb-1">{line}</p>
                ))}
                {summarySheetData.content.content.split('\n').length > 5 && (
                  <p className="text-gray-500 dark:text-gray-400 italic">... (view full summary at link above)</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* What AI Remembers section */}
      {insights && (
        <div id="ai-remembers-section" className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-lg shadow-md mb-6 print-hide">
          <div className="flex justify-between items-center cursor-pointer" onClick={() => setAiRemembersPanelExpanded(!aiRemembersPanelExpanded)}>
            <h2 className="text-xl font-semibold">What AI Remembers</h2>
            <div className="flex space-x-2 items-center">
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Prevent triggering the parent's onClick
                  refreshUserProfile();
                }}
                disabled={profileLoading}
                className="text-blue-500 hover:text-blue-700 text-sm mr-2"
              >
                {profileLoading ? 'Refreshing...' : 'Refresh'}
              </button>
              <span className="text-gray-700 dark:text-gray-300">{aiRemembersPanelExpanded ? '▲' : '▼'}</span>
            </div>
          </div>

          {aiRemembersPanelExpanded && (
            <div className="mt-4">
              <p className="mb-4 text-gray-700 dark:text-gray-300">
                This section shows what the AI has learned about you through your conversations.
                This information helps the AI provide more personalized assistance.
              </p>

              {profileError && (
                <div className="bg-red-100 dark:bg-red-900 p-4 rounded-md mb-4">
                  <p className="text-red-700 dark:text-red-300">{profileError}</p>
                </div>
              )}

              {/* Profile Processing Progress */}
              {profileLoading && profileJobStatus && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
                  <h3 className="text-lg font-medium mb-3">Processing Profile</h3>

                  <div>
                    <p className="mb-4 text-gray-700 dark:text-gray-300">
                      {profileJobStatus === 'pending' && 'Preparing to analyze your conversations...'}
                      {profileJobStatus === 'processing' && `Processing your conversations (${profileProcessedConversations}/${profileTotalConversations})...`}
                      {profileJobStatus === 'completed' && 'Analysis complete! Loading your profile...'}
                      {profileJobStatus === 'failed' && 'Analysis failed. Please try again.'}
                    </p>

                    {/* Progress bar */}
                    <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-2.5 mb-4">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                        style={{ width: `${profileJobProgress}%` }}
                      ></div>
                    </div>

                    {/* Detailed progress */}
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {profileTotalConversations > 0 && (
                        <span>{profileProcessedConversations} of {profileTotalConversations} conversations processed</span>
                      )}
                      <span>{profileJobProgress}% complete</span>
                    </div>
                  </div>
                </div>
              )}

              {profileLoading && !profileJobStatus ? (
                <div className="flex justify-center items-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : userProfile ? (
                <div className="space-y-4">
                  {/* Last updated info */}
                  <div className="border-l-2 border-blue-500 dark:border-blue-600 pl-3 py-2 mb-4">
                    <p className="text-blue-700 dark:text-blue-300 text-sm flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      Last updated: {new Date(userProfile.lastUpdated).toLocaleDateString()} at {new Date(userProfile.lastUpdated).toLocaleTimeString()}
                    </p>
                  </div>


                  {/* Profile content */}
                  {Object.keys(userProfile?.profile || {}).length > 0 ? (
                    <div className="space-y-4 max-w-none">
                      {/* Using our flexible UserProfileDisplay component */}
                      <UserProfileDisplay
                        profileData={userProfile.profile}
                        lastUpdated={userProfile.lastUpdated}
                      />
                    </div>
                  ) : (
                    <div className="text-gray-700 dark:text-gray-400 italic py-2">
                      No profile data available yet. Have more conversations to help the AI learn about you.
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-yellow-700 dark:text-yellow-300">
                    No profile data available yet. Have more conversations to help the AI learn about you.
                  </p>
                  <button
                    onClick={refreshUserProfile}
                    className="mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
                  >
                    Generate Profile
                  </button>
                </div>
              )}

              {/* Profile Analysis Controls - clear memory, etc */}
              {userProfile && (
                <div className="mt-6 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-3">Profile Controls</h3>
                  <div className="flex space-x-3">
                    <button
                      onClick={refreshUserProfile}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
                      disabled={profileLoading}
                    >
                      {profileLoading ? 'Processing...' : 'Refresh Profile'}
                    </button>

                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      disabled={profileLoading}
                    >
                      Clear Memory
                    </button>
                  </div>

                  {/* Clear confirmation dialog */}
                  {showClearConfirm && (
                    <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <p className="text-red-700 dark:text-red-300 font-medium">
                        Are you sure you want to clear what the AI remembers about you?
                      </p>
                      <p className="my-2 text-red-600 dark:text-red-400 text-sm">
                        This action cannot be undone. The AI will start with a blank memory about you.
                      </p>
                      <div className="flex space-x-3 mt-3">
                        <button
                          onClick={() => setShowClearConfirm(false)}
                          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            clearUserProfile();
                            setShowClearConfirm(false);
                          }}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
                          disabled={clearInProgress}
                        >
                          {clearInProgress ? 'Clearing...' : 'Yes, Clear Memory'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}