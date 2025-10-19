// src/app/chatbotV18/p1/intake/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

export default function PatientIntakePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    fullLegalName: '',
    preferredName: '',
    pronouns: '',
    dateOfBirth: '',
    gender: '',
    email: user?.email || '',
    phone: '',
    state: '',
    city: '',
    zipCode: '',
    insuranceProvider: '',
    insurancePlan: '',
    insuranceId: '',
    budgetPerSession: '',
    sessionPreference: '',
    availability: [] as string[],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch existing intake data when component mounts
  useEffect(() => {
    const fetchExistingIntake = async () => {
      // Only fetch if user is authenticated or has an email
      if (!user?.uid && !user?.email) {
        setIsLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (user?.uid) {
          params.append('userId', user.uid);
        } else if (user?.email) {
          params.append('email', user.email);
        }

        const response = await fetch(`/api/patient-intake/get?${params.toString()}`);
        const result = await response.json();

        if (response.ok && result.success && result.hasData) {
          const intake = result.data;

          // Pre-populate form with existing data
          setFormData({
            fullLegalName: intake.full_legal_name || '',
            preferredName: intake.preferred_name || '',
            pronouns: intake.pronouns || '',
            dateOfBirth: intake.date_of_birth || '',
            gender: intake.gender || '',
            email: intake.email || user?.email || '',
            phone: intake.phone || '',
            state: intake.state || '',
            city: intake.city || '',
            zipCode: intake.zip_code || '',
            insuranceProvider: intake.insurance_provider || '',
            insurancePlan: intake.insurance_plan || '',
            insuranceId: intake.insurance_id || '',
            budgetPerSession: intake.budget_per_session || '',
            sessionPreference: intake.session_preference || '',
            availability: intake.availability || [],
          });
        }
      } catch (error) {
        console.error('Failed to fetch existing intake data:', error);
        // Continue with empty form on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchExistingIntake();
  }, [user?.uid, user?.email]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAvailabilityChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      availability: prev.availability.includes(value)
        ? prev.availability.filter(item => item !== value)
        : [...prev.availability, value]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Submit to API endpoint
      const response = await fetch('/api/patient-intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          userId: user?.uid || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit form');
      }

      // Success! Navigate to voice intake
      router.push('/chatbotV18');
    } catch (error) {
      console.error('Failed to submit intake form:', error);
      alert('Failed to submit form. Please try again. Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSelfPay = formData.insuranceProvider === 'Self-Pay';

  // Show loading state while fetching data
  if (isLoading) {
    return (
      <div className="w-full h-full overflow-y-auto px-6 pt-12 pb-6 bg-sage-200 dark:bg-[#131314]">
        <div className="w-full max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-2 text-gray-800 dark:text-gray-100">
            Your Details
          </h1>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
            Help us find the perfect therapist match for you
          </p>
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sage-500"></div>
              <span className="ml-3 text-gray-600">Loading your information...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto px-6 pt-12 pb-6 bg-sage-200 dark:bg-[#131314]">
      <div className="w-full max-w-3xl mx-auto">
        {/* Title */}
        <h1 className="text-4xl font-bold text-center mb-2 text-gray-800 dark:text-gray-100">
          Your Details
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
          Help us find the perfect therapist match for you
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-lg space-y-6">

          {/* Personal Information Section */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800 border-b pb-2">Personal Information</h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Full Legal Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="fullLegalName"
                required
                value={formData.fullLegalName}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-400 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Preferred Name
                </label>
                <input
                  type="text"
                  name="preferredName"
                  value={formData.preferredName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-400 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Pronouns
                </label>
                <select
                  name="pronouns"
                  value={formData.pronouns}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-400 focus:border-transparent"
                >
                  <option value="">Select pronouns</option>
                  <option value="he/him">He/Him</option>
                  <option value="she/her">She/Her</option>
                  <option value="they/them">They/Them</option>
                  <option value="other">Other</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  required
                  value={formData.dateOfBirth}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-400 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Gender
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-400 focus:border-transparent"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-binary</option>
                  <option value="other">Other</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800 border-b pb-2">Contact Information</h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-400 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Phone <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="phone"
                required
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="(555) 555-5555"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-400 focus:border-transparent"
              />
            </div>
          </div>

          {/* Location Section */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800 border-b pb-2">Location</h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                State <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="state"
                required
                value={formData.state}
                onChange={handleInputChange}
                placeholder="e.g., California"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-400 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="city"
                  required
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-400 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Zip Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="zipCode"
                  required
                  value={formData.zipCode}
                  onChange={handleInputChange}
                  placeholder="12345"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-400 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Insurance Section */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800 border-b pb-2">Insurance & Payment</h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Insurance Provider <span className="text-red-500">*</span>
              </label>
              <select
                name="insuranceProvider"
                required
                value={formData.insuranceProvider}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-400 focus:border-transparent"
              >
                <option value="">Select insurance provider</option>
                <option value="Aetna">Aetna</option>
                <option value="Anthem">Anthem</option>
                <option value="Blue Cross Blue Shield">Blue Cross Blue Shield</option>
                <option value="Cigna">Cigna</option>
                <option value="Humana">Humana</option>
                <option value="Kaiser Permanente">Kaiser Permanente</option>
                <option value="UnitedHealthcare">UnitedHealthcare</option>
                <option value="Self-Pay">Self-Pay</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {!isSelfPay && formData.insuranceProvider && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Insurance Plan
                  </label>
                  <input
                    type="text"
                    name="insurancePlan"
                    value={formData.insurancePlan}
                    onChange={handleInputChange}
                    placeholder="e.g., PPO, HMO"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-400 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Insurance ID
                  </label>
                  <input
                    type="text"
                    name="insuranceId"
                    value={formData.insuranceId}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-400 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {isSelfPay && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Budget Per Session <span className="text-red-500">*</span>
                </label>
                <select
                  name="budgetPerSession"
                  required={isSelfPay}
                  value={formData.budgetPerSession}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-400 focus:border-transparent"
                >
                  <option value="">Select budget range</option>
                  <option value="$50-$100">$50 - $100</option>
                  <option value="$100-$150">$100 - $150</option>
                  <option value="$150-$200">$150 - $200</option>
                  <option value="$200+">$200+</option>
                </select>
              </div>
            )}
          </div>

          {/* Session Preferences Section */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800 border-b pb-2">Session Preferences</h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Session Preference <span className="text-red-500">*</span>
              </label>
              <select
                name="sessionPreference"
                required
                value={formData.sessionPreference}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-400 focus:border-transparent"
              >
                <option value="">Select preference</option>
                <option value="In-person">In-person only</option>
                <option value="Virtual">Virtual only</option>
                <option value="Both">Both in-person and virtual</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Scheduling Availability <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {[
                  { value: 'weekday_mornings', label: 'Weekday Mornings' },
                  { value: 'weekday_afternoons', label: 'Weekday Afternoons' },
                  { value: 'weekday_evenings', label: 'Weekday Evenings' },
                  { value: 'weekends', label: 'Weekends' },
                ].map(option => (
                  <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.availability.includes(option.value)}
                      onChange={() => handleAvailabilityChange(option.value)}
                      className="w-5 h-5 text-sage-500 border-gray-300 rounded focus:ring-sage-400"
                    />
                    <span className="text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-6">
            <button
              type="submit"
              disabled={isSubmitting || formData.availability.length === 0}
              className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-gray-900 font-bold py-4 px-6 rounded-xl transition-colors text-lg shadow-lg"
            >
              {isSubmitting ? 'Submitting...' : 'Continue to Voice Intake'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
