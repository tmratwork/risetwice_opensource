import React from 'react';
import Image from 'next/image';
import { Therapist } from './TherapistCard';

// Extended therapist interface with all S2 intake data
export interface DetailedTherapist extends Therapist {
  // From s2_therapist_profiles
  offersOnline?: boolean;
  phoneNumber?: string;
  emailAddress?: string;
  dateOfBirth?: string;
  clonedVoiceId?: string;
  culturalBackgrounds?: string[];
  otherDegree?: string;
  otherTitle?: string;
  otherLanguage?: string;
  otherCulturalBackground?: string;

  // From s2_complete_profiles
  profilePhotoUrl?: string;
  personalStatement?: string;
  mentalHealthSpecialties?: string[];
  treatmentApproaches?: string[];
  ageRangesTreated?: string[];
  practiceType?: string;
  sessionLength?: string;
  availabilityHours?: string;
  emergencyProtocol?: string;
  acceptsInsurance?: boolean;
  insurancePlans?: string[];
  outOfNetworkSupported?: boolean;
  clientTypesServed?: string[];
  lgbtqAffirming?: boolean;
  religiousSpiritualIntegration?: string;
  sessionFees?: string;
  boardCertifications?: string[];
  professionalMemberships?: string[];
  otherMentalHealthSpecialty?: string;
  otherTreatmentApproach?: string;
  otherReligiousSpiritualIntegration?: string;
  otherBoardCertification?: string;
  otherProfessionalMembership?: string;
}

interface DetailedTherapistViewProps {
  therapist: DetailedTherapist;
  onBack: () => void;
  onTryAIPreview?: (therapist: DetailedTherapist) => void;
  loadingPrompt?: boolean;
}

const DetailedTherapistView: React.FC<DetailedTherapistViewProps> = ({
  therapist,
  onBack,
  onTryAIPreview,
  loadingPrompt = false
}) => {
  const [contactInfoClicked, setContactInfoClicked] = React.useState(false);

  // Track analytics event
  const trackAnalyticsEvent = async (eventType: string, eventData?: Record<string, unknown>) => {
    try {
      // Get current user from auth context if available
      const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;

      await fetch('/api/provider/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_user_id: therapist.userId,
          anonymous_user_id: userId,
          event_type: eventType,
          event_data: eventData
        })
      });
    } catch (error) {
      console.error('Failed to track analytics event:', error);
      // Don't block user action if tracking fails
    }
  };

  const formatDegrees = (degrees: string[]) => {
    return degrees.join(', ');
  };

  const getDisplayTitle = () => {
    const degreesStr = formatDegrees(therapist.degrees);
    return `${therapist.fullName}${degreesStr ? `, ${degreesStr}` : ''}`;
  };

  const formatList = (items: string[] | undefined, otherItem?: string) => {
    if (!items || items.length === 0) {
      return otherItem ? [otherItem] : [];
    }

    const filteredItems = items.filter(item => item && item.toLowerCase() !== 'other');
    if (otherItem) {
      filteredItems.push(otherItem);
    }

    return filteredItems;
  };

  return (
    <div className="relative" style={{ backgroundColor: 'var(--bg-secondary)', minHeight: '100%' }}>
      {/* Back Arrow - Fixed position at top of screen */}
      <div className="sticky top-4 left-4 z-50 mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-lg"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Find Your Therapist
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 pb-8">
        <div className="bg-white rounded-lg shadow-sm border p-8">
          {/* Header Section */}
          <div className="flex items-start gap-6 mb-8">
            {/* Profile Photo */}
            <div className="flex-shrink-0">
              {therapist.profilePhotoUrl ? (
                <Image
                  src={therapist.profilePhotoUrl}
                  alt={`${therapist.fullName} profile photo`}
                  width={120}
                  height={120}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="w-30 h-30 bg-gray-200 rounded-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>

            {/* Name and Basic Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2 text-gray-900">
                {getDisplayTitle()}
              </h1>
              <p className="text-xl text-gray-600 mb-3">{therapist.title}</p>

              {/* Basic Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold text-gray-900">Location:</span>
                  <span className="ml-2 text-gray-700">{therapist.primaryLocation}</span>
                </div>

                {therapist.yearsOfExperience && (
                  <div>
                    <span className="font-semibold text-gray-900">Experience:</span>
                    <span className="ml-2 text-gray-700">{therapist.yearsOfExperience}</span>
                  </div>
                )}

                {therapist.offersOnline !== undefined && (
                  <div>
                    <span className="font-semibold text-gray-900">Online Sessions:</span>
                    <span className="ml-2 text-gray-700">{therapist.offersOnline ? 'Available' : 'Not Available'}</span>
                  </div>
                )}

                {therapist.genderIdentity && (
                  <div>
                    <span className="font-semibold text-gray-900">Gender Identity:</span>
                    <span className="ml-2 text-gray-700">{therapist.genderIdentity}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {onTryAIPreview && (
                <div className="mt-6 space-y-3">
                  <div className="flex gap-3">
                    {/* Contact Info Button */}
                    <button
                      onClick={() => {
                        setContactInfoClicked(true);
                        // Track contact button click for provider analytics
                        trackAnalyticsEvent('contact_click', {
                          profileView: 'expanded',
                          contactMethod: 'button_click'
                        });
                      }}
                      disabled={contactInfoClicked}
                      className="font-bold px-8 py-3 rounded-lg transition-colors hover:opacity-80 text-lg disabled:opacity-50"
                      style={{
                        backgroundColor: contactInfoClicked ? '#e0e7ff' : '#93c5fd',
                        color: '#1e3a8a'
                      }}
                    >
                      Contact Info
                    </button>

                    <button
                      onClick={() => onTryAIPreview(therapist)}
                      disabled={loadingPrompt}
                      className="font-bold px-8 py-3 rounded-lg transition-colors hover:opacity-80 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: '#fbbf24',
                        color: '#000000'
                      }}
                    >
                      {loadingPrompt ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Loading...
                        </span>
                      ) : (
                        'Try AI Preview'
                      )}
                    </button>
                  </div>

                  {/* Contact Info Message - Shown after button click */}
                  {contactInfoClicked && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800 font-medium">
                        Contact phone and email not shown during pilot testing.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Personal Statement */}
          {therapist.personalStatement && (
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4 text-gray-900">Personal Statement</h2>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-800 leading-relaxed italic text-lg">
                  &ldquo;{therapist.personalStatement}&rdquo;
                </p>
              </div>
            </section>
          )}

          {/* Specialties and Approaches */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Mental Health Specialties */}
            {therapist.mentalHealthSpecialties && therapist.mentalHealthSpecialties.length > 0 && (
              <section>
                <h2 className="text-xl font-bold mb-4 text-gray-900">Mental Health Specialties</h2>
                <div className="flex flex-wrap gap-2">
                  {formatList(therapist.mentalHealthSpecialties, therapist.otherMentalHealthSpecialty).map((specialty, index) => (
                    <span
                      key={index}
                      className="inline-block px-3 py-2 bg-blue-100 text-blue-800 text-sm rounded-full"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Treatment Approaches */}
            {therapist.treatmentApproaches && therapist.treatmentApproaches.length > 0 && (
              <section>
                <h2 className="text-xl font-bold mb-4 text-gray-900">Treatment Approaches</h2>
                <div className="flex flex-wrap gap-2">
                  {formatList(therapist.treatmentApproaches, therapist.otherTreatmentApproach).map((approach, index) => (
                    <span
                      key={index}
                      className="inline-block px-3 py-2 bg-green-100 text-green-800 text-sm rounded-full"
                    >
                      {approach}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Languages and Cultural Backgrounds */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Languages */}
            {therapist.languagesSpoken && therapist.languagesSpoken.length > 0 && (
              <section>
                <h2 className="text-xl font-bold mb-4 text-gray-900">Languages Spoken</h2>
                <div className="flex flex-wrap gap-2">
                  {formatList(therapist.languagesSpoken, therapist.otherLanguage).map((language, index) => (
                    <span
                      key={index}
                      className="inline-block px-3 py-2 bg-purple-100 text-purple-800 text-sm rounded-full"
                    >
                      {language}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Cultural Backgrounds */}
            {therapist.culturalBackgrounds && therapist.culturalBackgrounds.length > 0 && (
              <section>
                <h2 className="text-xl font-bold mb-4 text-gray-900">Cultural Backgrounds</h2>
                <div className="flex flex-wrap gap-2">
                  {formatList(therapist.culturalBackgrounds, therapist.otherCulturalBackground).map((background, index) => (
                    <span
                      key={index}
                      className="inline-block px-3 py-2 bg-orange-100 text-orange-800 text-sm rounded-full"
                    >
                      {background}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Practice Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Practice Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {therapist.practiceType && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Practice Type</h3>
                  <p className="text-gray-700">{therapist.practiceType}</p>
                </div>
              )}

              {therapist.sessionLength && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Session Length</h3>
                  <p className="text-gray-700">{therapist.sessionLength}</p>
                </div>
              )}

              {therapist.sessionFees && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Session Fees</h3>
                  <p className="text-gray-700">{therapist.sessionFees}</p>
                </div>
              )}

              {therapist.availabilityHours && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Availability</h3>
                  <p className="text-gray-700">{therapist.availabilityHours}</p>
                </div>
              )}
            </div>
          </section>

          {/* Insurance and Payment */}
          {(therapist.acceptsInsurance !== undefined || therapist.insurancePlans) && (
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">Insurance & Payment</h2>
              <div className="bg-gray-50 rounded-lg p-6">
                {therapist.acceptsInsurance !== undefined && (
                  <div className="mb-4">
                    <span className="font-semibold text-gray-900">Accepts Insurance:</span>
                    <span className="ml-2 text-gray-700">{therapist.acceptsInsurance ? 'Yes' : 'No'}</span>
                  </div>
                )}

                {therapist.outOfNetworkSupported !== undefined && (
                  <div className="mb-4">
                    <span className="font-semibold text-gray-900">Out-of-Network Support:</span>
                    <span className="ml-2 text-gray-700">{therapist.outOfNetworkSupported ? 'Yes' : 'No'}</span>
                  </div>
                )}

                {therapist.insurancePlans && therapist.insurancePlans.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Insurance Plans Accepted</h3>
                    <div className="flex flex-wrap gap-2">
                      {therapist.insurancePlans.map((plan, index) => (
                        <span
                          key={index}
                          className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded"
                        >
                          {plan}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Client Types and Special Considerations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Age Ranges */}
            {therapist.ageRangesTreated && therapist.ageRangesTreated.length > 0 && (
              <section>
                <h2 className="text-xl font-bold mb-4 text-gray-900">Age Ranges Treated</h2>
                <div className="flex flex-wrap gap-2">
                  {therapist.ageRangesTreated.map((ageRange, index) => (
                    <span
                      key={index}
                      className="inline-block px-3 py-2 bg-yellow-100 text-yellow-800 text-sm rounded-full"
                    >
                      {ageRange}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Client Types */}
            {therapist.clientTypesServed && therapist.clientTypesServed.length > 0 && (
              <section>
                <h2 className="text-xl font-bold mb-4 text-gray-900">Client Types Served</h2>
                <div className="flex flex-wrap gap-2">
                  {therapist.clientTypesServed.map((clientType, index) => (
                    <span
                      key={index}
                      className="inline-block px-3 py-2 bg-indigo-100 text-indigo-800 text-sm rounded-full"
                    >
                      {clientType}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Special Considerations */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Special Considerations</h2>
            <div className="space-y-4">
              {therapist.lgbtqAffirming !== undefined && (
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${therapist.lgbtqAffirming ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span className="text-gray-900">LGBTQ+ Affirming Practice</span>
                </div>
              )}

              {therapist.religiousSpiritualIntegration && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Religious/Spiritual Integration</h3>
                  <p className="text-gray-700">{therapist.religiousSpiritualIntegration}</p>
                  {therapist.otherReligiousSpiritualIntegration && (
                    <p className="text-gray-700 mt-2">{therapist.otherReligiousSpiritualIntegration}</p>
                  )}
                </div>
              )}

              {therapist.emergencyProtocol && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Emergency Protocol</h3>
                  <p className="text-gray-700">{therapist.emergencyProtocol}</p>
                </div>
              )}
            </div>
          </section>

          {/* Credentials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Board Certifications */}
            {therapist.boardCertifications && therapist.boardCertifications.length > 0 && (
              <section>
                <h2 className="text-xl font-bold mb-4 text-gray-900">Board Certifications</h2>
                <div className="space-y-2">
                  {formatList(therapist.boardCertifications, therapist.otherBoardCertification).map((certification, index) => (
                    <div key={index} className="bg-gray-50 rounded p-3">
                      <span className="text-gray-800">{certification}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Professional Memberships */}
            {therapist.professionalMemberships && therapist.professionalMemberships.length > 0 && (
              <section>
                <h2 className="text-xl font-bold mb-4 text-gray-900">Professional Memberships</h2>
                <div className="space-y-2">
                  {formatList(therapist.professionalMemberships, therapist.otherProfessionalMembership).map((membership, index) => (
                    <div key={index} className="bg-gray-50 rounded p-3">
                      <span className="text-gray-800">{membership}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailedTherapistView;