// src/hooksV11/ThinkingStateMonitorDemo.tsx

import React, { useEffect, useState } from 'react';
import thinkingStateMonitor from './thinking-state-monitor';
import ThinkingStateDiagnosticsPanel from './ThinkingStateDiagnosticsPanel';
import useThinkingStateDiagnostics from './use-thinking-state-diagnostics';

/**
 * Demo component for thinking state monitoring
 * This shows how to integrate the monitoring system into an application
 */
export default function ThinkingStateMonitorDemo() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [showDiagnosticsPanel, setShowDiagnosticsPanel] = useState(false);
  
  // Use diagnostics hook for demo
  const {
    isThinking,
    // thinkingDuration, // Commented out unused variable
    formattedDuration,
    warningLevel,
    hasInconsistencies,
    suggestions,
    eventLog
  } = useThinkingStateDiagnostics({
    autoStart: true,
    showExtendedWarnings: true
  });
  
  // Initialize the monitoring system on mount
  useEffect(() => {
    // Initialize with custom thresholds for demo purposes
    thinkingStateMonitor.initialize({
      pollingInterval: 500,
      warningThresholds: {
        extended: 5000,      // 5 seconds - for demo purposes
        prolonged: 10000,    // 10 seconds - for demo purposes
        critical: 20000      // 20 seconds - for demo purposes
      },
      interceptErrors: true,
      suppressFalsePositives: true,
      enhanceErrorMessages: true
    });
    
    setIsInitialized(true);
    
    // Add window.DEBUG reference for testing in console
    if (typeof window !== 'undefined') {
      (window as Window & typeof globalThis & { DEBUG?: Record<string, unknown> }).DEBUG = {
        ...((window as Window & typeof globalThis & { DEBUG?: Record<string, unknown> }).DEBUG || {}),
        thinkingState: thinkingStateMonitor
      };
    }
    
    // Clean up is not necessary as the monitor is meant to run for the entire session
  }, []);
  
  // Simulate thinking state for demo purposes
  const [simulatedThinking, setSimulatedThinking] = useState(false);
  const [simulationStartTime, setSimulationStartTime] = useState<number | null>(null);
  
  // Function to simulate thinking state
  const simulateThinking = () => {
    if (simulatedThinking) {
      // Already simulating
      return;
    }
    
    // Create a fake thinking state for demonstration
    setSimulatedThinking(true);
    setSimulationStartTime(Date.now());
    
    // Update the global window state used by the observer
    if (typeof window !== 'undefined') {
      (window as Window & typeof globalThis & { __messageFlowState?: Record<string, unknown> }).__messageFlowState = {
        ...((window as Window & typeof globalThis & { __messageFlowState?: Record<string, unknown> }).__messageFlowState || {}) as Record<string, unknown>,
        lastThinkingStartTime: Date.now(),
        lastThinkingSource: 'simulation',
        thinkingSetCount: (((window as Window & typeof globalThis & { __messageFlowState?: Record<string, unknown> }).__messageFlowState as Record<string, unknown> | undefined)?.thinkingSetCount as number || 0) + 1
      };
    }
    
    // Take a snapshot
    thinkingStateMonitor.createSnapshot('Started thinking simulation');
  };
  
  // Function to stop simulated thinking
  const stopSimulatedThinking = () => {
    if (!simulatedThinking) {
      // Not simulating
      return;
    }
    
    setSimulatedThinking(false);
    setSimulationStartTime(null);
    
    // Update the global window state used by the observer
    if (typeof window !== 'undefined') {
      const now = Date.now();
      const startTime = ((window as Window & typeof globalThis & { __messageFlowState?: Record<string, unknown> }).__messageFlowState as Record<string, unknown> | undefined)?.lastThinkingStartTime as number || now;
      const duration = now - startTime;
      
      (window as Window & typeof globalThis & { __messageFlowState?: Record<string, unknown> }).__messageFlowState = {
        ...((window as Window & typeof globalThis & { __messageFlowState?: Record<string, unknown> }).__messageFlowState || {}) as Record<string, unknown>,
        lastThinkingResetTime: now,
        lastThinkingResetSource: 'simulation',
        thinkingResetCount: (((window as Window & typeof globalThis & { __messageFlowState?: Record<string, unknown> }).__messageFlowState as Record<string, unknown> | undefined)?.thinkingResetCount as number || 0) + 1,
        lastResetDuration: duration
      };
    }
    
    // Take a snapshot
    thinkingStateMonitor.createSnapshot('Stopped thinking simulation');
  };
  
  // Function to create an inconsistent state for testing
  const createInconsistentState = () => {
    if (typeof window !== 'undefined') {
      // Create inconsistent state by setting different timestamps
      (window as Window & typeof globalThis & { __messageFlowState?: Record<string, unknown> }).__messageFlowState = {
        ...((window as Window & typeof globalThis & { __messageFlowState?: Record<string, unknown> }).__messageFlowState || {}) as Record<string, unknown>,
        lastThinkingStartTime: Date.now(),
        lastThinkingSource: 'inconsistent_simulation'
      };
      
      // Take a snapshot
      thinkingStateMonitor.createSnapshot('Created inconsistent state');
      
      // Auto-fix after 5 seconds
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          const now = Date.now();
          (window as Window & typeof globalThis & { __messageFlowState?: Record<string, unknown> }).__messageFlowState = {
            ...((window as Window & typeof globalThis & { __messageFlowState?: Record<string, unknown> }).__messageFlowState || {}) as Record<string, unknown>,
            lastThinkingResetTime: now,
            lastThinkingResetSource: 'inconsistent_simulation_reset',
            thinkingResetCount: (((window as Window & typeof globalThis & { __messageFlowState?: Record<string, unknown> }).__messageFlowState as Record<string, unknown> | undefined)?.thinkingResetCount as number || 0) + 1,
            lastResetDuration: 5000
          };
          
          // Take a snapshot
          thinkingStateMonitor.createSnapshot('Auto-fixed inconsistent state');
        }
      }, 5000);
    }
  };
  
  // Calculate simulated duration
  const getSimulatedDuration = () => {
    if (!simulatedThinking || !simulationStartTime) return 0;
    return Date.now() - simulationStartTime;
  };
  
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Thinking State Monitor Demo</h1>
      
      <div className="bg-white dark:bg-gray-800 border rounded p-4 mb-6">
        <h2 className="text-xl font-medium mb-3">Monitor Status</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
            <p className="text-sm font-medium mb-1">Initialization:</p>
            <p className={isInitialized ? 'text-green-500' : 'text-red-500'}>
              {isInitialized ? 'Initialized' : 'Not Initialized'}
            </p>
          </div>
          
          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
            <p className="text-sm font-medium mb-1">Current Thinking State:</p>
            <p className={isThinking ? 'text-blue-500' : 'text-green-500'}>
              {isThinking ? `Thinking (${formattedDuration})` : 'Idle'}
            </p>
          </div>
          
          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
            <p className="text-sm font-medium mb-1">Warning Level:</p>
            <p className={
              warningLevel === 'critical' ? 'text-red-500' : 
              warningLevel === 'error' ? 'text-orange-500' :
              warningLevel === 'warning' ? 'text-yellow-500' : 'text-gray-500'
            }>
              {warningLevel === 'none' ? 'None' : warningLevel}
            </p>
          </div>
          
          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
            <p className="text-sm font-medium mb-1">Inconsistencies:</p>
            <p className={hasInconsistencies ? 'text-red-500' : 'text-green-500'}>
              {hasInconsistencies ? 'Detected' : 'None'}
            </p>
          </div>
        </div>
        
        <div className="flex space-x-3 mb-4">
          <button
            onClick={simulateThinking}
            disabled={simulatedThinking}
            className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Simulate Thinking
          </button>
          
          <button
            onClick={stopSimulatedThinking}
            disabled={!simulatedThinking}
            className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Stop Simulation
          </button>
          
          <button
            onClick={createInconsistentState}
            className="px-3 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Create Inconsistent State
          </button>
          
          <button
            onClick={() => thinkingStateMonitor.exportDiagnostics()}
            className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Export Diagnostics
          </button>
        </div>
        
        {simulatedThinking && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 rounded border border-blue-200 dark:border-blue-800">
            <p className="text-sm mb-2">
              <span className="font-medium">Simulating AI thinking state</span>
              <span className="ml-2">
                Duration: {Math.floor(getSimulatedDuration() / 1000)}s
              </span>
            </p>
            <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-blue-500 h-full rounded-full"
                style={{ width: `${Math.min(100, (getSimulatedDuration() / 20000) * 100)}%` }}
              ></div>
            </div>
            <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
              Warning at 5s, Error at 10s, Critical at 20s
            </p>
          </div>
        )}
      </div>
      
      <div className="bg-white dark:bg-gray-800 border rounded p-4 mb-6">
        <h2 className="text-xl font-medium mb-3">Event Log</h2>
        {eventLog.length === 0 ? (
          <p className="text-gray-500">No events logged yet.</p>
        ) : (
          <div className="border rounded overflow-y-auto max-h-40">
            {eventLog.map((event, i) => (
              <div 
                key={i} 
                className={`p-2 text-sm border-b ${
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
        )}
      </div>
      
      {suggestions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border rounded p-4 mb-6">
          <h2 className="text-xl font-medium mb-3">Suggestions</h2>
          <ul className="mb-3 text-sm">
            {suggestions.map((suggestion, i) => (
              <li key={i} className="mb-1 text-gray-700 dark:text-gray-300">• {suggestion}</li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-medium">Diagnostics Panel</h2>
        <button
          onClick={() => setShowDiagnosticsPanel(!showDiagnosticsPanel)}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {showDiagnosticsPanel ? 'Hide Panel' : 'Show Panel'}
        </button>
      </div>
      
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        The diagnostics panel can be integrated into your WebRTC application to provide real-time monitoring
        and diagnostics without modifying any WebRTC functionality. It can be shown conditionally when issues
        are detected or accessed via a debug menu.
      </p>
      
      {showDiagnosticsPanel && (
        <div className="border rounded p-4 bg-white dark:bg-gray-800">
          <ThinkingStateDiagnosticsPanel 
            expanded={true}
            showWhenIdle={true}
            notificationThreshold="extended"
            position="top"
          />
        </div>
      )}
    </div>
  );
}