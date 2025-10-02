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
}

const DetailedTherapistView: React.FC<DetailedTherapistViewProps> = ({
  therapist,
  onBack,
  onTryAIPreview
}) => {
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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)', paddingTop: '20px' }}>
      {/* Back Arrow */}
      <div className="absolute top-6 left-6 z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Find Your Therapist
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 pt-20">
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

              {/* Action Button */}
              {onTryAIPreview && (
                <div className="mt-6">
                  <button
                    onClick={() => onTryAIPreview(therapist)}
                    className="font-bold px-8 py-3 rounded-lg transition-colors hover:opacity-80 text-lg"
                    style={{
                      backgroundColor: '#fbbf24',
                      color: '#000000'
                    }}
                  >
                    Try AI Preview
                  </button>
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