"use client";

import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { ClientHeader } from '@/components/client-header';
import ThinkingStateMonitoringInit from '@/components/ThinkingStateMonitoringInit';
import { MobileFooterNav } from '@/components/mobile-footer-nav';
// Use only the audioLogger for logging
import { audioLogger } from '@/hooksV11';

// Simple function to update userId in localStorage
function AuthUserIdSync() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user) {
      // Store authenticated user ID
      localStorage.setItem('userId', user.uid);
      console.log('Set Firebase auth user ID:', user.uid);
    } else if (!loading) {
      // Clear userId if not logged in
      localStorage.removeItem('userId');
      console.log('No authenticated user, cleared userId');
    }
  }, [user, loading]);

  return null;
}

// Component to initialize basic audio logging
function AudioMonitoringInit() {
  useEffect(() => {
    // Only run on client-side
    if (typeof window !== 'undefined') {
      // Log browser and environment details
      console.log('[AUDIO-DIAGNOSTICS] Browser:', navigator.userAgent);
      console.log('[AUDIO-DIAGNOSTICS] Page loaded at:', new Date().toISOString());

      // Log system info using audioLogger
      audioLogger.logUserInteraction('page-load', {
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        url: window.location.href
      });

      // Set up global unhandled error monitoring
      window.addEventListener('error', (event) => {
        console.error('[AUDIO-DIAGNOSTICS] Unhandled error:', event.error);

        // Log to audioLogger
        audioLogger.logError('unhandled-error', event.message, {
          componentName: event.filename || 'unknown',
          stack: event.error?.stack,
          context: {
            lineno: event.lineno,
            colno: event.colno
          }
        });
      });

      // Check for and remove any diagnostic buttons immediately and set up observer
      const removeAudioDiagnosticElements = () => {
        // Find buttons by id, attribute, or text content
        const buttons = Array.from(document.querySelectorAll('button')).filter(btn =>
          btn.id === 'audio-debug-button' ||
          btn.getAttribute('data-audio-diagnostic') !== null ||
          btn.textContent?.includes('Audio Diagnostics')
        );

        // Find any diagnostic panels
        const panels = Array.from(document.querySelectorAll('div')).filter(div =>
          div.id === 'audio-diagnostics-panel' ||
          div.className?.includes('audio-diagnostics')
        );

        // Remove elements
        [...buttons, ...panels].forEach(el => {
          console.log('[AUDIO-DIAGNOSTICS] Removing element:', el);
          el.remove();
        });

        return buttons.length + panels.length;
      };

      // Run immediately
      const removedCount = removeAudioDiagnosticElements();
      console.log(`[AUDIO-DIAGNOSTICS] Removed ${removedCount} audio diagnostic elements on initial scan`);

      // Set up mutation observer to catch dynamically added elements
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // Check if any of the added nodes are diagnostic elements or contain them
            let hasRelevantNodes = false;

            mutation.addedNodes.forEach(node => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as Element;

                // Check for diagnostic button
                if (element.tagName === 'BUTTON' &&
                  (element.id === 'audio-debug-button' ||
                    element.getAttribute('data-audio-diagnostic') !== null ||
                    element.textContent?.includes('Audio Diagnostics'))) {
                  hasRelevantNodes = true;
                }

                // Check for diagnostic panel
                if (element.id === 'audio-diagnostics-panel' ||
                  (typeof element.className === 'string' && element.className.includes('audio-diagnostics')) ||
                  (element.classList && element.classList.contains('audio-diagnostics'))) {
                  hasRelevantNodes = true;
                }

                // Check children recursively
                if (element.querySelectorAll) {
                  const buttons = element.querySelectorAll('button');
                  for (let i = 0; i < buttons.length; i++) {
                    const btn = buttons[i];
                    if (btn.id === 'audio-debug-button' ||
                      btn.getAttribute('data-audio-diagnostic') !== null ||
                      btn.textContent?.includes('Audio Diagnostics')) {
                      hasRelevantNodes = true;
                      break;
                    }
                  }
                }
              }
            });

            // If relevant nodes were added, run removal
            if (hasRelevantNodes) {
              setTimeout(() => {
                const count = removeAudioDiagnosticElements();
                if (count > 0) {
                  console.log(`[AUDIO-DIAGNOSTICS] Removed ${count} dynamically added diagnostic elements`);
                }
              }, 0);
            }
          }
        });
      });

      // Start observing with a slight delay to ensure DOM is ready
      setTimeout(() => {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        console.log('[AUDIO-DIAGNOSTICS] Installed observer to prevent diagnostic UI elements');
      }, 500);
    }
  }, []);

  return null;
}

// Component to handle debug panel state and pass to MobileFooterNav
function MobileFooterNavWithDebug() {
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const toggleDebugPanel = () => {
    setShowDebugPanel(!showDebugPanel);
    
    // Also dispatch a custom event that the page component can listen to
    window.dispatchEvent(new CustomEvent('toggleDebugPanel', {
      detail: { showDebugPanel: !showDebugPanel }
    }));
  };

  return (
    <MobileFooterNav 
      onToggleDebugPanel={toggleDebugPanel}
      showDebugPanel={showDebugPanel}
    />
  );
}

// Define the layout component for chatbotV11
export default function ChatBotV11Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="v11-layout-root">
        <AuthUserIdSync />
        <AudioMonitoringInit />
        <ThinkingStateMonitoringInit />

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

      {/* Move Toaster outside grid - positioned absolutely */}
      <Toaster position="top-center" />
    </AuthProvider>
  );
}