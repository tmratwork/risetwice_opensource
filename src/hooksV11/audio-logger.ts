// src/hooksV11/audio-logger.ts

// Define the interface for the window with our global state
interface WindowWithAudioState {
  __audioQueueState?: AudioState;
  __audioDebugState?: AudioDebugState;
}

// Audio Buffer Event - tracks detailed buffer information
interface AudioBufferEvent {
  timestamp: number;
  bufferSize: number;
  sampleRate?: number;
  duration?: number;
  channelCount?: number;
  expectedDuration?: number;
  sourceType: string; // 'webrtc', 'file', etc.
  id: string; // Unique identifier for the buffer
}

// Audio Element Event - tracks HTML Audio element state changes
interface AudioElementEvent {
  timestamp: number;
  eventType: 'play' | 'pause' | 'ended' | 'canplay' | 'error' | 'suspend' | 'stalled' | 'waiting' | 'playing' | 'timeupdate';
  currentTime?: number;
  duration?: number;
  readyState?: number;
  networkState?: number;
  src?: string;
  error?: MediaError | null;
  elementId?: string;
}

// Audio Context Event - tracks AudioContext state transitions
interface AudioContextEvent {
  timestamp: number;
  state: AudioContextState;
  sampleRate?: number;
  baseLatency?: number;
  outputLatency?: number;
}

// Network Event - tracks WebRTC and data flow events
interface NetworkEvent {
  timestamp: number;
  eventType: string; // 'rtc-state-change', 'data-channel-state', 'packet-loss', etc.
  details: Record<string, unknown>;
}

// System Information - captures browser and device details
interface SystemInfo {
  browser: {
    name: string;
    version: string;
    userAgent: string;
  };
  os: {
    name: string;
    version: string;
  };
  audioDevices: MediaDeviceInfo[];
  memory?: {
    jsHeapSizeLimit?: number;
    totalJSHeapSize?: number;
    usedJSHeapSize?: number;
  };
  cpuCores?: number;
  timestamp: number;
}

// Error Event - captures detailed error information
interface ErrorEvent {
  timestamp: number;
  errorType: string;
  message: string;
  stack?: string;
  componentName?: string;
  operationName?: string;
  context?: Record<string, unknown>;
}

// Performance Metric - captures timing information
interface PerformanceMetric {
  timestamp: number;
  name: string;
  duration: number;
  startTime: number;
  details?: Record<string, unknown>;
}

// Define the shape of our audio debugging state
interface AudioDebugState {
  version: string;
  sessionId: string;
  startTime: number;
  bufferEvents: AudioBufferEvent[];
  elementEvents: AudioElementEvent[];
  contextEvents: AudioContextEvent[];
  networkEvents: NetworkEvent[];
  systemInfo: SystemInfo | null;
  errorEvents: ErrorEvent[];
  performanceMetrics: PerformanceMetric[];
  userInteractions: {
    timestamp: number;
    action: string;
    details?: Record<string, unknown>;
  }[];
}

// Original AudioState (kept for backward compatibility)
interface AudioState {
  queue: {
    length: number;
    timestamp: number;
  }[];
  isPlaying: boolean;
  lastAudioChunk: number;
  audioContextState: string;
  completionEvents: {
    type: string;
    timestamp: number;
    queueLength: number;
    isPlaying: boolean;
    message: string;
  }[];
}

// Enhanced AudioLogger class that captures comprehensive audio debugging information
export class AudioLogger {
  private static instance: AudioLogger;
  private audioState: AudioState;
  private debugState: AudioDebugState;
  private initialized: boolean = false;
  private performanceObserver: PerformanceObserver | null = null;
  private markCount: Record<string, number> = {};

  private constructor() {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Initialize both states
    this.audioState = {
      queue: [],
      isPlaying: false,
      lastAudioChunk: 0,
      audioContextState: 'unknown',
      completionEvents: [],
    };
    
    this.debugState = {
      version: '1.0.0',
      sessionId,
      startTime: Date.now(),
      bufferEvents: [],
      elementEvents: [],
      contextEvents: [],
      networkEvents: [],
      systemInfo: null,
      errorEvents: [],
      performanceMetrics: [],
      userInteractions: [],
    };

    // Initialize global references
    if (typeof window !== 'undefined') {
      // Set global state objects
      (window as WindowWithAudioState).__audioQueueState = this.audioState;
      (window as WindowWithAudioState).__audioDebugState = this.debugState;
      
      // Initialize system information
      this.captureSystemInfo();
      
      // Set up global error handlers
      this.setupErrorHandlers();
      
      // Set up performance observers
      this.setupPerformanceObservers();
      
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.log(`[AudioLogger] Initialized with session ID: ${sessionId}`);
      }
      this.initialized = true;
    }
  }

  public static getInstance(): AudioLogger {
    if (!AudioLogger.instance) {
      AudioLogger.instance = new AudioLogger();
    }
    return AudioLogger.instance;
  }

  // Original API methods (kept for backward compatibility)
  
  public logQueueState(length: number, isPlaying: boolean): void {
    this.audioState.queue.push({
      length,
      timestamp: Date.now()
    });

    // Keep only the last 100 queue states
    if (this.audioState.queue.length > 100) {
      this.audioState.queue.shift();
    }

    this.audioState.isPlaying = isPlaying;
    this.updateGlobalState();
  }

  public logAudioChunk(): void {
    this.audioState.lastAudioChunk = Date.now();
    this.updateGlobalState();
  }

  public logAudioContextState(state: string): void {
    this.audioState.audioContextState = state;
    this.updateGlobalState();
    
    // Also log to new format
    this.logAudioContextEvent({
      state: state as AudioContextState,
    });
  }

  public logCompletionEvent(type: string, queueLength: number, isPlaying: boolean, message: string): void {
    this.audioState.completionEvents.push({
      type,
      timestamp: Date.now(),
      queueLength,
      isPlaying,
      message
    });

    // Keep only the last 20 completion events
    if (this.audioState.completionEvents.length > 20) {
      this.audioState.completionEvents.shift();
    }

    this.updateGlobalState();
  }

  public getState(): AudioState {
    return { ...this.audioState };
  }

  // New Enhanced API Methods for comprehensive audio logging

  // 1. Audio Buffer Events
  public logAudioBuffer(
    bufferSize: number, 
    sourceType: string, 
    options: { 
      sampleRate?: number, 
      duration?: number, 
      channelCount?: number, 
      expectedDuration?: number 
    } = {}
  ): string {
    const id = `buffer-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const event: AudioBufferEvent = {
      timestamp: Date.now(),
      bufferSize,
      sourceType,
      id,
      ...options
    };
    
    this.debugState.bufferEvents.push(event);
    this.updateDebugState();
    
    if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
      console.log(`[AudioLogger] Buffer ${id} (${sourceType}): ${bufferSize} bytes, ${options.duration?.toFixed(2) || 'unknown'}s`);
    }
    
    return id; // Return ID for tracking this buffer through its lifecycle
  }

  // 2. Audio Element Events
  public logAudioElementEvent(event: Omit<AudioElementEvent, 'timestamp'>): void {
    const fullEvent: AudioElementEvent = {
      timestamp: Date.now(),
      ...event
    };
    
    this.debugState.elementEvents.push(fullEvent);
    this.updateDebugState();
    
    // Log errors in more detail
    if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
      if (event.eventType === 'error' && event.error) {
        console.error(`[AudioLogger] Audio element error: ${this.decodeMediaErrorCode(event.error.code)}`, event.error);
      } else if (['stalled', 'suspend', 'waiting'].includes(event.eventType)) {
        console.warn(`[AudioLogger] Audio element ${event.eventType} at ${event.currentTime?.toFixed(2)}s`);
      } else if (event.eventType === 'ended') {
        console.log(`[AudioLogger] Audio playback ended for ${event.elementId || 'unknown element'}`);
      }
    }
  }

  // 3. Audio Context Events
  public logAudioContextEvent(event: Omit<AudioContextEvent, 'timestamp'>): void {
    const fullEvent: AudioContextEvent = {
      timestamp: Date.now(),
      ...event
    };
    
    this.debugState.contextEvents.push(fullEvent);
    this.updateDebugState();
    
    if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
      console.log(`[AudioLogger] AudioContext state changed to: ${event.state}${
        event.baseLatency ? `, latency: ${event.baseLatency.toFixed(4)}s` : ''
      }`);
    }
  }

  // 4. Network and Data Flow
  public logNetworkEvent(eventType: string, details: Record<string, unknown>): void {
    const event: NetworkEvent = {
      timestamp: Date.now(),
      eventType,
      details
    };
    
    this.debugState.networkEvents.push(event);
    this.updateDebugState();
    
    // Log meaningful network events
    if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
      if (eventType === 'rtc-state-change') {
        console.log(`[AudioLogger] WebRTC state changed to: ${details.state}`);
      } else if (eventType === 'data-channel-state') {
        console.log(`[AudioLogger] Data channel state: ${details.state}`);
      } else if (eventType === 'packet-loss') {
        console.warn(`[AudioLogger] Packet loss detected: ${details.lossRate}%`);
      }
    }
  }

  // 5. Error Handling
  public logError(
    errorType: string, 
    message: string, 
    options: { 
      stack?: string, 
      componentName?: string, 
      operationName?: string, 
      context?: Record<string, unknown> 
    } = {}
  ): void {
    const event: ErrorEvent = {
      timestamp: Date.now(),
      errorType,
      message,
      ...options
    };
    
    this.debugState.errorEvents.push(event);
    this.updateDebugState();
    
    if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
      console.error(`[AudioLogger] ${errorType} in ${options.componentName || 'unknown'}: ${message}`);
    }
  }

  // 6. Performance Metrics
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public startMeasure(name: string, details: Record<string, unknown> = {}): void {
    const count = (this.markCount[name] || 0) + 1;
    this.markCount[name] = count;
    const uniqueName = `${name}-${count}`;
    
    if (typeof performance !== 'undefined') {
      try {
        performance.mark(`${uniqueName}-start`);
        if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
          console.log(`[AudioLogger] Started measure: ${name}`);
        }
      } catch (e) {
        if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
          console.error(`[AudioLogger] Error creating performance mark: ${e}`);
        }
      }
    }
  }

  public endMeasure(name: string, details: Record<string, unknown> = {}): void {
    const count = this.markCount[name] || 0;
    if (count === 0) {
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.warn(`[AudioLogger] Cannot end measure ${name} - no matching start`);
      }
      return;
    }
    
    const uniqueName = `${name}-${count}`;
    
    if (typeof performance !== 'undefined') {
      try {
        performance.mark(`${uniqueName}-end`);
        performance.measure(uniqueName, `${uniqueName}-start`, `${uniqueName}-end`);
        
        const entries = performance.getEntriesByName(uniqueName);
        if (entries.length > 0) {
          const entry = entries[0];
          const metricEvent: PerformanceMetric = {
            timestamp: Date.now(),
            name,
            duration: entry.duration,
            startTime: entry.startTime,
            details
          };
          
          this.debugState.performanceMetrics.push(metricEvent);
          this.updateDebugState();
          
          if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
            console.log(`[AudioLogger] Measure ${name}: ${entry.duration.toFixed(2)}ms`);
          }
        }
        
        // Cleanup
        performance.clearMarks(`${uniqueName}-start`);
        performance.clearMarks(`${uniqueName}-end`);
        performance.clearMeasures(uniqueName);
      } catch (e) {
        if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
          console.error(`[AudioLogger] Error ending performance measure: ${e}`);
        }
      }
    }
  }

  // 7. User Interactions
  public logUserInteraction(action: string, details: Record<string, unknown> = {}): void {
    this.debugState.userInteractions.push({
      timestamp: Date.now(),
      action,
      details
    });
    
    this.updateDebugState();
    if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
      console.log(`[AudioLogger] User action: ${action}`);
    }
  }
  
  // Diagnostic information logging
  public logDiagnostic(category: string, details: Record<string, unknown> = {}): void {
    if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
      console.log(`[AudioLogger] Diagnostic: ${category}`, details);
    }
    
    // Add to user interactions for tracking
    this.debugState.userInteractions.push({
      timestamp: Date.now(),
      action: `diagnostic_${category}`,
      details
    });
    
    this.updateDebugState();
  }
  
  // Enhanced audio diagnostics logging - specific for WebRTC audio issues
  public logAudioDiagnostics(eventType: string, data: string): void {
    try {
      // Parse the data if it's JSON
      let parsedData: Record<string, unknown> = {};
      try {
        parsedData = JSON.parse(data);
      } catch {
        // If not JSON, store as string
        parsedData = { rawData: data };
      }
      
      // Add to user interactions with special audio diagnostics tag
      this.debugState.userInteractions.push({
        timestamp: Date.now(),
        action: `audio_diagnostics_${eventType}`,
        details: {
          ...parsedData,
          timestamp: Date.now(),
          timestampISO: new Date().toISOString()
        }
      });
      
      // Store specifically in error events for critical diagnostics
      if (eventType.includes('ERROR') || 
          eventType.includes('CUTOFF') || 
          eventType.includes('PREMATURE') ||
          eventType.includes('GAP')) {
        this.logError(
          `audio_diagnostic_${eventType}`,
          typeof parsedData.message === 'string' ? parsedData.message : eventType,
          {
            componentName: 'WebRTCAudioIntegration',
            operationName: eventType,
            context: parsedData
          }
        );
      }
      
      // Save immediately for critical events
      if (eventType.includes('ERROR') || eventType.includes('CUTOFF')) {
        this.saveDebugDataToLocalStorage();
      }
      
      this.updateDebugState();
    } catch (error) {
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.error(`[AudioLogger] Error processing audio diagnostics:`, error);
      }
    }
  }

  // 8. System Environment
  public captureSystemInfo(): void {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      // Browser detection
      const userAgent = navigator.userAgent;
      let browserName = 'Unknown';
      let browserVersion = 'Unknown';
      
      if (userAgent.indexOf('Firefox') > -1) {
        browserName = 'Firefox';
        browserVersion = userAgent.match(/Firefox\/([0-9.]+)/)?.[1] || 'Unknown';
      } else if (userAgent.indexOf('Chrome') > -1) {
        browserName = 'Chrome';
        browserVersion = userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || 'Unknown';
      } else if (userAgent.indexOf('Safari') > -1) {
        browserName = 'Safari';
        browserVersion = userAgent.match(/Version\/([0-9.]+)/)?.[1] || 'Unknown';
      } else if (userAgent.indexOf('Edge') > -1 || userAgent.indexOf('Edg/') > -1) {
        browserName = 'Edge';
        browserVersion = userAgent.match(/Edge\/([0-9.]+)/)?.[1] || 
                         userAgent.match(/Edg\/([0-9.]+)/)?.[1] || 'Unknown';
      }
      
      // OS detection
      let osName = 'Unknown';
      let osVersion = 'Unknown';
      
      if (userAgent.indexOf('Windows') > -1) {
        osName = 'Windows';
        osVersion = userAgent.match(/Windows NT ([0-9.]+)/)?.[1] || 'Unknown';
      } else if (userAgent.indexOf('Mac') > -1) {
        osName = 'macOS';
        osVersion = userAgent.match(/Mac OS X ([0-9_]+)/)?.[1]?.replace(/_/g, '.') || 'Unknown';
      } else if (userAgent.indexOf('Linux') > -1) {
        osName = 'Linux';
      } else if (userAgent.indexOf('Android') > -1) {
        osName = 'Android';
        osVersion = userAgent.match(/Android ([0-9.]+)/)?.[1] || 'Unknown';
      } else if (userAgent.indexOf('iOS') > -1 || userAgent.indexOf('iPhone') > -1 || userAgent.indexOf('iPad') > -1) {
        osName = 'iOS';
        osVersion = userAgent.match(/OS ([0-9_]+)/)?.[1]?.replace(/_/g, '.') || 'Unknown';
      }
      
      // Memory info
      let memory: SystemInfo['memory'] | undefined;
      if (performance && ('memory' in performance)) {
        memory = {
          jsHeapSizeLimit: (performance as unknown as { memory: { jsHeapSizeLimit: number } }).memory.jsHeapSizeLimit,
          totalJSHeapSize: (performance as unknown as { memory: { totalJSHeapSize: number } }).memory.totalJSHeapSize,
          usedJSHeapSize: (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize
        };
      }
      
      // CPU cores
      const cpuCores = navigator.hardwareConcurrency;
      
      // Audio devices - fetch asynchronously
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const audioDevices = devices.filter(device => device.kind === 'audiooutput');
          
          // Update system info
          this.debugState.systemInfo = {
            browser: {
              name: browserName,
              version: browserVersion,
              userAgent
            },
            os: {
              name: osName,
              version: osVersion
            },
            audioDevices,
            memory,
            cpuCores,
            timestamp: Date.now()
          };
          
          this.updateDebugState();
          
          if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
            console.log(`[AudioLogger] System info captured: ${browserName} ${browserVersion} on ${osName} ${osVersion}`);
            console.log(`[AudioLogger] Audio output devices: ${audioDevices.length}`);
          }
        })
        .catch(err => {
          if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
            console.error('[AudioLogger] Failed to enumerate audio devices', err);
          }
          
          // Still update system info without devices
          this.debugState.systemInfo = {
            browser: {
              name: browserName,
              version: browserVersion,
              userAgent
            },
            os: {
              name: osName,
              version: osVersion
            },
            audioDevices: [],
            memory,
            cpuCores,
            timestamp: Date.now()
          };
          
          this.updateDebugState();
        });
    }
  }

  // 9. Export / Import Methods
  public exportDebugData(): string {
    try {
      return JSON.stringify({
        debugState: this.debugState,
        audioState: this.audioState
      }, null, 2);
    } catch (e) {
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.error('[AudioLogger] Failed to export debug data', e);
      }
      return '{}';
    }
  }

  public saveDebugDataToLocalStorage(): void {
    try {
      localStorage.setItem('audioLoggerDebugData', this.exportDebugData());
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.log('[AudioLogger] Debug data saved to localStorage');
      }
    } catch (e) {
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.error('[AudioLogger] Failed to save debug data to localStorage', e);
      }
    }
  }

  public downloadDebugData(): void {
    try {
      const data = this.exportDebugData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audio-debug-${this.debugState.sessionId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.log('[AudioLogger] Debug data downloaded');
      }
    } catch (e) {
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.error('[AudioLogger] Failed to download debug data', e);
      }
    }
  }

  // 10. Helper Methods
  
  // Install event listeners on an audio element to capture its lifecycle
  public monitorAudioElement(element: HTMLAudioElement, id: string): void {
    if (!element) return;
    
    const events = [
      'play', 'pause', 'ended', 'canplay', 'error',
      'suspend', 'stalled', 'waiting', 'playing', 'timeupdate'
    ];
    
    events.forEach(eventType => {
      element.addEventListener(eventType, () => {
        this.logAudioElementEvent({
          eventType: eventType as 'play' | 'pause' | 'ended' | 'canplay' | 'error' | 'suspend' | 'stalled' | 'waiting' | 'playing' | 'timeupdate',
          currentTime: element.currentTime,
          duration: element.duration || 0,
          readyState: element.readyState,
          networkState: element.networkState,
          src: element.src,
          error: element.error,
          elementId: id
        });
      });
    });
    
    // Special handling for timeupdate - log less frequently
    let lastTimeUpdate = 0;
    element.addEventListener('timeupdate', () => {
      const now = Date.now();
      // Only log once per second
      if (now - lastTimeUpdate > 1000) {
        lastTimeUpdate = now;
        this.logAudioElementEvent({
          eventType: 'timeupdate',
          currentTime: element.currentTime,
          duration: element.duration || 0,
          readyState: element.readyState,
          networkState: element.networkState,
          elementId: id
        });
      }
    });
    
    if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
      console.log(`[AudioLogger] Now monitoring audio element with ID: ${id}`);
    }
  }

  // Monitor an AudioContext to capture its state changes
  public monitorAudioContext(context: AudioContext, id: string): void {
    if (!context) return;
    
    // Log initial state
    this.logAudioContextEvent({
      state: context.state,
      sampleRate: context.sampleRate,
      baseLatency: context.baseLatency,
      outputLatency: 'outputLatency' in context ? (context as unknown as { outputLatency: number }).outputLatency : undefined,
    });
    
    // Listen for state changes
    context.addEventListener('statechange', () => {
      this.logAudioContextEvent({
        state: context.state,
        sampleRate: context.sampleRate,
        baseLatency: context.baseLatency,
        outputLatency: 'outputLatency' in context ? (context as unknown as { outputLatency: number }).outputLatency : undefined,
      });
    });
    
    if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
      console.log(`[AudioLogger] Now monitoring AudioContext with ID: ${id}`);
    }
  }

  // Utility to decode MediaError codes
  private decodeMediaErrorCode(code: number): string {
    switch (code) {
      case MediaError.MEDIA_ERR_ABORTED:
        return 'MEDIA_ERR_ABORTED: Fetching process aborted by user';
      case MediaError.MEDIA_ERR_NETWORK:
        return 'MEDIA_ERR_NETWORK: Network error while fetching the resource';
      case MediaError.MEDIA_ERR_DECODE:
        return 'MEDIA_ERR_DECODE: Error decoding the media resource';
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        return 'MEDIA_ERR_SRC_NOT_SUPPORTED: Media type not supported';
      default:
        return `Unknown error code: ${code}`;
    }
  }

  // Setup global error handlers
  private setupErrorHandlers(): void {
    if (typeof window !== 'undefined') {
      // Global error handler
      window.addEventListener('error', (event) => {
        this.logError('window.onerror', event.message || 'Unknown error', {
          stack: event.error?.stack,
          componentName: event.filename || 'unknown',
          operationName: `line:${event.lineno}, col:${event.colno}`,
          context: { 
            source: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        });
      });
      
      // Unhandled promise rejection handler
      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        this.logError('unhandledrejection', 
          reason instanceof Error ? reason.message : String(reason),
          {
            stack: reason instanceof Error ? reason.stack : undefined,
            componentName: 'Promise',
            operationName: 'unhandledrejection'
          }
        );
      });
      
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.log('[AudioLogger] Global error handlers installed');
      }
    }
  }

  // Setup performance observers
  private setupPerformanceObservers(): void {
    if (typeof window !== 'undefined' && typeof PerformanceObserver !== 'undefined') {
      try {
        // Create observer for long tasks
        this.performanceObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.entryType === 'longtask' && entry.duration > 50) {
              if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
                console.warn(`[AudioLogger] Long task detected: ${entry.duration.toFixed(2)}ms`);
              }
              
              this.debugState.performanceMetrics.push({
                timestamp: Date.now(),
                name: 'longtask',
                duration: entry.duration,
                startTime: entry.startTime,
                details: { attribution: 'attribution' in entry ? (entry as unknown as { attribution: unknown }).attribution : null }
              });
              
              this.updateDebugState();
            }
          });
        });
        
        // Start observing
        this.performanceObserver.observe({ entryTypes: ['longtask'] });
        if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
          console.log('[AudioLogger] Performance observer installed');
        }
      } catch (e) {
        if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
          console.error('[AudioLogger] Failed to create performance observer', e);
        }
      }
    }
  }

  // Update global state (original method)
  private updateGlobalState(): void {
    if (typeof window !== 'undefined') {
      (window as WindowWithAudioState).__audioQueueState = { ...this.audioState };
    }
  }

  // Update debug state
  private updateDebugState(): void {
    if (typeof window !== 'undefined') {
      (window as WindowWithAudioState).__audioDebugState = { ...this.debugState };
      
      // Auto-save to localStorage periodically (every 100 updates)
      if (this.debugState.bufferEvents.length % 100 === 0) {
        this.saveDebugDataToLocalStorage();
      }
    }
  }
}

export default AudioLogger.getInstance();