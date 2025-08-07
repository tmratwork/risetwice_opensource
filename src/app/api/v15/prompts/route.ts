import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * V15 Get Prompts Endpoint
 * Retrieves the most recent prompt for a given category or categories
 * Supports insights prompts with multi-category retrieval
 * V15 doesn't check is_global - just gets the newest prompt
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const categories = searchParams.get('categories');

    // Support both single category and multi-category queries
    if (!category && !categories) {
      return NextResponse.json(
        { error: 'category or categories parameter is required' },
        { status: 400 }
      );
    }

    // Handle multi-category request (for insights prompts)
    if (categories) {
      const categoryList = categories.split(',').map(c => c.trim());
      
      // Validate insights categories
      const validInsightsCategories = ['insights_system', 'insights_user'];
      const invalidCategories = categoryList.filter(cat => !validInsightsCategories.includes(cat));
      
      if (invalidCategories.length > 0) {
        return NextResponse.json(
          { error: `Invalid categories: ${invalidCategories.join(', ')}. Only insights_system and insights_user are supported for multi-category queries.` },
          { status: 400 }
        );
      }

      return handleMultiCategoryRequest(categoryList);
    }

    // Get the most recent prompt for this category, regardless of global status
    const { data: promptData, error: promptError } = await supabase
      .from('prompts')
      .select(`
        id,
        category,
        created_at,
        prompt_versions:prompt_versions(
          id,
          content,
          version_number,
          created_at
        )
      `)
      .eq('category', category)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (promptError) {
      console.error('Error fetching prompts:', promptError);
      return NextResponse.json(
        { error: 'Failed to fetch prompts', details: promptError },
        { status: 500 }
      );
    }

    if (!promptData || promptData.length === 0) {
      return NextResponse.json({
        content: null,
        message: `No prompts found for category: ${category}`,
      });
    }

    const prompt = promptData[0];
    const versions = prompt.prompt_versions as Array<{
      id: string;
      content: string;
      version_number: string;
      created_at: string;
    }>;

    if (!versions || versions.length === 0) {
      return NextResponse.json({
        content: null,
        message: `No versions found for category: ${category}`,
      });
    }

    // Get the latest version
    const latestVersion = versions.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })[0];

    return NextResponse.json({
      content: latestVersion.content,
      promptId: prompt.id,
      versionId: latestVersion.id,
      category,
    });

  } catch (error) {
    console.error('Error in prompts GET:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * Handle multi-category request for insights prompts
 * Returns systemPrompt and userPrompt compatible with preprocessing API
 */
async function handleMultiCategoryRequest(categories: string[]) {
  try {
    const result: { systemPrompt?: string; userPrompt?: string } = {};

    for (const category of categories) {
      // Get the most recent prompt for this category
      const { data: promptData, error: promptError } = await supabase
        .from('prompts')
        .select(`
          id,
          category,
          created_at,
          prompt_versions:prompt_versions(
            id,
            content,
            version_number,
            created_at
          )
        `)
        .eq('category', category)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (promptError) {
        console.error(`Error fetching prompts for category ${category}:`, promptError);
        continue;
      }

      if (!promptData || promptData.length === 0) {
        console.log(`No prompts found for category: ${category}`);
        continue;
      }

      const prompt = promptData[0];
      const versions = prompt.prompt_versions as Array<{
        id: string;
        content: string;
        version_number: string;
        created_at: string;
      }>;

      if (!versions || versions.length === 0) {
        console.log(`No versions found for category: ${category}`);
        continue;
      }

      // Get the latest version
      const latestVersion = versions.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })[0];

      // Map to expected format for preprocessing API
      if (category === 'insights_system') {
        result.systemPrompt = latestVersion.content;
      } else if (category === 'insights_user') {
        result.userPrompt = latestVersion.content;
      }
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error in handleMultiCategoryRequest:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}