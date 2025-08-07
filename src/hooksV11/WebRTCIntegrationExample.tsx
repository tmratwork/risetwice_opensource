// src/hooksV11/WebRTCIntegrationExample.tsx

import React, { useEffect, useRef } from 'react';
import { initializeThinkingStateIntegration } from './thinking-state-integration';
import ThinkingStateIndicator from './ThinkingStateIndicator';

/**
 * Example component showing how to integrate thinking state monitoring
 * with an existing WebRTC implementation without modifying any code.
 * 
 * This component can wrap existing WebRTC UI components or be placed
 * alongside them.
 */
interface WebRTCIntegrationExampleProps {
  // The wrapped WebRTC component/content
  children: React.ReactNode;
  
  // Whether to show the thinking indicator
  showIndicator?: boolean;
  
  // Position of the thinking indicator
  indicatorPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'inline';
  
  // Style variant of the indicator
  indicatorVariant?: 'minimal' | 'badge' | 'pill' | 'text';
  
  // Whether to add diagnostic features
  enableDiagnostics?: boolean;
  
  // Whether to log diagnostics to console
  logDiagnostics?: boolean;
  
  // Custom warning thresholds in milliseconds
  thresholds?: {
    warning?: number;
    error?: number;
    critical?: number;
  };
  
  // Whether to show recovery suggestions
  showSuggestions?: boolean;
  
  // Optional callback when issues are detected
  onIssueDetected?: (level: string, message: string) => void;
}

export default function WebRTCIntegrationExample({
  children,
  showIndicator = true,
  indicatorPosition = 'bottom-right',
  indicatorVariant = 'pill',
  enableDiagnostics = true,
  logDiagnostics = false,
  thresholds = {
    warning: 10000, // 10 seconds
    error: 20000,   // 20 seconds
    critical: 45000 // 45 seconds
  },
  showSuggestions = true,
  onIssueDetected
}: WebRTCIntegrationExampleProps) {
  // Reference to the monitoring cleanup function
  const cleanupRef = useRef<(() => void) | null>(null);
  
  // Initialize monitoring on mount
  useEffect(() => {
    if (!enableDiagnostics) return;
    
    // Initialize monitoring
    const { cleanup, getDiagnostics } = initializeThinkingStateIntegration({
      thresholds,
      pollingInterval: 1000,
      logLevel: logDiagnostics ? 'info' : 'warning',
      interceptErrors: true,
      suppressFalsePositives: true,
      onDiagnosticSnapshot: (snapshotId, level) => {
        // Log to console if enabled
        if (logDiagnostics) {
          const diagnostics = getDiagnostics();
          console.log(`[ThinkingState] Created diagnostic snapshot: ${snapshotId}`, {
            level,
            diagnostics
          });
        }
        
        // Call onIssueDetected if provided
        if (onIssueDetected) {
          const state = getDiagnostics();
          const message = `AI thinking state issue detected (${level}): ${state.isThinking ? `thinking for ${state.formattedDuration}` : 'inconsistent state'}`;
          onIssueDetected(level, message);
        }
      }
    });
    
    // Store cleanup function
    cleanupRef.current = cleanup;
    
    // Cleanup on unmount (likely not needed but good practice)
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [enableDiagnostics, logDiagnostics, thresholds, onIssueDetected]);
  
  // Handle issue detection
  const handleIssueDetected = (level: string, duration: number) => {
    if (onIssueDetected) {
      const durationSec = Math.floor(duration / 1000);
      onIssueDetected(level, `AI has been thinking for ${durationSec}s (${level})`);
    }
  };
  
  return (
    <div className="relative">
      {/* Wrapped WebRTC content */}
      {children}
      
      {/* Only show indicator if enabled */}
      {showIndicator && enableDiagnostics && (
        <ThinkingStateIndicator
          position={indicatorPosition}
          variant={indicatorVariant}
          showWhenIdle={false}
          detailed={showSuggestions}
          showSuggestions={showSuggestions}
          onIssueDetected={handleIssueDetected}
        />
      )}
    </div>
  );
}

/**
 * Simple utility for initializing just the monitoring without UI elements
 */
export function initializeWebRTCMonitoring(options: {
  thresholds?: {
    warning?: number;
    error?: number; 
    critical?: number;
  };
  logDiagnostics?: boolean;
  onIssueDetected?: (level: string, message: string) => void;
} = {}): () => void {
  const { cleanup, getDiagnostics } = initializeThinkingStateIntegration({
    thresholds: options.thresholds || {
      warning: 10000,
      error: 20000,
      critical: 45000
    },
    logLevel: options.logDiagnostics ? 'info' : 'warning',
    onDiagnosticSnapshot: (snapshotId, level) => {
      if (options.onIssueDetected) {
        const state = getDiagnostics();
        const message = `AI thinking state issue detected (${level}): ${state.isThinking ? `thinking for ${state.formattedDuration}` : 'inconsistent state'}`;
        options.onIssueDetected(level, message);
      }
    }
  });
  
  return cleanup;
}