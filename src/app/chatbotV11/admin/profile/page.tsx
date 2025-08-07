'use client';

import { useEffect } from 'react';

export default function ProfilePage() {

  useEffect(() => {
    // Just display the current page, no need to redirect
    // This component now serves as the main profile management page
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-8">
          Profile Management
        </h1>

        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
          <p className="text-lg mb-4">
            This page allows you to manage user profile features:
          </p>

          <ul className="list-disc pl-6 mb-6 space-y-2">
            <li className="text-gray-700 dark:text-gray-300">
              <a
                href="/chatbotV11/admin/profile-prompts"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Profile Prompts
              </a> - Edit system and user prompts for profile analysis and profile merging
            </li>
          </ul>

          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            User profiles are automatically built from conversation analysis and can be customized using the prompts above.
          </p>
        </div>
      </div>
    </div>
  );
}