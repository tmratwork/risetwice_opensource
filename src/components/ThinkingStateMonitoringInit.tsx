'use client';

import { useEffect } from 'react';
import { 
  initializeThinkingStateMonitoring, 
  shutdownThinkingStateMonitoring 
} from '../hooksV11/thinking-state-integration-setup';
import audioLogger from '../hooksV11/audio-logger';
import { LogLevel } from '../hooksV11/enhanced-logging';

/**
 * Component that initializes the thinking state monitoring system
 * This should be added to layout.tsx to ensure monitoring is active for all pages
 */
export default function ThinkingStateMonitoringInit({
  enableEnhancedLogging = true,
  loggingLevel = LogLevel.INFO,
  warningThresholdMs = 15000, // 15 seconds
  errorThresholdMs = 30000,   // 30 seconds
  maxThinkingTimeMs = 60000,  // 60 seconds
}) {
  useEffect(() => {
    // Only run on client-side
    if (typeof window !== 'undefined') {
      // Log initialization
      audioLogger.logDiagnostic('thinking-state-init-component', {
        timestamp: Date.now(),
        browser: navigator.userAgent,
        enableEnhancedLogging,
        loggingLevel: LogLevel[loggingLevel],
        thresholds: {
          warningThresholdMs,
          errorThresholdMs,
          maxThinkingTimeMs
        }
      });
      
      // Initialize the thinking state monitoring system
      const monitoring = initializeThinkingStateMonitoring({
        enableConsoleLogging: true,
        suppressWarnings: false,
        enhancedLoggingEnabled: enableEnhancedLogging,
        loggingLevel: loggingLevel,
        thresholds: {
          warningThresholdMs,
          errorThresholdMs,
          maxThinkingTimeMs,
        }
      });
      
      // Save monitoring instance to window for debugging
      if (process.env.NODE_ENV === 'development') {
        // Define window augmentation for TypeScript
        interface WindowWithMonitoring extends Window {
          __thinkingStateMonitoring?: unknown;
          __thinkingStateVersion?: {
            version: string;
            enhancedLogging: boolean;
            loggingLevel: string;
            timestamp: number;
            build: string;
            thresholds: {
              warningThresholdMs: number;
              errorThresholdMs: number;
              maxThinkingTimeMs: number;
              warningThresholdSec: number;
              errorThresholdSec: number;
              maxThinkingTimeSec: number;
            };
          };
          __monitoringInitialized?: boolean;
          __monitoringInitTime?: number;
        }
        
        const typedWindow = window as WindowWithMonitoring;
        
        typedWindow.__thinkingStateMonitoring = monitoring;
        
        // Add version info for debugging
        typedWindow.__thinkingStateVersion = {
          version: 'v11.2.0',
          enhancedLogging: enableEnhancedLogging,
          loggingLevel: LogLevel[loggingLevel],
          timestamp: Date.now(),
          build: '20250428-enhanced',
          thresholds: {
            warningThresholdMs,
            errorThresholdMs,
            maxThinkingTimeMs,
            warningThresholdSec: warningThresholdMs / 1000,
            errorThresholdSec: errorThresholdMs / 1000,
            maxThinkingTimeSec: maxThinkingTimeMs / 1000
          }
        };
      }
      
      // Track basic info about monitoring
      const typedWindow = window as { 
        __monitoringInitialized?: boolean; 
        __monitoringInitTime?: number 
      };
      typedWindow.__monitoringInitialized = true;
      typedWindow.__monitoringInitTime = Date.now();
      
      // Return cleanup function
      return () => {
        shutdownThinkingStateMonitoring();
        
        if (typeof window !== 'undefined') {
          const typedWindow = window as { __monitoringInitialized?: boolean };
          typedWindow.__monitoringInitialized = false;
        }
      };
    }
    return undefined;
  }, [enableEnhancedLogging, loggingLevel, warningThresholdMs, errorThresholdMs, maxThinkingTimeMs]);
  
  // This is a utility component that doesn't render anything
  return null;
}