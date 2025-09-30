import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

interface ProviderProfileStatus {
  isProvider: boolean;
  hasProfile: boolean;
  loading: boolean;
  error: string | null;
}

export function useProviderProfile(): ProviderProfileStatus {
  const { user } = useAuth();
  const [status, setStatus] = useState<ProviderProfileStatus>({
    isProvider: false,
    hasProfile: false,
    loading: false,
    error: null
  });

  useEffect(() => {
    async function checkProviderStatus() {
      if (!user?.uid) {
        setStatus({
          isProvider: false,
          hasProfile: false,
          loading: false,
          error: null
        });
        return;
      }

      setStatus(prev => ({ ...prev, loading: true, error: null }));

      try {
        // Check user role to see if they are a provider
        const roleResponse = await fetch('/api/user-role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid })
        });

        if (!roleResponse.ok) {
          throw new Error('Failed to fetch user role');
        }

        const roleData = await roleResponse.json();
        const isProvider = roleData.roles?.is_provider || false;

        let hasProfile = false;

        // If user is a provider, check if they have a profile in s2_therapist_profiles
        if (isProvider) {
          const profileResponse = await fetch('/api/therapists/my-preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.uid })
          });

          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            hasProfile = profileData.success && !!profileData.therapist;
          }
          // If the API call fails, we assume no profile exists (hasProfile remains false)
        }

        setStatus({
          isProvider,
          hasProfile,
          loading: false,
          error: null
        });

      } catch (error) {
        console.error('Error checking provider status:', error);
        setStatus({
          isProvider: false,
          hasProfile: false,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    checkProviderStatus();
  }, [user?.uid]);

  return status;
}