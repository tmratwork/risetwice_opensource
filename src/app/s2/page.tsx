// src/app/s2/page.tsx
// S2 Case Simulation - Therapy Match Interface

"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useSearchParams } from 'next/navigation';
import { useS2ProfileData } from '@/hooks/use-s2-profile-data';
import { canSkipToStepWithData, FlowStep } from '@/utils/s2-validation';
import WelcomeScreen from './components/WelcomeScreen';
import TherapistProfileForm from './components/TherapistProfileForm';
import PatientDescriptionForm from './components/PatientDescriptionForm';
import SessionPreparation from './components/SessionPreparation';
import SessionInterface from './components/SessionInterface';
import AIStyleCustomization from './components/AIStyleCustomization';
import LicenseVerification from './components/LicenseVerification';
import CompleteProfile from './components/CompleteProfile';
import OnboardingComplete from './components/OnboardingComplete';

// Flow steps (imported from validation utils)
// type FlowStep = 'welcome' | 'profile' | 'patient-description' | 'preparation' | 'session' | 'ai-style' | 'license-verification' | 'complete-profile' | 'onboarding-complete';

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
  dateOfBirth?: string;
  genderIdentity?: string;
  yearsOfExperience?: string;
  languagesSpoken?: string[];
  otherLanguage?: string;
  culturalBackgrounds?: string[];
  otherCulturalBackground?: string;
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
    friction: number; // 0 = Encouraging, 100 = Adversarial
    tone: number; // 0 = Warm & Casual, 100 = Clinical & Formal
    energyLevel: number; // 0 = Energetic & Expressive, 100 = Calm & Grounded
  };
  openingStatement?: string;
}

interface LicenseVerificationData {
  licenseType: string;
  licenseNumber: string;
  stateOfLicensure: string;
  otherLicenseType?: string;
}

interface CompleteProfileData {
  profilePhoto?: string;
  personalStatement: string;
  mentalHealthSpecialties: string[];
  otherMentalHealthSpecialty?: string[];
  treatmentApproaches: string[];
  otherTreatmentApproach?: string[];
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
  clientTypesServed?: string[];
  lgbtqAffirming?: boolean;
  religiousSpiritualIntegration?: string;
  otherReligiousSpiritualIntegration?: string[];
  sessionFees?: string;
  boardCertifications?: string[];
  otherBoardCertification?: string[];
  professionalMemberships?: string[];
  otherProfessionalMembership?: string[];
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
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState<FlowStep>('welcome');

  // Load S2 profile data and completion status
  const {
    data: profileData,
    stepCompletionStatus,
    loading: dataLoading
  } = useS2ProfileData();
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

  // Check for skip parameter to start on profile form instead of welcome
  useEffect(() => {
    const skipWelcome = searchParams.get('skip');
    if (skipWelcome === 'welcome') {
      setCurrentStep('profile');
    }
  }, [searchParams]);

  // Populate sessionData when profile data is loaded
  useEffect(() => {
    if (profileData) {
      setSessionData(prev => ({
        ...prev,
        therapistProfile: profileData.therapistProfile ? {
          fullName: (profileData.therapistProfile.full_name as string) || '',
          title: (profileData.therapistProfile.title as string) || '',
          degrees: (profileData.therapistProfile.degrees as string[]) || [],
          otherTitle: profileData.therapistProfile.other_title as string,
          primaryLocation: (profileData.therapistProfile.primary_location as string) || '',
          offersOnline: (profileData.therapistProfile.offers_online as boolean) || false,
          phoneNumber: profileData.therapistProfile.phone_number as string,
          emailAddress: profileData.therapistProfile.email_address as string,
          dateOfBirth: profileData.therapistProfile.date_of_birth as string,
          genderIdentity: profileData.therapistProfile.gender_identity as string,
          yearsOfExperience: profileData.therapistProfile.years_of_experience as string,
          languagesSpoken: profileData.therapistProfile.languages_spoken as string[],
          otherLanguage: profileData.therapistProfile.other_language as string,
          culturalBackgrounds: profileData.therapistProfile.cultural_backgrounds as string[],
          otherCulturalBackground: profileData.therapistProfile.other_cultural_background as string,
        } : prev.therapistProfile,

        patientDescription: profileData.patientDescription ? {
          description: (profileData.patientDescription.description as string) || ''
        } : prev.patientDescription,

        aiStyle: profileData.aiStyleConfig ? {
          therapeuticModalities: {
            cognitive_behavioral: (profileData.aiStyleConfig.cognitive_behavioral as number) || 0,
            person_centered: (profileData.aiStyleConfig.person_centered as number) || 0,
            psychodynamic: (profileData.aiStyleConfig.psychodynamic as number) || 0,
            solution_focused: (profileData.aiStyleConfig.solution_focused as number) || 0
          },
          communicationStyle: {
            friction: (profileData.aiStyleConfig.friction as number) || 50,
            tone: (profileData.aiStyleConfig.tone as number) || 50,
            energyLevel: (profileData.aiStyleConfig.energy_level as number) || 50
          },
          openingStatement: profileData.aiStyleConfig.opening_statement as string
        } : prev.aiStyle,

        licenseVerification: profileData.licenseVerification ? {
          licenseType: (profileData.licenseVerification.license_type as string) || '',
          licenseNumber: (profileData.licenseVerification.license_number as string) || '',
          stateOfLicensure: (profileData.licenseVerification.state_of_licensure as string) || '',
          otherLicenseType: profileData.licenseVerification.other_license_type as string
        } : prev.licenseVerification,

        completeProfile: profileData.completeProfile ? {
          profilePhoto: profileData.completeProfile.profile_photo_url as string,
          personalStatement: (profileData.completeProfile.personal_statement as string) || '',
          mentalHealthSpecialties: (profileData.completeProfile.mental_health_specialties as string[]) || [],
          otherMentalHealthSpecialty: profileData.completeProfile.other_mental_health_specialty as string[],
          treatmentApproaches: (profileData.completeProfile.treatment_approaches as string[]) || [],
          otherTreatmentApproach: profileData.completeProfile.other_treatment_approach as string[],
          ageRangesTreated: (profileData.completeProfile.age_ranges_treated as string[]) || [],
          practiceDetails: {
            practiceType: (profileData.completeProfile.practice_type as string) || '',
            sessionLength: (profileData.completeProfile.session_length as string) || '',
            availabilityHours: (profileData.completeProfile.availability_hours as string) || '',
            emergencyProtocol: (profileData.completeProfile.emergency_protocol as string) || ''
          },
          insuranceInformation: {
            acceptsInsurance: (profileData.completeProfile.accepts_insurance as boolean) || false,
            insurancePlans: (profileData.completeProfile.insurance_plans as string[]) || [],
            outOfNetworkSupported: (profileData.completeProfile.out_of_network_supported as boolean) || false
          },
          clientTypesServed: profileData.completeProfile.client_types_served as string[],
          lgbtqAffirming: profileData.completeProfile.lgbtq_affirming as boolean,
          religiousSpiritualIntegration: profileData.completeProfile.religious_spiritual_integration as string,
          otherReligiousSpiritualIntegration: profileData.completeProfile.other_religious_spiritual_integration as string[],
          sessionFees: profileData.completeProfile.session_fees as string,
          boardCertifications: profileData.completeProfile.board_certifications as string[],
          otherBoardCertification: profileData.completeProfile.other_board_certification as string[],
          professionalMemberships: profileData.completeProfile.professional_memberships as string[],
          otherProfessionalMembership: profileData.completeProfile.other_professional_membership as string[],
        } : prev.completeProfile,

        generatedScenario: profileData.generatedScenario?.description as string,
        scenarioId: profileData.generatedScenario?.id as string
      }));
    }
  }, [profileData]);

  // Show loading while authentication or data is initializing
  if (authLoading || dataLoading) {
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
    const stepOrder: FlowStep[] = [
      'welcome', 'profile', 'patient-description', 'preparation', 'session',
      'ai-style', 'license-verification', 'complete-profile', 'onboarding-complete'
    ];

    const currentIndex = stepOrder.indexOf(currentStep);
    const targetIndex = stepOrder.indexOf(targetStep);

    // Always allow backward navigation
    if (targetIndex < currentIndex) {
      setCurrentStep(targetStep);
      return;
    }

    // Check if forward navigation is allowed
    if (canSkipToStep(targetStep, currentStep)) {
      setCurrentStep(targetStep);
    }
  };

  // Enhanced function to determine if user can skip to a specific step based on data
  const canSkipToStep = (targetStep: FlowStep, currentStep: FlowStep): boolean => {
    return canSkipToStepWithData(targetStep, currentStep, stepCompletionStatus);
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
          canSkipToStep={canSkipToStep}
          stepCompletionStatus={stepCompletionStatus}
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
          canSkipToStep={canSkipToStep}
          stepCompletionStatus={stepCompletionStatus}
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
          canSkipToStep={canSkipToStep}
          stepCompletionStatus={stepCompletionStatus}
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
          canSkipToStep={canSkipToStep}
          stepCompletionStatus={stepCompletionStatus}
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
          canSkipToStep={canSkipToStep}
          stepCompletionStatus={stepCompletionStatus}
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
          canSkipToStep={canSkipToStep}
          stepCompletionStatus={stepCompletionStatus}
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