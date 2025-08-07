// src/hooksV11/thinking-state-index.ts

/**
 * Thinking State Monitoring System
 * 
 * This module provides a comprehensive system for monitoring thinking state
 * in WebRTC applications without modifying the WebRTC implementation.
 * 
 * It provides:
 * 1. Non-invasive state observation
 * 2. Accurate diagnostics and issue detection
 * 3. Minimal UI integration components
 * 4. Error interception and enhancement
 * 
 * All of this is designed to be added to existing applications with minimal
 * changes to the codebase.
 * 
 * Version: 11.2.0 - Enhanced with improved integration, timeout detection,
 * and error handling.
 */

// Core monitoring system
export { default as thinkingStateObserver } from './thinking-state-observer';
export { default as thinkingStateDiagnostics } from './thinking-state-diagnostics';
export { default as thinkingStateMonitor } from './thinking-state-monitor';
export { default as thinkingStateErrorInterceptor } from './thinking-state-error-interceptor';
export { default as thinkingStateTimeoutDetector } from './thinking-state-timeout-detector';

// Enhanced integration system (v11.2.0)
export { 
  initializeThinkingStateMonitoring,
  shutdownThinkingStateMonitoring,
  createThinkingStateSnapshot,
  exportThinkingStateDiagnostics
} from './thinking-state-integration-setup';

// React hooks
export { default as useThinkingStateMonitor } from './use-thinking-state-monitor';
export { default as useThinkingStateDiagnostics } from './use-thinking-state-diagnostics';
export { default as useThinkingStateIntegration } from './use-thinking-state-integration';
export { useThinkingStateDebug } from './use-thinking-state-debug'; // New v11.2.0

// React components
export { default as ThinkingStateDiagnosticsPanel } from './ThinkingStateDiagnosticsPanel';
export { default as ThinkingStateIndicator } from './ThinkingStateIndicator';
export { default as WebRTCIntegrationExample, initializeWebRTCMonitoring } from './WebRTCIntegrationExample';

// Integration utilities
export { default as thinkingStateIntegration, 
  initializeThinkingStateIntegration,
  installThinkingStateErrorInterceptor,
  createThinkingStateSnapshot as legacyCreateSnapshot,
  exportThinkingStateDiagnostics as legacyExportDiagnostics,
  getThinkingStateDiagnostics,
  getThinkingStateRecoverySuggestions,
  hasThinkingStateIssues
} from './thinking-state-integration';

/**
 * Quick start guide (v11.2.0):
 * 
 * 1. Basic Integration (Just monitoring):
 *    ```
 *    // In layout.tsx or other early-loaded component
 *    import ThinkingStateMonitoringInit from '@/components/ThinkingStateMonitoringInit';
 *    
 *    function Layout({ children }) {
 *      return (
 *        <>
 *          <ThinkingStateMonitoringInit />
 *          {children}
 *        </>
 *      );
 *    }
 *    ```
 * 
 * 2. Add thinking state debug panel to your app:
 *    ```
 *    import ThinkingStateDebugPanel from '@/components/ThinkingStateDebugPanel';
 *    
 *    function YourComponent() {
 *      return (
 *        <div>
 *          <YourExistingUI />
 *          <ThinkingStateDebugPanel position="bottom-right" />
 *        </div>
 *      );
 *    }
 *    ```
 * 
 * 3. Use the hook directly in components:
 *    ```
 *    import { useThinkingStateDebug } from '@/hooksV11/thinking-state-index';
 *    
 *    function YourComponent() {
 *      const { isThinking, thinkingDuration, refreshData } = useThinkingStateDebug();
 *      
 *      return (
 *        <div>
 *          <p>Status: {isThinking ? 'Thinking...' : 'Ready'}</p>
 *          {isThinking && <p>Duration: {(thinkingDuration / 1000).toFixed(1)}s</p>}
 *          <button onClick={refreshData}>Refresh</button>
 *        </div>
 *      );
 *    }
 *    ```
 * 
 * 4. Advanced manual initialization:
 *    ```
 *    import { initializeThinkingStateMonitoring } from '@/hooksV11/thinking-state-index';
 *    
 *    // Initialize with custom options
 *    const monitoring = initializeThinkingStateMonitoring({
 *      enableConsoleLogging: true,
 *      suppressWarnings: false,
 *      thresholds: {
 *        warningThresholdMs: 10000, // 10 seconds
 *        errorThresholdMs: 20000,   // 20 seconds
 *      }
 *    });
 *    
 *    // Access monitoring components directly
 *    const snapshot = monitoring.observer.getConsolidatedState();
 *    console.log('Current thinking state:', snapshot);
 *    ```
 */

// Import the components and functions needed for the default export
import { initializeThinkingStateMonitoring, shutdownThinkingStateMonitoring, createThinkingStateSnapshot, exportThinkingStateDiagnostics } from './thinking-state-integration-setup';
import { initializeThinkingStateIntegration, getThinkingStateRecoverySuggestions, hasThinkingStateIssues } from './thinking-state-integration';
import ThinkingStateIndicator from './ThinkingStateIndicator';
import ThinkingStateDiagnosticsPanel from './ThinkingStateDiagnosticsPanel';
import WebRTCIntegrationExample from './WebRTCIntegrationExample';
import { useThinkingStateDebug } from './use-thinking-state-debug';

// Default export for simple importing
export default {
  // Core initialization function (v11.2.0)
  initialize: initializeThinkingStateMonitoring,
  shutdown: shutdownThinkingStateMonitoring,
  
  // Legacy initialization (for backward compatibility)
  legacyInitialize: initializeThinkingStateIntegration,
  
  // UI components
  ThinkingStateIndicator,
  ThinkingStateDiagnosticsPanel,
  WebRTCIntegrationExample,
  
  // Diagnostic functions
  createSnapshot: createThinkingStateSnapshot,
  exportDiagnostics: exportThinkingStateDiagnostics,
  
  // Legacy functions (for backward compatibility)
  legacyCreateSnapshot: createThinkingStateSnapshot,
  legacyExportDiagnostics: exportThinkingStateDiagnostics,
  getRecoverySuggestions: getThinkingStateRecoverySuggestions,
  hasIssues: hasThinkingStateIssues,
  
  // New hooks (v11.2.0)
  useThinkingStateDebug
};