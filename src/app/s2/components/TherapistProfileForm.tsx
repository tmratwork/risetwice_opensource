// src/app/s2/components/TherapistProfileForm.tsx
// Step 1 of 5 - Therapist Profile Information Form

"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import StepNavigator from './StepNavigator';
import CustomMultiSelect from './CustomMultiSelect';
import { StepCompletionStatus, FlowStep } from '@/utils/s2-validation';

interface TherapistProfile {
  fullName: string;
  title: string;
  degrees: string[];
  otherDegree?: string;
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

interface TherapistProfileFormProps {
  profile: TherapistProfile;
  onUpdate: (profile: Partial<TherapistProfile>) => void;
  onNext: () => void;
  onBack: () => void;
  onStepNavigation?: (step: FlowStep) => void;
  canSkipToStep?: (targetStep: FlowStep, currentStep: FlowStep) => boolean;
  stepCompletionStatus?: StepCompletionStatus;
}

const TherapistProfileForm: React.FC<TherapistProfileFormProps> = ({
  profile,
  onUpdate,
  onNext,
  onBack,
  onStepNavigation,
  canSkipToStep,
  stepCompletionStatus
}) => {
  const { user } = useAuth();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [otherDegreeInput, setOtherDegreeInput] = useState('');
  const [otherTitleInput, setOtherTitleInput] = useState('');
  const [otherLanguageInput, setOtherLanguageInput] = useState('');
  const [otherCulturalInput, setOtherCulturalInput] = useState('');

  // Load existing profile on mount
  useEffect(() => {
    const loadExistingProfile = async () => {
      if (!user?.uid) return;
      // Only load if profile is empty to prevent overwriting user selections
      if (profile.fullName && profile.fullName.trim()) {
        console.log('[S2] Profile already loaded, skipping fetch');
        setLoadingProfile(false);
        return;
      }

      try {
        console.log('[S2] Loading existing profile for user:', user.uid);
        const response = await fetch(`/api/s2/therapist-profile?userId=${user.uid}`);
        const data = await response.json();

        if (data.success && data.profile) {
          console.log('[S2] Loaded existing profile:', data.profile);
          // Set otherDegreeInput state if otherDegree exists
          if (data.profile.otherDegree) {
            setOtherDegreeInput(data.profile.otherDegree);
          }
          // Set otherTitleInput state if otherTitle exists
          if (data.profile.otherTitle) {
            setOtherTitleInput(data.profile.otherTitle);
          }
          // Set otherLanguageInput state if otherLanguage exists
          console.log('[S2] Loading otherLanguage from profile:', data.profile.otherLanguage);
          if (data.profile.otherLanguage) {
            setOtherLanguageInput(data.profile.otherLanguage);
            console.log('[S2] Set otherLanguageInput to:', data.profile.otherLanguage);
          }
          // Set otherCulturalInput state if otherCulturalBackground exists
          console.log('[S2] Loading otherCulturalBackground from profile:', data.profile.otherCulturalBackground);
          if (data.profile.otherCulturalBackground) {
            setOtherCulturalInput(data.profile.otherCulturalBackground);
            console.log('[S2] Set otherCulturalInput to:', data.profile.otherCulturalBackground);
          }
          onUpdate({
            fullName: data.profile.fullName,
            title: data.profile.title,
            degrees: data.profile.degrees,
            otherDegree: data.profile.otherDegree,
            otherTitle: data.profile.otherTitle,
            primaryLocation: data.profile.primaryLocation,
            offersOnline: data.profile.offersOnline,
            phoneNumber: data.profile.phoneNumber,
            emailAddress: data.profile.emailAddress,
            dateOfBirth: data.profile.dateOfBirth,
            genderIdentity: data.profile.genderIdentity,
            yearsOfExperience: data.profile.yearsOfExperience,
            languagesSpoken: data.profile.languagesSpoken || [],
            otherLanguage: data.profile.otherLanguage,
            culturalBackgrounds: data.profile.culturalBackgrounds || [],
            otherCulturalBackground: data.profile.otherCulturalBackground
          });
        }
      } catch (error) {
        console.error('[S2] Error loading existing profile:', error);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadExistingProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]); // Remove onUpdate from dependencies to prevent infinite loop

  // Options for multi-select fields
  const languageOptions = [
    { value: 'English', label: 'English' },
    { value: 'Spanish', label: 'Spanish' },
    { value: 'French', label: 'French' },
    { value: 'German', label: 'German' },
    { value: 'Italian', label: 'Italian' },
    { value: 'Portuguese', label: 'Portuguese' },
    { value: 'Mandarin', label: 'Mandarin' },
    { value: 'Cantonese', label: 'Cantonese' },
    { value: 'Japanese', label: 'Japanese' },
    { value: 'Korean', label: 'Korean' },
    { value: 'Arabic', label: 'Arabic' },
    { value: 'Hindi', label: 'Hindi' },
    { value: 'Russian', label: 'Russian' },
    { value: 'Hebrew', label: 'Hebrew' },
    { value: 'Other', label: 'Other' }
  ];

  const culturalOptions = [
    { value: 'African American/Black', label: 'African American/Black' },
    { value: 'Asian', label: 'Asian' },
    { value: 'Hispanic/Latino', label: 'Hispanic/Latino' },
    { value: 'Native American', label: 'Native American' },
    { value: 'Pacific Islander', label: 'Pacific Islander' },
    { value: 'Middle Eastern', label: 'Middle Eastern' },
    { value: 'White/Caucasian', label: 'White/Caucasian' },
    { value: 'Multiracial', label: 'Multiracial' },
    { value: 'LGBTQ+ Community', label: 'LGBTQ+ Community' },
    { value: 'Religious/Spiritual Communities', label: 'Religious/Spiritual Communities' },
    { value: 'Military/Veteran Community', label: 'Military/Veteran Community' },
    { value: 'Other', label: 'Other' }
  ];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!profile.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!profile.title.trim()) {
      newErrors.title = 'Title is required';
    }

    // If "Other" title is selected, validate that custom title is provided
    if (profile.title === 'Other' && !otherTitleInput.trim()) {
      newErrors.title = 'Please specify your custom title';
    }

    if (profile.degrees.length === 0) {
      newErrors.degrees = 'At least one degree is required';
    }
    
    // If "Other" is selected, validate that custom degree is provided
    if (profile.degrees.includes('Other') && !otherDegreeInput.trim()) {
      newErrors.degrees = 'Please specify your custom degree/credential';
    }

    // If "Other" language is selected, validate that custom language is provided
    if (profile.languagesSpoken?.includes('Other') && !otherLanguageInput.trim()) {
      newErrors.languagesSpoken = 'Please specify your custom language';
    }

    // If "Other" cultural background is selected, validate that custom background is provided
    if (profile.culturalBackgrounds?.includes('Other') && !otherCulturalInput.trim()) {
      newErrors.culturalBackgrounds = 'Please specify your custom cultural background';
    }

    if (!profile.primaryLocation.trim()) {
      newErrors.primaryLocation = 'Primary location is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    if (!user?.uid) {
      setErrors({ general: 'Authentication required. Please sign in.' });
      return;
    }

    setIsSubmitting(true);
    
    try {
      console.log('[S2] Saving therapist profile...');
      
      const response = await fetch('/api/s2/therapist-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          fullName: profile.fullName,
          title: profile.title,
          degrees: profile.degrees,
          otherDegree: profile.otherDegree,
          otherTitle: profile.otherTitle,
          primaryLocation: profile.primaryLocation,
          offersOnline: profile.offersOnline,
          phoneNumber: profile.phoneNumber,
          emailAddress: profile.emailAddress,
          dateOfBirth: profile.dateOfBirth,
          genderIdentity: profile.genderIdentity,
          yearsOfExperience: profile.yearsOfExperience,
          languagesSpoken: profile.languagesSpoken,
          otherLanguage: profile.otherLanguage,
          culturalBackgrounds: profile.culturalBackgrounds,
          otherCulturalBackground: profile.otherCulturalBackground
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save profile');
      }

      console.log('[S2] ✅ Profile saved successfully:', data.profile.id);
      onNext();

    } catch (error) {
      console.error('[S2] Error saving profile:', error);
      setErrors({ 
        general: error instanceof Error ? error.message : 'Failed to save profile. Please try again.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof TherapistProfile, value: string | boolean | string[]) => {
    // For array fields, ensure we have a stable array reference
    let processedValue = value;
    if (Array.isArray(value)) {
      processedValue = [...value]; // Create a new array to avoid reference issues
    }

    console.log(`[S2] Updating ${field}:`, processedValue);
    console.log('[S2] Current profile state:', profile);

    onUpdate({ [field]: processedValue });
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleLanguageSelection = (selectedLanguages: string[]) => {
    const previousLanguages = profile.languagesSpoken || [];
    const wasOtherSelected = previousLanguages.includes('Other');
    const isOtherNowSelected = selectedLanguages.includes('Other');

    // If "Other" was just selected (wasn't selected before, but is now)
    if (!wasOtherSelected && isOtherNowSelected) {
      const customLanguage = window.prompt(
        'Please specify your custom language:\n\n(Examples: ASL (American Sign Language), Swahili, Tagalog, etc.)'
      );

      if (customLanguage && customLanguage.trim()) {
        // User entered a custom language
        setOtherLanguageInput(customLanguage.trim());
        handleInputChange('otherLanguage', customLanguage.trim());
        handleInputChange('languagesSpoken', selectedLanguages);
      } else {
        // User cancelled or entered empty string, remove "Other" from selection
        const languagesWithoutOther = selectedLanguages.filter(lang => lang !== 'Other');
        handleInputChange('languagesSpoken', languagesWithoutOther);
      }
    } else {
      // Normal language selection (no "Other" involved)
      handleInputChange('languagesSpoken', selectedLanguages);

      // If "Other" was previously selected but now deselected, clear the custom language
      if (wasOtherSelected && !isOtherNowSelected) {
        setOtherLanguageInput('');
        handleInputChange('otherLanguage', '');
      }
    }
  };

  const handleCulturalBackgroundSelection = (selectedBackgrounds: string[]) => {
    const previousBackgrounds = profile.culturalBackgrounds || [];
    const wasOtherSelected = previousBackgrounds.includes('Other');
    const isOtherNowSelected = selectedBackgrounds.includes('Other');

    // If "Other" was just selected (wasn't selected before, but is now)
    if (!wasOtherSelected && isOtherNowSelected) {
      const customBackground = window.prompt(
        'Please specify your custom cultural background/identity:\n\n(Examples: Indigenous/Native, Mixed Heritage, Refugee Community, etc.)'
      );

      if (customBackground && customBackground.trim()) {
        // User entered a custom background
        setOtherCulturalInput(customBackground.trim());
        handleInputChange('otherCulturalBackground', customBackground.trim());
        handleInputChange('culturalBackgrounds', selectedBackgrounds);
      } else {
        // User cancelled or entered empty string, remove "Other" from selection
        const backgroundsWithoutOther = selectedBackgrounds.filter(bg => bg !== 'Other');
        handleInputChange('culturalBackgrounds', backgroundsWithoutOther);
      }
    } else {
      // Normal background selection (no "Other" involved)
      handleInputChange('culturalBackgrounds', selectedBackgrounds);

      // If "Other" was previously selected but now deselected, clear the custom background
      if (wasOtherSelected && !isOtherNowSelected) {
        setOtherCulturalInput('');
        handleInputChange('otherCulturalBackground', '');
      }
    }
  };

  // Show loading while fetching existing profile
  if (loadingProfile) {
    return (
      <div className="flex-1 flex items-center justify-center pt-20" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      {/* Step Navigator */}
      {onStepNavigation && (
        <StepNavigator
          currentStep="profile"
          onStepClick={onStepNavigation}
          canSkipToStep={canSkipToStep}
          stepCompletionStatus={stepCompletionStatus}
        />
      )}

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Tell us about yourself
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Let&apos;s start with some basic information. This will help us create your
            provider profile.
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

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Full Name */}
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              Full Name
            </label>
            <input
              type="text"
              id="fullName"
              value={profile.fullName}
              onChange={(e) => handleInputChange('fullName', e.target.value)}
              placeholder="e.g. Dr. Sarah Miller"
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                errors.fullName ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.fullName && (
              <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>
            )}
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <select
              id="title"
              value={profile.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                errors.title ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              <option value="">Select your title</option>
              <option value="Psychiatrist">Psychiatrist</option>
              <option value="Psychologist">Psychologist</option>
              <option value="Clinical Social Work/Therapist">Clinical Social Work/Therapist</option>
              <option value="Marriage & Family Therapist">Marriage & Family Therapist</option>
              <option value="Nurse Practitioner">Nurse Practitioner</option>
              <option value="Physician Assistant/Associate">Physician Assistant/Associate</option>
              <option value="Other">Other (type in textbox)</option>
            </select>
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title}</p>
            )}

            {/* Other Title Input - Show when "Other" is selected */}
            {profile.title === 'Other' && (
              <div className="mt-3">
                <label htmlFor="otherTitle" className="block text-sm font-medium text-gray-700 mb-2">
                  Please specify your custom title:
                </label>
                <input
                  type="text"
                  id="otherTitle"
                  value={otherTitleInput}
                  onChange={(e) => {
                    setOtherTitleInput(e.target.value);
                    handleInputChange('otherTitle', e.target.value);
                  }}
                  placeholder="e.g., Licensed Professional Counselor, Mental Health Specialist, etc."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            )}
          </div>

          {/* Degrees */}
          <div>
            <label htmlFor="degrees" className="block text-sm font-medium text-gray-700 mb-2">
              Degree(s)
            </label>
            <select
              id="degrees"
              multiple
              value={profile.degrees}
              onChange={(e) => handleInputChange('degrees', Array.from(e.target.selectedOptions, option => option.value))}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                errors.degrees ? 'border-red-300' : 'border-gray-300'
              }`}
              size={4}
            >
              <option value="MD">MD</option>
              <option value="DO">DO</option>
              <option value="PhD">PhD</option>
              <option value="PsyD">PsyD</option>
              <option value="MSW">MSW - Master of Social Work</option>
              <option value="MA">MA - Master&apos;s in Psychology/Counseling</option>
              <option value="MS">MS - Master&apos;s in Clinical Psychology</option>
              <option value="LCSW">LCSW</option>
              <option value="LMFT">LMFT</option>
              <option value="LPC">LPC - Licensed Professional Counselor</option>
              <option value="LPCC">LPCC - Licensed Professional Clinical Counselor</option>
              <option value="LMHC">LMHC - Licensed Mental Health Counselor</option>
              <option value="LCPC">LCPC - Licensed Clinical Professional Counselor</option>
              <option value="LCAS">LCAS - Licensed Clinical Addiction Specialist</option>
              <option value="LCADC">LCADC - Licensed Clinical Addiction Counselor</option>
              <option value="BCBA">BCBA - Board Certified Behavior Analyst</option>
              <option value="LCAT">LCAT - Licensed Creative Arts Therapist</option>
              <option value="LPAT">LPAT - Licensed Professional Art Therapist</option>
              <option value="RN">RN - Registered Nurse</option>
              <option value="NP">NP - Nurse Practitioner</option>
              <option value="PMHNP">PMHNP - Psychiatric Mental Health Nurse Practitioner</option>
              <option value="PA">PA</option>
              <option value="Other">Other (type in textbox)</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">Hold Ctrl/Cmd to select multiple degrees</p>
            {errors.degrees && (
              <p className="mt-1 text-sm text-red-600">{errors.degrees}</p>
            )}
            
            {/* Other Degree Input - Show when "Other" is selected */}
            {profile.degrees.includes('Other') && (
              <div className="mt-3">
                <label htmlFor="otherDegree" className="block text-sm font-medium text-gray-700 mb-2">
                  Please specify your other degree/credential:
                </label>
                <input
                  type="text"
                  id="otherDegree"
                  value={otherDegreeInput}
                  onChange={(e) => {
                    setOtherDegreeInput(e.target.value);
                    handleInputChange('otherDegree', e.target.value);
                  }}
                  placeholder="e.g., LMHP, LCMHC, etc."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            )}
          </div>

          {/* Primary Location */}
          <div>
            <label htmlFor="primaryLocation" className="block text-sm font-medium text-gray-700 mb-2">
              Primary Location Served
            </label>
            <input
              type="text"
              id="primaryLocation"
              value={profile.primaryLocation}
              onChange={(e) => handleInputChange('primaryLocation', e.target.value)}
              placeholder="e.g. San Francisco, CA"
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                errors.primaryLocation ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.primaryLocation && (
              <p className="mt-1 text-sm text-red-600">{errors.primaryLocation}</p>
            )}
          </div>

          {/* Online Sessions */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="offersOnline"
              checked={profile.offersOnline}
              onChange={(e) => handleInputChange('offersOnline', e.target.checked)}
              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
            />
            <label htmlFor="offersOnline" className="ml-2 block text-sm text-gray-700">
              Offers Online Sessions
            </label>
          </div>

          {/* Phone Number - Optional */}
          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="tel"
              id="phoneNumber"
              value={profile.phoneNumber || ''}
              onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* Email Address - Optional */}
          <div>
            <label htmlFor="emailAddress" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="email"
              id="emailAddress"
              value={profile.emailAddress || ''}
              onChange={(e) => handleInputChange('emailAddress', e.target.value)}
              placeholder="sarah.miller@example.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* Date of Birth - Optional */}
          <div>
            <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-2">
              Date of Birth <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="date"
              id="dateOfBirth"
              value={profile.dateOfBirth || ''}
              onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* Gender Identity - Optional */}
          <div>
            <label htmlFor="genderIdentity" className="block text-sm font-medium text-gray-700 mb-2">
              Gender Identity <span className="text-gray-400">(optional)</span>
            </label>
            <select
              id="genderIdentity"
              value={profile.genderIdentity || ''}
              onChange={(e) => handleInputChange('genderIdentity', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Select gender identity</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>

          {/* Years of Experience */}
          <div>
            <label htmlFor="yearsOfExperience" className="block text-sm font-medium text-gray-700 mb-2">
              Years of Experience <span className="text-gray-400">(optional)</span>
            </label>
            <select
              id="yearsOfExperience"
              value={profile.yearsOfExperience || ''}
              onChange={(e) => handleInputChange('yearsOfExperience', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Select experience level</option>
              <option value="0-2 years">0-2 years</option>
              <option value="3-5 years">3-5 years</option>
              <option value="6-10 years">6-10 years</option>
              <option value="11-15 years">11-15 years</option>
              <option value="16+ years">16+ years</option>
            </select>
          </div>

          {/* Languages Spoken - Optional */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Languages Spoken <span className="text-gray-400">(optional)</span>
            </label>
            <CustomMultiSelect
              options={languageOptions}
              value={profile.languagesSpoken || []}
              onChange={(value) => {
                console.log('[S2] Languages selected:', value);
                handleLanguageSelection(value);
              }}
              placeholder="Select languages you speak..."
            />
            {errors.languagesSpoken && (
              <p className="mt-1 text-sm text-red-600">{errors.languagesSpoken}</p>
            )}

            {/* Show custom language when "Other" is selected */}
            {profile.languagesSpoken?.includes('Other') && otherLanguageInput && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                <span className="text-green-800">
                  <strong>Custom Language:</strong> {otherLanguageInput}
                </span>
              </div>
            )}

          </div>

          {/* Cultural Backgrounds - Optional */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cultural Background/Identities <span className="text-gray-400">(optional)</span>
            </label>
            <CustomMultiSelect
              options={culturalOptions}
              value={profile.culturalBackgrounds || []}
              onChange={(value) => {
                console.log('[S2] Cultural backgrounds selected:', value);
                handleCulturalBackgroundSelection(value);
              }}
              placeholder="Select cultural backgrounds..."
            />
            {errors.culturalBackgrounds && (
              <p className="mt-1 text-sm text-red-600">{errors.culturalBackgrounds}</p>
            )}

            {/* Show custom cultural background when "Other" is selected */}
            {profile.culturalBackgrounds?.includes('Other') && otherCulturalInput && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                <span className="text-green-800">
                  <strong>Custom Cultural Background:</strong> {otherCulturalInput}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-6">
            <button
              type="button"
              onClick={onBack}
              className="control-button"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`control-button primary ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
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
        </form>
      </main>
    </div>
  );
};

export default TherapistProfileForm;