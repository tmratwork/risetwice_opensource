// src/app/s2/components/AIStyleCustomization.tsx
// AI Style Customization - Therapeutic Modality and Communication Style

"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import InfoTooltip from './InfoTooltip';

interface AIStyle {
  therapeuticModalities: {
    cognitive_behavioral: number;
    person_centered: number;
    psychodynamic: number;
    solution_focused: number;
  };
  communicationStyle: {
    friction: number; // 0 = Encouraging, 100 = Adversarial
    tone: number; // 0 = Warm & Casual, 100 = Clinical & Formal
    energyLevel: number; // 0 = Energetic & Expressive, 100 = Calm & Grounded
  };
  openingStatement?: string;
}

interface AIStyleCustomizationProps {
  style: AIStyle;
  onUpdate: (style: Partial<AIStyle>) => void;
  onNext: () => void;
  onBack: () => void;
}

const AIStyleCustomization: React.FC<AIStyleCustomizationProps> = ({
  style,
  onUpdate,
  onNext,
  onBack
}) => {
  const { user } = useAuth();
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
            communicationStyle: data.aiStyleConfig.communicationStyle,
            openingStatement: data.aiStyleConfig.openingStatement
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

  const handleCommunicationChange = (aspect: keyof AIStyle['communicationStyle'], value: number) => {
    onUpdate({
      communicationStyle: {
        ...style.communicationStyle,
        [aspect]: value
      }
    });
  };

  const handleNext = async () => {
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
          communicationStyle: style.communicationStyle,
          openingStatement: style.openingStatement
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
      <div className="flex items-center justify-center min-h-full pt-20" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading your AI style configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 pt-24 pb-8">
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

        <div className="max-w-2xl mx-auto space-y-6">
          {/* Opening Statement */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Opening Statement
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Write the first few sentences your AI preview will speak when greeting new patients. (For example: Hi, my name is Dr. XYZ, thanks for trying my AI Preview! What are you hoping to get out of therapy? And what are you looking for in a therapist?)
            </p>
            <textarea
              value={style.openingStatement || ''}
              onChange={(e) => onUpdate({ openingStatement: e.target.value })}
              placeholder="Enter your opening greeting..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>

          {/* Communication Style */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Communication Style
            </h2>

            <div className="space-y-8">
              {/* Friction */}
              <div>
                <div className="flex items-center mb-4">
                  <h3 className="text-sm font-medium text-gray-700">
                    Friction
                  </h3>
                  <InfoTooltip content="Encouraging side: The AI provides supportive, affirming responses that validate the user's perspective and build confidence. | Adversarial side: The AI offers more challenging perspectives, plays devil's advocate, and pushes back on assumptions to encourage deeper critical thinking." />
                </div>
                <div className="relative">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={style.communicationStyle.friction}
                    onChange={(e) => handleCommunicationChange('friction', parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>Encouraging</span>
                    <span>Adversarial</span>
                  </div>
                  <div
                    className="absolute top-6 w-2 h-2 bg-green-600 rounded-full transform -translate-x-1"
                    style={{ left: `${style.communicationStyle.friction}%` }}
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

              {/* Expression */}
              <div>
                <div className="flex items-center mb-4">
                  <h3 className="text-sm font-medium text-gray-700">
                    Expression
                  </h3>
                  <InfoTooltip content="Calm & Grounded side: The voice clone's intonation will be more measured, steady, and soothing. | Energetic & Expressive side: The voice clone's intonation will have more dynamic range, sounding more active and engaged." />
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
                    <span>Calm & Grounded</span>
                    <span>Energetic & Expressive</span>
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
            disabled={isSubmitting}
            className={`control-button primary ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
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