// src/hooksV11/use-thinking-state-diagnostics.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import thinkingStateDiagnostics from './thinking-state-diagnostics';

/**
 * Hook for monitoring thinking state diagnostics in React components
 * Provides warnings, suggestions, and actions for thinking state issues
 */
export function useThinkingStateDiagnostics(options: {
  autoStart?: boolean;
  showExtendedWarnings?: boolean;
  notificationThreshold?: 'extended' | 'prolonged' | 'critical';
} = {}) {
  const {
    autoStart = true,
    showExtendedWarnings = false,
    notificationThreshold = 'prolonged'
  } = options;
  
  // State for current diagnostic information
  const [diagnosticInfo, setDiagnosticInfo] = useState(() => thinkingStateDiagnostics.getCurrentDiagnostics());
  
  // State for warnings and recovery suggestions
  const [warnings, setWarnings] = useState<{
    warningLevel: 'none' | 'warning' | 'error' | 'critical';
    warningMessage: string | null;
    hasInconsistencies: boolean;
    suggestions: string[];
    actions: Array<{
      label: string;
      description: string;
      action: () => void;
    }>;
    lastUpdate: number;
  }>({
    warningLevel: 'none',
    warningMessage: null,
    hasInconsistencies: false,
    suggestions: [],
    actions: [],
    lastUpdate: Date.now()
  });
  
  // Keep track of diagnostic event log
  const [eventLog, setEventLog] = useState<Array<{
    timestamp: number;
    level: string;
    message: string;
    details: Record<string, unknown>;
  }>>([]);
  
  // Initialization state
  const initialized = useRef(false);
  
  // Function to update warnings and suggestions - defined before useEffect
  const updateWarningsAndSuggestions = useCallback(() => {
    const info = thinkingStateDiagnostics.getCurrentDiagnostics();
    const recovery = thinkingStateDiagnostics.getRecoverySuggestions();
    
    setWarnings({
      warningLevel: info.warningLevel,
      warningMessage: getWarningMessage(info.warningLevel, info.duration),
      hasInconsistencies: info.inconsistencies.length > 0,
      suggestions: recovery.suggestions,
      actions: recovery.actions,
      lastUpdate: Date.now()
    });
  }, []);
  
  // Set up monitoring and subscription on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    
    // Configure thresholds based on notification preference
    const thresholds: Record<string, number> = {};
    
    if (notificationThreshold === 'extended') {
      thresholds.extended = 5000;    // 5 seconds
      thresholds.prolonged = 15000;  // 15 seconds
      thresholds.critical = 30000;   // 30 seconds
    } else if (notificationThreshold === 'prolonged') {
      thresholds.extended = 10000;   // 10 seconds
      thresholds.prolonged = 20000;  // 20 seconds
      thresholds.critical = 45000;   // 45 seconds
    } else {
      thresholds.extended = 15000;   // 15 seconds
      thresholds.prolonged = 30000;  // 30 seconds
      thresholds.critical = 60000;   // 60 seconds
    }
    
    // Configure diagnostics
    thinkingStateDiagnostics.configureThresholds(thresholds);
    
    // Start monitoring if autoStart is true
    if (autoStart) {
      thinkingStateDiagnostics.startMonitoring();
    }
    
    // Set up periodic update of diagnostic info
    const updateInterval = setInterval(() => {
      const updated = thinkingStateDiagnostics.getCurrentDiagnostics();
      setDiagnosticInfo(updated);
      
      // Update warnings and suggestions if needed
      if (updated.warningLevel !== 'none' || updated.inconsistencies.length > 0) {
        updateWarningsAndSuggestions();
      }
    }, 1000);
    
    // Subscribe to diagnostic events
    const unsubscribe = thinkingStateDiagnostics.subscribe((level, message, data) => {
      // Only log warnings above the selected threshold
      if (
        (level === 'info' && !showExtendedWarnings) ||
        (level === 'warning' && notificationThreshold === 'critical') ||
        (level === 'error' && !['prolonged', 'critical'].includes(notificationThreshold))
      ) {
        return;
      }
      
      // Add to event log
      const now = Date.now();
      setEventLog(prev => [...prev, {
        timestamp: now,
        level,
        message,
        details: data
      }].slice(-20)); // Keep only last 20 events
      
      // Trigger warning update
      updateWarningsAndSuggestions();
    });
    
    // Clean up on unmount
    return () => {
      clearInterval(updateInterval);
      unsubscribe();
      
      // Don't stop monitoring as other components might be using it
      // thinkingStateDiagnostics.stopMonitoring();
    };
  }, [autoStart, showExtendedWarnings, notificationThreshold, updateWarningsAndSuggestions]);
  
  // Helper to generate warning message based on level and duration
  const getWarningMessage = (level: string, duration: number | null): string | null => {
    if (level === 'none' || !duration) return null;
    
    const seconds = Math.floor((duration || 0) / 1000);
    
    if (level === 'critical') {
      return `AI has been thinking for ${seconds}s (critical)`;
    } else if (level === 'error') {
      return `AI has been thinking for ${seconds}s (extended)`;
    } else if (level === 'warning') {
      return `AI has been thinking for ${seconds}s`;
    }
    
    return null;
  };
  
  // Function to manually start monitoring
  const startMonitoring = useCallback(() => {
    thinkingStateDiagnostics.startMonitoring();
  }, []);
  
  // Function to manually stop monitoring
  const stopMonitoring = useCallback(() => {
    thinkingStateDiagnostics.stopMonitoring();
  }, []);
  
  // Function to create a diagnostic snapshot
  const createSnapshot = useCallback((note: string = 'Manual snapshot') => {
    return thinkingStateDiagnostics.createSnapshot(note);
  }, []);
  
  // Function to export diagnostics data
  const exportDiagnostics = useCallback(() => {
    thinkingStateDiagnostics.exportDiagnostics();
  }, []);
  
  // Function to clear event log
  const clearEventLog = useCallback(() => {
    setEventLog([]);
  }, []);
  
  // Return all state and functions
  return {
    // Current state
    isThinking: diagnosticInfo.isThinking,
    thinkingDuration: diagnosticInfo.duration,
    formattedDuration: diagnosticInfo.formattedDuration,
    source: diagnosticInfo.source,
    inconsistencies: diagnosticInfo.inconsistencies,
    
    // Warning information
    warningLevel: warnings.warningLevel,
    warningMessage: warnings.warningMessage,
    hasInconsistencies: warnings.hasInconsistencies,
    
    // Recovery suggestions
    suggestions: warnings.suggestions,
    recoveryActions: warnings.actions,
    
    // Event log
    eventLog,
    
    // Actions
    startMonitoring,
    stopMonitoring,
    createSnapshot,
    exportDiagnostics,
    clearEventLog,
    
    // Raw access to diagnostics
    getDiagnosticReport: thinkingStateDiagnostics.getCurrentDiagnostics
  };
}

export default useThinkingStateDiagnostics;