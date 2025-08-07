import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const aiType = searchParams.get('aiType');

    // console.log(`[triage] 📡 API: load-functions request received`, {
    //   aiType,
    //   url: request.url,
    //   timestamp: new Date().toISOString()
    // });

    if (!aiType) {
    // console.error(`[triage] ❌ API: load-functions - missing aiType parameter`);
      return NextResponse.json(
        { error: 'AI type is required' },
        { status: 400 }
      );
    }

    // console.log(`[triage] 🔍 API: Loading functions for AI type: ${aiType}`);

    // Load AI-specific functions using RLS-compliant RPC function
    const { data: aiPromptArray, error: aiError } = await supabaseAdmin
      .rpc('get_ai_prompt_by_type', {
        target_prompt_type: aiType,
        requesting_user_id: null
      });
    
    const aiPrompt = aiPromptArray?.[0] || null;

    if (aiError) {
    // console.error(`[triage] ❌ API: Database error loading ${aiType} functions`, {
    //     error: aiError.message,
    //     code: aiError.code,
    //     details: aiError.details
    //   });
      return NextResponse.json(
        { error: `Failed to load AI functions: ${aiError.message}` },
        { status: 500 }
      );
    }

    if (!aiPrompt) {
    // console.error(`[triage] ❌ API: No functions found for AI type: ${aiType}`);
      return NextResponse.json(
        { error: `No functions found for AI type: ${aiType}` },
        { status: 404 }
      );
    }

    const aiFunctions = aiPrompt.functions || [];
    // console.log(`[triage] ✅ API: Loaded ${aiFunctions.length} functions for ${aiType}`, {
    //   functionNames: aiFunctions.map((f: { name: string }) => f.name).join(', ')
    // });

    // Load universal functions if AI type is not 'universal_functions' AND merge is enabled
    let universalFunctions: { name: string }[] = [];
    const mergeEnabled = aiPrompt.merge_with_universal_functions ?? true;
    const shouldMerge = aiType !== 'universal_functions' && mergeEnabled;
    
    if (shouldMerge) {
    // console.log(`[triage] 🔄 API: Loading universal functions to merge with ${aiType} functions`);
      
      // Load universal functions using RLS-compliant access
      const { data: universalPromptArray, error: universalError } = await supabaseAdmin
        .rpc('get_ai_prompt_by_type', {
          target_prompt_type: 'universal_functions',
          requesting_user_id: null
        });
      
      const universalPrompt = universalPromptArray?.[0] || null;

      if (universalError) {
    // console.warn(`[triage] ⚠️ API: Could not load universal functions for merging`, {
    //       error: universalError.message,
    //       code: universalError.code
    //     });
        // Continue without merging - not a breaking error
      } else if (universalPrompt?.functions) {
        universalFunctions = universalPrompt.functions;
    // console.log(`[triage] ✅ API: Successfully loaded universal functions for merging`, {
    //       universalCount: universalFunctions.length,
    //       universalNames: universalFunctions.map((f: { name: string }) => f.name).join(', ')
    //     });
      } else {
    // console.log(`[triage] 📭 API: No universal functions found for merging`);
      }
    }

    // Combine AI-specific functions with universal functions
    const allFunctions = [...aiFunctions, ...universalFunctions];
    
    // Log function loading details for triage AI
    if (process.env.NEXT_PUBLIC_ENABLE_FUNCTION_EXECUTION_LOGS === 'true' && aiType === 'triage') {
      console.log(`[function_execution] 📊 TRIAGE AI FUNCTION LOADING SUMMARY (API):`);
      console.log(`[function_execution] AI-Specific Functions: ${aiFunctions.length}`);
      console.log(`[function_execution] Universal Functions: ${universalFunctions.length}`);
      console.log(`[function_execution] Total Available Functions: ${allFunctions.length}`);
      console.log(`[function_execution] Merge Universal Functions: ${shouldMerge ? 'ENABLED' : 'DISABLED'}`);
      console.log(`[function_execution] Database Merge Setting: ${mergeEnabled ? 'ENABLED' : 'DISABLED'}`);
      console.log(`[function_execution] Function Names:`, allFunctions.map((f: { name: string }) => f.name));
    }

    return NextResponse.json({
      success: true,
      functions: allFunctions,
      metadata: {
        aiType,
        aiSpecificCount: aiFunctions.length,
        universalCount: universalFunctions.length,
        totalCount: allFunctions.length,
        merged: shouldMerge
      }
    });

  } catch (error) {
    // console.error('[triage] ❌ API: Unexpected error in load-functions', {
    //   error: (error as Error).message,
    //   stack: (error as Error).stack
    // });
    void error;
    return NextResponse.json(
      { error: 'Internal server error loading AI functions' },
      { status: 500 }
    );
  }
}