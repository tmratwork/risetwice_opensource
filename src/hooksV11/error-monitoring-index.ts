// src/hooksV11/error-monitoring-index.ts

/**
 * Enhanced Error Monitoring System
 * 
 * This module provides a comprehensive system for WebRTC error monitoring,
 * with special focus on thinking state errors. It includes:
 * 
 * 1. Enhanced error interceptors for console messages
 * 2. Timeout detection for accurate thinking state monitoring
 * 3. UI components for visualizing errors and recovery options
 * 4. React hooks for easy integration in components
 * 
 * All components are non-invasive, meaning they don't modify the underlying
 * WebRTC implementation, but instead provide monitoring, diagnostics, and
 * enhanced error reporting.
 */

// Core monitoring modules
export { default as enhancedErrorMonitoring } from './enhanced-error-monitoring';
export { default as enhancedErrorInterceptor } from './enhanced-error-interceptor';
export { default as thinkingStateTimeoutDetector } from './thinking-state-timeout-detector';

// Initialization functions
export { 
  initializeErrorMonitoring,
  shutdownErrorMonitoring,
  createDiagnosticSnapshot,
  exportDiagnostics,
  getErrorHistory,
  getTimeoutEvents,
  getErrorFrequency,
  clearErrorHistory,
  hasActiveErrors,
  getRecoverySuggestions
} from './enhanced-error-monitoring';

export {
  installEnhancedErrorInterceptor,
  uninstallEnhancedErrorInterceptor
} from './enhanced-error-interceptor';

export {
  initializeTimeoutDetector,
  startTimeoutMonitoring,
  stopTimeoutMonitoring
} from './thinking-state-timeout-detector';

// React hooks
export { useEnhancedErrorMonitoring } from './use-enhanced-error-monitoring';

// React components
export { default as ThinkingStateErrorDisplay } from './ThinkingStateErrorDisplay';
export { default as ErrorMonitoringIntegrationExample, initializeErrorMonitoring as initializeErrorMonitoringInComponent } from './ErrorMonitoringIntegrationExample';

/**
 * Quick start guide:
 * 
 * 1. Basic integration (just monitoring):
 * ```typescript
 * import { initializeErrorMonitoring } from './hooksV11/error-monitoring-index';
 * 
 * // Initialize in a layout component or early in your application
 * initializeErrorMonitoring({
 *   suppressFalsePositives: true,
 *   timeoutWarningThreshold: 10000, // 10 seconds
 *   onErrorDetected: (type, message) => {
 *     console.log(`Error detected: ${type} - ${message}`);
 *   }
 * });
 * ```
 * 
 * 2. Component integration with hook:
 * ```typescript
 * import { useEnhancedErrorMonitoring } from './hooksV11/error-monitoring-index';
 * 
 * function YourComponent() {
 *   const { 
 *     errors, 
 *     hasThinkingErrors,
 *     recoverySuggestions, 
 *     clearErrors 
 *   } = useEnhancedErrorMonitoring();
 *   
 *   // Use error information in your component
 *   return (
 *     <div>
 *       {hasThinkingErrors && (
 *         <div className="error-banner">
 *           {recoverySuggestions[0]}
 *           <button onClick={clearErrors}>Clear</button>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 * 
 * 3. Full error display integration:
 * ```typescript
 * import { ErrorMonitoringIntegrationExample } from './hooksV11/error-monitoring-index';
 * 
 * function YourApplication() {
 *   return (
 *     <ErrorMonitoringIntegrationExample
 *       showErrorDisplay={true}
 *       position="bottom"
 *       thresholds={{
 *         warning: 10000,
 *         error: 20000,
 *         critical: 45000
 *       }}
 *       onErrorDetected={(type, message) => {
 *         // Log or handle errors
 *       }}
 *     >
 *       <YourExistingApplication />
 *     </ErrorMonitoringIntegrationExample>
 *   );
 * }
 * ```
 * 
 * 4. Standalone error display:
 * ```typescript
 * import { ThinkingStateErrorDisplay } from './hooksV11/error-monitoring-index';
 * 
 * function YourDebugPanel() {
 *   return (
 *     <div className="debug-panel">
 *       <h2>Debug Information</h2>
 *       
 *       <ThinkingStateErrorDisplay
 *         initiallyExpanded={true}
 *         position="bottom"
 *         includeTimeouts={true}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */

// Import functions/components for default export
import { initializeErrorMonitoring, shutdownErrorMonitoring, createDiagnosticSnapshot, exportDiagnostics } from './enhanced-error-monitoring';
import ThinkingStateErrorDisplay from './ThinkingStateErrorDisplay';
import { default as ErrorMonitoringIntegrationExample } from './ErrorMonitoringIntegrationExample';

// Default export with most commonly used functions
export default {
  initialize: initializeErrorMonitoring,
  shutdown: shutdownErrorMonitoring,
  createSnapshot: createDiagnosticSnapshot,
  exportDiagnostics,
  ErrorDisplay: ThinkingStateErrorDisplay,
  IntegrationExample: ErrorMonitoringIntegrationExample
};