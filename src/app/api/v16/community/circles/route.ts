import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { CreateCircleRequest, CirclesResponse } from '@/app/chatbotV16/community/types/community';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/v16/community/circles - List circles with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort_by') || 'member_count'; // member_count, post_count, name, created_at
    const isPrivate = searchParams.get('is_private');

    // Get requesting user ID for proper access control
    // For now, allow unauthenticated access and show only public circles
    const requestingUserId = searchParams.get('requesting_user_id') || 'anonymous_user';

    // Use RLS-compliant RPC function for circle discovery
    const offset = (page - 1) * limit;
    const isPrivateFilter = isPrivate === 'true' ? true : isPrivate === 'false' ? false : null;
    
    const { data: circles, error } = await supabaseAdmin
      .rpc('get_discoverable_circles', {
        requesting_user_id: requestingUserId,
        search_term: search || null,
        filter_private: isPrivateFilter,
        sort_by: sortBy,
        limit_count: limit,
        offset_count: offset
      });

    // Get total count for pagination (simplified for now)
    const count = circles?.length || 0;

    if (error) {
      console.error('Error fetching circles:', error);
      return NextResponse.json({ error: 'Failed to fetch circles' }, { status: 500 });
    }

    const response: CirclesResponse = {
      circles: circles || [],
      total_count: count || 0,
      page,
      limit,
      has_next_page: count ? count > page * limit : false,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Unexpected error in GET circles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/v16/community/circles - Create new circle
export async function POST(request: NextRequest) {
  try {
    const body: CreateCircleRequest & { user_id: string } = await request.json();
    
    // Validate user ID
    if (!body.user_id) {
      return NextResponse.json({ 
        error: 'User ID is required' 
      }, { status: 400 });
    }

    const userId = body.user_id;
    
    // Validate required fields
    if (!body.name || !body.display_name) {
      return NextResponse.json({ 
        error: 'Missing required fields: name and display_name' 
      }, { status: 400 });
    }

    // Validate name format (lowercase, alphanumeric, underscores, hyphens)
    const nameRegex = /^[a-z0-9_-]+$/;
    if (!nameRegex.test(body.name)) {
      return NextResponse.json({ 
        error: 'Circle name must contain only lowercase letters, numbers, underscores, and hyphens' 
      }, { status: 400 });
    }

    // Check if circle name already exists
    const { data: existingCircle } = await supabaseAdmin
      .from('circles')
      .select('id')
      .eq('name', body.name)
      .single();

    if (existingCircle) {
      return NextResponse.json({ 
        error: 'A circle with this name already exists' 
      }, { status: 409 });
    }

    // Create circle
    const circleData = {
      name: body.name,
      display_name: body.display_name,
      description: body.description || null,
      rules: body.rules || [],
      is_private: body.is_private || false,
      requires_approval: body.requires_approval || false,
      is_approved: false, // Requires admin approval before going live
      created_by: userId,
      member_count: 1, // Creator is first member
      post_count: 0,
    };

    const { data: circle, error: createError } = await supabaseAdmin
      .from('circles')
      .insert(circleData)
      .select()
      .single();

    if (createError) {
      console.error('Error creating circle:', createError);
      return NextResponse.json({ error: 'Failed to create circle' }, { status: 500 });
    }

    // Add creator as admin member
    if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_MEMBERSHIP_LOGS === 'true') {
      console.log('[circle_membership] [SERVER] Creating admin membership for circle creator:', {
        circleId: circle.id,
        circleName: circle.display_name,
        userId: userId,
        role: 'admin'
      });
    }

    const { data: membershipData, error: membershipError } = await supabase
      .from('circle_memberships')
      .insert({
        circle_id: circle.id,
        user_id: userId,
        role: 'admin',
      })
      .select()
      .single();

    if (membershipError) {
      if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_MEMBERSHIP_LOGS === 'true') {
        console.error('[circle_membership] [SERVER] ❌ Failed to create admin membership:', membershipError);
      }
      // Try to clean up the circle if membership creation failed
      await supabaseAdmin.from('circles').delete().eq('id', circle.id);
      return NextResponse.json({ error: 'Failed to create circle membership' }, { status: 500 });
    }

    if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_MEMBERSHIP_LOGS === 'true') {
      console.log('[circle_membership] [SERVER] ✅ Admin membership created successfully:', membershipData);
    }

    return NextResponse.json(circle, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST circles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}