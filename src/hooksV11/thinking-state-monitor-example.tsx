// src/hooksV11/thinking-state-monitor-example.tsx

import React, { useEffect } from 'react';
import thinkingStateObserver from './thinking-state-observer';
import useThinkingStateMonitor from './use-thinking-state-monitor';
import { installThinkingStateErrorInterceptor } from './thinking-state-error-interceptor';

/**
 * Example component showing how to use the thinking state monitor
 * This is completely non-invasive to WebRTC functionality
 */
export default function ThinkingStateMonitor() {
  // Use the hook to monitor thinking state
  const {
    isThinking,
    formattedDuration,
    source,
    inconsistencies,
    getDiagnosticReport
  } = useThinkingStateMonitor({
    autoStart: true, 
    pollingInterval: 500,
    logInconsistencies: true
  });
  
  // Install error interceptor on mount
  useEffect(() => {
    // Install the error interceptor
    installThinkingStateErrorInterceptor({
      suppressFalsePositives: true,
      enhanceMessages: true
    });
    
    // Get any existing React state refs from the WebRTC component
    // This is deliberately left empty as we won't modify core WebRTC code
    // The observer will work with just the window global data
    
    // Clean up on unmount
    return () => {
      // Nothing to clean up - interceptor stays installed
    };
  }, []);
  
  // Function to export diagnostic data
  const exportDiagnostics = () => {
    const report = getDiagnosticReport();
    const dataStr = JSON.stringify(report, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = `thinking-state-diagnostics-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 mt-4">
      <h3 className="text-lg font-medium mb-2">Thinking State Monitor</h3>
      
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="p-2 border rounded bg-white dark:bg-gray-700">
          <p className="text-sm font-medium">Status:</p>
          <p className={`text-lg ${isThinking ? 'text-blue-500' : 'text-gray-500'}`}>
            {isThinking ? 'Thinking...' : 'Idle'}
          </p>
        </div>
        
        <div className="p-2 border rounded bg-white dark:bg-gray-700">
          <p className="text-sm font-medium">Duration:</p>
          <p className="text-lg">{formattedDuration}</p>
        </div>
        
        <div className="p-2 border rounded bg-white dark:bg-gray-700">
          <p className="text-sm font-medium">Source:</p>
          <p className="text-sm">{source || 'unknown'}</p>
        </div>
        
        <div className="p-2 border rounded bg-white dark:bg-gray-700">
          <p className="text-sm font-medium">Inconsistencies:</p>
          {inconsistencies.length > 0 ? (
            <ul className="text-xs text-red-500">
              {inconsistencies.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-green-500">None detected</p>
          )}
        </div>
      </div>
      
      <button
        onClick={exportDiagnostics}
        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
      >
        Export Diagnostics
      </button>
      
      <p className="text-xs text-gray-500 mt-2">
        This monitor observes thinking state without modifying WebRTC functionality.
        It helps diagnose false warnings and provide better error messages.
      </p>
    </div>
  );
}

/**
 * Function to initialize thinking state monitoring globally
 * This can be called from the main app component
 */
export function initializeThinkingStateMonitoring() {
  // Configure and start the observer
  thinkingStateObserver.configure({
    pollingInterval: 1000, 
    historyLimit: 100,
    logLevel: 'warning'
  });
  
  // Start observing
  thinkingStateObserver.startObserving();
  
  // Install error interceptor
  installThinkingStateErrorInterceptor({
    suppressFalsePositives: true,
    enhanceMessages: true
  });
  
  console.log('[ThinkingStateMonitor] Global monitoring initialized');
}