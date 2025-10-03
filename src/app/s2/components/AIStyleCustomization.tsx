// src/app/s2/components/AIStyleCustomization.tsx
// AI Style Customization - Therapeutic Modality and Communication Style

"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import StepNavigator from './StepNavigator';
import InfoTooltip from './InfoTooltip';
import { StepCompletionStatus } from '@/utils/s2-validation';

type FlowStep = 'welcome' | 'profile' | 'patient-description' | 'ai-style' | 'license-verification' | 'complete-profile' | 'preparation' | 'session' | 'onboarding-complete';

interface AIStyle {
  therapeuticModalities: {
    cognitive_behavioral: number;
    person_centered: number;
    psychodynamic: number;
    solution_focused: number;
  };
  communicationStyle: {
    interactionStyle: number; // 0 = Suggestive Framing, 100 = Guided Reflection
    tone: number; // 0 = Warm & Casual, 100 = Clinical & Formal
    energyLevel: number; // 0 = Energetic & Expressive, 100 = Calm & Grounded
  };
}

interface AIStyleCustomizationProps {
  style: AIStyle;
  onUpdate: (style: Partial<AIStyle>) => void;
  onNext: () => void;
  onBack: () => void;
  onStepNavigation?: (step: FlowStep) => void;
  canSkipToStep?: (targetStep: FlowStep, currentStep: FlowStep) => boolean;
  stepCompletionStatus?: StepCompletionStatus;
}

const AIStyleCustomization: React.FC<AIStyleCustomizationProps> = ({
  style,
  onUpdate,
  onNext,
  onBack,
  onStepNavigation,
  canSkipToStep,
  stepCompletionStatus
}) => {
  const { user } = useAuth();
  const [totalModality, setTotalModality] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingStyle, setLoadingStyle] = useState(true);
  const [error, setError] = useState<string>('');

  // Load existing AI style config on mount
  useEffect(() => {
    const loadExistingStyle = async () => {
      if (!user?.uid) return;

      try {
        const response = await fetch(`/api/s2/ai-style?userId=${user.uid}`);
        const data = await response.json();

        if (data.success && data.aiStyleConfig) {
          console.log('[S2] Loaded existing AI style config:', data.aiStyleConfig);
          onUpdate({
            therapeuticModalities: data.aiStyleConfig.therapeuticModalities,
            communicationStyle: data.aiStyleConfig.communicationStyle
          });
        }
      } catch (error) {
        console.error('[S2] Error loading existing AI style config:', error);
      } finally {
        setLoadingStyle(false);
      }
    };

    loadExistingStyle();
  }, [user?.uid]); // Remove onUpdate from dependencies to prevent infinite loop

  useEffect(() => {
    const total = Object.values(style.therapeuticModalities).reduce((sum, value) => sum + value, 0);
    setTotalModality(total);
  }, [style.therapeuticModalities]);

  const handleModalityChange = (modality: keyof AIStyle['therapeuticModalities'], value: number) => {
    onUpdate({
      therapeuticModalities: {
        ...style.therapeuticModalities,
        [modality]: value
      }
    });
  };

  const handleCommunicationChange = (aspect: keyof AIStyle['communicationStyle'], value: number) => {
    onUpdate({
      communicationStyle: {
        ...style.communicationStyle,
        [aspect]: value
      }
    });
  };

  const canProceed = totalModality > 0 && totalModality <= 100;

  const handleNext = async () => {
    if (!canProceed) return;
    if (!user?.uid) {
      setError('Authentication required. Please sign in.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    
    try {
      console.log('[S2] Saving AI style configuration...');
      
      const response = await fetch('/api/s2/ai-style', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          therapeuticModalities: style.therapeuticModalities,
          communicationStyle: style.communicationStyle
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save AI style configuration');
      }

      console.log('[S2] ✅ AI style configuration saved successfully:', data.aiStyleConfig.id);
      onNext();

    } catch (error) {
      console.error('[S2] Error saving AI style configuration:', error);
      setError(error instanceof Error ? error.message : 'Failed to save configuration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading while fetching existing style config
  if (loadingStyle) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading your AI style configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      {/* Step Navigator */}
      {onStepNavigation && (
        <StepNavigator
          currentStep="ai-style"
          onStepClick={onStepNavigation}
          canSkipToStep={canSkipToStep}
          stepCompletionStatus={stepCompletionStatus}
        />
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Customize Your AI&apos;s Style
          </h1>
          <p className="max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Tailor the AI to match your therapeutic approach and communication preferences.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 max-w-2xl mx-auto">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="max-w-2xl mx-auto">
          {/* Communication Style */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Communication Style
            </h2>

            <div className="space-y-8">
              {/* Interaction Style */}
              <div>
                <div className="flex items-center mb-4">
                  <h3 className="text-sm font-medium text-gray-700">
                    Interaction Style
                  </h3>
                  <InfoTooltip content="Suggestive Framing side: The AI is more likely to offer gentle suggestions or frames. (e.g., 'Have you considered looking at it from this angle?') | Guided Reflection side: The AI almost exclusively asks guiding questions to help the user find their own answers. (e.g., 'What do you think is stopping you from looking at it from a different angle?')" />
                </div>
                <div className="relative">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={style.communicationStyle.interactionStyle}
                    onChange={(e) => handleCommunicationChange('interactionStyle', parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>Suggestive Framing</span>
                    <span>Guided Reflection</span>
                  </div>
                  <div 
                    className="absolute top-6 w-2 h-2 bg-green-600 rounded-full transform -translate-x-1" 
                    style={{ left: `${style.communicationStyle.interactionStyle}%` }}
                  ></div>
                </div>
              </div>

              {/* Tone */}
              <div>
                <div className="flex items-center mb-4">
                  <h3 className="text-sm font-medium text-gray-700">
                    Tone
                  </h3>
                  <InfoTooltip content="Warm & Casual side: Uses more contractions, affirmations, and relatable language. (e.g., 'Wow, that sounds tough. It makes total sense why you'd feel that way.') | Clinical & Formal side: Uses more precise, academic language and maintains a more professional boundary. (e.g., 'The situation you've described appears to be a significant source of distress.')" />
                </div>
                <div className="relative">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={style.communicationStyle.tone}
                    onChange={(e) => handleCommunicationChange('tone', parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>Warm & Casual</span>
                    <span>Clinical & Formal</span>
                  </div>
                  <div 
                    className="absolute top-6 w-2 h-2 bg-green-600 rounded-full transform -translate-x-1" 
                    style={{ left: `${style.communicationStyle.tone}%` }}
                  ></div>
                </div>
              </div>

              {/* Energy Level */}
              <div>
                <div className="flex items-center mb-4">
                  <h3 className="text-sm font-medium text-gray-700">
                    Energy Level
                  </h3>
                  <InfoTooltip content="Energetic & Expressive side: The voice clone's intonation will have more dynamic range, sounding more active and engaged. | Calm & Grounded side: The voice clone's intonation will be more measured, steady, and soothing." />
                </div>
                <div className="relative">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={style.communicationStyle.energyLevel}
                    onChange={(e) => handleCommunicationChange('energyLevel', parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>Energetic & Expressive</span>
                    <span>Calm & Grounded</span>
                  </div>
                  <div 
                    className="absolute top-6 w-2 h-2 bg-green-600 rounded-full transform -translate-x-1" 
                    style={{ left: `${style.communicationStyle.energyLevel}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-8">
          <button
            onClick={onBack}
            className="control-button"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={!canProceed || isSubmitting}
            className={`control-button primary ${(!canProceed || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving Configuration...
              </>
            ) : (
              <>
                Next
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </main>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          background: #059669;
          border-radius: 50%;
          cursor: pointer;
        }
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          background: #059669;
          border-radius: 50%;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
};

export default AIStyleCustomization;