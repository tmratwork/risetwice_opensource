// src/hooks/use-s2-profile-data.ts
// Custom hook for loading and managing S2 profile data

import { useState, useEffect, useCallback } from 'react';
import { StepCompletionStatus } from '@/utils/s2-validation';
import { useAuth } from '@/contexts/auth-context';

interface S2ProfileData {
  therapistProfile: Record<string, unknown> | null;
  patientDescription: Record<string, unknown> | null;
  aiStyleConfig: Record<string, unknown> | null;
  licenseVerification: Record<string, unknown> | null;
  completeProfile: Record<string, unknown> | null;
  generatedScenario: Record<string, unknown> | null;
  session: Record<string, unknown> | null;
}

interface UseS2ProfileDataReturn {
  data: S2ProfileData | null;
  stepCompletionStatus: StepCompletionStatus;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateStepCompletion: (step: keyof StepCompletionStatus, completed: boolean) => void;
}

const initialStepCompletionStatus: StepCompletionStatus = {
  profile: false,
  licenseVerification: false,
  completeProfile: false
};

export function useS2ProfileData(): UseS2ProfileDataReturn {
  const { user } = useAuth();
  const [data, setData] = useState<S2ProfileData | null>(null);
  const [stepCompletionStatus, setStepCompletionStatus] = useState<StepCompletionStatus>(initialStepCompletionStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfileData = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/s2/profile-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        throw new Error(`Failed to fetch profile data: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setStepCompletionStatus(result.stepCompletionStatus);
      } else {
        throw new Error(result.error || 'Unknown error occurred');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profile data';
      setError(errorMessage);
      console.error('Error fetching S2 profile data:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  // Initial data fetch
  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  // Function to manually update step completion status (optimistic updates)
  const updateStepCompletion = useCallback((step: keyof StepCompletionStatus, completed: boolean) => {
    setStepCompletionStatus(prev => ({
      ...prev,
      [step]: completed
    }));
  }, []);

  // Refetch function for manual data refresh
  const refetch = useCallback(async () => {
    await fetchProfileData();
  }, [fetchProfileData]);

  return {
    data,
    stepCompletionStatus,
    loading,
    error,
    refetch,
    updateStepCompletion
  };
}