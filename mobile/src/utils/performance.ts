// Performance optimization utilities for RiseTwice Mobile
import React from 'react';

export class PerformanceOptimizer {
  private static measurementStartTimes = new Map<string, number>();

  // Performance measurement
  static startMeasurement(name: string): void {
    this.measurementStartTimes.set(name, Date.now());
  }

  static endMeasurement(name: string): number {
    const startTime = this.measurementStartTimes.get(name);
    if (!startTime) {
      console.warn(`No measurement started for: ${name}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.measurementStartTimes.delete(name);
    
    if (__DEV__) {
      console.log(`[Performance] ${name}: ${duration}ms`);
    }
    
    return duration;
  }

  // Memory management
  static logMemoryUsage(): void {
    if (__DEV__ && global.performance && 'memory' in global.performance) {
      const memory = (global.performance as any).memory;
      console.log('[Memory]', {
        used: `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`,
        total: `${Math.round(memory.totalJSHeapSize / 1024 / 1024)}MB`,
        limit: `${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)}MB`,
      });
    }
  }

  // Debounce utility for expensive operations
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(null, args), wait);
    };
  }

  // Throttle utility for frequent operations
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func.apply(null, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  // Batch state updates
  static batchUpdates(updates: (() => void)[]): void {
    requestAnimationFrame(() => {
      updates.forEach(update => update());
    });
  }

  // Lazy loading helper
  static createLazyComponent<T>(
    importFunc: () => Promise<{ default: React.ComponentType<T> }>
  ) {
    return React.lazy(importFunc);
  }

  // Audio performance optimizations
  static optimizeAudioBuffer(buffer: ArrayBuffer, _targetSampleRate = 16000): ArrayBuffer {
    // Basic audio buffer optimization
    // In a real implementation, this would include:
    // - Sample rate conversion
    // - Bit depth optimization
    // - Noise reduction
    return buffer;
  }

  // WebRTC connection optimization
  static optimizeWebRTCConfig() {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle' as const,
      rtcpMuxPolicy: 'require' as const,
    };
  }
}

// React performance hooks
export const usePerformanceMonitor = (componentName: string) => {
  React.useEffect(() => {
    PerformanceOptimizer.startMeasurement(`${componentName}_mount`);
    return () => {
      PerformanceOptimizer.endMeasurement(`${componentName}_mount`);
    };
  }, [componentName]);
};

// Memoization helpers
export const useMemoizedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T => {
  return React.useCallback(callback, deps);
};

export const useMemoizedValue = <T>(
  factory: () => T,
  deps: React.DependencyList
): T => {
  return React.useMemo(factory, deps);
};