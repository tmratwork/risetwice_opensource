/**
 * Anonymous User ID Management
 * Generates and persists anonymous user identifiers for usage tracking
 */

// Cookie helpers
function setCookie(name: string, value: string, days: number) {
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
}

function getCookie(name: string): string | null {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

/**
 * Get or create anonymous user ID
 * Tries multiple storage methods for maximum persistence
 */
export function getAnonymousUserId(): string {
  // Try to get existing ID from multiple sources
  let id = null;
  
  if (typeof window !== 'undefined') {
    id = localStorage.getItem('anonymous_user_id') || 
         sessionStorage.getItem('anonymous_user_id') ||
         getCookie('anonymous_user_id');
  }
  
  // Helper function for logging
  const logUsageTracking = (message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_USAGE_TRACKING_LOGS === 'true') {
      console.log(`[usage_tracking] ${message}`, ...args);
    }
  };
  
  logUsageTracking('Anonymous ID lookup result:', { found: !!id, id });
  
  // Generate new ID if none found
  if (!id) {
    id = crypto.randomUUID();
    logUsageTracking('Generated new anonymous ID:', id);
    
    // Store in multiple places for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('anonymous_user_id', id);
      sessionStorage.setItem('anonymous_user_id', id);
      setCookie('anonymous_user_id', id, 365); // 1 year expiry
      logUsageTracking('Stored new anonymous ID in all storage locations');
    }
  }
  
  return id;
}

/**
 * Check if user is anonymous (not signed in with Firebase)
 */
export function isAnonymousUser(firebaseUser: { uid?: string } | null): boolean {
  return !firebaseUser || !firebaseUser.uid;
}

/**
 * Get user identifier for tracking (Firebase UID or anonymous ID)
 */
export function getUserIdentifier(firebaseUser: { uid?: string } | null): {
  userId: string | null;
  anonymousId: string | null;
} {
  // Helper function for logging
  const logUsageTracking = (message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_USAGE_TRACKING_LOGS === 'true') {
      console.log(`[usage_tracking] ${message}`, ...args);
    }
  };
  
  logUsageTracking('getUserIdentifier called', { 
    hasFirebaseUser: !!firebaseUser, 
    firebaseUid: firebaseUser?.uid 
  });
  
  if (isAnonymousUser(firebaseUser)) {
    const anonymousId = getAnonymousUserId();
    logUsageTracking('User identified as anonymous', { userId: null, anonymousId });
    return {
      userId: null,
      anonymousId: anonymousId
    };
  }
  
  logUsageTracking('User identified as authenticated', { userId: firebaseUser!.uid, anonymousId: null });
  return {
    userId: firebaseUser!.uid || null,
    anonymousId: null
  };
}