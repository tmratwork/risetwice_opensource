// src/utils/s2-validation.ts
// Validation utilities for S2 profile completion steps

export interface StepCompletionStatus {
  profile: boolean;
  patientDescription: boolean;
  preparation: boolean;
  session: boolean;
  aiStyle: boolean;
  licenseVerification: boolean;
  completeProfile: boolean;
}

export type FlowStep = 'welcome' | 'profile' | 'patient-description' | 'preparation' | 'session' | 'ai-style' | 'license-verification' | 'complete-profile' | 'onboarding-complete';

// Validation functions for each step
export function validateProfileStep(profile: unknown): boolean {
  if (!profile || typeof profile !== 'object') return false;

  const p = profile as Record<string, unknown>;
  return !!(
    p.full_name &&
    p.title &&
    Array.isArray(p.degrees) && p.degrees.length > 0 &&
    p.primary_location
  );
}

export function validatePatientDescriptionStep(description: unknown): boolean {
  if (!description || typeof description !== 'object') return false;

  const d = description as Record<string, unknown>;
  return !!(
    d.description &&
    typeof d.description === 'string' &&
    d.description.length >= 50
  );
}

export function validatePreparationStep(scenario: unknown): boolean {
  if (!scenario || typeof scenario !== 'object') return false;

  const s = scenario as Record<string, unknown>;
  return !!(
    s.description &&
    typeof s.description === 'string' &&
    s.description.length > 0
  );
}

export function validateSessionStep(session: unknown): boolean {
  if (!session || typeof session !== 'object') return false;

  const s = session as Record<string, unknown>;
  return !!(
    s.id &&
    (s.status === 'completed' || s.status === 'in_progress')
  );
}

export function validateAIStyleStep(config: unknown): boolean {
  if (!config || typeof config !== 'object') return false;

  const c = config as Record<string, unknown>;
  return !!(
    typeof c.cognitive_behavioral === 'number' &&
    typeof c.person_centered === 'number' &&
    typeof c.psychodynamic === 'number' &&
    typeof c.solution_focused === 'number' &&
    typeof c.friction === 'number' &&
    typeof c.tone === 'number' &&
    typeof c.energy_level === 'number'
  );
}

export function validateLicenseStep(license: unknown): boolean {
  if (!license || typeof license !== 'object') return false;

  const l = license as Record<string, unknown>;
  return !!(
    l.license_type &&
    l.license_number &&
    l.state_of_licensure
  );
}

export function validateCompleteProfileStep(profile: unknown): boolean {
  if (!profile || typeof profile !== 'object') return false;

  const p = profile as Record<string, unknown>;
  return !!(
    p.personal_statement &&
    typeof p.personal_statement === 'string' &&
    p.personal_statement.length >= 50 &&
    Array.isArray(p.mental_health_specialties) &&
    p.mental_health_specialties.length > 0
  );
}

// Enhanced navigation logic with data-driven step availability
export function canSkipToStepWithData(
  targetStep: FlowStep,
  currentStep: FlowStep,
  stepCompletionStatus: StepCompletionStatus
): boolean {
  const stepOrder: FlowStep[] = [
    'welcome', 'profile', 'patient-description', 'preparation', 'session',
    'ai-style', 'license-verification', 'complete-profile', 'onboarding-complete'
  ];

  const currentIndex = stepOrder.indexOf(currentStep);
  const targetIndex = stepOrder.indexOf(targetStep);

  // Always allow backward navigation
  if (targetIndex < currentIndex) {
    return true;
  }

  // Step-specific availability rules based on completion status and dependencies
  switch (targetStep) {
    case 'profile':
      // Profile is always accessible (no dependencies)
      return true;

    case 'patient-description':
      // Requires profile to be completed
      return stepCompletionStatus.profile;

    case 'preparation':
      // Requires profile and patient description to be completed
      return stepCompletionStatus.profile && stepCompletionStatus.patientDescription;

    case 'session':
      // Requires profile, patient description, and preparation to be completed
      return stepCompletionStatus.profile &&
             stepCompletionStatus.patientDescription &&
             stepCompletionStatus.preparation;

    case 'ai-style':
      // Independent step - accessible if profile is completed OR already completed
      return stepCompletionStatus.profile || stepCompletionStatus.aiStyle;

    case 'license-verification':
      // Independent step - accessible if profile is completed OR already completed
      return stepCompletionStatus.profile || stepCompletionStatus.licenseVerification;

    case 'complete-profile':
      // Independent step - accessible if profile is completed OR already completed
      return stepCompletionStatus.profile || stepCompletionStatus.completeProfile;

    case 'onboarding-complete':
      // Can access if at least profile is completed
      return stepCompletionStatus.profile;

    default:
      return false;
  }
}

// Determine the completion percentage for progress display
export function calculateCompletionPercentage(stepCompletionStatus: StepCompletionStatus): number {
  const completedSteps = Object.values(stepCompletionStatus).filter(Boolean).length;
  const totalSteps = Object.keys(stepCompletionStatus).length;
  return Math.round((completedSteps / totalSteps) * 100);
}

// Get the next recommended step for the user
export function getNextRecommendedStep(stepCompletionStatus: StepCompletionStatus): FlowStep {
  if (!stepCompletionStatus.profile) return 'profile';
  if (!stepCompletionStatus.patientDescription) return 'patient-description';
  if (!stepCompletionStatus.preparation) return 'preparation';
  if (!stepCompletionStatus.session) return 'session';
  if (!stepCompletionStatus.aiStyle) return 'ai-style';
  if (!stepCompletionStatus.licenseVerification) return 'license-verification';
  if (!stepCompletionStatus.completeProfile) return 'complete-profile';
  return 'onboarding-complete';
}

// Check if all required steps are completed
export function isOnboardingComplete(stepCompletionStatus: StepCompletionStatus): boolean {
  return stepCompletionStatus.profile &&
         stepCompletionStatus.patientDescription &&
         stepCompletionStatus.preparation &&
         stepCompletionStatus.session &&
         stepCompletionStatus.completeProfile;
}

// Get step display status for UI
export function getStepDisplayStatus(
  step: FlowStep,
  currentStep: FlowStep,
  stepCompletionStatus: StepCompletionStatus
): 'current' | 'completed' | 'available' | 'locked' {
  if (step === currentStep) return 'current';

  // Map step names to completion status keys
  const stepKeyMap: Record<FlowStep, keyof StepCompletionStatus | null> = {
    'welcome': null,
    'profile': 'profile',
    'patient-description': 'patientDescription',
    'preparation': 'preparation',
    'session': 'session',
    'ai-style': 'aiStyle',
    'license-verification': 'licenseVerification',
    'complete-profile': 'completeProfile',
    'onboarding-complete': null
  };

  const stepKey = stepKeyMap[step];
  if (stepKey && stepCompletionStatus[stepKey]) {
    return 'completed';
  }

  if (canSkipToStepWithData(step, currentStep, stepCompletionStatus)) {
    return 'available';
  }

  return 'locked';
}