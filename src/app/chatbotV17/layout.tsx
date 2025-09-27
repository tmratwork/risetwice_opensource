"use client";

import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { ChatStateProvider } from '@/contexts/chat-state-context';
import { ClientHeader } from '@/components/client-header';
import { MobileFooterNavV15 } from './components/MobileFooterNavV15';
import SearchProgressToast from './components/SearchProgressToast';
// V17 uses V16 CSS styles for identical appearance
import '../chatbotV16/chatbotV16.css';

// V17 background fix no longer needed - using direct Tailwind classes like V16

// V17 Anonymous support: Update userId in localStorage with Firebase resilience
function AuthUserIdSync() {
  const { user, loading, firebaseAvailable } = useAuth();

  useEffect(() => {
    if (user) {
      // Store authenticated user ID
      localStorage.setItem('userId', user.uid);
      if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
        console.log('[V17-AUTH] Set Firebase auth user ID:', user.uid);
      }
    } else if (!loading) {
      // Clear userId if not logged in or Firebase unavailable
      localStorage.removeItem('userId');
      if (!firebaseAvailable) {
        if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
          console.log('[V17-AUTH] Firebase unavailable - cleared userId, enabling anonymous mode');
        }
      } else {
        if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
          console.log('[V17-AUTH] No authenticated user, cleared userId');
        }
      }
    }
  }, [user, loading, firebaseAvailable]);

  return null;
}

// Component to initialize V17 Eleven Labs monitoring
function ElevenLabsMonitoringInit() {
  useEffect(() => {
    // Only run on client-side
    if (typeof window !== 'undefined') {
      // Log V17 initialization
      console.log('[V17-SYSTEM] page_loaded', {
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        url: window.location.href,
        version: 'v17',
        backend: 'eleven_labs'
      });

      // Set up global unhandled error monitoring
      window.addEventListener('error', (event) => {
        console.error('[V17-SYSTEM] unhandled_error', event.error || new Error(event.message), {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      });

      // Log successful V17 initialization
      console.log('[V17-SYSTEM] Eleven Labs chat interface initialized');
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
    console.log('[V17-USER] debug_panel_toggled', { showDebugPanel: newState });
    
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

// Define the layout component for chatbotV17
export default function ChatBotV17Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ChatStateProvider>
          <div className="v16-layout-root">
          <AuthUserIdSync />
          <ElevenLabsMonitoringInit />

          {/* Header Row */}
          <div className="header-row">
            <ClientHeader />
          </div>

          {/* Main Content Row */}
          <div className="main-content-row">
            {children}
          </div>

          {/* Footer Row */}
          <div className="footer-row">
            <MobileFooterNavWithDebug />
          </div>
        </div>
        
        {/* V17 Search Progress Toast */}
        <SearchProgressToast />
        
        {/* Move Toaster outside grid - positioned absolutely */}
        <Toaster position="top-center" />
        </ChatStateProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}