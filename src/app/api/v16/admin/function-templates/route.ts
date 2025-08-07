// src/app/api/v16/admin/function-templates/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // console.log('[V16-ADMIN] 📡 Loading function templates');

    const { data, error } = await supabase
      .from('function_templates')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
    // console.error('[V16-ADMIN] ❌ Error loading function templates:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    // console.log(`[V16-ADMIN] ✅ Loaded ${data?.length || 0} function templates`);

    return NextResponse.json({
      success: true,
      templates: data || []
    });

  } catch (error) {
    // console.error('[V16-ADMIN] ❌ Error in function templates API:', error);
    void error;
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // console.log('[V16-ADMIN] 📡 Creating function template');

    const { name, description, category, function_definition } = await request.json();

    if (!name || !description || !category || !function_definition) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: name, description, category, function_definition'
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('function_templates')
      .insert({
        name,
        description,
        category,
        function_definition
      })
      .select()
      .single();

    if (error) {
    // console.error('[V16-ADMIN] ❌ Error creating function template:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    // console.log(`[V16-ADMIN] ✅ Created function template: ${data.name}`);

    return NextResponse.json({
      success: true,
      template: data
    });

  } catch (error) {
    // console.error('[V16-ADMIN] ❌ Error in function template creation:', error);
    void error;
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}