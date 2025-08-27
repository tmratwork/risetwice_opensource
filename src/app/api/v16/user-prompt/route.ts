import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    console.log('[user_prompt] API: user-prompt request received', {
      userId: userId || 'anonymous',
      url: request.url,
      timestamp: new Date().toISOString(),
      source: 'api-user-prompt'
    });

    if (!userId) {
      const error = 'User ID is required. Please specify ?userId=<user_id>';
      console.log('[user_prompt] ❌ API: Missing userId parameter', { error });
      
      return NextResponse.json(
        { error, details: 'User ID is required to fetch custom prompts' },
        { status: 400 }
      );
    }

    console.log('[user_prompt] 🔍 API: Checking for custom prompt', {
      userId,
      table: 'user_custom_prompts',
      source: 'api-custom-prompt-query'
    });

    // First check if user has a custom prompt
    const { data: customPrompt, error: customError } = await supabaseAdmin
      .from('user_custom_prompts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (customError && customError.code !== 'PGRST116') {
      // Database error (not "no rows found")
      const errorMessage = `Database error loading custom prompt: ${customError.message}`;
      console.error('[user_prompt] ❌ API: Database error loading custom prompt', {
        userId,
        error: customError.message,
        code: customError.code,
        details: customError.details
      });

      return NextResponse.json(
        { 
          error: errorMessage,
          userId,
          details: 'Check database connection',
        },
        { status: 500 }
      );
    }

    // If custom prompt found, return it
    if (customPrompt) {
      console.log('[user_prompt] ✅ SUCCESS: Custom prompt found', {
        userId,
        customPromptId: customPrompt.id,
        contentLength: customPrompt.custom_content?.length || 0,
        contentPreview: customPrompt.custom_content?.substring(0, 200) || 'EMPTY',
        createdAt: customPrompt.created_at,
        updatedAt: customPrompt.updated_at,
        source: 'custom-prompt-success'
      });

      return NextResponse.json({
        success: true,
        promptContent: customPrompt.custom_content,
        source: 'custom',
        promptType: 'triage',
        customPrompt: {
          id: customPrompt.id,
          createdAt: customPrompt.created_at,
          updatedAt: customPrompt.updated_at
        }
      });
    }

    console.log('[user_prompt] 🔍 API: No custom prompt found, loading default triage prompt', {
      userId,
      table: 'ai_prompts',
      query: { prompt_type: 'triage', is_active: true },
      source: 'api-default-prompt-query'
    });

    // No custom prompt found, load default triage prompt
    const { data: defaultPrompt, error: defaultError } = await supabaseAdmin
      .from('ai_prompts')
      .select('*')
      .eq('prompt_type', 'triage')
      .eq('is_active', true)
      .single();

    if (defaultError) {
      let errorMessage: string;
      let statusCode: number;

      if (defaultError.code === 'PGRST116') {
        // No rows found - critical error as default triage prompt should always exist
        errorMessage = `No active default triage prompt found. This is a critical system error - the default triage prompt must exist in ai_prompts table.`;
        statusCode = 500; // Server error, not user error
        
        console.error('[user_prompt] ❌ CRITICAL: No default triage prompt found', {
          userId,
          errorCode: 'PGRST116_NO_DEFAULT_PROMPT',
          impact: 'Complete system failure - no prompt available',
          source: 'default-prompt-missing'
        });
      } else {
        // Database error
        errorMessage = `Database error loading default triage prompt: ${defaultError.message}`;
        statusCode = 500;
        
        console.error('[user_prompt] ❌ CRITICAL: Database error loading default prompt', {
          userId,
          errorMessage: defaultError.message,
          errorCode: defaultError.code,
          errorDetails: defaultError.details,
          source: 'database-error'
        });
      }

      return NextResponse.json(
        { 
          error: errorMessage,
          userId,
          promptType: 'triage',
          details: 'Critical system error - no prompt available',
        },
        { status: statusCode }
      );
    }

    if (!defaultPrompt) {
      const errorMessage = `No default triage prompt data returned - critical system error`;
      
      console.error('[user_prompt] ❌ CRITICAL: No default prompt data returned', {
        userId,
        source: 'api-default-prompt-no-data',
        impact: 'Complete system failure'
      });
      
      return NextResponse.json(
        { 
          error: errorMessage,
          userId,
          promptType: 'triage',
          details: 'Critical system error - no prompt data available',
        },
        { status: 500 }
      );
    }

    console.log('[user_prompt] ✅ SUCCESS: Default triage prompt loaded', {
      userId,
      promptId: defaultPrompt.id,
      promptType: defaultPrompt.prompt_type,
      contentLength: defaultPrompt.prompt_content?.length || 0,
      contentPreview: defaultPrompt.prompt_content?.substring(0, 200) || 'EMPTY',
      createdAt: defaultPrompt.created_at,
      updatedAt: defaultPrompt.updated_at,
      source: 'default-prompt-success'
    });

    return NextResponse.json({
      success: true,
      promptContent: defaultPrompt.prompt_content,
      source: 'default',
      promptType: defaultPrompt.prompt_type,
      defaultPrompt: {
        id: defaultPrompt.id,
        type: defaultPrompt.prompt_type,
        createdAt: defaultPrompt.created_at,
        updatedAt: defaultPrompt.updated_at,
        metadata: defaultPrompt.metadata,
        functions: defaultPrompt.functions,
        mergeWithUniversalFunctions: defaultPrompt.merge_with_universal_functions,
        mergeWithUniversalProtocols: defaultPrompt.merge_with_universal_protocols
      }
    });

  } catch (error) {
    const errorMessage = `Unexpected error in user-prompt API: ${(error as Error).message}`;
    console.error('[user_prompt] ❌ API: Unexpected error:', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: 'Internal server error loading user prompt',
        suggestion: 'Check server logs for detailed error information',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, customContent } = body;

    console.log('[user_prompt] API: save custom prompt request received', {
      userId: userId || 'anonymous',
      contentLength: customContent?.length || 0,
      timestamp: new Date().toISOString(),
      source: 'api-save-custom-prompt'
    });

    if (!userId) {
      const error = 'User ID is required in request body';
      console.log('[user_prompt] ❌ API: Missing userId in body', { error });
      
      return NextResponse.json(
        { error, details: 'User ID is required to save custom prompts' },
        { status: 400 }
      );
    }

    if (!customContent || typeof customContent !== 'string' || customContent.trim().length === 0) {
      const error = 'Custom content is required and must be a non-empty string';
      console.log('[user_prompt] ❌ API: Invalid custom content', { error, userId });
      
      return NextResponse.json(
        { error, details: 'Custom prompt content cannot be empty' },
        { status: 400 }
      );
    }

    // Validate content length (reasonable limit)
    if (customContent.length > 10000) {
      const error = 'Custom prompt content is too long (maximum 10,000 characters)';
      console.log('[user_prompt] ❌ API: Content too long', { error, userId, length: customContent.length });
      
      return NextResponse.json(
        { error, details: 'Prompt content exceeds maximum length' },
        { status: 400 }
      );
    }

    console.log('[user_prompt] 💾 API: Saving custom prompt', {
      userId,
      contentLength: customContent.length,
      contentPreview: customContent.substring(0, 200),
      source: 'api-save-custom-prompt'
    });

    // Upsert custom prompt (insert or update if exists)
    const { data: savedPrompt, error: saveError } = await supabaseAdmin
      .from('user_custom_prompts')
      .upsert(
        {
          user_id: userId,
          custom_content: customContent.trim(),
          is_active: true,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'user_id', // Update if user_id already exists
          ignoreDuplicates: false
        }
      )
      .select()
      .single();

    if (saveError) {
      const errorMessage = `Database error saving custom prompt: ${saveError.message}`;
      console.error('[user_prompt] ❌ API: Database error saving custom prompt', {
        userId,
        error: saveError.message,
        code: saveError.code,
        details: saveError.details
      });

      return NextResponse.json(
        { 
          error: errorMessage,
          userId,
          details: 'Failed to save custom prompt to database',
        },
        { status: 500 }
      );
    }

    console.log('[user_prompt] ✅ SUCCESS: Custom prompt saved', {
      userId,
      promptId: savedPrompt.id,
      contentLength: savedPrompt.custom_content?.length || 0,
      createdAt: savedPrompt.created_at,
      updatedAt: savedPrompt.updated_at,
      source: 'save-custom-prompt-success'
    });

    return NextResponse.json({
      success: true,
      message: 'Custom prompt saved successfully',
      customPrompt: {
        id: savedPrompt.id,
        userId: savedPrompt.user_id,
        contentLength: savedPrompt.custom_content?.length || 0,
        createdAt: savedPrompt.created_at,
        updatedAt: savedPrompt.updated_at
      }
    });

  } catch (error) {
    const errorMessage = `Unexpected error saving custom prompt: ${(error as Error).message}`;
    console.error('[user_prompt] ❌ API: Unexpected error saving:', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: 'Internal server error saving custom prompt',
        suggestion: 'Check server logs for detailed error information',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    console.log('[user_prompt] API: delete custom prompt request received', {
      userId: userId || 'anonymous',
      url: request.url,
      timestamp: new Date().toISOString(),
      source: 'api-delete-custom-prompt'
    });

    if (!userId) {
      const error = 'User ID is required. Please specify ?userId=<user_id>';
      console.log('[user_prompt] ❌ API: Missing userId parameter for delete', { error });
      
      return NextResponse.json(
        { error, details: 'User ID is required to delete custom prompts' },
        { status: 400 }
      );
    }

    console.log('[user_prompt] 🗑️ API: Deleting custom prompt', {
      userId,
      source: 'api-delete-custom-prompt'
    });

    // Delete custom prompt (set inactive rather than hard delete for audit trail)
    const { error: deleteError } = await supabaseAdmin
      .from('user_custom_prompts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (deleteError) {
      const errorMessage = `Database error deleting custom prompt: ${deleteError.message}`;
      console.error('[user_prompt] ❌ API: Database error deleting custom prompt', {
        userId,
        error: deleteError.message,
        code: deleteError.code,
        details: deleteError.details
      });

      return NextResponse.json(
        { 
          error: errorMessage,
          userId,
          details: 'Failed to delete custom prompt from database',
        },
        { status: 500 }
      );
    }

    console.log('[user_prompt] ✅ SUCCESS: Custom prompt deleted (set inactive)', {
      userId,
      source: 'delete-custom-prompt-success'
    });

    return NextResponse.json({
      success: true,
      message: 'Custom prompt reset to default successfully',
      userId
    });

  } catch (error) {
    const errorMessage = `Unexpected error deleting custom prompt: ${(error as Error).message}`;
    console.error('[user_prompt] ❌ API: Unexpected error deleting:', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: 'Internal server error deleting custom prompt',
        suggestion: 'Check server logs for detailed error information',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}