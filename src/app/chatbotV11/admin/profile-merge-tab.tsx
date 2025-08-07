import React from 'react';
import { Copy, Check } from 'lucide-react';

interface ProfileMergeTabProps {
  userId: string;
  loading: boolean;
  status: { success?: boolean; message: string };
  activeProfileMergeTab: 'system' | 'user';
  setActiveProfileMergeTab: (tab: 'system' | 'user') => void;
  
  // System prompt props
  profileMergeSystemContent: string;
  setProfileMergeSystemContent: (content: string) => void;
  profileMergeSystemTitle: string;
  setProfileMergeSystemTitle: (title: string) => void;
  profileMergeSystemNotes: string;
  setProfileMergeSystemNotes: (notes: string) => void;
  currentProfileMergeSystem: string;
  globalProfileMergeSystem: string | null;
  isProfileMergeSystemGlobal: boolean;
  setIsProfileMergeSystemGlobal: (isGlobal: boolean) => void;
  copiedProfileMergeSystem: boolean;
  setCopiedProfileMergeSystem: (copied: boolean) => void;
  copiedCurrentProfileMergeSystem: boolean;
  setCopiedCurrentProfileMergeSystem: (copied: boolean) => void;
  
  // User prompt props
  profileMergeUserContent: string;
  setProfileMergeUserContent: (content: string) => void;
  profileMergeUserTitle: string;
  setProfileMergeUserTitle: (title: string) => void;
  profileMergeUserNotes: string;
  setProfileMergeUserNotes: (notes: string) => void;
  currentProfileMergeUser: string;
  globalProfileMergeUser: string | null;
  isProfileMergeUserGlobal: boolean;
  setIsProfileMergeUserGlobal: (isGlobal: boolean) => void;
  copiedProfileMergeUser: boolean;
  setCopiedProfileMergeUser: (copied: boolean) => void;
  copiedCurrentProfileMergeUser: boolean;
  setCopiedCurrentProfileMergeUser: (copied: boolean) => void;
  
  // Handlers
  handleProfileMergeSystemSubmit: (event: React.FormEvent) => void;
  handleProfileMergeUserSubmit: (event: React.FormEvent) => void;
}

export default function ProfileMergeTab({
  // userId and status are passed in but not used in this component
  // keeping them in the props for consistency with the interface
  loading,
  activeProfileMergeTab,
  setActiveProfileMergeTab,
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
  handleProfileMergeSystemSubmit,
  handleProfileMergeUserSubmit,
}: ProfileMergeTabProps) {
  return (
    <div className="space-y-6">
      {/* Important Notice About Prompt Retrieval */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-bold text-yellow-800 dark:text-yellow-200">
              📋 IMPORTANT: Simplified Prompt Retrieval
            </h3>
            <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
              <p className="font-medium">
                ⚠️ This page currently shows the MOST RECENT prompt for each category, regardless of whether it is marked as global or not.
              </p>
              <p className="mt-1">
                🔧 In the future, we can improve the code to properly distinguish between global and user-specific prompts. 
                For now, this simplified approach ensures you can see and edit the newest prompts reliably.
              </p>
            </div>
          </div>
        </div>
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
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              A short descriptive title for this prompt version
            </p>
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
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              This system prompt provides detailed instructions for profile merging and is sent to the AI before the profile data.
            </p>
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
              {loading ? 'Processing...' : 'Save Profile Merge System Prompt'}
            </button>
          </div>

          <div className="mt-8">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">
                {globalProfileMergeSystem ? 'Custom Profile Merge System Prompt' : 'Global Profile Merge System Prompt'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(currentProfileMergeSystem);
                  setCopiedCurrentProfileMergeSystem(true);
                  setTimeout(() => setCopiedCurrentProfileMergeSystem(false), 2000);
                }}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                title="Copy to clipboard"
              >
                {copiedCurrentProfileMergeSystem ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
              </button>
            </div>
            
            {/* Side-by-side layout when both user and global versions exist */}
            {globalProfileMergeSystem ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-2 text-sm font-medium text-blue-800 dark:text-blue-200 rounded-t-md border border-blue-200 dark:border-blue-800 border-b-0">
                    Custom Version
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm h-[300px] overflow-y-auto">
                    {currentProfileMergeSystem}
                  </div>
                </div>
                <div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-2 text-sm font-medium text-green-800 dark:text-green-200 rounded-t-md border border-green-200 dark:border-green-800 border-b-0">
                    Global Version
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm h-[300px] overflow-y-auto">
                    {globalProfileMergeSystem}
                  </div>
                </div>
              </div>
            ) : (
              // Single version display when only one version exists
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm">
                {currentProfileMergeSystem}
              </div>
            )}
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
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              A short descriptive title for this prompt version
            </p>
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
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              This user prompt is sent to the AI along with the profile data for merging.
            </p>
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
              {loading ? 'Processing...' : 'Save Profile Merge User Prompt'}
            </button>
          </div>

          <div className="mt-8">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">
                {globalProfileMergeUser ? 'Custom Profile Merge User Prompt' : 'Global Profile Merge User Prompt'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(currentProfileMergeUser);
                  setCopiedCurrentProfileMergeUser(true);
                  setTimeout(() => setCopiedCurrentProfileMergeUser(false), 2000);
                }}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                title="Copy to clipboard"
              >
                {copiedCurrentProfileMergeUser ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
              </button>
            </div>
            
            {/* Side-by-side layout when both user and global versions exist */}
            {globalProfileMergeUser ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-2 text-sm font-medium text-blue-800 dark:text-blue-200 rounded-t-md border border-blue-200 dark:border-blue-800 border-b-0">
                    Custom Version
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm h-[300px] overflow-y-auto">
                    {currentProfileMergeUser}
                  </div>
                </div>
                <div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-2 text-sm font-medium text-green-800 dark:text-green-200 rounded-t-md border border-green-200 dark:border-green-800 border-b-0">
                    Global Version
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm h-[300px] overflow-y-auto">
                    {globalProfileMergeUser}
                  </div>
                </div>
              </div>
            ) : (
              // Single version display when only one version exists
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm">
                {currentProfileMergeUser}
              </div>
            )}
          </div>
        </form>
      )}

    </div>
  );
}