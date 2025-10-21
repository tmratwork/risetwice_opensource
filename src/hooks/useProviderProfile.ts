import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

interface ProviderProfileStatus {
  isProvider: boolean;
  loading: boolean;
  error: string | null;
}

export function useProviderProfile(): ProviderProfileStatus {
  const { user } = useAuth();
  const [status, setStatus] = useState<ProviderProfileStatus>({
    isProvider: false,
    loading: false,
    error: null
  });

  useEffect(() => {
    async function checkProviderStatus() {
      if (!user?.uid) {
        setStatus({
          isProvider: false,
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

        setStatus({
          isProvider,
          loading: false,
          error: null
        });

      } catch (error) {
        console.error('Error checking provider status:', error);
        setStatus({
          isProvider: false,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    checkProviderStatus();
  }, [user?.uid]);

  return status;
}