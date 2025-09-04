// file: src/config/ai-defaults.ts

// TODO: Move these configuration values to Supabase tables
// This is a temporary file to avoid hardcoding values in the main codebase
// Eventually, these should be fetched from the database

export const AI_DEFAULTS = {
  voice: "alloy",
  inputAudioFormat: "pcm16",
  outputAudioFormat: "pcm16",
  modalities: ["text", "audio"],
  inputAudioTranscription: {
    model: "gpt-4o-transcribe", // Latest transcription model (Whisper deprecated)
    language: "en"
  },
  turnDetection: {
    type: "server_vad",
    silence_duration_ms: 1000
  },
  toolChoice: "auto"
} as const;

export type AIDefaultsType = typeof AI_DEFAULTS;