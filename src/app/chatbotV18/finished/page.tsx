// src/app/chatbotV18/finished/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

export default function FinishedPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    smsNotifications: true,
    phone: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch existing phone number on mount
  useEffect(() => {
    const fetchExistingPreferences = async () => {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/patient-intake/notification-preferences?userId=${user.uid}`);

        if (response.ok) {
          const data = await response.json();
          setPreferences({
            emailNotifications: data.emailNotifications ?? true,
            smsNotifications: data.smsNotifications ?? true,
            phone: data.phone || '',
          });
        }
      } catch (error) {
        console.error('Failed to fetch existing preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExistingPreferences();
  }, [user?.uid]);

  const handleCheckboxChange = (field: 'emailNotifications' | 'smsNotifications') => {
    setPreferences(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPreferences(prev => ({ ...prev, phone: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // TODO: Submit preferences to API
      const response = await fetch('/api/patient-intake/notification-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.uid || null,
          emailNotifications: preferences.emailNotifications,
          smsNotifications: preferences.smsNotifications,
          phone: preferences.phone,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      setIsSubmitted(true);
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      alert('Failed to save preferences. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnToMatches = () => {
    router.push('/chatbotV18/p1');
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-6 bg-sage-200 dark:bg-[#131314]">
      <div className="w-full max-w-2xl">
        {/* Finished Title */}
        <h1 className="text-5xl font-bold text-center mb-8 text-gray-800 dark:text-gray-100">
          Finished!
        </h1>

        {/* Main Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-sage-500"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
            </div>
          ) : !isSubmitted ? (
            <>
              {/* Thank you message */}
              <div className="mb-8">
                <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                  Thank you for completing your intake session! Therapists will now review your voice recording and background information.
                </p>
                <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                  You can return later to check for voice messages from therapists who feel they are a good fit and can help.
                </p>
              </div>

              {/* Notification Preferences Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                    Stay Updated
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Get notified when therapists send you messages
                  </p>

                  {/* Email Notifications */}
                  <label className="flex items-start space-x-3 mb-4 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={preferences.emailNotifications}
                      onChange={() => handleCheckboxChange('emailNotifications')}
                      className="mt-1 w-5 h-5 text-sage-500 border-gray-300 rounded focus:ring-sage-400"
                    />
                    <div className="flex-1">
                      <span className="text-gray-800 dark:text-gray-100 font-medium">
                        Email notifications
                      </span>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Receive email alerts when therapists send you voice messages
                      </p>
                    </div>
                  </label>

                  {/* SMS Notifications */}
                  <label className="flex items-start space-x-3 mb-4 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={preferences.smsNotifications}
                      onChange={() => handleCheckboxChange('smsNotifications')}
                      className="mt-1 w-5 h-5 text-sage-500 border-gray-300 rounded focus:ring-sage-400"
                    />
                    <div className="flex-1">
                      <span className="text-gray-800 dark:text-gray-100 font-medium">
                        Text message (SMS) notifications
                      </span>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Receive text alerts when therapists send you voice messages
                      </p>
                    </div>
                  </label>

                  {/* Phone number input (conditional on SMS) */}
                  {preferences.smsNotifications && (
                    <div className="ml-8 mb-4">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={preferences.phone}
                        onChange={handlePhoneChange}
                        required={preferences.smsNotifications}
                        placeholder="(555) 555-5555"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sage-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || (preferences.smsNotifications && !preferences.phone)}
                  className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-gray-900 font-bold py-4 px-6 rounded-xl transition-colors text-lg shadow-lg"
                >
                  {isSubmitting ? 'Saving...' : 'Save Preferences'}
                </button>

                {/* Skip option */}
                <button
                  type="button"
                  onClick={handleReturnToMatches}
                  className="w-full text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm underline"
                >
                  Skip for now
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Success Message */}
              <div className="text-center py-8">
                <div className="mb-6">
                  <svg
                    className="mx-auto h-16 w-16 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                  Preferences Saved!
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-8">
                  We&apos;ll notify you when therapists send you messages.
                </p>
                <button
                  onClick={handleReturnToMatches}
                  className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-3 px-8 rounded-xl transition-colors shadow-lg"
                >
                  Return to Match Page
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
