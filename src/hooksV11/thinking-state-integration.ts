// src/hooksV11/thinking-state-integration.ts

/**
 * Thinking State Integration Module
 * 
 * This module provides utilities for non-invasively integrating thinking state
 * monitoring into the existing application. It does not modify WebRTC functionality,
 * but instead provides middleware for monitoring and diagnostics.
 */

import thinkingStateObserver from './thinking-state-observer';
import thinkingStateDiagnostics from './thinking-state-diagnostics';
import thinkingStateMonitor from './thinking-state-monitor';
import errorInterceptor from './thinking-state-error-interceptor';

// Define configuration options
export interface ThinkingStateIntegrationOptions {
  // Observer options
  pollingInterval?: number;
  logLevel?: 'debug' | 'info' | 'warning' | 'error' | 'none';
  
  // Warning thresholds
  thresholds?: {
    warning?: number;
    error?: number;
    critical?: number;
  };
  
  // Error handling options
  interceptErrors?: boolean;
  suppressFalsePositives?: boolean;
  
  // React component references (optional)
  diagnosticDataRef?: React.MutableRefObject<Record<string, unknown>>;
  isThinkingRef?: React.MutableRefObject<boolean>;
  
  // Callback when a diagnostic snapshot is created
  onDiagnosticSnapshot?: (snapshotId: string, level: string) => void;
}

/**
 * Middleware function for initializing thinking state monitoring
 * without modifying application code. This should be called early in
 * the app lifecycle, such as in a layout component or app initialization.
 */
export function initializeThinkingStateIntegration(options: ThinkingStateIntegrationOptions = {}): {
  cleanup: () => void;
  getDiagnostics: () => Record<string, unknown>;
  exportDiagnostics: () => void;
} {
  // Default thresholds
  const defaultThresholds = {
    warning: 10000,   // 10 seconds
    error: 20000,     // 20 seconds
    critical: 45000,  // 45 seconds
  };
  
  // Merge options with defaults
  const mergedOptions = {
    pollingInterval: options.pollingInterval || 1000,
    logLevel: options.logLevel || 'warning',
    thresholds: {
      ...defaultThresholds,
      ...(options.thresholds || {})
    },
    interceptErrors: options.interceptErrors !== false,
    suppressFalsePositives: options.suppressFalsePositives !== false,
    diagnosticDataRef: options.diagnosticDataRef || null,
    isThinkingRef: options.isThinkingRef || null,
    onDiagnosticSnapshot: options.onDiagnosticSnapshot || null,
  };
  
  // Only initialize in browser
  if (typeof window === 'undefined') {
    return {
      cleanup: () => {},
      getDiagnostics: () => ({}),
      exportDiagnostics: () => {}
    };
  }
  
  // Initialize thinking state monitoring
  thinkingStateMonitor.initialize({
    pollingInterval: mergedOptions.pollingInterval,
    logLevel: mergedOptions.logLevel,
    warningThresholds: {
      extended: mergedOptions.thresholds.warning,
      prolonged: mergedOptions.thresholds.error,
      critical: mergedOptions.thresholds.critical,
      inconsistencyCount: 3
    },
    interceptErrors: mergedOptions.interceptErrors,
    suppressFalsePositives: mergedOptions.suppressFalsePositives
  });
  
  // Provide React state references if available
  if (mergedOptions.diagnosticDataRef || mergedOptions.isThinkingRef) {
    thinkingStateObserver.observeReactState(
      mergedOptions.diagnosticDataRef?.current || null,
      mergedOptions.isThinkingRef || null
    );
  }
  
  // Set up diagnostic snapshot callback
  if (mergedOptions.onDiagnosticSnapshot) {
    thinkingStateDiagnostics.subscribe((level, message) => {
      if (level === 'error' || level === 'warning') {
        const snapshotId = thinkingStateDiagnostics.createSnapshot(message);
        mergedOptions.onDiagnosticSnapshot?.(snapshotId, level);
      }
    });
  }
  
  // Add window debugging reference
  if (typeof window !== 'undefined') {
    (window as Window & typeof globalThis & { __thinkingStateIntegration?: Record<string, unknown> }).__thinkingStateIntegration = {
      monitor: thinkingStateMonitor,
      observer: thinkingStateObserver,
      diagnostics: thinkingStateDiagnostics,
      getState: () => thinkingStateObserver.getConsolidatedState(),
      getDiagnostics: () => thinkingStateDiagnostics.getCurrentDiagnostics(),
      createSnapshot: (note: string) => thinkingStateDiagnostics.createSnapshot(note),
      exportDiagnostics: () => thinkingStateDiagnostics.exportDiagnostics()
    };
  }
  
  // Flag initialization
  console.log(`[ThinkingStateIntegration] Initialized with thresholds: warning=${mergedOptions.thresholds.warning}ms, error=${mergedOptions.thresholds.error}ms, critical=${mergedOptions.thresholds.critical}ms`);
  
  // Return cleanup function and utilities
  return {
    cleanup: () => {
      // This is intentionally empty - the monitoring should continue for the entire session
      // Actual cleanup would be done on app shutdown, which doesn't typically happen in browser
    },
    getDiagnostics: () => thinkingStateDiagnostics.getCurrentDiagnostics(),
    exportDiagnostics: () => thinkingStateDiagnostics.exportDiagnostics()
  };
}

/**
 * Middleware for intercepting console errors related to thinking state
 * This can be called separately from initialization if needed
 */
export function installThinkingStateErrorInterceptor(options: {
  suppressFalsePositives?: boolean;
  enhanceMessages?: boolean;
} = {}): () => void {
  errorInterceptor.install({
    suppressFalsePositives: options.suppressFalsePositives !== false,
    enhanceMessages: options.enhanceMessages !== false
  });
  
  return () => errorInterceptor.uninstall();
}

/**
 * Create a thinking state snapshot
 * @param note Optional note to include with the snapshot
 * @returns The snapshot ID
 */
export function createThinkingStateSnapshot(note: string = 'Manual snapshot'): string {
  return thinkingStateDiagnostics.createSnapshot(note);
}

/**
 * Export diagnostic data
 */
export function exportThinkingStateDiagnostics(): void {
  thinkingStateDiagnostics.exportDiagnostics();
}

/**
 * Get the current thinking state diagnostics
 */
export function getThinkingStateDiagnostics(): Record<string, unknown> {
  return thinkingStateDiagnostics.getCurrentDiagnostics();
}

/**
 * Get recovery suggestions based on current state
 */
export function getThinkingStateRecoverySuggestions(): {
  suggestions: string[];
  actions: Array<{
    label: string;
    description: string;
    action: () => void;
  }>;
  diagnosticId: string;
} {
  return thinkingStateDiagnostics.getRecoverySuggestions();
}

/**
 * Check if there are any active thinking state issues
 */
export function hasThinkingStateIssues(): boolean {
  const state = thinkingStateDiagnostics.getCurrentDiagnostics();
  return state.warningLevel !== 'none' || state.inconsistencies.length > 0;
}

// Export everything as a monitoring API
export default {
  initialize: initializeThinkingStateIntegration,
  installErrorInterceptor: installThinkingStateErrorInterceptor,
  createSnapshot: createThinkingStateSnapshot,
  exportDiagnostics: exportThinkingStateDiagnostics,
  getDiagnostics: getThinkingStateDiagnostics,
  getRecoverySuggestions: getThinkingStateRecoverySuggestions,
  hasIssues: hasThinkingStateIssues,
};