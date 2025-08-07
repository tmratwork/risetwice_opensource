"use client";

import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { ClientHeader } from '@/components/client-header';
import { MobileFooterNavV15 } from './components/MobileFooterNavV15';
import SearchProgressToast from './components/SearchProgressToast';
// Import V15 audio logger
import { audioLogger } from '@/hooksV15';
// Import V16 CSS styles
import './chatbotV15.css';

// V15 Anonymous support: Update userId in localStorage with Firebase resilience
function AuthUserIdSync() {
  const { user, loading, firebaseAvailable } = useAuth();

  useEffect(() => {
    if (user) {
      // Store authenticated user ID
      localStorage.setItem('userId', user.uid);
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.log('[V15-AUTH] Set Firebase auth user ID:', user.uid);
      }
    } else if (!loading) {
      // Clear userId if not logged in or Firebase unavailable
      localStorage.removeItem('userId');
      if (!firebaseAvailable) {
        if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
          console.log('[V15-AUTH] Firebase unavailable - cleared userId, enabling anonymous mode');
        }
      } else {
        if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
          console.log('[V15-AUTH] No authenticated user, cleared userId');
        }
      }
    }
  }, [user, loading, firebaseAvailable]);

  return null;
}

// Component to initialize V15 audio monitoring
function AudioMonitoringInit() {
  useEffect(() => {
    // Only run on client-side
    if (typeof window !== 'undefined') {
      // Log V15 initialization
      audioLogger.info('system', 'v15_page_loaded', {
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        url: window.location.href,
        version: 'v15'
      });

      // Set up global unhandled error monitoring
      window.addEventListener('error', (event) => {
        audioLogger.error('system', 'unhandled_error', event.error || new Error(event.message), {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      });

      // Log successful V15 initialization
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.log('[AudioLogger] [SYSTEM] V15 chat interface initialized');
      }
    }
  }, []);

  return null;
}

// Component to handle debug panel state and pass to MobileFooterNav
function MobileFooterNavWithDebug() {
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const toggleDebugPanel = () => {
    const newState = !showDebugPanel;
    setShowDebugPanel(newState);
    
    // Log debug panel toggle
    audioLogger.userAction('debug_panel_toggled', { showDebugPanel: newState });
    
    // Dispatch event for page component
    window.dispatchEvent(new CustomEvent('toggleDebugPanel', {
      detail: { showDebugPanel: newState }
    }));
  };

  return (
    <MobileFooterNavV15 
      onToggleDebugPanel={toggleDebugPanel}
    />
  );
}

// Define the layout component for chatbotV15
export default function ChatBotV16Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <div className="v11-layout-root">
          <AuthUserIdSync />
          <AudioMonitoringInit />

          {/* Header Row - Reuse V11 header */}
          <div className="header-row">
            <ClientHeader />
          </div>

          {/* Main Content Row */}
          <div className="main-content-row">
            {children}
          </div>

          {/* Footer Row - Reuse V11 footer but update paths */}
          <div className="footer-row">
            <MobileFooterNavWithDebug />
          </div>
        </div>
        
        {/* V15 Search Progress Toast */}
        <SearchProgressToast />
        
        {/* Move Toaster outside grid - positioned absolutely */}
        <Toaster position="top-center" />
      </ThemeProvider>
    </AuthProvider>
  );
}