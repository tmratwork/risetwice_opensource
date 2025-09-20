// src/app/s2/page.tsx
// S2 Case Simulation - Therapy Match Interface

"use client";

import React, { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import WelcomeScreen from './components/WelcomeScreen';
import TherapistProfileForm from './components/TherapistProfileForm';
import PatientDescriptionForm from './components/PatientDescriptionForm';
import SessionPreparation from './components/SessionPreparation';
import SessionInterface from './components/SessionInterface';
import AIStyleCustomization from './components/AIStyleCustomization';
import LicenseVerification from './components/LicenseVerification';
import CompleteProfile from './components/CompleteProfile';
import OnboardingComplete from './components/OnboardingComplete';

// Flow steps
type FlowStep = 'welcome' | 'profile' | 'patient-description' | 'preparation' | 'session' | 'ai-style' | 'license-verification' | 'complete-profile' | 'onboarding-complete';

// Types
interface TherapistProfile {
  fullName: string;
  title: string;
  degrees: string[];
  otherTitle?: string;
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

interface LicenseVerificationData {
  licenseType: string;
  licenseNumber: string;
  stateOfLicensure: string;
}

interface CompleteProfileData {
  profilePhoto?: string;
  personalStatement: string;
  mentalHealthSpecialties: string[];
  treatmentApproaches: string[];
  ageRangesTreated: string[];
  practiceDetails: {
    practiceType: string;
    sessionLength: string;
    availabilityHours: string;
    emergencyProtocol: string;
  };
  insuranceInformation: {
    acceptsInsurance: boolean;
    insurancePlans: string[];
    outOfNetworkSupported: boolean;
  };
}

interface SessionData {
  therapistProfile: TherapistProfile;
  patientDescription: PatientDescription;
  aiStyle: AIStyle;
  licenseVerification: LicenseVerificationData;
  completeProfile: CompleteProfileData;
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
    },
    licenseVerification: {
      licenseType: '',
      licenseNumber: '',
      stateOfLicensure: ''
    },
    completeProfile: {
      personalStatement: '',
      mentalHealthSpecialties: [],
      treatmentApproaches: [],
      ageRangesTreated: [],
      practiceDetails: {
        practiceType: '',
        sessionLength: '',
        availabilityHours: '',
        emergencyProtocol: ''
      },
      insuranceInformation: {
        acceptsInsurance: false,
        insurancePlans: [],
        outOfNetworkSupported: false
      }
    }
  });

  // Show loading while authentication is initializing
  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-secondary)' }}>Initializing authentication...</p>
        </div>
      </div>
    );
  }

  // Show sign-in prompt if not authenticated
  if (!user || !firebaseAvailable) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="text-center p-8 rounded-lg shadow-md max-w-md" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Authentication Required</h2>
          <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
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
        setCurrentStep('preparation');
        break;
      case 'preparation':
        setCurrentStep('session');
        break;
      case 'session':
        setCurrentStep('ai-style');
        break;
      case 'ai-style':
        setCurrentStep('license-verification');
        break;
      case 'license-verification':
        setCurrentStep('complete-profile');
        break;
      case 'complete-profile':
        setCurrentStep('onboarding-complete');
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
      case 'preparation':
        setCurrentStep('patient-description');
        break;
      case 'session':
        setCurrentStep('preparation');
        break;
      case 'ai-style':
        setCurrentStep('session');
        break;
      case 'license-verification':
        setCurrentStep('ai-style');
        break;
      case 'complete-profile':
        setCurrentStep('license-verification');
        break;
      case 'onboarding-complete':
        setCurrentStep('complete-profile');
        break;
    }
  };

  const handleStepNavigation = (targetStep: FlowStep) => {
    // Only allow navigation to previous steps
    const stepOrder: FlowStep[] = [
      'welcome', 'profile', 'patient-description', 'preparation', 'session',
      'ai-style', 'license-verification', 'complete-profile', 'onboarding-complete'
    ];

    const currentIndex = stepOrder.indexOf(currentStep);
    const targetIndex = stepOrder.indexOf(targetStep);

    // Only allow navigation backward (to previous steps)
    if (targetIndex < currentIndex) {
      setCurrentStep(targetStep);
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

  const updateLicenseVerification = (license: Partial<LicenseVerificationData>) => {
    setSessionData(prev => ({
      ...prev,
      licenseVerification: { ...prev.licenseVerification, ...license }
    }));
  };

  const updateCompleteProfile = (profile: Partial<CompleteProfileData>) => {
    setSessionData(prev => ({
      ...prev,
      completeProfile: { ...prev.completeProfile, ...profile }
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
          onStepNavigation={handleStepNavigation}
        />
      );
      
    case 'patient-description':
      return (
        <PatientDescriptionForm
          description={sessionData.patientDescription.description}
          onUpdate={updatePatientDescription}
          onNext={handleNext}
          onBack={handleBack}
          onStepNavigation={handleStepNavigation}
        />
      );
      
    case 'ai-style':
      return (
        <AIStyleCustomization
          style={sessionData.aiStyle}
          onUpdate={updateAIStyle}
          onNext={handleNext}
          onBack={handleBack}
          onStepNavigation={handleStepNavigation}
        />
      );
      
    case 'license-verification':
      return (
        <LicenseVerification
          licenseData={sessionData.licenseVerification}
          onUpdate={updateLicenseVerification}
          onNext={handleNext}
          onSkip={handleNext}
          onBack={handleBack}
          onStepNavigation={handleStepNavigation}
        />
      );
      
    case 'complete-profile':
      return (
        <CompleteProfile
          profileData={sessionData.completeProfile}
          onUpdate={updateCompleteProfile}
          onNext={handleNext}
          onBack={handleBack}
          onStepNavigation={handleStepNavigation}
        />
      );
      
    case 'preparation':
      return (
        <SessionPreparation
          sessionData={sessionData}
          onNext={handleNext}
          onBack={handleBack}
          onUpdateSessionData={updateSessionData}
          onStepNavigation={handleStepNavigation}
        />
      );
      
    case 'session':
      return (
        <SessionInterface
          sessionData={sessionData}
          onEndSession={handleNext}
        />
      );
      
    case 'onboarding-complete':
      return (
        <OnboardingComplete
          onBack={handleBack}
        />
      );
      
    default:
      return <WelcomeScreen onNext={handleNext} />;
  }
};

export default S2CaseSimulation;