// src/app/s2/components/SessionPreparation.tsx
// Session Preparation - Loading screen with scenario generation

"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import StepNavigator from './StepNavigator';
import { StepCompletionStatus, FlowStep } from '@/utils/s2-validation';

interface SessionData {
  therapistProfile: {
    fullName: string;
    title: string;
    degrees: string[];
    primaryLocation: string;
    offersOnline: boolean;
    phoneNumber?: string;
    emailAddress?: string;
  };
  patientDescription: {
    description: string;
  };
  aiStyle: {
    therapeuticModalities: {
      cognitive_behavioral: number;
      person_centered: number;
      psychodynamic: number;
      solution_focused: number;
    };
    communicationStyle: {
      friction: number;
      tone: number;
      energyLevel: number;
    };
  };
  generatedScenario?: string;
  scenarioId?: string;
}

interface SessionPreparationProps {
  sessionData: SessionData;
  onNext: () => void;
  onBack: () => void;
  onUpdateSessionData: (data: Partial<SessionData>) => void;
  onStepNavigation?: (step: FlowStep) => void;
  canSkipToStep?: (targetStep: FlowStep, currentStep: FlowStep) => boolean;
  stepCompletionStatus?: StepCompletionStatus;
}

const SessionPreparation: React.FC<SessionPreparationProps> = ({
  sessionData,
  onNext,
  onBack,
  onUpdateSessionData,
  onStepNavigation,
  canSkipToStep,
  stepCompletionStatus
}) => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [scenario, setScenario] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!sessionData.generatedScenario) {
      generateScenario();
    } else {
      setScenario(sessionData.generatedScenario);
    }
  }, [sessionData]);

  const generateScenario = async () => {
    if (!user?.uid) {
      setError('Authentication required. Please sign in.');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      console.log('[S2] Generating scenario with data:', sessionData);

      const response = await fetch('/api/s2/generate-scenario', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          therapistProfile: sessionData.therapistProfile,
          patientDescription: sessionData.patientDescription.description,
          aiStyle: sessionData.aiStyle
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.scenario) {
        setScenario(data.scenario);

        // Update parent sessionData with scenario and scenarioId
        onUpdateSessionData({
          generatedScenario: data.scenario,
          scenarioId: data.scenarioId
        });

        console.log('[S2] ✅ Scenario generated and saved successfully:', data.scenarioId);
      } else {
        throw new Error(data.error || 'Invalid response format');
      }

    } catch (err) {
      setError('Failed to generate scenario. Please try again.');
      console.error('[S2] Scenario generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const retryGeneration = () => {
    generateScenario();
  };

  return (
    <div className="flex-1 flex flex-col" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      {/* Step Navigator */}
      {onStepNavigation && (
        <StepNavigator
          currentStep="preparation"
          onStepClick={onStepNavigation}
          canSkipToStep={canSkipToStep}
          stepCompletionStatus={stepCompletionStatus}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
            Preparing for your clinical session
          </h1>

          {/* Loading Animation */}
          {isGenerating && (
            <div className="mb-8">
              <div className="flex justify-center mb-6">
                {/* Audio wave animation */}
                <div className="flex items-end space-x-2">
                  {[1, 2, 3, 4, 5].map((bar) => (
                    <div
                      key={bar}
                      className={`w-3 bg-gradient-to-t from-blue-400 to-purple-400 rounded-full animate-pulse`}
                      style={{
                        height: `${20 + (bar * 8)}px`,
                        animationDelay: `${bar * 0.1}s`,
                        animationDuration: '1s'
                      }}
                    ></div>
                  ))}
                </div>
              </div>
              <p className="text-lg text-gray-600 mb-4">
                Generating your personalized scenario...
              </p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="mb-8">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
                <div className="flex items-center">
                  <svg className="w-6 h-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <p className="text-red-800">{error}</p>
                </div>
              </div>
              <button
                onClick={retryGeneration}
                className="control-button primary"
                style={{ backgroundColor: '#dc2626' }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Success State */}
          {scenario && !isGenerating && (
            <div className="mb-8">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                <div className="flex items-start">
                  <svg className="w-6 h-6 text-green-600 mr-3 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-green-800 text-left">
                    <strong>Scenario ready!</strong> Your AI patient has been configured based on your preferences.
                  </p>
                </div>
              </div>

              <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>
                Sessions auto-end after 20 minutes. Please
                ensure you have a stable internet connection and a quiet
                environment.
              </p>

              <button
                onClick={onNext}
                className="control-button primary large-button"
                disabled={isGenerating}
              >
                Begin Session
              </button>

              <p className="text-sm text-gray-500 mt-4">
                The session will begin shortly...
              </p>
            </div>
          )}

          {/* Back Button */}
          {!isGenerating && (
            <div className="mt-8">
              <button
                onClick={onBack}
                className="control-button"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              >
                ← Back to customization
              </button>
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.5); }
        }
        .animate-wave {
          animation: wave 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default SessionPreparation;