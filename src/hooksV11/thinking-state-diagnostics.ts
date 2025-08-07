// src/hooksV11/thinking-state-diagnostics.ts

import thinkingStateObserver from './thinking-state-observer';

/**
 * Comprehensive diagnostics for thinking state issues
 * Provides detailed analysis, warning detection, and recovery suggestions
 */

// Define log entry for thinking state events
interface ThinkingStateLogEntry {
  timestamp: number;
  eventType: 'thinking_started' | 'thinking_ended' | 'warning_threshold' | 'inconsistency_detected' | 'diagnostic_snapshot';
  duration: number | null;
  source: string | null;
  details: Record<string, unknown>;
}

// Define warning thresholds
interface WarningThresholds {
  extended: number;       // Duration considered "extended" thinking (warning)
  prolonged: number;      // Duration considered "prolonged" thinking (error)
  critical: number;       // Duration considered "critical" (potential stuck state)
  inconsistencyCount: number;  // Number of consecutive inconsistencies before warning
}

class ThinkingStateDiagnostics {
  private static instance: ThinkingStateDiagnostics;
  
  // Event log for thinking state
  private eventLog: ThinkingStateLogEntry[] = [];
  
  // Warning thresholds (in milliseconds)
  private thresholds: WarningThresholds = {
    extended: 5000,    // 5 seconds
    prolonged: 15000,  // 15 seconds
    critical: 30000,   // 30 seconds
    inconsistencyCount: 3
  };
  
  // Current warning state
  private warningState: {
    lastWarningTime: number | null;
    warningCount: number;
    inconsistencyCount: number;
    activeDiagnosticId: string | null;
  } = {
    lastWarningTime: null,
    warningCount: 0,
    inconsistencyCount: 0,
    activeDiagnosticId: null
  };
  
  // Timer for periodic monitoring
  private monitoringTimer: number | null = null;
  
  // Subscribers for diagnostic events
  private subscribers: Set<(level: string, message: string, data: Record<string, unknown>) => void> = new Set();
  
  private constructor() {
    // Initialization happens in startMonitoring
  }
  
  public static getInstance(): ThinkingStateDiagnostics {
    if (!ThinkingStateDiagnostics.instance) {
      ThinkingStateDiagnostics.instance = new ThinkingStateDiagnostics();
    }
    return ThinkingStateDiagnostics.instance;
  }
  
  /**
   * Configure warning thresholds
   */
  public configureThresholds(thresholds: Partial<WarningThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds
    };
    console.log('[ThinkingStateDiagnostics] Configured with thresholds:', this.thresholds);
  }
  
  /**
   * Start diagnostic monitoring of thinking state
   */
  public startMonitoring(checkIntervalMs: number = 1000): void {
    // Make sure observer is running
    thinkingStateObserver.startObserving();
    
    // Clear any existing timer
    if (this.monitoringTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.monitoringTimer);
    }
    
    // Start periodic monitoring
    if (typeof window !== 'undefined') {
      this.monitoringTimer = window.setInterval(() => {
        this.checkThinkingState();
      }, checkIntervalMs);
      
      console.log('[ThinkingStateDiagnostics] Started monitoring with interval:', checkIntervalMs);
    }
  }
  
  /**
   * Stop diagnostic monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
      console.log('[ThinkingStateDiagnostics] Stopped monitoring');
    }
  }
  
  /**
   * Subscribe to diagnostic events
   * @returns unsubscribe function
   */
  public subscribe(callback: (level: string, message: string, data: Record<string, unknown>) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }
  
  /**
   * Get event log for a specific time period
   */
  public getEventLog(lastMilliseconds: number = 60000): ThinkingStateLogEntry[] {
    const now = Date.now();
    const cutoff = now - lastMilliseconds;
    
    return this.eventLog.filter(entry => entry.timestamp >= cutoff);
  }
  
  /**
   * Get current thinking state diagnostic information
   */
  public getCurrentDiagnostics(): {
    isThinking: boolean;
    duration: number | null;
    formattedDuration: string;
    source: string | null;
    warningLevel: 'none' | 'warning' | 'error' | 'critical';
    inconsistencies: string[];
    detailedState: Record<string, unknown>;
  } {
    const state = thinkingStateObserver.getConsolidatedState();
    const inconsistencies = thinkingStateObserver.detectStateInconsistencies();
    const duration = state.duration || 0;
    
    // Determine warning level
    let warningLevel: 'none' | 'warning' | 'error' | 'critical' = 'none';
    
    if (state.isThinking) {
      if (duration >= this.thresholds.critical) {
        warningLevel = 'critical';
      } else if (duration >= this.thresholds.prolonged) {
        warningLevel = 'error';
      } else if (duration >= this.thresholds.extended) {
        warningLevel = 'warning';
      }
    }
    
    // If we have inconsistencies, escalate the warning level
    if (inconsistencies.length > 0) {
      if (warningLevel === 'none') warningLevel = 'warning';
      else if (warningLevel === 'warning') warningLevel = 'error';
    }
    
    // Format duration
    const formattedDuration = this.formatDuration(duration);
    
    return {
      isThinking: state.isThinking,
      duration,
      formattedDuration,
      source: state.source,
      warningLevel,
      inconsistencies,
      detailedState: thinkingStateObserver.generateDiagnosticReport()
    };
  }
  
  /**
   * Create a diagnostic snapshot
   * @param note Optional descriptive note for the snapshot
   * @returns The diagnostic ID for the snapshot
   */
  public createSnapshot(note: string = 'Diagnostic snapshot'): string {
    const diagnosticId = `diag-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const state = thinkingStateObserver.getConsolidatedState();
    const fullReport = thinkingStateObserver.generateDiagnosticReport();
    
    // Create log entry
    const entry: ThinkingStateLogEntry = {
      timestamp: Date.now(),
      eventType: 'diagnostic_snapshot',
      duration: state.duration,
      source: state.source,
      details: {
        diagnosticId,
        note,
        isThinking: state.isThinking,
        inconsistencies: thinkingStateObserver.detectStateInconsistencies(),
        fullReport
      }
    };
    
    // Add to log
    this.eventLog.push(entry);
    
    // Limit log size
    if (this.eventLog.length > 100) {
      this.eventLog = this.eventLog.slice(-100);
    }
    
    console.log(`[ThinkingStateDiagnostics] Created snapshot ${diagnosticId}: ${note}`);
    return diagnosticId;
  }
  
  /**
   * Generate recovery suggestions based on current state
   */
  public getRecoverySuggestions(): {
    suggestions: string[];
    actions: Array<{
      label: string;
      description: string;
      action: () => void;
    }>;
    diagnosticId: string;
  } {
    const state = this.getCurrentDiagnostics();
    const diagnosticId = this.createSnapshot('Recovery analysis');
    
    const suggestions: string[] = [];
    const actions: Array<{
      label: string;
      description: string;
      action: () => void;
    }> = [];
    
    // Generate suggestions based on current state
    if (state.isThinking && state.duration && state.duration > this.thresholds.critical) {
      // Critical duration - likely stuck
      suggestions.push('The AI thinking state appears to be stuck.');
      suggestions.push('This may indicate a connection issue or an internal processing error.');
      suggestions.push('Try refreshing the page to establish a new connection.');
      
      actions.push({
        label: 'Refresh Page',
        description: 'Reload the page to establish a new connection',
        action: () => {
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }
      });
    } else if (state.isThinking && state.duration && state.duration > this.thresholds.prolonged) {
      // Prolonged duration - potential issue
      suggestions.push('The AI has been thinking for an extended period.');
      suggestions.push('This might be a complex query or a potential connection issue.');
      suggestions.push('Consider asking a simpler question or refreshing if this persists.');
      
      if (state.inconsistencies.length > 0) {
        suggestions.push('There are inconsistencies in the thinking state tracking, which may indicate a UI synchronization issue.');
      }
    } else if (state.inconsistencies.length > 0) {
      // Inconsistencies detected
      suggestions.push('There are inconsistencies in the thinking state tracking.');
      suggestions.push('This is likely a UI issue rather than a functional problem.');
      suggestions.push('The application should continue to work normally despite these warnings.');
    }
    
    // Add diagnostic information
    actions.push({
      label: 'Export Diagnostics',
      description: 'Save diagnostic information for troubleshooting',
      action: () => this.exportDiagnostics()
    });
    
    return {
      suggestions,
      actions,
      diagnosticId
    };
  }
  
  /**
   * Export diagnostic data for troubleshooting
   */
  public exportDiagnostics(): void {
    const now = Date.now();
    
    // Create snapshot
    const diagnosticId = this.createSnapshot('Exported diagnostics');
    
    // Prepare data
    const diagnosticData = {
      diagnosticId,
      timestamp: now,
      formattedTime: new Date(now).toISOString(),
      currentState: this.getCurrentDiagnostics(),
      eventLog: this.eventLog,
      thresholds: this.thresholds,
      warningState: this.warningState,
      observer: {
        latestSnapshot: thinkingStateObserver.getLatestSnapshot(),
        report: thinkingStateObserver.generateDiagnosticReport()
      }
    };
    
    // Export as JSON
    const dataStr = JSON.stringify(diagnosticData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    
    // Create download if in browser
    if (typeof window !== 'undefined') {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thinking-state-diagnostics-${diagnosticId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`[ThinkingStateDiagnostics] Exported diagnostics ${diagnosticId}`);
      return;
    }
    
    // Log export
    console.log(`[ThinkingStateDiagnostics] Diagnostic data ${diagnosticId}:`, diagnosticData);
  }
  
  /**
   * Check thinking state and trigger warnings if needed
   */
  private checkThinkingState(): void {
    const state = thinkingStateObserver.getConsolidatedState();
    const inconsistencies = thinkingStateObserver.detectStateInconsistencies();
    const now = Date.now();
    
    // Update inconsistency counter
    if (inconsistencies.length > 0) {
      this.warningState.inconsistencyCount++;
      
      // Log inconsistency
      if (this.warningState.inconsistencyCount >= this.thresholds.inconsistencyCount) {
        this.logEvent('inconsistency_detected', state, {
          inconsistencies,
          count: this.warningState.inconsistencyCount
        });
        
        // Notify subscribers
        this.notifySubscribers('warning', 
          `Persistent thinking state inconsistencies detected (${this.warningState.inconsistencyCount} occurrences)`,
          { inconsistencies, state }
        );
        
        // Reset counter after notification
        this.warningState.inconsistencyCount = 0;
      }
    } else {
      // Reset inconsistency counter
      this.warningState.inconsistencyCount = 0;
    }
    
    // Early return if not thinking
    if (!state.isThinking) {
      return;
    }
    
    // Check duration thresholds
    const duration = state.duration || 0;
    
    // Generate warnings based on thresholds
    if (duration >= this.thresholds.critical && 
        (!this.warningState.lastWarningTime || 
         now - this.warningState.lastWarningTime > 10000)) {
      // Critical threshold
      this.logEvent('warning_threshold', state, {
        threshold: 'critical',
        durationMs: duration
      });
      
      // Notify subscribers
      this.notifySubscribers('error', 
        `Critical thinking duration detected: ${this.formatDuration(duration)}`,
        { duration, threshold: this.thresholds.critical, state }
      );
      
      // Update warning state
      this.warningState.lastWarningTime = now;
      this.warningState.warningCount++;
      
      // Create a diagnostic snapshot for critical warnings
      if (!this.warningState.activeDiagnosticId) {
        this.warningState.activeDiagnosticId = this.createSnapshot('Critical thinking duration');
      }
    } else if (duration >= this.thresholds.prolonged && 
              (!this.warningState.lastWarningTime || 
               now - this.warningState.lastWarningTime > 10000)) {
      // Prolonged threshold
      this.logEvent('warning_threshold', state, {
        threshold: 'prolonged',
        durationMs: duration
      });
      
      // Notify subscribers
      this.notifySubscribers('warning', 
        `Prolonged thinking duration detected: ${this.formatDuration(duration)}`,
        { duration, threshold: this.thresholds.prolonged, state }
      );
      
      // Update warning state
      this.warningState.lastWarningTime = now;
      this.warningState.warningCount++;
    } else if (duration >= this.thresholds.extended && 
              (!this.warningState.lastWarningTime || 
               now - this.warningState.lastWarningTime > 15000)) {
      // Extended threshold
      this.logEvent('warning_threshold', state, {
        threshold: 'extended',
        durationMs: duration
      });
      
      // Notify subscribers
      this.notifySubscribers('info', 
        `Extended thinking duration detected: ${this.formatDuration(duration)}`,
        { duration, threshold: this.thresholds.extended, state }
      );
      
      // Update warning state
      this.warningState.lastWarningTime = now;
    }
  }
  
  /**
   * Log a thinking state event
   */
  private logEvent(
    eventType: ThinkingStateLogEntry['eventType'],
    state: {
      isThinking: boolean;
      duration: number | null;
      startTime: number | null;
      source: string | null;
    },
    details: Record<string, unknown> = {}
  ): void {
    const entry: ThinkingStateLogEntry = {
      timestamp: Date.now(),
      eventType,
      duration: state.duration,
      source: state.source,
      details: {
        ...details,
        isThinking: state.isThinking,
        startTime: state.startTime
      }
    };
    
    // Add to log
    this.eventLog.push(entry);
    
    // Limit log size
    if (this.eventLog.length > 100) {
      this.eventLog = this.eventLog.slice(-100);
    }
  }
  
  /**
   * Notify subscribers of diagnostic events
   */
  private notifySubscribers(level: string, message: string, data: Record<string, unknown>): void {
    this.subscribers.forEach(callback => {
      try {
        callback(level, message, data);
      } catch (error) {
        console.error('[ThinkingStateDiagnostics] Error in subscriber callback:', error);
      }
    });
  }
  
  /**
   * Format duration for display
   */
  private formatDuration(ms: number | null): string {
    if (ms === null) return 'unknown';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }
}

// Export singleton instance
export default ThinkingStateDiagnostics.getInstance();