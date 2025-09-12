// src/app/s2/page.tsx
// S2 Case Simulation - Therapy Match Interface

"use client";

import React, { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import WelcomeScreen from './components/WelcomeScreen';
import TherapistProfileForm from './components/TherapistProfileForm';
import PatientDescriptionForm from './components/PatientDescriptionForm';
import AIStyleCustomization from './components/AIStyleCustomization';
import SessionPreparation from './components/SessionPreparation';
import SessionInterface from './components/SessionInterface';

// Flow steps
type FlowStep = 'welcome' | 'profile' | 'patient-description' | 'ai-style' | 'preparation' | 'session';

// Types
interface TherapistProfile {
  fullName: string;
  title: string;
  degrees: string[];
  primaryLocation: string;
  offersOnline: boolean;
  phoneNumber?: string;
  emailAddress?: string;
}

interface PatientDescription {
  description: string;
}

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

interface SessionData {
  therapistProfile: TherapistProfile;
  patientDescription: PatientDescription;
  aiStyle: AIStyle;
  generatedScenario?: string;
  scenarioId?: string;
}

const S2CaseSimulation: React.FC = () => {
  const { user, loading: authLoading, firebaseAvailable } = useAuth();
  const [currentStep, setCurrentStep] = useState<FlowStep>('welcome');
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
        interactionStyle: 50,
        tone: 50,
        energyLevel: 50
      }
    }
  });

  // Show loading while authentication is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing authentication...</p>
        </div>
      </div>
    );
  }

  // Show sign-in prompt if not authenticated
  if (!user || !firebaseAvailable) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-md max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-6">
            You need to sign in to access S2 Case Simulation.
          </p>
          <p className="text-sm text-blue-600">
            Please use the &quot;Sign In&quot; button in the top navigation.
          </p>
          {!firebaseAvailable && (
            <p className="text-sm text-orange-600 mt-2">
              Firebase authentication is currently unavailable.
            </p>
          )}
        </div>
      </div>
    );
  }

  const handleNext = () => {
    switch (currentStep) {
      case 'welcome':
        setCurrentStep('profile');
        break;
      case 'profile':
        setCurrentStep('patient-description');
        break;
      case 'patient-description':
        setCurrentStep('ai-style');
        break;
      case 'ai-style':
        setCurrentStep('preparation');
        break;
      case 'preparation':
        setCurrentStep('session');
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'profile':
        setCurrentStep('welcome');
        break;
      case 'patient-description':
        setCurrentStep('profile');
        break;
      case 'ai-style':
        setCurrentStep('patient-description');
        break;
      case 'preparation':
        setCurrentStep('ai-style');
        break;
      case 'session':
        setCurrentStep('preparation');
        break;
    }
  };

  const updateTherapistProfile = (profile: Partial<TherapistProfile>) => {
    setSessionData(prev => ({
      ...prev,
      therapistProfile: { ...prev.therapistProfile, ...profile }
    }));
  };

  const updatePatientDescription = (description: string) => {
    setSessionData(prev => ({
      ...prev,
      patientDescription: { description }
    }));
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
    case 'welcome':
      return <WelcomeScreen onNext={handleNext} />;
      
    case 'profile':
      return (
        <TherapistProfileForm
          profile={sessionData.therapistProfile}
          onUpdate={updateTherapistProfile}
          onNext={handleNext}
          onBack={handleBack}
        />
      );
      
    case 'patient-description':
      return (
        <PatientDescriptionForm
          description={sessionData.patientDescription.description}
          onUpdate={updatePatientDescription}
          onNext={handleNext}
          onBack={handleBack}
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
      
    case 'preparation':
      return (
        <SessionPreparation
          sessionData={sessionData}
          onNext={handleNext}
          onBack={handleBack}
          onUpdateSessionData={updateSessionData}
        />
      );
      
    case 'session':
      return (
        <SessionInterface
          sessionData={sessionData}
          onEndSession={() => setCurrentStep('welcome')}
        />
      );
      
    default:
      return <WelcomeScreen onNext={handleNext} />;
  }
};

export default S2CaseSimulation;