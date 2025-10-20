// src/app/dashboard/provider/page.tsx
// Provider (Therapist) Dashboard

"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { getUserRole, UserRole } from '@/utils/user-role';
import Link from 'next/link';
import { Header } from '@/components/header';

const ProviderDashboard: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [, setUserRole] = useState<UserRole | null>(null);
  const [aiPreviewStatus, setAiPreviewStatus] = useState<string | null>(null);
  const [aiPreviewGeneratedAt, setAiPreviewGeneratedAt] = useState<string | null>(null);

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

        // Redirect non-providers
        if (role !== 'provider') {
          router.push('/dashboard/patient');
          return;
        }

        // Fetch AI Preview generation status
        const response = await fetch(`/api/s2/therapist-profile?userId=${user.uid}`);
        const data = await response.json();
        if (data.success && data.profile) {
          setAiPreviewStatus(data.profile.ai_preview_status || 'not_started');
          setAiPreviewGeneratedAt(data.profile.ai_preview_generated_at);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error checking provider access:', error);
        router.push('/dashboard/patient');
      }
    }

    checkAccess();
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading clinician dashboard...</p>
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
              Clinician Dashboard
            </h1>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Profile Management */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold ml-3" style={{ color: 'var(--text-primary)' }}>
                  Profile Management
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                View and edit your professional profile, specializations, and credentials.
              </p>
              <Link
                href="/s2?skip=welcome"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Manage Profile
              </Link>
            </div>

            {/* AI Preview Building/Testing */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold ml-3" style={{ color: 'var(--text-primary)' }}>
                  AI Preview
                </h3>
              </div>

              {/* Show warning if AI Preview is still generating */}
              {aiPreviewStatus === 'generating' && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-amber-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-900 mb-1">AI Preview is still generating</p>
                      <p className="text-xs text-amber-800">
                        This process takes approximately 30 minutes. Please refresh this page later to test your AI Preview.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Show success message if completed */}
              {aiPreviewStatus === 'completed' && aiPreviewGeneratedAt && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900">AI Preview ready</p>
                      <p className="text-xs text-green-800">
                        Generated {new Date(aiPreviewGeneratedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {aiPreviewStatus === 'completed' ? (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Experience your AI Preview as patients would.
                  </p>
                  <Link
                    href="/chatbotV17?provider=true"
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Test My AI Preview
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Create an AI-powered preview that helps patients understand your therapeutic approach.
                  </p>
                  <Link
                    href="/s2/ai-preview"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Build Your AI Preview
                  </Link>
                </>
              )}
            </div>

            {/* Analytics & Insights */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold ml-3" style={{ color: 'var(--text-primary)' }}>
                  Analytics & Insights
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                View patient interactions, preview performance, and engagement metrics.
              </p>
              <Link
                href="/dashboard/provider/analytics"
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                View Analytics
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                Recent Activity
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Track your recent profile updates and AI Preview interactions
              </p>
            </div>
            <div className="p-6">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">
                  No recent activity
                </h3>
                <p className="text-sm text-gray-400">
                  Your profile updates and AI Preview interactions will appear here.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default ProviderDashboard;