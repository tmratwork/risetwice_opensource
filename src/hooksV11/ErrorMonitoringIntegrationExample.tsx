// src/hooksV11/ErrorMonitoringIntegrationExample.tsx

import React, { useEffect, useState } from 'react';
import { useEnhancedErrorMonitoring } from './use-enhanced-error-monitoring';
import ThinkingStateErrorDisplay from './ThinkingStateErrorDisplay';

interface ErrorMonitoringIntegrationExampleProps {
  // Whether to show the error display initially
  showErrorDisplay?: boolean;
  
  // Whether to show in minimal mode
  minimalMode?: boolean;
  
  // Position of the error display
  position?: 'top' | 'bottom' | 'right' | 'left';
  
  // Custom error thresholds (ms)
  thresholds?: {
    warning?: number;
    error?: number;
    critical?: number;
  };
  
  // Custom error handler
  onErrorDetected?: (type: string, message: string) => void;
  
  // Whether to suppress false positives
  suppressFalsePositives?: boolean;
  
  // Children components to wrap
  children: React.ReactNode;
}

/**
 * Component for integrating enhanced error monitoring
 */
export default function ErrorMonitoringIntegrationExample({
  showErrorDisplay = true,
  minimalMode = false,
  position = 'bottom',
  thresholds = {
    warning: 10000,   // 10 seconds
    error: 20000,     // 20 seconds
    critical: 45000   // 45 seconds
  },
  onErrorDetected,
  suppressFalsePositives = true,
  children
}: ErrorMonitoringIntegrationExampleProps) {
  // Use enhanced error monitoring hook
  const {
    // Unused variables commented out to fix TS errors
    // errors,
    // timeouts,
    errorCounts,
    // recoverySuggestions,
    // recoveryActions,
    createSnapshot,
    // exportDiagnostics,
    // clearErrors,
    hasErrors
  } = useEnhancedErrorMonitoring({
    autoInitialize: true,
    config: {
      suppressFalsePositives,
      enhanceErrorMessages: true,
      timeoutWarningThreshold: thresholds.warning,
      timeoutErrorThreshold: thresholds.error,
      timeoutCriticalThreshold: thresholds.critical,
      pollingInterval: 1000
    },
    uiUpdateInterval: 2000,
    maxErrorsInState: 50,
    trackErrorStats: true,
    autoClearInterval: null,
    onErrorDetected
  });
  
  // State for error display
  const [showDisplay, setShowDisplay] = useState(showErrorDisplay);
  
  // Auto-show error display when errors are detected
  useEffect(() => {
    if (hasErrors && !showDisplay) {
      setShowDisplay(true);
    }
  }, [hasErrors, showDisplay]);
  
  // Handle recovery action
  const handleRecoveryAction = (action: string, errorType: string) => {
    console.log(`[ErrorMonitoring] Recovery action triggered: ${action} for ${errorType}`);
    if (action === 'Refresh Page') {
      // Create snapshot before refresh
      createSnapshot('Pre-refresh snapshot');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  };
  
  return (
    <>
      {/* Wrapped content */}
      <div className="relative">
        {children}
        
        {/* Error count badge (always visible if there are errors) */}
        {!showDisplay && hasErrors && (
          <div 
            className="fixed bottom-2 right-2 z-50 bg-red-500 text-white font-bold rounded-full w-6 h-6 flex items-center justify-center cursor-pointer"
            onClick={() => setShowDisplay(true)}
          >
            {errorCounts.total}
          </div>
        )}
        
        {/* Toggle button (only in non-minimal mode) */}
        {!minimalMode && (
          <div className="fixed bottom-2 left-2 z-50">
            <button
              onClick={() => setShowDisplay(!showDisplay)}
              className="px-2 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600"
            >
              {showDisplay ? 'Hide Errors' : 'Show Errors'}
            </button>
          </div>
        )}
      </div>
      
      {/* Error display */}
      {showDisplay && showErrorDisplay && (
        <ThinkingStateErrorDisplay
          initiallyExpanded={!minimalMode}
          autoShowOnErrors={true}
          position={position}
          showBadge={true}
          includeTimeouts={true}
          maxErrors={20}
          autoClear={false}
          onRecoveryAction={handleRecoveryAction}
        />
      )}
      
      {/* Global error handler for API and fallback errors */}
      <ErrorEventHandler
        onError={(error) => {
          console.error('[ErrorMonitoring] Caught unhandled error:', error);
          createSnapshot(`Unhandled error: ${error.message}`);
          if (onErrorDetected) {
            onErrorDetected('unhandled', error.message);
          }
        }}
      />
    </>
  );
}

/**
 * Helper component to catch global errors
 */
function ErrorEventHandler({ onError }: { onError: (error: Error) => void }) {
  useEffect(() => {
    // Set up global error handler
    const handleGlobalError = (event: ErrorEvent) => {
      event.preventDefault();
      onError(event.error || new Error(event.message));
    };
    
    // Set up unhandled rejection handler
    const handleRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason));
      onError(error);
    };
    
    // Add listeners
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleRejection);
    
    // Clean up
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [onError]);
  
  return null;
}

/**
 * Export a function for easy initialization in any component
 */
export function initializeErrorMonitoring({
  thresholds = {
    warning: 10000,   // 10 seconds
    error: 20000,     // 20 seconds
    critical: 45000   // 45 seconds
  },
  suppressFalsePositives = true,
  onErrorDetected
}: {
  thresholds?: {
    warning?: number;
    error?: number;
    critical?: number;
  };
  suppressFalsePositives?: boolean;
  onErrorDetected?: (type: string, message: string) => void;
}) {
  // Import and initialize directly to avoid using React hooks outside components
  import('./enhanced-error-monitoring').then(module => {
    module.initializeErrorMonitoring({
      suppressFalsePositives,
      enhanceErrorMessages: true,
      timeoutWarningThreshold: thresholds.warning,
      timeoutErrorThreshold: thresholds.error,
      timeoutCriticalThreshold: thresholds.critical,
      pollingInterval: 1000,
      logToConsole: true,
      createDiagnosticSnapshots: true,
      onErrorDetected: (type, message) => {
        onErrorDetected?.(type, message);
      }
    });
    
    console.log('[ErrorMonitoring] Initialized enhanced error monitoring');
  });
}