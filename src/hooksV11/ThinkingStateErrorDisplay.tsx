// src/hooksV11/ThinkingStateErrorDisplay.tsx

import React, { useState, useEffect } from 'react';
import { getErrorHistory, getErrorFrequency, clearErrorHistory } from './enhanced-error-interceptor';
import { getTimeoutEvents } from './thinking-state-timeout-detector';
import thinkingStateDiagnostics from './thinking-state-diagnostics';

interface ThinkingStateErrorDisplayProps {
  // Whether to show the display initially
  initiallyExpanded?: boolean;
  
  // Whether to automatically show when errors are detected
  autoShowOnErrors?: boolean;
  
  // Position of the display
  position?: 'top' | 'bottom' | 'right' | 'left';
  
  // Whether to show a badge with error count
  showBadge?: boolean;
  
  // Custom class name for styling
  className?: string;
  
  // Whether to include timeout events in the display
  includeTimeouts?: boolean;
  
  // Maximum number of errors to display
  maxErrors?: number;
  
  // Whether to automatically clear old errors
  autoClear?: boolean;
  
  // Custom callback when recoverable actions are taken
  onRecoveryAction?: (action: string, errorType: string) => void;
}

/**
 * Component for displaying and managing thinking state errors
 */
export default function ThinkingStateErrorDisplay({
  initiallyExpanded = false,
  autoShowOnErrors = true,
  position = 'bottom',
  showBadge = true,
  className = '',
  includeTimeouts = true,
  maxErrors = 10,
  autoClear = true,
  onRecoveryAction
}: ThinkingStateErrorDisplayProps) {
  // UI state
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const [activeTab, setActiveTab] = useState<'errors' | 'timeouts' | 'stats'>('errors');
  
  // Define proper types for our error and timeout objects
  type ErrorObject = {
    type: string;
    timestamp: number;
    originalMessage?: string;
    isFalsePositive?: boolean;
    diagnosticId?: string;
  };
  
  type TimeoutObject = {
    level: string;
    timestamp: number;
    duration: number;
    msgId?: string;
    falsePositive?: boolean;
    inconsistentState?: boolean;
    diagnosticId?: string;
  };
  
  // Error state
  const [errors, setErrors] = useState<ErrorObject[]>([]);
  const [timeouts, setTimeouts] = useState<TimeoutObject[]>([]);
  const [errorFrequency, setErrorFrequency] = useState<Record<string, number>>({});
  const [totalErrors, setTotalErrors] = useState<number>(0);
  
  // Recovery suggestions
  const [recoverySuggestions, setRecoverySuggestions] = useState<string[]>([]);
  const [recoveryActions, setRecoveryActions] = useState<Array<{
    label: string;
    description: string;
    action: () => void;
  }>>([]);
  
  // Position classes
  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'top-0 left-0 right-0';
      case 'right':
        return 'top-0 right-0 bottom-0 max-w-md';
      case 'left':
        return 'top-0 left-0 bottom-0 max-w-md';
      case 'bottom':
      default:
        return 'bottom-0 left-0 right-0';
    }
  };
  
  /**
   * Update error state from interceptor and timeout detector
   * Declared before useEffect to fix the reference issue
   */
  const updateErrorState = React.useCallback(() => {
    // Get errors from interceptor
    const errorHistory = getErrorHistory().slice(-maxErrors);
    setErrors(errorHistory);
    
    // Get timeout events if enabled
    if (includeTimeouts) {
      const timeoutEvents = getTimeoutEvents().slice(-maxErrors);
      setTimeouts(timeoutEvents);
    }
    
    // Get error frequency statistics
    const frequency = getErrorFrequency();
    setErrorFrequency(frequency);
    
    // Calculate total error count
    const total = errorHistory.length + (includeTimeouts ? timeouts.length : 0);
    setTotalErrors(total);
    
    // Get recovery suggestions
    const { suggestions, actions } = thinkingStateDiagnostics.getRecoverySuggestions();
    setRecoverySuggestions(suggestions);
    setRecoveryActions(actions);
    
    // Auto-clear old errors if enabled
    if (autoClear && errorHistory.length > maxErrors * 2) {
      clearErrorHistory();
    }
  }, [maxErrors, includeTimeouts, autoClear, timeouts.length]);

  // Load errors and timeouts on mount and periodically
  useEffect(() => {
    // Initial load
    updateErrorState();
    
    // Set up interval to check for new errors
    const intervalId = setInterval(() => {
      updateErrorState();
    }, 3000);
    
    // Clean up on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [updateErrorState]);
  
  // Auto-show when errors are detected
  useEffect(() => {
    if (autoShowOnErrors && totalErrors > 0 && !isExpanded) {
      setIsExpanded(true);
    }
  }, [totalErrors, autoShowOnErrors, isExpanded]);
  
  // Get color for error level
  const getErrorLevelColor = (level: string): string => {
    switch (level?.toLowerCase()) {
      case 'critical':
        return 'bg-red-500 text-white';
      case 'error':
        return 'bg-orange-500 text-white';
      case 'warning':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };
  
  // Handle recovery action
  const handleRecoveryAction = (action: string) => {
    // Find and execute the action
    const actionObj = recoveryActions.find(a => a.label === action);
    if (actionObj) {
      actionObj.action();
      
      // Call custom callback if provided
      if (onRecoveryAction) {
        onRecoveryAction(action, activeTab);
      }
    }
  };
  
  // Handle export diagnostics
  const handleExportDiagnostics = () => {
    thinkingStateDiagnostics.exportDiagnostics();
  };
  
  // Handle clear errors
  const handleClearErrors = () => {
    clearErrorHistory();
    updateErrorState();
  };
  
  // If no errors and not expanded, only show badge if enabled
  if (totalErrors === 0 && !isExpanded) {
    return null;
  }
  
  // Show only badge if not expanded
  if (!isExpanded) {
    return showBadge && totalErrors > 0 ? (
      <div 
        className={`fixed ${position === 'top' ? 'top-2' : 'bottom-2'} ${position === 'left' ? 'left-2' : 'right-2'} z-50 cursor-pointer ${className}`}
        onClick={() => setIsExpanded(true)}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500 text-white font-bold shadow-lg">
          {totalErrors}
        </div>
      </div>
    ) : null;
  }
  
  // Full display when expanded
  return (
    <div className={`fixed ${getPositionClasses()} z-50 shadow-lg ${className}`}>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
        {/* Header */}
        <div className="p-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
          <div className="flex items-center">
            <span className="font-medium mr-2">WebRTC Error Monitor</span>
            {totalErrors > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-500 rounded-full">
                {totalErrors}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={handleExportDiagnostics}
              className="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
            >
              Export
            </button>
            <button 
              onClick={handleClearErrors}
              className="px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded"
            >
              Clear
            </button>
            <button 
              onClick={() => setIsExpanded(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
            >
              ✕
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex">
            <button 
              className={`py-2 px-4 text-sm font-medium ${activeTab === 'errors' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
              onClick={() => setActiveTab('errors')}
            >
              Errors ({errors.length})
            </button>
            {includeTimeouts && (
              <button 
                className={`py-2 px-4 text-sm font-medium ${activeTab === 'timeouts' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
                onClick={() => setActiveTab('timeouts')}
              >
                Timeouts ({timeouts.length})
              </button>
            )}
            <button 
              className={`py-2 px-4 text-sm font-medium ${activeTab === 'stats' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
              onClick={() => setActiveTab('stats')}
            >
              Stats
            </button>
          </div>
        </div>
        
        {/* Content area */}
        <div className="overflow-y-auto" style={{ maxHeight: '50vh' }}>
          {/* Errors tab */}
          {activeTab === 'errors' && (
            <div className="p-2">
              {errors.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm p-4 text-center">
                  No errors detected
                </p>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {errors.slice().reverse().map((error, index) => (
                    <div key={index} className="py-2">
                      <div className="flex justify-between items-start">
                        <div className={`px-2 py-1 text-xs rounded-full ${getErrorLevelColor(error.type)}`}>
                          {error.type.replace('_', ' ')}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(error.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">
                        {error.originalMessage ? error.originalMessage.substring(0, 100) : 'No message available'}
                        {error.originalMessage && error.originalMessage.length > 100 ? '...' : ''}
                      </p>
                      {error.isFalsePositive && (
                        <div className="mt-1 flex items-center text-xs text-yellow-600 dark:text-yellow-400">
                          <span className="mr-1">⚠️</span>
                          <span>Likely false positive</span>
                        </div>
                      )}
                      {error.diagnosticId && (
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Diagnostic ID: {error.diagnosticId}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Timeouts tab */}
          {activeTab === 'timeouts' && includeTimeouts && (
            <div className="p-2">
              {timeouts.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm p-4 text-center">
                  No timeout events detected
                </p>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {timeouts.slice().reverse().map((timeout, index) => (
                    <div key={index} className="py-2">
                      <div className="flex justify-between items-start">
                        <div className={`px-2 py-1 text-xs rounded-full ${getErrorLevelColor(timeout.level)}`}>
                          {timeout.level.toUpperCase()}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(timeout.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">
                        Thinking for {(timeout.duration / 1000).toFixed(1)}s (Message ID: {timeout.msgId})
                      </p>
                      {timeout.falsePositive && (
                        <div className="mt-1 flex items-center text-xs text-yellow-600 dark:text-yellow-400">
                          <span className="mr-1">⚠️</span>
                          <span>Likely false positive</span>
                        </div>
                      )}
                      {timeout.inconsistentState && (
                        <div className="mt-1 flex items-center text-xs text-orange-600 dark:text-orange-400">
                          <span className="mr-1">⚠️</span>
                          <span>Inconsistent state detected</span>
                        </div>
                      )}
                      {timeout.diagnosticId && (
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Diagnostic ID: {timeout.diagnosticId}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Stats tab */}
          {activeTab === 'stats' && (
            <div className="p-4">
              <h3 className="text-sm font-medium mb-2">Error Frequency</h3>
              <div className="space-y-2">
                {Object.entries(errorFrequency).length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No error statistics available
                  </p>
                ) : (
                  Object.entries(errorFrequency).map(([type, count]) => (
                    <div key={type} className="flex items-center">
                      <div className="w-32 text-sm">{type.replace('_', ' ')}:</div>
                      <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                        <div 
                          className={`h-full ${getErrorLevelColor(type)}`}
                          style={{ width: `${Math.min(100, (count / Math.max(...Object.values(errorFrequency))) * 100)}%` }}
                        ></div>
                      </div>
                      <div className="ml-2 text-sm font-medium">{count}</div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Recovery suggestions */}
              {recoverySuggestions.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Recovery Suggestions</h3>
                  <ul className="list-disc pl-5 text-sm space-y-1 text-gray-600 dark:text-gray-300">
                    {recoverySuggestions.map((suggestion, index) => (
                      <li key={index}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Recovery actions */}
              {recoveryActions.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Recovery Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    {recoveryActions.map((action, index) => (
                      <button 
                        key={index}
                        onClick={() => handleRecoveryAction(action.label)}
                        className="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
                        title={action.description}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}