import React, { useEffect, useCallback } from 'react';
import ProfileAnalysisTab from './profile-analysis-tab';
import ProfileMergeTab from './profile-merge-tab';

interface ProfileTabsProps {
  userId: string;
  loading: boolean;
  status: { success?: boolean; message: string };

  // Profile analysis system state
  profileAnalysisSystemContent: string;
  setProfileAnalysisSystemContent: (content: string) => void;
  profileAnalysisSystemTitle: string;
  setProfileAnalysisSystemTitle: (title: string) => void;
  profileAnalysisSystemNotes: string;
  setProfileAnalysisSystemNotes: (notes: string) => void;
  currentProfileAnalysisSystem: string;
  setCurrentProfileAnalysisSystem: (content: string) => void;
  globalProfileAnalysisSystem: string | null;
  setGlobalProfileAnalysisSystem: (content: string | null) => void;
  isProfileAnalysisSystemGlobal: boolean;
  setIsProfileAnalysisSystemGlobal: (isGlobal: boolean) => void;
  copiedProfileAnalysisSystem: boolean;
  setCopiedProfileAnalysisSystem: (copied: boolean) => void;
  copiedCurrentProfileAnalysisSystem: boolean;
  setCopiedCurrentProfileAnalysisSystem: (copied: boolean) => void;

  // Profile analysis user state
  profileAnalysisUserContent: string;
  setProfileAnalysisUserContent: (content: string) => void;
  profileAnalysisUserTitle: string;
  setProfileAnalysisUserTitle: (title: string) => void;
  profileAnalysisUserNotes: string;
  setProfileAnalysisUserNotes: (notes: string) => void;
  currentProfileAnalysisUser: string;
  setCurrentProfileAnalysisUser: (content: string) => void;
  globalProfileAnalysisUser: string | null;
  setGlobalProfileAnalysisUser: (content: string | null) => void;
  isProfileAnalysisUserGlobal: boolean;
  setIsProfileAnalysisUserGlobal: (isGlobal: boolean) => void;
  copiedProfileAnalysisUser: boolean;
  setCopiedProfileAnalysisUser: (copied: boolean) => void;
  copiedCurrentProfileAnalysisUser: boolean;
  setCopiedCurrentProfileAnalysisUser: (copied: boolean) => void;

  // Profile merge system state
  profileMergeSystemContent: string;
  setProfileMergeSystemContent: (content: string) => void;
  profileMergeSystemTitle: string;
  setProfileMergeSystemTitle: (title: string) => void;
  profileMergeSystemNotes: string;
  setProfileMergeSystemNotes: (notes: string) => void;
  currentProfileMergeSystem: string;
  setCurrentProfileMergeSystem: (content: string) => void;
  globalProfileMergeSystem: string | null;
  setGlobalProfileMergeSystem: (content: string | null) => void;
  isProfileMergeSystemGlobal: boolean;
  setIsProfileMergeSystemGlobal: (isGlobal: boolean) => void;
  copiedProfileMergeSystem: boolean;
  setCopiedProfileMergeSystem: (copied: boolean) => void;
  copiedCurrentProfileMergeSystem: boolean;
  setCopiedCurrentProfileMergeSystem: (copied: boolean) => void;

  // Profile merge user state
  profileMergeUserContent: string;
  setProfileMergeUserContent: (content: string) => void;
  profileMergeUserTitle: string;
  setProfileMergeUserTitle: (title: string) => void;
  profileMergeUserNotes: string;
  setProfileMergeUserNotes: (notes: string) => void;
  currentProfileMergeUser: string;
  setCurrentProfileMergeUser: (content: string) => void;
  globalProfileMergeUser: string | null;
  setGlobalProfileMergeUser: (content: string | null) => void;
  isProfileMergeUserGlobal: boolean;
  setIsProfileMergeUserGlobal: (isGlobal: boolean) => void;
  copiedProfileMergeUser: boolean;
  setCopiedProfileMergeUser: (copied: boolean) => void;
  copiedCurrentProfileMergeUser: boolean;
  setCopiedCurrentProfileMergeUser: (copied: boolean) => void;

  // Subtab states
  activeProfileAnalysisTab: 'system' | 'user';
  setActiveProfileAnalysisTab: (tab: 'system' | 'user') => void;
  activeProfileMergeTab: 'system' | 'user';
  setActiveProfileMergeTab: (tab: 'system' | 'user') => void;

  // Handler functions
  handleProfileAnalysisSystemSubmit: (event: React.FormEvent) => void;
  handleProfileAnalysisUserSubmit: (event: React.FormEvent) => void;
  handleProfileMergeSystemSubmit: (event: React.FormEvent) => void;
  handleProfileMergeUserSubmit: (event: React.FormEvent) => void;

  // Active tab
  activeTab: 'profile_analysis' | 'profile_merge';
  setActiveTab: (tab: 'profile_analysis' | 'profile_merge') => void;
}

export default function ProfileTabs({
  userId,
  loading,
  status,
  profileAnalysisSystemContent,
  setProfileAnalysisSystemContent,
  profileAnalysisSystemTitle,
  setProfileAnalysisSystemTitle,
  profileAnalysisSystemNotes,
  setProfileAnalysisSystemNotes,
  currentProfileAnalysisSystem,
  globalProfileAnalysisSystem,
  isProfileAnalysisSystemGlobal,
  setIsProfileAnalysisSystemGlobal,
  copiedProfileAnalysisSystem,
  setCopiedProfileAnalysisSystem,
  copiedCurrentProfileAnalysisSystem,
  setCopiedCurrentProfileAnalysisSystem,
  profileAnalysisUserContent,
  setProfileAnalysisUserContent,
  profileAnalysisUserTitle,
  setProfileAnalysisUserTitle,
  profileAnalysisUserNotes,
  setProfileAnalysisUserNotes,
  currentProfileAnalysisUser,
  globalProfileAnalysisUser,
  isProfileAnalysisUserGlobal,
  setIsProfileAnalysisUserGlobal,
  copiedProfileAnalysisUser,
  setCopiedProfileAnalysisUser,
  copiedCurrentProfileAnalysisUser,
  setCopiedCurrentProfileAnalysisUser,
  profileMergeSystemContent,
  setProfileMergeSystemContent,
  profileMergeSystemTitle,
  setProfileMergeSystemTitle,
  profileMergeSystemNotes,
  setProfileMergeSystemNotes,
  currentProfileMergeSystem,
  globalProfileMergeSystem,
  isProfileMergeSystemGlobal,
  setIsProfileMergeSystemGlobal,
  copiedProfileMergeSystem,
  setCopiedProfileMergeSystem,
  copiedCurrentProfileMergeSystem,
  setCopiedCurrentProfileMergeSystem,
  profileMergeUserContent,
  setProfileMergeUserContent,
  profileMergeUserTitle,
  setProfileMergeUserTitle,
  profileMergeUserNotes,
  setProfileMergeUserNotes,
  currentProfileMergeUser,
  globalProfileMergeUser,
  isProfileMergeUserGlobal,
  setIsProfileMergeUserGlobal,
  copiedProfileMergeUser,
  setCopiedProfileMergeUser,
  copiedCurrentProfileMergeUser,
  setCopiedCurrentProfileMergeUser,
  activeProfileAnalysisTab,
  setActiveProfileAnalysisTab,
  activeProfileMergeTab,
  setActiveProfileMergeTab,
  handleProfileAnalysisSystemSubmit,
  handleProfileAnalysisUserSubmit,
  handleProfileMergeSystemSubmit,
  handleProfileMergeUserSubmit,
  activeTab,
}: ProfileTabsProps) {
  // Fetch profile prompts on mount and when userId changes
  // Function for fetching profiles - without actual effect logic - avoiding hooks errors
  const fetchProfilePrompts = useCallback(async () => {
    if (!userId) return;

    try {
      // Fetch profile analysis prompts
      const analysisResponse = await fetch(`/api/v11/profile-prompts?userId=${userId}&promptType=analysis`);
      if (analysisResponse.ok) {
        const analysisData = await analysisResponse.json();
        if (analysisData.success && analysisData.data) {
          // Update system content
          setProfileAnalysisSystemContent(analysisData.data.analysisSystemPrompt || '');

          // Update user content
          setProfileAnalysisUserContent(analysisData.data.analysisUserPrompt || '');
        }
      }

      // Fetch profile merge prompts
      const mergeResponse = await fetch(`/api/v11/profile-prompts?userId=${userId}&promptType=merge`);
      if (mergeResponse.ok) {
        const mergeData = await mergeResponse.json();
        if (mergeData.success && mergeData.data) {
          // Update system content
          setProfileMergeSystemContent(mergeData.data.mergeSystemPrompt || '');

          // Update user content
          setProfileMergeUserContent(mergeData.data.mergeUserPrompt || '');
        }
      }
    } catch (error) {
      console.error('Error fetching profile prompts:', error);
    }
  }, [
    userId,
    setProfileAnalysisSystemContent,
    setProfileAnalysisUserContent,
    setProfileMergeSystemContent,
    setProfileMergeUserContent
  ]);

  // Execute the fetch on initial mount and userId changes
  useEffect(() => {
    if (userId) {
      fetchProfilePrompts();
    }
  }, [userId, fetchProfilePrompts]);

  return (
    <div className="space-y-6">
      {/* Show success/error messages */}
      {status.message && (
        <div
          className={`p-4 mb-4 rounded-md ${status.success ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
            }`}
        >
          {status.message}
        </div>
      )}

      {/* Profile Analysis Tab */}
      {activeTab === 'profile_analysis' && (
        <ProfileAnalysisTab
          userId={userId}
          loading={loading}
          status={status}
          activeProfileAnalysisTab={activeProfileAnalysisTab}
          setActiveProfileAnalysisTab={setActiveProfileAnalysisTab}
          profileAnalysisSystemContent={profileAnalysisSystemContent}
          setProfileAnalysisSystemContent={setProfileAnalysisSystemContent}
          profileAnalysisSystemTitle={profileAnalysisSystemTitle}
          setProfileAnalysisSystemTitle={setProfileAnalysisSystemTitle}
          profileAnalysisSystemNotes={profileAnalysisSystemNotes}
          setProfileAnalysisSystemNotes={setProfileAnalysisSystemNotes}
          currentProfileAnalysisSystem={currentProfileAnalysisSystem}
          globalProfileAnalysisSystem={globalProfileAnalysisSystem}
          isProfileAnalysisSystemGlobal={isProfileAnalysisSystemGlobal}
          setIsProfileAnalysisSystemGlobal={setIsProfileAnalysisSystemGlobal}
          copiedProfileAnalysisSystem={copiedProfileAnalysisSystem}
          setCopiedProfileAnalysisSystem={setCopiedProfileAnalysisSystem}
          copiedCurrentProfileAnalysisSystem={copiedCurrentProfileAnalysisSystem}
          setCopiedCurrentProfileAnalysisSystem={setCopiedCurrentProfileAnalysisSystem}
          profileAnalysisUserContent={profileAnalysisUserContent}
          setProfileAnalysisUserContent={setProfileAnalysisUserContent}
          profileAnalysisUserTitle={profileAnalysisUserTitle}
          setProfileAnalysisUserTitle={setProfileAnalysisUserTitle}
          profileAnalysisUserNotes={profileAnalysisUserNotes}
          setProfileAnalysisUserNotes={setProfileAnalysisUserNotes}
          currentProfileAnalysisUser={currentProfileAnalysisUser}
          globalProfileAnalysisUser={globalProfileAnalysisUser}
          isProfileAnalysisUserGlobal={isProfileAnalysisUserGlobal}
          setIsProfileAnalysisUserGlobal={setIsProfileAnalysisUserGlobal}
          copiedProfileAnalysisUser={copiedProfileAnalysisUser}
          setCopiedProfileAnalysisUser={setCopiedProfileAnalysisUser}
          copiedCurrentProfileAnalysisUser={copiedCurrentProfileAnalysisUser}
          setCopiedCurrentProfileAnalysisUser={setCopiedCurrentProfileAnalysisUser}
          handleProfileAnalysisSystemSubmit={handleProfileAnalysisSystemSubmit}
          handleProfileAnalysisUserSubmit={handleProfileAnalysisUserSubmit}
        />
      )}

      {/* Profile Merge Tab */}
      {activeTab === 'profile_merge' && (
        <ProfileMergeTab
          userId={userId}
          loading={loading}
          status={status}
          activeProfileMergeTab={activeProfileMergeTab}
          setActiveProfileMergeTab={setActiveProfileMergeTab}
          profileMergeSystemContent={profileMergeSystemContent}
          setProfileMergeSystemContent={setProfileMergeSystemContent}
          profileMergeSystemTitle={profileMergeSystemTitle}
          setProfileMergeSystemTitle={setProfileMergeSystemTitle}
          profileMergeSystemNotes={profileMergeSystemNotes}
          setProfileMergeSystemNotes={setProfileMergeSystemNotes}
          currentProfileMergeSystem={currentProfileMergeSystem}
          globalProfileMergeSystem={globalProfileMergeSystem}
          isProfileMergeSystemGlobal={isProfileMergeSystemGlobal}
          setIsProfileMergeSystemGlobal={setIsProfileMergeSystemGlobal}
          copiedProfileMergeSystem={copiedProfileMergeSystem}
          setCopiedProfileMergeSystem={setCopiedProfileMergeSystem}
          copiedCurrentProfileMergeSystem={copiedCurrentProfileMergeSystem}
          setCopiedCurrentProfileMergeSystem={setCopiedCurrentProfileMergeSystem}
          profileMergeUserContent={profileMergeUserContent}
          setProfileMergeUserContent={setProfileMergeUserContent}
          profileMergeUserTitle={profileMergeUserTitle}
          setProfileMergeUserTitle={setProfileMergeUserTitle}
          profileMergeUserNotes={profileMergeUserNotes}
          setProfileMergeUserNotes={setProfileMergeUserNotes}
          currentProfileMergeUser={currentProfileMergeUser}
          globalProfileMergeUser={globalProfileMergeUser}
          isProfileMergeUserGlobal={isProfileMergeUserGlobal}
          setIsProfileMergeUserGlobal={setIsProfileMergeUserGlobal}
          copiedProfileMergeUser={copiedProfileMergeUser}
          setCopiedProfileMergeUser={setCopiedProfileMergeUser}
          copiedCurrentProfileMergeUser={copiedCurrentProfileMergeUser}
          setCopiedCurrentProfileMergeUser={setCopiedCurrentProfileMergeUser}
          handleProfileMergeSystemSubmit={handleProfileMergeSystemSubmit}
          handleProfileMergeUserSubmit={handleProfileMergeUserSubmit}
        />
      )}
    </div>
  );
}