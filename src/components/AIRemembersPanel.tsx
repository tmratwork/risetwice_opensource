"use client";

import React, { useState } from 'react';
import UserProfileDisplay from './UserProfileDisplay';

interface AIRemembersPanelProps {
  userProfile: {
    profile: Record<string, unknown>;
    lastUpdated?: string | number;
    version?: number;
  } | null;
  profileLoading: boolean;
  profileError: string | null;
  onRefreshProfile: () => void;
  onClearProfile: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}

const AIRemembersPanel: React.FC<AIRemembersPanelProps> = ({
  userProfile,
  profileLoading,
  profileError,
  onRefreshProfile,
  onClearProfile,
  expanded,
  onToggleExpand
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  return (
    <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6 print-hide">
      <div 
        className="flex justify-between items-center cursor-pointer" 
        onClick={onToggleExpand}
      >
        <h2 className="text-xl font-semibold">🧠 AI Remembers</h2>
        <span className="text-gray-700 dark:text-gray-300">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <>
          <p className="mb-4 mt-4 text-gray-700 dark:text-gray-300">
            Here you can see what information the AI has learned about you from your conversations.
            This information helps provide more personalized and relevant support.
          </p>

          {profileLoading && (
            <div className="animate-pulse flex flex-col space-y-4 mt-4">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading profile data...</p>
            </div>
          )}

          {profileError && (
            <div className="bg-red-100 dark:bg-red-900 p-4 rounded-lg mt-4">
              <p className="text-red-700 dark:text-red-300">{profileError}</p>
              <button
                onClick={onRefreshProfile}
                className="mt-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
              >
                Try Again
              </button>
            </div>
          )}

          {!profileLoading && !profileError && userProfile ? (
            <>
              <div className="mt-4">
                <div className="bg-white dark:bg-gray-700 p-4 rounded-lg">
                  <UserProfileDisplay 
                    profileData={userProfile.profile} 
                    lastUpdated={userProfile.lastUpdated} 
                  />
                </div>
                
                <div className="mt-4 flex justify-between">
                  <button
                    onClick={onRefreshProfile}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
                    disabled={profileLoading}
                  >
                    {profileLoading ? 'Refreshing...' : 'Refresh Memory'}
                  </button>
                  
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
                    disabled={profileLoading}
                  >
                    Clear Memory
                  </button>
                </div>
                
                {userProfile.version && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Profile version: {userProfile.version}
                  </div>
                )}
              </div>
              
              {showClearConfirm && (
                <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-red-700 dark:text-red-300 font-medium">
                    Are you sure you want to clear what the AI remembers about you?
                  </p>
                  <p className="my-2 text-red-600 dark:text-red-400 text-sm">
                    This action cannot be undone. The AI will start with a blank memory about you.
                  </p>
                  <div className="mt-3 flex space-x-3">
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        onClearProfile();
                        setShowClearConfirm(false);
                      }}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
                    >
                      Yes, Clear Memory
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : !profileLoading && !profileError ? (
            <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-yellow-700 dark:text-yellow-300">
                No profile data available yet. Have more conversations to help the AI learn about you.
              </p>
              <button
                onClick={onRefreshProfile}
                className="mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
              >
                Generate Profile
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

export default AIRemembersPanel;