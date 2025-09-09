// src/app/s1/components/TherapistProfileSetup.tsx

"use client";

import React, { useState } from 'react';
import { User } from 'firebase/auth';

interface TherapistProfile {
  id?: string;
  license_type?: string;
  license_number?: string;
  years_experience?: number;
  primary_modalities?: string[];
  specialization_areas?: string[];
  competency_level: string;
  training_program?: string;
  total_sessions_completed?: number;
  total_case_studies_generated?: number;
  average_alliance_score?: number;
  is_active?: boolean;
}

interface Props {
  user: User;
  existingProfile?: TherapistProfile | null;
  onProfileCreated: (profile: TherapistProfile) => void;
}

const MODALITIES = [
  'Cognitive Behavioral Therapy (CBT)',
  'Dialectical Behavior Therapy (DBT)',
  'Psychodynamic Therapy',
  'Humanistic/Person-Centered',
  'EMDR',
  'Acceptance and Commitment Therapy (ACT)',
  'Mindfulness-Based Therapy',
  'Family Systems Therapy',
  'Solution-Focused Brief Therapy',
  'Narrative Therapy'
];

const SPECIALIZATIONS = [
  'Anxiety Disorders',
  'Depression',
  'Trauma and PTSD',
  'Relationship Issues',
  'Addiction',
  'Eating Disorders',
  'Grief and Loss',
  'ADHD',
  'Bipolar Disorder',
  'OCD',
  'Social Anxiety',
  'Panic Disorders',
  'Adolescent Therapy',
  'Family Therapy',
  'Group Therapy'
];

const TherapistProfileSetup: React.FC<Props> = ({ user, existingProfile, onProfileCreated }) => {
  const [formData, setFormData] = useState({
    license_type: existingProfile?.license_type || '',
    license_number: existingProfile?.license_number || '',
    years_experience: existingProfile?.years_experience || 0,
    primary_modalities: existingProfile?.primary_modalities || [],
    specialization_areas: existingProfile?.specialization_areas || [],
    competency_level: existingProfile?.competency_level || 'student',
    training_program: existingProfile?.training_program || ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'years_experience' ? parseInt(value) || 0 : value
    }));
  };

  const handleArrayChange = (field: 'primary_modalities' | 'specialization_areas', value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const method = existingProfile ? 'PUT' : 'POST';
      const response = await fetch('/api/s1/therapist-profile', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save profile');
      }

      const { profile } = await response.json();
      onProfileCreated(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg">
          <div className="px-6 py-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900">
                {existingProfile ? 'Update Your Profile' : 'Welcome to S1'}
              </h2>
              <p className="mt-2 text-gray-600">
                {existingProfile 
                  ? 'Update your therapist profile and preferences'
                  : 'Set up your therapist profile to start practicing with AI patients'
                }
              </p>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Competency Level *
                  </label>
                  <select
                    name="competency_level"
                    value={formData.competency_level}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="student">Student</option>
                    <option value="trainee">Trainee</option>
                    <option value="licensed">Licensed</option>
                    <option value="supervisor">Supervisor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Years of Experience
                  </label>
                  <input
                    type="number"
                    name="years_experience"
                    value={formData.years_experience}
                    onChange={handleInputChange}
                    min="0"
                    max="50"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* License Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    License Type
                  </label>
                  <input
                    type="text"
                    name="license_type"
                    value={formData.license_type}
                    onChange={handleInputChange}
                    placeholder="e.g., LCSW, LMFT, PhD"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    License Number
                  </label>
                  <input
                    type="text"
                    name="license_number"
                    value={formData.license_number}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Training Program */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Training Program/Institution
                </label>
                <input
                  type="text"
                  name="training_program"
                  value={formData.training_program}
                  onChange={handleInputChange}
                  placeholder="e.g., University of XYZ Graduate Program"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Primary Modalities */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Primary Therapeutic Modalities
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {MODALITIES.map((modality) => (
                    <label key={modality} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.primary_modalities.includes(modality)}
                        onChange={() => handleArrayChange('primary_modalities', modality)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{modality}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Specialization Areas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Specialization Areas
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {SPECIALIZATIONS.map((specialization) => (
                    <label key={specialization} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.specialization_areas.includes(specialization)}
                        onChange={() => handleArrayChange('specialization_areas', specialization)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{specialization}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading 
                    ? 'Saving...' 
                    : existingProfile 
                      ? 'Update Profile' 
                      : 'Create Profile & Continue'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Information Panel */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-3">About S1</h3>
          <div className="text-blue-800 text-sm space-y-2">
            <p>
              • Practice with AI patients that simulate realistic psychological presentations
            </p>
            <p>
              • Receive real-time feedback on therapeutic techniques and alliance building
            </p>
            <p>
              • Generate case studies from your sessions for learning and AI Preview training
            </p>
            <p>
              • Track your progress and development as a therapist
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TherapistProfileSetup;