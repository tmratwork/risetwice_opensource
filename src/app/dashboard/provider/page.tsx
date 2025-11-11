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
  const [aiPreviewCurrentStep, setAiPreviewCurrentStep] = useState<string | null>(null);
  const [aiPreviewStepNumber, setAiPreviewStepNumber] = useState<number>(0);
  const [aiPreviewTotalSteps, setAiPreviewTotalSteps] = useState<number>(6);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [pollingStartTime, setPollingStartTime] = useState<number | null>(null);
  const [pollingTimedOut, setPollingTimedOut] = useState<boolean>(false);
  const [accessCode, setAccessCode] = useState<string>('');
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);

  // Poll for AI Preview job status with 20-minute timeout
  const pollAiPreviewStatus = async () => {
    if (!user?.uid) return;

    // Check if 20 minutes have elapsed
    if (pollingStartTime) {
      const elapsedMinutes = (Date.now() - pollingStartTime) / 1000 / 60;
      if (elapsedMinutes >= 20) {
        console.log('[ai_preview_polling] 🛑 20-minute timeout reached, stopping polling');
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        setPollingTimedOut(true);
        return;
      }
    }

    try {
      const response = await fetch(`/api/s2/therapist-profile?userId=${user.uid}`);
      const data = await response.json();

      if (data.success && data.profile) {
        const status = data.profile.ai_preview_status || 'not_started';
        setAiPreviewStatus(status);
        setAiPreviewGeneratedAt(data.profile.ai_preview_generated_at);

        // Get job details if processing or pending
        if (status === 'processing' || status === 'pending') {
          // Fetch job details to get current step
          const jobResponse = await fetch(`/api/s2/ai-preview-job-status?userId=${user.uid}`);
          const jobData = await jobResponse.json();

          if (jobData.success && jobData.job) {
            setAiPreviewCurrentStep(jobData.job.current_step);
            setAiPreviewStepNumber(jobData.job.current_step_number || 0);
            setAiPreviewTotalSteps(jobData.job.total_steps || 6);
          }
        } else if (status === 'completed' || status === 'failed') {
          // Stop polling when job is completed or failed
          console.log(`[ai_preview_polling] 🛑 Job ${status}, stopping polling`);
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
          setPollingStartTime(null);
        }
      }
    } catch (error) {
      console.error('[ai_preview_polling] Error fetching status:', error);
    }
  };

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
          const status = data.profile.ai_preview_status || 'not_started';
          setAiPreviewStatus(status);
          setAiPreviewGeneratedAt(data.profile.ai_preview_generated_at);

          // Start polling if job is pending or processing
          if (status === 'processing' || status === 'pending') {
            console.log('[ai_preview_polling] 🔄 Job is in progress, starting polling');
            setPollingStartTime(Date.now());

            // Poll immediately to get current step
            await pollAiPreviewStatus();

            // Set up polling interval (every 5 seconds)
            const interval = setInterval(pollAiPreviewStatus, 5000);
            setPollingInterval(interval);
          }
        }

        // Fetch unread patient messages count
        const messagesResponse = await fetch(`/api/provider/patient-messages?provider_user_id=${user.uid}`);
        const messagesData = await messagesResponse.json();
        if (messagesData.success) {
          setUnreadMessagesCount(messagesData.unreadCount || 0);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error checking provider access:', error);
        router.push('/dashboard/patient');
      }
    }

    checkAccess();
  }, [user, authLoading, router]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        console.log('[ai_preview_polling] 🧹 Cleaning up polling interval on unmount');
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

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
      <div className="min-h-screen" style={{ backgroundColor: '#c1d7ca', paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              Clinician Dashboard
            </h1>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Direct Messages */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6 relative flex flex-col">
              {unreadMessagesCount > 0 && (
                <button
                  onClick={() => router.push('/dashboard/provider/messages')}
                  className="absolute top-4 right-4 hover:scale-110 transition-transform"
                  aria-label={`${unreadMessagesCount} unread messages`}
                >
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 cursor-pointer">
                    {unreadMessagesCount}
                  </span>
                </button>
              )}
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold ml-3" style={{ color: 'var(--text-primary)' }}>
                  Direct Messages
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 flex-grow">
                Check your inbox for messages from patients.
              </p>
              <button
                onClick={() => router.push('/dashboard/provider/messages')}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                View Inbox
              </button>
            </div>

            {/* New Patient Matches */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6 relative flex flex-col">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold ml-3" style={{ color: 'var(--text-primary)' }}>
                  Patient Matches
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 flex-grow">
                View patient intake recordings you&apos;ve accessed.
              </p>
              <button
                onClick={() => router.push('/dashboard/provider/patient-matches')}
                className="inline-flex items-center px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
              >
                View Matches
              </button>
            </div>

            {/* Enter Access Code */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6 flex flex-col">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold ml-3" style={{ color: 'var(--text-primary)' }}>
                  Enter Access Code
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 flex-grow">
                Enter a code received via notification to access a patient intake recording.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="Enter access code"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  onClick={async () => {
                    if (!accessCode.trim()) {
                      alert('Please enter an access code');
                      return;
                    }

                    // First validate the code
                    try {
                      const response = await fetch('/api/provider/validate-intake-code', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          accessCode: accessCode.trim(),
                          providerUserId: user?.uid
                        })
                      });

                      const result = await response.json();

                      if (!result.success || !result.valid) {
                        alert(result.error || 'Invalid access code');
                        return;
                      }

                      // Code is valid - save it to the list
                      const saveResponse = await fetch('/api/provider/save-access-code', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          accessCode: accessCode.trim(),
                          providerUserId: user?.uid,
                          intakeId: result.intakeId
                        })
                      });

                      const saveResult = await saveResponse.json();
                      if (!saveResult.success) {
                        console.error('Failed to save access code:', saveResult.error);
                        // Don't block navigation if save fails
                      }

                      // Navigate to the intake page
                      router.push(`/dashboard/provider/intake/${accessCode.trim()}`);
                    } catch (error) {
                      console.error('Error validating access code:', error);
                      alert('Failed to validate access code. Please try again.');
                    }
                  }}
                  disabled={!accessCode.trim()}
                  className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Submit
                </button>
              </div>
            </div>

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

              {/* Show progress if AI Preview is pending or processing */}
              {(aiPreviewStatus === 'pending' || aiPreviewStatus === 'processing') && !pollingTimedOut && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900 mb-1">
                        Building AI Preview: Step {aiPreviewStepNumber}/{aiPreviewTotalSteps}
                        {aiPreviewCurrentStep && ` (${aiPreviewCurrentStep})`}
                      </p>
                      <p className="text-xs text-blue-800">
                        This process takes approximately 30 minutes. Status updates automatically every 5 seconds.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Show timeout message if 20 minutes elapsed */}
              {pollingTimedOut && aiPreviewStatus !== 'completed' && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-amber-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-900 mb-1">AI Preview is taking longer than expected</p>
                      <p className="text-xs text-amber-800">
                        The build process is still running but taking longer than usual. Please refresh the page in a few minutes to check status.
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
                  <div className="flex items-center gap-3">
                    <Link
                      href="/chatbotV17?provider=true"
                      className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Test My AI Preview
                    </Link>
                    <Link
                      href="/s2/ai-preview"
                      className="inline-flex items-center px-3 py-2 text-gray-600 dark:text-gray-400 text-sm font-normal rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-300 dark:border-gray-600"
                    >
                      Rebuild
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Create an AI-powered preview that helps patients understand your therapeutic approach.
                  </p>
                  {(aiPreviewStatus === 'pending' || aiPreviewStatus === 'processing') ? (
                    <button
                      disabled
                      className="inline-flex items-center px-4 py-2 bg-gray-400 text-gray-200 text-sm font-medium rounded-lg cursor-not-allowed opacity-60"
                    >
                      Build Your AI Preview
                    </button>
                  ) : (
                    <Link
                      href="/s2/ai-preview"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Build Your AI Preview
                    </Link>
                  )}
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