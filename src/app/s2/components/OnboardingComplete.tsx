// src/app/s2/components/OnboardingComplete.tsx
// Onboarding Complete - Final page with congratulations and next steps

"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import ContactSupportModal from './ContactSupportModal';

interface OnboardingCompleteProps {
  onBack: () => void;
}

const OnboardingComplete: React.FC<OnboardingCompleteProps> = ({
  onBack
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  // Complete onboarding and trigger AI Preview generation when component mounts
  useEffect(() => {
    const completeOnboarding = async () => {
      if (!user || onboardingCompleted) return;

      try {
        // Complete onboarding and set provider role
        const response = await fetch('/api/s2/complete-onboarding', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.uid }),
        });

        if (response.ok) {
          setOnboardingCompleted(true);
          console.log('[S2] Onboarding completed, user role set to provider');
        } else {
          console.error('[S2] Failed to complete onboarding');
        }

        // Trigger AI Preview generation in background
        const profileResponse = await fetch('/api/s2/profile-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.uid })
        });

        const profileData = await profileResponse.json();

        if (profileData.success && profileData.data?.therapistProfile) {
          const therapistProfileId = profileData.data.therapistProfile.id;

          console.log('[S2] 🤖 Creating background AI preview job for therapist:', therapistProfileId);

          // Generate AI prompt (creates job, returns immediately)
          fetch('/api/admin/s2/generate-therapist-prompt', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              therapistId: therapistProfileId
            })
          }).then(async (response) => {
            const result = await response.json();
            if (result.success) {
              console.log('[S2] ✅ AI preview job created:', result.jobId);
              console.log('[S2] ⏳ Job will be processed in background (~30 minutes)');
            } else {
              console.error('[S2] ❌ Failed to create AI preview job:', result.error);
            }
          }).catch((error) => {
            console.error('[S2] ❌ Background AI preview job creation failed (non-blocking):', error);
          });

          // Clone voice (silent, parallel to AI prompt generation)
          console.log('[S2] 🎤 Triggering background voice cloning for therapist:', therapistProfileId);
          fetch('/api/admin/s2/clone-voice', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              therapistProfileId: therapistProfileId
            })
          }).then(async (response) => {
            const result = await response.json();
            if (result.success && result.skipped) {
              console.log('[S2] ⏭️ Voice cloning skipped: no new audio material');
            } else if (result.success) {
              console.log('[S2] ✅ Voice cloning completed successfully:', result.voice_id);
            } else {
              console.log('[S2] ⚠️ Voice cloning failed (non-blocking):', result.message);
            }
          }).catch((error) => {
            console.error('[S2] ❌ Background voice cloning failed (non-blocking):', error);
          });
        }

      } catch (error) {
        console.error('[S2] Error completing onboarding:', error);
      }
    };

    completeOnboarding();
  }, [user, onboardingCompleted]);

  const handleGoToDashboard = () => {
    setIsNavigating(true);
    // Navigate to provider dashboard
    router.push('/dashboard/provider');
  };

  const handleContactSupport = () => {
    setIsSupportModalOpen(true);
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
            Congratulations! Your AI Preview is Being Created
          </h1>
          <p className="text-lg max-w-3xl mx-auto mb-8" style={{ color: 'var(--text-secondary)' }}>
            Patients can now experience
            a realistic preview of what therapy sessions with you would be like, helping ensure
            better matches from day one.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-6 text-center" style={{ color: 'var(--text-primary)' }}>
            What&apos;s Next?
          </h2>

          <div className="text-center">
            {/* Go to Dashboard */}
            <div className="mx-auto mb-6 w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Go to Dashboard
            </h3>
            <button
              onClick={handleGoToDashboard}
              disabled={isNavigating}
              className="control-button primary text-base px-8 py-3 mb-4"
            >
              Go to Dashboard
            </button>
            <p className="text-sm text-gray-600 max-w-md mx-auto">
              Access your main dashboard to test and edit your AI preview, edit profile, and view analytics.
            </p>
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
          <div>
            <button
              onClick={handleContactSupport}
              className="text-green-600 hover:text-green-800 underline text-sm"
            >
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

      {/* Contact Support Modal */}
      <ContactSupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
      />
    </div>
  );
};

export default OnboardingComplete;