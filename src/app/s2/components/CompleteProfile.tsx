// src/app/s2/components/CompleteProfile.tsx
// Complete Profile Form - Profile photo, statement, specialties, and practice details

"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import StepNavigator from './StepNavigator';
// Removed direct Supabase import - now using server-side upload API

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

interface CompleteProfileProps {
  profileData: CompleteProfileData;
  onUpdate: (data: Partial<CompleteProfileData>) => void;
  onNext: () => void;
  onBack: () => void;
  onStepNavigation?: (step: 'welcome' | 'profile' | 'patient-description' | 'ai-style' | 'license-verification' | 'complete-profile' | 'preparation' | 'session' | 'onboarding-complete') => void;
}

const CompleteProfile: React.FC<CompleteProfileProps> = ({
  profileData,
  onUpdate,
  onNext,
  onBack,
  onStepNavigation
}) => {
  const { user } = useAuth();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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

          // Fix: Skip blob URLs entirely to prevent security errors
          const profilePhoto = data.completeProfile.profilePhoto &&
                               !data.completeProfile.profilePhoto.startsWith('blob:')
                               ? data.completeProfile.profilePhoto
                               : '';

          onUpdate({
            profilePhoto,
            personalStatement: data.completeProfile.personalStatement,
            mentalHealthSpecialties: data.completeProfile.mentalHealthSpecialties,
            treatmentApproaches: data.completeProfile.treatmentApproaches,
            ageRangesTreated: data.completeProfile.ageRangesTreated,
            practiceDetails: {
              practiceType: data.completeProfile.practiceDetails.practiceType || '',
              sessionLength: data.completeProfile.practiceDetails.sessionLength || '',
              availabilityHours: data.completeProfile.practiceDetails.availabilityHours || '',
              emergencyProtocol: data.completeProfile.practiceDetails.emergencyProtocol || ''
            },
            insuranceInformation: data.completeProfile.insuranceInformation
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
      onNext();

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

  // Show loading while fetching existing data
  if (loadingProfile) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading your complete profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      {/* Step Navigator */}
      {onStepNavigation && (
        <StepNavigator 
          currentStep="complete-profile" 
          onStepClick={onStepNavigation}
        />
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
            Complete Your Profile
          </h1>
          <p className="text-lg max-w-3xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Complete your therapist profile with additional details that will help patients find and connect with you.
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
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                errors.personalStatement ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.personalStatement && (
              <p className="mt-1 text-sm text-red-600">{errors.personalStatement}</p>
            )}
            <p className="mt-2 text-sm text-gray-500">
              {profileData.personalStatement.length} / 1000 characters
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
                'OCD', 'Grief & Loss', 'Life Transitions', 'Stress Management'
              ].map(specialty => (
                <label key={specialty} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={profileData.mentalHealthSpecialties.includes(specialty)}
                    onChange={(e) => handleMultiSelectChange('mentalHealthSpecialties', specialty, e.target.checked)}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">{specialty}</span>
                </label>
              ))}
            </div>
            {errors.mentalHealthSpecialties && (
              <p className="mt-2 text-sm text-red-600">{errors.mentalHealthSpecialties}</p>
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
                'Solution-Focused', 'Narrative Therapy', 'Gestalt Therapy', 'Art/Creative Therapy'
              ].map(approach => (
                <label key={approach} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={profileData.treatmentApproaches.includes(approach)}
                    onChange={(e) => handleMultiSelectChange('treatmentApproaches', approach, e.target.checked)}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">{approach}</span>
                </label>
              ))}
            </div>
            {errors.treatmentApproaches && (
              <p className="mt-2 text-sm text-red-600">{errors.treatmentApproaches}</p>
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
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                    errors.practiceType ? 'border-red-300' : 'border-gray-300'
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
                'Complete Profile'
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CompleteProfile;