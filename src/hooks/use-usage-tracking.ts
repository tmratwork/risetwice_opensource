/**
 * React Hook for Usage Tracking
 * Provides convenient access to usage tracking functionality
 */

import { useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { usageTracker } from '@/lib/usage-tracker';

interface UseUsageTrackingOptions {
  firebaseUser: { uid?: string } | null;
  enablePageTracking?: boolean;
}

export function useUsageTracking({ 
  firebaseUser, 
  enablePageTracking = true 
}: UseUsageTrackingOptions) {
  const pathname = usePathname();

  // Initialize tracking on mount and when user changes
  useEffect(() => {
    const initializeTracking = async () => {
      await usageTracker.initialize(firebaseUser);
    };
    
    initializeTracking();
  }, [firebaseUser?.uid]); // Only re-initialize when actual user ID changes, not object reference

  // Track page changes
  useEffect(() => {
    if (!enablePageTracking) return;

    // Track initial page load and pathname changes
    const trackPage = async () => {
      await usageTracker.trackPageView(pathname, firebaseUser);
    };
    
    trackPage();
  }, [pathname, firebaseUser?.uid, enablePageTracking]); // Only depend on user ID, not full object

  // End session on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Call endSession without await since sendBeacon is synchronous
      void usageTracker.endSession();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Track custom events
  const trackEvent = useCallback((eventType: string, eventData?: Record<string, string | number | boolean | null>, pagePath?: string) => {
    usageTracker.trackEvent({
      eventType,
      eventData,
      pagePath: pagePath || pathname
    });
  }, [pathname]);

  // Track page view manually
  const trackPageView = useCallback((path?: string) => {
    usageTracker.trackPageView(path || pathname, firebaseUser);
  }, [pathname, firebaseUser]);

  return {
    trackEvent,
    trackPageView,
    sessionInfo: usageTracker.getSessionInfo()
  };
}