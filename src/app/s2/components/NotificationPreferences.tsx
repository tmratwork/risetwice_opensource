// src/app/s2/components/NotificationPreferences.tsx
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import StepNavigator from './StepNavigator';
import { FlowStep, StepCompletionStatus } from '@/utils/s2-validation';

interface NotificationPreferencesProps {
  onNext: () => void;
  onBack: () => void;
  onStepNavigation: (step: FlowStep) => void;
  canSkipToStep: (targetStep: FlowStep, currentStep: FlowStep) => boolean;
  stepCompletionStatus: StepCompletionStatus;
}

export default function NotificationPreferences({
  onNext,
  onBack,
  onStepNavigation,
  canSkipToStep,
  stepCompletionStatus
}: NotificationPreferencesProps) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState({
    emailNotifications: false,
    smsNotifications: false,
    phone: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch existing preferences and provider profile on mount
  useEffect(() => {
    const fetchPreferences = async () => {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/provider/notification-preferences?userId=${user.uid}`);

        if (response.ok) {
          const data = await response.json();
          setPreferences({
            emailNotifications: data.emailNotifications ?? false,
            smsNotifications: data.smsNotifications ?? false,
            phone: data.phone || '',
          });
        }
      } catch (error) {
        console.error('Failed to fetch notification preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
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
      const response = await fetch('/api/provider/notification-preferences', {
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

      // Move to next step after successful save
      onNext();
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      alert('Failed to save preferences. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#c1d7ca' }}>
      {/* Step Navigator */}
      <StepNavigator
        currentStep="notification-preferences"
        onStepClick={onStepNavigation}
        canSkipToStep={canSkipToStep}
        stepCompletionStatus={stepCompletionStatus}
      />

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          {/* Step indicator */}
          <div className="text-center mb-4">
            <p className="text-sm" style={{ color: '#3b503c' }}>Step 4 of 4</p>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold text-center mb-4" style={{ color: '#3b503c' }}>
            Notification Preferences
          </h1>
          <p className="text-center mb-8" style={{ color: '#3b503c' }}>
            Choose how you&apos;d like to be notified when patients interact with you
          </p>

          {/* Settings Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                  Get Notified When
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Patients use your AI Preview or reply to your messages
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
                      Receive email alerts for patient interactions
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
                      Receive text alerts for patient interactions
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

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-4 pt-4">
                <button
                  type="button"
                  onClick={onBack}
                  className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Back
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || (preferences.smsNotifications && !preferences.phone)}
                  className="px-8 py-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-gray-900 font-bold rounded-xl transition-colors shadow-lg"
                >
                  {isSubmitting ? 'Saving...' : 'Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
