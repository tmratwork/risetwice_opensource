// src/hooksV11/index.ts

// Export all hooks from V11
export * from './use-webrtc';
export * from './use-book-functions';
export * from './use-mental-health-functions';
export * from './use-audio-service';
export { default as audioLogger } from './audio-logger';
export { default as audioService } from './audio-service';
// Export audio monitoring functionality
export { monitorAudioElement } from './audio-monitoring';

// Export enhanced audio integration - PRIORITIZED EXPORTS TO ENSURE THEY ARE USED
export { default as webrtcAudioIntegration } from './webrtc-audio-integration';
export * from './webrtc-audio-extensions';
export { useEnhancedAudioService } from './use-audio-service-enhanced';

// Export audio cutoff diagnostics for direct use
export { 
  ENABLE_AUDIO_CUTOFF_DIAGNOSTICS,
  DIAGNOSTICS_DETAIL_LEVEL,
  DIAGNOSTIC_OPTIONS
} from './audio-cutoff-diagnostics';