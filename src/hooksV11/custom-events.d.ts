// src/hooksV11/custom-events.d.ts

/**
 * TypeScript declarations for custom events used in the application
 */

interface WebRTCAudioLevelEventDetail {
  level: number;
}

interface WebRTCAudioStateChangeEventDetail {
  isPlaying: boolean;
}

interface WindowEventMap {
  'webrtc-audio-level': CustomEvent<WebRTCAudioLevelEventDetail>;
  'webrtc-audio-state-change': CustomEvent<WebRTCAudioStateChangeEventDetail>;
}

// Additional extensions for window object
interface Window {
  __audioBufferTimings?: {
    firstBufferTime: number;
    lastBufferTime: number;
    bufferIntervals: number[];
    totalBuffers: number;
    totalBufferSize: number;
    bufferSizes: number[];
    responseStartTime: number;
    stopSignalTime?: number;
    stopSignalMsgId?: string;
    expectedTotalDuration?: number;
  };
  __audioPlaybackTimings?: {
    chunks: Record<string, unknown>[];
    currentChunk: Record<string, unknown>;
    playbackSuccessCount: number;
    playbackErrorCount: number;
    totalDuration: number;
  };
  __audioChunkLifecycle?: Record<string, {
    received: number;
    size: number;
    status: string;
    msgId: string;
    bufferIndex: number;
    enqueued?: number;
    playStart?: number;
    playEnd?: number;
    playDuration?: number;
    errorTime?: number;
    queuePosition?: number;
    errorDetails?: {
      timeElapsed: number;
      event: string;
    };
  }>;
  __emptyQueueTimings?: {
    emptyCount: number;
    timestamps: number[];
    pendingChunksAtEmpty: number[];
  };
  __prematureStopSignals?: Record<string, unknown>[];
  __prematureCutoffs?: Record<string, unknown>[];
  __audioFinalizations?: Record<string, unknown>[];
  __audioFinalizationState?: Record<string, unknown>[];
  __hasStartedMessage?: boolean;
  __lastMessageId?: string;
  __currentResponseText?: string;
  __audioBufferCount?: number;
  manualEndTimeout?: ReturnType<typeof setTimeout>;
}