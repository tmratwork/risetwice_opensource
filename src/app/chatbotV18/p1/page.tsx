// src/app/chatbotV18/p1/page.tsx
"use client";

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useState, useEffect } from 'react';

export default function PatientIntakeLanding() {
  const router = useRouter();
  const { user } = useAuth();
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const handleNextSteps = () => {
    // Navigate to how-it-works page
    router.push('/chatbotV18/p1/how-it-works');
  };

  const handleViewMessages = () => {
    // Check if user is logged in
    if (!user) {
      alert('Please sign in to check your therapist messages.');
      return;
    }

    // Navigate to messages page
    router.push('/chatbotV18/p1/messages');
  };

  // Fetch most recent access code on mount and when page becomes visible
  useEffect(() => {
    const fetchAccessCode = async () => {
      if (!user?.uid && !user?.email) {
        setLoading(false);
        return;
      }

      try {
        console.log('[V18/p1] Fetching most recent access code for user:', user.uid || user.email);
        const params = new URLSearchParams();
        if (user?.uid) {
          params.append('userId', user.uid);
        } else if (user?.email) {
          params.append('email', user.email);
        }

        const response = await fetch(`/api/patient-intake/get?${params.toString()}`);
        const result = await response.json();

        if (response.ok && result.success && result.hasData && result.data.access_code) {
          console.log('[V18/p1] ✅ Access code loaded:', result.data.access_code);
          setAccessCode(result.data.access_code);
        } else {
          console.log('[V18/p1] No access code found for user');
        }
      } catch (error) {
        console.error('[V18/p1] Failed to fetch access code:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAccessCode();

    // Also refetch when user navigates back to this page
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[V18/p1] Page visible - refetching access code');
        fetchAccessCode();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user?.uid, user?.email]);

  // Fetch unread message count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!user?.uid) return;

      try {
        const response = await fetch(`/api/patient/provider-messages?patient_user_id=${user.uid}`);
        const result = await response.json();

        if (response.ok && result.success) {
          setUnreadCount(result.unreadCount || 0);
        }
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };

    fetchUnreadCount();
  }, [user?.uid]);

  return (
    <div className="w-full h-full overflow-y-auto flex justify-center p-6 pt-16">
      <div className="w-full max-w-6xl my-auto">
        {/* Two-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* New Patient Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg flex flex-col">
            <h2 className="text-3xl font-bold mb-4 text-gray-800 dark:text-gray-100">
              New Patient?
            </h2>
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-8 leading-relaxed flex-grow">
              Start with a 10-minute conversation with our AI. Share what&apos;s going on, and therapists who can help will reach out to you.
            </p>
            <button
              onClick={handleNextSteps}
              className="w-full bg-sage-300 dark:bg-sage-400 hover:bg-sage-400 dark:hover:bg-sage-500 text-gray-800 dark:text-gray-900 font-semibold py-4 px-6 rounded-xl transition-colors text-lg"
            >
              Next Steps
            </button>
          </div>

          {/* Returning Patient Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg flex flex-col relative">
            {/* Returning Badge */}
            <div className="inline-block bg-yellow-400 text-gray-900 px-4 py-1 rounded-lg font-semibold text-sm mb-4 self-start">
              Returning
            </div>
            {/* Unread Badge */}
            {unreadCount > 0 && (
              <button
                onClick={handleViewMessages}
                className="absolute top-4 right-4 hover:scale-110 transition-transform"
                aria-label={`${unreadCount} unread messages`}
              >
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white cursor-pointer">
                  {unreadCount}
                </span>
              </button>
            )}
            <h2 className="text-3xl font-bold mb-4 text-gray-800 dark:text-gray-100">
              Check Your Matches
            </h2>
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-8 leading-relaxed flex-grow">
              Therapists have listened to your intake and recorded personal messages for you. Hear who&apos;s ready to help.
            </p>
            <button
              onClick={handleViewMessages}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold py-4 px-6 rounded-xl transition-colors text-lg"
            >
              View Therapist Messages
            </button>
          </div>
        </div>

        {/* Access Code Display */}
        {!loading && accessCode && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-8 text-center">
            <p className="text-xs text-gray-600 mb-1">Your Provider Access Code:</p>
            <div className="text-xl font-semibold text-gray-700 tracking-wide mb-1">
              {accessCode}
            </div>
            <p className="text-xs text-gray-500">
              Share this code with your provider if you&apos;d like them to access your intake information
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
