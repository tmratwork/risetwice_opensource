import React from 'react';
import { Copy, Check } from 'lucide-react';

interface ProfileAnalysisTabProps {
  userId: string;
  loading: boolean;
  status: { success?: boolean; message: string };
  activeProfileAnalysisTab: 'system' | 'user';
  setActiveProfileAnalysisTab: (tab: 'system' | 'user') => void;
  
  // System prompt props
  profileAnalysisSystemContent: string;
  setProfileAnalysisSystemContent: (content: string) => void;
  profileAnalysisSystemTitle: string;
  setProfileAnalysisSystemTitle: (title: string) => void;
  profileAnalysisSystemNotes: string;
  setProfileAnalysisSystemNotes: (notes: string) => void;
  currentProfileAnalysisSystem: string;
  globalProfileAnalysisSystem: string | null;
  isProfileAnalysisSystemGlobal: boolean;
  setIsProfileAnalysisSystemGlobal: (isGlobal: boolean) => void;
  copiedProfileAnalysisSystem: boolean;
  setCopiedProfileAnalysisSystem: (copied: boolean) => void;
  copiedCurrentProfileAnalysisSystem: boolean;
  setCopiedCurrentProfileAnalysisSystem: (copied: boolean) => void;
  
  // User prompt props
  profileAnalysisUserContent: string;
  setProfileAnalysisUserContent: (content: string) => void;
  profileAnalysisUserTitle: string;
  setProfileAnalysisUserTitle: (title: string) => void;
  profileAnalysisUserNotes: string;
  setProfileAnalysisUserNotes: (notes: string) => void;
  currentProfileAnalysisUser: string;
  globalProfileAnalysisUser: string | null;
  isProfileAnalysisUserGlobal: boolean;
  setIsProfileAnalysisUserGlobal: (isGlobal: boolean) => void;
  copiedProfileAnalysisUser: boolean;
  setCopiedProfileAnalysisUser: (copied: boolean) => void;
  copiedCurrentProfileAnalysisUser: boolean;
  setCopiedCurrentProfileAnalysisUser: (copied: boolean) => void;
  
  // Handlers
  handleProfileAnalysisSystemSubmit: (event: React.FormEvent) => void;
  handleProfileAnalysisUserSubmit: (event: React.FormEvent) => void;
}

export default function ProfileAnalysisTab({
  // userId and status are passed in but not used in this component
  // keeping them in the props for consistency with the interface
  loading,
  activeProfileAnalysisTab,
  setActiveProfileAnalysisTab,
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
  handleProfileAnalysisSystemSubmit,
  handleProfileAnalysisUserSubmit,
}: ProfileAnalysisTabProps) {
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
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              A short descriptive title for this prompt version
            </p>
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
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              This system prompt provides detailed instructions for profile analysis and is sent to the AI before the conversation content.
            </p>
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
              {loading ? 'Processing...' : 'Save Profile Analysis System Prompt'}
            </button>
          </div>

          <div className="mt-8">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">
                {globalProfileAnalysisSystem ? 'Custom Profile Analysis System Prompt' : 'Global Profile Analysis System Prompt'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(currentProfileAnalysisSystem);
                  setCopiedCurrentProfileAnalysisSystem(true);
                  setTimeout(() => setCopiedCurrentProfileAnalysisSystem(false), 2000);
                }}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                title="Copy to clipboard"
              >
                {copiedCurrentProfileAnalysisSystem ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
              </button>
            </div>
            
            {/* Side-by-side layout when both user and global versions exist */}
            {globalProfileAnalysisSystem ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-2 text-sm font-medium text-blue-800 dark:text-blue-200 rounded-t-md border border-blue-200 dark:border-blue-800 border-b-0">
                    Custom Version
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm h-[300px] overflow-y-auto">
                    {currentProfileAnalysisSystem}
                  </div>
                </div>
                <div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-2 text-sm font-medium text-green-800 dark:text-green-200 rounded-t-md border border-green-200 dark:border-green-800 border-b-0">
                    Global Version
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm h-[300px] overflow-y-auto">
                    {globalProfileAnalysisSystem}
                  </div>
                </div>
              </div>
            ) : (
              // Single version display when only one version exists
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm">
                {currentProfileAnalysisSystem}
              </div>
            )}
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
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              A short descriptive title for this prompt version
            </p>
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
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              This user prompt is sent to the AI along with each conversation being analyzed.
            </p>
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
              {loading ? 'Processing...' : 'Save Profile Analysis User Prompt'}
            </button>
          </div>

          <div className="mt-8">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">
                {globalProfileAnalysisUser ? 'Custom Profile Analysis User Prompt' : 'Global Profile Analysis User Prompt'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(currentProfileAnalysisUser);
                  setCopiedCurrentProfileAnalysisUser(true);
                  setTimeout(() => setCopiedCurrentProfileAnalysisUser(false), 2000);
                }}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                title="Copy to clipboard"
              >
                {copiedCurrentProfileAnalysisUser ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
              </button>
            </div>
            
            {/* Side-by-side layout when both user and global versions exist */}
            {globalProfileAnalysisUser ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-2 text-sm font-medium text-blue-800 dark:text-blue-200 rounded-t-md border border-blue-200 dark:border-blue-800 border-b-0">
                    Custom Version
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm h-[300px] overflow-y-auto">
                    {currentProfileAnalysisUser}
                  </div>
                </div>
                <div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-2 text-sm font-medium text-green-800 dark:text-green-200 rounded-t-md border border-green-200 dark:border-green-800 border-b-0">
                    Global Version
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm h-[300px] overflow-y-auto">
                    {globalProfileAnalysisUser}
                  </div>
                </div>
              </div>
            ) : (
              // Single version display when only one version exists
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-mono text-sm">
                {currentProfileAnalysisUser}
              </div>
            )}
          </div>
        </form>
      )}

    </div>
  );
}