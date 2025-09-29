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
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              {userRole === 'provider' ? 'Welcome Back!' : 'Patient Dashboard'}
            </h1>
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              {userRole === 'provider'
                ? 'You have provider access. Visit your provider dashboard for full features.'
                : 'Find the right therapist and manage your mental health journey.'
              }
            </p>
          </div>

          {/* Provider Redirect Notice */}
          {userRole === 'provider' && (
            <div className="mb-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    Provider Account Detected
                  </h3>
                  <p className="text-blue-700 dark:text-blue-300 text-sm">
                    You have provider access. Switch to your provider dashboard for full features.
                  </p>
                </div>
                <Link
                  href="/dashboard/provider"
                  className="ml-auto px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Go to Provider Dashboard
                </Link>
              </div>
            </div>
          )}

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Chat with AI */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold ml-3 text-gray-800 dark:text-gray-200">
                  AI Mental Health Support
                </h3>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 font-medium">
                Get immediate support and guidance from our AI mental health assistant.
              </p>
              <Link
                href="/chatbotV17"
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                Therapy Match
              </Link>
            </div>

            {/* Find Therapists */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold ml-3 text-gray-800 dark:text-gray-200">
                  Find Therapists
                </h3>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 font-medium">
                Browse and connect with qualified mental health professionals.
              </p>
              <Link
                href="/chatbotV17"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Search Therapists
              </Link>
            </div>

            {/* Your Progress (todo)*/}
            {/* What AI remembers */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold ml-3 text-gray-800 dark:text-gray-200">
                  What AI Remembers
                </h3>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 font-medium">
                Track your mental health journey and chat history.
              </p>
              <Link
                href="/chatbotV16/memory"
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                View Memory
              </Link>
            </div>
          </div>

          {/* Recent Conversations */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                Recent Conversations
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Your recent AI chat sessions and insights
              </p>
            </div>
            <div className="p-6">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">
                  No conversations yet
                </h3>
                <p className="text-sm text-gray-400">
                  Start a chat session to see your conversation history here.
                </p>
                <Link
                  href="/chatbotV17"
                  className="inline-flex items-center px-4 py-2 mt-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Start Your First Chat
                </Link>
              </div>
            </div>
          </div>

          {/* Mental Health Resources */}
          <div className="mt-8 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-6 border">
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Mental Health Resources
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4">
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Crisis Support
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  If you're in crisis, reach out for immediate help:
                </p>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">
                  988 Suicide & Crisis Lifeline
                </p>
              </div>
              <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4">
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Getting Started
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  New to mental health support? Our AI can help guide you through your first steps toward wellness.
                </p>
              </div>
            </div>
          </div>

          {/* Are you a therapist? */}
          {userRole !== 'provider' && (
            <div className="mt-8 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                    Are you a mental health professional?
                  </h3>
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                    Join RiseTwice as a provider to create your AI Preview and connect with patients.
                  </p>
                </div>
                <Link
                  href="/s2"
                  className="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors"
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