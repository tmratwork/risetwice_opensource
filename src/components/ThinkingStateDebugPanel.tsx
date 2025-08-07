'use client';

import { useState } from 'react';
import { useThinkingStateDebug } from '@/hooksV11/use-thinking-state-debug';

interface RecoveryAction {
  label: string;
  description: string;
  action: () => void;
}

interface DebugPanelProps {
  initialCollapsed?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

/**
 * Debug panel component for thinking state monitoring
 * Shows current thinking state, duration, and offers diagnostic actions
 */
export default function ThinkingStateDebugPanel({ 
  initialCollapsed = true,
  position = 'top-right' 
}: DebugPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const { 
    isAvailable,
    isEnabled,
    isThinking,
    thinkingDuration,
    thinkingStartTime,
    thinkingSource,
    recoverySuggestions,
    refreshData,
    toggleMonitoring,
    executeRecoveryAction,
    getDiagnostics
  } = useThinkingStateDebug();

  // Position styles
  const positionStyles = {
    'top-right': 'top-2 right-2',
    'top-left': 'top-2 left-2',
    'bottom-right': 'bottom-2 right-2',
    'bottom-left': 'bottom-2 left-2'
  }[position];

  // Format duration
  const formatDuration = (ms: number) => {
    if (!ms) return '0.0s';
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // If monitoring is not available
  if (!isAvailable) {
    return (
      <div className={`fixed ${positionStyles} z-50 bg-red-100 p-2 rounded shadow-md border border-red-300 text-sm`}>
        <p className="text-red-600 font-medium">Thinking State Monitoring not initialized</p>
      </div>
    );
  }

  // For collapsed state, just show a small indicator
  if (isCollapsed) {
    const statusColor = isThinking ? 'bg-yellow-400' : 'bg-green-400';
    return (
      <div 
        className={`fixed ${positionStyles} z-50 flex items-center space-x-2 bg-white p-2 rounded shadow-md border border-gray-300 cursor-pointer`}
        onClick={() => setIsCollapsed(false)}
        data-testid="thinking-state-indicator"
      >
        <div className={`w-3 h-3 rounded-full ${statusColor}`}></div>
        <span className="text-xs font-medium">
          {isThinking ? `Thinking (${formatDuration(thinkingDuration)})` : 'Not thinking'}
        </span>
      </div>
    );
  }

  // Full debug panel
  return (
    <div className={`fixed ${positionStyles} z-50 bg-white p-3 rounded shadow-lg border border-gray-300 w-96 max-h-[80vh] overflow-y-auto`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium text-gray-800">Thinking State Monitor</h3>
        <button 
          onClick={() => setIsCollapsed(true)}
          className="text-gray-500 hover:text-gray-700"
        >
          Minimize
        </button>
      </div>
      
      <div className="mb-3 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isThinking ? 'bg-yellow-400' : 'bg-green-400'}`}></div>
          <span className="font-medium">
            {isThinking ? 'Thinking' : 'Not thinking'}
          </span>
        </div>
        
        <div className="flex space-x-2">
          <button 
            onClick={toggleMonitoring}
            className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded"
          >
            {isEnabled ? 'Pause' : 'Monitor'}
          </button>
          <button 
            onClick={refreshData}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
          >
            Refresh
          </button>
        </div>
      </div>
      
      <div className="space-y-2 text-sm mb-3">
        <div className="grid grid-cols-2 gap-1">
          <div className="text-gray-600">Duration:</div>
          <div className="font-medium">{formatDuration(thinkingDuration)}</div>
          
          <div className="text-gray-600">Started:</div>
          <div className="font-medium">
            {thinkingStartTime ? new Date(thinkingStartTime).toLocaleTimeString() : 'N/A'}
          </div>
          
          <div className="text-gray-600">Source:</div>
          <div className="font-medium">{thinkingSource || 'None'}</div>
        </div>
      </div>
      
      {recoverySuggestions?.suggestions && recoverySuggestions.suggestions.length > 0 && (
        <div className="mb-3">
          <h4 className="font-medium text-gray-700 mb-1">Recovery Suggestions:</h4>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {recoverySuggestions.suggestions.map((suggestion: string, index: number) => (
              <li key={index} className="text-gray-600">{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
      
      {recoverySuggestions?.actions && recoverySuggestions.actions.length > 0 && (
        <div className="mb-3">
          <h4 className="font-medium text-gray-700 mb-1">Actions:</h4>
          <div className="space-y-2">
            {recoverySuggestions.actions.map((action: RecoveryAction, index: number) => (
              <button 
                key={index}
                onClick={() => executeRecoveryAction(index)}
                className="block w-full text-left px-3 py-2 text-sm bg-yellow-50 hover:bg-yellow-100 rounded border border-yellow-200"
              >
                <span className="font-medium">{action.label}</span>
                <p className="text-xs text-gray-600 mt-1">{action.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}
      
      <div className="mt-4 pt-2 border-t border-gray-200">
        <button
          onClick={() => {
            const diagnostics = getDiagnostics();
            console.log('Thinking State Diagnostics:', diagnostics);
            alert('Full diagnostics logged to console');
          }}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          Log Complete Diagnostics
        </button>
      </div>
    </div>
  );
}