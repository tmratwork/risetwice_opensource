import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { SUPPORTED_LANGUAGES } from '@/lib/language-utils';
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
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as TranslationRequest;
    const { greeting_type, source_language = 'en', overwrite_existing = false } = body;

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

    // Fetch source greeting (English by default)
    const { data: sourceGreeting, error: sourceError } = await supabaseAdmin
      .from('greeting_resources')
      .select('*')
      .eq('greeting_type', greeting_type)
      .eq('language_code', source_language)
      .eq('is_active', true)
      .single();

    if (sourceError || !sourceGreeting) {
      console.error('[greeting_translate] Source greeting not found:', sourceError);
      return NextResponse.json(
        {
          error: `Source greeting not found for type '${greeting_type}' in language '${source_language}'. Please create the source greeting first.`,
          suggestion: `Go to /chatbotV16/admin/greetings and create a greeting for ${greeting_type} in ${source_language}`
        },
        { status: 404 }
      );
    }

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
          // Create specialized prompt for mental health greeting translation
          const systemPrompt = `You are a professional translator specializing in mental health and wellness communications. Your task is to translate greetings for a mental health support application.

IMPORTANT GUIDELINES:
- Maintain the warm, supportive, and professional tone of the original
- Preserve the conversational and approachable nature
- Use culturally appropriate language for mental health contexts
- Ensure the translation feels natural to native speakers
- Maintain any formatting (line breaks, punctuation style)
- Do not add or remove meaning - translate faithfully
- Use professional but accessible language (avoid overly clinical terms)

The greeting is used when users first interact with mental health support AI, so it should be welcoming and reduce barriers to seeking help.`;

          const userPrompt = `Translate the following mental health support greeting from English to ${language.name} (${language.nativeName}):

"${sourceGreeting.greeting_content}"

Provide only the translation, no explanations or additional text.`;

          const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.3, // Lower temperature for more consistent translations
            max_tokens: 500,
          });

          const translation = completion.choices[0]?.message?.content?.trim();

          if (!translation) {
            throw new Error('Empty translation received from OpenAI');
          }

          console.log(`[greeting_translate] Successfully translated to ${language.name}:`, {
            language_code: language.code,
            original_length: sourceGreeting.greeting_content.length,
            translation_length: translation.length,
            preview: translation.substring(0, 100) + '...'
          });

          return {
            language_code: language.code,
            language_name: language.name,
            translation,
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