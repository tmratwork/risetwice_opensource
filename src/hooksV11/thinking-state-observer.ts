// src/hooksV11/thinking-state-observer.ts

/**
 * Thinking State Observer
 * 
 * Non-invasive monitoring of thinking state across multiple sources.
 * This observer only reads from existing state sources without modifying them.
 * It provides a consolidated view of thinking state for more accurate diagnostics.
 */

// Define types for the various thinking state sources
interface WindowWithThinkingState {
  __messageFlowState?: {
    lastThinkingStartTime?: number;
    lastThinkingResetTime?: number;
    lastThinkingSource?: string;
    lastThinkingResetSource?: string;
    thinkingSetCount?: number;
    thinkingResetCount?: number;
    lastResetDuration?: number | null;
  };
}

// State snapshots for comparison and history tracking
interface ThinkingStateSnapshot {
  timestamp: number;
  isThinking: boolean;
  sources: {
    messageFlowStartTime: number | null;
    messageFlowResetTime: number | null;
    messageFlowIsThinking: boolean | null;
    diagnosticDataStartTime: number | null;
    refIsThinking: boolean | null;
  };
  computedDuration: number | null;
  inconsistencies: string[];
}

interface ObserverOptions {
  pollingInterval?: number;
  historyLimit?: number;
  logLevel?: 'debug' | 'info' | 'warning' | 'error' | 'none';
}

// Singleton class for thinking state observation
class ThinkingStateObserver {
  private static instance: ThinkingStateObserver;
  
  private isObserving: boolean = false;
  private pollingInterval: number = 1000; // Default polling interval in ms
  private historyLimit: number = 100; // Maximum number of history entries to keep
  private logLevel: string = 'warning'; // Default log level
  
  // History of state snapshots for trend analysis
  private stateHistory: ThinkingStateSnapshot[] = [];
  
  // References to external state sources that we'll observe
  private reactDiagnosticData: Record<string, unknown> | null = null;
  private reactIsThinkingRef: { current: boolean } | null = null;
  
  // Interval ID for polling
  private pollingId: number | null = null;
  
  // Subscribers to state changes
  private subscribers: Set<(snapshot: ThinkingStateSnapshot) => void> = new Set();
  
  private constructor() {
    // Initialize with empty state
    this.capture(); // Take an initial snapshot without subscribers
  }
  
  public static getInstance(): ThinkingStateObserver {
    if (!ThinkingStateObserver.instance) {
      ThinkingStateObserver.instance = new ThinkingStateObserver();
    }
    return ThinkingStateObserver.instance;
  }
  
  /**
   * Configure the observer with custom options
   */
  public configure(options: ObserverOptions): void {
    if (options.pollingInterval) this.pollingInterval = options.pollingInterval;
    if (options.historyLimit) this.historyLimit = options.historyLimit;
    if (options.logLevel) this.logLevel = options.logLevel;
    
    this.log('info', 'ThinkingStateObserver configured with options:', options);
  }
  
  /**
   * Provide React state references to observe (without modifying them)
   */
  public observeReactState(
    diagnosticData: Record<string, unknown> | null,
    isThinkingRef: { current: boolean } | null
  ): void {
    this.reactDiagnosticData = diagnosticData;
    this.reactIsThinkingRef = isThinkingRef;
    this.log('info', 'Now observing React state references');
  }
  
  /**
   * Start observing thinking state from all sources
   */
  public startObserving(): void {
    if (this.isObserving) return;
    
    this.isObserving = true;
    this.log('info', 'Starting thinking state observation');
    
    // Set up polling to regularly check state
    if (typeof window !== 'undefined') {
      // Use interval for regular polling
      this.pollingId = window.setInterval(() => {
        this.capture();
      }, this.pollingInterval);
    }
  }
  
  /**
   * Stop observing thinking state
   */
  public stopObserving(): void {
    if (!this.isObserving) return;
    
    this.isObserving = false;
    this.log('info', 'Stopping thinking state observation');
    
    // Clear polling interval
    if (this.pollingId !== null && typeof window !== 'undefined') {
      window.clearInterval(this.pollingId);
      this.pollingId = null;
    }
  }
  
  /**
   * Subscribe to state snapshots
   * @returns Unsubscribe function
   */
  public subscribe(callback: (snapshot: ThinkingStateSnapshot) => void): () => void {
    this.subscribers.add(callback);
    
    // Immediately send current state
    const latestSnapshot = this.getLatestSnapshot();
    if (latestSnapshot) {
      callback(latestSnapshot);
    }
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }
  
  /**
   * Get the latest thinking state snapshot
   */
  public getLatestSnapshot(): ThinkingStateSnapshot | null {
    if (this.stateHistory.length === 0) {
      this.capture(); // Take a snapshot if we don't have one
    }
    
    return this.stateHistory[this.stateHistory.length - 1] || null;
  }
  
  /**
   * Get the consolidated thinking state (best determination from all sources)
   */
  public getConsolidatedState(): {
    isThinking: boolean;
    duration: number | null;
    startTime: number | null;
    source: string | null;
  } {
    const snapshot = this.getLatestSnapshot();
    if (!snapshot) {
      return { 
        isThinking: false, 
        duration: null, 
        startTime: null, 
        source: null 
      };
    }
    
    // Return the consolidated state from the snapshot
    const windowState = typeof window !== 'undefined' 
      ? (window as unknown as WindowWithThinkingState).__messageFlowState 
      : undefined;
    
    return {
      isThinking: snapshot.isThinking,
      duration: snapshot.computedDuration,
      startTime: windowState?.lastThinkingStartTime || null,
      source: windowState?.lastThinkingSource || null
    };
  }
  
  /**
   * Calculate thinking duration from the most reliable source
   */
  public calculateThinkingDuration(): number | null {
    if (typeof window === 'undefined') return null;
    
    const windowState = (window as unknown as WindowWithThinkingState).__messageFlowState;
    if (!windowState) return null;
    
    const now = Date.now();
    
    // If we have both start and reset times, use those for completed thinking periods
    if (windowState.lastThinkingResetTime && windowState.lastThinkingStartTime) {
      // If reset time is after start time, thinking period is complete
      if (windowState.lastThinkingResetTime > windowState.lastThinkingStartTime) {
        return windowState.lastThinkingResetTime - windowState.lastThinkingStartTime;
      }
    }
    
    // For ongoing thinking, use start time to current time
    if (windowState.lastThinkingStartTime) {
      // Avoid returning negative values (epoch timestamp would cause huge negative value)
      const startTime = windowState.lastThinkingStartTime;
      if (startTime > 0 && startTime < now) {
        return now - startTime;
      }
    }
    
    // If we have a stored duration from last reset, use that
    if (windowState.lastResetDuration) {
      return windowState.lastResetDuration;
    }
    
    return null;
  }
  
  /**
   * Check for inconsistencies between different thinking state sources
   */
  public detectStateInconsistencies(): string[] {
    const snapshot = this.getLatestSnapshot();
    return snapshot ? snapshot.inconsistencies : [];
  }
  
  /**
   * Generate a detailed diagnostic report of thinking state
   */
  public generateDiagnosticReport(): Record<string, unknown> {
    // Get current state snapshot
    const snapshot = this.getLatestSnapshot();
    
    // Get window state
    const windowState = typeof window !== 'undefined' 
      ? (window as unknown as WindowWithThinkingState).__messageFlowState
      : undefined;
    
    // Generate report
    return {
      currentState: this.getConsolidatedState(),
      stateSnapshot: snapshot,
      windowState: windowState || null,
      reactDiagnosticData: this.reactDiagnosticData || null,
      reactRefState: this.reactIsThinkingRef ? { current: this.reactIsThinkingRef.current } : null,
      historyEntries: this.stateHistory.length,
      isObserving: this.isObserving,
      inconsistencies: this.detectStateInconsistencies(),
      timestamp: Date.now()
    };
  }
  
  /**
   * Get history of state changes within a time window
   */
  public getStateHistory(lastMilliseconds: number = 60000): ThinkingStateSnapshot[] {
    const now = Date.now();
    const cutoff = now - lastMilliseconds;
    
    return this.stateHistory.filter(snapshot => snapshot.timestamp >= cutoff);
  }
  
  /**
   * Capture current thinking state from all sources
   */
  private capture(): void {
    if (typeof window === 'undefined') return;
    
    const now = Date.now();
    
    // Get window state
    const windowState = (window as unknown as WindowWithThinkingState).__messageFlowState;
    
    // Determine thinking state from each source
    const messageFlowStartTime = windowState?.lastThinkingStartTime || null;
    const messageFlowResetTime = windowState?.lastThinkingResetTime || null;
    
    // Determine if thinking based on message flow state
    // We're thinking if start time is more recent than reset time
    let messageFlowIsThinking = false;
    if (messageFlowStartTime && messageFlowResetTime) {
      messageFlowIsThinking = messageFlowStartTime > messageFlowResetTime;
    } else if (messageFlowStartTime) {
      messageFlowIsThinking = true;
    }
    
    // Get React state if available
    const diagnosticDataStartTime = this.reactDiagnosticData?.thinkingStartTime || null;
    const refIsThinking = this.reactIsThinkingRef?.current ?? null;
    
    // Detect inconsistencies
    const inconsistencies: string[] = [];
    
    // Check for mismatch between different state sources
    if (messageFlowIsThinking !== null && refIsThinking !== null && messageFlowIsThinking !== refIsThinking) {
      inconsistencies.push('messageFlow_ref_mismatch');
    }
    
    const messageFlowStartTimeNum = typeof messageFlowStartTime === 'number' ? messageFlowStartTime : 0;
    const diagnosticDataStartTimeNum = typeof diagnosticDataStartTime === 'number' ? diagnosticDataStartTime : 0;
    
    // Check for mismatch in start times
    if (messageFlowStartTimeNum && diagnosticDataStartTimeNum && 
        Math.abs(messageFlowStartTimeNum - diagnosticDataStartTimeNum) > 5000 &&
        diagnosticDataStartTimeNum > 100000) { // Ignore epoch timestamps
      inconsistencies.push('startTime_mismatch');
    }
    
    // Check for invalid start times
    if (messageFlowStartTimeNum > now) {
      inconsistencies.push('future_start_time');
    }
    
    // Check for stale start times (older than 1 hour)
    if (messageFlowStartTimeNum > 100000 && (now - messageFlowStartTimeNum > 3600000)) {
      inconsistencies.push('stale_start_time');
    }
    
    // Check for invalid message flow state
    if (windowState) {
      // Inconsistent state counter values
      if (windowState.thinkingSetCount !== undefined && 
          windowState.thinkingResetCount !== undefined && 
          Math.abs(windowState.thinkingSetCount - windowState.thinkingResetCount) > 3) {
        inconsistencies.push('excessive_state_counter_diff');
      }
      
      // Start time but no source
      if (windowState.lastThinkingStartTime && !windowState.lastThinkingSource) {
        inconsistencies.push('missing_source');
      }
      
      // Reset time after start, but still thinking
      if (windowState.lastThinkingResetTime && 
          windowState.lastThinkingStartTime && 
          windowState.lastThinkingResetTime > windowState.lastThinkingStartTime && 
          messageFlowIsThinking) {
        inconsistencies.push('reset_after_start_but_thinking');
      }
    }
    
    // Calculate duration based on the most reliable source
    const computedDuration = this.calculateThinkingDuration();
    
    // Consolidated thinking state (messageFlow is the most reliable source)
    // Changed from OR to more accurate determination - if messageFlow is defined, trust it
    // otherwise fall back to the React ref
    const isThinking = messageFlowIsThinking !== null ? messageFlowIsThinking : (refIsThinking || false);
    
    // Create snapshot
    const snapshot: ThinkingStateSnapshot = {
      timestamp: now,
      isThinking,
      sources: {
        messageFlowStartTime: messageFlowStartTimeNum,
        messageFlowResetTime: typeof messageFlowResetTime === 'number' ? messageFlowResetTime : null,
        messageFlowIsThinking,
        diagnosticDataStartTime: diagnosticDataStartTimeNum,
        refIsThinking
      },
      computedDuration,
      inconsistencies
    };
    
    // Add to history
    this.stateHistory.push(snapshot);
    
    // Limit history size
    if (this.stateHistory.length > this.historyLimit) {
      this.stateHistory = this.stateHistory.slice(-this.historyLimit);
    }
    
    // Log significant changes
    if (inconsistencies.length > 0) {
      this.log('warning', 'Thinking state inconsistencies detected:', inconsistencies, snapshot);
    }
    
    // Notify subscribers
    this.notifySubscribers(snapshot);
  }
  
  /**
   * Notify all subscribers of state changes
   */
  private notifySubscribers(snapshot: ThinkingStateSnapshot): void {
    this.subscribers.forEach(callback => {
      try {
        callback(snapshot);
      } catch (error) {
        this.log('error', 'Error in thinking state subscriber:', error);
      }
    });
  }
  
  /**
   * Log messages based on configured log level
   */
  private log(level: string, ...args: unknown[]): void {
    const logLevels = {
      debug: 0,
      info: 1,
      warning: 2,
      error: 3,
      none: 4
    };
    
    const configuredLevel = logLevels[this.logLevel as keyof typeof logLevels] || 2;
    const messageLevel = logLevels[level as keyof typeof logLevels] || 0;
    
    if (messageLevel >= configuredLevel) {
      const prefix = `[ThinkingStateObserver]`;
      
      switch (level) {
        case 'debug':
          console.debug(prefix, ...args);
          break;
        case 'info':
          console.log(prefix, ...args);
          break;
        case 'warning':
          console.warn(prefix, ...args);
          break;
        case 'error':
          console.error(prefix, ...args);
          break;
      }
    }
  }
}

// Export singleton instance
export default ThinkingStateObserver.getInstance();