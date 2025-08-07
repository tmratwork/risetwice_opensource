// src/hooksV11/use-enhanced-error-monitoring.ts

import { useState, useEffect, useCallback } from 'react';
import {
  initializeErrorMonitoring,
  getErrorHistory,
  getTimeoutEvents,
  getErrorFrequency,
  clearErrorHistory,
  createDiagnosticSnapshot,
  exportDiagnostics,
  getRecoverySuggestions,
  hasActiveErrors
} from './enhanced-error-monitoring';

interface UseEnhancedErrorMonitoringOptions {
  // Whether to initialize on mount
  autoInitialize?: boolean;
  
  // Error monitoring configuration
  config?: {
    // Error interception options
    suppressFalsePositives?: boolean;
    enhanceErrorMessages?: boolean;
    
    // Timeout thresholds (ms)
    timeoutWarningThreshold?: number;
    timeoutErrorThreshold?: number;
    timeoutCriticalThreshold?: number;
    
    // Polling interval (ms)
    pollingInterval?: number;
  };
  
  // Polling interval for UI updates (ms)
  uiUpdateInterval?: number;
  
  // Maximum number of errors to keep in state
  maxErrorsInState?: number;
  
  // Whether to show real-time error stats
  trackErrorStats?: boolean;
  
  // Whether to automatically clear errors periodically
  autoClearInterval?: number | null;
  
  // Error callback
  onErrorDetected?: (type: string, message: string) => void;
}

/**
 * Hook for using enhanced error monitoring in React components
 */
export function useEnhancedErrorMonitoring({
  autoInitialize = true,
  config = {},
  uiUpdateInterval = 3000,
  maxErrorsInState = 20,
  trackErrorStats = true,
  autoClearInterval = null,
  onErrorDetected
}: UseEnhancedErrorMonitoringOptions = {}) {
  // Error state
  const [errors, setErrors] = useState<Record<string, unknown>[]>([]);
  const [timeouts, setTimeouts] = useState<Record<string, unknown>[]>([]);
  const [errorStats, setErrorStats] = useState<Record<string, number>>({});
  
  // Aggregate counts
  const [errorCounts, setErrorCounts] = useState({
    total: 0,
    thinking: 0,
    webrtc: 0,
    api: 0,
    audio: 0,
    other: 0
  });
  
  // Recovery information
  const [recoverySuggestions, setRecoverySuggestions] = useState<{
    suggestions: string[];
    actions: Array<{
      label: string;
      description: string;
      action: () => void;
    }>;
  }>({ suggestions: [], actions: [] });
  
  // Initialize on mount if autoInitialize is true
  useEffect(() => {
    if (autoInitialize) {
      // Initialize error monitoring
      initializeErrorMonitoring({
        suppressFalsePositives: config.suppressFalsePositives !== false,
        enhanceErrorMessages: config.enhanceErrorMessages !== false,
        timeoutWarningThreshold: config.timeoutWarningThreshold || 10000,
        timeoutErrorThreshold: config.timeoutErrorThreshold || 20000,
        timeoutCriticalThreshold: config.timeoutCriticalThreshold || 45000,
        pollingInterval: config.pollingInterval || 1000,
        logToConsole: true,
        createDiagnosticSnapshots: true,
        emitCustomEvents: true,
        
        // Set up error callback
        onErrorDetected: onErrorDetected
      });
    }
    
    // Set up interval to update error state
    const intervalId = setInterval(() => {
      updateErrorState();
    }, uiUpdateInterval);
    
    // Set up auto-clear if enabled
    let clearIntervalId: number | null = null;
    if (autoClearInterval && autoClearInterval > 0) {
      clearIntervalId = window.setInterval(() => {
        clearErrorHistory();
      }, autoClearInterval);
    }
    
    // Clean up on unmount
    return () => {
      clearInterval(intervalId);
      if (clearIntervalId !== null) {
        clearInterval(clearIntervalId);
      }
    };
  }, [
    autoInitialize, 
    uiUpdateInterval,
    autoClearInterval,
    onErrorDetected,
    config.suppressFalsePositives,
    config.enhanceErrorMessages,
    config.timeoutWarningThreshold,
    config.timeoutErrorThreshold,
    config.timeoutCriticalThreshold,
    config.pollingInterval
  ]);
  
  // Update error state from monitoring system
  const updateErrorState = useCallback(() => {
    // Get errors and timeouts
    const errorHistory = getErrorHistory().slice(-maxErrorsInState);
    const timeoutHistory = getTimeoutEvents().slice(-maxErrorsInState);
    
    // Update state
    setErrors(errorHistory);
    setTimeouts(timeoutHistory);
    
    // Update error frequency if tracking stats
    if (trackErrorStats) {
      const frequency = getErrorFrequency();
      setErrorStats(frequency);
      
      // Calculate aggregated counts
      const counts = {
        total: errorHistory.length + timeoutHistory.length,
        thinking: 0,
        webrtc: 0,
        api: 0,
        audio: 0,
        other: 0
      };
      
      // Count by type
      errorHistory.forEach(error => {
        if (error.type === 'thinking_state') {
          counts.thinking++;
        } else if (error.type === 'webrtc_connection' || error.type === 'webrtc_data_channel') {
          counts.webrtc++;
        } else if (error.type === 'api_error') {
          counts.api++;
        } else if (error.type === 'audio_error') {
          counts.audio++;
        } else {
          counts.other++;
        }
      });
      
      // Add timeout counts to thinking
      counts.thinking += timeoutHistory.length;
      
      setErrorCounts(counts);
    }
    
    // Update recovery suggestions
    setRecoverySuggestions(getRecoverySuggestions());
  }, [maxErrorsInState, trackErrorStats]);
  
  // Create diagnostic snapshot
  const createSnapshot = useCallback((note: string = 'Manual snapshot') => {
    return createDiagnosticSnapshot(note);
  }, []);
  
  // Export diagnostics
  const exportAllDiagnostics = useCallback(() => {
    exportDiagnostics();
  }, []);
  
  // Clear error history
  const clearAllErrors = useCallback(() => {
    clearErrorHistory();
    updateErrorState();
  }, [updateErrorState]);
  
  // Check if there are active errors
  const checkForActiveErrors = useCallback(() => {
    return hasActiveErrors();
  }, []);
  
  // Return error state and monitoring functions
  return {
    // Error data
    errors,
    timeouts,
    errorStats,
    errorCounts,
    
    // Recovery information
    recoverySuggestions: recoverySuggestions.suggestions,
    recoveryActions: recoverySuggestions.actions,
    
    // Utility functions
    createSnapshot,
    exportDiagnostics: exportAllDiagnostics,
    clearErrors: clearAllErrors,
    checkForActiveErrors,
    
    // Refresh error state
    refreshErrorState: updateErrorState,
    
    // Helper functions
    hasErrors: errors.length > 0 || timeouts.length > 0,
    hasThinkingErrors: errorCounts.thinking > 0,
    hasWebRTCErrors: errorCounts.webrtc > 0
  };
}

export default useEnhancedErrorMonitoring;