// src/hooksV11/thinking-state-timeout-detector.ts

/**
 * Thinking State Timeout Detector
 * 
 * Provides improved timeout detection for thinking state:
 * 1. Uses multiple data sources to detect real timeouts
 * 2. Prevents false positives based on consolidated state
 * 3. Provides actionable error messages with recovery options
 * 4. Tracks problematic message IDs for pattern detection
 * 5. Uses advanced detection algorithms based on state consistency
 */

import thinkingStateObserver from './thinking-state-observer';
import thinkingStateDiagnostics from './thinking-state-diagnostics';

// Configuration options
interface TimeoutDetectorConfig {
  // Timing thresholds (in milliseconds)
  warningThreshold?: number;    // Time before warning is issued
  errorThreshold?: number;      // Time before error is issued
  criticalThreshold?: number;   // Time before critical timeout is considered
  
  // Detection options
  useMultipleDataSources?: boolean;   // Whether to use multiple state sources for detection
  requireConsistentState?: boolean;   // Whether to require consistent state across sources
  suppressFalsePositives?: boolean;   // Whether to ignore likely false positives
  
  // Action options
  logToConsole?: boolean;         // Whether to log timeouts to console
  createDiagnosticSnapshot?: boolean;  // Whether to create diagnostic snapshots
  emitCustomEvent?: boolean;      // Whether to emit custom events
  
  // Callback for timeout events
  onTimeout?: (level: string, duration: number, msgId: string) => void;
}

// Timeout event details
export interface TimeoutEvent {
  timestamp: number;
  level: 'warning' | 'error' | 'critical';
  duration: number;
  msgId: string;
  diagnosticId?: string;
  thinkingStartTime?: number;
  thinkingSource?: string;
  inconsistentState: boolean;
  falsePositive: boolean;
  [key: string]: unknown;
}

/**
 * Thinking State Timeout Detector class
 */
class ThinkingStateTimeoutDetector {
  private static instance: ThinkingStateTimeoutDetector;
  
  // Configuration
  private config: TimeoutDetectorConfig = {
    warningThreshold: 10000,    // 10 seconds
    errorThreshold: 20000,      // 20 seconds
    criticalThreshold: 45000,   // 45 seconds
    useMultipleDataSources: true,
    requireConsistentState: true,
    suppressFalsePositives: true,
    logToConsole: true,
    createDiagnosticSnapshot: true,
    emitCustomEvent: true,
    onTimeout: undefined
  };
  
  // Timeout checking state
  private checkInterval: number | null = null;
  private isMonitoring: boolean = false;
  
  // Timeout event history
  private timeoutEvents: TimeoutEvent[] = [];
  
  // Set of message IDs with timeouts to prevent duplicate warnings
  private handledMessageIds: Set<string> = new Set();
  
  // Track timeouts by level to prevent repeated notifications
  private lastTimeoutByLevel: {
    warning: number;
    error: number;
    critical: number;
  } = {
    warning: 0,
    error: 0,
    critical: 0
  };
  
  private constructor() {
    // Nothing to initialize
  }
  
  public static getInstance(): ThinkingStateTimeoutDetector {
    if (!ThinkingStateTimeoutDetector.instance) {
      ThinkingStateTimeoutDetector.instance = new ThinkingStateTimeoutDetector();
    }
    return ThinkingStateTimeoutDetector.instance;
  }
  
  /**
   * Configure timeout detector
   */
  public configure(config: TimeoutDetectorConfig): void {
    this.config = {
      ...this.config,
      ...config
    };
    
    console.log('[ThinkingStateTimeoutDetector] Configured with options:', this.config);
  }
  
  /**
   * Start monitoring for thinking state timeouts
   */
  public startMonitoring(checkIntervalMs: number = 2000): void {
    if (this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = true;
    
    // Clear any existing interval
    if (this.checkInterval !== null && typeof window !== 'undefined') {
      window.clearInterval(this.checkInterval);
    }
    
    // Start periodic checking
    if (typeof window !== 'undefined') {
      this.checkInterval = window.setInterval(() => {
        this.checkForTimeouts();
      }, checkIntervalMs);
    }
    
    console.log('[ThinkingStateTimeoutDetector] Started monitoring with interval:', checkIntervalMs);
  }
  
  /**
   * Stop monitoring for timeouts
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = false;
    
    // Clear check interval
    if (this.checkInterval !== null && typeof window !== 'undefined') {
      window.clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    console.log('[ThinkingStateTimeoutDetector] Stopped monitoring');
  }
  
  /**
   * Check for thinking state timeouts
   */
  private checkForTimeouts(): void {
    // Get current thinking state
    const state = thinkingStateObserver.getConsolidatedState();
    const inconsistencies = thinkingStateObserver.detectStateInconsistencies();
    
    // If not thinking, there's no timeout
    if (!state.isThinking) {
      // Also clear any previously handled message IDs for this message
      // This helps prevent false positives when thinking state is toggled rapidly
      if (state.source) {
        const sourceMatch = state.source.match(/(?:input_audio_buffer|transcript|user_message|function_call)-([a-zA-Z0-9]+)/);
        if (sourceMatch) {
          const msgId = sourceMatch[1];
          this.handledMessageIds.delete(`${msgId}-warning`);
          this.handledMessageIds.delete(`${msgId}-error`);
          this.handledMessageIds.delete(`${msgId}-critical`);
        }
      }
      return;
    }
    
    // Get duration of thinking state
    const duration = state.duration || 0;
    const now = Date.now();
    
    // Check for inconsistent state if required
    const hasInconsistentState = inconsistencies.length > 0;
    const isStateTrustworthy = !this.config.requireConsistentState || !hasInconsistentState;
    
    // Check if this is a likely false positive
    const isFalsePositive = (
      hasInconsistentState || 
      !state.startTime || 
      state.startTime === 0 ||
      !isStateTrustworthy ||
      // Additional check: startTime too far in the past (likely stale state)
      (state.startTime && (now - state.startTime > 3600000)) || // More than 1 hour old
      // Additional check: startTime in the future (invalid state)
      (state.startTime && state.startTime > now) ||
      // Additional check: duration too short but still getting timeout warning
      (duration < 5000) // Less than 5 seconds of thinking time
    );
    
    // Get message ID from source or generate one
    let msgId = 'unknown';
    if (state.source) {
      const sourceMatch = state.source.match(/(?:input_audio_buffer|transcript|user_message|function_call)-([a-zA-Z0-9]+)/);
      if (sourceMatch) {
        msgId = sourceMatch[1];
      }
    }
    
    // For false positives, handle based on configuration
    if (isFalsePositive && this.config.suppressFalsePositives) {
      // If we already warned about this message, don't warn again
      if (this.handledMessageIds.has(msgId)) {
        return;
      }
      
      // Only log debug warning if it exceeds warning threshold
      if (duration >= this.config.warningThreshold! && this.config.logToConsole) {
        console.debug(`[ThinkingStateTimeoutDetector] Potential false positive timeout detected for message ${msgId}:`, {
          duration: `${(duration / 1000).toFixed(1)}s`,
          startTime: state.startTime ? new Date(state.startTime).toISOString() : 'unknown',
          source: state.source,
          inconsistencies,
          falsePositiveReason: this.getFalsePositiveReason(state, inconsistencies, isStateTrustworthy)
        });
        
        // Mark as handled to prevent duplicate warnings
        this.handledMessageIds.add(msgId);
      }
      
      return;
    }
    
    // Determine timeout level based on duration
    let timeoutLevel: 'warning' | 'error' | 'critical' | null = null;
    
    if (duration >= this.config.criticalThreshold!) {
      timeoutLevel = 'critical';
    } else if (duration >= this.config.errorThreshold!) {
      timeoutLevel = 'error';
    } else if (duration >= this.config.warningThreshold!) {
      timeoutLevel = 'warning';
    }
    
    // If no timeout or we've already handled this message at this level, do nothing
    if (!timeoutLevel || (
      this.handledMessageIds.has(`${msgId}-${timeoutLevel}`) && 
      now - this.lastTimeoutByLevel[timeoutLevel] < 10000 // Limit to one every 10 seconds
    )) {
      return;
    }
    
    // Create diagnostic snapshot if enabled
    let diagnosticId: string | undefined = undefined;
    if (this.config.createDiagnosticSnapshot) {
      diagnosticId = thinkingStateDiagnostics.createSnapshot(
        `Thinking state timeout (${timeoutLevel}): ${(duration / 1000).toFixed(1)}s`
      );
    }
    
    // Create timeout event
    const timeoutEvent: TimeoutEvent = {
      timestamp: now,
      level: timeoutLevel,
      duration,
      msgId,
      diagnosticId,
      thinkingStartTime: state.startTime || undefined,
      thinkingSource: state.source || undefined,
      inconsistentState: hasInconsistentState,
      falsePositive: isFalsePositive
    };
    
    // Add to history
    this.timeoutEvents.push(timeoutEvent);
    
    // Limit history size
    if (this.timeoutEvents.length > 50) {
      this.timeoutEvents = this.timeoutEvents.slice(-50);
    }
    
    // Mark as handled and update last timeout
    this.handledMessageIds.add(`${msgId}-${timeoutLevel}`);
    this.lastTimeoutByLevel[timeoutLevel] = now;
    
    // Log to console if enabled
    if (this.config.logToConsole) {
      const durationSec = (duration / 1000).toFixed(1);
      
      if (timeoutLevel === 'critical') {
        console.error(`[ThinkingStateTimeoutDetector] CRITICAL: AI has been thinking for ${durationSec}s without responding!`, {
          msgId,
          diagnosticId,
          source: state.source,
          startTime: state.startTime ? new Date(state.startTime).toISOString() : 'unknown'
        });
      } else if (timeoutLevel === 'error') {
        console.error(`[ThinkingStateTimeoutDetector] ERROR: AI has been thinking for ${durationSec}s (extended period)`, {
          msgId,
          diagnosticId,
          source: state.source
        });
      } else {
        console.warn(`[ThinkingStateTimeoutDetector] WARNING: AI has been thinking for ${durationSec}s`, {
          msgId,
          diagnosticId
        });
      }
      
      // Log recovery suggestions
      const recoverySuggestions = this.getRecoverySuggestions(timeoutLevel);
      if (recoverySuggestions.length > 0) {
        if (timeoutLevel === 'critical') {
          console.error('[ThinkingStateTimeoutDetector] Recovery suggestions:', recoverySuggestions);
        } else if (timeoutLevel === 'error') {
          console.error('[ThinkingStateTimeoutDetector] Recovery suggestions:', recoverySuggestions);
        } else {
          console.warn('[ThinkingStateTimeoutDetector] Recovery suggestions:', recoverySuggestions);
        }
      }
    }
    
    // Emit custom event if enabled
    if (this.config.emitCustomEvent && typeof window !== 'undefined') {
      const event = new CustomEvent('thinkingStateTimeout', {
        detail: {
          ...timeoutEvent,
          suggestions: this.getRecoverySuggestions(timeoutLevel)
        }
      });
      
      window.dispatchEvent(event);
    }
    
    // Call onTimeout callback if provided
    if (this.config.onTimeout) {
      this.config.onTimeout(timeoutLevel, duration, msgId);
    }
  }
  
  /**
   * Get recovery suggestions based on timeout level
   */
  private getRecoverySuggestions(level: 'warning' | 'error' | 'critical'): string[] {
    // Get general suggestions
    const { suggestions } = thinkingStateDiagnostics.getRecoverySuggestions();
    
    if (suggestions.length > 0) {
      return suggestions;
    }
    
    // Provide default suggestions based on level
    if (level === 'critical') {
      return [
        "The AI appears to be stuck in thinking state.",
        "Try refreshing the page to establish a new connection.",
        "If this persists, check network connectivity and try again later."
      ];
    } else if (level === 'error') {
      return [
        "The AI has been thinking for an extended period.",
        "This might indicate a complex query or a connection issue.",
        "Consider asking a simpler question or refreshing if this persists."
      ];
    } else {
      return [
        "The AI is taking longer than usual to respond.",
        "This may be normal for complex questions or poor network conditions."
      ];
    }
  }
  
  /**
   * Get reason why a timeout is considered a false positive
   */
  private getFalsePositiveReason(
    state: { startTime: number | null; source: string | null; },
    inconsistencies: string[],
    isStateTrustworthy: boolean
  ): string {
    if (inconsistencies.length > 0) {
      return `State inconsistencies detected: ${inconsistencies.join(', ')}`;
    } else if (!state.startTime || state.startTime === 0) {
      return "Invalid thinking start time";
    } else if (!isStateTrustworthy) {
      return "State information is not trustworthy";
    } else {
      return "Unknown reason";
    }
  }
  
  /**
   * Get timeout event history
   */
  public getTimeoutEvents(): TimeoutEvent[] {
    return [...this.timeoutEvents];
  }
  
  /**
   * Clear timeout event history and handled message IDs
   */
  public clearTimeoutHistory(): void {
    this.timeoutEvents = [];
    this.handledMessageIds.clear();
    this.lastTimeoutByLevel = {
      warning: 0,
      error: 0,
      critical: 0
    };
  }
}

// Get singleton instance
const thinkingStateTimeoutDetector = ThinkingStateTimeoutDetector.getInstance();

/**
 * Initialize timeout detector with configuration
 */
export function initializeTimeoutDetector(config: TimeoutDetectorConfig = {}): void {
  thinkingStateTimeoutDetector.configure(config);
  thinkingStateTimeoutDetector.startMonitoring();
}

/**
 * Start timeout monitoring
 */
export function startTimeoutMonitoring(checkIntervalMs: number = 2000): void {
  thinkingStateTimeoutDetector.startMonitoring(checkIntervalMs);
}

/**
 * Stop timeout monitoring
 */
export function stopTimeoutMonitoring(): void {
  thinkingStateTimeoutDetector.stopMonitoring();
}

/**
 * Get timeout event history
 */
export function getTimeoutEvents(): TimeoutEvent[] {
  return thinkingStateTimeoutDetector.getTimeoutEvents();
}

/**
 * Clear timeout event history
 */
export function clearTimeoutHistory(): void {
  thinkingStateTimeoutDetector.clearTimeoutHistory();
}

export default {
  initialize: initializeTimeoutDetector,
  start: startTimeoutMonitoring,
  stop: stopTimeoutMonitoring,
  getEvents: getTimeoutEvents,
  clearHistory: clearTimeoutHistory
};