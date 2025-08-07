// src/hooksV11/use-thinking-state-monitor.ts

import { useState, useEffect, useRef } from 'react';
import thinkingStateObserver from './thinking-state-observer';

/**
 * Hook for monitoring thinking state in React components
 * This is a non-invasive hook that only observes existing state
 * without modifying WebRTC functionality.
 */
export function useThinkingStateMonitor(options: {
  autoStart?: boolean;
  pollingInterval?: number;
  logInconsistencies?: boolean;
} = {}) {
  const {
    autoStart = true,
    pollingInterval = 1000,
    logInconsistencies = false
  } = options;
  
  // State to track current thinking status
  const [thinkingState, setThinkingState] = useState<{
    isThinking: boolean;
    duration: number | null;
    startTime: number | null;
    source: string | null;
    inconsistencies: string[];
  }>({
    isThinking: false,
    duration: null,
    startTime: null,
    source: null,
    inconsistencies: []
  });
  
  // Tracking last update time for calculating our own duration
  const lastUpdateRef = useRef<number>(Date.now());
  
  // Configure and start the observer
  useEffect(() => {
    // Configure observer
    thinkingStateObserver.configure({
      pollingInterval,
      logLevel: logInconsistencies ? 'warning' : 'error'
    });
    
    // Start observing if autoStart is true
    if (autoStart) {
      thinkingStateObserver.startObserving();
    }
    
    // Subscribe to state changes
    const unsubscribe = thinkingStateObserver.subscribe((snapshot) => {
      const consolidated = thinkingStateObserver.getConsolidatedState();
      lastUpdateRef.current = Date.now();
      
      setThinkingState({
        isThinking: consolidated.isThinking,
        duration: consolidated.duration,
        startTime: consolidated.startTime,
        source: consolidated.source,
        inconsistencies: snapshot.inconsistencies
      });
      
      // Log inconsistencies if option is enabled
      if (logInconsistencies && snapshot.inconsistencies.length > 0) {
        console.warn(
          '[useThinkingStateMonitor] Inconsistencies detected:',
          snapshot.inconsistencies,
          snapshot
        );
      }
    });
    
    // Clean up subscription on unmount
    return () => {
      unsubscribe();
      
      // Don't stop observing as other components might be using it
      // thinkingStateObserver.stopObserving();
    };
  }, [autoStart, pollingInterval, logInconsistencies]);
  
  /**
   * Manually start observing thinking state
   */
  const startMonitoring = () => {
    thinkingStateObserver.startObserving();
  };
  
  /**
   * Manually stop observing thinking state
   */
  const stopMonitoring = () => {
    thinkingStateObserver.stopObserving();
  };
  
  /**
   * Get detailed diagnostic information about thinking state
   */
  const getDiagnosticReport = () => {
    return thinkingStateObserver.generateDiagnosticReport();
  };
  
  /**
   * Get recent thinking state history
   */
  const getStateHistory = (lastMilliseconds: number = 60000) => {
    return thinkingStateObserver.getStateHistory(lastMilliseconds);
  };
  
  /**
   * Format duration for display
   */
  const formatDuration = (ms: number | null): string => {
    if (ms === null) return 'unknown';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };
  
  // Return state and utility functions
  return {
    ...thinkingState,
    formattedDuration: formatDuration(thinkingState.duration),
    startMonitoring,
    stopMonitoring,
    getDiagnosticReport,
    getStateHistory,
    lastUpdated: lastUpdateRef.current
  };
}

export default useThinkingStateMonitor;