import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLanguagePreferenceFromRequest } from '../utils/language-prompt';
import { logMultilingualSupportServer } from '@/utils/server-logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const greetingType = searchParams.get('type');
    const userId = searchParams.get('userId');
    const languagePreference = getLanguagePreferenceFromRequest(searchParams);

    // Comprehensive logging for multilingual support debugging
    const logMultilingualSupport = (message: string, ...args: unknown[]) => {
      if (process.env.NEXT_PUBLIC_ENABLE_MULTILINGUAL_SUPPORT_LOGS === 'true') {
        console.log(`[multilingual_support] ${message}`, ...args);
      }
    };

    // All logs use single consistent prefix for multilingual support debugging
    const logGreeting = (message: string, ...args: unknown[]) => {
      if (process.env.NEXT_PUBLIC_ENABLE_MULTILINGUAL_SUPPORT_LOGS === 'true') {
        console.log(`[multilingual_support] ${message}`, ...args);
      }
    };

    // CRITICAL: Log the full request details for multilingual debugging
    logMultilingualSupport('🌐 API: greeting-prompt request received', {
      greetingType,
      languagePreference,
      userId: userId || 'anonymous',
      url: request.url,
      timestamp: new Date().toISOString(),
      source: 'api-greeting-prompt',
      requestHeaders: {
        'accept-language': request.headers.get('accept-language'),
        'user-agent': request.headers.get('user-agent')
      }
    });

    // Server-side file logging
    logMultilingualSupportServer({
      level: 'INFO',
      category: 'GREETING_REQUEST',
      operation: 'greeting-prompt-requested',
      userId: userId || 'anonymous',
      data: {
        greetingType,
        languagePreference,
        url: request.url,
        source: 'api-greeting-prompt'
      }
    });

    logGreeting('API: greeting-prompt request received', {
      greetingType,
      languagePreference,
      userId: userId || 'anonymous',
      url: request.url,
      timestamp: new Date().toISOString(),
      source: 'api-greeting-prompt'
    });

    if (!greetingType) {
      const error = 'Greeting type is required. Please specify ?type=resources (or other greeting type)';
      logMultilingualSupport('❌ API: Missing greeting type parameter', { 
        error, 
        languagePreference,
        source: 'validation-error' 
      });
      logGreeting('❌ API: Missing greeting type parameter', { error });
      
      // Server-side file logging for error
      logMultilingualSupportServer({
        level: 'ERROR',
        category: 'VALIDATION_ERROR',
        operation: 'missing-greeting-type',
        userId: userId || 'anonymous',
        error,
        data: { languagePreference }
      });
      
      return NextResponse.json(
        { error, details: 'Available types: resources, triage, crisis' },
        { status: 400 }
      );
    }

    logMultilingualSupport('🔍 API: Querying Supabase for multilingual greeting', {
      greetingType,
      languagePreference,
      table: 'greeting_resources',
      query: {
        greeting_type: greetingType,
        language_code: languagePreference,
        is_active: true
      },
      source: 'api-greeting-db-query'
    });

    logGreeting('API: Querying Supabase for greeting', {
      greetingType,
      languagePreference,
      table: 'greeting_resources',
      source: 'api-greeting-db-query'
    });

    // Server-side file logging for database query
    logMultilingualSupportServer({
      level: 'INFO',
      category: 'DATABASE_QUERY',
      operation: 'greeting-query-initiated',
      userId: userId || 'anonymous',
      data: {
        greetingType,
        languagePreference,
        table: 'greeting_resources',
        queryConditions: {
          greeting_type: greetingType,
          language_code: languagePreference,
          is_active: true
        }
      }
    });

    // Load greeting from Supabase greeting_resources table
    const { data: greetingData, error } = await supabaseAdmin
      .from('greeting_resources')
      .select('*')
      .eq('greeting_type', greetingType)
      .eq('language_code', languagePreference)
      .eq('is_active', true)
      .single();

    if (error) {
      let errorMessage: string;
      let statusCode: number;

      if (error.code === 'PGRST116') {
        // No rows found - specific error for missing greeting
        errorMessage = `No active greeting found for type '${greetingType}' in language '${languagePreference}'. Please create this greeting in the admin interface at /chatbotV16/admin/greetings`;
        statusCode = 404;
        
        logMultilingualSupport('❌ CRITICAL: No multilingual greeting found in database', {
          greetingType,
          languagePreference,
          errorCode: 'PGRST116_NO_ROWS',
          suggestion: 'Create greeting in admin interface',
          adminUrl: '/chatbotV16/admin/greetings',
          source: 'database-no-rows',
          impact: 'AI will not have greeting in selected language'
        });
        
        logGreeting('❌ API: No greeting found', {
          greetingType,
          languagePreference,
          error: 'PGRST116_NO_ROWS',
          suggestion: 'Create greeting in admin interface'
        });

        // Server-side file logging for missing greeting
        logMultilingualSupportServer({
          level: 'ERROR',
          category: 'MISSING_GREETING',
          operation: 'greeting-not-found',
          userId: userId || 'anonymous',
          error: errorMessage,
          data: {
            greetingType,
            languagePreference,
            errorCode: 'PGRST116_NO_ROWS',
            adminUrl: '/chatbotV16/admin/greetings',
            impact: 'AI will not have greeting in selected language'
          }
        });
      } else {
        // Database error
        errorMessage = `Database error loading greeting: ${error.message}`;
        statusCode = 500;
        
        logMultilingualSupport('❌ CRITICAL: Database error loading multilingual greeting', {
          greetingType,
          languagePreference,
          errorMessage: error.message,
          errorCode: error.code,
          errorDetails: error.details,
          source: 'database-error',
          impact: 'Complete multilingual support failure'
        });
        
        logGreeting('❌ API: Database error loading greeting', {
          greetingType,
          languagePreference,
          error: error.message,
          code: error.code,
          details: error.details
        });

        // Server-side file logging for database error
        logMultilingualSupportServer({
          level: 'ERROR',
          category: 'DATABASE_ERROR',
          operation: 'greeting-query-failed',
          userId: userId || 'anonymous',
          error: error.message,
          data: {
            greetingType,
            languagePreference,
            errorCode: error.code,
            errorDetails: error.details,
            impact: 'Complete multilingual support failure'
          }
        });
      }

      return NextResponse.json(
        { 
          error: errorMessage,
          greetingType,
          languagePreference,
          suggestion: statusCode === 404 ? 'Create this greeting in the admin interface' : 'Check database connection',
          adminUrl: '/chatbotV16/admin/greetings'
        },
        { status: statusCode }
      );
    }

    if (!greetingData) {
      const errorMessage = `No greeting data returned for type '${greetingType}' in language '${languagePreference}'`;
      
      logMultilingualSupport('❌ CRITICAL: No greeting data returned from database', {
        greetingType,
        languagePreference,
        source: 'api-greeting-no-data',
        impact: 'Complete multilingual support failure'
      });
      
      logGreeting('❌ API: No greeting data returned', {
        greetingType,
        languagePreference,
        source: 'api-greeting-no-data'
      });

      // Server-side file logging for no data
      logMultilingualSupportServer({
        level: 'ERROR',
        category: 'NO_DATA_RETURNED',
        operation: 'greeting-no-data',
        userId: userId || 'anonymous',
        error: errorMessage,
        data: {
          greetingType,
          languagePreference,
          impact: 'Complete multilingual support failure'
        }
      });
      
      return NextResponse.json(
        { 
          error: errorMessage,
          greetingType,
          languagePreference,
          suggestion: 'Create this greeting in the admin interface',
          adminUrl: '/chatbotV16/admin/greetings'
        },
        { status: 404 }
      );
    }

    logMultilingualSupport('✅ SUCCESS: Multilingual greeting loaded from database', {
      greetingType,
      languagePreference,
      greetingId: greetingData.id,
      contentLength: greetingData.greeting_content?.length || 0,
      contentPreview: greetingData.greeting_content?.substring(0, 200) || 'EMPTY',
      createdAt: greetingData.created_at,
      updatedAt: greetingData.updated_at,
      metadata: greetingData.metadata,
      source: 'api-greeting-success',
      impact: 'AI will greet user in selected language'
    });

    logGreeting('✅ API: Successfully loaded greeting from database', {
      greetingType,
      languagePreference,
      greetingId: greetingData.id,
      contentLength: greetingData.greeting_content?.length || 0,
      contentPreview: greetingData.greeting_content?.substring(0, 200) || 'EMPTY',
      createdAt: greetingData.created_at,
      updatedAt: greetingData.updated_at,
      source: 'api-greeting-success'
    });

    logMultilingualSupport('🔍 FULL MULTILINGUAL GREETING CONTENT:', {
      greetingType,
      languagePreference,
      greetingId: greetingData.id,
      fullContent: greetingData.greeting_content || 'EMPTY',
      contentLength: greetingData.greeting_content?.length || 0,
      source: 'api-greeting-full-content',
      translationMetadata: greetingData.metadata
    });

    logGreeting('🔍 FULL GREETING CONTENT FROM DATABASE:', {
      greetingType,
      languagePreference,
      greetingId: greetingData.id,
      fullContent: greetingData.greeting_content || 'EMPTY',
      source: 'api-greeting-full-content'
    });

    // Server-side file logging for successful greeting load
    logMultilingualSupportServer({
      level: 'INFO',
      category: 'GREETING_SUCCESS',
      operation: 'greeting-loaded-successfully',
      userId: userId || 'anonymous',
      data: {
        greetingType,
        languagePreference,
        greetingId: greetingData.id,
        contentLength: greetingData.greeting_content?.length || 0,
        createdAt: greetingData.created_at,
        updatedAt: greetingData.updated_at,
        hasMetadata: !!greetingData.metadata,
        impact: 'AI will greet user in selected language'
      }
    });

    return NextResponse.json({
      success: true,
      greeting: {
        id: greetingData.id,
        type: greetingData.greeting_type,
        language: greetingData.language_code,
        content: greetingData.greeting_content,
        metadata: greetingData.metadata,
        createdAt: greetingData.created_at,
        updatedAt: greetingData.updated_at
      }
    });

  } catch (error) {
    const errorMessage = `Unexpected error in greeting-prompt API: ${(error as Error).message}`;
    console.error('[greeting_api] ❌ API: Unexpected error:', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: 'Internal server error loading greeting prompt',
        suggestion: 'Check server logs for detailed error information',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}