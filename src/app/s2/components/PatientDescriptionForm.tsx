// src/app/s2/components/PatientDescriptionForm.tsx
// Patient Description Form - Large textarea for ideal patient description

"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import StepNavigator from './StepNavigator';
import { StepCompletionStatus, FlowStep } from '@/utils/s2-validation';

interface PatientDescriptionFormProps {
  description: string;
  onUpdate: (description: string) => void;
  onNext: () => void;
  onBack: () => void;
  onStepNavigation?: (step: FlowStep) => void;
  canSkipToStep?: (targetStep: FlowStep, currentStep: FlowStep) => boolean;
  stepCompletionStatus?: StepCompletionStatus;
}

const PatientDescriptionForm: React.FC<PatientDescriptionFormProps> = ({
  description,
  onUpdate,
  onNext,
  onBack,
  onStepNavigation,
  canSkipToStep,
  stepCompletionStatus
}) => {
  const { user } = useAuth();
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingDescription, setLoadingDescription] = useState(true);

  // Load existing patient description on mount
  useEffect(() => {
    const loadExistingDescription = async () => {
      if (!user?.uid) return;

      try {
        const response = await fetch(`/api/s2/patient-description?userId=${user.uid}`);
        const data = await response.json();

        if (data.success && data.patientDescription) {
          console.log('[S2] Loaded existing patient description:', data.patientDescription);
          onUpdate(data.patientDescription.description);
        }
      } catch (error) {
        console.error('[S2] Error loading existing patient description:', error);
      } finally {
        setLoadingDescription(false);
      }
    };

    loadExistingDescription();
  }, [user?.uid]);

  const validateForm = () => {
    if (!description.trim() || description.trim().length < 50) {
      setError('Please provide a more detailed description (at least 50 characters)');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!user?.uid) {
      setError('Authentication required. Please sign in.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      console.log('[S2] Saving patient description...');
      
      const response = await fetch('/api/s2/patient-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          description: description.trim()
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save patient description');
      }

      console.log('[S2] ✅ Patient description saved successfully:', data.patientDescription.id);
      onNext();

    } catch (error) {
      console.error('[S2] Error saving patient description:', error);
      setError(error instanceof Error ? error.message : 'Failed to save description. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTextChange = (value: string) => {
    onUpdate(value);
    if (error) {
      setError('');
    }
  };

  const exampleText = `e.g., I specialize in working with young adults (18-25) dealing with anxiety and life transitions. My ideal patient is motivated to engage in cognitive-behavioral therapy (CBT) and is open to exploring mindfulness practices...`;

  // Show loading while fetching existing description
  if (loadingDescription) {
    return (
      <div className="flex-1 flex items-center justify-center pt-20" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading your patient description...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      {/* Step Navigator */}
      {onStepNavigation && (
        <StepNavigator
          currentStep="patient-description"
          onStepClick={onStepNavigation}
          canSkipToStep={canSkipToStep}
          stepCompletionStatus={stepCompletionStatus}
        />
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
            Build Your Personalized Clinical Scenario
          </h1>
          <p className="text-lg max-w-4xl mx-auto mb-8" style={{ color: 'var(--text-secondary)' }}>
            Describe your &apos;ideal&apos; patient—the person you&apos;re able to help the most and are a best match for. 
            This can include age ranges, gender, what life stage they are in, the biggest mental health 
            challenges they may be facing, and any other details you can imagine.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <textarea
              value={description}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={exampleText}
              rows={12}
              className={`w-full px-4 py-4 border rounded-lg resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-base leading-relaxed ${
                error ? 'border-red-300' : 'border-gray-300'
              }`}
              style={{ minHeight: '300px' }}
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
            <div className="mt-2 flex justify-between items-center">
              <p className="text-sm text-gray-500">
                Character count: {description.length} / 2000
              </p>
              <p className="text-sm text-gray-500">
                {description.length >= 50 ? '✓ Sufficient detail' : `${50 - description.length} more characters needed`}
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-8">
            <p className="text-sm text-gray-700">
              We will use this information to construct a personalized clinical case scenario for you to deliver care to. 
              Our technology analyzes this session to capture your unique vocal tone, speaking patterns and logic to create 
              a realistic voice clone for your AI Preview.
            </p>
          </div>

          <div className="text-center">
            <button
              onClick={handleSubmit}
              disabled={description.length < 50 || isSubmitting}
              className={`control-button primary mx-auto ${(description.length < 50 || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving Description...
                </>
              ) : (
                'Generate My Scenario'
              )}
            </button>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-8 text-center">
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

export default PatientDescriptionForm;