// src/app/s2/components/StepNavigator.tsx
// Reusable step navigation component for S2 flow

"use client";

import React from 'react';

type FlowStep = 'welcome' | 'profile' | 'patient-description' | 'ai-style' | 'license-verification' | 'complete-profile' | 'preparation' | 'session' | 'onboarding-complete';

interface StepNavigatorProps {
  currentStep: FlowStep;
  onStepClick: (step: FlowStep) => void;
}

const StepNavigator: React.FC<StepNavigatorProps> = ({
  currentStep,
  onStepClick
}) => {
  // Define the step order and their display information (Byron's new flow)
  const stepOrder: { step: FlowStep; number: number; label: string; width: string }[] = [
    { step: 'welcome', number: 0, label: 'Welcome', width: '0%' },
    { step: 'profile', number: 1, label: 'Profile', width: '13%' },
    { step: 'patient-description', number: 2, label: 'Patient Description', width: '25%' },
    { step: 'preparation', number: 3, label: 'Preparation', width: '38%' },
    { step: 'session', number: 4, label: 'Session', width: '50%' },
    { step: 'ai-style', number: 5, label: 'AI Style', width: '63%' },
    { step: 'license-verification', number: 6, label: 'License', width: '75%' },
    { step: 'complete-profile', number: 7, label: 'Complete Profile', width: '88%' },
    { step: 'onboarding-complete', number: 8, label: 'Complete', width: '100%' }
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
            const isCompleted = stepNumber < currentStepNumber;
            const isCurrent = stepNumber === currentStepNumber;
            const isClickable = stepNumber < currentStepNumber; // Only allow clicking on previous steps
            
            return (
              <div key={stepInfo.step} className="flex items-center">
                <button
                  onClick={isClickable ? () => onStepClick(stepInfo.step) : undefined}
                  disabled={!isClickable}
                  className={`
                    flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-colors
                    ${isCurrent 
                      ? 'bg-green-600 text-white' 
                      : isCompleted 
                        ? 'bg-green-100 text-green-600 hover:bg-green-200 cursor-pointer' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }
                  `}
                  title={isClickable ? `Go to ${stepInfo.label}` : stepInfo.label}
                >
                  {stepNumber}
                </button>
                {/* Connector line (except for last step) */}
                {stepNumber < 7 && (
                  <div className={`w-8 h-0.5 ${stepNumber < currentStepNumber ? 'bg-green-300' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Current step text */}
        <div className="text-center mb-4">
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Step {currentStepNumber} of 8
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