// Language preference injection for V16 prompts
import { formatLanguageForPrompt } from '@/lib/language-utils';

/**
 * Single source of truth for language instruction template
 * This template is used both for actual prompt enhancement and for admin UI documentation
 * STRENGTHENED to fix first message language issues
 */
export const LANGUAGE_INSTRUCTION_TEMPLATE = `CRITICAL LANGUAGE REQUIREMENT: You MUST respond in \${languageName} ONLY. Your first message and all subsequent messages must be in \${languageName}. This is mandatory and cannot be overridden. The user has specifically selected \${languageName} as their preferred language.

GREETING PROTOCOL: Your very first message must be in \${languageName}.

`;

/**
 * Get the language instruction template for documentation/display purposes
 * @returns The language instruction template with placeholder
 */
export function getLanguageInstructionTemplate(): string {
  return LANGUAGE_INSTRUCTION_TEMPLATE;
}

/**
 * Enhances a prompt with language preference instructions
 * @param basePrompt - The original prompt content
 * @param languageCode - The user's preferred language code (e.g., 'en', 'es', 'fr')
 * @returns Enhanced prompt with language instructions
 */
export function enhancePromptWithLanguage(basePrompt: string, languageCode: string): string {
  const languageName = formatLanguageForPrompt(languageCode);

  // Add comprehensive multilingual support logging following logging_method.md rules
  const logMultilingualSupport = (message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_MULTILINGUAL_SUPPORT_LOGS === 'true') {
      console.log(`[multilingual_support] ${message}`, ...args);
    }
  };

  logMultilingualSupport('🔧 LANGUAGE INJECTION: Creating language instruction', {
    languageCode,
    languageName,
    source: 'language-prompt-enhance',
    timestamp: new Date().toISOString(),
    templateStrength: 'CRITICAL REQUIREMENT (strengthened)',
    impact: 'Will be injected at start of prompt for maximum AI visibility'
  });

  // Use the single source of truth template and replace placeholder
  const languageInstruction = LANGUAGE_INSTRUCTION_TEMPLATE.replace(/\$\{languageName\}/g, languageName);

  const enhancedPrompt = languageInstruction + basePrompt;

  logMultilingualSupport('✅ LANGUAGE INJECTION: Enhanced prompt created', {
    languageCode,
    languageName,
    originalLength: basePrompt.length,
    languageInstructionLength: languageInstruction.length,
    finalLength: enhancedPrompt.length,
    source: 'language-prompt-enhanced',
    impact: 'Prompt now starts with CRITICAL language requirement'
  });

  logMultilingualSupport('🔍 LANGUAGE INJECTION: Full enhanced prompt preview', {
    languageCode,
    enhancedPromptPreview: enhancedPrompt.substring(0, 500) + '...',
    source: 'language-prompt-preview',
    note: 'This is what will be sent to AI for first message generation'
  });

  // Inject language instruction at the beginning of the prompt for maximum visibility
  return enhancedPrompt;
}

/**
 * Gets language preference from request parameters or defaults to English
 * @param searchParams - URL search parameters from the request
 * @returns Language code or default 'en'
 */
export function getLanguagePreferenceFromRequest(searchParams: URLSearchParams): string {
  return searchParams.get('language') || 'en';
}