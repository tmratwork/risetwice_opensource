// file: mobile/src/config/models.ts

// Centralized LLM model configuration for mobile
// TODO: Eventually move these to Supabase tables for dynamic configuration

export const MODELS = {
  // OpenAI Models
  OPENAI: {
    GPT_4O: "gpt-4o",
    GPT_4O_MINI: "gpt-4o-mini",
    GPT_5: "gpt-5",
    GPT_5_MINI: "gpt-5-mini",
    GPT_REALTIME: "gpt-realtime", // Latest production realtime model (Jan 2025)
    GPT_4O_REALTIME_LEGACY: "gpt-4o-realtime-preview-2024-12-17", // Legacy preview version
    GPT_4O_REALTIME_MOBILE: "gpt-4o-realtime-preview-2024-10-01", // Mobile uses older version
    GPT_4O_TRANSCRIBE: "gpt-4o-transcribe",
    GPT_4O_MINI_TRANSCRIBE: "gpt-4o-mini-transcribe"
  },
  
  // Anthropic Models
  ANTHROPIC: {
    CLAUDE_SONNET_4: "claude-sonnet-4-20250514",
    CLAUDE_SONNET_3_5: "claude-3-5-sonnet-20241022"
  }
} as const;

// Model selection helpers
export const getOpenAIRealtimeModel = (isMobile = true): string => {
  return isMobile ? MODELS.OPENAI.GPT_4O_REALTIME_MOBILE : MODELS.OPENAI.GPT_REALTIME;
};

export const getTranscriptionModel = (): string => {
  return MODELS.OPENAI.GPT_4O_TRANSCRIBE;
};

export const getClaudeModel = (): string => {
  return MODELS.ANTHROPIC.CLAUDE_SONNET_4;
};

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

// Type exports for TypeScript
export type OpenAIModel = typeof MODELS.OPENAI[keyof typeof MODELS.OPENAI];
export type AnthropicModel = typeof MODELS.ANTHROPIC[keyof typeof MODELS.ANTHROPIC];
export type AllModels = OpenAIModel | AnthropicModel;