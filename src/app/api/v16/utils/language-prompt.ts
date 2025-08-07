// Language preference injection for V16 prompts
import { formatLanguageForPrompt } from '@/lib/language-utils';

/**
 * Enhances a prompt with language preference instructions
 * @param basePrompt - The original prompt content
 * @param languageCode - The user's preferred language code (e.g., 'en', 'es', 'fr')
 * @returns Enhanced prompt with language instructions
 */
export function enhancePromptWithLanguage(basePrompt: string, languageCode: string): string {
  const languageName = formatLanguageForPrompt(languageCode);
  
  const languageInstruction = `IMPORTANT: Always communicate in ${languageName} unless the user explicitly requests a different language. The user has selected ${languageName} as their preferred language for this conversation.

`;

  // Inject language instruction at the beginning of the prompt for maximum visibility
  return languageInstruction + basePrompt;
}

/**
 * Gets language preference from request parameters or defaults to English
 * @param searchParams - URL search parameters from the request
 * @returns Language code or default 'en'
 */
export function getLanguagePreferenceFromRequest(searchParams: URLSearchParams): string {
  return searchParams.get('language') || 'en';
}