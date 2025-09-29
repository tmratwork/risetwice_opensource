// src/app/profile/page.tsx
// User Profile View Page

"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { getUserRole, UserRole } from '@/utils/user-role';
import Link from 'next/link';
import { Header } from '@/components/header';

const ProfilePage: React.FC = () => {
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
        console.error('Error checking user role:', error);
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
          <p style={{ color: 'var(--text-secondary)' }}>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)', paddingTop: '80px' }}>
        <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Your Profile
          </h1>
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            View and manage your account information
          </p>
        </div>

        {/* Profile Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-center mb-6">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                {user?.displayName || user?.email || 'User'}
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {userRole === 'provider' ? 'Mental Health Provider' : 'Patient'} • {user?.email}
              </p>
            </div>
          </div>

          {/* Profile Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                Account Information
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Email</label>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{user?.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Account Type</label>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    {userRole === 'provider' ? 'Mental Health Provider' : 'Patient'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Member Since</label>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    {user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                Quick Actions
              </h3>
              <div className="space-y-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Go to Dashboard
                </Link>
                <Link
                  href="/chatbotV16/memory"
                  className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  View Memory
                </Link>
                {userRole !== 'provider' && (
                  <Link
                    href="/s2"
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Become a Provider
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Provider-specific Information */}
        {userRole === 'provider' && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
            <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
              Provider Account Active
            </h3>
            <p className="text-green-700 dark:text-green-300 text-sm mb-4">
              Your AI Preview has been created and is ready for patient interactions. You can test and manage your preview through the provider dashboard.
            </p>
            <div className="flex gap-3">
              <Link
                href="/dashboard/provider"
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                Provider Dashboard
              </Link>
              <Link
                href="/chatbotV17"
                className="px-4 py-2 bg-green-100 text-green-800 text-sm font-medium rounded-lg hover:bg-green-200 transition-colors"
              >
                Test AI Preview
              </Link>
            </div>
          </div>
        )}

        {/* Back to Dashboard */}
        <div className="mt-8 text-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </>
  );
};

export default ProfilePage;