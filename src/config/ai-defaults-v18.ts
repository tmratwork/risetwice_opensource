// file: src/config/ai-defaults-v18.ts

import { getTranscriptionModel } from './models';

// V18-specific AI defaults for patient intake
// KEY DIFFERENCE: Uses server VAD with create_response: false for manual push-to-talk mode
// Server VAD automatically commits audio buffer and provides real-time transcription
// But we manually control when to trigger AI response via Send button

export const AI_DEFAULTS_V18 = {
  voice: "alloy",
  inputAudioFormat: "pcm16",
  outputAudioFormat: "pcm16",
  modalities: ["text", "audio"],
  inputAudioTranscription: {
    model: getTranscriptionModel(),
    language: "en"
  },
  // CRITICAL: Server VAD with create_response: false
  // - VAD auto-commits buffer when user pauses → enables real-time transcription
  // - create_response: false → prevents automatic AI response
  // - User must click "Send" button to manually trigger response.create
  turnDetection: {
    type: "server_vad",
    threshold: 0.5,
    prefix_padding_ms: 300,
    silence_duration_ms: 1000,
    create_response: false  // Manual response control
  },
  toolChoice: "auto"
} as const;

export type AIDefaultsV18Type = typeof AI_DEFAULTS_V18;
