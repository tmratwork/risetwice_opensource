// src/app/chatbotV15/sleep/page.tsx

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import UserProfileDisplay from '@/components/UserProfileDisplay';
import '../../chatbotV11/chatbotV11.css'; // Import the shared CSS file

interface Book {
  id: string;
  title: string;
  author: string;
}

interface Quest {
  id: string;
  book_id: string;
  chapter_number: number;
  chapter_title: string;
  quest_title: string;
  introduction: string;
  challenge: string;
  reward: string;
  starting_question: string;
  ai_prompt?: string;
  status?: 'not_started' | 'active' | 'completed';
  completion_date?: string | null;
}

// Insights interfaces
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
  [key: string]: string | number | string[] | number[] | Record<string, unknown> | undefined;
}

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
  } | undefined;
}

interface UserProfile {
  profile: {
    [category: string]: ProfileCategory;
  };
  lastUpdated: string | number;
}

export default function SleepV15Page() {
  const router = useRouter();
  const { user } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<'modules' | 'insights'>('modules');

  // Quests state
  const [, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<string>('');
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Insights state
  const [insights, setInsights] = useState<UserInsightData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
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
  const [optedIn, setOptedIn] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Panel expansion states
  const [privacyPanelExpanded, setPrivacyPanelExpanded] = useState(true);
  const [insightsPanelExpanded, setInsightsPanelExpanded] = useState(true);
  const [warmHandoffPanelExpanded, setWarmHandoffPanelExpanded] = useState(true);
  const [aiRemembersPanelExpanded, setAiRemembersPanelExpanded] = useState(true);

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

  // Summary sheet state
  const [summarySheetData, setSummarySheetData] = useState<{
    url: string;
    content: Record<string, unknown>;
    sharingToken: string;
  } | null>(null);

  // Clear profile states
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearInProgress, setClearInProgress] = useState(false);
  const [clearTrackerOption, setClearTrackerOption] = useState(false);

  // Categories for consent checkboxes
  const insightCategories = [
    { id: 'strength', label: 'Strengths I\'ve shown', description: 'Times when the AI noted your strength, courage, or skills.' },
    { id: 'goal', label: 'My goals and priorities', description: 'Goals or important values you\'ve mentioned.' },
    { id: 'coping', label: 'Helpful coping strategies', description: 'Coping skills that have worked well for you.' },
    { id: 'resource', label: 'Resources I\'ve explored', description: 'Support resources you\'ve learned about or tried.' },
    { id: 'risk', label: 'Signs of distress', description: 'Times when you may have been struggling or in distress.' },
    { id: 'engagement', label: 'Conversation patterns', description: 'How you engage in conversations (like preferred topics).' }
  ];

  // Fetch user ID from localStorage on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserId = localStorage.getItem('userId');
      if (storedUserId) {
        setUserId(storedUserId);
      }

      // Check if there's a book ID in localStorage
      const storedBookId = localStorage.getItem('selectedBookId');
      // console.log('Found book ID in localStorage:', storedBookId);

      if (storedBookId) {
        setSelectedBook(storedBookId);
      } else {
        setError('No book selected. Please select a book from the header first.');
      }
    }
  }, []);

  // Fetch books when component mounts
  useEffect(() => {
    async function fetchBooks() {
      try {
        const response = await fetch('/api/v11/books');
        if (!response.ok) {
          throw new Error('Failed to fetch books');
        }
        const data = await response.json();
        setBooks(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch books');
      }
    }

    fetchBooks();
  }, []);

  // Function to fetch quests (using same quest system as mental-health)
  const fetchQuests = useCallback(async (bookId: string) => {
    setLoading(true);
    setError(null);
    try {
      // console.log('Fetching quests for book ID:', bookId);

      const url = userId
        ? `/api/v11/quests?book_id=${bookId}&user_id=${userId}`
        : `/api/v11/quests?book_id=${bookId}`;

      // console.log('Fetch URL:', url);

      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        // console.error('Quest fetch error:', errorText);
        throw new Error(`Failed to fetch quests (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      // console.log('Fetched quests:', data.length);
      setQuests(data);
    } catch (err) {
      // console.error('Quest fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch quests');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch quests when selectedBook changes
  useEffect(() => {
    if (selectedBook) {
      fetchQuests(selectedBook);
    }
  }, [selectedBook, fetchQuests]);

  // Function to start a quest
  const startQuest = async (questId: string) => {
    if (!userId) {
      setError('You must be logged in to start a quest');
      return;
    }

    try {
      // Mark the quest as active
      const response = await fetch('/api/v11/quests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          quest_id: questId,
          status: 'active',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start module');
      }

      // Find the full quest object from our state
      const fullQuestObject = quests.find(quest => quest.id === questId);

      if (!fullQuestObject) {
        throw new Error('Module data not found');
      }

      // console.log('🚀 Passing quest data to V15 chatbot page:', {
      //   id: fullQuestObject.id,
      //   title: fullQuestObject.quest_title,
      //   hasAiPrompt: !!fullQuestObject.ai_prompt,
      //   ai_prompt: fullQuestObject.ai_prompt
      // });

      // Store the full quest object in sessionStorage
      sessionStorage.setItem('currentQuestData', JSON.stringify(fullQuestObject));

      // Navigate to the V15 chatbot page
      router.push('/chatbotV15');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start module');
    }
  };

  // Function to mark a quest as completed
  const completeQuest = async (questId: string) => {
    if (!userId) {
      setError('You must be logged in to complete a quest');
      return;
    }

    try {
      const response = await fetch('/api/v11/quests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          quest_id: questId,
          status: 'completed',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete quest');
      }

      // Refresh quests to show updated status
      fetchQuests(selectedBook);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete quest');
    }
  };

  // Fetch insights for the insights tab
  const fetchInsights = async () => {
    if (!user) return;

    try {
      setInsightsLoading(true);
      setInsightsError(null);

      let idToken = '';
      try {
        idToken = await user?.getIdToken() || '';
      } catch (tokenErr) {
        // console.error('Error getting user ID token:', tokenErr);
        void tokenErr; // Avoid unused variable error
      }

      const response = await fetch(`/api/v11/user-insights?userId=${user?.uid || ''}&bypassOptIn=true`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.insights) {
          setInsights(data.insights);
        }
      } else if (response.status === 404) {
        // console.log('No insights found for user');
        setInsights(null);
      } else {
        throw new Error('Failed to fetch insights');
      }
    } catch (err) {
      // console.error('Error fetching insights:', err);
      setInsightsError(err instanceof Error ? err.message : String(err));
    } finally {
      setInsightsLoading(false);
    }
  };

  // Fetch user profile
  const fetchUserProfile = async () => {
    if (!user) return;

    try {
      setProfileLoading(true);
      setProfileError(null);

      let idToken = '';
      try {
        idToken = await user?.getIdToken() || '';
      } catch {
        // console.error('Error getting user ID token for profile fetch:', tokenErr);
      }

      const response = await fetch(`/api/v15/user-profile?userId=${user?.uid || ''}`, {
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
        // console.log('No user profile found');
        setUserProfile(null);
      } else {
        throw new Error('Failed to fetch user profile');
      }
    } catch (err) {
      // console.error('Error fetching user profile:', err);
      setProfileError(err instanceof Error ? err.message : String(err));
    } finally {
      setProfileLoading(false);
    }
  };

  // Load insights data when switching to insights tab
  useEffect(() => {
    if (activeTab === 'insights' && user) {
      // console.log('[UI-INSIGHTS] Loading insights tab data');
      loadInsightsData();
    }
  }, [activeTab, user]);

  // Complete insights data loading function
  const loadInsightsData = async () => {
    if (!user) return;

    setInsightsLoading(true);

    try {
      // Load cached insights first
      try {
        const cachedInsights = localStorage.getItem(`user_insights_${user?.uid || ''}`);
        if (cachedInsights) {
          // console.log('Found cached insights in localStorage');
          setInsights(JSON.parse(cachedInsights));
        }
      } catch {
        // console.error('Error reading cached insights:', 'storageErr');
      }

      // Fetch user profile
      fetchUserProfile();

      // Load privacy settings
      try {
        const cachedSettings = localStorage.getItem(`privacy_settings_${user?.uid || ''}`);
        if (cachedSettings) {
          // console.log('Found cached privacy settings in localStorage');
          const parsedSettings = JSON.parse(cachedSettings);
          setPrivacySettings(parsedSettings);
          setOptedIn(parsedSettings.insights_opt_in);
        }
      } catch {
        // console.error('Error reading cached privacy settings:', 'storageErr');
      }

      // Get ID token for API calls
      let idToken = '';
      try {
        idToken = await user?.getIdToken() || '';
      } catch (tokenErr) {
        // console.error('Error getting user ID token:', tokenErr);
        void tokenErr; // Avoid unused variable error
      }

      // Fetch latest privacy settings from API
      const privacyResponse = await fetch(`/api/v11/user-privacy-settings?userId=${user?.uid || ''}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        }
      });

      if (privacyResponse.ok) {
        const privacyData = await privacyResponse.json();
        try {
          localStorage.setItem(`privacy_settings_${user?.uid || ''}`, JSON.stringify(privacyData.settings));
        } catch {
          // console.error('Error saving privacy settings to localStorage:', 'storageErr');
        }
        setPrivacySettings(privacyData.settings);
        setOptedIn(privacyData.settings.insights_opt_in);
      }

      // Direct load insights
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
          // console.log('Successfully retrieved insights:', directData.insights.id);
          setInsights(directData.insights);
          try {
            localStorage.setItem(`user_insights_${user?.uid || ''}`, JSON.stringify(directData.insights));
          } catch {
            // console.error('Error saving insights to localStorage:', 'storageErr');
          }
        }
      }

      // Load latest summary sheet
      const summaryResponse = await fetch(`/api/v11/user-insights/summary-sheet?userId=${user?.uid}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        }
      });

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        if (summaryData.summarySheet && !summaryData.expired) {
          setSummarySheetData({
            url: `/share/summary/${summaryData.summarySheet.sharing_token}`,
            content: summaryData.summarySheet.summary_content,
            sharingToken: summaryData.summarySheet.sharing_token
          });
        }
      }
    } catch (err) {
      // console.error('Error loading insights data:', err);
      setInsightsError(err instanceof Error ? err.message : String(err));
    } finally {
      setInsightsLoading(false);
    }
  };

  // Handle privacy settings changes
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

    // Update state immediately
    setPrivacySettings(updatedSettings);
    if (name === 'insights_opt_in') {
      setOptedIn(checked);
    }

    // Save to localStorage
    try {
      localStorage.setItem(`privacy_settings_${user?.uid || ''}`, JSON.stringify(updatedSettings));
    } catch (storageErr) {
      // console.error('Error saving privacy settings to localStorage:', storageErr);
      void storageErr;
    }

    try {
      let idToken = '';
      if (user) {
        try {
          idToken = await user?.getIdToken() || '';
        } catch {
          // console.error('Error getting user ID token:', tokenErr);
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
        // console.log('Privacy settings successfully updated');
        if (name === 'insights_opt_in' && checked) {
          await fetchInsights();
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update privacy settings');
      }
    } catch (err) {
      // console.error('Error updating privacy settings:', err);
      setInsightsError(err instanceof Error ? err.message : String(err));
    }
  };

  // Generate insights function
  const generateInsights = async () => {
    if (!user) return;

    try {
      setAnalyzing(true);
      setInsightsError(null);
      setJobId(null);
      setJobProgress(0);
      setJobStatus(null);

      let idToken = '';
      try {
        idToken = await user?.getIdToken() || '';
      } catch (tokenErr) {
        // console.error('Error getting user ID token:', tokenErr);
        void tokenErr; // Avoid unused variable error
      }

      const response = await fetch('/api/preprocessing/user-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          userId: user?.uid || '',
          insightTypes: privacySettings.insights_categories
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.jobId) {
          setJobId(data.jobId);
          setJobStatus('pending');
          setTotalConversations(data.totalConversations || 0);
          startPollingJobStatus(data.jobId);
        } else {
          throw new Error('No job ID returned from server');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate insights');
      }
    } catch (err) {
      // console.error('Error generating insights:', err);
      setInsightsError(err instanceof Error ? err.message : String(err));
      setAnalyzing(false);
    }
  };

  // Job polling functions
  const startPollingJobStatus = (id: string) => {
    pollJobStatus(id);
  };

  // Setup polling effect
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (jobId && analyzing) {
      intervalId = setInterval(() => {
        pollJobStatus(jobId);
      }, 2000);
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [jobId, analyzing]);

  const pollJobStatus = async (id: string) => {
    try {
      let idToken = '';
      if (user) {
        try {
          idToken = await user?.getIdToken() || '';
        } catch {
          // console.error('Error getting user ID token for polling:', tokenErr);
        }
      }

      const isSummaryJob = id.startsWith('summary-');
      const endpoint = isSummaryJob
        ? `/api/v11/generate-summary-sheet?jobId=${id}`
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
          setAnalyzing(false);
          if (isSummaryJob) {
            if (data.url && data.summaryContent) {
              setSummarySheetData({
                url: data.url,
                content: data.summaryContent,
                sharingToken: data.sharingToken
              });
            }
          } else if (data.insights) {
            if (user) {
              try {
                localStorage.setItem(`user_insights_${user?.uid || ''}`, JSON.stringify(data.insights));
                setInsights(data.insights);
              } catch {
                // console.error('Error saving insights to localStorage:', 'storageErr');
              }
            }
            await fetchInsights();
          }
        } else if (data.status === 'failed') {
          setAnalyzing(false);
          setInsightsError(data.error || (isSummaryJob ? 'Summary sheet generation failed' : 'Insights processing failed'));
        }
      } else {
        setAnalyzing(false);
        const errorData = await response.json();
        setInsightsError(errorData.error || 'Failed to check job status');
      }
    } catch {
      // console.error('Error polling job status:', err);
    }
  };

  // Refresh user profile function
  const refreshUserProfile = async () => {
    if (!user) return;

    try {
      setProfileLoading(true);
      setProfileError(null);
      setProfileJobId(null);
      setProfileJobProgress(0);
      setProfileJobStatus(null);
      setProfileProcessedConversations(0);
      setProfileTotalConversations(0);

      let idToken = '';
      try {
        idToken = await user?.getIdToken() || '';
      } catch {
        // console.error('Error getting user ID token for profile refresh:', tokenErr);
      }

      const response = await fetch('/api/v15/process-user-memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          userId: user?.uid || ''
        })
      });

      const data = await response.json();
      // console.log('Memory processing result:', data);

      if (response.ok) {
        if (data.jobId) {
          setProfileJobId(data.jobId);
          setProfileJobStatus('pending');
          setProfileTotalConversations(data.totalConversations || 0);
          pollProfileJobStatus(data.jobId);
        } else {
          if (data.userProfileUpdated) {
            fetchUserProfile();
          } else {
            fetchUserProfile();
          }
          setProfileLoading(false);
        }
      } else {
        let errorMessage = data.error || 'Failed to process user memory';
        if (data.details && data.details.error) {
          errorMessage += `: ${data.details.error}`;
        }
        // console.error('Error details from API:', data);

        // Check for failed conversations that need developer attention
        if (data.results && Array.isArray(data.results)) {
          const failedConversations = data.results.filter((result: { success: boolean; conversationId: string; error?: string }) => !result.success);
          if (failedConversations.length > 0) {
            const conversationIds = failedConversations.map((conv: { conversationId: string }) => conv.conversationId);
            alert(`Memory processing failed for ${failedConversations.length} conversation(s). Please provide these conversation IDs to the developer:\n\n${conversationIds.join('\n')}\n\nThis will help resolve the memory processing issue.`);
          }
        }

        setProfileError(errorMessage);
        setProfileLoading(false);
        throw new Error(errorMessage);
      }
    } catch (err) {
      // console.error('Error refreshing user profile:', err);

      // If this is a network or API error, alert user to contact developer
      if (err instanceof Error && (err.message.includes('fetch') || err.message.includes('Failed to process user memory'))) {
        alert(`Memory processing system error. Please contact the developer with this error message:\n\n${err.message}\n\nInclude the time this error occurred for better debugging.`);
      }

      if (!profileError) {
        setProfileError(err instanceof Error ? err.message : String(err));
      }
      setProfileLoading(false);
    }
  };

  // Profile job polling
  const pollProfileJobStatus = async (id: string) => {
    try {
      let idToken = '';
      if (user) {
        try {
          idToken = await user?.getIdToken() || '';
        } catch {
          // console.error('Error getting user ID token for profile polling:', tokenErr);
        }
      }

      const response = await fetch(`/api/v11/process-user-memory?jobId=${id}`, {
        headers: {
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProfileJobProgress(data.progress || 0);
        setProfileJobStatus(data.status);
        setProfileProcessedConversations(data.processedConversations || 0);
        setProfileTotalConversations(data.totalConversations || 0);

        if (data.status === 'completed') {
          setProfileLoading(false);
          fetchUserProfile();
        } else if (data.status === 'failed') {
          setProfileLoading(false);
          setProfileError(data.error || 'Profile processing failed');
        }
      } else {
        setProfileLoading(false);
        const errorData = await response.json();
        setProfileError(errorData.error || 'Failed to check profile job status');
      }
    } catch {
      // console.error('Error polling profile job status:', err);
    }
  };

  // Setup profile polling effect
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (profileJobId && profileLoading) {
      intervalId = setInterval(() => {
        pollProfileJobStatus(profileJobId);
      }, 2000);
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [profileJobId, profileLoading]);

  // Clear user profile function
  const clearUserProfile = async () => {
    if (!user) return;

    try {
      setClearInProgress(true);
      setProfileError(null);

      let idToken = '';
      try {
        idToken = await user?.getIdToken() || '';
      } catch {
        // console.error('Error getting user ID token for profile clear:', tokenErr);
      }

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
        await response.json();
        // console.log('Profile clearing result:', data);
        fetchUserProfile();
        setShowClearConfirm(false);
        setClearTrackerOption(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear user profile');
      }
    } catch (err) {
      // console.error('Error clearing user profile:', err);
      setProfileError(err instanceof Error ? err.message : String(err));
    } finally {
      setClearInProgress(false);
    }
  };

  // Render insight items
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

  // Separate active quests from other quests
  const activeQuests = quests.filter(quest => quest.status === 'active');
  const otherQuests = quests.filter(quest => quest.status !== 'active');

  return (
    <div className="container mx-auto px-4 py-8 pt-20 bg-white dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
        Sleep Wellness Modules
      </h1>

      {/* Main content area */}
      <div className="mb-32 pb-16">
        {activeTab === 'modules' && (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-100 border border-red-200 dark:border-red-700 rounded-md">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <>
                {selectedBook && quests.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-300">
                    No sleep modules available
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Active Quests Section */}
                    <div>
                      <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 border-b border-gray-300 dark:border-gray-700 pb-2">
                        In Progress
                      </h2>
                      {activeQuests.length === 0 ? (
                        <div className="text-center py-4 text-gray-500 dark:text-gray-300">
                          You have no active sleep modules. Start a new module below!
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {activeQuests.map((quest) => (
                            <QuestCard
                              key={quest.id}
                              quest={quest}
                              onStart={() => startQuest(quest.id)}
                              onComplete={() => completeQuest(quest.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Other Quests Section */}
                    <div>
                      <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 border-b border-gray-300 dark:border-gray-700 pb-2">
                        Available
                      </h2>
                      {otherQuests.length === 0 ? (
                        <div className="text-center py-4 text-gray-500 dark:text-gray-300">
                          No other sleep modules available
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {otherQuests.map((quest) => (
                            <QuestCard
                              key={quest.id}
                              quest={quest}
                              onStart={() => startQuest(quest.id)}
                              onComplete={() => completeQuest(quest.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'insights' && (
          <div>
            {!user ? (
              <div className="bg-red-100 dark:bg-red-900 p-6 rounded-lg shadow-md">
                <p className="text-red-700 dark:text-red-300">
                  Authentication required. Please sign in to view insights.
                </p>
              </div>
            ) : (
              <>
                {insightsError && (
                  <div className="bg-red-100 dark:bg-red-900 p-4 rounded-lg mb-6">
                    <p className="text-red-700 dark:text-red-300">{insightsError}</p>
                  </div>
                )}

                {insightsLoading ? (
                  <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <p className="text-gray-700 dark:text-gray-300">Loading...</p>
                  </div>
                ) : (
                  <>
                    {/* Privacy Settings Panel */}
                    <div
                      data-panel="privacy"
                      className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6 print-hide"
                    >
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
                                          updatedSettings.insights_categories = allCategoryIds;
                                        } else {
                                          updatedSettings.insights_categories = [];
                                        }

                                        setPrivacySettings(updatedSettings);

                                        try {
                                          localStorage.setItem(`privacy_settings_${user?.uid || ''}`, JSON.stringify(updatedSettings));
                                        } catch {
                                          // console.error('Error saving privacy settings to localStorage:', 'storageErr');
                                        }

                                        const getTokenAndSendToServer = async () => {
                                          let idToken = '';
                                          if (user) {
                                            try {
                                              idToken = await user?.getIdToken() || '';
                                            } catch {
                                              // console.error('Error getting user ID token for select all:', tokenErr);
                                            }
                                          }

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
                                                // console.log('All categories update saved successfully');
                                              } else {
                                                throw new Error('Failed to update all categories');
                                              }
                                            })
                                            .catch(err => {
                                              // console.error('Error updating privacy settings:', err);
                                              setInsightsError(err instanceof Error ? err.message : String(err));
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

                              <div className="mt-6">
                                <button
                                  onClick={generateInsights}
                                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                                  disabled={analyzing}
                                >
                                  {analyzing ? "Generating..." : "Generate Insights"}
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
                          {jobId?.startsWith('summary-') ? 'Generating Summary Sheet' : 'Generating Insights'}
                        </h2>

                        <div>
                          <p className="mb-4 text-gray-700 dark:text-gray-300">
                            {jobStatus === 'pending' && 'Preparing to analyze your conversations...'}
                            {jobStatus === 'processing' && `Processing your conversations (${processedConversations}/${totalConversations})...`}
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

                          <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-2.5 mb-4">
                            <div
                              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                              style={{ width: `${jobProgress}%` }}
                            ></div>
                          </div>

                          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-4">
                            <span>{processedConversations} of {totalConversations} conversations processed</span>
                            <span>{jobProgress}% complete</span>
                          </div>

                          {jobStatus !== 'completed' && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                              This may take several minutes for large conversation histories.
                              You can leave this page and come back later - processing will continue in the background.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Generated Insights Display */}
                    {insights && (
                      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-lg shadow-md mb-6 print-hide relative z-10">
                        <div className="flex justify-between items-center cursor-pointer" onClick={() => setInsightsPanelExpanded(!insightsPanelExpanded)}>
                          <h2 className="text-xl font-semibold">Your Insights</h2>
                          <div className="flex space-x-2 items-center">
                            {optedIn && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  generateInsights();
                                }}
                                className="text-blue-500 hover:text-blue-700 text-sm mr-2"
                              >
                                Refresh
                              </button>
                            )}
                            <span className="text-gray-700 dark:text-gray-300">{insightsPanelExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>

                        {insightsPanelExpanded && (
                          <>
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

                            <div className="prose prose-blue dark:prose-invert max-w-none max-h-96 overflow-y-auto">
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
                      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-lg shadow-md mb-6 print-hide relative z-10">
                        <div className="flex justify-between items-center cursor-pointer" onClick={() => setWarmHandoffPanelExpanded(!warmHandoffPanelExpanded)}>
                          <h2 className="text-xl font-semibold">Summary Sheet for Warm Handoff</h2>
                          <span className="text-gray-700 dark:text-gray-300">{warmHandoffPanelExpanded ? '▲' : '▼'}</span>
                        </div>

                        {warmHandoffPanelExpanded && (
                          <div className="mt-4">
                            <p className="mb-4 text-gray-700 dark:text-gray-300">
                              Generate a concise summary sheet that can be shared with healthcare providers or support professionals to facilitate a warm handoff.
                            </p>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                setInsightsError(null);
                                setJobId(null);
                                setJobProgress(0);
                                setJobStatus(null);
                                setAnalyzing(true);
                                setSummarySheetData(null);

                                try {
                                  let idToken = '';
                                  try {
                                    idToken = await user?.getIdToken() || '';
                                  } catch {
                                    // console.error('Error getting user ID token:', tokenErr);
                                  }

                                  const response = await fetch('/api/v11/generate-summary-sheet', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
                                    },
                                    body: JSON.stringify({
                                      userId: user?.uid || '',
                                      formatOptions: {
                                        includeCategories: privacySettings.insights_categories,
                                        title: 'Sleep Wellness Hand-off Summary',
                                        footer: 'This summary was generated to help facilitate a warm hand-off to a sleep specialist or support provider.'
                                      }
                                    })
                                  });

                                  if (response.ok) {
                                    const data = await response.json();
                                    if (data.jobId) {
                                      setJobId(data.jobId);
                                      setJobStatus('pending');
                                      setTotalConversations(data.totalConversations || 0);
                                      startPollingJobStatus(data.jobId);
                                    } else {
                                      throw new Error('No job ID returned from server');
                                    }
                                  } else {
                                    const errorData = await response.json();
                                    throw new Error(errorData.error || 'Failed to generate summary sheet');
                                  }
                                } catch (err) {
                                  // console.error('Error generating summary sheet:', err);
                                  setInsightsError(err instanceof Error ? err.message : String(err));
                                  setAnalyzing(false);
                                }
                              }}
                              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                              disabled={analyzing}
                            >
                              {analyzing ? "Generating..." : "Generate summary sheet"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Generated Summary Sheet Display */}
                    {summarySheetData && (
                      <div id="summary-sheet-section" className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-lg shadow-md mb-6 relative z-10">
                        <div className="flex justify-between items-center mb-6">
                          <h2 className="text-xl font-semibold">{(summarySheetData.content as { title?: string }).title || 'Summary Sheet'}</h2>
                          <div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(window.location.origin + summarySheetData.url);
                                // You could add a toast notification here
                              }}
                              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                              title="Copy link to clipboard"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 dark:text-gray-300">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-between items-center mb-6">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Generated on {new Date((summarySheetData.content as { generatedAt?: string }).generatedAt || Date.now()).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            Available for sharing for 30 days
                          </p>
                        </div>

                        <div className="prose prose-blue dark:prose-invert max-w-none max-h-96 overflow-y-auto">
                          {formatSummaryContent((summarySheetData.content as { content?: string }).content || '')}
                        </div>

                        {(summarySheetData.content as { customNotes?: string }).customNotes && (
                          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-medium mb-3">Additional Notes</h3>
                            <p className="text-gray-700 dark:text-gray-300">{(summarySheetData.content as { customNotes?: string }).customNotes}</p>
                          </div>
                        )}

                        {(summarySheetData.content as { stats?: { conversationCount?: number; messageCount?: number } }).stats && (
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-6">
                            Based on {(summarySheetData.content as { stats?: { conversationCount?: number; messageCount?: number } }).stats?.conversationCount || 0} conversations and {(summarySheetData.content as { stats?: { conversationCount?: number; messageCount?: number } }).stats?.messageCount || 0} messages.
                          </div>
                        )}

                        <div className="mt-10 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
                          {(summarySheetData.content as { footer?: string }).footer || 'This summary was generated to help facilitate a warm hand-off to a sleep specialist or support provider.'}
                        </div>
                      </div>
                    )}

                    {/* What AI Remembers section */}
                    {insights && (
                      <div
                        id="ai-remembers-section"
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-lg shadow-md mb-6 print-hide relative z-10"
                        style={{
                          position: 'relative',
                          zIndex: 10
                        }}
                      >
                        <div className="flex justify-between items-center cursor-pointer" onClick={() => setAiRemembersPanelExpanded(!aiRemembersPanelExpanded)}>
                          <h2 className="text-xl font-semibold">What AI Remembers</h2>
                          <div className="flex space-x-2 items-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
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

                                  <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-2.5 mb-4">
                                    <div
                                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                                      style={{ width: `${profileJobProgress}%` }}
                                    ></div>
                                  </div>

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
                                <div className="border-l-2 border-blue-500 dark:border-blue-600 pl-3 py-2 mb-4">
                                  <p className="text-blue-700 dark:text-blue-300 text-sm flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                                      <circle cx="12" cy="12" r="10"></circle>
                                      <polyline points="12 6 12 12 16 14"></polyline>
                                    </svg>
                                    Last updated: {new Date(userProfile.lastUpdated).toLocaleDateString()} at {new Date(userProfile.lastUpdated).toLocaleTimeString()}
                                  </p>
                                </div>

                                {Object.keys(userProfile?.profile || {}).length > 0 ? (
                                  <div className="space-y-4 max-w-none">
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

                            {/* Profile Analysis Controls */}
                            {userProfile && (
                              <div
                                id="profile-controls"
                                className="mt-6 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg"
                              >
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
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Tab Navigation - positioned above the mobile footer nav */}
      <div className="fixed bottom-16 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50">
        <div className="container mx-auto px-4">
          <div className="flex justify-center py-4">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-full p-1 flex">
              <button
                onClick={() => setActiveTab('modules')}
                className={`px-8 py-3 rounded-full font-medium transition-all ${activeTab === 'modules'
                  ? 'bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-800 shadow-md'
                  : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
              >
                Modules
              </button>
              <button
                onClick={() => setActiveTab('insights')}
                className={`px-8 py-3 rounded-full font-medium transition-all ${activeTab === 'insights'
                  ? 'bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-800 shadow-md'
                  : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
              >
                Insights
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface QuestCardProps {
  quest: Quest;
  onStart: () => void;
  onComplete: () => void;
}

function QuestCard({ quest, onStart, onComplete }: QuestCardProps) {
  // Determine status class
  let statusClass = '';
  let statusText = '';

  switch (quest.status) {
    case 'completed':
      statusClass = 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100 border-green-200 dark:border-green-600';
      statusText = 'Completed';
      break;
    case 'active':
      statusClass = 'bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 border-blue-200 dark:border-blue-600';
      statusText = 'In Progress';
      break;
    default:
      statusClass = 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-600';
      statusText = 'Not Started';
      break;
  }

  return (
    <div className={`border rounded-lg overflow-hidden shadow-md bg-white dark:bg-gray-800 ${quest.status === 'completed'
      ? 'border-green-200 dark:border-green-600'
      : 'border-gray-200 dark:border-gray-600'
      }`}>
      <div className="p-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">{quest.quest_title}</h3>

        {quest.status && (
          <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium mb-3 ${statusClass}`}>
            {statusText}
          </div>
        )}

        <p className="text-sm text-gray-600 dark:text-gray-200 mb-3">{quest.introduction}</p>

        <div className="text-sm text-gray-600 dark:text-gray-200 mb-3">
          <span className="font-medium text-gray-800 dark:text-gray-100">Challenge:</span> {quest.challenge}
        </div>

        <div className="flex justify-between mt-4">
          {quest.status !== 'completed' && (
            <button
              onClick={onStart}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              {quest.status === 'active' ? 'Continue' : 'Start'}
            </button>
          )}

          {quest.status === 'active' && (
            <button
              onClick={onComplete}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
            >
              Mark Completed
            </button>
          )}

          {quest.status === 'completed' && (
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-600 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-green-600 font-medium">Completed</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}