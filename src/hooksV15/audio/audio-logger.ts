// src/hooksV15/audio/audio-logger.ts

import type { LogLevel, DiagnosticData } from '../types';

/**
 * Unified Audio Logger for V15
 * 
 * Provides consistent logging throughout the V15 audio system with:
 * - Single [AudioLogger] prefix for all audio-related logs
 * - Structured diagnostic data collection
 * - Built-in performance tracking
 * - Export capabilities for debugging
 */

export class AudioLoggerV15 {
  private static instance: AudioLoggerV15;
  private readonly prefix = '[AudioLogger]';
  private sessionId: string;
  private diagnosticData: DiagnosticData[] = [];
  private readonly maxDiagnosticEntries = 1000;

  private constructor() {
    this.sessionId = `v15-session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.log('info', 'system', 'logger_initialized', { sessionId: this.sessionId });
  }

  public static getInstance(): AudioLoggerV15 {
    if (!AudioLoggerV15.instance) {
      AudioLoggerV15.instance = new AudioLoggerV15();
    }
    return AudioLoggerV15.instance;
  }

  /**
   * Core logging method - all logs go through here for consistency
   */
  private log(level: LogLevel, category: string, operation: string, data: Record<string, unknown> = {}): void {
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

  // Public API Methods

  /**
   * Log general debug information
   */
  public debug(category: string, operation: string, data: Record<string, unknown> = {}): void {
    this.log('debug', category, operation, data);
  }

  /**
   * Log informational messages
   */
  public info(category: string, operation: string, data: Record<string, unknown> = {}): void {
    this.log('info', category, operation, data);
  }

  /**
   * Log warnings
   */
  public warn(category: string, operation: string, data: Record<string, unknown> = {}): void {
    this.log('warn', category, operation, data);
  }

  /**
   * Log errors with full context
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
    
    this.log('error', category, operation, errorData);
  }

  // Specialized Audio Logging Methods

  /**
   * Log audio chunk processing
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
   * Log WebRTC connection events
   */
  public webrtcConnection(event: 'connecting' | 'connected' | 'disconnected' | 'failed', context: Record<string, unknown> = {}): void {
    const level = event === 'failed' ? 'error' : 'info';
    this.log(level, 'webrtc', `connection_${event}`, context);
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
    this.debug('performance', operation, {
      duration,
      durationMs: duration,
      ...context
    });
  }

  /**
   * Log user interactions
   */
  public userAction(action: string, context: Record<string, unknown> = {}): void {
    this.info('user', 'action', {
      action,
      ...context
    });
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
    return [...this.diagnosticData];
  }

  /**
   * Get diagnostic data filtered by category
   */
  public getDiagnosticsByCategory(category: string): DiagnosticData[] {
    return this.diagnosticData.filter(entry => entry.category === category);
  }

  /**
   * Get diagnostic data within time range
   */
  public getDiagnosticsInRange(startTime: number, endTime: number): DiagnosticData[] {
    return this.diagnosticData.filter(entry => 
      entry.timestamp >= startTime && entry.timestamp <= endTime
    );
  }

  /**
   * Export all diagnostic data as JSON
   */
  public exportDiagnostics(): string {
    const exportData = {
      sessionId: this.sessionId,
      exportTime: Date.now(),
      exportTimeISO: new Date().toISOString(),
      version: 'v15',
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

  /**
   * Save diagnostic data to localStorage
   */
  public saveDiagnosticsToStorage(): void {
    try {
      const data = this.exportDiagnostics();
      localStorage.setItem(`audioLogger_v15_${this.sessionId}`, data);
      this.info('system', 'diagnostics_saved', { 
        storageKey: `audioLogger_v15_${this.sessionId}`,
        dataSize: data.length 
      });
    } catch (error) {
      this.error('system', 'diagnostics_save_failed', error as Error);
    }
  }

  /**
   * Download diagnostic data as file
   */
  public downloadDiagnostics(): void {
    try {
      const data = this.exportDiagnostics();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `audio-diagnostics-v15-${this.sessionId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.info('system', 'diagnostics_downloaded', { 
        filename: a.download,
        dataSize: data.length 
      });
    } catch (error) {
      this.error('system', 'diagnostics_download_failed', error as Error);
    }
  }

  /**
   * Clear all diagnostic data
   */
  public clearDiagnostics(): void {
    const previousCount = this.diagnosticData.length;
    this.diagnosticData = [];
    this.info('system', 'diagnostics_cleared', { previousCount });
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
const audioLogger = AudioLoggerV15.getInstance();
export default audioLogger;