import React from 'react';
import TherapistCard, { Therapist } from './TherapistCard';

interface TherapistListProps {
  therapists: Therapist[];
  onTryAIPreview: (therapist: Therapist) => void;
  onViewMore?: (therapist: Therapist) => void;
  onAdvancedSettings?: () => void;
  isProviderMode?: boolean;
  loading?: boolean;
  loadingPrompt?: boolean;
}

const TherapistList: React.FC<TherapistListProps> = ({
  therapists,
  onTryAIPreview,
  onViewMore,
  onAdvancedSettings,
  isProviderMode = false,
  loading = false,
  loadingPrompt = false
}) => {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="animate-pulse">
            <div className="rounded-lg shadow-sm border p-6" style={{
              backgroundColor: 'var(--bg-secondary)',
              borderColor: 'var(--border-color)'
            }}>
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 bg-gray-300 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-6 bg-gray-300 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-300 rounded w-1/2 mb-3"></div>
                  <div className="h-4 bg-gray-300 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-300 rounded w-5/6"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (therapists.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-medium" style={{ color: 'var(--text-primary)' }}>No therapists found</h3>
        <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
          Try adjusting your search criteria or removing some filters.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {therapists.map((therapist) => (
        <TherapistCard
          key={therapist.id}
          therapist={therapist}
          onTryAIPreview={onTryAIPreview}
          onViewMore={onViewMore}
          onAdvancedSettings={onAdvancedSettings}
          isProviderMode={isProviderMode}
          loadingPrompt={loadingPrompt}
        />
      ))}
    </div>
  );
};

export default TherapistList;