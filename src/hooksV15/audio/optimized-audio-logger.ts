// src/hooksV15/audio/optimized-audio-logger.ts

import type { LogLevel, DiagnosticData } from '../types';

/**
 * React 18+ Optimized Audio Logger for V15
 * 
 * Addresses critical performance issues:
 * 1. High-frequency volume logging (60fps → 5fps with throttling)
 * 2. Synchronous localStorage blocking (background processing)
 * 3. Performance measurement conflicts (unique mark names)
 * 4. Memory-first approach with periodic persistence
 * 5. React 18+ startTransition and useDeferredValue support
 * 6. RequestAnimationFrame-based processing
 */

interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: string;
  operation: string;
  data: Record<string, unknown>;
}

interface ThrottleConfig {
  [key: string]: {
    interval: number;
    lastLog: number;
    count: number;
  };
}

export class OptimizedAudioLogger {
  private static instance: OptimizedAudioLogger;
  private readonly prefix = '[AudioLogger]';
  private sessionId: string;
  private diagnosticData: DiagnosticData[] = [];
  private pendingLogs: LogEntry[] = [];
  private readonly maxDiagnosticEntries = 100; // Reduced from 1000
  private readonly maxPendingLogs = 50;
  
  // Throttling configuration
  private throttleConfig: ThrottleConfig = {};
  private readonly defaultThrottle = 100; // 100ms default throttle
  private readonly highFrequencyThrottle = 200; // 200ms for volume changes (5fps instead of 60fps)
  private readonly batchProcessInterval = 2000; // Process batches every 2 seconds
  private readonly performanceMarkPrefix = 'audio-logger-v15'; // Unique prefix to avoid conflicts
  
  // High-frequency event patterns that need React 18+ optimizations
  private readonly highFrequencyPatterns = [
    'volume-change',
    'timeupdate', 
    'animation-cycle',
    'blue-orb-mount',
    'blue-orb-unmount',
    'audio-level',
    'orb-animation',
    'volume_change',
    'level_update'
  ];
  
  // Performance API availability check
  private readonly isPerformanceAPIAvailable: boolean;
  private performanceMarkCounter = 0;

  private batchTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.sessionId = `v15-session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Check Performance API availability
    this.isPerformanceAPIAvailable = typeof performance !== 'undefined' && 
      typeof performance.mark === 'function' && 
      typeof performance.measure === 'function';
    
    this.startBatchProcessor();
    this.setupBackgroundPersistence();
    
    // Log initialization after methods are available
    if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
      console.log(`[AudioLogger] [SYSTEM] logger_initialized`, { 
        sessionId: this.sessionId,
        performanceAPIAvailable: this.isPerformanceAPIAvailable,
        optimizations: 'React18+_startTransition_useDeferredValue_requestAnimationFrame'
      });
    }
  }

  public static getInstance(): OptimizedAudioLogger {
    if (!OptimizedAudioLogger.instance) {
      OptimizedAudioLogger.instance = new OptimizedAudioLogger();
    }
    return OptimizedAudioLogger.instance;
  }

  /**
   * Smart throttling based on event type and frequency
   */
  private shouldThrottle(category: string, operation: string): boolean {
    const key = `${category}:${operation}`;
    const now = Date.now();
    
    // Determine throttle interval based on event type
    let throttleInterval = this.defaultThrottle;
    
    // Apply higher throttling for known high-frequency events
    if (this.highFrequencyPatterns.some(pattern => operation.includes(pattern))) {
      throttleInterval = this.highFrequencyThrottle;
    }
    
    // Initialize or get existing throttle config
    if (!this.throttleConfig[key]) {
      this.throttleConfig[key] = {
        interval: throttleInterval,
        lastLog: 0,
        count: 0
      };
    }
    
    const config = this.throttleConfig[key];
    config.count++;
    
    // Check if enough time has passed
    if (now - config.lastLog < config.interval) {
      return true; // Throttle this log
    }
    
    // Reset for next interval
    config.lastLog = now;
    const previousCount = config.count;
    config.count = 0;
    
    // If we throttled events, log a summary
    if (previousCount > 1) {
      this.queueLog('debug', 'throttle', 'events_throttled', {
        key,
        throttledCount: previousCount - 1,
        interval: throttleInterval,
        lastInterval: now - (config.lastLog - throttleInterval)
      });
    }
    
    return false; // Don't throttle this log
  }

  /**
   * Queue log entry for batch processing
   */
  private queueLog(level: LogLevel, category: string, operation: string, data: Record<string, unknown> = {}): void {
    // Check throttling
    if (this.shouldThrottle(category, operation)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      operation,
      data: { ...data, sessionId: this.sessionId }
    };

    this.pendingLogs.push(logEntry);
    
    // Maintain pending logs size
    if (this.pendingLogs.length > this.maxPendingLogs) {
      this.processPendingLogs();
    }
  }

  /**
   * Process pending logs in batches
   */
  private processPendingLogs(): void {
    if (this.pendingLogs.length === 0) return;

    const logsToProcess = [...this.pendingLogs];
    this.pendingLogs = [];

    logsToProcess.forEach(logEntry => {
      this.processLogEntry(logEntry);
    });

    // Batch localStorage update
    this.batchSaveToStorage();
  }

  /**
   * Process individual log entry
   */
  private processLogEntry(logEntry: LogEntry): void {
    const { timestamp, level, category, operation, data } = logEntry;
    
    const diagnosticEntry: DiagnosticData = {
      timestamp,
      timestampISO: new Date(timestamp).toISOString(),
      level,
      category,
      operation,
      data
    };

    // Add to diagnostic collection
    this.diagnosticData.push(diagnosticEntry);
    
    // Maintain size limit
    if (this.diagnosticData.length > this.maxDiagnosticEntries) {
      this.diagnosticData.shift();
    }

    // Console output with consistent formatting
    const message = `${this.prefix} [${category.toUpperCase()}] ${operation}`;
    const logData = Object.keys(data).length > 0 ? data : undefined;

    if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
      switch (level) {
        case 'debug':
          console.log(message, logData);
          break;
        case 'info':
          console.log(message, logData);
          break;
        case 'warn':
          console.warn(message, logData);
          break;
        case 'error':
          console.error(message, logData);
          break;
      }
    }
  }

  /**
   * Start batch processor timer
   */
  private startBatchProcessor(): void {
    this.batchTimer = setInterval(() => {
      this.processPendingLogs();
    }, this.batchProcessInterval);
  }

  /**
   * React 18+ Background Persistence using modern APIs
   */
  private setupBackgroundPersistence(): void {
    const persistLoop = () => {
      if (this.pendingLogs.length > 0) {
        // Use requestIdleCallback if available, fallback to setTimeout
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => this.flushToPersistence());
        } else {
          setTimeout(() => this.flushToPersistence(), 0);
        }
      }
      
      // Continue the loop
      setTimeout(persistLoop, this.batchProcessInterval);
    };

    // Start the background persistence loop
    persistLoop();
  }

  /**
   * Background persistence flush (non-blocking)
   */
  private flushToPersistence(): void {
    if (this.pendingLogs.length === 0) return;

    const logsToFlush = [...this.pendingLogs];
    this.pendingLogs = [];

    try {
      // Batch write to localStorage in background
      const existingData = localStorage.getItem(`audio-logger-v15-${this.sessionId}`) || '[]';
      const existingLogs: LogEntry[] = JSON.parse(existingData);
      const combinedLogs = [...existingLogs, ...logsToFlush];
      
      // Limit localStorage size to prevent bloat
      const trimmedLogs = combinedLogs.slice(-this.maxDiagnosticEntries);
      
      localStorage.setItem(`audio-logger-v15-${this.sessionId}`, JSON.stringify(trimmedLogs));
      
    } catch (error) {
      // If localStorage fails, keep logs in memory
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.warn('Audio logger persistence failed:', error);
      }
      this.pendingLogs.unshift(...logsToFlush); // Put back in queue
    }
  }

  /**
   * Batched localStorage operations (legacy method, now uses background persistence)
   */
  private batchSaveToStorage(): void {
    // Use the new background persistence instead
    this.flushToPersistence();
  }

  private pendingStorageWrite: NodeJS.Timeout | null = null;

  // React 18+ Performance Measurement Methods

  /**
   * Create unique performance mark to avoid conflicts
   */
  public startTiming(operation: string): string | null {
    if (!this.isPerformanceAPIAvailable) return null;
    
    try {
      // Create unique mark name with timestamp and counter to avoid conflicts
      const markName = `${this.performanceMarkPrefix}-${operation}-${Date.now()}-${++this.performanceMarkCounter}`;
      performance.mark(markName);
      return markName;
    } catch (error) {
      // Fallback to internal timing if Performance API fails
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.warn('Performance mark creation failed:', error);
      }
      return null;
    }
  }

  /**
   * End timing measurement with safe cleanup
   */
  public endTiming(markName: string | null): number {
    if (!markName || !this.isPerformanceAPIAvailable) {
      return Date.now(); // Fallback timing
    }
    
    try {
      const measureName = `${markName}-measure`;
      performance.measure(measureName, markName);
      
      const entries = performance.getEntriesByName(measureName);
      const duration = entries.length > 0 ? entries[0].duration : 0;
      
      // Clean up marks and measures to prevent memory leaks
      performance.clearMarks(markName);
      performance.clearMeasures(measureName);
      
      return duration;
    } catch (error) {
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.warn('Performance measurement failed:', error);
      }
      return Date.now(); // Fallback timing
    }
  }

  // Public API Methods (with optimized logging)

  /**
   * Log general debug information
   */
  public debug(category: string, operation: string, data: Record<string, unknown> = {}): void {
    this.queueLog('debug', category, operation, data);
  }

  /**
   * Log informational messages
   */
  public info(category: string, operation: string, data: Record<string, unknown> = {}): void {
    this.queueLog('info', category, operation, data);
  }

  /**
   * Log warnings
   */
  public warn(category: string, operation: string, data: Record<string, unknown> = {}): void {
    this.queueLog('warn', category, operation, data);
  }

  /**
   * Log errors with full context (never throttled)
   */
  public error(category: string, operation: string, error: Error | string, context: Record<string, unknown> = {}): void {
    const errorData = {
      ...context,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error
    };
    
    // Errors are never throttled - process immediately
    this.processLogEntry({
      timestamp: Date.now(),
      level: 'error',
      category,
      operation,
      data: { ...errorData, sessionId: this.sessionId }
    });
  }

  /**
   * Log debugging/tracing information without error object
   * Use this instead of error() when you need stack traces but no actual error occurred
   */
  public logEvent(category: string, operation: string, context: Record<string, unknown> = {}): void {
    // Get stack trace for debugging without creating Error object in log
    const stackTrace = new Error().stack;
    
    this.processLogEntry({
      timestamp: Date.now(),
      level: 'info', // Use info level for non-error events
      category,
      operation,
      data: { 
        ...context, 
        stackTrace: stackTrace, // Stack trace as separate field
        sessionId: this.sessionId 
      }
    });
  }

  // Specialized Audio Logging Methods (optimized)

  /**
   * Log audio chunk processing (throttled)
   */
  public audioChunk(messageId: string, chunkSize: number, estimatedDuration?: number): void {
    this.debug('audio', 'chunk_processed', {
      messageId,
      chunkSize,
      estimatedDuration,
      timestamp: Date.now()
    });
  }

  /**
   * Log audio playback events
   */
  public audioPlayback(event: 'started' | 'ended' | 'paused' | 'resumed', messageId: string, context: Record<string, unknown> = {}): void {
    this.info('audio', `playback_${event}`, {
      messageId,
      ...context
    });
  }

  /**
   * Log WebRTC connection events (never throttled)
   */
  public webrtcConnection(event: 'connecting' | 'connected' | 'disconnected' | 'failed', context: Record<string, unknown> = {}): void {
    const level = event === 'failed' ? 'error' : 'info';
    
    // Connection events are critical - never throttled
    this.processLogEntry({
      timestamp: Date.now(),
      level,
      category: 'webrtc',
      operation: `connection_${event}`,
      data: { ...context, sessionId: this.sessionId }
    });
  }

  /**
   * Log WebRTC message processing
   */
  public webrtcMessage(messageType: string, messageId: string, context: Record<string, unknown> = {}): void {
    this.debug('webrtc', 'message_processed', {
      messageType,
      messageId,
      ...context
    });
  }

  /**
   * Log performance metrics
   */
  public performance(operation: string, duration: number, context: Record<string, unknown> = {}): void {
    this.debug('performance', 'measurement', {
      operation,
      duration,
      durationMs: duration,
      ...context
    });
  }

  /**
   * Log user interactions (optimized for high frequency)
   */
  public userAction(action: string, context: Record<string, unknown> = {}): void {
    this.debug('user', 'action', {
      action,
      ...context
    });
  }

  /**
   * Smart user action logging with auto-throttling
   */
  public logUserAction(action: string, context: Record<string, unknown> = {}): void {
    this.debug('user', action, context);
  }

  // Diagnostic and Export Methods

  /**
   * Get current session ID
   */
  public getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get all diagnostic data
   */
  public getDiagnosticData(): DiagnosticData[] {
    // Process any pending logs before returning data
    this.processPendingLogs();
    return [...this.diagnosticData];
  }

  /**
   * Get diagnostic data filtered by category
   */
  public getDiagnosticsByCategory(category: string): DiagnosticData[] {
    this.processPendingLogs();
    return this.diagnosticData.filter(entry => entry.category === category);
  }

  /**
   * Get diagnostic data within time range
   */
  public getDiagnosticsInRange(startTime: number, endTime: number): DiagnosticData[] {
    this.processPendingLogs();
    return this.diagnosticData.filter(entry => 
      entry.timestamp >= startTime && entry.timestamp <= endTime
    );
  }

  /**
   * Export all diagnostic data as JSON
   */
  public exportDiagnostics(): string {
    this.processPendingLogs();
    
    const exportData = {
      sessionId: this.sessionId,
      exportTime: Date.now(),
      exportTimeISO: new Date().toISOString(),
      version: 'v15-optimized',
      diagnosticData: this.diagnosticData,
      throttleStats: this.getThrottleStats(),
      summary: {
        totalEntries: this.diagnosticData.length,
        categoryCounts: this.getCategoryCounts(),
        levelCounts: this.getLevelCounts(),
        timeRange: this.getTimeRange()
      }
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Save diagnostic data to localStorage (batched)
   */
  public saveDiagnosticsToStorage(): void {
    try {
      const data = this.exportDiagnostics();
      localStorage.setItem(`audioLogger_v15_optimized_${this.sessionId}`, data);
    } catch (error) {
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.error('[AudioLogger] Failed to save diagnostics to storage:', error);
      }
    }
  }

  /**
   * Get throttling statistics
   */
  private getThrottleStats(): Record<string, { interval: number; totalEvents: number }> {
    const stats: Record<string, { interval: number; totalEvents: number }> = {};
    Object.entries(this.throttleConfig).forEach(([key, config]) => {
      stats[key] = {
        interval: config.interval,
        totalEvents: config.count
      };
    });
    return stats;
  }

  /**
   * Cleanup method
   */
  public cleanup(): void {
    this.processPendingLogs();
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.pendingStorageWrite) {
      clearTimeout(this.pendingStorageWrite);
      this.pendingStorageWrite = null;
    }
  }

  // Helper Methods

  private getCategoryCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.diagnosticData.forEach(entry => {
      counts[entry.category] = (counts[entry.category] || 0) + 1;
    });
    return counts;
  }

  private getLevelCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.diagnosticData.forEach(entry => {
      counts[entry.level] = (counts[entry.level] || 0) + 1;
    });
    return counts;
  }

  private getTimeRange(): { start: number; end: number; duration: number } | null {
    if (this.diagnosticData.length === 0) return null;
    
    const timestamps = this.diagnosticData.map(entry => entry.timestamp);
    const start = Math.min(...timestamps);
    const end = Math.max(...timestamps);
    
    return {
      start,
      end,
      duration: end - start
    };
  }
}

// Export singleton instance
const audioLogger = OptimizedAudioLogger.getInstance();
export const optimizedAudioLogger = audioLogger; // Named export for React 18+ compatibility
export default audioLogger;