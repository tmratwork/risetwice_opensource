// src/hooksV11/audio-monitoring.ts

import audioLogger from './audio-logger';

/**
 * Audio Element Monitoring
 * 
 * This utility enhances audio elements with comprehensive logging for diagnostics.
 * It monitors all audio lifecycle events, performance metrics, and error states.
 */

// Interface for audio element tracking
interface TrackedAudioElement {
  element: HTMLAudioElement;
  id: string;
  createdAt: number;
  events: {
    type: string;
    timestamp: number;
    data?: Record<string, unknown>;
  }[];
}

// Global audio element registry
const audioElementRegistry: Record<string, TrackedAudioElement> = {};

// Function to generate unique ID for audio elements
function generateAudioElementId(): string {
  return `audio-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Install audio monitoring on an audio element
 * @param element The audio element to monitor
 * @param options Optional configuration options
 * @returns The ID of the monitored element
 */
export function monitorAudioElement(
  element: HTMLAudioElement, 
  options: { 
    id?: string,
    label?: string,
    expected_duration?: number,
    source_type?: string  // 'webrtc', 'file', 'url', etc.
  } = {}
): string {
  if (!element) {
    console.error('[AUDIO-MONITOR] Cannot monitor null audio element');
    return '';
  }
  
  // Generate or use provided ID
  const id = options.id || generateAudioElementId();
  const label = options.label || id;
  const expected_duration = options.expected_duration;
  const source_type = options.source_type || 'unknown';
  
  // Mark element with data attributes for easier debugging
  element.setAttribute('data-audio-monitor-id', id);
  element.setAttribute('data-audio-monitor-label', label);
  element.setAttribute('data-audio-source-type', source_type);
  if (expected_duration) {
    element.setAttribute('data-audio-expected-duration', expected_duration.toString());
  }
  
  // Initialize tracking data
  const trackedElement: TrackedAudioElement = {
    element,
    id,
    createdAt: Date.now(),
    events: []
  };
  
  // Register element
  audioElementRegistry[id] = trackedElement;
  
  // Log creation
  console.log(`[AUDIO-MONITOR] Started monitoring audio element: ${label} (${id})`);
  
  // Record creation event
  trackedElement.events.push({
    type: 'created',
    timestamp: Date.now(),
    data: {
      src: element.src,
      expected_duration,
      source_type
    }
  });
  
  // Register with audio logger
  audioLogger.logUserInteraction('audio-element-created', {
    elementId: id,
    label,
    src: element.src,
    expected_duration,
    source_type,
    timestamp: Date.now()
  });
  
  // Start performance monitoring
  audioLogger.startMeasure(`audio-lifecycle-${id}`, {
    elementId: id,
    label,
    source_type,
    expected_duration
  });
  
  // Install event listeners for all audio lifecycle events
  const audioEvents = [
    'abort', 'canplay', 'canplaythrough', 'durationchange', 'emptied',
    'ended', 'error', 'loadeddata', 'loadedmetadata', 'loadstart',
    'pause', 'play', 'playing', 'progress', 'ratechange',
    'seeked', 'seeking', 'stalled', 'suspend', 'timeupdate',
    'volumechange', 'waiting'
  ];
  
  audioEvents.forEach(eventType => {
    element.addEventListener(eventType, () => {
      // Record event to local registry
      const eventData = {
        type: eventType,
        timestamp: Date.now(),
        data: {
          currentTime: element.currentTime,
          duration: element.duration || 0,
          readyState: element.readyState,
          networkState: element.networkState,
          src: element.src,
          error: element.error,
          paused: element.paused,
          ended: element.ended,
          muted: element.muted,
          volume: element.volume
        }
      };
      
      trackedElement.events.push(eventData);
      
      // Log to audio logger for significant events
      if (['play', 'pause', 'ended', 'error', 'stalled', 'waiting', 'canplaythrough', 'loadedmetadata'].includes(eventType)) {
        // Prepare error details if applicable
        let errorDetails = null;
        if (eventType === 'error' && element.error) {
          errorDetails = {
            code: element.error.code,
            message: decodeMediaErrorCode(element.error.code),
            elementId: id
          };
          
          console.error(`[AUDIO-MONITOR] Audio error in ${label} (${id}): ${decodeMediaErrorCode(element.error.code)}`);
          
          // Also log to audioLogger's error system
          audioLogger.logError('audio-element-error', `Error in ${label}: ${decodeMediaErrorCode(element.error.code)}`, {
            componentName: 'AudioElement',
            operationName: 'playback',
            context: errorDetails
          });
        }
        
        audioLogger.logAudioElementEvent({
          eventType: eventType as 'play' | 'pause' | 'ended' | 'canplay' | 'error' | 'suspend' | 'stalled' | 'waiting' | 'playing' | 'timeupdate',
          currentTime: element.currentTime,
          duration: element.duration || 0,
          readyState: element.readyState,
          networkState: element.networkState,
          src: element.src,
          error: element.error,
          elementId: id
        });
        
        // Log important events to console
        const eventColor = getEventColor(eventType);
        console.log(`%c[AUDIO-MONITOR] ${eventType.toUpperCase()} - ${label} (${id})`, 
          `color: ${eventColor}; font-weight: bold`,
          eventData.data);
      }
      
      // For timeupdate, only log periodically to avoid flooding
      if (eventType === 'timeupdate') {
        const timeupdateInterval = 1000; // Log once per second
        const lastTimeupdate = trackedElement.events
          .filter(e => e.type === 'timeupdate')
          .sort((a, b) => b.timestamp - a.timestamp)[1]; // Second most recent
          
        if (!lastTimeupdate || (Date.now() - lastTimeupdate.timestamp > timeupdateInterval)) {
          // Calculate playback progress
          const progress = element.duration ? (element.currentTime / element.duration) * 100 : 0;
          const bufferSize = getBufferedAmount(element);
          // const remainingTime = element.duration ? element.duration - element.currentTime : 0;
          
          // Only log to console occasionally
          if (Math.random() < 0.1) {
            console.log(`[AUDIO-MONITOR] Time update ${label}: ${element.currentTime.toFixed(2)}s / ${element.duration.toFixed(2)}s (${progress.toFixed(1)}%) [Buffered: ${bufferSize.toFixed(1)}%]`);
          }
          
          // Log buffer metrics
          if (bufferSize < 50 && element.readyState < 4) {
            console.warn(`[AUDIO-MONITOR] Low buffer in ${label}: ${bufferSize.toFixed(1)}%, readyState: ${element.readyState}`);
            
            audioLogger.logUserInteraction('audio-buffer-low', {
              elementId: id,
              bufferPercentage: bufferSize,
              readyState: element.readyState,
              currentTime: element.currentTime,
              duration: element.duration,
              timestamp: Date.now()
            });
          }
        }
      }
      
      // For ended events, measure total playback duration
      if (eventType === 'ended') {
        const creationEvent = trackedElement.events.find(e => e.type === 'created');
        const loadedEvent = trackedElement.events.find(e => e.type === 'loadedmetadata');
        const playEvent = trackedElement.events.find(e => e.type === 'play');
        
        if (creationEvent && loadedEvent && playEvent) {
          const totalTime = Date.now() - creationEvent.timestamp;
          const loadTime = loadedEvent.timestamp - creationEvent.timestamp;
          const playbackTime = Date.now() - playEvent.timestamp;
          const expectedDuration = expected_duration || element.duration;
          
          // Calculate if playback was complete
          const completionRatio = element.duration ? element.currentTime / element.duration : 1;
          const isComplete = completionRatio > 0.98; // Consider 98% as complete
          
          // Log completion metrics
          audioLogger.logCompletionEvent(
            'audio-playback-complete',
            trackedElement.events.length,
            isComplete,
            `${label} playback ${isComplete ? 'completed' : 'interrupted'} after ${playbackTime}ms (expected: ${expectedDuration * 1000}ms)`
          );
          
          // End performance measure
          audioLogger.endMeasure(`audio-lifecycle-${id}`, {
            elementId: id,
            label,
            totalTime,
            loadTime,
            playbackTime,
            duration: element.duration,
            expectedDuration,
            isComplete,
            completionRatio,
            eventCount: trackedElement.events.length
          });
          
          console.log(`[AUDIO-MONITOR] Playback ended for ${label} (${id}):`, {
            totalTime: `${(totalTime / 1000).toFixed(2)}s`,
            loadTime: `${(loadTime / 1000).toFixed(2)}s`,
            playbackTime: `${(playbackTime / 1000).toFixed(2)}s`,
            actualDuration: `${element.duration.toFixed(2)}s`,
            expectedDuration: expected_duration ? `${expected_duration.toFixed(2)}s` : 'unknown',
            completionRatio: `${(completionRatio * 100).toFixed(1)}%`
          });
          
          // Clean up registry to prevent memory leaks (delayed cleanup)
          setTimeout(() => {
            if (audioElementRegistry[id]) {
              delete audioElementRegistry[id];
              console.log(`[AUDIO-MONITOR] Cleaned up tracked audio element: ${label} (${id})`);
            }
          }, 5000);
        }
      }
    });
  });
  
  // Return ID for reference
  return id;
}

/**
 * Monitor all existing audio elements and install observer for new elements
 */
export function installAudioMonitoring(): void {
  console.log('[AUDIO-MONITOR] Installing global audio monitoring');
  
  // Log system audio capabilities
  logSystemAudioCapabilities();
  
  // Monitor existing audio elements
  document.querySelectorAll('audio').forEach((audioElement) => {
    // Skip if already monitored
    if (audioElement.hasAttribute('data-audio-monitor-id')) {
      return;
    }
    
    // Determine source type
    const src = audioElement.src || '';
    const sourceType = src.includes('blob:') ? 'blob' :
                      src.includes('/audio-responses/') ? 'audio-response' : 
                      'file';
    
    // Monitor element
    monitorAudioElement(audioElement, {
      label: `existing-${sourceType}`,
      source_type: sourceType
    });
  });
  
  // Install mutation observer to catch dynamically added audio elements
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          // Check if the added node is an audio element
          if (node.nodeName === 'AUDIO') {
            const audioElement = node as HTMLAudioElement;
            
            // Skip if already monitored
            if (audioElement.hasAttribute('data-audio-monitor-id')) {
              return;
            }
            
            // Determine source type
            const src = audioElement.src || '';
            const sourceType = src.includes('blob:') ? 'blob' :
                              src.includes('/audio-responses/') ? 'audio-response' : 
                              'file';
            
            // Monitor element
            monitorAudioElement(audioElement, {
              label: `dynamic-${sourceType}`,
              source_type: sourceType
            });
          }
          
          // Recursively check children of added node
          if (node.childNodes?.length) {
            node.childNodes.forEach((childNode) => {
              if (childNode.nodeName === 'AUDIO') {
                const audioElement = childNode as HTMLAudioElement;
                
                // Skip if already monitored
                if (audioElement.hasAttribute('data-audio-monitor-id')) {
                  return;
                }
                
                // Determine source type
                const src = audioElement.src || '';
                const sourceType = src.includes('blob:') ? 'blob' :
                                  src.includes('/audio-responses/') ? 'audio-response' : 
                                  'file';
                
                // Monitor element
                monitorAudioElement(audioElement, {
                  label: `nested-${sourceType}`,
                  source_type: sourceType
                });
              }
            });
          }
        });
      }
    });
  });
  
  // Start observing the entire document
  observer.observe(document, { childList: true, subtree: true });
  
  // Install AudioContext monitoring
  monkeyPatchAudioContext();
  
  // Only log initialization completion
  console.log('[AUDIO-MONITOR] Audio monitoring installed successfully');
  
  // Log installation complete
  audioLogger.logUserInteraction('audio-monitoring-installed', {
    timestamp: Date.now(),
    existingElements: document.querySelectorAll('audio').length
  });
}

// Function removed - logging only implementation

/**
 * Monkey patch AudioContext to monitor its usage
 */
function monkeyPatchAudioContext() {
  if (typeof window !== 'undefined' && window.AudioContext) {
    const OriginalAudioContext = window.AudioContext;
    let contextCounter = 0;
    
    // Replace the constructor with our instrumented version
    window.AudioContext = function() {
      const id = `audio-context-${++contextCounter}`;
      console.log(`[AUDIO-MONITOR] Creating new AudioContext: ${id}`);
      
      // Create the original context
      const context = new OriginalAudioContext();
      
      // Log creation event
      audioLogger.logAudioContextEvent({
        state: context.state,
        sampleRate: context.sampleRate,
        baseLatency: context.baseLatency,
        outputLatency: 'outputLatency' in context ? (context as unknown as { outputLatency: number }).outputLatency : undefined
      });
      
      // Monitor state changes
      context.addEventListener('statechange', () => {
        console.log(`[AUDIO-MONITOR] AudioContext ${id} state changed to: ${context.state}`);
        
        audioLogger.logAudioContextEvent({
          state: context.state,
          sampleRate: context.sampleRate,
          baseLatency: context.baseLatency,
          outputLatency: 'outputLatency' in context ? (context as unknown as { outputLatency: number }).outputLatency : undefined
        });
      });
      
      // Instrument method calls
      const originalCreateBufferSource = context.createBufferSource;
      context.createBufferSource = function(...args) {
        const source = originalCreateBufferSource.apply(this, args);
        const sourceId = `buffer-source-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
        
        // Instrument start method
        const originalStart = source.start;
        source.start = function(...args) {
          console.log(`[AUDIO-MONITOR] Starting AudioBufferSourceNode ${sourceId}`);
          
          // Log buffer metrics if available
          if (source.buffer) {
            const bufferId = audioLogger.logAudioBuffer(
              source.buffer.length * source.buffer.numberOfChannels * 4, // Approx size
              'audio-buffer-source',
              {
                sampleRate: source.buffer.sampleRate,
                duration: source.buffer.duration,
                channelCount: source.buffer.numberOfChannels
              }
            );
            
            console.log(`[AUDIO-MONITOR] Buffer metrics for ${sourceId}:`, {
              duration: source.buffer.duration.toFixed(3) + 's',
              sampleRate: source.buffer.sampleRate + 'Hz',
              channels: source.buffer.numberOfChannels,
              size: (source.buffer.length * source.buffer.numberOfChannels * 4 / 1024).toFixed(1) + 'KB'
            });
            
            // Track performance
            audioLogger.startMeasure(`buffer-playback-${bufferId}`, {
              sourceId,
              bufferId,
              duration: source.buffer.duration,
              timestamp: Date.now()
            });
            
            // Track completion
            source.addEventListener('ended', () => {
              audioLogger.endMeasure(`buffer-playback-${bufferId}`, {
                completed: true,
                timestamp: Date.now()
              });
              
              console.log(`[AUDIO-MONITOR] AudioBufferSourceNode ${sourceId} playback completed`);
            });
          }
          
          return originalStart.apply(this, args);
        };
        
        return source;
      };
      
      return context as AudioContext;
    } as unknown as typeof AudioContext;
    
    // Maintain prototype
    window.AudioContext.prototype = OriginalAudioContext.prototype;
    
    console.log('[AUDIO-MONITOR] AudioContext instrumentation installed');
  }
}

/**
 * Log system audio capabilities
 */
function logSystemAudioCapabilities() {
  if (typeof window === 'undefined') return;
  
  // Check for Audio API support
  const audioSupport = {
    htmlAudio: !!window.Audio,
    webAudio: !!window.AudioContext,
    mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices),
    mediaSession: !!navigator.mediaSession,
    webkitAudioContext: !!('webkitAudioContext' in window),
    mozAudioContext: !!('mozAudioContext' in window)
  };
  
  console.log('[AUDIO-MONITOR] Audio API support:', audioSupport);
  
  // Check audio format support
  const audioElement = document.createElement('audio');
  const formats = {
    mp3: audioElement.canPlayType('audio/mpeg') || '',
    ogg: audioElement.canPlayType('audio/ogg; codecs="vorbis"') || '',
    wav: audioElement.canPlayType('audio/wav') || '',
    aac: audioElement.canPlayType('audio/aac') || '',
    m4a: audioElement.canPlayType('audio/x-m4a') || '',
    opus: audioElement.canPlayType('audio/opus') || '',
    webm: audioElement.canPlayType('audio/webm; codecs="vorbis"') || ''
  };
  
  console.log('[AUDIO-MONITOR] Audio format support:', formats);
  
  // Only try to get sample rate if AudioContext is supported
  let sampleRate = 'unknown';
  try {
    if (window.AudioContext) {
      const tempContext = new AudioContext();
      sampleRate = tempContext.sampleRate.toString();
      tempContext.close();
    }
  } catch (e) {
    console.log('[AUDIO-MONITOR] Could not get sample rate:', e);
  }
  
  // Log to audioLogger with safe sample rate
  audioLogger.logUserInteraction('audio-capabilities', {
    apiSupport: { ...audioSupport, sampleRate },
    formatSupport: formats,
    timestamp: Date.now()
  });
}

/**
 * Calculate the amount of buffered audio as a percentage
 */
function getBufferedAmount(audio: HTMLAudioElement): number {
  if (!audio.buffered || !audio.buffered.length || !audio.duration) {
    return 0;
  }
  
  let buffered = 0;
  for (let i = 0; i < audio.buffered.length; i++) {
    if (audio.buffered.start(i) <= audio.currentTime && audio.currentTime <= audio.buffered.end(i)) {
      buffered = audio.buffered.end(i) - audio.currentTime;
      break;
    }
  }
  
  return (buffered / audio.duration) * 100;
}

/**
 * Get color for different event types for console.log styling
 */
function getEventColor(eventType: string): string {
  switch (eventType) {
    case 'play':
    case 'playing':
    case 'canplaythrough':
      return 'green';
    case 'pause':
    case 'ended':
      return 'blue';
    case 'waiting':
    case 'stalled':
    case 'suspend':
      return 'orange';
    case 'error':
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Decode MediaError codes to human-readable messages
 */
function decodeMediaErrorCode(code: number): string {
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

// Function already exported at declaration