// Single source of truth for all AI models used across the application
// Last updated: September 2025

export const AI_MODELS = {
  // Realtime API models (for WebRTC/voice)
  REALTIME: {
    LATEST: 'gpt-realtime', // Latest production-ready voice model (August 2025)
    LEGACY_DEC_2024: 'gpt-4o-realtime-preview-2024-12-17', // Deprecated
    LEGACY_JUN_2025: 'gpt-4o-realtime-preview-2025-06-03', // Deprecated
  },

  // GPT-5 Family (Released August 2025)
  GPT5: {
    FULL: 'gpt-5', // Full-sized reasoning model
    MINI: 'gpt-5-mini', // Cost-effective variant (272K input, 128K output)
    NANO: 'gpt-5-nano', // Smallest and fastest variant
    CHAT: 'gpt-5-chat', // Non-reasoning model for ChatGPT
    CHAT_LATEST: 'gpt-5-chat-latest', // Latest chat model via API
  },

  // GPT-4 Family (Legacy)
  GPT4: {
    OMNI: 'gpt-4o', // GPT-4 Omni
    OMNI_MINI: 'gpt-4o-mini', // GPT-4 Omni Mini
    TURBO: 'gpt-4-turbo', // GPT-4 Turbo
    BASE: 'gpt-4', // Base GPT-4
  },

  // Transcription models
  TRANSCRIPTION: {
    LATEST: 'gpt-4o-transcribe', // Latest transcription model
    MINI: 'gpt-4o-mini-transcribe', // Mini transcription model
    WHISPER: 'whisper-1', // Legacy Whisper (deprecated)
  },

  // Default models for different use cases
  DEFAULTS: {
    REALTIME_VOICE: 'gpt-realtime',
    CHAT_COMPLETION: 'gpt-5-mini',
    MEMORY_PROCESSING: 'gpt-5-mini',
    MEMORY_MERGE: 'gpt-5-mini',
    ANALYSIS: 'gpt-4o', // Can upgrade to gpt-5-mini
    TRANSCRIPTION: 'gpt-4o-transcribe',
  }
} as const;

// Type exports
export type RealtimeModel = typeof AI_MODELS.REALTIME[keyof typeof AI_MODELS.REALTIME];
export type GPT5Model = typeof AI_MODELS.GPT5[keyof typeof AI_MODELS.GPT5];
export type GPT4Model = typeof AI_MODELS.GPT4[keyof typeof AI_MODELS.GPT4];
export type TranscriptionModel = typeof AI_MODELS.TRANSCRIPTION[keyof typeof AI_MODELS.TRANSCRIPTION];
export type DefaultModel = typeof AI_MODELS.DEFAULTS[keyof typeof AI_MODELS.DEFAULTS];

// Helper function to get model based on token requirements
export function getModelForTokenCount(tokenCount: number): string {
  if (tokenCount > 50000) {
    return AI_MODELS.GPT5.FULL; // Use full GPT-5 for very large contexts
  }
  return AI_MODELS.GPT5.MINI; // Default to GPT-5-mini (272K token limit)
}

// Export specific models for backward compatibility
export const REALTIME_MODEL = AI_MODELS.DEFAULTS.REALTIME_VOICE;
export const CHAT_MODEL = AI_MODELS.DEFAULTS.CHAT_COMPLETION;
export const MEMORY_MODEL = AI_MODELS.DEFAULTS.MEMORY_PROCESSING;