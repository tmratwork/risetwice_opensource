// src/hooksV11/use-thinking-state-integration.ts

/**
 * Thinking State Integration Hook
 * 
 * This hook provides a minimal integration point for monitoring thinking state
 * in existing components without modifying the WebRTC implementation.
 * 
 * It uses a non-invasive approach to:
 * 1. Monitor thinking state from existing sources
 * 2. Detect and report issues
 * 3. Provide minimal UI indicators
 * 4. Handle automatic diagnostics on issues
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import thinkingStateObserver from './thinking-state-observer';
import thinkingStateDiagnostics from './thinking-state-diagnostics';
import { initializeThinkingStateMonitor } from './thinking-state-monitor';

// Default threshold values
const DEFAULT_THRESHOLDS = {
  warning: 10000,   // 10 seconds
  error: 20000,     // 20 seconds
  critical: 45000,  // 45 seconds
};

// Interface for hook options
interface UseThinkingStateIntegrationOptions {
  // Whether to automatically start monitoring
  autoStart?: boolean;
  
  // Custom warning thresholds in milliseconds
  thresholds?: {
    warning?: number;
    error?: number;
    critical?: number;
  };
  
  // Whether to automatically track diagnostic data
  trackDiagnostics?: boolean;
  
  // Whether to only report thinking state (no warnings)
  quietMode?: boolean;
  
  // Callback when an issue is detected
  onIssueDetected?: (issueType: string, duration: number, diagnosticId: string) => void;
}

/**
 * Hook for integrating thinking state monitoring into existing components
 */
export function useThinkingStateIntegration(options: UseThinkingStateIntegrationOptions = {}) {
  const {
    autoStart = true,
    thresholds = DEFAULT_THRESHOLDS,
    trackDiagnostics = true,
    quietMode = false,
    onIssueDetected
  } = options;
  
  // Merge thresholds with defaults
  const mergedThresholds = {
    warning: thresholds.warning || DEFAULT_THRESHOLDS.warning,
    error: thresholds.error || DEFAULT_THRESHOLDS.error,
    critical: thresholds.critical || DEFAULT_THRESHOLDS.critical,
  };
  
  // Store initialization state
  const isInitialized = useRef(false);
  
  // State for thinking status
  const [thinkingState, setThinkingState] = useState<{
    isThinking: boolean;
    duration: number | null;
    formattedDuration: string;
    lastUpdate: number;
  }>({
    isThinking: false,
    duration: null,
    formattedDuration: '0s',
    lastUpdate: Date.now()
  });
  
  // State for issue detection
  const [issue, setIssue] = useState<{
    detected: boolean;
    level: 'warning' | 'error' | 'critical' | null;
    message: string | null;
    diagnosticId: string | null;
    timestamp: number | null;
  }>({
    detected: false,
    level: null,
    message: null,
    diagnosticId: null,
    timestamp: null
  });
  
  // Format durations for display
  const formatDuration = useCallback((ms: number | null): string => {
    if (ms === null) return '0s';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }, []);
  
  // Initialize monitoring on mount
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;
    
    // Initialize global monitoring if it hasn't been done already
    if (typeof window !== 'undefined' && !(window as Window & typeof globalThis & { __thinkingStateMonitor?: unknown }).__thinkingStateMonitor) {
      initializeThinkingStateMonitor({
        pollingInterval: 1000,
        warningThresholds: {
          extended: mergedThresholds.warning,
          prolonged: mergedThresholds.error,
          critical: mergedThresholds.critical,
        },
        interceptErrors: true,
        suppressFalsePositives: true,
        enhanceErrorMessages: true,
      });
    }
    
    // Start observer
    if (autoStart) {
      thinkingStateObserver.startObserving();
      if (trackDiagnostics) {
        thinkingStateDiagnostics.startMonitoring();
      }
    }
    
    return () => {
      // Don't stop observing on unmount, as other components may still be using it
    };
  }, [autoStart, trackDiagnostics, mergedThresholds.warning, mergedThresholds.error, mergedThresholds.critical]);
  
  // Subscribe to thinking state changes
  useEffect(() => {
    // Set up periodic state check
    const intervalId = setInterval(() => {
      const state = thinkingStateObserver.getConsolidatedState();
      const duration = state.duration || 0;
      
      // Update thinking state
      setThinkingState({
        isThinking: state.isThinking,
        duration: duration,
        formattedDuration: formatDuration(duration),
        lastUpdate: Date.now()
      });
      
      // Check for issues (if not in quiet mode)
      if (!quietMode && state.isThinking) {
        // Determine issue level based on duration
        let issueLevel: 'warning' | 'error' | 'critical' | null = null;
        
        if (duration >= mergedThresholds.critical) {
          issueLevel = 'critical';
        } else if (duration >= mergedThresholds.error) {
          issueLevel = 'error';
        } else if (duration >= mergedThresholds.warning) {
          issueLevel = 'warning';
        }
        
        // Update issue state if level has changed
        if (issueLevel !== issue.level) {
          // Only create diagnostic snapshots for error and critical levels
          let diagnosticId: string | null = null;
          
          if (issueLevel === 'error' || issueLevel === 'critical') {
            diagnosticId = thinkingStateDiagnostics.createSnapshot(
              `Thinking duration threshold exceeded: ${issueLevel}`
            );
          }
          
          // Get appropriate message
          const message = issueLevel 
            ? `AI has been thinking for ${formatDuration(duration)} (${issueLevel})`
            : null;
          
          // Update issue state
          setIssue({
            detected: !!issueLevel,
            level: issueLevel,
            message,
            diagnosticId,
            timestamp: issueLevel ? Date.now() : null
          });
          
          // Trigger callback if provided
          if (issueLevel && onIssueDetected) {
            onIssueDetected(
              issueLevel, 
              duration, 
              diagnosticId || 'no-diagnostic-id'
            );
          }
        }
      } else if (issue.detected && !state.isThinking) {
        // Clear issue if thinking has stopped
        setIssue({
          detected: false,
          level: null,
          message: null,
          diagnosticId: null,
          timestamp: null
        });
      }
    }, 1000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [
    formatDuration, 
    quietMode, 
    issue.level, 
    issue.detected,
    mergedThresholds.warning, 
    mergedThresholds.error, 
    mergedThresholds.critical, 
    onIssueDetected
  ]);
  
  /**
   * Export diagnostic data
   */
  const exportDiagnostics = useCallback(() => {
    if (trackDiagnostics) {
      thinkingStateDiagnostics.exportDiagnostics();
    }
  }, [trackDiagnostics]);
  
  /**
   * Create a diagnostic snapshot with a custom note
   */
  const createSnapshot = useCallback((note: string = 'Manual snapshot') => {
    if (trackDiagnostics) {
      return thinkingStateDiagnostics.createSnapshot(note);
    }
    return null;
  }, [trackDiagnostics]);
  
  /**
   * Get detailed diagnostics report
   */
  const getDiagnosticsReport = useCallback(() => {
    if (trackDiagnostics) {
      return thinkingStateDiagnostics.getCurrentDiagnostics();
    }
    return null;
  }, [trackDiagnostics]);
  
  /**
   * Get recovery suggestions
   */
  const getRecoverySuggestions = useCallback(() => {
    if (trackDiagnostics) {
      return thinkingStateDiagnostics.getRecoverySuggestions();
    }
    return {
      suggestions: [],
      actions: [],
      diagnosticId: 'no-diagnostics'
    };
  }, [trackDiagnostics]);
  
  // Return minimal interface focused on thinking state and issues
  return {
    // Basic thinking state
    isThinking: thinkingState.isThinking,
    thinkingDuration: thinkingState.duration,
    formattedDuration: thinkingState.formattedDuration,
    
    // Issue information
    hasIssue: issue.detected,
    issueLevel: issue.level,
    issueMessage: issue.message,
    
    // Helper flags for UI
    isWarning: issue.level === 'warning',
    isError: issue.level === 'error',
    isCritical: issue.level === 'critical',
    
    // Diagnostic functions (if tracking is enabled)
    createSnapshot,
    exportDiagnostics,
    getDiagnosticsReport,
    getRecoverySuggestions
  };
}

export default useThinkingStateIntegration;