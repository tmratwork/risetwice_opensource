// src/utils/s2-validation.ts
// Validation utilities for S2 profile completion steps

export interface StepCompletionStatus {
  profile: boolean;
  licenseVerification: boolean;
  completeProfile: boolean;
  notificationPreferences: boolean;
}

export type FlowStep = 'welcome' | 'profile' | 'license-verification' | 'complete-profile' | 'notification-preferences' | 'onboarding-complete';

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  targetStep: FlowStep,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  currentStep: FlowStep,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  stepCompletionStatus: StepCompletionStatus
): boolean {
  // Allow navigation to any step (both forward and backward)
  // This gives users freedom to move between steps as needed
  return true;
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
  if (!stepCompletionStatus.licenseVerification) return 'license-verification';
  if (!stepCompletionStatus.completeProfile) return 'complete-profile';
  if (!stepCompletionStatus.notificationPreferences) return 'notification-preferences';
  return 'onboarding-complete';
}

// Check if all required steps are completed
export function isOnboardingComplete(stepCompletionStatus: StepCompletionStatus): boolean {
  return stepCompletionStatus.profile &&
         stepCompletionStatus.licenseVerification &&
         stepCompletionStatus.completeProfile &&
         stepCompletionStatus.notificationPreferences;
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
    'license-verification': 'licenseVerification',
    'complete-profile': 'completeProfile',
    'notification-preferences': 'notificationPreferences',
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