// src/app/s2/components/CompleteProfile.tsx
// Complete Profile Form - Profile photo, statement, specialties, and practice details

"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import StepNavigator from './StepNavigator';
import CustomMultiSelect from './CustomMultiSelect';
import { StepCompletionStatus, FlowStep } from '@/utils/s2-validation';
// Removed direct Supabase import - now using server-side upload API

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

interface CompleteProfileProps {
  profileData: CompleteProfileData;
  onUpdate: (data: Partial<CompleteProfileData>) => void;
  onNext: () => void;
  onBack: () => void;
  onStepNavigation?: (step: FlowStep) => void;
  canSkipToStep?: (targetStep: FlowStep, currentStep: FlowStep) => boolean;
  stepCompletionStatus?: StepCompletionStatus;
}

const CompleteProfile: React.FC<CompleteProfileProps> = ({
  profileData,
  onUpdate,
  onBack,
  onStepNavigation,
  canSkipToStep,
  stepCompletionStatus
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [otherMentalHealthSpecialtyInputs, setOtherMentalHealthSpecialtyInputs] = useState<string[]>([]);
  const [otherTreatmentApproachInputs, setOtherTreatmentApproachInputs] = useState<string[]>([]);
  const [otherBoardCertificationInputs, setOtherBoardCertificationInputs] = useState<string[]>([]);
  const [otherProfessionalMembershipInputs, setOtherProfessionalMembershipInputs] = useState<string[]>([]);
  const [otherReligiousSpiritualInputs, setOtherReligiousSpiritualInputs] = useState<string[]>([]);

  // Options for multi-select fields
  const boardCertificationOptions = [
    { value: 'ABPP', label: 'ABPP - American Board of Professional Psychology' },
    { value: 'NBE', label: 'NBE - National Board for Certified Counselors' },
    { value: 'ABMHC', label: 'ABMHC - American Board of Mental Health Counselors' },
    { value: 'AASECT', label: 'AASECT - American Association of Sexuality Educators' },
    { value: 'EMDR International', label: 'EMDR International Association' },
    { value: 'IASP', label: 'IASP - International Association for the Study of Pain' },
    { value: 'Other', label: 'Other' }
  ];

  const professionalMembershipOptions = [
    { value: 'APA', label: 'APA - American Psychological Association' },
    { value: 'NASW', label: 'NASW - National Association of Social Workers' },
    { value: 'ACA', label: 'ACA - American Counseling Association' },
    { value: 'AAMFT', label: 'AAMFT - American Association for Marriage and Family Therapy' },
    { value: 'NAADAC', label: 'NAADAC - Association for Addiction Professionals' },
    { value: 'ASERVIC', label: 'ASERVIC - Association for Spiritual, Ethical, Religious Values in Counseling' },
    { value: 'Other', label: 'Other' }
  ];

  // Profile photo uploads now use server-side API with service role key
  // This bypasses the Firebase UID → PostgreSQL UUID conversion issue

  // Load existing complete profile data on mount
  useEffect(() => {
    const loadExistingProfile = async () => {
      if (!user?.uid) return;

      try {
        const response = await fetch(`/api/s2/complete-profile?userId=${user.uid}`);
        const data = await response.json();

        if (data.success && data.completeProfile) {
          console.log('[S2] Loaded existing complete profile:', data.completeProfile);

          // Set custom input states if they exist (now as arrays)
          if (data.completeProfile.otherMentalHealthSpecialty) {
            setOtherMentalHealthSpecialtyInputs(
              Array.isArray(data.completeProfile.otherMentalHealthSpecialty)
                ? data.completeProfile.otherMentalHealthSpecialty
                : [data.completeProfile.otherMentalHealthSpecialty]
            );
          }
          if (data.completeProfile.otherTreatmentApproach) {
            setOtherTreatmentApproachInputs(
              Array.isArray(data.completeProfile.otherTreatmentApproach)
                ? data.completeProfile.otherTreatmentApproach
                : [data.completeProfile.otherTreatmentApproach]
            );
          }
          if (data.completeProfile.otherBoardCertification) {
            setOtherBoardCertificationInputs(
              Array.isArray(data.completeProfile.otherBoardCertification)
                ? data.completeProfile.otherBoardCertification
                : [data.completeProfile.otherBoardCertification]
            );
          }
          if (data.completeProfile.otherProfessionalMembership) {
            setOtherProfessionalMembershipInputs(
              Array.isArray(data.completeProfile.otherProfessionalMembership)
                ? data.completeProfile.otherProfessionalMembership
                : [data.completeProfile.otherProfessionalMembership]
            );
          }
          if (data.completeProfile.otherReligiousSpiritualIntegration) {
            setOtherReligiousSpiritualInputs(
              Array.isArray(data.completeProfile.otherReligiousSpiritualIntegration)
                ? data.completeProfile.otherReligiousSpiritualIntegration
                : [data.completeProfile.otherReligiousSpiritualIntegration]
            );
          }

          // Fix: Skip blob URLs entirely to prevent security errors
          const profilePhoto = data.completeProfile.profilePhoto &&
            !data.completeProfile.profilePhoto.startsWith('blob:')
            ? data.completeProfile.profilePhoto
            : '';

          onUpdate({
            profilePhoto,
            personalStatement: data.completeProfile.personalStatement,
            mentalHealthSpecialties: data.completeProfile.mentalHealthSpecialties,
            otherMentalHealthSpecialty: data.completeProfile.otherMentalHealthSpecialty,
            treatmentApproaches: data.completeProfile.treatmentApproaches,
            otherTreatmentApproach: data.completeProfile.otherTreatmentApproach,
            ageRangesTreated: data.completeProfile.ageRangesTreated,
            practiceDetails: {
              practiceType: data.completeProfile.practiceDetails.practiceType || '',
              sessionLength: data.completeProfile.practiceDetails.sessionLength || '',
              availabilityHours: data.completeProfile.practiceDetails.availabilityHours || '',
              emergencyProtocol: data.completeProfile.practiceDetails.emergencyProtocol || ''
            },
            insuranceInformation: data.completeProfile.insuranceInformation,
            clientTypesServed: data.completeProfile.clientTypesServed,
            lgbtqAffirming: data.completeProfile.lgbtqAffirming,
            religiousSpiritualIntegration: data.completeProfile.religiousSpiritualIntegration,
            otherReligiousSpiritualIntegration: data.completeProfile.otherReligiousSpiritualIntegration,
            sessionFees: data.completeProfile.sessionFees,
            boardCertifications: data.completeProfile.boardCertifications,
            otherBoardCertification: data.completeProfile.otherBoardCertification,
            professionalMemberships: data.completeProfile.professionalMemberships,
            otherProfessionalMembership: data.completeProfile.otherProfessionalMembership
          });
        }
      } catch (error) {
        console.error('[S2] Error loading existing complete profile:', error);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadExistingProfile();
  }, [user?.uid]);

  // Function to upload profile photo via server-side API
  const uploadProfilePhoto = async (file: File): Promise<string | null> => {
    if (!user?.uid) {
      throw new Error('User not authenticated');
    }

    try {
      setUploadingPhoto(true);

      console.log('[S2] Uploading profile photo via server API:', file.name);

      // Create form data for server upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.uid);

      // Upload via server-side API route
      const response = await fetch('/api/s2/profile-photo', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!result.success) {
        console.error('[S2] Server error uploading profile photo:', result.error);
        throw new Error(result.error || 'Failed to upload photo. Please try again.');
      }

      console.log('[S2] ✅ Profile photo uploaded successfully:', result.url);
      return result.url;

    } catch (error) {
      console.error('[S2] Error in uploadProfilePhoto:', error);
      throw error;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!profileData.personalStatement.trim() || profileData.personalStatement.trim().length < 100) {
      newErrors.personalStatement = 'Personal statement must be at least 100 characters';
    }

    if (profileData.mentalHealthSpecialties.length === 0) {
      newErrors.mentalHealthSpecialties = 'Please select at least one specialty';
    }

    if (profileData.treatmentApproaches.length === 0) {
      newErrors.treatmentApproaches = 'Please select at least one treatment approach';
    }

    if (profileData.ageRangesTreated.length === 0) {
      newErrors.ageRangesTreated = 'Please select at least one age range';
    }

    if (!profileData.practiceDetails.practiceType.trim()) {
      newErrors.practiceType = 'Practice type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!user?.uid) {
      setErrors({ general: 'Authentication required. Please sign in.' });
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('[S2] Saving complete profile...');

      const response = await fetch('/api/s2/complete-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          ...profileData
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save complete profile');
      }

      console.log('[S2] ✅ Complete profile saved successfully:', data.completeProfile.id);
      console.log('[S2] 📋 Full response data:', data);

      // AI Preview generation removed - now part of separate upsell flow
      // Redirect to provider dashboard
      router.push('/dashboard/provider');

    } catch (error) {
      console.error('[S2] Error saving complete profile:', error);
      setErrors({
        general: error instanceof Error ? error.message : 'Failed to save profile. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean | string[]) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      onUpdate({
        [parent]: {
          ...((profileData as CompleteProfileData)[parent as keyof CompleteProfileData] as Record<string, unknown>),
          [child]: value
        }
      });
    } else {
      onUpdate({ [field]: value });
    }

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleMultiSelectChange = (field: string, value: string, checked: boolean) => {
    let currentValues: string[] = [];

    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      const parentObj = (profileData as CompleteProfileData)[parent as keyof CompleteProfileData] as Record<string, unknown>;
      currentValues = (parentObj?.[child] || []) as string[];
      const newValues = checked
        ? [...currentValues, value]
        : currentValues.filter((v: string) => v !== value);

      onUpdate({
        [parent]: {
          ...((profileData as CompleteProfileData)[parent as keyof CompleteProfileData] as Record<string, unknown>),
          [child]: newValues
        }
      });
    } else {
      currentValues = ((profileData as CompleteProfileData)[field as keyof CompleteProfileData] || []) as string[];
      const newValues = checked
        ? [...currentValues, value]
        : currentValues.filter((v: string) => v !== value);

      onUpdate({ [field]: newValues });
    }

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleMentalHealthSpecialtySelection = (specialty: string, checked: boolean) => {
    const currentSpecialties = profileData.mentalHealthSpecialties || [];
    const wasOtherSelected = currentSpecialties.includes('Other');
    const isOtherNowSelected = specialty === 'Other' && checked;

    // If "Other" was just selected (wasn't selected before, but is now)
    if (!wasOtherSelected && isOtherNowSelected) {
      // Initialize with one empty input field
      setOtherMentalHealthSpecialtyInputs(['']);
      handleInputChange('otherMentalHealthSpecialty', []);
      handleMultiSelectChange('mentalHealthSpecialties', specialty, checked);
    } else {
      // Normal specialty selection (no "Other" involved)
      handleMultiSelectChange('mentalHealthSpecialties', specialty, checked);

      // If "Other" was previously selected but now deselected, clear the custom specialties
      if (wasOtherSelected && specialty === 'Other' && !checked) {
        setOtherMentalHealthSpecialtyInputs([]);
        handleInputChange('otherMentalHealthSpecialty', []);
      }
    }
  };

  const addMentalHealthSpecialtyInput = () => {
    setOtherMentalHealthSpecialtyInputs([...otherMentalHealthSpecialtyInputs, '']);
  };

  const removeMentalHealthSpecialtyInput = (index: number) => {
    const newInputs = otherMentalHealthSpecialtyInputs.filter((_, i) => i !== index);
    setOtherMentalHealthSpecialtyInputs(newInputs);
    handleInputChange('otherMentalHealthSpecialty', newInputs.filter(input => input.trim()));
  };

  const updateMentalHealthSpecialtyInput = (index: number, value: string) => {
    const newInputs = [...otherMentalHealthSpecialtyInputs];
    newInputs[index] = value;
    setOtherMentalHealthSpecialtyInputs(newInputs);
    handleInputChange('otherMentalHealthSpecialty', newInputs.filter(input => input.trim()));
  };

  const handleTreatmentApproachSelection = (approach: string, checked: boolean) => {
    const currentApproaches = profileData.treatmentApproaches || [];
    const wasOtherSelected = currentApproaches.includes('Other');
    const isOtherNowSelected = approach === 'Other' && checked;

    // If "Other" was just selected (wasn't selected before, but is now)
    if (!wasOtherSelected && isOtherNowSelected) {
      // Initialize with one empty input field
      setOtherTreatmentApproachInputs(['']);
      handleInputChange('otherTreatmentApproach', []);
      handleMultiSelectChange('treatmentApproaches', approach, checked);
    } else {
      // Normal approach selection (no "Other" involved)
      handleMultiSelectChange('treatmentApproaches', approach, checked);

      // If "Other" was previously selected but now deselected, clear the custom approaches
      if (wasOtherSelected && approach === 'Other' && !checked) {
        setOtherTreatmentApproachInputs([]);
        handleInputChange('otherTreatmentApproach', []);
      }
    }
  };

  const addTreatmentApproachInput = () => {
    setOtherTreatmentApproachInputs([...otherTreatmentApproachInputs, '']);
  };

  const removeTreatmentApproachInput = (index: number) => {
    const newInputs = otherTreatmentApproachInputs.filter((_, i) => i !== index);
    setOtherTreatmentApproachInputs(newInputs);
    handleInputChange('otherTreatmentApproach', newInputs.filter(input => input.trim()));
  };

  const updateTreatmentApproachInput = (index: number, value: string) => {
    const newInputs = [...otherTreatmentApproachInputs];
    newInputs[index] = value;
    setOtherTreatmentApproachInputs(newInputs);
    handleInputChange('otherTreatmentApproach', newInputs.filter(input => input.trim()));
  };

  const handleBoardCertificationSelection = (selectedCertifications: string[]) => {
    const previousCertifications = profileData.boardCertifications || [];
    const wasOtherSelected = previousCertifications.includes('Other');
    const isOtherNowSelected = selectedCertifications.includes('Other');

    // If "Other" was just selected (wasn't selected before, but is now)
    if (!wasOtherSelected && isOtherNowSelected) {
      // Initialize with one empty input field
      setOtherBoardCertificationInputs(['']);
      handleInputChange('otherBoardCertification', []);
      handleInputChange('boardCertifications', selectedCertifications);
    } else {
      // Normal certification selection (no "Other" involved)
      handleInputChange('boardCertifications', selectedCertifications);

      // If "Other" was previously selected but now deselected, clear the custom certifications
      if (wasOtherSelected && !isOtherNowSelected) {
        setOtherBoardCertificationInputs([]);
        handleInputChange('otherBoardCertification', []);
      }
    }
  };

  const addBoardCertificationInput = () => {
    setOtherBoardCertificationInputs([...otherBoardCertificationInputs, '']);
  };

  const removeBoardCertificationInput = (index: number) => {
    const newInputs = otherBoardCertificationInputs.filter((_, i) => i !== index);
    setOtherBoardCertificationInputs(newInputs);
    handleInputChange('otherBoardCertification', newInputs.filter(input => input.trim()));
  };

  const updateBoardCertificationInput = (index: number, value: string) => {
    const newInputs = [...otherBoardCertificationInputs];
    newInputs[index] = value;
    setOtherBoardCertificationInputs(newInputs);
    handleInputChange('otherBoardCertification', newInputs.filter(input => input.trim()));
  };

  const handleProfessionalMembershipSelection = (selectedMemberships: string[]) => {
    const previousMemberships = profileData.professionalMemberships || [];
    const wasOtherSelected = previousMemberships.includes('Other');
    const isOtherNowSelected = selectedMemberships.includes('Other');

    // If "Other" was just selected (wasn't selected before, but is now)
    if (!wasOtherSelected && isOtherNowSelected) {
      // Initialize with one empty input field
      setOtherProfessionalMembershipInputs(['']);
      handleInputChange('otherProfessionalMembership', []);
      handleInputChange('professionalMemberships', selectedMemberships);
    } else {
      // Normal membership selection (no "Other" involved)
      handleInputChange('professionalMemberships', selectedMemberships);

      // If "Other" was previously selected but now deselected, clear the custom memberships
      if (wasOtherSelected && !isOtherNowSelected) {
        setOtherProfessionalMembershipInputs([]);
        handleInputChange('otherProfessionalMembership', []);
      }
    }
  };

  const addProfessionalMembershipInput = () => {
    setOtherProfessionalMembershipInputs([...otherProfessionalMembershipInputs, '']);
  };

  const removeProfessionalMembershipInput = (index: number) => {
    const newInputs = otherProfessionalMembershipInputs.filter((_, i) => i !== index);
    setOtherProfessionalMembershipInputs(newInputs);
    handleInputChange('otherProfessionalMembership', newInputs.filter(input => input.trim()));
  };

  const updateProfessionalMembershipInput = (index: number, value: string) => {
    const newInputs = [...otherProfessionalMembershipInputs];
    newInputs[index] = value;
    setOtherProfessionalMembershipInputs(newInputs);
    handleInputChange('otherProfessionalMembership', newInputs.filter(input => input.trim()));
  };

  const handleReligiousSpiritualIntegrationSelection = (selectedValue: string) => {
    const previousValue = profileData.religiousSpiritualIntegration || '';
    const wasOtherSelected = previousValue === 'Other';
    const isOtherNowSelected = selectedValue === 'Other';

    // If "Other" was just selected (wasn't selected before, but is now)
    if (!wasOtherSelected && isOtherNowSelected) {
      // Initialize with one empty input field
      setOtherReligiousSpiritualInputs(['']);
      handleInputChange('otherReligiousSpiritualIntegration', []);
      handleInputChange('religiousSpiritualIntegration', selectedValue);
    } else {
      // Normal selection (no "Other" involved)
      handleInputChange('religiousSpiritualIntegration', selectedValue);

      // If "Other" was previously selected but now deselected, clear the custom integrations
      if (wasOtherSelected && !isOtherNowSelected) {
        setOtherReligiousSpiritualInputs([]);
        handleInputChange('otherReligiousSpiritualIntegration', []);
      }
    }
  };

  const addReligiousSpiritualInput = () => {
    setOtherReligiousSpiritualInputs([...otherReligiousSpiritualInputs, '']);
  };

  const removeReligiousSpiritualInput = (index: number) => {
    const newInputs = otherReligiousSpiritualInputs.filter((_, i) => i !== index);
    setOtherReligiousSpiritualInputs(newInputs);
    handleInputChange('otherReligiousSpiritualIntegration', newInputs.filter(input => input.trim()));
  };

  const updateReligiousSpiritualInput = (index: number, value: string) => {
    const newInputs = [...otherReligiousSpiritualInputs];
    newInputs[index] = value;
    setOtherReligiousSpiritualInputs(newInputs);
    handleInputChange('otherReligiousSpiritualIntegration', newInputs.filter(input => input.trim()));
  };

  // Show loading while fetching existing data
  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-full pt-20" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading your complete profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      {/* Step Navigator */}
      {onStepNavigation && (
        <StepNavigator
          currentStep="complete-profile"
          onStepClick={onStepNavigation}
          canSkipToStep={canSkipToStep}
          stepCompletionStatus={stepCompletionStatus}
        />
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
            Complete Your Profile
          </h1>
          <p className="text-lg max-w-3xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Additional details will help patients find and connect with you.
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

        <div className="space-y-8">
          {/* Profile Photo Upload */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Profile Photo <span className="text-sm font-normal text-gray-500">(optional)</span>
            </h2>
            <div className="flex items-center space-x-4">
              {profileData.profilePhoto ? (
                <Image
                  src={profileData.profilePhoto}
                  alt="Profile"
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-full object-cover border-2 border-gray-300"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      console.log('[S2] Profile photo selected:', file.name);

                      try {
                        // Validate file size (5MB limit)
                        if (file.size > 5 * 1024 * 1024) {
                          setErrors(prev => ({ ...prev, profilePhoto: 'File size must be less than 5MB' }));
                          return;
                        }

                        // Validate file type
                        if (!file.type.startsWith('image/')) {
                          setErrors(prev => ({ ...prev, profilePhoto: 'Please select a valid image file' }));
                          return;
                        }

                        // Clear any previous errors
                        if (errors.profilePhoto) {
                          setErrors(prev => ({ ...prev, profilePhoto: '' }));
                        }

                        // Upload to Supabase Storage and get permanent URL
                        const publicUrl = await uploadProfilePhoto(file);
                        if (publicUrl) {
                          handleInputChange('profilePhoto', publicUrl);
                        }

                      } catch (error) {
                        console.error('[S2] Error uploading profile photo:', error);
                        setErrors(prev => ({
                          ...prev,
                          profilePhoto: error instanceof Error ? error.message : 'Failed to upload photo'
                        }));
                      }
                    }
                  }}
                  className="hidden"
                  id="profilePhoto"
                  disabled={uploadingPhoto}
                />
                <label
                  htmlFor="profilePhoto"
                  className={`control-button cursor-pointer inline-block ${uploadingPhoto ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                >
                  {uploadingPhoto ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Uploading...
                    </>
                  ) : (
                    'Upload Photo'
                  )}
                </label>
                <p className="text-sm text-gray-500 mt-1">JPG, PNG up to 5MB</p>
                {errors.profilePhoto && (
                  <p className="mt-1 text-sm text-red-600">{errors.profilePhoto}</p>
                )}
              </div>
            </div>
          </div>

          {/* Personal Statement */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Personal Statement
            </h2>
            <textarea
              value={profileData.personalStatement}
              onChange={(e) => handleInputChange('personalStatement', e.target.value)}
              placeholder="Tell potential patients about your approach to therapy, your experience, and what makes you unique as a therapist..."
              rows={6}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors.personalStatement ? 'border-red-300' : 'border-gray-300'
                }`}
            />
            {errors.personalStatement && (
              <p className="mt-1 text-sm text-red-600">{errors.personalStatement}</p>
            )}
            <p className="mt-2 text-sm text-gray-500">
              {profileData.personalStatement.length} / 3000 characters
            </p>
          </div>

          {/* Mental Health Specialties */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Mental Health Specialties
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                'Anxiety Disorders', 'Depression', 'PTSD/Trauma', 'Relationship Issues',
                'Addiction/Substance Abuse', 'Eating Disorders', 'ADHD', 'Bipolar Disorder',
                'OCD', 'Grief & Loss', 'Life Transitions', 'Stress Management', 'Other'
              ].map(specialty => (
                <label key={specialty} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={profileData.mentalHealthSpecialties.includes(specialty)}
                    onChange={(e) => handleMentalHealthSpecialtySelection(specialty, e.target.checked)}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">{specialty}</span>
                </label>
              ))}
            </div>
            {errors.mentalHealthSpecialties && (
              <p className="mt-2 text-sm text-red-600">{errors.mentalHealthSpecialties}</p>
            )}

            {/* Show custom mental health specialty input fields when "Other" is selected */}
            {profileData.mentalHealthSpecialties.includes('Other') && (
              <div className="mt-4 space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Custom Mental Health Specialties
                </label>
                {otherMentalHealthSpecialtyInputs.map((input, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => updateMentalHealthSpecialtyInput(index, e.target.value)}
                      placeholder="e.g., Perinatal Mental Health, Neurofeedback, Play Therapy"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeMentalHealthSpecialtyInput(index)}
                      className="px-3 py-2 text-red-600 hover:text-red-800 border border-red-300 rounded-lg hover:bg-red-50"
                      title="Remove this specialty"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addMentalHealthSpecialtyInput}
                  className="text-sm text-green-600 hover:text-green-800 font-medium"
                >
                  + Add Another Specialty
                </button>
              </div>
            )}
          </div>

          {/* Treatment Approaches */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Treatment Approaches
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                'Cognitive Behavioral Therapy (CBT)', 'Dialectical Behavior Therapy (DBT)',
                'Acceptance and Commitment Therapy (ACT)', 'Psychodynamic Therapy',
                'Humanistic/Person-Centered', 'Family Systems', 'EMDR', 'Mindfulness-Based',
                'Solution-Focused', 'Narrative Therapy', 'Art/Creative Therapy', 'Other'
              ].map(approach => (
                <label key={approach} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={profileData.treatmentApproaches.includes(approach)}
                    onChange={(e) => handleTreatmentApproachSelection(approach, e.target.checked)}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">{approach}</span>
                </label>
              ))}
            </div>
            {errors.treatmentApproaches && (
              <p className="mt-2 text-sm text-red-600">{errors.treatmentApproaches}</p>
            )}

            {/* Show custom treatment approach input fields when "Other" is selected */}
            {profileData.treatmentApproaches.includes('Other') && (
              <div className="mt-4 space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Custom Treatment Approaches
                </label>
                {otherTreatmentApproachInputs.map((input, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => updateTreatmentApproachInput(index, e.target.value)}
                      placeholder="e.g., Somatic Therapy, IFS (Internal Family Systems), Music Therapy"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeTreatmentApproachInput(index)}
                      className="px-3 py-2 text-red-600 hover:text-red-800 border border-red-300 rounded-lg hover:bg-red-50"
                      title="Remove this approach"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addTreatmentApproachInput}
                  className="text-sm text-green-600 hover:text-green-800 font-medium"
                >
                  + Add Another Approach
                </button>
              </div>
            )}
          </div>

          {/* Age Ranges Treated */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Age Ranges Treated
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                'Children (5-12)', 'Adolescents (13-17)', 'Young Adults (18-25)',
                'Adults (26-64)', 'Seniors (65+)'
              ].map(ageRange => (
                <label key={ageRange} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={profileData.ageRangesTreated.includes(ageRange)}
                    onChange={(e) => handleMultiSelectChange('ageRangesTreated', ageRange, e.target.checked)}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">{ageRange}</span>
                </label>
              ))}
            </div>
            {errors.ageRangesTreated && (
              <p className="mt-2 text-sm text-red-600">{errors.ageRangesTreated}</p>
            )}
          </div>

          {/* Practice Details */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
              Practice Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Practice Type
                </label>
                <select
                  value={profileData.practiceDetails.practiceType}
                  onChange={(e) => handleInputChange('practiceDetails.practiceType', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors.practiceType ? 'border-red-300' : 'border-gray-300'
                    }`}
                >
                  <option value="">Select practice type</option>
                  <option value="Private Practice">Private Practice</option>
                  <option value="Group Practice">Group Practice</option>
                  <option value="Community Mental Health">Community Mental Health</option>
                  <option value="Hospital/Medical Center">Hospital/Medical Center</option>
                  <option value="Online Only">Online Only</option>
                </select>
                {errors.practiceType && (
                  <p className="mt-1 text-sm text-red-600">{errors.practiceType}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Session Length
                </label>
                <select
                  value={profileData.practiceDetails.sessionLength}
                  onChange={(e) => handleInputChange('practiceDetails.sessionLength', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Select session length</option>
                  <option value="45 minutes">45 minutes</option>
                  <option value="50 minutes">50 minutes</option>
                  <option value="60 minutes">60 minutes</option>
                  <option value="90 minutes">90 minutes</option>
                  <option value="Varies by client need">Varies by client need</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Availability Hours
                </label>
                <input
                  type="text"
                  value={profileData.practiceDetails.availabilityHours}
                  onChange={(e) => handleInputChange('practiceDetails.availabilityHours', e.target.value)}
                  placeholder="e.g., Mon-Fri 9AM-6PM, Saturdays 10AM-2PM"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Emergency Protocol
                </label>
                <input
                  type="text"
                  value={profileData.practiceDetails.emergencyProtocol}
                  onChange={(e) => handleInputChange('practiceDetails.emergencyProtocol', e.target.value)}
                  placeholder="e.g., 24-hour crisis line, after-hours answering service"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>
          </div>

          {/* Insurance Information */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
              Insurance Information
            </h2>
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="acceptsInsurance"
                  checked={profileData.insuranceInformation.acceptsInsurance}
                  onChange={(e) => handleInputChange('insuranceInformation.acceptsInsurance', e.target.checked)}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label htmlFor="acceptsInsurance" className="ml-2 text-sm text-gray-700">
                  Accepts Insurance
                </label>
              </div>

              {profileData.insuranceInformation.acceptsInsurance && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                    Accepted Insurance Plans
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      'Aetna', 'Blue Cross Blue Shield', 'Cigna', 'UnitedHealth',
                      'Humana', 'Kaiser Permanente', 'Medicare', 'Medicaid'
                    ].map(plan => (
                      <label key={plan} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={profileData.insuranceInformation.insurancePlans.includes(plan)}
                          onChange={(e) => handleMultiSelectChange('insuranceInformation.insurancePlans', plan, e.target.checked)}
                          className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">{plan}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="outOfNetworkSupported"
                  checked={profileData.insuranceInformation.outOfNetworkSupported}
                  onChange={(e) => handleInputChange('insuranceInformation.outOfNetworkSupported', e.target.checked)}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label htmlFor="outOfNetworkSupported" className="ml-2 text-sm text-gray-700">
                  Provides Out-of-Network Superbills
                </label>
              </div>
            </div>
          </div>

          {/* Client Types Served */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Client Types Served <span className="text-gray-400">(optional)</span>
            </label>
            <div className="space-y-3">
              {['Individuals', 'Couples', 'Families', 'Groups'].map((type) => (
                <div key={type} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`clientType-${type}`}
                    checked={profileData.clientTypesServed?.includes(type) || false}
                    onChange={(e) => handleMultiSelectChange('clientTypesServed', type, e.target.checked)}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label htmlFor={`clientType-${type}`} className="ml-2 text-sm text-gray-700">
                    {type}
                  </label>
                </div>
              ))}
            </div>
          </div>


          {/* Religious/Spiritual Integration */}
          <div>
            <label htmlFor="religiousSpiritualIntegration" className="block text-sm font-medium text-gray-700 mb-2">
              Religious/Spiritual Integration <span className="text-gray-400">(optional)</span>
            </label>
            <select
              id="religiousSpiritualIntegration"
              value={profileData.religiousSpiritualIntegration || ''}
              onChange={(e) => handleReligiousSpiritualIntegrationSelection(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Select approach</option>
              <option value="None">None - Secular approach only</option>
              <option value="Christian">Christian</option>
              <option value="Jewish">Jewish</option>
              <option value="Buddhist">Buddhist</option>
              <option value="Hindu">Hindu</option>
              <option value="Islamic">Islamic</option>
              <option value="General Spiritual">General Spiritual</option>
              <option value="Client-Led">Client-Led Integration</option>
              <option value="Other">Other</option>
            </select>

            {/* Show custom religious/spiritual integration input fields when "Other" is selected */}
            {profileData.religiousSpiritualIntegration === 'Other' && (
              <div className="mt-4 space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Custom Religious/Spiritual Integration Approaches
                </label>
                {otherReligiousSpiritualInputs.map((input, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => updateReligiousSpiritualInput(index, e.target.value)}
                      placeholder="e.g., Indigenous Practices, Interfaith Approach, Secular Humanism"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeReligiousSpiritualInput(index)}
                      className="px-3 py-2 text-red-600 hover:text-red-800 border border-red-300 rounded-lg hover:bg-red-50"
                      title="Remove this approach"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addReligiousSpiritualInput}
                  className="text-sm text-green-600 hover:text-green-800 font-medium"
                >
                  + Add Another Approach
                </button>
              </div>
            )}
          </div>

          {/* Session Fees */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Session Fees <span className="text-sm font-normal text-gray-500">(optional)</span>
            </h2>
            <div className="space-y-4">
              {/* Text input for custom session fee */}
              <div>
                <label htmlFor="sessionFeesCustom" className="block text-sm font-medium text-gray-700 mb-2">
                  Enter session fee (e.g. $150, $75-100, etc.)
                </label>
                <input
                  type="text"
                  id="sessionFeesCustom"
                  value={(() => {
                    if (!profileData.sessionFees) return '';
                    // Extract custom fee from combined string
                    const parts = profileData.sessionFees.split(', ').filter(part =>
                      part !== 'Sliding scale available' && part !== 'Contact for rates'
                    );
                    return parts.join(', ');
                  })()}
                  onChange={(e) => {
                    const customFee = e.target.value;
                    const currentFees = profileData.sessionFees || '';

                    // Extract checkbox options
                    const hasSliding = currentFees.includes('Sliding scale available');
                    const hasContact = currentFees.includes('Contact for rates');

                    // Build new sessionFees string
                    const parts = [];
                    if (customFee.trim()) parts.push(customFee.trim());
                    if (hasSliding) parts.push('Sliding scale available');
                    if (hasContact) parts.push('Contact for rates');

                    handleInputChange('sessionFees', parts.join(', '));
                  }}
                  placeholder="Enter your session fee"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              {/* Checkbox options */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Or select one of these options:</p>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={profileData.sessionFees?.includes('Sliding scale available') || false}
                      onChange={(e) => {
                        const currentFees = profileData.sessionFees || '';

                        // Extract custom fee and contact option
                        const parts = currentFees.split(', ').filter(part => part !== 'Sliding scale available');

                        // Add or remove sliding scale
                        if (e.target.checked) {
                          parts.push('Sliding scale available');
                        }

                        // Filter out empty strings and join
                        const newValue = parts.filter(p => p.trim()).join(', ');
                        handleInputChange('sessionFees', newValue);
                      }}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Sliding scale available</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={profileData.sessionFees?.includes('Contact for rates') || false}
                      onChange={(e) => {
                        const currentFees = profileData.sessionFees || '';

                        // Extract custom fee and sliding scale option
                        const parts = currentFees.split(', ').filter(part => part !== 'Contact for rates');

                        // Add or remove contact for rates
                        if (e.target.checked) {
                          parts.push('Contact for rates');
                        }

                        // Filter out empty strings and join
                        const newValue = parts.filter(p => p.trim()).join(', ');
                        handleInputChange('sessionFees', newValue);
                      }}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Contact for rates</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Board Certifications */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Board Certifications <span className="text-gray-400">(optional)</span>
            </label>
            <CustomMultiSelect
              options={boardCertificationOptions}
              value={profileData.boardCertifications || []}
              onChange={(value) => handleBoardCertificationSelection(value)}
              placeholder="Select board certifications..."
            />

            {/* Show custom board certification input fields when "Other" is selected */}
            {profileData.boardCertifications?.includes('Other') && (
              <div className="mt-4 space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Custom Board Certifications
                </label>
                {otherBoardCertificationInputs.map((input, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => updateBoardCertificationInput(index, e.target.value)}
                      placeholder="e.g., Board Certified Psychiatrist, Certified Clinical Trauma Professional"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeBoardCertificationInput(index)}
                      className="px-3 py-2 text-red-600 hover:text-red-800 border border-red-300 rounded-lg hover:bg-red-50"
                      title="Remove this certification"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addBoardCertificationInput}
                  className="text-sm text-green-600 hover:text-green-800 font-medium"
                >
                  + Add Another Certification
                </button>
              </div>
            )}
          </div>

          {/* Professional Memberships */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Professional Memberships <span className="text-gray-400">(optional)</span>
            </label>
            <CustomMultiSelect
              options={professionalMembershipOptions}
              value={profileData.professionalMemberships || []}
              onChange={(value) => handleProfessionalMembershipSelection(value)}
              placeholder="Select professional memberships..."
            />

            {/* Show custom professional membership input fields when "Other" is selected */}
            {profileData.professionalMemberships?.includes('Other') && (
              <div className="mt-4 space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Custom Professional Memberships
                </label>
                {otherProfessionalMembershipInputs.map((input, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => updateProfessionalMembershipInput(index, e.target.value)}
                      placeholder="e.g., International Association for Play Therapy, Association for Applied Sport Psychology"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeProfessionalMembershipInput(index)}
                      className="px-3 py-2 text-red-600 hover:text-red-800 border border-red-300 rounded-lg hover:bg-red-50"
                      title="Remove this membership"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addProfessionalMembershipInput}
                  className="text-sm text-green-600 hover:text-green-800 font-medium"
                >
                  + Add Another Membership
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-8">
            <button
              onClick={onBack}
              className="control-button"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            >
              ← Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`control-button primary ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving Profile...
                </>
              ) : (
                'Finish'
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CompleteProfile;