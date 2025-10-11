// file: src/config/models.ts

// Single source of truth for all AI models used across the application
// Last updated: January 2025 - Using latest GPT-5 and gpt-realtime models

export const MODELS = {
  // OpenAI Models
  OPENAI: {
    // GPT-5 Family (Released August 2025) - Latest and most capable
    GPT_5: "gpt-5", // Full-sized reasoning model
    GPT_5_MINI: "gpt-5-mini", // Cost-effective variant (272K input, 128K output)
    GPT_5_NANO: "gpt-5-nano", // Smallest and fastest variant
    GPT_5_CHAT: "gpt-5-chat", // Non-reasoning model for ChatGPT
    GPT_5_CHAT_LATEST: "gpt-5-chat-latest", // Latest chat model via API

    // GPT-4 Family (Legacy - kept for compatibility)
    GPT_4O: "gpt-4o",
    GPT_4O_MINI: "gpt-4o-mini",

    // Realtime API models (for WebRTC/voice)
    GPT_REALTIME: "gpt-realtime", // Latest production realtime model (August 2025)
    GPT_4O_REALTIME_LEGACY: "gpt-4o-realtime-preview-2024-12-17", // Deprecated
    GPT_4O_REALTIME_MOBILE: "gpt-4o-realtime-preview-2024-10-01", // Mobile uses older version

    // Transcription models
    GPT_4O_TRANSCRIBE: "gpt-4o-transcribe",
    GPT_4O_MINI_TRANSCRIBE: "gpt-4o-mini-transcribe"
  },

  // Anthropic Models
  // new model, but expensive: claude-opus-4-1-20250805
  ANTHROPIC: {
    CLAUDE_SONNET_4_5: "claude-sonnet-4-5-20250929",
    CLAUDE_SONNET_4: "claude-sonnet-4-20250514",
    CLAUDE_SONNET_3_5: "claude-3-5-sonnet-20241022"
  },

  // Default models for different use cases (using latest GPT-5)
  DEFAULTS: {
    REALTIME_VOICE: "gpt-realtime", // Use latest realtime model
    CHAT_COMPLETION: "gpt-5-mini", // Cost-effective GPT-5 for chat
    MEMORY_PROCESSING: "gpt-5-mini", // GPT-5 mini for memory operations
    MEMORY_MERGE: "gpt-5-mini", // GPT-5 mini for memory merging
    ANALYSIS: "gpt-5-mini", // Upgraded from gpt-4o to gpt-5-mini
    TRANSCRIPTION: "gpt-4o-transcribe", // Keep current transcription model
    HIGH_COMPLEXITY: "gpt-5", // Use full GPT-5 for complex reasoning
  }
} as const;

// Model selection helpers
export const getOpenAIRealtimeModel = (isMobile = false): string => {
  return isMobile ? MODELS.OPENAI.GPT_4O_REALTIME_MOBILE : MODELS.DEFAULTS.REALTIME_VOICE;
};

export const getTranscriptionModel = (): string => {
  return MODELS.DEFAULTS.TRANSCRIPTION;
};

export const getClaudeModel = (): string => {
  return MODELS.ANTHROPIC.CLAUDE_SONNET_4_5;
};

// Updated to use GPT-5 models by default
export const getChatModel = (): string => {
  return MODELS.DEFAULTS.CHAT_COMPLETION; // Now uses gpt-5-mini
};

export const getAnalysisModel = (): string => {
  return MODELS.DEFAULTS.ANALYSIS; // Now uses gpt-5-mini
};

export const getMemoryModel = (): string => {
  return MODELS.DEFAULTS.MEMORY_PROCESSING; // Now uses gpt-5-mini
};

// Legacy compatibility functions (kept for backward compatibility)
export const getGPT4Model = (): string => {
  return MODELS.OPENAI.GPT_4O;
};

export const getGPT4MiniModel = (): string => {
  return MODELS.OPENAI.GPT_4O_MINI;
};

export const getGPT5Model = (): string => {
  return MODELS.OPENAI.GPT_5;
};

export const getGPT5MiniModel = (): string => {
  return MODELS.OPENAI.GPT_5_MINI;
};

export const getClaude35Model = (): string => {
  return MODELS.ANTHROPIC.CLAUDE_SONNET_3_5;
};

// Helper function to get model based on token requirements
export function getModelForTokenCount(tokenCount: number): string {
  if (tokenCount > 100000) {
    return MODELS.OPENAI.GPT_5; // Use full GPT-5 for very large contexts
  }
  if (tokenCount > 50000) {
    return MODELS.OPENAI.GPT_5_MINI; // GPT-5 mini for large contexts
  }
  return MODELS.DEFAULTS.CHAT_COMPLETION; // Default GPT-5 mini for normal use
}

// Helper function to get appropriate model for complexity
export function getModelForComplexity(complexity: 'low' | 'medium' | 'high'): string {
  switch (complexity) {
    case 'high':
      return MODELS.DEFAULTS.HIGH_COMPLEXITY; // Full GPT-5
    case 'medium':
      return MODELS.DEFAULTS.ANALYSIS; // GPT-5 mini
    case 'low':
    default:
      return MODELS.DEFAULTS.CHAT_COMPLETION; // GPT-5 mini
  }
}

// Type exports for TypeScript
export type OpenAIModel = typeof MODELS.OPENAI[keyof typeof MODELS.OPENAI];
export type AnthropicModel = typeof MODELS.ANTHROPIC[keyof typeof MODELS.ANTHROPIC];
export type AllModels = OpenAIModel | AnthropicModel;