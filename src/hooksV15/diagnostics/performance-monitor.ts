// src/hooksV15/diagnostics/performance-monitor.ts

import audioLogger from '../audio/audio-logger';
import type { PerformanceMetrics } from '../types';

/**
 * Performance Monitor for V15
 * 
 * Provides real-time performance monitoring with:
 * - Connection performance tracking
 * - Audio processing performance
 * - Memory usage monitoring
 * - Built-in performance alerts
 */

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  private constructor() {
    this.metrics = {
      connectionTime: 0,
      audioLatency: 0,
      messageProcessingTime: 0,
      memoryUsage: 0
    };

    audioLogger.info('performance', 'monitor_initialized', {
      version: 'v15',
      timestamp: Date.now()
    });
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start performance monitoring
   */
  public startMonitoring(intervalMs: number = 5000): void {
    if (this.isMonitoring) {
      audioLogger.warn('performance', 'monitoring_already_active');
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    audioLogger.info('performance', 'monitoring_started', { intervalMs });
  }

  /**
   * Stop performance monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
    audioLogger.info('performance', 'monitoring_stopped');
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Record connection time
   */
  public recordConnectionTime(duration: number): void {
    this.metrics.connectionTime = duration;
    audioLogger.performance('connection_time', duration);

    if (duration > 10000) { // > 10 seconds
      audioLogger.warn('performance', 'slow_connection', { duration });
    }
  }

  /**
   * Record audio latency
   */
  public recordAudioLatency(latency: number): void {
    this.metrics.audioLatency = latency;
    audioLogger.performance('audio_latency', latency);

    if (latency > 200) { // > 200ms
      audioLogger.warn('performance', 'high_audio_latency', { latency });
    }
  }

  /**
   * Record message processing time
   */
  public recordMessageProcessingTime(duration: number): void {
    this.metrics.messageProcessingTime = duration;
    audioLogger.performance('message_processing', duration);

    if (duration > 100) { // > 100ms
      audioLogger.warn('performance', 'slow_message_processing', { duration });
    }
  }

  /**
   * Collect current system metrics
   */
  private collectMetrics(): void {
    try {
      // Memory usage
      if (typeof performance !== 'undefined' && 'memory' in performance) {
        const memory = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory;
        this.metrics.memoryUsage = memory.usedJSHeapSize;

        // Alert on high memory usage (> 100MB)
        if (memory.usedJSHeapSize > 100 * 1024 * 1024) {
          audioLogger.warn('performance', 'high_memory_usage', {
            memoryUsage: memory.usedJSHeapSize,
            memoryUsageMB: Math.round(memory.usedJSHeapSize / 1024 / 1024)
          });
        }
      }

      // CPU usage (if available)
      if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        // TODO: Implement CPU usage monitoring
      }

      audioLogger.debug('performance', 'metrics_collected', this.metrics);

    } catch (error) {
      audioLogger.error('performance', 'metrics_collection_failed', error as Error);
    }
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): Record<string, unknown> {
    return {
      metrics: this.metrics,
      isMonitoring: this.isMonitoring,
      alerts: this.getPerformanceAlerts(),
      timestamp: Date.now()
    };
  }

  /**
   * Get performance alerts
   */
  private getPerformanceAlerts(): Array<{ type: string; message: string; value: number }> {
    const alerts: Array<{ type: string; message: string; value: number }> = [];

    if (this.metrics.connectionTime > 10000) {
      alerts.push({
        type: 'connection',
        message: 'Slow connection detected',
        value: this.metrics.connectionTime
      });
    }

    if (this.metrics.audioLatency > 200) {
      alerts.push({
        type: 'audio',
        message: 'High audio latency detected',
        value: this.metrics.audioLatency
      });
    }

    if (this.metrics.messageProcessingTime > 100) {
      alerts.push({
        type: 'processing',
        message: 'Slow message processing detected',
        value: this.metrics.messageProcessingTime
      });
    }

    if (this.metrics.memoryUsage > 100 * 1024 * 1024) {
      alerts.push({
        type: 'memory',
        message: 'High memory usage detected',
        value: this.metrics.memoryUsage
      });
    }

    return alerts;
  }
}