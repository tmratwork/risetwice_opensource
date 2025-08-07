// src/hooksV11/enhanced-error-monitoring.ts

/**
 * Enhanced Error Monitoring System
 * 
 * Comprehensive system for monitoring, detecting, and handling WebRTC and thinking state errors.
 * Integrates multiple modules to provide a complete error monitoring solution:
 * 
 * 1. Enhanced Error Interceptor: Intercepts and enhances console errors
 * 2. Thinking State Timeout Detector: Detects actual timeouts in thinking state
 * 3. Thinking State Observer: Monitors thinking state from multiple sources
 * 4. Thinking State Diagnostics: Provides diagnostic information for errors
 * 
 * This system is designed to be non-invasive, meaning it doesn't modify the underlying
 * WebRTC implementation, but instead provides a monitoring layer on top of it.
 */

import enhancedErrorInterceptor, { TrackedError } from './enhanced-error-interceptor';
import thinkingStateTimeoutDetector, { TimeoutEvent } from './thinking-state-timeout-detector';
import thinkingStateObserver from './thinking-state-observer';
import thinkingStateDiagnostics from './thinking-state-diagnostics';

// Configuration options for error monitoring
interface ErrorMonitoringConfig {
  // Error interception options
  interceptConsoleErrors?: boolean;
  suppressFalsePositives?: boolean;
  enhanceErrorMessages?: boolean;
  interceptAPIErrors?: boolean;
  interceptAudioErrors?: boolean;
  
  // Timeout detection options
  enableTimeoutDetection?: boolean;
  timeoutWarningThreshold?: number;    // In milliseconds
  timeoutErrorThreshold?: number;      // In milliseconds
  timeoutCriticalThreshold?: number;   // In milliseconds
  
  // State observation options
  pollingInterval?: number;            // In milliseconds
  historyLimit?: number;               // Number of state records to keep
  requireConsistentState?: boolean;    // Whether to require state consistency
  
  // Action options
  logToConsole?: boolean;
  createDiagnosticSnapshots?: boolean;
  emitCustomEvents?: boolean;
  
  // Callback for detected errors
  onErrorDetected?: (errorType: string, message: string, diagnosticId?: string) => void;
  
  // Callback for timeout events
  onTimeout?: (level: string, duration: number, msgId: string) => void;
}

// Default configuration
const DEFAULT_CONFIG: ErrorMonitoringConfig = {
  // Error interception defaults
  interceptConsoleErrors: true,
  suppressFalsePositives: true,
  enhanceErrorMessages: true,
  interceptAPIErrors: true,
  interceptAudioErrors: true,
  
  // Timeout detection defaults
  enableTimeoutDetection: true,
  timeoutWarningThreshold: 10000,    // 10 seconds
  timeoutErrorThreshold: 20000,      // 20 seconds
  timeoutCriticalThreshold: 45000,   // 45 seconds
  
  // State observation defaults
  pollingInterval: 1000,
  historyLimit: 100,
  requireConsistentState: true,
  
  // Action defaults
  logToConsole: true,
  createDiagnosticSnapshots: true,
  emitCustomEvents: true
};

// Error monitoring state
let isInitialized = false;

/**
 * Initialize the enhanced error monitoring system
 */
export function initializeErrorMonitoring(config: ErrorMonitoringConfig = {}): void {
  if (isInitialized) {
    console.log('[EnhancedErrorMonitoring] Already initialized, reconfiguring...');
  }
  
  // Merge configuration with defaults
  const mergedConfig: ErrorMonitoringConfig = {
    ...DEFAULT_CONFIG,
    ...config
  };
  
  // Initialize components based on configuration
  
  // 1. Configure and start thinking state observer
  thinkingStateObserver.configure({
    pollingInterval: mergedConfig.pollingInterval,
    historyLimit: mergedConfig.historyLimit,
    logLevel: mergedConfig.logToConsole ? 'warning' : 'error'
  });
  
  thinkingStateObserver.startObserving();
  
  // 2. Configure and start thinking state diagnostics
  thinkingStateDiagnostics.configureThresholds({
    extended: mergedConfig.timeoutWarningThreshold!,
    prolonged: mergedConfig.timeoutErrorThreshold!,
    critical: mergedConfig.timeoutCriticalThreshold!,
    inconsistencyCount: 3
  });
  
  thinkingStateDiagnostics.startMonitoring(mergedConfig.pollingInterval);
  
  // 3. Install enhanced error interceptor if enabled
  if (mergedConfig.interceptConsoleErrors) {
    enhancedErrorInterceptor.install({
      interceptThinkingStateErrors: true,
      interceptWebRTCErrors: true,
      interceptAPIErrors: mergedConfig.interceptAPIErrors,
      interceptAudioErrors: mergedConfig.interceptAudioErrors,
      suppressFalsePositives: mergedConfig.suppressFalsePositives,
      enhanceErrorMessages: mergedConfig.enhanceErrorMessages,
      addRecoverySuggestions: true,
      logDiagnosticIds: mergedConfig.createDiagnosticSnapshots,
      trackErrorFrequency: true
    });
  }
  
  // 4. Initialize timeout detector if enabled
  if (mergedConfig.enableTimeoutDetection) {
    thinkingStateTimeoutDetector.initialize({
      warningThreshold: mergedConfig.timeoutWarningThreshold,
      errorThreshold: mergedConfig.timeoutErrorThreshold,
      criticalThreshold: mergedConfig.timeoutCriticalThreshold,
      useMultipleDataSources: true,
      requireConsistentState: mergedConfig.requireConsistentState,
      suppressFalsePositives: mergedConfig.suppressFalsePositives,
      logToConsole: mergedConfig.logToConsole,
      createDiagnosticSnapshot: mergedConfig.createDiagnosticSnapshots,
      emitCustomEvent: mergedConfig.emitCustomEvents,
      onTimeout: mergedConfig.onTimeout
    });
  }
  
  // 5. Set up custom event listener for error callback
  if (mergedConfig.onErrorDetected && typeof window !== 'undefined') {
    // Listen for custom timeout events
    window.addEventListener('thinkingStateTimeout', ((event: CustomEvent) => {
      const { level, duration, msgId, diagnosticId } = event.detail;
      mergedConfig.onErrorDetected?.('timeout', 
        `Thinking state timeout (${level}): ${(duration / 1000).toFixed(1)}s (${msgId})`,
        diagnosticId
      );
    }) as EventListener);
  }
  
  // 6. Add global window reference for debugging
  if (typeof window !== 'undefined') {
    (window as Window & typeof globalThis & { __errorMonitoring?: Record<string, unknown> }).__errorMonitoring = {
      observer: thinkingStateObserver,
      diagnostics: thinkingStateDiagnostics,
      interceptor: enhancedErrorInterceptor,
      timeoutDetector: thinkingStateTimeoutDetector,
      getErrorHistory: enhancedErrorInterceptor.getErrorHistory,
      getTimeoutEvents: thinkingStateTimeoutDetector.getEvents,
      createSnapshot: (note: string) => thinkingStateDiagnostics.createSnapshot(note),
      exportDiagnostics: () => thinkingStateDiagnostics.exportDiagnostics(),
      config: mergedConfig
    };
  }
  
  isInitialized = true;
  console.log('[EnhancedErrorMonitoring] Initialized with configuration:', mergedConfig);
}

/**
 * Clean up error monitoring
 */
export function shutdownErrorMonitoring(): void {
  if (!isInitialized) {
    return;
  }
  
  // Stop components
  thinkingStateObserver.stopObserving();
  thinkingStateTimeoutDetector.stop();
  enhancedErrorInterceptor.uninstall();
  
  isInitialized = false;
  console.log('[EnhancedErrorMonitoring] Shutdown complete');
}

/**
 * Create a diagnostic snapshot with a custom note
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
 * Get error history from interceptor
 */
export function getErrorHistory(): TrackedError[] {
  return enhancedErrorInterceptor.getErrorHistory();
}

/**
 * Get timeout events from detector
 */
export function getTimeoutEvents(): TimeoutEvent[] {
  return thinkingStateTimeoutDetector.getEvents();
}

/**
 * Get error frequency statistics
 */
export function getErrorFrequency(): Record<string, number> {
  return enhancedErrorInterceptor.getErrorFrequency();
}

/**
 * Clear error history and timeout events
 */
export function clearErrorHistory(): void {
  enhancedErrorInterceptor.clearErrorHistory();
  thinkingStateTimeoutDetector.clearHistory();
}

/**
 * Check if there are any active errors
 */
export function hasActiveErrors(): boolean {
  const errorHistory = enhancedErrorInterceptor.getErrorHistory();
  const timeoutEvents = thinkingStateTimeoutDetector.getEvents();
  
  // Check for recent errors (within last 60 seconds)
  const now = Date.now();
  const recentErrors = errorHistory.filter(e => now - e.timestamp < 60000);
  const recentTimeouts = timeoutEvents.filter(t => now - t.timestamp < 60000);
  
  return recentErrors.length > 0 || recentTimeouts.length > 0;
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
} {
  return thinkingStateDiagnostics.getRecoverySuggestions();
}

// Export everything in a monitoring API
export default {
  initialize: initializeErrorMonitoring,
  shutdown: shutdownErrorMonitoring,
  createSnapshot: createDiagnosticSnapshot,
  exportDiagnostics,
  getErrorHistory,
  getTimeoutEvents,
  getErrorFrequency,
  clearErrorHistory,
  hasActiveErrors,
  getRecoverySuggestions
};