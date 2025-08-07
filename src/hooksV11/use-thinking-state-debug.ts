'use client';

import { useState, useEffect, useCallback } from 'react';
import { createThinkingStateSnapshot, exportThinkingStateDiagnostics } from './thinking-state-integration-setup';

/**
 * Interface for consolidated thinking state
 */
export interface ConsolidatedThinkingState {
  isThinking: boolean;
  duration: number | null;
  startTime: number | null;
  source: string | null;
}

/**
 * Interface for recovery suggestion actions
 */
export interface RecoverySuggestion {
  suggestions: string[];
  actions: Array<{
    label: string;
    description: string;
    action: () => void;
  }>;
  diagnosticId?: string; // Make this optional to handle undefined cases
}

/**
 * Interface for diagnostic information
 */
export interface DiagnosticInfo {
  warnings: string[];
  errors: string[];
  lastUpdated: number;
}

/**
 * Interface for monitoring data snapshot
 */
export interface MonitoringDataSnapshot {
  timestamp: number;
  consolidatedState: ConsolidatedThinkingState;
  diagnosticInfo: DiagnosticInfo;
  recoverySuggestions: RecoverySuggestion;
}

/**
 * Hook for accessing thinking state monitoring data in components
 * Provides access to consolidated thinking state, diagnostics, and recovery actions
 */
export function useThinkingStateDebug() {
  const [monitoringData, setMonitoringData] = useState<MonitoringDataSnapshot | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Function to manually refresh the data
  const refreshData = useCallback(() => {
    setRefreshCounter(prev => prev + 1);
  }, []);

  // Function to toggle monitoring
  const toggleMonitoring = useCallback(() => {
    setIsEnabled(prev => !prev);
  }, []);

  // Function to get comprehensive diagnostics
  const getDiagnostics = useCallback(() => {
    return exportThinkingStateDiagnostics();
  }, []);

  // Take a snapshot of the current thinking state
  const getSnapshot = useCallback(() => {
    return createThinkingStateSnapshot();
  }, []);

  // Get recovery actions
  const getRecoveryActions = useCallback(() => {
    const snapshot = createThinkingStateSnapshot();
    return snapshot?.recoverySuggestions?.actions || [];
  }, []);

  // Execute a recovery action by index
  const executeRecoveryAction = useCallback((index: number) => {
    const actions = getRecoveryActions();
    if (Array.isArray(actions) && index < actions.length && typeof actions[index]?.action === 'function') {
      actions[index].action();
      // Refresh data after action
      setTimeout(() => refreshData(), 500);
      return true;
    }
    return false;
  }, [getRecoveryActions, refreshData]);

  // Update the monitoring data periodically if enabled
  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const updateData = () => {
      const snapshotResult = createThinkingStateSnapshot();
      if (snapshotResult) {
        // Ensure the snapshot matches the required MonitoringDataSnapshot interface
        const typedSnapshot: MonitoringDataSnapshot = {
          timestamp: snapshotResult.timestamp || Date.now(),
          consolidatedState: {
            isThinking: false,
            duration: 0,
            startTime: null,
            source: null,
            ...snapshotResult.consolidatedState
          },
          diagnosticInfo: {
            warnings: [],
            errors: [],
            lastUpdated: Date.now(),
            ...snapshotResult.diagnosticInfo
          },
          recoverySuggestions: {
            suggestions: snapshotResult.recoverySuggestions?.suggestions || [],
            actions: snapshotResult.recoverySuggestions?.actions || [],
            diagnosticId: 'no-id'
          }
        };
        setMonitoringData(typedSnapshot);
      }
    };

    // Update immediately
    updateData();

    // Then update periodically
    const interval = setInterval(updateData, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isEnabled, refreshCounter]);

  // Update once on mount and when refresh counter changes
  useEffect(() => {
    const snapshotResult = createThinkingStateSnapshot();
    if (snapshotResult) {
      // Ensure the snapshot matches the required MonitoringDataSnapshot interface
      const typedSnapshot: MonitoringDataSnapshot = {
        timestamp: snapshotResult.timestamp || Date.now(),
        consolidatedState: {
          isThinking: false,
          duration: 0,
          startTime: null,
          source: null,
          ...snapshotResult.consolidatedState
        },
        diagnosticInfo: {
          warnings: [],
          errors: [],
          lastUpdated: Date.now(),
          ...snapshotResult.diagnosticInfo
        },
        recoverySuggestions: {
          suggestions: snapshotResult.recoverySuggestions?.suggestions || [],
          actions: snapshotResult.recoverySuggestions?.actions || [],
          diagnosticId: 'no-id'
        }
      };
      setMonitoringData(typedSnapshot);
    }
  }, [refreshCounter]);

  // Check if the snapshot creation function exists and returns a valid result
  const snapshotResult = createThinkingStateSnapshot();
  if (!snapshotResult) {
    return {
      isAvailable: false,
      isEnabled: false,
      isThinking: false,
      thinkingDuration: 0,
      refreshData,
      toggleMonitoring,
      monitoringData: null,
      getDiagnostics,
      getSnapshot,
      getRecoveryActions,
      executeRecoveryAction
    };
  }

  // Get the current state
  const snapshot = monitoringData;
  
  // Create a properly typed default state if needed
  const defaultState: ConsolidatedThinkingState = { 
    isThinking: false, 
    duration: 0, 
    startTime: null,
    source: null
  };
  
  // Use the snapshot's consolidatedState or default to properly typed state
  const consolidatedState: ConsolidatedThinkingState = 
    (snapshot && snapshot.consolidatedState) ? snapshot.consolidatedState : defaultState;

  return {
    isAvailable: true,
    isEnabled,
    isThinking: consolidatedState.isThinking,
    thinkingDuration: consolidatedState.duration || 0,
    thinkingStartTime: consolidatedState.startTime,
    thinkingSource: consolidatedState.source,
    diagnosticInfo: snapshot?.diagnosticInfo,
    recoverySuggestions: snapshot?.recoverySuggestions,
    refreshData,
    toggleMonitoring,
    monitoringData: snapshot,
    getDiagnostics,
    getSnapshot,
    getRecoveryActions,
    executeRecoveryAction
  };
}