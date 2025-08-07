// src/hooksV15/audio/simple-optimized-logger.ts

import type { LogLevel, DiagnosticData } from '../types';

/**
 * Simple Optimized Audio Logger for V15
 * 
 * Provides essential logging with performance optimizations:
 * - Throttling for high-frequency events
 * - Buffer management
 * - Consistent formatting
 */

export class SimpleOptimizedLogger {
  private static instance: SimpleOptimizedLogger;
  private readonly prefix = '[AudioLogger]';
  private sessionId: string;
  private diagnosticData: DiagnosticData[] = [];
  private readonly maxDiagnosticEntries = 100;
  
  // Simple throttling
  private lastLogTime: { [key: string]: number } = {};
  private readonly throttleInterval = 100; // 100ms throttle
  private readonly highFrequencyThrottle = 200; // 200ms for volume changes

  private constructor() {
    this.sessionId = `v15-session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
      console.log(`[AudioLogger] [SYSTEM] logger_initialized`, { sessionId: this.sessionId });
    }
  }

  public static getInstance(): SimpleOptimizedLogger {
    if (!SimpleOptimizedLogger.instance) {
      SimpleOptimizedLogger.instance = new SimpleOptimizedLogger();
    }
    return SimpleOptimizedLogger.instance;
  }

  /**
   * Core logging method with throttling
   */
  private log(level: LogLevel, category: string, operation: string, data: Record<string, unknown> = {}): void {
    // Simple throttling check
    const key = `${category}:${operation}`;
    const now = Date.now();
    
    // Determine throttle interval
    const isHighFrequency = operation.includes('volume-change') || 
                           operation.includes('timeupdate') || 
                           operation.includes('animation-cycle') ||
                           operation.includes('blue-orb');
    
    const throttleTime = isHighFrequency ? this.highFrequencyThrottle : this.throttleInterval;
    
    // Check throttling
    if (this.lastLogTime[key] && (now - this.lastLogTime[key]) < throttleTime) {
      return; // Skip this log
    }
    
    this.lastLogTime[key] = now;

    // Create diagnostic entry
    const timestamp = Date.now();
    const diagnosticEntry: DiagnosticData = {
      timestamp,
      timestampISO: new Date(timestamp).toISOString(),
      level,
      category,
      operation,
      data: { ...data, sessionId: this.sessionId }
    };

    // Add to diagnostic collection
    this.diagnosticData.push(diagnosticEntry);
    
    // Maintain size limit
    if (this.diagnosticData.length > this.maxDiagnosticEntries) {
      this.diagnosticData.shift();
    }

    // Console output
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

    // Save to localStorage periodically (every 20 logs)
    if (this.diagnosticData.length % 20 === 0) {
      this.saveDiagnosticsToStorage();
    }
  }

  // Public API Methods

  public debug(category: string, operation: string, data: Record<string, unknown> = {}): void {
    this.log('debug', category, operation, data);
  }

  public info(category: string, operation: string, data: Record<string, unknown> = {}): void {
    this.log('info', category, operation, data);
  }

  public warn(category: string, operation: string, data: Record<string, unknown> = {}): void {
    this.log('warn', category, operation, data);
  }

  public error(category: string, operation: string, error: Error | string, context: Record<string, unknown> = {}): void {
    const errorData = {
      ...context,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error
    };
    
    // Errors are never throttled
    const timestamp = Date.now();
    const diagnosticEntry: DiagnosticData = {
      timestamp,
      timestampISO: new Date(timestamp).toISOString(),
      level: 'error',
      category,
      operation,
      data: { ...errorData, sessionId: this.sessionId }
    };

    this.diagnosticData.push(diagnosticEntry);
    
    if (this.diagnosticData.length > this.maxDiagnosticEntries) {
      this.diagnosticData.shift();
    }

    const message = `${this.prefix} [${category.toUpperCase()}] ${operation}`;
    if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
      console.error(message, errorData);
    }
  }

  // Specialized logging methods

  public audioChunk(messageId: string, chunkSize: number, estimatedDuration?: number): void {
    this.debug('audio', 'chunk_processed', {
      messageId,
      chunkSize,
      estimatedDuration,
      timestamp: Date.now()
    });
  }

  public audioPlayback(event: 'started' | 'ended' | 'paused' | 'resumed', messageId: string, context: Record<string, unknown> = {}): void {
    this.info('audio', `playback_${event}`, {
      messageId,
      ...context
    });
  }

  public webrtcConnection(event: 'connecting' | 'connected' | 'disconnected' | 'failed', context: Record<string, unknown> = {}): void {
    const level = event === 'failed' ? 'error' : 'info';
    
    // Connection events are never throttled
    const timestamp = Date.now();
    const diagnosticEntry: DiagnosticData = {
      timestamp,
      timestampISO: new Date(timestamp).toISOString(),
      level,
      category: 'webrtc',
      operation: `connection_${event}`,
      data: { ...context, sessionId: this.sessionId }
    };

    this.diagnosticData.push(diagnosticEntry);
    
    if (this.diagnosticData.length > this.maxDiagnosticEntries) {
      this.diagnosticData.shift();
    }

    const message = `${this.prefix} [WEBRTC] connection_${event}`;
    const logData = Object.keys(context).length > 0 ? context : undefined;

    if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
      if (level === 'error') {
        console.error(message, logData);
      } else {
        console.log(message, logData);
      }
    }
  }

  public webrtcMessage(messageType: string, messageId: string, context: Record<string, unknown> = {}): void {
    this.debug('webrtc', 'message_processed', {
      messageType,
      messageId,
      ...context
    });
  }

  public performance(operation: string, duration: number, context: Record<string, unknown> = {}): void {
    this.debug('performance', operation, {
      duration,
      durationMs: duration,
      ...context
    });
  }

  public userAction(action: string, context: Record<string, unknown> = {}): void {
    this.info('user', 'action', {
      action,
      ...context
    });
  }

  public logUserAction(action: string, context: Record<string, unknown> = {}): void {
    this.debug('user', action, context);
  }

  // Diagnostic methods

  public getSessionId(): string {
    return this.sessionId;
  }

  public getDiagnosticData(): DiagnosticData[] {
    return [...this.diagnosticData];
  }

  public getDiagnosticsByCategory(category: string): DiagnosticData[] {
    return this.diagnosticData.filter(entry => entry.category === category);
  }

  public getDiagnosticsInRange(startTime: number, endTime: number): DiagnosticData[] {
    return this.diagnosticData.filter(entry => 
      entry.timestamp >= startTime && entry.timestamp <= endTime
    );
  }

  public exportDiagnostics(): string {
    const exportData = {
      sessionId: this.sessionId,
      exportTime: Date.now(),
      exportTimeISO: new Date().toISOString(),
      version: 'v15-simple-optimized',
      diagnosticData: this.diagnosticData,
      summary: {
        totalEntries: this.diagnosticData.length,
        categoryCounts: this.getCategoryCounts(),
        levelCounts: this.getLevelCounts(),
        timeRange: this.getTimeRange()
      }
    };

    return JSON.stringify(exportData, null, 2);
  }

  public saveDiagnosticsToStorage(): void {
    try {
      const data = this.exportDiagnostics();
      localStorage.setItem(`audioLogger_v15_simple_${this.sessionId}`, data);
    } catch (error) {
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.error('[AudioLogger] Failed to save diagnostics to storage:', error);
      }
    }
  }


  public cleanup(): void {
    // Simple cleanup - just clear data
    this.diagnosticData = [];
    this.lastLogTime = {};
  }

  // Helper methods

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
const audioLogger = SimpleOptimizedLogger.getInstance();
export default audioLogger;