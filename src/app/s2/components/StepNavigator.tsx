// src/app/s2/components/StepNavigator.tsx
// Reusable step navigation component for S2 flow

"use client";

import React from 'react';
import { StepCompletionStatus, FlowStep, getStepDisplayStatus } from '@/utils/s2-validation';

interface StepNavigatorProps {
  currentStep: FlowStep;
  onStepClick: (step: FlowStep) => void;
  canSkipToStep?: (targetStep: FlowStep, currentStep: FlowStep) => boolean;
  stepCompletionStatus?: StepCompletionStatus;
}

const StepNavigator: React.FC<StepNavigatorProps> = ({
  currentStep,
  onStepClick,
  canSkipToStep,
  stepCompletionStatus
}) => {
  // Define the step order and their display information (Byron's new flow)
  const stepOrder: { step: FlowStep; number: number; label: string; width: string }[] = [
    { step: 'welcome', number: 0, label: 'Welcome', width: '0%' },
    { step: 'profile', number: 1, label: 'Profile', width: '11%' },
    { step: 'patient-description', number: 2, label: 'Patient Description', width: '22%' },
    { step: 'preparation', number: 3, label: 'Preparation', width: '33%' },
    { step: 'session', number: 4, label: 'Session', width: '44%' },
    { step: 'ai-style', number: 5, label: 'AI Style', width: '55%' },
    { step: 'license-verification', number: 6, label: 'License', width: '66%' },
    { step: 'customize-ai-prompt', number: 7, label: 'Customize Prompt', width: '77%' },
    { step: 'complete-profile', number: 8, label: 'Complete Profile', width: '88%' },
    { step: 'onboarding-complete', number: 9, label: 'Complete', width: '100%' }
  ];

  // Find current step info
  const currentStepInfo = stepOrder.find(s => s.step === currentStep);
  const currentStepNumber = currentStepInfo?.number || 0;

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)' }} className="border-b pt-8">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Step indicators */}
        <div className="flex justify-center items-center mb-4 space-x-2">
          {stepOrder.slice(1, -1).map((stepInfo) => { // Exclude welcome (0) and complete (8)
            const stepNumber = stepInfo.number;

            // Enhanced display status based on completion data
            const displayStatus = stepCompletionStatus
              ? getStepDisplayStatus(stepInfo.step, currentStep, stepCompletionStatus)
              : (stepNumber === currentStepNumber ? 'current' : 'locked');

            const isClickable = displayStatus !== 'locked' ||
              (canSkipToStep ? canSkipToStep(stepInfo.step, currentStep) : false);

            // Enhanced styling based on step completion status
            const getStepStyling = () => {
              switch (displayStatus) {
                case 'current':
                  return 'bg-green-600 text-white ring-2 ring-green-300';
                case 'completed':
                  return 'bg-green-500 text-white hover:bg-green-600 cursor-pointer';
                case 'available':
                  return 'bg-blue-100 text-blue-600 hover:bg-blue-200 cursor-pointer border border-blue-300';
                case 'locked':
                default:
                  return 'bg-gray-200 text-gray-400 cursor-not-allowed';
              }
            };

            // Enhanced connector line styling
            const getConnectorStyling = () => {
              if (displayStatus === 'completed' || displayStatus === 'current') {
                return 'bg-green-400';
              } else if (displayStatus === 'available') {
                return 'bg-blue-200';
              }
              return 'bg-gray-200';
            };

            return (
              <div key={stepInfo.step} className="flex items-center">
                <button
                  onClick={isClickable ? () => onStepClick(stepInfo.step) : undefined}
                  disabled={!isClickable}
                  className={`
                    flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-all duration-200
                    ${getStepStyling()}
                  `}
                  title={
                    displayStatus === 'completed'
                      ? `${stepInfo.label} (Completed - Click to edit)`
                      : isClickable
                        ? `Go to ${stepInfo.label}`
                        : `${stepInfo.label} (Complete previous steps first)`
                  }
                >
                  {displayStatus === 'completed' ? '✓' : stepNumber}
                </button>
                {/* Enhanced connector line (except for last step) */}
                {stepNumber < 8 && (
                  <div className={`w-8 h-0.5 transition-all duration-200 ${getConnectorStyling()}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Current step text */}
        <div className="text-center mb-4">
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Step {currentStepNumber} of 9
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-green-500 h-2 rounded-full transition-all duration-300" 
            style={{ width: currentStepInfo?.width || '0%' }}
          />
        </div>
      </div>
    </div>
  );
};

export default StepNavigator;