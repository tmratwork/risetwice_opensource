"use client";

import React from 'react';
import UserProfileDisplay from '@/components/UserProfileDisplay';

interface ProfileWrapperProps {
  userProfile: {
    profile: Record<string, unknown>;
    lastUpdated: string | number;
    [key: string]: unknown;
  } | null;
  profileLoading: boolean;
  profileError: string | null;
  refreshUserProfile: () => void;
}

/**
 * A drop-in replacement for the hardcoded profile display in the insights page.
 * This component wraps our flexible UserProfileDisplay with the necessary UI elements
 * to match the existing insights page design.
 */
const ProfileWrapper: React.FC<ProfileWrapperProps> = ({
  userProfile,
  profileLoading,
  profileError
  // refreshUserProfile is intentionally not used in this component
}) => {
  if (profileLoading) {
    return (
      <div className="flex justify-center items-center py-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="bg-red-100 dark:bg-red-900 p-4 rounded-md mb-4">
        <p className="text-red-700 dark:text-red-300">{profileError}</p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="text-gray-700 dark:text-gray-400 italic py-2">
        No profile data available yet. Have more conversations to help the AI learn about you.
      </div>
    );
  }

  return (
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

      {/* Development: Raw JSON View */}
      <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-md font-medium">Raw User Profile Data</h3>
          <button
            onClick={() => {
              // Copy to clipboard
              navigator.clipboard.writeText(JSON.stringify(userProfile, null, 2))
                .then(() => alert('Copied to clipboard'))
                .catch(err => console.error('Failed to copy:', err));
            }}
            className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded"
          >
            Copy
          </button>
        </div>
        <pre className="text-xs overflow-auto max-h-96 bg-white dark:bg-gray-800 p-2 rounded border border-gray-300 dark:border-gray-600">
          {JSON.stringify(userProfile, null, 2)}
        </pre>
      </div>

      {/* Profile content using our flexible component */}
      {Object.keys(userProfile?.profile || {}).length > 0 ? (
        <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
          <UserProfileDisplay 
            profileData={userProfile.profile} 
            lastUpdated={userProfile.lastUpdated} 
          />
        </div>
      ) : (
        <div className="text-gray-700 dark:text-gray-400 italic py-2">
          No profile data yet. Keep having conversations to help the AI learn about you.
        </div>
      )}
    </div>
  );
};

export default ProfileWrapper;