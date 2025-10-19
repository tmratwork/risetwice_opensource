// file: src/config/ai-defaults-v18.ts

import { getTranscriptionModel } from './models';

// V18-specific AI defaults for patient intake
// KEY DIFFERENCE: turn_detection is set to null for manual push-to-talk mode
// This prevents OpenAI from automatically detecting when user stops speaking
// Instead, user must click "Send" button to commit audio and trigger response

export const AI_DEFAULTS_V18 = {
  voice: "alloy",
  inputAudioFormat: "pcm16",
  outputAudioFormat: "pcm16",
  modalities: ["text", "audio"],
  inputAudioTranscription: {
    model: getTranscriptionModel(),
    language: "en"
  },
  // CRITICAL: null disables automatic Voice Activity Detection (VAD)
  // User must manually trigger response via Send button
  turnDetection: null,
  toolChoice: "auto"
} as const;

export type AIDefaultsV18Type = typeof AI_DEFAULTS_V18;
