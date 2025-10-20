// src/app/s2/components/LicenseVerification.tsx
// Page 7 - License Verification (Optional)

"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import StepNavigator from './StepNavigator';
import { StepCompletionStatus, FlowStep } from '@/utils/s2-validation';

interface LicenseVerificationData {
  licenseType: string;
  licenseNumber: string;
  stateOfLicensure: string;
  otherLicenseType?: string;
}

interface LicenseVerificationProps {
  licenseData: LicenseVerificationData;
  onUpdate: (data: Partial<LicenseVerificationData>) => void;
  onNext: () => void;
  onSkip: () => void;
  onBack?: () => void;
  onStepNavigation?: (step: FlowStep) => void;
  canSkipToStep?: (targetStep: FlowStep, currentStep: FlowStep) => boolean;
  stepCompletionStatus?: StepCompletionStatus;
}

const LicenseVerification: React.FC<LicenseVerificationProps> = ({
  licenseData,
  onUpdate,
  onNext,
  onSkip,
  onStepNavigation,
  canSkipToStep,
  stepCompletionStatus
}) => {
  const { user } = useAuth();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [otherLicenseTypeInput, setOtherLicenseTypeInput] = useState('');

  // Load existing license data on mount
  useEffect(() => {
    const loadExistingData = async () => {
      if (!user?.uid) return;

      try {
        const response = await fetch(`/api/s2/license-verification?userId=${user.uid}`);
        const data = await response.json();

        if (data.success && data.licenseData) {
          console.log('[S2] Loaded existing license data:', data.licenseData);
          // Set otherLicenseTypeInput state if otherLicenseType exists
          if (data.licenseData.otherLicenseType) {
            setOtherLicenseTypeInput(data.licenseData.otherLicenseType);
          }
          onUpdate({
            licenseType: data.licenseData.licenseType,
            licenseNumber: data.licenseData.licenseNumber,
            stateOfLicensure: data.licenseData.stateOfLicensure,
            otherLicenseType: data.licenseData.otherLicenseType
          });
        }
      } catch (error) {
        console.error('[S2] Error loading existing license data:', error);
      } finally {
        setLoadingData(false);
      }
    };

    loadExistingData();
  }, [user?.uid]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!licenseData.licenseType.trim()) {
      newErrors.licenseType = 'License type is required';
    }

    // If "Other" license type is selected, validate that custom type is provided
    if (licenseData.licenseType === 'Other' && !otherLicenseTypeInput.trim()) {
      newErrors.licenseType = 'Please specify your custom license type';
    }

    if (!licenseData.licenseNumber.trim()) {
      newErrors.licenseNumber = 'License number is required';
    }

    if (!licenseData.stateOfLicensure.trim()) {
      newErrors.stateOfLicensure = 'State of licensure is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleVerifyAndContinue = async () => {
    if (!validateForm()) return;
    if (!user?.uid) {
      setErrors({ general: 'Authentication required. Please sign in.' });
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('[S2] Saving license verification data...');

      const response = await fetch('/api/s2/license-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          licenseType: licenseData.licenseType,
          licenseNumber: licenseData.licenseNumber,
          stateOfLicensure: licenseData.stateOfLicensure,
          otherLicenseType: licenseData.otherLicenseType
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save license verification data');
      }

      console.log('[S2] ✅ License verification data saved successfully:', data.licenseData.id);
      onNext();

    } catch (error) {
      console.error('[S2] Error saving license verification data:', error);
      setErrors({
        general: error instanceof Error ? error.message : 'Failed to save license data. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof LicenseVerificationData, value: string) => {
    onUpdate({ [field]: value });
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleLicenseTypeSelection = (selectedType: string) => {
    const previousType = licenseData.licenseType;
    const wasOtherSelected = previousType === 'Other';
    const isOtherNowSelected = selectedType === 'Other';

    // If "Other" was just selected (wasn't selected before, but is now)
    if (!wasOtherSelected && isOtherNowSelected) {
      const customLicenseType = window.prompt(
        'Please specify your custom license type:\n\n(Examples: LCPC, LMHC, Board Certification, etc.)'
      );

      if (customLicenseType && customLicenseType.trim()) {
        // User entered a custom license type
        setOtherLicenseTypeInput(customLicenseType.trim());
        handleInputChange('otherLicenseType', customLicenseType.trim());
        handleInputChange('licenseType', selectedType);
      } else {
        // User cancelled or entered empty string, don't change selection
        // Keep the previous selection
        return;
      }
    } else {
      // Normal license type selection (no "Other" involved)
      handleInputChange('licenseType', selectedType);

      // If "Other" was previously selected but now deselected, clear the custom type
      if (wasOtherSelected && !isOtherNowSelected) {
        setOtherLicenseTypeInput('');
        handleInputChange('otherLicenseType', '');
      }
    }
  };

  // US States array for dropdown
  const states = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
    'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
    'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
    'Wisconsin', 'Wyoming'
  ];

  // Show loading while fetching existing data
  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-full pt-20" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading license verification data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      {/* Step Navigator */}
      {onStepNavigation && (
        <StepNavigator
          currentStep="license-verification"
          onStepClick={onStepNavigation}
          canSkipToStep={canSkipToStep}
          stepCompletionStatus={stepCompletionStatus}
        />
      )}

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
            License Verification (Optional)
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            To build trust on the platform, we verify professional licenses against official databases.
            You can complete this now or do it later from your profile dashboard. Verified providers
            obtain a green checkmark next to their name.
          </p>
        </div>

        {/* General Error Display */}
        {errors.general && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-red-800 text-sm">{errors.general}</p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* License Type */}
          <div>
            <label htmlFor="licenseType" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              License Type
            </label>
            <select
              id="licenseType"
              value={licenseData.licenseType}
              onChange={(e) => handleLicenseTypeSelection(e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors.licenseType ? 'border-red-300' : 'border-gray-300'
                }`}
            >
              <option value="">Select license type</option>
              <option value="LCSW">LCSW - Licensed Clinical Social Worker</option>
              <option value="LMFT">LMFT - Licensed Marriage & Family Therapist</option>
              <option value="LPC">LPC - Licensed Professional Counselor</option>
              <option value="LPCC">LPCC - Licensed Professional Clinical Counselor</option>
              <option value="Psychology License">Psychology License</option>
              <option value="Medical License">Medical License</option>
              <option value="Other">Other</option>
            </select>
            {errors.licenseType && (
              <p className="mt-1 text-sm text-red-600">{errors.licenseType}</p>
            )}

            {/* Show custom license type when "Other" is selected */}
            {licenseData.licenseType === 'Other' && otherLicenseTypeInput && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                <span className="text-green-800">
                  <strong>Custom License Type:</strong> {otherLicenseTypeInput}
                </span>
              </div>
            )}
          </div>

          {/* License Number */}
          <div>
            <label htmlFor="licenseNumber" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              License Number
            </label>
            <input
              type="text"
              id="licenseNumber"
              value={licenseData.licenseNumber}
              onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
              placeholder="e.g. 12345"
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors.licenseNumber ? 'border-red-300' : 'border-gray-300'
                }`}
            />
            {errors.licenseNumber && (
              <p className="mt-1 text-sm text-red-600">{errors.licenseNumber}</p>
            )}
          </div>

          {/* State of Licensure */}
          <div>
            <label htmlFor="stateOfLicensure" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              State of Licensure
            </label>
            <select
              id="stateOfLicensure"
              value={licenseData.stateOfLicensure}
              onChange={(e) => handleInputChange('stateOfLicensure', e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors.stateOfLicensure ? 'border-red-300' : 'border-gray-300'
                }`}
            >
              <option value="">Select state</option>
              {states.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
            {errors.stateOfLicensure && (
              <p className="mt-1 text-sm text-red-600">{errors.stateOfLicensure}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-8">
            <button
              type="button"
              onClick={onSkip}
              className="text-gray-500 hover:text-gray-700 transition-colors underline"
            >
              Skip for Now
            </button>

            <button
              onClick={handleVerifyAndContinue}
              disabled={isSubmitting}
              className={`control-button primary ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Verifying...
                </>
              ) : (
                'Verify & Continue'
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LicenseVerification;