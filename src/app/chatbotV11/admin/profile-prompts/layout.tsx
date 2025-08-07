'use client';

import { ReactNode } from 'react';
import Link from 'next/link';

export default function ProfilePromptsLayout({ children }: { children: ReactNode }) {

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  RiseTwice Profile Management
                </span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/chatbotV11/admin"
                  className="border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Back to Admin
                </Link>
                <Link
                  href="/chatbotV11/admin/profile"
                  className="border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Profile Management
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}