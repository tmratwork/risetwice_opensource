import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { SUPPORTED_LANGUAGES } from '@/lib/language-utils';
import { getGPT4Model } from '@/config/models';
import OpenAI from 'openai';

// Initialize OpenAI client with GPT-4o
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TranslationResult {
  language_code: string;
  language_name: string;
  translation: string;
  success: boolean;
  error?: string;
}

interface TranslationRequest {
  greeting_type: string;
  source_language?: string;
  overwrite_existing?: boolean;
  main_message?: string;
  language_requirement?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as TranslationRequest;
    const { 
      greeting_type, 
      source_language = 'en', 
      overwrite_existing = false,
      main_message,
      language_requirement 
    } = body;

    console.log('[greeting_translate] Starting translation request:', {
      greeting_type,
      source_language,
      overwrite_existing,
      timestamp: new Date().toISOString()
    });

    // Validation
    if (!greeting_type) {
      return NextResponse.json(
        { error: 'greeting_type is required' },
        { status: 400 }
      );
    }

    // Use provided main_message and language_requirement, or fetch from database as fallback
    let sourceMainMessage = main_message;
    let sourceLanguageRequirement = language_requirement;
    
    if (!sourceMainMessage || !sourceLanguageRequirement) {
      // Fallback: Fetch existing source greeting from database
      const { data: sourceGreeting, error: sourceError } = await supabaseAdmin
        .from('greeting_resources')
        .select('*')
        .eq('greeting_type', greeting_type)
        .eq('language_code', source_language)
        .eq('is_active', true)
        .single();

      if (sourceError || !sourceGreeting) {
        console.error('[greeting_translate] Source greeting not found and no manual parts provided:', sourceError);
        return NextResponse.json(
          {
            error: `Source greeting not found for type '${greeting_type}' in language '${source_language}' and no manual message parts provided. Please create the source greeting first or provide main_message and language_requirement.`,
            suggestion: `Go to /chatbotV16/admin/greetings and create a greeting for ${greeting_type} in ${source_language}`
          },
          { status: 404 }
        );
      }
      
      // Try to split existing greeting into parts (basic heuristic)
      const content = sourceGreeting.greeting_content;
      const parts = content.split('. It is a requirement that you speak in ');
      if (parts.length === 2) {
        sourceMainMessage = parts[0] + '.';
        sourceLanguageRequirement = 'It is a requirement that you speak in ' + parts[1];
      } else {
        // Fallback: use entire content as main message
        sourceMainMessage = content;
        sourceLanguageRequirement = '';
      }
    }

    console.log('[greeting_translate] Using source parts:', {
      sourceMainMessage: sourceMainMessage?.substring(0, 100) + '...',
      sourceLanguageRequirement: sourceLanguageRequirement?.substring(0, 50) + '...',
      partsProvided: !!(main_message && language_requirement)
    });

    // Get languages to translate to (exclude source language)
    const targetLanguages = SUPPORTED_LANGUAGES.filter(lang => lang.code !== source_language);

    console.log('[greeting_translate] Target languages:', {
      count: targetLanguages.length,
      source_excluded: source_language,
      first_few: targetLanguages.slice(0, 5).map(l => `${l.code}:${l.name}`)
    });

    // Check for existing translations if overwrite is false
    if (!overwrite_existing) {
      const { data: existingTranslations, error: existingError } = await supabaseAdmin
        .from('greeting_resources')
        .select('language_code')
        .eq('greeting_type', greeting_type)
        .eq('is_active', true)
        .in('language_code', targetLanguages.map(l => l.code));

      if (existingError) {
        console.error('[greeting_translate] Error checking existing translations:', existingError);
        return NextResponse.json(
          { error: `Error checking existing translations: ${existingError.message}` },
          { status: 500 }
        );
      }

      if (existingTranslations && existingTranslations.length > 0) {
        const existingCodes = existingTranslations.map(t => t.language_code);
        return NextResponse.json(
          {
            error: `Existing translations found for languages: ${existingCodes.join(', ')}. Set overwrite_existing=true to replace them.`,
            existing_languages: existingCodes,
            suggestion: 'Enable overwrite option or delete existing translations first'
          },
          { status: 409 }
        );
      }
    }

    const results: TranslationResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Process translations in batches to avoid rate limits
    const BATCH_SIZE = 5;
    const batches = [];
    for (let i = 0; i < targetLanguages.length; i += BATCH_SIZE) {
      batches.push(targetLanguages.slice(i, i + BATCH_SIZE));
    }

    console.log('[greeting_translate] Processing in batches:', {
      total_languages: targetLanguages.length,
      batch_size: BATCH_SIZE,
      total_batches: batches.length
    });

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`[greeting_translate] Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} languages`);

      const batchPromises = batch.map(async (language) => {
        try {
          // TWO-PART TRANSLATION APPROACH
          let translatedMainMessage = '';
          let translatedLanguageRequirement = '';
          
          // PART 1: Translate main greeting message
          if (sourceMainMessage) {
            const mainSystemPrompt = `You are a professional translator specializing in mental health and wellness communications. Your task is to translate greeting messages for a mental health support application.

IMPORTANT GUIDELINES:
- Maintain the warm, supportive, and professional tone of the original
- Preserve the conversational and approachable nature
- Use culturally appropriate language for mental health contexts
- Ensure the translation feels natural to native speakers
- Maintain any formatting (line breaks, punctuation style)
- Do not add or remove meaning - translate faithfully
- Use professional but accessible language (avoid overly clinical terms)

The greeting is used when users first interact with mental health support AI, so it should be welcoming and reduce barriers to seeking help.`;

            const mainUserPrompt = `Translate the following mental health support greeting message from English to ${language.name} (${language.nativeName}):

"${sourceMainMessage}"

Provide only the translation, no explanations or additional text.`;

            const mainCompletion = await openai.chat.completions.create({
              model: getGPT4Model(),
              messages: [
                { role: 'system', content: mainSystemPrompt },
                { role: 'user', content: mainUserPrompt }
              ],
              temperature: 0.3,
              max_tokens: 400,
            });

            translatedMainMessage = mainCompletion.choices[0]?.message?.content?.trim() || '';
            
            if (!translatedMainMessage) {
              throw new Error('Empty main message translation received from OpenAI');
            }
          }
          
          // PART 2: Translate language requirement with smart replacement
          if (sourceLanguageRequirement) {
            const reqSystemPrompt = `You are a professional translator specializing in language requirement statements for multilingual applications.

IMPORTANT GUIDELINES:
- Translate the sentence structure naturally
- The word "English" should be replaced with the target language name in the target language
- Maintain formal but friendly tone
- Ensure grammatical correctness in the target language
- Keep the meaning clear: this is a requirement/instruction for which language to use`;

            // Replace "English" with target language in the source before translation
            const adaptedRequirement = sourceLanguageRequirement.replace(/English/g, language.nativeName);
            
            const reqUserPrompt = `Translate the following language requirement statement from English to ${language.name} (${language.nativeName}), but note that "English" has already been replaced with "${language.nativeName}":

"${adaptedRequirement}"

Provide only the translation, no explanations or additional text. Make sure it's grammatically correct and natural in ${language.nativeName}.`;

            const reqCompletion = await openai.chat.completions.create({
              model: getGPT4Model(),
              messages: [
                { role: 'system', content: reqSystemPrompt },
                { role: 'user', content: reqUserPrompt }
              ],
              temperature: 0.3,
              max_tokens: 200,
            });

            translatedLanguageRequirement = reqCompletion.choices[0]?.message?.content?.trim() || '';
          }
          
          // Combine both parts
          const finalTranslation = translatedMainMessage + (translatedLanguageRequirement ? ' ' + translatedLanguageRequirement : '');

          console.log(`[greeting_translate] Two-part translation completed for ${language.name}:`, {
            language_code: language.code,
            main_message_length: translatedMainMessage.length,
            language_req_length: translatedLanguageRequirement.length,
            combined_length: finalTranslation.length,
            preview: finalTranslation.substring(0, 100) + '...'
          });

          return {
            language_code: language.code,
            language_name: language.name,
            translation: finalTranslation,
            success: true
          } as TranslationResult;

        } catch (error) {
          console.error(`[greeting_translate] Error translating to ${language.name}:`, error);

          return {
            language_code: language.code,
            language_name: language.name,
            translation: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown translation error'
          } as TranslationResult;
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Count results
      batchResults.forEach(result => {
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      });

      // Add delay between batches to respect rate limits
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    console.log('[greeting_translate] Translation phase completed:', {
      total_processed: results.length,
      successful: successCount,
      errors: errorCount,
      success_rate: `${Math.round((successCount / results.length) * 100)}%`
    });

    // Save successful translations to database
    const successfulTranslations = results.filter(r => r.success);
    let savedCount = 0;

    if (successfulTranslations.length > 0) {
      console.log('[greeting_translate] Saving translations to database:', {
        count: successfulTranslations.length
      });

      for (const result of successfulTranslations) {
        try {
          const insertData = {
            greeting_type,
            language_code: result.language_code,
            greeting_content: result.translation,
            is_active: true,
            metadata: {
              translated_from: source_language,
              translated_at: new Date().toISOString(),
              translation_method: 'openai_gpt4o'
            }
          };

          if (overwrite_existing) {
            // Check if greeting exists first
            const { data: existingGreeting, error: checkError } = await supabaseAdmin
              .from('greeting_resources')
              .select('id')
              .eq('greeting_type', greeting_type)
              .eq('language_code', result.language_code)
              .eq('is_active', true)
              .single();

            if (checkError && checkError.code !== 'PGRST116') {
              throw checkError;
            }

            if (existingGreeting) {
              // Update existing greeting
              const { error: updateError } = await supabaseAdmin
                .from('greeting_resources')
                .update({
                  greeting_content: result.translation,
                  updated_at: new Date().toISOString(),
                  metadata: {
                    translated_from: source_language,
                    translated_at: new Date().toISOString(),
                    translation_method: 'openai_gpt4o'
                  }
                })
                .eq('id', existingGreeting.id);

              if (updateError) {
                throw updateError;
              }
            } else {
              // Insert new greeting
              const { error: insertError } = await supabaseAdmin
                .from('greeting_resources')
                .insert(insertData);

              if (insertError) {
                throw insertError;
              }
            }
          } else {
            // Insert only - check for conflicts first
            const { data: existingGreeting, error: checkError } = await supabaseAdmin
              .from('greeting_resources')
              .select('id')
              .eq('greeting_type', greeting_type)
              .eq('language_code', result.language_code)
              .eq('is_active', true)
              .single();

            if (checkError && checkError.code !== 'PGRST116') {
              throw checkError;
            }

            if (existingGreeting) {
              throw new Error(`Active greeting already exists for ${result.language_code}. Enable overwrite to replace it.`);
            }

            // Insert new greeting
            const { error: insertError } = await supabaseAdmin
              .from('greeting_resources')
              .insert(insertData);

            if (insertError) {
              throw insertError;
            }
          }

          savedCount++;
        } catch (error) {
          console.error(`[greeting_translate] Error saving translation for ${result.language_code}:`, error);
          // saveErrors++;
          // Mark this result as failed
          result.success = false;
          result.error = `Database save failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      }
    }

    const finalSuccessCount = savedCount;
    const finalErrorCount = results.length - savedCount;

    console.log('[greeting_translate] Translation operation completed:', {
      total_attempted: results.length,
      translations_successful: successCount,
      database_saves_successful: savedCount,
      final_success_count: finalSuccessCount,
      final_error_count: finalErrorCount,
      overall_success_rate: `${Math.round((finalSuccessCount / results.length) * 100)}%`
    });

    return NextResponse.json({
      success: true,
      summary: {
        greeting_type,
        source_language,
        total_languages: results.length,
        successful_translations: finalSuccessCount,
        failed_translations: finalErrorCount,
        success_rate: Math.round((finalSuccessCount / results.length) * 100)
      },
      results: results.map(r => ({
        language_code: r.language_code,
        language_name: r.language_name,
        success: r.success,
        error: r.error || undefined,
        translation_preview: r.success ? r.translation.substring(0, 100) + '...' : undefined
      })),
      message: finalSuccessCount > 0
        ? `Successfully translated and saved ${finalSuccessCount} out of ${results.length} languages`
        : 'No translations were successfully saved'
    });

  } catch (error) {
    console.error('[greeting_translate] Unexpected error in translation endpoint:', error);
    return NextResponse.json(
      {
        error: `Unexpected error during translation: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}