// src/hooksV11/enhanced-error-interceptor.ts

/**
 * Enhanced Error Interceptor for WebRTC and Thinking State
 * 
 * This module provides advanced error interception capabilities:
 * 1. Intercepts WebRTC-related console errors
 * 2. Enhances error messages with detailed diagnostics
 * 3. Prevents false positives based on consolidated state data
 * 4. Provides recovery suggestions in the console
 * 5. Adds debugging context to help resolve issues
 */

import thinkingStateObserver from './thinking-state-observer';
import thinkingStateDiagnostics from './thinking-state-diagnostics';

// Pattern matchers for different error types
const ERROR_PATTERNS = {
  THINKING_STATE: [
    /Still in thinking state/i,
    /THINKING-STATE-DEBUG/i,
    /thinking state \d+s after/i
  ],
  WEBRTC_CONNECTION: [
    /WebRTC connection failed/i,
    /ICE connection state changed to failed/i,
    /Could not establish connection/i,
    /Connection states: DC=/i,
    /Peer connection is not stable/i
  ],
  WEBRTC_DATA_CHANNEL: [
    /Data channel.*closed/i,
    /Data channel.*closing/i,
    /Data channel.*error/i,
    /Could not send message on data channel/i,
    /Error in dataChannel/i
  ],
  API_ERROR: [
    /The server had an error/i,
    /API Error:/i,
    /OpenAI API error/i,
    /conversation_already_has_active_response/i,
    /Client error:/i
  ],
  AUDIO: [
    /Audio playback error/i,
    /Audio element error/i,
    /Could not play audio/i,
    /Error creating audio/i
  ]
};

// Configuration options for interceptor
interface ErrorInterceptorConfig {
  // Whether to intercept specific error types
  interceptThinkingStateErrors?: boolean;
  interceptWebRTCErrors?: boolean;
  interceptAPIErrors?: boolean;
  interceptAudioErrors?: boolean;
  
  // Error handling options
  suppressFalsePositives?: boolean;
  enhanceErrorMessages?: boolean;
  addRecoverySuggestions?: boolean;
  logDiagnosticIds?: boolean;
  
  // Whether to track global error frequency
  trackErrorFrequency?: boolean;
  
  // How many errors to keep in history
  errorHistoryLimit?: number;
  
  // Whether to provide automatic fixes for common issues
  enableAutoFixes?: boolean;
}

// Error tracking data structure
export interface TrackedError {
  timestamp: number;
  type: string;
  originalMessage: string;
  enhancedMessage?: string;
  diagnosticId?: string;
  recoveryAttempted?: boolean;
  isFalsePositive?: boolean;
  detailedContext?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Enhanced Error Interceptor singleton class
 */
class EnhancedErrorInterceptor {
  private static instance: EnhancedErrorInterceptor;
  
  // Original console methods
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;
  
  // Installation state
  private isInstalled: boolean = false;
  
  // Error tracking
  private errorHistory: TrackedError[] = [];
  private errorFrequency: Record<string, number> = {};
  
  // Configuration
  private config: ErrorInterceptorConfig = {
    interceptThinkingStateErrors: true,
    interceptWebRTCErrors: true,
    interceptAPIErrors: true,
    interceptAudioErrors: true,
    suppressFalsePositives: true,
    enhanceErrorMessages: true,
    addRecoverySuggestions: true,
    logDiagnosticIds: true,
    trackErrorFrequency: true,
    errorHistoryLimit: 20,
    enableAutoFixes: false,
  };
  
  private constructor() {
    // Store original console methods
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;
  }
  
  public static getInstance(): EnhancedErrorInterceptor {
    if (!EnhancedErrorInterceptor.instance) {
      EnhancedErrorInterceptor.instance = new EnhancedErrorInterceptor();
    }
    return EnhancedErrorInterceptor.instance;
  }
  
  /**
   * Configure the error interceptor
   */
  public configure(config: ErrorInterceptorConfig): void {
    this.config = {
      ...this.config,
      ...config
    };
    
    // Log configuration
    if (typeof window !== 'undefined' && !this.isInstalled) {
      console.log('[EnhancedErrorInterceptor] Configured with options:', this.config);
    }
  }
  
  /**
   * Install the console error and warning interceptors
   */
  public install(): void {
    if (this.isInstalled || typeof window === 'undefined') return;
    
    // Store the original methods
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;
    
    // Replace error method with our interceptor
    console.error = (...args: unknown[]) => {
      // Check if this is an error we want to intercept
      if (this.shouldInterceptError(args)) {
        this.handleInterceptedError(args, 'error');
      } else {
        // Pass through to original handler
        this.originalConsoleError.apply(console, args);
      }
    };
    
    // Replace warning method with our interceptor
    console.warn = (...args: unknown[]) => {
      // Check if this is a warning we want to intercept
      if (this.shouldInterceptError(args)) {
        this.handleInterceptedError(args, 'warning');
      } else {
        // Pass through to original handler
        this.originalConsoleWarn.apply(console, args);
      }
    };
    
    // Mark as installed
    this.isInstalled = true;
    
    // Add global reference for debugging
    if (typeof window !== 'undefined') {
      (window as Window & typeof globalThis & { __errorInterceptor?: Record<string, unknown> }).__errorInterceptor = {
        getErrorHistory: () => this.errorHistory,
        getErrorFrequency: () => this.errorFrequency,
        clearErrors: () => {
          this.errorHistory = [];
          this.errorFrequency = {};
        }
      };
    }
    
    console.log('[EnhancedErrorInterceptor] Installed');
  }
  
  /**
   * Uninstall the interceptors and restore original console methods
   */
  public uninstall(): void {
    if (!this.isInstalled || typeof window === 'undefined') return;
    
    // Restore original methods
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
    
    this.isInstalled = false;
    console.log('[EnhancedErrorInterceptor] Uninstalled');
  }
  
  /**
   * Check if a given error message should be intercepted
   */
  private shouldInterceptError(args: unknown[]): boolean {
    if (args.length === 0) return false;
    
    const message = this.getErrorMessage(args);
    
    // Check against patterns based on configuration
    if (this.config.interceptThinkingStateErrors && 
        this.matchesPatterns(message, ERROR_PATTERNS.THINKING_STATE)) {
      return true;
    }
    
    if (this.config.interceptWebRTCErrors && (
        this.matchesPatterns(message, ERROR_PATTERNS.WEBRTC_CONNECTION) ||
        this.matchesPatterns(message, ERROR_PATTERNS.WEBRTC_DATA_CHANNEL))) {
      return true;
    }
    
    if (this.config.interceptAPIErrors && 
        this.matchesPatterns(message, ERROR_PATTERNS.API_ERROR)) {
      return true;
    }
    
    if (this.config.interceptAudioErrors && 
        this.matchesPatterns(message, ERROR_PATTERNS.AUDIO)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if a message matches any of the given patterns
   */
  private matchesPatterns(message: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(message));
  }
  
  /**
   * Get the error message from console arguments
   */
  private getErrorMessage(args: unknown[]): string {
    const firstArg = args[0];
    if (typeof firstArg === 'string') {
      return firstArg;
    } else if (firstArg instanceof Error) {
      return firstArg.message;
    } else {
      return String(firstArg || '');
    }
  }
  
  /**
   * Get error type based on message content
   */
  private getErrorType(message: string): string {
    if (this.matchesPatterns(message, ERROR_PATTERNS.THINKING_STATE)) {
      return 'thinking_state';
    } else if (this.matchesPatterns(message, ERROR_PATTERNS.WEBRTC_CONNECTION)) {
      return 'webrtc_connection';
    } else if (this.matchesPatterns(message, ERROR_PATTERNS.WEBRTC_DATA_CHANNEL)) {
      return 'webrtc_data_channel';
    } else if (this.matchesPatterns(message, ERROR_PATTERNS.API_ERROR)) {
      return 'api_error';
    } else if (this.matchesPatterns(message, ERROR_PATTERNS.AUDIO)) {
      return 'audio_error';
    } else {
      return 'other';
    }
  }
  
  /**
   * Handle an intercepted error
   */
  private handleInterceptedError(args: unknown[], level: 'error' | 'warning'): void {
    const originalMessage = this.getErrorMessage(args);
    const errorType = this.getErrorType(originalMessage);
    
    // Track error frequency
    if (this.config.trackErrorFrequency) {
      this.errorFrequency[errorType] = (this.errorFrequency[errorType] || 0) + 1;
    }
    
    // Extract information from message (for thinking state errors)
    const msgIdMatch = originalMessage.match(/\[(?:USER-TRANSCRIPT|THINKING-STATE-DEBUG)-([^\]]+)\]/);
    const msgId = msgIdMatch ? msgIdMatch[1] : 'unknown';
    
    // For thinking state errors, check if it might be a false positive
    let isFalsePositive = false;
    if (errorType === 'thinking_state') {
      isFalsePositive = this.isThinkingStateFalsePositive();
    }
    
    // Create diagnostic snapshot for serious errors
    let diagnosticId: string | undefined = undefined;
    if (this.config.logDiagnosticIds && 
        (errorType !== 'thinking_state' || !isFalsePositive || !this.config.suppressFalsePositives)) {
      // Only create diagnostic snapshot for real errors or if we're not suppressing false positives
      diagnosticId = thinkingStateDiagnostics.createSnapshot(`Error intercepted: ${errorType}`);
    }
    
    // Track the error
    const trackedError: TrackedError = {
      timestamp: Date.now(),
      type: errorType,
      originalMessage,
      diagnosticId,
      isFalsePositive,
      detailedContext: this.gatherDiagnosticContext(errorType, msgId)
    };
    
    // Add to history
    this.errorHistory.push(trackedError);
    
    // Limit history size
    const historyLimit = this.config.errorHistoryLimit ?? 20; // Default to 20 if undefined
    if (this.errorHistory.length > historyLimit) {
      this.errorHistory = this.errorHistory.slice(-historyLimit);
    }
    
    // Handle based on error type and configuration
    if (errorType === 'thinking_state') {
      this.handleThinkingStateError(args, trackedError, level);
    } else if (errorType === 'webrtc_connection' || errorType === 'webrtc_data_channel') {
      this.handleWebRTCError(args, trackedError, level);
    } else if (errorType === 'api_error') {
      this.handleAPIError(args, trackedError, level);
    } else if (errorType === 'audio_error') {
      this.handleAudioError(args, trackedError, level);
    } else {
      // Pass through unknown error types
      const originalMethod = level === 'error' ? this.originalConsoleError : this.originalConsoleWarn;
      originalMethod.apply(console, args);
    }
  }
  
  /**
   * Check if a thinking state error is likely a false positive
   */
  private isThinkingStateFalsePositive(): boolean {
    // Get current thinking state from observer
    const state = thinkingStateObserver.getConsolidatedState();
    const inconsistencies = thinkingStateObserver.detectStateInconsistencies();
    
    // Check if this might be a false positive
    return !state.isThinking || 
           (state.duration !== null && state.duration < 5000) ||
           inconsistencies.length > 0 ||
           state.startTime === null || 
           state.startTime === 0;
  }
  
  /**
   * Gather diagnostic context based on error type
   */
  private gatherDiagnosticContext(errorType: string, msgId: string): Record<string, unknown> {
    const context: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      errorType,
      msgId
    };
    
    // Common data to all error types
    if (typeof window !== 'undefined') {
      // Add browser information
      context.userAgent = navigator.userAgent;
      context.url = window.location.href;
    }
    
    // Add thinking state info for thinking state errors
    if (errorType === 'thinking_state') {
      const state = thinkingStateObserver.getConsolidatedState();
      const diagnostics = thinkingStateDiagnostics.getCurrentDiagnostics();
      
      context.thinkingState = {
        isThinking: state.isThinking,
        duration: state.duration,
        startTime: state.startTime ? new Date(state.startTime).toISOString() : null,
        source: state.source,
        inconsistencies: thinkingStateObserver.detectStateInconsistencies()
      };
      
      context.warningLevel = diagnostics.warningLevel;
      
      // Add window message flow state if available
      if (typeof window !== 'undefined' && (window as Window & typeof globalThis & { __messageFlowState?: Record<string, unknown> }).__messageFlowState) {
        context.messageFlowState = (window as Window & typeof globalThis & { __messageFlowState?: Record<string, unknown> }).__messageFlowState;
      }
    }
    
    // Add WebRTC state for connection errors
    if (errorType === 'webrtc_connection' || errorType === 'webrtc_data_channel') {
      if (typeof window !== 'undefined') {
        // Try to get connection states from global vars
        const pc = (window as Window & typeof globalThis & { __pcState?: Record<string, unknown> }).__pcState;
        const dc = (window as Window & typeof globalThis & { __dcState?: Record<string, unknown> }).__dcState;
        
        if (pc) context.peerConnectionState = pc;
        if (dc) context.dataChannelState = dc;
      }
    }
    
    return context;
  }
  
  /**
   * Handle thinking state errors
   */
  private handleThinkingStateError(
    args: unknown[], 
    trackedError: TrackedError, 
    level: 'error' | 'warning'
  ): void {
    // Get the current thinking state first
    const state = thinkingStateObserver.getConsolidatedState();
    
    // Check if we're actually in thinking state - if not, this is definitely a false positive
    // This additional check helps prevent warnings when we're not actually thinking
    if (!state.isThinking) {
      // Only log in debug mode since this is a false positive
      if (this.config.enhanceErrorMessages) {
        this.originalConsoleWarn.call(
          console, 
          `[EnhancedErrorInterceptor] Completely suppressed false positive thinking state warning (not in thinking state):`,
          args[0]
        );
      }
      return; // Don't pass to original error handler or show any warning
    }
    
    // Get if this is a false positive for other reasons
    const isFalsePositive = trackedError.isFalsePositive;
    
    // If suppressing false positives and this is one, convert to warning
    if (this.config.suppressFalsePositives && isFalsePositive) {
      // Log as warning instead of error
      this.originalConsoleWarn.call(
        console, 
        `[EnhancedErrorInterceptor] Suppressed false positive thinking state warning:`,
        args[0]
      );
      
      if (this.config.enhanceErrorMessages) {
        const inconsistencies = thinkingStateObserver.detectStateInconsistencies();
        
        this.originalConsoleWarn.call(
          console,
          `[EnhancedErrorInterceptor] Consolidated state information:`,
          {
            isThinking: state.isThinking,
            duration: state.duration !== null ? `${(state.duration / 1000).toFixed(1)}s` : 'unknown',
            startTime: state.startTime 
              ? new Date(state.startTime).toISOString()
              : 'unknown',
            inconsistencies,
            falsePositiveReason: this.getFalsePositiveReason(state, inconsistencies)
          }
        );
      }
      
      return; // Don't pass to original error handler
    }
    
    // If enhancing messages, add better diagnostics
    if (this.config.enhanceErrorMessages) {
      // Call original error with original message
      const originalMethod = level === 'error' ? this.originalConsoleError : this.originalConsoleWarn;
      originalMethod.apply(console, args);
      
      // Get diagnostic information
      const inconsistencies = thinkingStateObserver.detectStateInconsistencies();
      
      // Extract message ID safely
      const firstArg = args[0];
      let msgId = 'unknown';
      
      if (firstArg !== null && firstArg !== undefined) {
        const msgIdMatch = String(firstArg).match(/\[(?:USER-TRANSCRIPT|THINKING-STATE-DEBUG)-([^\]]+)\]/);
        msgId = msgIdMatch ? msgIdMatch[1] : 'unknown';
      }
      
      // Add enhanced diagnostic information
      this.originalConsoleError.call(
        console,
        `[THINKING-STATE-ENHANCED-${msgId}] Enhanced thinking state diagnostics:`,
        {
          isCurrentlyThinking: state.isThinking,
          thinkingDuration: state.duration !== null ? `${(state.duration / 1000).toFixed(1)}s` : 'unknown',
          thinkingStartTime: state.startTime 
            ? new Date(state.startTime).toISOString() 
            : 'unknown',
          thinkingSource: state.source || 'unknown',
          stateInconsistencies: inconsistencies,
          diagnosticId: trackedError.diagnosticId || 'none',
          currentTimestamp: new Date().toISOString(),
          messageFlowState: (typeof window !== 'undefined' && (window as Window & typeof globalThis & { __messageFlowState?: Record<string, unknown> }).__messageFlowState) || {}
        }
      );
      
      // Add recovery advice if enabled
      if (this.config.addRecoverySuggestions) {
        const { suggestions } = thinkingStateDiagnostics.getRecoverySuggestions();
        
        if (suggestions.length > 0) {
          this.originalConsoleError.call(
            console,
            `[THINKING-STATE-ENHANCED-${msgId}] Recovery suggestions:`,
            suggestions
          );
        }
      }
    } else {
      // Just pass through to original handler
      const originalMethod = level === 'error' ? this.originalConsoleError : this.originalConsoleWarn;
      originalMethod.apply(console, args);
    }
  }
  
  /**
   * Get reason why a thinking state error is a false positive
   */
  private getFalsePositiveReason(
    state: { isThinking: boolean; duration: number | null; startTime: number | null; },
    inconsistencies: string[]
  ): string {
    if (!state.isThinking) {
      return "AI is not actually in thinking state";
    } else if (state.duration !== null && state.duration < 5000) {
      return `Thinking duration (${(state.duration / 1000).toFixed(1)}s) is too short to be stuck`;
    } else if (inconsistencies.length > 0) {
      return `State inconsistencies detected: ${inconsistencies.join(', ')}`;
    } else if (state.startTime === null || state.startTime === 0) {
      return "Invalid thinking start time";
    } else {
      return "Unknown reason";
    }
  }
  
  /**
   * Handle WebRTC connection or data channel errors
   */
  private handleWebRTCError(
    args: unknown[], 
    trackedError: TrackedError, 
    level: 'error' | 'warning'
  ): void {
    // If enhancing messages, add better diagnostics
    if (this.config.enhanceErrorMessages) {
      // Call original error with original message
      const originalMethod = level === 'error' ? this.originalConsoleError : this.originalConsoleWarn;
      originalMethod.apply(console, args);
      
      // Add enhanced information
      originalMethod.call(
        console,
        `[WEBRTC-ENHANCED] Enhanced WebRTC error diagnostics:`,
        {
          errorType: trackedError.type,
          diagnosticId: trackedError.diagnosticId || 'none',
          peerConnectionState: (typeof window !== 'undefined' && (window as Window & typeof globalThis & { __pcState?: Record<string, unknown> }).__pcState) || 'unknown',
          dataChannelState: (typeof window !== 'undefined' && (window as Window & typeof globalThis & { __dcState?: Record<string, unknown> }).__dcState) || 'unknown',
          timestamp: new Date().toISOString(),
          thinkingState: thinkingStateObserver.getConsolidatedState()
        }
      );
      
      // Add recovery advice if enabled
      if (this.config.addRecoverySuggestions) {
        originalMethod.call(
          console,
          `[WEBRTC-ENHANCED] Recovery suggestions:`,
          [
            "Try refreshing the page to establish a new WebRTC connection",
            "Check network conditions and firewall settings",
            "If on a corporate network, VPN might be blocking WebRTC connections"
          ]
        );
      }
    } else {
      // Just pass through to original handler
      const originalMethod = level === 'error' ? this.originalConsoleError : this.originalConsoleWarn;
      originalMethod.apply(console, args);
    }
  }
  
  /**
   * Handle API errors
   */
  private handleAPIError(
    args: unknown[], 
    trackedError: TrackedError, 
    level: 'error' | 'warning'
  ): void {
    // If enhancing messages, add better diagnostics
    if (this.config.enhanceErrorMessages) {
      // Call original error with original message
      const originalMethod = level === 'error' ? this.originalConsoleError : this.originalConsoleWarn;
      originalMethod.apply(console, args);
      
      // Add enhanced information
      originalMethod.call(
        console,
        `[API-ENHANCED] Enhanced API error diagnostics:`,
        {
          errorType: trackedError.type,
          diagnosticId: trackedError.diagnosticId || 'none',
          timestamp: new Date().toISOString(),
          thinkingState: thinkingStateObserver.getConsolidatedState()
        }
      );
      
      // Add recovery advice for specific API errors
      if (this.config.addRecoverySuggestions) {
        const message = this.getErrorMessage(args);
        
        if (message.includes('conversation_already_has_active_response')) {
          originalMethod.call(
            console,
            `[API-ENHANCED] Recovery suggestions for 'conversation_already_has_active_response':`,
            [
              "This error occurs when sending a response while another is being processed",
              "Add a delay between response messages (at least 1000ms)",
              "Ensure only one response.create message is sent at a time",
              "Check for race conditions in message handling code"
            ]
          );
        } else {
          originalMethod.call(
            console,
            `[API-ENHANCED] General API error recovery suggestions:`,
            [
              "Check API key and permissions",
              "Verify request format matches current API specifications",
              "If error persists, try refreshing the page"
            ]
          );
        }
      }
    } else {
      // Just pass through to original handler
      const originalMethod = level === 'error' ? this.originalConsoleError : this.originalConsoleWarn;
      originalMethod.apply(console, args);
    }
  }
  
  /**
   * Handle audio errors
   */
  private handleAudioError(
    args: unknown[], 
    trackedError: TrackedError, 
    level: 'error' | 'warning'
  ): void {
    // If enhancing messages, add better diagnostics
    if (this.config.enhanceErrorMessages) {
      // Call original error with original message
      const originalMethod = level === 'error' ? this.originalConsoleError : this.originalConsoleWarn;
      originalMethod.apply(console, args);
      
      // Add enhanced information
      originalMethod.call(
        console,
        `[AUDIO-ENHANCED] Enhanced audio error diagnostics:`,
        {
          errorType: trackedError.type,
          diagnosticId: trackedError.diagnosticId || 'none',
          timestamp: new Date().toISOString(),
          audioPlaybackState: (typeof window !== 'undefined' && (window as Window & typeof globalThis & { __audioQueueState?: Record<string, unknown> }).__audioQueueState) || 'unknown'
        }
      );
      
      // Add recovery advice if enabled
      if (this.config.addRecoverySuggestions) {
        originalMethod.call(
          console,
          `[AUDIO-ENHANCED] Recovery suggestions:`,
          [
            "Check if audio is playing in another tab or application",
            "Verify audio permissions are granted to the browser",
            "Try refreshing the page",
            "Check if audio source exists and is correctly formatted"
          ]
        );
      }
    } else {
      // Just pass through to original handler
      const originalMethod = level === 'error' ? this.originalConsoleError : this.originalConsoleWarn;
      originalMethod.apply(console, args);
    }
  }
  
  /**
   * Get error history
   */
  public getErrorHistory(): TrackedError[] {
    return [...this.errorHistory];
  }
  
  /**
   * Get error frequency statistics
   */
  public getErrorFrequency(): Record<string, number> {
    return { ...this.errorFrequency };
  }
  
  /**
   * Clear error history and frequency tracking
   */
  public clearErrorHistory(): void {
    this.errorHistory = [];
    this.errorFrequency = {};
  }
}

// Create singleton instance
const enhancedErrorInterceptor = EnhancedErrorInterceptor.getInstance();

/**
 * Install the enhanced error interceptor
 */
export function installEnhancedErrorInterceptor(config: ErrorInterceptorConfig = {}): void {
  enhancedErrorInterceptor.configure(config);
  enhancedErrorInterceptor.install();
}

/**
 * Uninstall the enhanced error interceptor
 */
export function uninstallEnhancedErrorInterceptor(): void {
  enhancedErrorInterceptor.uninstall();
}

/**
 * Get error history
 */
export function getErrorHistory(): TrackedError[] {
  return enhancedErrorInterceptor.getErrorHistory();
}

/**
 * Get error frequency statistics
 */
export function getErrorFrequency(): Record<string, number> {
  return enhancedErrorInterceptor.getErrorFrequency();
}

/**
 * Clear error history and frequency tracking
 */
export function clearErrorHistory(): void {
  enhancedErrorInterceptor.clearErrorHistory();
}

export default {
  install: installEnhancedErrorInterceptor,
  uninstall: uninstallEnhancedErrorInterceptor,
  getErrorHistory,
  getErrorFrequency,
  clearErrorHistory
};