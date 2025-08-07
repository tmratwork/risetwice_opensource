// src/hooksV11/ThinkingStateDiagnosticsPanel.tsx

import React, { useState } from 'react';
import useThinkingStateDiagnostics from './use-thinking-state-diagnostics';

/**
 * Component to display thinking state diagnostics and recovery options
 * This can be added to debug panels or shown conditionally when issues are detected
 */
export default function ThinkingStateDiagnosticsPanel({
  expanded = false,
  showWhenIdle = false,
  notificationThreshold = 'prolonged' as 'extended' | 'prolonged' | 'critical',
  position = 'bottom'
}: {
  expanded?: boolean;
  showWhenIdle?: boolean;
  notificationThreshold?: 'extended' | 'prolonged' | 'critical';
  position?: 'top' | 'bottom';
}) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  
  // Use the diagnostics hook with initial configuration
  const {
    isThinking,
    formattedDuration,
    warningLevel,
    warningMessage,
    hasInconsistencies,
    suggestions,
    recoveryActions,
    eventLog,
    createSnapshot,
    exportDiagnostics,
    clearEventLog
  } = useThinkingStateDiagnostics({
    autoStart: true,
    showExtendedWarnings: true,
    notificationThreshold
  });
  
  // Determine if we should show the panel
  const shouldShow = showWhenIdle || isThinking || warningLevel !== 'none' || hasInconsistencies;
  
  if (!shouldShow) {
    return null;
  }
  
  // Get status color based on warning level
  const getStatusColor = () => {
    if (warningLevel === 'critical') return 'bg-red-500';
    if (warningLevel === 'error') return 'bg-orange-500';
    if (warningLevel === 'warning') return 'bg-yellow-500';
    if (isThinking) return 'bg-blue-500';
    return 'bg-green-500';
  };
  
  return (
    <div 
      className={`fixed ${position === 'top' ? 'top-0' : 'bottom-0'} right-0 w-full md:w-96 z-50 transition-all duration-300 ease-in-out`}
      style={{ 
        maxHeight: isExpanded ? '80vh' : (warningLevel !== 'none' ? '100px' : '40px'),
        overflow: 'hidden'
      }}
    >
      {/* Header bar */}
      <div 
        className={`p-2 flex justify-between items-center cursor-pointer ${getStatusColor()} text-white`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-white mr-2 animate-pulse"></div>
          <span className="font-medium">
            {warningMessage || (isThinking ? `AI Thinking: ${formattedDuration}` : 'AI Idle')}
          </span>
        </div>
        <button className="p-1">
          {isExpanded ? '▼' : '▲'}
        </button>
      </div>
      
      {/* Warning message for non-expanded view */}
      {!isExpanded && warningLevel !== 'none' && (
        <div className="p-3 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm">
            {suggestions[0] || 'Potential issue detected with AI thinking state'}
          </p>
          <div className="mt-2 flex space-x-2">
            <button 
              onClick={() => setIsExpanded(true)}
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              View Details
            </button>
            {recoveryActions[0] && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  recoveryActions[0].action();
                }}
                className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                {recoveryActions[0].label}
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Expanded diagnostics panel */}
      {isExpanded && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 40px)' }}>
          {/* Current thinking state */}
          <div className="mb-4">
            <h3 className="font-medium text-lg mb-2">Thinking State</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 border rounded">
                <span className="font-medium">Status:</span>
                <span className={`ml-2 ${isThinking ? 'text-blue-500' : 'text-green-500'}`}>
                  {isThinking ? 'Thinking' : 'Idle'}
                </span>
              </div>
              <div className="p-2 border rounded">
                <span className="font-medium">Duration:</span>
                <span className="ml-2">{formattedDuration}</span>
              </div>
              <div className="p-2 border rounded">
                <span className="font-medium">Warning:</span>
                <span className={`ml-2 ${
                  warningLevel === 'critical' ? 'text-red-500' : 
                  warningLevel === 'error' ? 'text-orange-500' :
                  warningLevel === 'warning' ? 'text-yellow-500' : 'text-gray-500'
                }`}>
                  {warningLevel === 'none' ? 'None' : warningLevel}
                </span>
              </div>
              <div className="p-2 border rounded">
                <span className="font-medium">Inconsistencies:</span>
                <span className={`ml-2 ${hasInconsistencies ? 'text-red-500' : 'text-green-500'}`}>
                  {hasInconsistencies ? 'Detected' : 'None'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Recovery suggestions */}
          {(suggestions.length > 0 || recoveryActions.length > 0) && (
            <div className="mb-4">
              <h3 className="font-medium text-lg mb-2">Suggestions</h3>
              {suggestions.length > 0 && (
                <ul className="mb-3 text-sm">
                  {suggestions.map((suggestion, i) => (
                    <li key={i} className="mb-1 text-gray-700 dark:text-gray-300">• {suggestion}</li>
                  ))}
                </ul>
              )}
              {recoveryActions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {recoveryActions.map((action, i) => (
                    <button 
                      key={i}
                      onClick={action.action}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      title={action.description}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Event log */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-lg">Event Log</h3>
              <div className="flex space-x-2">
                <button 
                  onClick={() => createSnapshot('Manual snapshot')}
                  className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs"
                >
                  Create Snapshot
                </button>
                <button 
                  onClick={clearEventLog}
                  className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs"
                >
                  Clear Log
                </button>
              </div>
            </div>
            
            <div className="border rounded overflow-y-auto max-h-40 text-xs">
              {eventLog.length === 0 && (
                <p className="p-2 text-gray-500">No events logged yet</p>
              )}
              {eventLog.map((event, i) => (
                <div 
                  key={i} 
                  className={`p-2 border-b ${
                    event.level === 'error' ? 'bg-red-50 dark:bg-red-900 dark:bg-opacity-20' : 
                    event.level === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20' : 
                    'bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className={`font-medium ${
                      event.level === 'error' ? 'text-red-600 dark:text-red-400' : 
                      event.level === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : 
                      'text-gray-700 dark:text-gray-300'
                    }`}>
                      {event.level.toUpperCase()}
                    </span>
                    <span className="text-gray-500">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="mt-1">{event.message}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <button 
              onClick={() => setIsExpanded(false)}
              className="px-3 py-1 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-600 text-sm"
            >
              Minimize
            </button>
            <button 
              onClick={exportDiagnostics}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              Export Diagnostics
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Helper to initialize thinking state diagnostics system
 * This can be called from the main app component
 */
export function initializeDiagnostics(): void {
  // Dynamically import to avoid SSR issues
  if (typeof window !== 'undefined') {
    // Import the observer to start the system
    import('./thinking-state-observer')
      .then(module => {
        const observer = module.default;
        observer.startObserving();
        console.log('[ThinkingStateDiagnostics] Global diagnostics initialized');
      })
      .catch(err => {
        console.error('[ThinkingStateDiagnostics] Failed to initialize:', err);
      });
      
    // Import error interceptor
    import('./thinking-state-error-interceptor')
      .then(module => {
        module.default.install({
          suppressFalsePositives: true,
          enhanceMessages: true
        });
        console.log('[ThinkingStateDiagnostics] Error interceptor installed');
      })
      .catch(err => {
        console.error('[ThinkingStateDiagnostics] Failed to install error interceptor:', err);
      });
  }
}