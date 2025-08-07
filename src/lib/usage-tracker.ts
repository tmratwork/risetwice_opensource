/**
 * Usage Tracking Service
 * Handles session and event tracking for both authenticated and anonymous users
 */

import { getUserIdentifier } from './anonymous-user';

interface TrackingEvent {
  eventType: string;
  eventData?: Record<string, string | number | boolean | null>;
  pagePath?: string;
}

interface SessionData {
  sessionId: string | null;
  startTime: number;
  pageViews: number;
  userId: string | null;
  anonymousId: string | null;
}

class UsageTracker {
  private sessionData: SessionData = {
    sessionId: null,
    startTime: Date.now(),
    pageViews: 0,
    userId: null,
    anonymousId: null
  };

  private isInitialized = false;

  /**
   * Force end current session (useful for cleanup)
   */
  async forceEndSession(): Promise<void> {
    const logUsageTracking = (message: string, ...args: unknown[]) => {
      if (process.env.NEXT_PUBLIC_ENABLE_USAGE_TRACKING_LOGS === 'true') {
        console.log(`[usage_tracking] ${message}`, ...args);
      }
    };

    if (this.sessionData.sessionId) {
      logUsageTracking('🔧 Force ending current session for cleanup', {
        sessionId: this.sessionData.sessionId,
        currentPageViews: this.sessionData.pageViews
      });
      await this.endSession();
    } else {
      logUsageTracking('No active session to force end');
    }
  }

  /**
   * Initialize tracking session
   */
  async initialize(firebaseUser: { uid?: string } | null): Promise<void> {
    // Helper function for logging
    const logUsageTracking = (message: string, ...args: unknown[]) => {
      if (process.env.NEXT_PUBLIC_ENABLE_USAGE_TRACKING_LOGS === 'true') {
        console.log(`[usage_tracking] ${message}`, ...args);
      }
    };

    const { userId, anonymousId } = getUserIdentifier(firebaseUser);
    
    logUsageTracking('Initialize called', { 
      userId, 
      anonymousId, 
      isInitialized: this.isInitialized,
      currentSessionId: this.sessionData.sessionId 
    });
    
    // Check if we need to reinitialize for a different user
    if (this.isInitialized && 
        this.sessionData.userId === userId && 
        this.sessionData.anonymousId === anonymousId) {
      logUsageTracking('Already initialized for same user, skipping');
      return;
    }
    
    // If user changed, end the current session first
    if (this.isInitialized && this.sessionData.sessionId) {
      logUsageTracking('User changed, ending current session');
      await this.endSession();
    }
    
    try {
      logUsageTracking('Starting new session...');
      const response = await fetch('/api/usage/start-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          anonymousId,
          userAgent: navigator.userAgent,
          referrer: document.referrer,
          timestamp: new Date().toISOString()
        }),
      });

      if (response.ok) {
        const data = await response.json();
        logUsageTracking('✅ Session started successfully', { sessionId: data.sessionId });
        this.sessionData.sessionId = data.sessionId;
        this.sessionData.userId = userId;
        this.sessionData.anonymousId = anonymousId;
        this.sessionData.startTime = Date.now();
        this.sessionData.pageViews = 0;
        this.isInitialized = true;
      } else {
        logUsageTracking('❌ Failed to initialize usage tracking', { 
          status: response.status, 
          statusText: response.statusText 
        });
      }
    } catch (error) {
      logUsageTracking('❌ Failed to initialize usage tracking', { error });
    }
  }

  /**
   * Track a page view
   */
  async trackPageView(path: string, firebaseUser: { uid?: string } | null): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize(firebaseUser);
    }

    if (!this.sessionData.sessionId) return;

    this.sessionData.pageViews++;

    try {
      await this.trackEvent({
        eventType: 'page_view',
        pagePath: path,
        eventData: {
          timestamp: new Date().toISOString(),
          sessionPageViews: this.sessionData.pageViews
        }
      });
    } catch (error) {
      console.error('Failed to track page view:', error);
    }
  }

  /**
   * Track a custom event
   */
  async trackEvent(event: TrackingEvent): Promise<void> {
    // Helper function for logging
    const logUsageTracking = (message: string, ...args: unknown[]) => {
      if (process.env.NEXT_PUBLIC_ENABLE_USAGE_TRACKING_LOGS === 'true') {
        console.log(`[usage_tracking] ${message}`, ...args);
      }
    };

    if (!this.sessionData.sessionId) {
      logUsageTracking('❌ trackEvent called but no session ID exists', {
        eventType: event.eventType,
        pagePath: event.pagePath
      });
      return;
    }

    logUsageTracking('📝 Tracking event', {
      sessionId: this.sessionData.sessionId,
      eventType: event.eventType,
      pagePath: event.pagePath,
      hasEventData: !!event.eventData
    });

    try {
      const response = await fetch('/api/usage/track-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionData.sessionId,
          eventType: event.eventType,
          eventData: event.eventData,
          pagePath: event.pagePath,
          timestamp: new Date().toISOString()
        }),
      });

      if (response.ok) {
        logUsageTracking('✅ Event tracked successfully', {
          eventType: event.eventType,
          pagePath: event.pagePath
        });
      } else {
        logUsageTracking('❌ Event tracking failed', {
          eventType: event.eventType,
          status: response.status,
          statusText: response.statusText
        });
      }
    } catch (error) {
      logUsageTracking('❌ Event tracking error', {
        eventType: event.eventType,
        error: error instanceof Error ? error.message : String(error)
      });
      console.error('Failed to track event:', error);
    }
  }

  /**
   * End the current session
   */
  async endSession(): Promise<void> {
    // Helper function for logging
    const logUsageTracking = (message: string, ...args: unknown[]) => {
      if (process.env.NEXT_PUBLIC_ENABLE_USAGE_TRACKING_LOGS === 'true') {
        console.log(`[usage_tracking] ${message}`, ...args);
      }
    };

    if (!this.sessionData.sessionId) {
      logUsageTracking('endSession called but no session ID exists');
      return;
    }

    const sessionDuration = Date.now() - this.sessionData.startTime;
    const payload = JSON.stringify({
      sessionId: this.sessionData.sessionId,
      pageViews: this.sessionData.pageViews,
      sessionDuration: sessionDuration,
      timestamp: new Date().toISOString()
    });

    logUsageTracking('🛑 Ending session', {
      sessionId: this.sessionData.sessionId,
      pageViews: this.sessionData.pageViews,
      sessionDuration: `${Math.round(sessionDuration / 1000)}s`,
      payloadSize: payload.length
    });

    // Use sendBeacon for reliability during page unload
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      logUsageTracking('Attempting to end session with sendBeacon');
      const blob = new Blob([payload], { type: 'application/json' });
      const sent = navigator.sendBeacon('/api/usage/end-session', blob);
      
      if (sent) {
        logUsageTracking('✅ Session ended successfully via sendBeacon');
      } else {
        logUsageTracking('❌ sendBeacon failed, falling back to fetch');
        // Fallback to fetch if sendBeacon fails (e.g., payload too large)
        try {
          const response = await fetch('/api/usage/end-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: payload,
            keepalive: true // Helps with reliability during unload
          });
          
          if (response.ok) {
            logUsageTracking('✅ Session ended successfully via fetch fallback');
          } else {
            logUsageTracking('❌ Fetch fallback failed', {
              status: response.status,
              statusText: response.statusText
            });
          }
        } catch (error) {
          logUsageTracking('❌ Fetch fallback error', {
            error: error instanceof Error ? error.message : String(error),
            name: error instanceof Error ? error.name : 'unknown'
          });
          // Don't silently ignore all errors - only AbortError during unload
          if (!error || (error as Error).name !== 'AbortError') {
            console.error('Failed to end session:', error);
          }
        }
      }
    } else {
      logUsageTracking('Using fetch for session end (no sendBeacon support)');
      // Fallback for browsers without sendBeacon support
      try {
        const response = await fetch('/api/usage/end-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: payload,
          keepalive: true
        });
        
        if (response.ok) {
          logUsageTracking('✅ Session ended successfully via fetch');
        } else {
          logUsageTracking('❌ Fetch failed', {
            status: response.status,
            statusText: response.statusText
          });
        }
      } catch (error) {
        logUsageTracking('❌ Fetch error', {
          error: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'unknown'
        });
        // Don't silently ignore all errors - only AbortError during unload
        if (!error || (error as Error).name !== 'AbortError') {
          console.error('Failed to end session:', error);
        }
      }
    }

    // Reset session state
    logUsageTracking('🔄 Resetting session state');
    this.sessionData.sessionId = null;
    this.sessionData.userId = null;
    this.sessionData.anonymousId = null;
    this.sessionData.pageViews = 0;
    this.isInitialized = false;
  }

  /**
   * Get current session info
   */
  getSessionInfo(): SessionData {
    return { ...this.sessionData };
  }
}

// Export singleton instance
export const usageTracker = new UsageTracker();

// Convenience functions
export const trackPageView = (path: string, firebaseUser: { uid?: string } | null) => 
  usageTracker.trackPageView(path, firebaseUser);

export const trackEvent = (event: TrackingEvent) => 
  usageTracker.trackEvent(event);

export const initializeTracking = (firebaseUser: { uid?: string } | null) => 
  usageTracker.initialize(firebaseUser);

export const endSession = () => 
  usageTracker.endSession();

export const forceEndSession = () =>
  usageTracker.forceEndSession();