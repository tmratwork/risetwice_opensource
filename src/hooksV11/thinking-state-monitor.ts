// src/hooksV11/thinking-state-monitor.ts

/**
 * Thinking State Monitor
 * 
 * Main module for initializing the thinking state monitoring system.
 * This brings together all the components of the monitoring system
 * without modifying any WebRTC functionality.
 */

import thinkingStateObserver from './thinking-state-observer';
import thinkingStateDiagnostics from './thinking-state-diagnostics';
import errorInterceptor from './thinking-state-error-interceptor';

// Configuration options for the monitoring system
interface MonitorConfig {
  // Observer options
  pollingInterval?: number;
  historyLimit?: number;
  logLevel?: 'debug' | 'info' | 'warning' | 'error' | 'none';
  
  // Diagnostics options
  warningThresholds?: {
    extended?: number;    // Duration for "extended" thinking (warning)
    prolonged?: number;   // Duration for "prolonged" thinking (error)
    critical?: number;    // Duration for "critical" thinking (potential stuck state)
    inconsistencyCount?: number;  // Number of inconsistencies before warning
  };
  
  // Error interceptor options
  interceptErrors?: boolean;
  suppressFalsePositives?: boolean;
  enhanceErrorMessages?: boolean;
}

// Default configuration
const defaultConfig: MonitorConfig = {
  pollingInterval: 1000,
  historyLimit: 100,
  logLevel: 'warning',
  warningThresholds: {
    extended: 10000,     // 10 seconds
    prolonged: 20000,    // 20 seconds
    critical: 45000,     // 45 seconds
    inconsistencyCount: 3
  },
  interceptErrors: true,
  suppressFalsePositives: true,
  enhanceErrorMessages: true
};

/**
 * Initialize the thinking state monitoring system
 */
export function initializeThinkingStateMonitor(config: MonitorConfig = {}): void {
  // Merge configuration with defaults
  const mergedConfig = {
    ...defaultConfig,
    ...config,
    warningThresholds: {
      ...defaultConfig.warningThresholds,
      ...(config.warningThresholds || {})
    }
  };
  
  // Only initialize in browser
  if (typeof window === 'undefined') {
    return;
  }
  
  // Configure and start observer
  thinkingStateObserver.configure({
    pollingInterval: mergedConfig.pollingInterval,
    historyLimit: mergedConfig.historyLimit,
    logLevel: mergedConfig.logLevel
  });
  
  thinkingStateObserver.startObserving();
  console.log('[ThinkingStateMonitor] Observer started');
  
  // Configure and start diagnostics
  thinkingStateDiagnostics.configureThresholds(mergedConfig.warningThresholds);
  thinkingStateDiagnostics.startMonitoring(mergedConfig.pollingInterval);
  console.log('[ThinkingStateMonitor] Diagnostics initialized');
  
  // Install error interceptor if enabled
  if (mergedConfig.interceptErrors) {
    errorInterceptor.install({
      suppressFalsePositives: mergedConfig.suppressFalsePositives,
      enhanceMessages: mergedConfig.enhanceErrorMessages
    });
    console.log('[ThinkingStateMonitor] Error interceptor installed');
  }
  
  // Add a reference to window for debugging
  (window as Window & typeof globalThis & { __thinkingStateMonitor?: Record<string, unknown> }).__thinkingStateMonitor = {
    observer: thinkingStateObserver,
    diagnostics: thinkingStateDiagnostics,
    getState: () => thinkingStateObserver.getConsolidatedState(),
    createSnapshot: thinkingStateDiagnostics.createSnapshot,
    exportDiagnostics: thinkingStateDiagnostics.exportDiagnostics
  };
  
  console.log('[ThinkingStateMonitor] Initialized with config:', mergedConfig);
}

/**
 * Manually create a diagnostic snapshot
 */
export function createDiagnosticSnapshot(note: string = 'Manual snapshot'): string {
  return thinkingStateDiagnostics.createSnapshot(note);
}

/**
 * Export diagnostic data
 */
export function exportDiagnostics(): void {
  thinkingStateDiagnostics.exportDiagnostics();
}

/**
 * Get current consolidated thinking state
 */
export function getThinkingState(): {
  isThinking: boolean;
  duration: number | null;
  startTime: number | null;
  source: string | null;
} {
  return thinkingStateObserver.getConsolidatedState();
}

/**
 * Get comprehensive diagnostic information
 */
export function getDiagnosticReport(): Record<string, unknown> {
  return thinkingStateDiagnostics.getCurrentDiagnostics();
}

/**
 * Get recovery suggestions based on current state
 */
export function getRecoverySuggestions(): {
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

// Export a monitoring API
export default {
  initialize: initializeThinkingStateMonitor,
  createSnapshot: createDiagnosticSnapshot,
  exportDiagnostics,
  getState: getThinkingState,
  getDiagnostics: getDiagnosticReport,
  getRecoverySuggestions,
  hasIssues: hasThinkingStateIssues
};