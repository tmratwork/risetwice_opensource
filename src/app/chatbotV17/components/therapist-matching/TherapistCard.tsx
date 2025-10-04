import React, { useState } from 'react';
import Image from 'next/image';

export interface Therapist {
  id: string;
  fullName: string;
  title: string;
  degrees: string[];
  primaryLocation: string;
  personalStatement?: string;
  mentalHealthSpecialties?: string[];
  treatmentApproaches?: string[];
  profilePhotoUrl?: string;
  yearsOfExperience?: string;
  languagesSpoken?: string[];
  genderIdentity?: string;
  clonedVoiceId?: string;
}

interface TherapistCardProps {
  therapist: Therapist;
  onTryAIPreview: (therapist: Therapist) => void;
  onViewMore?: (therapist: Therapist) => void;
  onAdvancedSettings?: () => void;
  isProviderMode?: boolean;
}

const TherapistCard: React.FC<TherapistCardProps> = ({
  therapist,
  onTryAIPreview,
  onViewMore,
  onAdvancedSettings,
  isProviderMode = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDegrees = (degrees: string[]) => {
    return degrees.join(', ');
  };

  const getDisplayTitle = () => {
    const degreesStr = formatDegrees(therapist.degrees);
    return `${therapist.fullName}${degreesStr ? `, ${degreesStr}` : ''}`;
  };

  const truncateStatement = (statement: string, maxLength: number = 150) => {
    if (statement.length <= maxLength) return statement;
    return statement.substring(0, maxLength) + '...';
  };

  return (
    <div
      className="rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-color)'
      }}>
      <div className="flex items-start gap-4">
        {/* Profile Photo */}
        <div className="flex-shrink-0">
          {therapist.profilePhotoUrl ? (
            <Image
              src={therapist.profilePhotoUrl}
              alt={`${therapist.fullName} profile photo`}
              width={80}
              height={80}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Name and Title */}
          <h3 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            {getDisplayTitle()}
          </h3>

          {/* Professional Title */}
          <p className="mb-3" style={{ color: 'var(--text-secondary)' }}>
            {therapist.title}
          </p>

          {/* Personal Statement */}
          {therapist.personalStatement && (
            <div className="mb-4">
              <p className="leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                &ldquo;{isExpanded ? therapist.personalStatement : truncateStatement(therapist.personalStatement)}&rdquo;
              </p>
            </div>
          )}

          {/* Specialties */}
          {therapist.mentalHealthSpecialties && therapist.mentalHealthSpecialties.length > 0 && (
            <div className="mb-3">
              <div className="flex flex-wrap gap-1">
                {therapist.mentalHealthSpecialties.slice(0, 3).map((specialty, index) => (
                  <span
                    key={index}
                    className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                  >
                    {specialty}
                  </span>
                ))}
                {therapist.mentalHealthSpecialties.length > 3 && (
                  <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                    +{therapist.mentalHealthSpecialties.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Expanded Details */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
              {/* Treatment Approaches */}
              {therapist.treatmentApproaches && therapist.treatmentApproaches.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Treatment Approaches</h4>
                  <div className="flex flex-wrap gap-1">
                    {therapist.treatmentApproaches.map((approach, index) => (
                      <span
                        key={index}
                        className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
                      >
                        {approach}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {therapist.yearsOfExperience && (
                  <div>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Experience:</span>
                    <span className="ml-1" style={{ color: 'var(--text-secondary)' }}>{therapist.yearsOfExperience}</span>
                  </div>
                )}

                {therapist.languagesSpoken && therapist.languagesSpoken.length > 0 && (
                  <div>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Languages:</span>
                    <span className="ml-1" style={{ color: 'var(--text-secondary)' }}>{therapist.languagesSpoken.join(', ')}</span>
                  </div>
                )}

                <div>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Location:</span>
                  <span className="ml-1" style={{ color: 'var(--text-secondary)' }}>{therapist.primaryLocation}</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => {
                if (onViewMore) {
                  onViewMore(therapist);
                } else {
                  setIsExpanded(!isExpanded);
                }
              }}
              className="font-medium text-sm"
              style={{ color: 'var(--button-primary)' }}
            >
              View More
            </button>

            <div className="flex gap-2">
              {/* Advanced Settings Button - Only show in provider mode */}
              {isProviderMode && onAdvancedSettings && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    console.log('[TherapistCard] Advanced button clicked, calling handler');
                    onAdvancedSettings();
                  }}
                  className="font-medium px-4 py-2 border rounded-lg transition-colors hover:bg-gray-50"
                  style={{
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-secondary)'
                  }}
                  title="Configure voice settings for your AI Preview"
                >
                  ⚙️ Advanced
                </button>
              )}

              <button
                onClick={() => onTryAIPreview(therapist)}
                className="font-bold px-6 py-2 rounded-lg transition-colors hover:opacity-80"
                style={{
                  backgroundColor: '#fbbf24',
                  color: '#000000'
                }}
              >
                {isProviderMode ? 'Test AI Preview' : 'Try AI Preview'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TherapistCard;