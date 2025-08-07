import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { User } from 'firebase/auth';

interface AdminAuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
}

export function useAdminAuth(): AdminAuthState {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      console.log('[useAdminAuth] Checking admin status for user:', user?.uid);
      
      if (authLoading) {
        console.log('[useAdminAuth] Auth still loading, waiting...');
        return;
      }

      if (!user?.uid) {
        console.log('[useAdminAuth] No authenticated user found');
        setIsAdmin(false);
        setLoading(false);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log('[useAdminAuth] Querying admin_users for user_id:', user.uid);
        const { data, error: queryError } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', user.uid)
          .single();

        if (queryError) {
          console.error('[useAdminAuth] Error querying user profile:', queryError);
          if (queryError.code === 'PGRST116') {
            // No profile found
            console.log('[useAdminAuth] No user profile found, not admin');
            setIsAdmin(false);
          } else {
            setError(`Error checking admin status: ${queryError.message}`);
            setIsAdmin(false);
          }
        } else {
          const adminStatus = !!data; // If record exists in admin_users, user is admin
          console.log('[useAdminAuth] Admin status for user:', adminStatus);
          setIsAdmin(adminStatus);
        }
      } catch (err) {
        console.error('[useAdminAuth] Unexpected error:', err);
        setError('Failed to verify admin permissions');
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [user, authLoading]);

  return {
    user,
    isAdmin,
    loading: authLoading || loading,
    error
  };
}