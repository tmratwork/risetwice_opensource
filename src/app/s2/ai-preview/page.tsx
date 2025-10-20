// src/app/s2/ai-preview/page.tsx
// AI Preview Creation Flow - Separate from initial provider onboarding

"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import SessionPreparation from '../components/SessionPreparation';
import SessionInterface from '../components/SessionInterface';
import AIStyleCustomization from '../components/AIStyleCustomization';
import CustomizeAIPrompt from '../components/CustomizeAIPrompt';
import OnboardingComplete from '../components/OnboardingComplete';

type AIPreviewStep = 'preparation' | 'session' | 'ai-style' | 'customize-ai-prompt' | 'complete';

interface AIStyle {
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
  openingStatement?: string;
}

interface SessionData {
  therapistProfile: {
    fullName: string;
    title: string;
    degrees: string[];
    primaryLocation: string;
    offersOnline: boolean;
  };
  patientDescription: {
    description: string;
  };
  aiStyle: AIStyle;
  generatedScenario?: string;
  scenarioId?: string;
}

const AIPreviewFlow: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<AIPreviewStep>('preparation');
  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<SessionData>({
    therapistProfile: {
      fullName: '',
      title: '',
      degrees: [],
      primaryLocation: '',
      offersOnline: false,
    },
    patientDescription: {
      description: ''
    },
    aiStyle: {
      therapeuticModalities: {
        cognitive_behavioral: 0,
        person_centered: 0,
        psychodynamic: 0,
        solution_focused: 0
      },
      communicationStyle: {
        friction: 50,
        tone: 50,
        energyLevel: 50
      }
    }
  });

  // Load existing profile data
  useEffect(() => {
    async function loadProfileData() {
      if (authLoading) return;

      if (!user) {
        router.push('/');
        return;
      }

      try {
        const response = await fetch('/api/s2/profile-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.uid })
        });

        const data = await response.json();

        if (data.success && data.data) {
          setSessionData(prev => ({
            ...prev,
            therapistProfile: data.data.therapistProfile ? {
              fullName: data.data.therapistProfile.full_name || '',
              title: data.data.therapistProfile.title || '',
              degrees: data.data.therapistProfile.degrees || [],
              primaryLocation: data.data.therapistProfile.primary_location || '',
              offersOnline: data.data.therapistProfile.offers_online || false,
            } : prev.therapistProfile,

            patientDescription: data.data.patientDescription ? {
              description: data.data.patientDescription.description || ''
            } : prev.patientDescription,

            aiStyle: data.data.aiStyleConfig ? {
              therapeuticModalities: {
                cognitive_behavioral: data.data.aiStyleConfig.cognitive_behavioral || 0,
                person_centered: data.data.aiStyleConfig.person_centered || 0,
                psychodynamic: data.data.aiStyleConfig.psychodynamic || 0,
                solution_focused: data.data.aiStyleConfig.solution_focused || 0
              },
              communicationStyle: {
                friction: data.data.aiStyleConfig.friction || 50,
                tone: data.data.aiStyleConfig.tone || 50,
                energyLevel: data.data.aiStyleConfig.energy_level || 50
              },
              openingStatement: data.data.aiStyleConfig.opening_statement
            } : prev.aiStyle,

            generatedScenario: data.data.generatedScenario?.description,
            scenarioId: data.data.generatedScenario?.id
          }));
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading profile data:', error);
        setLoading(false);
      }
    }

    loadProfileData();
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen pt-20" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading AI Preview builder...</p>
        </div>
      </div>
    );
  }

  const handleNext = () => {
    switch (currentStep) {
      case 'preparation':
        setCurrentStep('session');
        break;
      case 'session':
        setCurrentStep('ai-style');
        break;
      case 'ai-style':
        setCurrentStep('customize-ai-prompt');
        break;
      case 'customize-ai-prompt':
        setCurrentStep('complete');
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'session':
        setCurrentStep('preparation');
        break;
      case 'ai-style':
        setCurrentStep('session');
        break;
      case 'customize-ai-prompt':
        setCurrentStep('ai-style');
        break;
      case 'complete':
        setCurrentStep('customize-ai-prompt');
        break;
    }
  };

  const updateAIStyle = (style: Partial<AIStyle>) => {
    setSessionData(prev => ({
      ...prev,
      aiStyle: { ...prev.aiStyle, ...style }
    }));
  };

  const updateSessionData = (data: Partial<SessionData>) => {
    setSessionData(prev => ({ ...prev, ...data }));
  };

  // Render current step
  switch (currentStep) {
    case 'preparation':
      return (
        <SessionPreparation
          sessionData={sessionData}
          onNext={handleNext}
          onBack={() => router.push('/dashboard/provider')}
          onUpdateSessionData={updateSessionData}
        />
      );

    case 'session':
      return (
        <SessionInterface
          sessionData={sessionData}
          onEndSession={handleNext}
        />
      );

    case 'ai-style':
      return (
        <AIStyleCustomization
          style={sessionData.aiStyle}
          onUpdate={updateAIStyle}
          onNext={handleNext}
          onBack={handleBack}
        />
      );

    case 'customize-ai-prompt':
      return (
        <CustomizeAIPrompt
          onNext={handleNext}
          onBack={handleBack}
          isAIPreviewFlow={true}
        />
      );

    case 'complete':
      return (
        <OnboardingComplete
          onBack={handleBack}
        />
      );

    default:
      return null;
  }
};

export default AIPreviewFlow;
