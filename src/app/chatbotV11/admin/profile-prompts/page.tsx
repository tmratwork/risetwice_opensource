'use client';

import React, { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Copy, Check } from 'lucide-react';
import {
  setupProfileAnalysisSystemPromptForUser,
  setupProfileAnalysisUserPromptForUser,
  setupProfileMergeSystemPromptForUser,
  setupProfileMergeUserPromptForUser
} from '../setup-profile-prompts';

export default function ProfilePromptsPage() {
  console.log('[Debug] ProfilePromptsPage component mounting/rendering');
  // Router is defined but not used
  const [userId, setUserId] = useState('');
  const [activeTab, setActiveTab] = useState<'profile_analysis' | 'profile_merge'>('profile_analysis');
  
  // Profile analysis system prompt state
  const [profileAnalysisSystemContent, setProfileAnalysisSystemContent] = useState('');
  const [profileAnalysisSystemTitle, setProfileAnalysisSystemTitle] = useState<string>('');
  const [profileAnalysisSystemNotes, setProfileAnalysisSystemNotes] = useState<string>('');
  // Used only to populate other state, but not referenced directly in JSX
  const [, setCurrentProfileAnalysisSystem] = useState<string>('');
  // Used in the fetchProfileAnalysisPrompts function
  const [, setGlobalProfileAnalysisSystem] = useState<string | null>(null);
  const [isProfileAnalysisSystemGlobal, setIsProfileAnalysisSystemGlobal] = useState<boolean>(false);

  // Profile analysis user prompt state
  const [profileAnalysisUserContent, setProfileAnalysisUserContent] = useState('');
  const [profileAnalysisUserTitle, setProfileAnalysisUserTitle] = useState<string>('');
  const [profileAnalysisUserNotes, setProfileAnalysisUserNotes] = useState<string>('');
  // Used only to populate other state, but not referenced directly in JSX
  const [, setCurrentProfileAnalysisUser] = useState<string>('');
  // Used in the fetchProfileAnalysisPrompts function
  const [, setGlobalProfileAnalysisUser] = useState<string | null>(null);
  const [isProfileAnalysisUserGlobal, setIsProfileAnalysisUserGlobal] = useState<boolean>(false);

  // Profile merge system prompt state
  const [profileMergeSystemContent, setProfileMergeSystemContent] = useState('');
  const [profileMergeSystemTitle, setProfileMergeSystemTitle] = useState<string>('');
  const [profileMergeSystemNotes, setProfileMergeSystemNotes] = useState<string>('');
  // Used only to populate other state, but not referenced directly in JSX
  const [, setCurrentProfileMergeSystem] = useState<string>('');
  // Used in the fetchProfileMergePrompts function
  const [, setGlobalProfileMergeSystem] = useState<string | null>(null);
  const [isProfileMergeSystemGlobal, setIsProfileMergeSystemGlobal] = useState<boolean>(false);

  // Profile merge user prompt state
  const [profileMergeUserContent, setProfileMergeUserContent] = useState('');
  const [profileMergeUserTitle, setProfileMergeUserTitle] = useState<string>('');
  const [profileMergeUserNotes, setProfileMergeUserNotes] = useState<string>('');
  // Used only to populate other state, but not referenced directly in JSX
  const [, setCurrentProfileMergeUser] = useState<string>('');
  // Used in the fetchProfileMergePrompts function
  const [, setGlobalProfileMergeUser] = useState<string | null>(null);
  const [isProfileMergeUserGlobal, setIsProfileMergeUserGlobal] = useState<boolean>(false);

  // Shared state
  const [status, setStatus] = useState<{ success?: boolean; message: string }>({ message: '' });
  const [loading, setLoading] = useState(false);

  // State for profile analysis sub-tab
  const [activeProfileAnalysisTab, setActiveProfileAnalysisTab] = useState<'system' | 'user'>('system');
  
  // State for profile merge sub-tab
  const [activeProfileMergeTab, setActiveProfileMergeTab] = useState<'system' | 'user'>('system');

  // State for copy buttons
  const [copiedProfileAnalysisSystem, setCopiedProfileAnalysisSystem] = useState(false);
  // Not used but defined for consistency
  // const [copiedCurrentProfileAnalysisSystem, setCopiedCurrentProfileAnalysisSystem] = useState(false);
  const [copiedProfileAnalysisUser, setCopiedProfileAnalysisUser] = useState(false);
  // Not used but defined for consistency
  // const [copiedCurrentProfileAnalysisUser, setCopiedCurrentProfileAnalysisUser] = useState(false);
  const [copiedProfileMergeSystem, setCopiedProfileMergeSystem] = useState(false);
  // Not used but defined for consistency
  // const [copiedCurrentProfileMergeSystem, setCopiedCurrentProfileMergeSystem] = useState(false);
  const [copiedProfileMergeUser, setCopiedProfileMergeUser] = useState(false);
  // Not used but defined for consistency
  // const [copiedCurrentProfileMergeUser, setCopiedCurrentProfileMergeUser] = useState(false);

  useEffect(() => {
    // Get the current logged-in user's ID from Firebase
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Auto-fill the User ID field with the current user's ID
        setUserId(user.uid);
      }
    });

    return () => unsubscribe();
  }, []);

  // Profile Analysis System Prompt Submit Handler
  const handleProfileAnalysisSystemSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setStatus({ message: '' });

    try {
      if (!userId) {
        setStatus({ success: false, message: 'User ID is required' });
        setLoading(false);
        return;
      }

      const result = await setupProfileAnalysisSystemPromptForUser(
        userId,
        profileAnalysisSystemContent,
        profileAnalysisSystemTitle || undefined,
        profileAnalysisSystemNotes || undefined,
        isProfileAnalysisSystemGlobal
      );

      setStatus({
        success: result.success,
        message: result.message
      });

      // Refresh the current profile prompt if successful
      if (result.success) {
        fetchProfileAnalysisPrompts(userId);
      }
    } catch (error) {
      console.error('Error setting up profile analysis system prompt:', error);
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  // Profile Analysis User Prompt Submit Handler
  const handleProfileAnalysisUserSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setStatus({ message: '' });

    try {
      if (!userId) {
        setStatus({ success: false, message: 'User ID is required' });
        setLoading(false);
        return;
      }

      const result = await setupProfileAnalysisUserPromptForUser(
        userId,
        profileAnalysisUserContent,
        profileAnalysisUserTitle || undefined,
        profileAnalysisUserNotes || undefined,
        isProfileAnalysisUserGlobal
      );

      setStatus({
        success: result.success,
        message: result.message
      });

      // Refresh the current profile prompt if successful
      if (result.success) {
        fetchProfileAnalysisPrompts(userId);
      }
    } catch (error) {
      console.error('Error setting up profile analysis user prompt:', error);
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  // Profile Merge System Prompt Submit Handler
  const handleProfileMergeSystemSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setStatus({ message: '' });

    try {
      if (!userId) {
        setStatus({ success: false, message: 'User ID is required' });
        setLoading(false);
        return;
      }

      const result = await setupProfileMergeSystemPromptForUser(
        userId,
        profileMergeSystemContent,
        profileMergeSystemTitle || undefined,
        profileMergeSystemNotes || undefined,
        isProfileMergeSystemGlobal
      );

      setStatus({
        success: result.success,
        message: result.message
      });

      // Refresh the current profile prompt if successful
      if (result.success) {
        fetchProfileMergePrompts(userId);
      }
    } catch (error) {
      console.error('Error setting up profile merge system prompt:', error);
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  // Profile Merge User Prompt Submit Handler
  const handleProfileMergeUserSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setStatus({ message: '' });

    try {
      if (!userId) {
        setStatus({ success: false, message: 'User ID is required' });
        setLoading(false);
        return;
      }

      const result = await setupProfileMergeUserPromptForUser(
        userId,
        profileMergeUserContent,
        profileMergeUserTitle || undefined,
        profileMergeUserNotes || undefined,
        isProfileMergeUserGlobal
      );

      setStatus({
        success: result.success,
        message: result.message
      });

      // Refresh the current profile prompt if successful
      if (result.success) {
        fetchProfileMergePrompts(userId);
      }
    } catch (error) {
      console.error('Error setting up profile merge user prompt:', error);
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch functions for profile prompts
  const fetchProfileAnalysisPrompts = async (userId: string) => {
    try {
      // Fetch system prompt
      const systemResponse = await fetch(`/api/v11/profile-prompts?userId=${userId}&promptType=analysis&promptPart=system`);
      if (systemResponse.ok) {
        const systemData = await systemResponse.json();
        if (systemData.success && systemData.data) {
          setCurrentProfileAnalysisSystem(systemData.data.analysisSystemPrompt || '');
          setGlobalProfileAnalysisSystem(
            systemData.data.analysisSystemSource === 'global' ? systemData.data.analysisSystemPrompt : null
          );
          setProfileAnalysisSystemContent(systemData.data.analysisSystemPrompt || '');
        }
      }

      // Fetch user prompt
      const userResponse = await fetch(`/api/v11/profile-prompts?userId=${userId}&promptType=analysis&promptPart=user`);
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.success && userData.data) {
          setCurrentProfileAnalysisUser(userData.data.analysisUserPrompt || '');
          setGlobalProfileAnalysisUser(
            userData.data.analysisUserSource === 'global' ? userData.data.analysisUserPrompt : null
          );
          setProfileAnalysisUserContent(userData.data.analysisUserPrompt || '');
        }
      }
    } catch (error) {
      console.error('Error fetching profile analysis prompts:', error);
    }
  };

  const fetchProfileMergePrompts = async (userId: string) => {
    try {
      // Fetch system prompt
      const systemResponse = await fetch(`/api/v11/profile-prompts?userId=${userId}&promptType=merge&promptPart=system`);
      if (systemResponse.ok) {
        const systemData = await systemResponse.json();
        if (systemData.success && systemData.data) {
          setCurrentProfileMergeSystem(systemData.data.mergeSystemPrompt || '');
          setGlobalProfileMergeSystem(
            systemData.data.mergeSystemSource === 'global' ? systemData.data.mergeSystemPrompt : null
          );
          setProfileMergeSystemContent(systemData.data.mergeSystemPrompt || '');
        }
      }

      // Fetch user prompt
      const userResponse = await fetch(`/api/v11/profile-prompts?userId=${userId}&promptType=merge&promptPart=user`);
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.success && userData.data) {
          setCurrentProfileMergeUser(userData.data.mergeUserPrompt || '');
          setGlobalProfileMergeUser(
            userData.data.mergeUserSource === 'global' ? userData.data.mergeUserPrompt : null
          );
          setProfileMergeUserContent(userData.data.mergeUserPrompt || '');
        }
      }
    } catch (error) {
      console.error('Error fetching profile merge prompts:', error);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchProfileAnalysisPrompts(userId);
      fetchProfileMergePrompts(userId);
    }
  }, [userId]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-8">
          Profile Prompts Management
        </h1>

        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
          {/* Show success/error messages */}
          {status.message && (
            <div
              className={`p-4 mb-4 rounded-md ${
                status.success ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
              }`}
            >
              {status.message}
            </div>
          )}

          {/* Main tabs for switching between Profile Analysis and Profile Merge */}
          <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
            <div className="flex">
              <button
                type="button"
                onClick={() => setActiveTab('profile_analysis')}
                className={`py-2 px-4 border-b-2 font-medium ${
                  activeTab === 'profile_analysis'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Profile Analysis Prompts
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('profile_merge')}
                className={`py-2 px-4 border-b-2 font-medium ${
                  activeTab === 'profile_merge'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Profile Merge Prompts
              </button>
            </div>
          </div>

          {/* Profile Analysis Tab Content */}
          {activeTab === 'profile_analysis' && (
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
                    onClick={() => setActiveProfileAnalysisTab('system')}
                    className={`py-2 px-4 border-b-2 font-medium text-sm ${
                      activeProfileAnalysisTab === 'system'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    System Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveProfileAnalysisTab('user')}
                    className={`py-2 px-4 border-b-2 font-medium text-sm ${
                      activeProfileAnalysisTab === 'user'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    User Prompt
                  </button>
                </div>
              </div>

              {/* System Prompt Content */}
              {activeProfileAnalysisTab === 'system' && (
                <form onSubmit={handleProfileAnalysisSystemSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="profileAnalysisSystemTitle" className="block text-sm font-medium mb-1">
                      System Prompt Version Title
                    </label>
                    <input
                      type="text"
                      id="profileAnalysisSystemTitle"
                      value={profileAnalysisSystemTitle}
                      onChange={(e) => setProfileAnalysisSystemTitle(e.target.value)}
                      placeholder="E.g., Enhanced profile analysis system prompt"
                      className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label htmlFor="profileAnalysisSystemNotes" className="block text-sm font-medium mb-1">
                      Notes
                    </label>
                    <textarea
                      id="profileAnalysisSystemNotes"
                      value={profileAnalysisSystemNotes}
                      onChange={(e) => setProfileAnalysisSystemNotes(e.target.value)}
                      rows={2}
                      placeholder="Optional comments about this version"
                      className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center">
                      <label htmlFor="profileAnalysisSystemContent" className="block text-sm font-medium mb-1">
                        Profile Analysis System Prompt
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(profileAnalysisSystemContent);
                          setCopiedProfileAnalysisSystem(true);
                          setTimeout(() => setCopiedProfileAnalysisSystem(false), 2000);
                        }}
                        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                        title="Copy to clipboard"
                      >
                        {copiedProfileAnalysisSystem ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
                      </button>
                    </div>
                    <textarea
                      id="profileAnalysisSystemContent"
                      value={profileAnalysisSystemContent}
                      onChange={(e) => setProfileAnalysisSystemContent(e.target.value)}
                      rows={20}
                      className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>

                  {/* Global flag checkbox */}
                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="isProfileAnalysisSystemGlobal"
                      checked={isProfileAnalysisSystemGlobal}
                      onChange={(e) => setIsProfileAnalysisSystemGlobal(e.target.checked)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                    <label htmlFor="isProfileAnalysisSystemGlobal" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                      Set as global for all users
                    </label>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {loading ? 'Processing...' : 'Save Profile Analysis System Prompt'}
                    </button>
                  </div>
                </form>
              )}

              {/* User Prompt Content */}
              {activeProfileAnalysisTab === 'user' && (
                <form onSubmit={handleProfileAnalysisUserSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="profileAnalysisUserTitle" className="block text-sm font-medium mb-1">
                      User Prompt Version Title
                    </label>
                    <input
                      type="text"
                      id="profileAnalysisUserTitle"
                      value={profileAnalysisUserTitle}
                      onChange={(e) => setProfileAnalysisUserTitle(e.target.value)}
                      placeholder="E.g., Standard profile analysis user prompt"
                      className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label htmlFor="profileAnalysisUserNotes" className="block text-sm font-medium mb-1">
                      Notes
                    </label>
                    <textarea
                      id="profileAnalysisUserNotes"
                      value={profileAnalysisUserNotes}
                      onChange={(e) => setProfileAnalysisUserNotes(e.target.value)}
                      rows={2}
                      placeholder="Optional comments about this version"
                      className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center">
                      <label htmlFor="profileAnalysisUserContent" className="block text-sm font-medium mb-1">
                        Profile Analysis User Prompt
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(profileAnalysisUserContent);
                          setCopiedProfileAnalysisUser(true);
                          setTimeout(() => setCopiedProfileAnalysisUser(false), 2000);
                        }}
                        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                        title="Copy to clipboard"
                      >
                        {copiedProfileAnalysisUser ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
                      </button>
                    </div>
                    <textarea
                      id="profileAnalysisUserContent"
                      value={profileAnalysisUserContent}
                      onChange={(e) => setProfileAnalysisUserContent(e.target.value)}
                      rows={15}
                      className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>

                  {/* Global flag checkbox */}
                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="isProfileAnalysisUserGlobal"
                      checked={isProfileAnalysisUserGlobal}
                      onChange={(e) => setIsProfileAnalysisUserGlobal(e.target.checked)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                    <label htmlFor="isProfileAnalysisUserGlobal" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                      Set as global for all users
                    </label>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {loading ? 'Processing...' : 'Save Profile Analysis User Prompt'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Profile Merge Tab Content */}
          {activeTab === 'profile_merge' && (
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
                    onClick={() => setActiveProfileMergeTab('system')}
                    className={`py-2 px-4 border-b-2 font-medium text-sm ${
                      activeProfileMergeTab === 'system'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    System Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveProfileMergeTab('user')}
                    className={`py-2 px-4 border-b-2 font-medium text-sm ${
                      activeProfileMergeTab === 'user'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    User Prompt
                  </button>
                </div>
              </div>

              {/* System Prompt Content */}
              {activeProfileMergeTab === 'system' && (
                <form onSubmit={handleProfileMergeSystemSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="profileMergeSystemTitle" className="block text-sm font-medium mb-1">
                      System Prompt Version Title
                    </label>
                    <input
                      type="text"
                      id="profileMergeSystemTitle"
                      value={profileMergeSystemTitle}
                      onChange={(e) => setProfileMergeSystemTitle(e.target.value)}
                      placeholder="E.g., Enhanced profile merge system prompt"
                      className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label htmlFor="profileMergeSystemNotes" className="block text-sm font-medium mb-1">
                      Notes
                    </label>
                    <textarea
                      id="profileMergeSystemNotes"
                      value={profileMergeSystemNotes}
                      onChange={(e) => setProfileMergeSystemNotes(e.target.value)}
                      rows={2}
                      placeholder="Optional comments about this version"
                      className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center">
                      <label htmlFor="profileMergeSystemContent" className="block text-sm font-medium mb-1">
                        Profile Merge System Prompt
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(profileMergeSystemContent);
                          setCopiedProfileMergeSystem(true);
                          setTimeout(() => setCopiedProfileMergeSystem(false), 2000);
                        }}
                        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                        title="Copy to clipboard"
                      >
                        {copiedProfileMergeSystem ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
                      </button>
                    </div>
                    <textarea
                      id="profileMergeSystemContent"
                      value={profileMergeSystemContent}
                      onChange={(e) => setProfileMergeSystemContent(e.target.value)}
                      rows={20}
                      className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>

                  {/* Global flag checkbox */}
                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="isProfileMergeSystemGlobal"
                      checked={isProfileMergeSystemGlobal}
                      onChange={(e) => setIsProfileMergeSystemGlobal(e.target.checked)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                    <label htmlFor="isProfileMergeSystemGlobal" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                      Set as global for all users
                    </label>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {loading ? 'Processing...' : 'Save Profile Merge System Prompt'}
                    </button>
                  </div>
                </form>
              )}

              {/* User Prompt Content */}
              {activeProfileMergeTab === 'user' && (
                <form onSubmit={handleProfileMergeUserSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="profileMergeUserTitle" className="block text-sm font-medium mb-1">
                      User Prompt Version Title
                    </label>
                    <input
                      type="text"
                      id="profileMergeUserTitle"
                      value={profileMergeUserTitle}
                      onChange={(e) => setProfileMergeUserTitle(e.target.value)}
                      placeholder="E.g., Standard profile merge user prompt"
                      className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label htmlFor="profileMergeUserNotes" className="block text-sm font-medium mb-1">
                      Notes
                    </label>
                    <textarea
                      id="profileMergeUserNotes"
                      value={profileMergeUserNotes}
                      onChange={(e) => setProfileMergeUserNotes(e.target.value)}
                      rows={2}
                      placeholder="Optional comments about this version"
                      className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center">
                      <label htmlFor="profileMergeUserContent" className="block text-sm font-medium mb-1">
                        Profile Merge User Prompt
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(profileMergeUserContent);
                          setCopiedProfileMergeUser(true);
                          setTimeout(() => setCopiedProfileMergeUser(false), 2000);
                        }}
                        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                        title="Copy to clipboard"
                      >
                        {copiedProfileMergeUser ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
                      </button>
                    </div>
                    <textarea
                      id="profileMergeUserContent"
                      value={profileMergeUserContent}
                      onChange={(e) => setProfileMergeUserContent(e.target.value)}
                      rows={15}
                      className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>

                  {/* Global flag checkbox */}
                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="isProfileMergeUserGlobal"
                      checked={isProfileMergeUserGlobal}
                      onChange={(e) => setIsProfileMergeUserGlobal(e.target.checked)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                    <label htmlFor="isProfileMergeUserGlobal" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                      Set as global for all users
                    </label>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {loading ? 'Processing...' : 'Save Profile Merge User Prompt'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}