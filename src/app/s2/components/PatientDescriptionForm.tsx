// src/app/s2/components/PatientDescriptionForm.tsx
// Patient Description Form - Large textarea for ideal patient description

"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

interface PatientDescriptionFormProps {
  description: string;
  onUpdate: (description: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const PatientDescriptionForm: React.FC<PatientDescriptionFormProps> = ({
  description,
  onUpdate,
  onNext,
  onBack
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
  }, [user?.uid]); // Remove onUpdate from dependencies to prevent infinite loop

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your patient description...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-gray-900">🌱 RiseTwice</span>
            </div>
            <nav className="flex space-x-8">
              <a href="#" className="text-gray-500 hover:text-gray-900">Find a therapist</a>
              <a href="#" className="text-gray-500 hover:text-gray-900">For therapists</a>
              <a href="#" className="text-gray-500 hover:text-gray-900">Crisis support</a>
              <a href="#" className="text-gray-900 font-medium">Log in</a>
              <button className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
                Join as a therapist
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center mb-4">
            <span className="text-sm font-medium text-gray-500">Step 2 of 5</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full" style={{ width: '40%' }}></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Describe Your Ideal Patient
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Help us understand who you work with best.
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
              <strong>This information will be used to generate a patient scenario for you to respond to,</strong> helping us match 
              you with suitable clients.
            </p>
          </div>

          <div className="text-center">
            <button
              onClick={handleSubmit}
              disabled={description.length < 50 || isSubmitting}
              className={`px-8 py-4 rounded-lg font-medium transition-colors flex items-center mx-auto ${
                description.length >= 50 && !isSubmitting
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
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
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Back to previous step
          </button>
        </div>
      </main>
    </div>
  );
};

export default PatientDescriptionForm;