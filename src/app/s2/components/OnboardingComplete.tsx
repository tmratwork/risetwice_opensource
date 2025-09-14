// src/app/s2/components/OnboardingComplete.tsx
// Onboarding Complete - Final page with congratulations and next steps

"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface OnboardingCompleteProps {
  onBack: () => void;
}

const OnboardingComplete: React.FC<OnboardingCompleteProps> = ({
  onBack
}) => {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleViewProfile = () => {
    setIsNavigating(true);
    // Navigate to profile view page
    router.push('/profile');
  };

  const handleGoToDashboard = () => {
    setIsNavigating(true);
    // Navigate to main dashboard
    router.push('/dashboard');
  };

  const handleCreateAnotherPreview = () => {
    setIsNavigating(true);
    // Navigate back to start of S2 flow
    router.push('/s2');
  };

  return (
    <div className="flex-1 flex flex-col" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      {/* Progress Indicator - Complete */}
      <div style={{ backgroundColor: 'var(--bg-secondary)' }} className="border-b pt-8">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center mb-4">
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Complete!</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          {/* Success Icon */}
          <div className="mx-auto mb-8 w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-4xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
            Congratulations! Your AI Preview is Ready
          </h1>
          <p className="text-lg max-w-3xl mx-auto mb-8" style={{ color: 'var(--text-secondary)' }}>
            Your personalized AI Preview has been created successfully. Patients can now experience 
            a realistic preview of what therapy sessions with you would be like, helping ensure 
            better matches from day one.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-6 text-center" style={{ color: 'var(--text-primary)' }}>
            What&apos;s Next?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* View Your Profile */}
            <div className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                Review Your Profile
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                See how your profile appears to potential patients and make any final adjustments.
              </p>
              <button
                onClick={handleViewProfile}
                disabled={isNavigating}
                className="control-button text-sm"
                style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              >
                View Profile
              </button>
            </div>

            {/* Go to Dashboard */}
            <div className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                Go to Dashboard
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Access your main dashboard to manage your practice, view analytics, and more.
              </p>
              <button
                onClick={handleGoToDashboard}
                disabled={isNavigating}
                className="control-button primary text-sm"
              >
                Dashboard
              </button>
            </div>

            {/* Create Another Preview */}
            <div className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                Create Another Preview
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Create additional AI Previews for different specialties or patient types.
              </p>
              <button
                onClick={handleCreateAnotherPreview}
                disabled={isNavigating}
                className="control-button text-sm"
                style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              >
                New Preview
              </button>
            </div>
          </div>
        </div>

        {/* Key Features Summary */}
        <div className="bg-green-50 rounded-lg border border-green-200 p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Your AI Preview Includes:
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-600 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-gray-700">Personalized clinical scenario based on your ideal patient</span>
            </div>
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-600 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-gray-700">AI configured to match your therapeutic style and approach</span>
            </div>
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-600 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-gray-700">Voice clone trained on your recorded session</span>
            </div>
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-600 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-gray-700">Complete professional profile for patient matching</span>
            </div>
          </div>
        </div>

        {/* Help & Support */}
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-4">
            Need help or have questions about your AI Preview?
          </p>
          <div className="space-x-4">
            <button className="text-green-600 hover:text-green-800 underline text-sm">
              View Help Center
            </button>
            <span className="text-gray-400">•</span>
            <button className="text-green-600 hover:text-green-800 underline text-sm">
              Contact Support
            </button>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-12 text-center">
          <button
            onClick={onBack}
            className="control-button"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            ← Back to previous step
          </button>
        </div>
      </main>
    </div>
  );
};

export default OnboardingComplete;