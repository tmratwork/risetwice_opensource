// src/app/s2/components/TherapistProfileForm.tsx
// Step 1 of 5 - Therapist Profile Information Form

"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

interface TherapistProfile {
  fullName: string;
  title: string;
  degrees: string[];
  primaryLocation: string;
  offersOnline: boolean;
  phoneNumber?: string;
  emailAddress?: string;
}

interface TherapistProfileFormProps {
  profile: TherapistProfile;
  onUpdate: (profile: Partial<TherapistProfile>) => void;
  onNext: () => void;
  onBack: () => void;
}

const TherapistProfileForm: React.FC<TherapistProfileFormProps> = ({
  profile,
  onUpdate,
  onNext,
  onBack
}) => {
  const { user } = useAuth();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Load existing profile on mount
  useEffect(() => {
    const loadExistingProfile = async () => {
      if (!user?.uid) return;

      try {
        const response = await fetch(`/api/s2/therapist-profile?userId=${user.uid}`);
        const data = await response.json();

        if (data.success && data.profile) {
          console.log('[S2] Loaded existing profile:', data.profile);
          onUpdate({
            fullName: data.profile.fullName,
            title: data.profile.title,
            degrees: data.profile.degrees,
            primaryLocation: data.profile.primaryLocation,
            offersOnline: data.profile.offersOnline,
            phoneNumber: data.profile.phoneNumber,
            emailAddress: data.profile.emailAddress
          });
        }
      } catch (error) {
        console.error('[S2] Error loading existing profile:', error);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadExistingProfile();
  }, [user?.uid]); // Remove onUpdate from dependencies to prevent infinite loop

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!profile.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!profile.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (profile.degrees.length === 0) {
      newErrors.degrees = 'At least one degree is required';
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
          primaryLocation: profile.primaryLocation,
          offersOnline: profile.offersOnline,
          phoneNumber: profile.phoneNumber,
          emailAddress: profile.emailAddress
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
    onUpdate({ [field]: value });
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Show loading while fetching existing profile
  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-gray-900">🌱 RiseTwice</span>
            </div>
            <nav className="flex space-x-8">
              <a href="#" className="text-gray-500 hover:text-gray-900">For Therapists</a>
              <a href="#" className="text-gray-500 hover:text-gray-900">For Clients</a>
              <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                Get Started
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="text-center mb-4">
            <span className="text-sm font-medium text-gray-500">Step 1 of 5</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full" style={{ width: '20%' }}></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Tell us about yourself
          </h1>
          <p className="text-gray-600">
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
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
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
              <option value="Dr.">Dr.</option>
              <option value="LCSW">LCSW</option>
              <option value="LMFT">LMFT</option>
              <option value="LPC">LPC</option>
              <option value="LPCC">LPCC</option>
              <option value="PhD">PhD</option>
              <option value="PsyD">PsyD</option>
              <option value="MA">MA</option>
              <option value="MS">MS</option>
            </select>
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title}</p>
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
              <option value="PhD in Psychology">PhD in Psychology</option>
              <option value="PsyD in Clinical Psychology">PsyD in Clinical Psychology</option>
              <option value="MA in Counseling Psychology">MA in Counseling Psychology</option>
              <option value="MS in Clinical Mental Health">MS in Clinical Mental Health</option>
              <option value="MSW - Master of Social Work">MSW - Master of Social Work</option>
              <option value="MA in Marriage and Family Therapy">MA in Marriage and Family Therapy</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">Hold Ctrl/Cmd to select multiple degrees</p>
            {errors.degrees && (
              <p className="mt-1 text-sm text-red-600">{errors.degrees}</p>
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

          {/* Action Buttons */}
          <div className="flex justify-between pt-6">
            <button
              type="button"
              onClick={onBack}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-8 py-3 rounded-lg transition-colors flex items-center ${
                isSubmitting
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
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