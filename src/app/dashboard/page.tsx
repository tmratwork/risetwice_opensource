// src/app/dashboard/page.tsx
// Role-based dashboard router

"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { getUserRole, UserRole, getDashboardPath } from '@/utils/user-role';
import { Header } from '@/components/header';

const DashboardRouter: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    async function handleRoleRedirect() {
      if (authLoading) return;

      if (!user) {
        router.push('/');
        return;
      }

      try {
        const role = await getUserRole(user.uid);
        setUserRole(role);

        if (role) {
          const dashboardPath = getDashboardPath(role);
          router.push(dashboardPath);
        } else {
          // Default to patient dashboard if role fetch fails
          router.push('/dashboard/patient');
        }
      } catch (error) {
        console.error('Error determining user role:', error);
        // Default to patient dashboard on error
        router.push('/dashboard/patient');
      } finally {
        setLoading(false);
      }
    }

    handleRoleRedirect();
  }, [user, authLoading, router]);

  // Show loading while determining role and redirecting
  if (authLoading || loading) {
    return (
      <>
        <Header />
        <div className="flex-1 flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)', paddingTop: '80px' }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard...</p>
            {userRole && (
              <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                Redirecting to {userRole} dashboard...
              </p>
            )}
          </div>
        </div>
      </>
    );
  }

  // This shouldn't be reached as we redirect above, but just in case
  return (
    <>
      <Header />
      <div className="flex-1 flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)', paddingTop: '80px' }}>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Dashboard</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Redirecting...</p>
        </div>
      </div>
    </>
  );
};

export default DashboardRouter;