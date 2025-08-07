// file: src/app/api/v11/greeting-prompt/route.ts

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API route for fetching a user's custom greeting prompt
 * @param request The request object containing the user ID
 * @returns The greeting prompt text or default greeting
 */
export async function GET(request: Request) {
  let greetingType = 'default';
  
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const isAnonymous = url.searchParams.get('anonymous') === 'true';
    greetingType = url.searchParams.get('greetingType') || 'default';
    const isGlobal = url.searchParams.get('global') === 'true';
    
    console.log('[admin] greeting-prompt API called with params:', {
      userId,
      isAnonymous,
      greetingType,
      isGlobal,
      fullUrl: url.toString()
    });

    if (!userId && !isAnonymous && !isGlobal) {
      console.log('[admin] ERROR: No userId, not anonymous, and not global request');
      return NextResponse.json({ error: 'Either userId or anonymous flag is required' }, { status: 400 });
    }

    // If there's a user ID, try to fetch user-specific prompts first
    if (userId) {
      console.log('[API] Fetching greeting prompt for user:', userId);

      // First get prompt_version_ids for this user with greeting category and type
      let assignmentQuery = supabase
        .from('user_prompt_assignments')
        .select(`
          prompt_version_id,
          prompt_versions!inner(
            id,
            content,
            prompts!inner(category, greeting_type)
          )
        `)
        .eq('user_id', userId)
        .eq('prompt_versions.prompts.category', 'greeting')
        .order('assigned_at', { ascending: false })
        .limit(1);
      
      // Filter by greeting type
      if (greetingType) {
        assignmentQuery = assignmentQuery.eq('prompt_versions.prompts.greeting_type', greetingType);
      }
      
      const { data: assignments, error: assignmentError } = await assignmentQuery;

      console.log('[admin] User assignment query result:', {
        hasData: assignments && assignments.length > 0,
        error: assignmentError?.message,
        userId,
        greetingType,
        assignmentCount: assignments?.length || 0
      });

      if (assignmentError) {
        console.error('[API] Error fetching user prompt assignments:', assignmentError);
        // Continue to global prompts
      } 
      // If we have a custom prompt content, return it
      else if (assignments && assignments.length > 0 && assignments[0].prompt_versions && 'content' in assignments[0].prompt_versions) {
        console.log('[admin] Found custom greeting for user:', userId, 'type:', greetingType);
        const response = {
          promptContent: assignments[0].prompt_versions.content as string,
          isCustom: true,
          source: 'user'
        };
        console.log('[admin] Returning user-specific greeting:', {
          source: response.source,
          contentPreview: response.promptContent.substring(0, 50) + '...'
        });
        return NextResponse.json(response);
      }
    }

    // For both anonymous users and users with no specific assignments, check for global prompts
    console.log(`[admin] ${isAnonymous ? 'Anonymous user' : 'No user-specific greeting found'}, checking for global prompts of type: ${greetingType}`);
    
    let globalQuery = supabase
      .from('prompts')
      .select(`
        id,
        created_at,
        prompt_versions(
          id,
          content,
          created_at
        )
      `)
      .eq('category', 'greeting')
      .eq('is_global', true);
    
    // Filter by greeting type
    if (greetingType) {
      globalQuery = globalQuery.eq('greeting_type', greetingType);
    }
    
    // First order by prompt created_at to get newest prompts first
    globalQuery = globalQuery.order('created_at', { ascending: false });
    // Then order prompt_versions by created_at descending to get the latest version first
    globalQuery = globalQuery.order('created_at', { ascending: false, foreignTable: 'prompt_versions' });
    
    const { data: globalPrompts, error: globalError } = await globalQuery;

    if (globalError) {
      console.error('[API] Error fetching global greeting prompts:', globalError);
      return NextResponse.json({
        promptContent: "Ask if they are ready to start. Be brief and to the point.",
        isCustom: false,
        source: 'default',
        error: 'Error fetching global prompts'
      });
    }

    // If we found a global prompt, return its content
    if (globalPrompts && globalPrompts.length > 0) {
      console.log(`[admin] Found ${globalPrompts.length} global prompts for type: ${greetingType}`);
      // Since we ordered by created_at desc in the foreign table, the first version should be the latest
      const prompt = globalPrompts[0];
      console.log(`[admin] Prompt ID: ${prompt.id}, has ${prompt.prompt_versions?.length || 0} versions`);
      if (prompt.prompt_versions && Array.isArray(prompt.prompt_versions) && prompt.prompt_versions.length > 0) {
        // Log all versions for debugging
        prompt.prompt_versions.forEach((v, i) => {
          console.log(`[admin] Version ${i}: created_at=${v.created_at}, content_preview=${v.content?.substring(0, 50)}...`);
        });
        // The versions are already sorted by created_at DESC due to our query
        const latestVersion = prompt.prompt_versions[0];
        if ('content' in latestVersion) {
          console.log('[admin] Found global greeting prompt with latest version, created at:', latestVersion.created_at);
          const response = {
            promptContent: latestVersion.content as string,
            isCustom: false,
            source: 'global'
          };
          console.log('[admin] Returning global greeting:', {
            source: response.source,
            greetingType,
            contentPreview: response.promptContent.substring(0, 50) + '...'
          });
          return NextResponse.json(response);
        }
      }
    }

    // If no custom greeting or global prompt is found, return the default greeting based on type
    console.log(`[API] No custom or global greeting found for type: ${greetingType}, returning default`);
    
    let defaultContent = "Ask if they are ready to start. Be brief and to the point.";
    
    if (greetingType === 'resources') {
      defaultContent = "I'm here to help you access support resources. What type of help are you looking for today?";
    } else if (greetingType === 'future_pathways') {
      defaultContent = "I'm excited to help you explore your future pathways! What's been on your mind about your career or life direction?";
    }
    
    return NextResponse.json({
      promptContent: defaultContent,
      isCustom: false,
      source: 'default',
      greetingType
    });

  } catch (error) {
    console.error('[API] Error in greeting-prompt API route:', error);
    let defaultContent = "Ask if they are ready to start. Be brief and to the point.";
    
    if (greetingType === 'resources') {
      defaultContent = "I'm here to help you access support resources. What type of help are you looking for today?";
    } else if (greetingType === 'future_pathways') {
      defaultContent = "I'm excited to help you explore your future pathways! What's been on your mind about your career or life direction?";
    }
    
    return NextResponse.json({
      promptContent: defaultContent,
      isCustom: false,
      error: 'Internal server error',
      greetingType
    });
  }
}