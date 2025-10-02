// src/app/dashboard/patient/page.tsx
// Patient Dashboard

"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { getUserRole, UserRole } from '@/utils/user-role';
import Link from 'next/link';
import { Header } from '@/components/header';

const PatientDashboard: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    async function checkAccess() {
      if (authLoading) return;

      if (!user) {
        router.push('/');
        return;
      }

      try {
        const role = await getUserRole(user.uid);
        setUserRole(role);
        setLoading(false);
      } catch (error) {
        console.error('Error checking patient access:', error);
        setLoading(false);
      }
    }

    checkAccess();
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)', paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {userRole === 'provider' ? 'Welcome Back!' : 'Patient Dashboard'}
            </h1>
            {userRole === 'provider' && (
              <p className="text-xl max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
                You have provider access. Visit your clinician dashboard for full features.
              </p>
            )}
          </div>

          {/* Provider Redirect Notice */}
          {userRole === 'provider' && (
            <div className="mb-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-8 border border-blue-200 dark:border-blue-800 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-6">
                    <h3 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      Provider Account Detected
                    </h3>
                    <p className="text-blue-700 dark:text-blue-300">
                      You have provider access. Switch to your clinician dashboard for full features.
                    </p>
                  </div>
                </div>
                <Link
                  href="/dashboard/provider"
                  className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Go to Clinician Dashboard
                </Link>
              </div>
            </div>
          )}

          {/* Quick Actions Section */}
          <div className="mb-16">
            <div className="flex justify-center">
              <div className="w-full max-w-md">
                {/* What AI remembers */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-8 hover:shadow-lg transition-all duration-200">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">
                      What AI Remembers
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                      Track your mental health journey and chat history.
                    </p>
                    <Link
                      href="/chatbotV16/memory"
                      className="inline-flex items-center px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      View Memory
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Conversations */}
          <div className="mb-16">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden">
              <div className="p-8 border-b border-gray-200 dark:border-gray-700">
                <div className="text-center">
                  <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                    Recent Conversations
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Your recent AI chat sessions and insights
                  </p>
                </div>
              </div>
              <div className="p-6">
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">
                    No conversations yet
                  </h3>
                  <p className="text-sm text-gray-400 mb-5 max-w-sm mx-auto">
                    Start a chat session to see your conversation history here.
                  </p>
                  <Link
                    href="/chatbotV17"
                    className="inline-flex items-center px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    Start Your First Chat
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Mental Health Resources */}
          <div className="mb-16">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl p-8 border">
              <div className="flex justify-center">
                <div className="w-full max-w-md">
                  <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-6 text-center shadow-sm">
                    <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                      Crisis Support
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                      If you&apos;re in crisis, reach out for immediate help:
                    </p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">
                      988 Suicide & Crisis Lifeline
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Are you a therapist? */}
          {userRole !== 'provider' && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-8 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mr-6">
                    <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                      Are you a mental health professional?
                    </h3>
                    <p className="text-yellow-700 dark:text-yellow-300">
                      Join RiseTwice as a provider to create your AI Preview and connect with patients.
                    </p>
                  </div>
                </div>
                <Link
                  href="/s2"
                  className="px-6 py-3 bg-yellow-600 text-white font-medium rounded-lg hover:bg-yellow-700 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Provider Sign Up
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PatientDashboard;