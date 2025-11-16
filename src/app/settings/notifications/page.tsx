// src/app/settings/notifications/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [preferences, setPreferences] = useState({
    emailNotifications: false,
    smsNotifications: false,
    phone: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch existing preferences on mount
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
            emailNotifications: data.emailNotifications ?? false,
            smsNotifications: data.smsNotifications ?? false,
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
    setSaveSuccess(false);

    try {
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

      setSaveSuccess(true);
      // Show success message briefly, then redirect to home
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      alert('Failed to save preferences. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-sage-500"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="w-full h-full overflow-y-auto px-6 pt-16 pb-6">
      <div className="max-w-2xl mx-auto">
        {/* Settings Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  Patient Notification Preferences
                </h2>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Get notified when therapists send you messages
              </p>

              {/* Link to Provider Notification Settings */}
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Also a provider? Manage your provider notification preferences separately.
                </p>
                <a
                  href="/settings/provider-notifications"
                  className="inline-flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  Go to Provider Notification Settings
                  <svg
                    className="ml-1 w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </a>
              </div>

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

            {/* Save Button */}
            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={isSubmitting || (preferences.smsNotifications && !preferences.phone)}
                className="bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-gray-900 font-bold py-3 px-8 rounded-xl transition-colors shadow-lg"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>

              {saveSuccess && (
                <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Saved successfully!
                </span>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
