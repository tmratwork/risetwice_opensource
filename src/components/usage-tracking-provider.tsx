'use client';

import React from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useUsageTracking } from '@/hooks/use-usage-tracking';

export function UsageTrackingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  // Initialize usage tracking
  useUsageTracking({
    firebaseUser: user,
    enablePageTracking: true
  });

  return <>{children}</>;
}