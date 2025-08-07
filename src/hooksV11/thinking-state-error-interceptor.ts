// src/hooksV11/thinking-state-error-interceptor.ts

import thinkingStateObserver from './thinking-state-observer';

/**
 * Error Interceptor for Thinking State Warnings
 * 
 * This module intercepts console error messages related to thinking state
 * and augments them with better diagnostic information. It also prevents
 * false positives based on consolidated data.
 * 
 * This approach is non-invasive and doesn't modify any WebRTC functionality.
 */

interface InterceptOptions {
  suppressFalsePositives?: boolean;
  enhanceMessages?: boolean;
  logLevel?: 'debug' | 'info' | 'warning' | 'error';
}

class ThinkingStateErrorInterceptor {
  private static instance: ThinkingStateErrorInterceptor;
  
  private originalConsoleError: typeof console.error;
  private isInstalled: boolean = false;
  private options: InterceptOptions = {
    suppressFalsePositives: true,
    enhanceMessages: true,
    logLevel: 'warning'
  };
  
  private constructor() {
    // Store original console methods
    this.originalConsoleError = console.error;
  }
  
  public static getInstance(): ThinkingStateErrorInterceptor {
    if (!ThinkingStateErrorInterceptor.instance) {
      ThinkingStateErrorInterceptor.instance = new ThinkingStateErrorInterceptor();
    }
    return ThinkingStateErrorInterceptor.instance;
  }
  
  /**
   * Configure the interceptor
   */
  public configure(options: InterceptOptions): void {
    this.options = { ...this.options, ...options };
    console.log('[ThinkingStateErrorInterceptor] Configured with options:', this.options);
  }
  
  /**
   * Install the console error interceptor
   */
  public install(): void {
    if (this.isInstalled || typeof window === 'undefined') return;
    
    // Store the original method
    this.originalConsoleError = console.error;
    
    // Replace with our interceptor
    console.error = (...args: unknown[]) => {
      // Check if this is a thinking state error we want to intercept
      if (this.isThinkingStateError(args)) {
        this.handleThinkingStateError(args);
      } else {
        // Pass through to original handler
        this.originalConsoleError.apply(console, args);
      }
    };
    
    this.isInstalled = true;
    console.log('[ThinkingStateErrorInterceptor] Installed');
  }
  
  /**
   * Uninstall the interceptor and restore original console methods
   */
  public uninstall(): void {
    if (!this.isInstalled || typeof window === 'undefined') return;
    
    // Restore original methods
    console.error = this.originalConsoleError;
    
    this.isInstalled = false;
    console.log('[ThinkingStateErrorInterceptor] Uninstalled');
  }
  
  /**
   * Check if an error message is related to thinking state
   */
  private isThinkingStateError(args: unknown[]): boolean {
    if (args.length === 0) return false;
    
    const firstArg = String(args[0] || '');
    
    // Match thinking state error patterns
    return firstArg.includes('Still in thinking state') || 
           firstArg.includes('THINKING-STATE-DEBUG') ||
           firstArg.includes('Connection states:') && args.some(arg => 
             String(arg || '').includes('thinking state')
           );
  }
  
  /**
   * Handle thinking state errors with enhanced diagnostics
   */
  private handleThinkingStateError(args: unknown[]): void {
    // Get current thinking state from observer
    const consolidatedState = thinkingStateObserver.getConsolidatedState();
    const diagnosticReport = thinkingStateObserver.generateDiagnosticReport();
    const inconsistencies = thinkingStateObserver.detectStateInconsistencies();
    
    // Check if this might be a false positive
    const isPossiblyFalsePositive = !consolidatedState.isThinking || 
                                   (consolidatedState.duration !== null && consolidatedState.duration < 10000) ||
                                   inconsistencies.length > 0;
    
    // Extract message ID from error message
    const msgIdMatch = String(args[0] || '').match(/\[USER-TRANSCRIPT-([^\]]+)\]/);
    const msgId = msgIdMatch ? msgIdMatch[1] : 'unknown';
    
    // If suppressing false positives and this looks like one, handle accordingly
    if (this.options.suppressFalsePositives && isPossiblyFalsePositive) {
      // Log as warning instead of error
      console.warn(`[ThinkingStateErrorInterceptor] Possible false positive thinking state warning:`, args[0]);
      console.warn(`[ThinkingStateErrorInterceptor] Consolidated state shows:`, 
        `isThinking=${consolidatedState.isThinking}`,
        `duration=${consolidatedState.duration !== null ? `${consolidatedState.duration}ms` : 'unknown'}`
      );
      
      if (inconsistencies.length > 0) {
        console.warn(`[ThinkingStateErrorInterceptor] Detected state inconsistencies:`, inconsistencies);
      }
      
      return; // Don't pass to original error handler
    }
    
    // If enhancing messages, add better diagnostics
    if (this.options.enhanceMessages) {
      // Call original error with original message
      this.originalConsoleError.apply(console, args);
      
      // Add enhanced diagnostic information
      this.originalConsoleError(
        `[THINKING-STATE-ENHANCED-${msgId}] Enhanced thinking state diagnostics:`,
        {
          isCurrentlyThinking: consolidatedState.isThinking,
          thinkingDuration: consolidatedState.duration !== null ? `${(consolidatedState.duration / 1000).toFixed(1)}s` : 'unknown',
          thinkingStartTime: consolidatedState.startTime 
            ? new Date(consolidatedState.startTime).toISOString() 
            : 'unknown',
          thinkingSource: consolidatedState.source || 'unknown',
          stateInconsistencies: inconsistencies,
          messageFlowState: diagnosticReport.windowState,
          currentTimestamp: new Date().toISOString()
        }
      );
      
      // Add recovery advice
      this.originalConsoleError(
        `[THINKING-STATE-ENHANCED-${msgId}] Recommended action:`,
        isPossiblyFalsePositive 
          ? 'This appears to be a false positive. No action needed.'
          : 'The AI may be stuck processing. Consider refreshing the page if the issue persists.'
      );
    } else {
      // Just pass through to original handler
      this.originalConsoleError.apply(console, args);
    }
  }
}

// Create and export singleton
const thinkingStateErrorInterceptor = ThinkingStateErrorInterceptor.getInstance();

/**
 * Install the interceptor with default options
 */
export function installThinkingStateErrorInterceptor(options: InterceptOptions = {}): void {
  // Configure with options
  thinkingStateErrorInterceptor.configure(options);
  
  // Install the interceptor
  thinkingStateErrorInterceptor.install();
  
  // Make sure thinking state observer is running
  thinkingStateObserver.startObserving();
}

/**
 * Uninstall the interceptor
 */
export function uninstallThinkingStateErrorInterceptor(): void {
  thinkingStateErrorInterceptor.uninstall();
}

export default {
  install: installThinkingStateErrorInterceptor,
  uninstall: uninstallThinkingStateErrorInterceptor
};